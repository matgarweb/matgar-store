// OPay callback (POST JSON {payload, sha512, type}). Verified with HMAC-SHA3-512 using the secret key.
import { json, rpc, opayVerify } from "../../../netlify/lib/pay.mjs";
export const onRequestPost = async ({ request, env }) => {
  try {
    const sec = env.NOTIFY_SECRET || "", cb = await request.json().catch(() => null);
    if (!cb || !cb.payload || !sec) return json({ ok: false }, 400);
    const cfg = await rpc("pay_server_config", { p_secret: sec });
    if (!cfg.opay_secret_key || !opayVerify(cb, cfg.opay_secret_key)) return json({ ok: false, error: "bad signature" }, 403);
    const p = cb.payload; if (p.refunded) return json({ ok: true, ignored: true });
    if (p.status !== "SUCCESS" && p.status !== "FAIL" && p.status !== "CLOSE") return json({ ok: true, pending: true });
    const r = await rpc("pay_apply", { p_secret: sec, p_ref: String(p.reference), p_provider: "opay", p_txn: String(p.transactionId || ""), p_amount: Number(p.amount) / 100, p_success: p.status === "SUCCESS", p_raw: { status: p.status, amount: p.amount, currency: p.currency, instrumentType: p.instrumentType, channel: p.channel } });
    return json(r);
  } catch (e) { return json({ ok: false }, 500); }
};
