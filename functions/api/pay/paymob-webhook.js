// Paymob transaction processed callback (POST JSON, ?hmac=...). Verified with the HMAC secret before anything is changed.
import { json, rpc, paymobVerify } from "../../../netlify/lib/pay.mjs";
export const onRequestPost = async ({ request, env }) => {
  try {
    const sec = env.NOTIFY_SECRET || "", u = new URL(request.url), body = await request.json().catch(() => null), obj = body && body.obj;
    if (!obj || !sec) return json({ ok: false }, 400);
    const cfg = await rpc("pay_server_config", { p_secret: sec });
    if (!cfg.paymob_hmac || !(await paymobVerify(obj, u.searchParams.get("hmac") || "", cfg.paymob_hmac))) return json({ ok: false, error: "bad signature" }, 403);
    if (obj.is_refunded || obj.is_voided || obj.is_refund || obj.is_void) return json({ ok: true, ignored: true });
    const ref = obj.order && obj.order.merchant_order_id; if (!ref) return json({ ok: true, ignored: true });
    const ok = obj.success === true && obj.pending !== true;
    const raw = { id: obj.id, success: obj.success, pending: obj.pending, amount_cents: obj.amount_cents, currency: obj.currency, source: obj.source_data && { type: obj.source_data.type, sub_type: obj.source_data.sub_type, pan: obj.source_data.pan }, is_live: obj.is_live };
    const r = await rpc("pay_apply", { p_secret: sec, p_ref: String(ref), p_provider: "paymob", p_txn: String(obj.id), p_amount: Number(obj.amount_cents) / 100, p_success: ok, p_raw: raw });
    return json(r);
  } catch (e) { return json({ ok: false }, 500); }
};
