// POST /nowpayments-webhook
// NOWPayments IPN (Instant Payment Notification) handler. Routes by order_id
// prefix: "deposit_" credits wallet, "shop_" grants item. Verifies HMAC-SHA512
// signature and enforces idempotency via payment_events table.
import { json, verifyIPN, serviceClient } from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const sig = req.headers.get("x-nowpayments-sig");
  if (!sig) return json({ error: "missing signature" }, 400);

  const body = await req.text();

  const valid = await verifyIPN(body, sig);
  if (!valid) return json({ error: "invalid signature" }, 400);

  const payload = JSON.parse(body) as Record<string, unknown>;
  const status = payload.payment_status as string;
  const paymentId = String(payload.payment_id ?? "");
  const orderId = String(payload.order_id ?? "");
  const priceAmount = Number(payload.price_amount ?? 0);

  // Only process finished payments (fully confirmed on-chain).
  if (status !== "finished") return json({ received: true, status });

  const db = serviceClient();

  // Idempotency — skip if we've already processed this payment.
  const { data: existing } = await db
    .from("payment_events").select("id").eq("external_id", paymentId).maybeSingle();
  if (existing) return json({ received: true, duplicate: true });

  try {
    if (orderId.startsWith("deposit_")) {
      // Format: deposit_{userId}_{timestamp}
      const parts = orderId.split("_");
      const userId = parts.slice(1, -1).join("_"); // UUID may contain underscores? No, but safe.
      if (!userId || priceAmount <= 0) return json({ error: "bad order metadata" }, 400);

      await db.from("payment_events").insert({
        external_id: paymentId, user_id: userId, amount: priceAmount, event_type: "deposit",
        provider: "nowpayments",
      });

      const { error } = await db.rpc("deposit_from_webhook", {
        p_user: userId, p_amount: priceAmount, p_ref: paymentId,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ received: true, credited: priceAmount });

    } else if (orderId.startsWith("shop_")) {
      // Format: shop_{userId}_{itemKey}_{timestamp}
      const parts = orderId.split("_");
      const userId = parts[1];
      const itemKey = parts.slice(2, -1).join("_");
      if (!userId || !itemKey) return json({ error: "bad order metadata" }, 400);

      await db.from("payment_events").insert({
        external_id: paymentId, user_id: userId, amount: priceAmount, event_type: "shop",
        provider: "nowpayments",
      });

      await db.rpc("grant_shop_item", {
        p_user: userId, p_item: itemKey, p_stripe_ref: paymentId,
      });
      return json({ received: true, granted: itemKey });

    } else if (orderId.startsWith("payout_")) {
      // Payout status callback — mark withdrawal paid or failed.
      const withdrawalId = orderId.replace("payout_", "");

      await db.from("payout_events").insert({
        external_id: paymentId,
        event_type: status,
        withdrawal_id: withdrawalId,
        provider: "nowpayments",
        payload: payload,
      });

      if (status === "finished") {
        await db.rpc("mark_withdrawal_paid", {
          p_id: withdrawalId,
          p_payout_id: paymentId,
          p_transfer_id: paymentId,
        });
      }
      return json({ received: true });
    }

    return json({ received: true, unhandled: orderId });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
