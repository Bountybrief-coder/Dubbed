import { supabase } from "../lib/supabase";

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------
export async function getLedger(userId, limit = 50) {
  const { data, error } = await supabase
    .from("wallet_ledger")
    .select("id, delta, reason, ref_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return { data: data || [], error: error?.message };
}

// Deposit via Stripe Checkout. Redirects to Stripe; the deposit-webhook Edge
// Function credits the balance on confirmation. Falls back to the old direct
// RPC if the Edge Function isn't deployed yet (dev/test convenience).
export async function deposit(amount) {
  const { data, error } = await supabase.functions.invoke("stripe-deposit-checkout", {
    body: { amount: Number(amount) }
  });
  if (error?.message?.includes("not found") || error?.message?.includes("FunctionNotFound")) {
    // Edge Function not deployed — fall back to direct RPC for testing.
    const { error: rpcErr } = await supabase.rpc("deposit", { amount: Number(amount) });
    return { error: rpcErr?.message };
  }
  if (error || data?.error) return { error: error?.message || data?.error };
  if (data?.url) window.location.href = data.url;
  return { error: null };
}

// ---------------------------------------------------------------------------
// Withdrawals (user)
// ---------------------------------------------------------------------------
// Server-side gate: returns a human reason string if the user can't withdraw
// right now (dispute, pending payout, unsettled bet, unverified, suspended,
// incomplete Stripe, etc.), or null when clear.
export async function getWithdrawalBlock(userId) {
  const { data, error } = await supabase.rpc("withdrawal_block_reason", { p_user: userId });
  return { reason: data || null, error: error?.message };
}

export async function getAvailableToWithdraw(userId) {
  const { data, error } = await supabase.rpc("available_to_withdraw", { p_user: userId });
  return { amount: Number(data || 0), error: error?.message };
}

// Files a request; funds move to pending (held). If auto-approved, fires the
// payout edge function immediately (best-effort — admin fallback if it fails).
export async function requestWithdrawal(amount, destination) {
  const { data, error } = await supabase.rpc("request_withdrawal", {
    p_amount: Number(amount),
    p_destination: destination || null
  });
  if (error) return { data: null, error: error.message };

  if (data?.auto_approved) {
    supabase.functions.invoke("stripe-payout", {
      body: { withdrawal_id: data.id }
    }).catch(() => {});
  }

  return { data, error: null };
}

export async function getWithdrawalRequests(userId) {
  const { data, error } = await supabase
    .from("withdrawal_requests")
    .select("id, amount, status, provider, destination, payout_id, transaction_id, rejected_reason, created_at, processing_at, completed_at, meta")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return { data: data || [], error: error?.message };
}

export function subscribeToWithdrawals(userId, onChange) {
  const channel = supabase
    .channel(`withdrawals:${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "withdrawal_requests", filter: `user_id=eq.${userId}` },
      onChange
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ---------------------------------------------------------------------------
// Stripe Connect Express onboarding (via secure Edge Functions)
// ---------------------------------------------------------------------------
// Creates (or reuses) the user's Express account and returns a one-time
// onboarding link. All secret-key work happens in the Edge Function.
export async function startStripeOnboarding() {
  const { data, error } = await supabase.functions.invoke("stripe-connect-onboard", {
    body: {}
  });
  return { url: data?.url || null, error: error?.message || data?.error };
}

// Pulls the latest account status from Stripe and syncs it into the profile.
// Called on the onboarding return and when the user taps "refresh status".
export async function refreshStripeStatus() {
  const { data, error } = await supabase.functions.invoke("stripe-connect-status", { body: {} });
  return { data: data || null, error: error?.message || data?.error };
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export async function adminListWithdrawals(status = null) {
  const { data, error } = await supabase.rpc("admin_list_withdrawals", { p_status: status });
  return { data: data || [], error: error?.message };
}

export async function adminMarkProcessing(id) {
  const { error } = await supabase.rpc("mark_withdrawal_processing", { p_id: id });
  return { error: error?.message };
}

// Fires the payout via Edge Function (server-side, service role). The webhook
// later flips the request to 'paid' on payout.paid.
export async function adminApproveWithdrawal(id) {
  const { data, error } = await supabase.functions.invoke("stripe-payout", { body: { withdrawal_id: id } });
  return { data: data || null, error: error?.message || data?.error };
}

export async function adminRejectWithdrawal(id, reason) {
  const { error } = await supabase.rpc("reject_withdrawal", { p_id: id, p_reason: reason || "Rejected by admin" });
  return { error: error?.message };
}

export async function adminGetAutoPayoutsEnabled() {
  const { data, error } = await supabase
    .from("app_settings").select("value").eq("key", "auto_payouts_enabled").maybeSingle();
  return { enabled: data?.value === true, error: error?.message };
}

export async function adminToggleAutoPayouts(enabled) {
  const { error } = await supabase.rpc("admin_toggle_auto_payouts", { p_enabled: enabled });
  return { error: error?.message };
}

// ---------------------------------------------------------------------------
// Derived summary for the dashboard (pure client math over server data)
// ---------------------------------------------------------------------------
export function summarizeWithdrawals(rows = []) {
  const pending = rows.filter((r) => r.status === "pending" || r.status === "processing");
  const paid = rows.filter((r) => r.status === "paid");
  const pendingTotal = pending.reduce((s, r) => s + Number(r.amount), 0);
  const lifetime = paid.reduce((s, r) => s + Number(r.amount), 0);
  const last = paid[0] || null; // rows come newest-first
  return { pendingTotal, lifetime, last, pendingCount: pending.length };
}
