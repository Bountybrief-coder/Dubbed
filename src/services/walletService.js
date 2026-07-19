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

// Deposit via NOWPayments crypto invoice. Redirects to NOWPayments hosted
// checkout; the IPN webhook Edge Function credits the balance on confirmation.
export async function deposit(amount) {
  const { data, error } = await supabase.functions.invoke("nowpayments-deposit", {
    body: { amount: Number(amount) }
  });
  if (error || data?.error) return { error: error?.message || data?.error };
  if (data?.url) { window.location.href = data.url; return { error: null }; }
  return { error: "Couldn't start checkout. Please try again." };
}

// ---------------------------------------------------------------------------
// Withdrawals (user)
// ---------------------------------------------------------------------------
export async function getWithdrawalBlock(userId) {
  const { data, error } = await supabase.rpc("withdrawal_block_reason", { p_user: userId });
  return { reason: data || null, error: error?.message };
}

export async function getAvailableToWithdraw(userId) {
  const { data, error } = await supabase.rpc("available_to_withdraw", { p_user: userId });
  return { amount: Number(data || 0), error: error?.message };
}

export async function requestWithdrawal(amount, destination) {
  const { data, error } = await supabase.rpc("request_withdrawal", {
    p_amount: Number(amount),
    p_destination: destination || null
  });
  if (error) return { data: null, error: error.message };

  if (data?.auto_approved) {
    const payout = await supabase.functions.invoke("nowpayments-payout", {
      body: { withdrawal_id: data.id }
    });
    if (payout.error || payout.data?.error) {
      return { data, error: `Withdrawal approved but payout failed: ${payout.error?.message || payout.data?.error}. Contact support.` };
    }
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
// Crypto wallet setup (replaces Stripe Connect onboarding)
// ---------------------------------------------------------------------------
export async function saveCryptoWallet(address, currency = "usdttrc20") {
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) return { error: "Not authenticated" };
  const { error } = await supabase
    .from("profiles")
    .update({ crypto_wallet_address: address, crypto_wallet_currency: currency })
    .eq("id", user.id);
  return { error: error?.message };
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

export async function adminApproveWithdrawal(id) {
  const { data, error } = await supabase.functions.invoke("nowpayments-payout", { body: { withdrawal_id: id } });
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
  const last = paid[0] || null;
  return { pendingTotal, lifetime, last, pendingCount: pending.length };
}

// Fires when a winning payout lands in the current user's ledger — powers the
// win-celebration moment. RLS restricts wallet_ledger to its owner, so this
// only ever delivers the user's own rows.
const WIN_REASONS = ["match_payout", "tournament_payout", "bet_offer_payout", "side_bet_payout", "bet_payout"];
export function subscribeToMyPayouts(userId, onPayout) {
  const channel = supabase
    .channel(`payouts:${userId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "wallet_ledger", filter: `user_id=eq.${userId}` },
      (payload) => {
        const row = payload.new;
        if (row && Number(row.delta) > 0 && WIN_REASONS.includes(row.reason)) onPayout(row);
      }
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
