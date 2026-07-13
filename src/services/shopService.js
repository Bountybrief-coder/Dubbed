import { supabase } from "../lib/supabase";

// ---------------------------------------------------------------------------
// Catalog (mirrors the server-side prices in shop_price(); server is the
// source of truth and re-validates every purchase — this is display only).
// ---------------------------------------------------------------------------
export const SHOP_CATALOG = {
  wagr_membership: {
    key: "wagr_membership",
    name: "WAGR Membership",
    category: "membership",
    price: 4.99,
    interval: "month",
    tagline: "Compete smarter. Zero rake, free monthly credit, and premium perks.",
    benefits: [
      "Free $1.00 monthly wallet credit",
      "0% rake on all cash matches and bets",
      "Exclusive WAGR Member tournaments",
      "Exclusive WAGR profile badge",
      "Priority matchmaking",
      "Premium profile flair",
      "Early access to new features",
      "Monthly renewal · cancel anytime"
    ]
  },
  username_change: {
    key: "username_change",
    name: "Username Change",
    category: "account_service",
    price: 2.99,
    tagline: "Unlock a one-time username change. Pick something new."
  },
  stat_reset: {
    key: "stat_reset",
    name: "Stat Reset",
    category: "account_service",
    price: 4.99,
    tagline: "Wipe your competitive record and start fresh. Trophies & wallet stay."
  },
  double_xp_token: {
    key: "double_xp_token",
    name: "Double XP Token (24hr)",
    category: "account_service",
    price: 0.99,
    tagline: "Doubles all XP and Elo gains from matches for 24 hours. Activates immediately."
  }
};

export const COMING_SOON = [
  { key: "animated_borders", name: "Animated Profile Borders" },
  { key: "profile_banners", name: "Profile Banners" },
  { key: "premium_themes", name: "Premium Profile Themes" },
  { key: "avatar_frames", name: "Exclusive Avatar Frames" },
  { key: "celebration_fx", name: "Tournament Celebration Effects" }
];

// ---------------------------------------------------------------------------
// Purchases
// ---------------------------------------------------------------------------
export async function purchaseWithWallet(itemKey) {
  const { data, error } = await supabase.rpc("purchase_with_wallet", { p_item: itemKey });
  return { data, error: error?.message };
}

// Card checkout via Edge Function (account services or membership subscription).
export async function startCheckout(itemKey) {
  const { data, error } = await supabase.functions.invoke("stripe-shop-checkout", {
    body: { item: itemKey }
  });
  return { url: data?.url || null, error: error?.message || data?.error };
}

export async function changeUsername(newName) {
  const { error } = await supabase.rpc("change_username", { p_new: newName });
  return { error: error?.message };
}

export async function performStatReset() {
  const { error } = await supabase.rpc("perform_stat_reset");
  return { error: error?.message };
}

// A stat_reset is "available" when there's a completed, not-yet-applied purchase.
export async function getUnusedStatReset(userId) {
  const { data, error } = await supabase
    .from("shop_purchases")
    .select("id, meta")
    .eq("user_id", userId)
    .eq("item_key", "stat_reset")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(5);
  const available = (data || []).some((p) => !(p.meta && p.meta.applied));
  return { available, error: error?.message };
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------
export async function getPurchaseHistory(userId) {
  const { data, error } = await supabase
    .from("shop_purchases")
    .select("id, item_name, item_key, category, price, payment_method, status, transaction_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return { data: data || [], error: error?.message };
}

export async function getUsernameHistory(userId) {
  const { data, error } = await supabase
    .from("username_history")
    .select("id, old_username, new_username, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return { data: data || [], error: error?.message };
}

// ---------------------------------------------------------------------------
// Membership subscription management
// ---------------------------------------------------------------------------
// Opens the Stripe billing portal so the user can cancel/manage the sub.
export async function openBillingPortal() {
  const { data, error } = await supabase.functions.invoke("stripe-billing-portal", {
    body: {}
  });
  return { url: data?.url || null, error: error?.message || data?.error };
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export async function adminListShopPurchases(category = null) {
  const { data, error } = await supabase.rpc("admin_list_shop_purchases", { p_category: category });
  return { data: data || [], error: error?.message };
}

export async function adminShopStats() {
  const { data, error } = await supabase.rpc("admin_shop_stats");
  return { data: data || null, error: error?.message };
}

export async function adminRefundPurchase(purchaseId, toWallet = true) {
  const { error } = await supabase.rpc("admin_refund_purchase", { p_purchase: purchaseId, p_to_wallet: toWallet });
  return { error: error?.message };
}
