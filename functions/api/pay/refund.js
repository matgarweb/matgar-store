// POST /api/pay/refund {payment_id, amount} with the dashboard user's token. Full or partial refund through the gateway, then recorded on the order.
import { json, rpc, paymobRefund, opayRefund } from "../../../netlify/lib/pay.mjs";
export const onRequestPost = async ({ request, env }) => {
  try {
    const tok = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""), sec = env.NOTIFY_SECRET || "";
    if (!tok || !sec) return json({ error: "غير مصرح" }, 401);
    const b = await request.json().catch(() => ({})), amount = Math.round(Number(b.amount) * 100) / 100;
    const p = await rpc("pay_refund_info", { p_id: String(b.payment_id || "") }, tok).catch(() => null);
    if (!p) return json({ error: "غير مصرح أو العملية مش موجودة" }, 403);
    if (p.status !== "paid") return json({ error: "العملية دي مش مدفوعة" }, 400);
    const left = Math.round((Number(p.amount) - Number(p.refunded || 0)) * 100) / 100;
    if (!(amount > 0) || amount > left) return json({ error: "المبلغ لازم يكون أكبر من صفر وما يزيدش عن المتاح للرد (" + left + ")" }, 400);
    const cfg = await rpc("pay_server_config", { p_secret: sec });
    if (p.provider === "paymob") await paymobRefund(cfg, p.txn, amount);
    else await opayRefund(cfg, { amount, original: p.ref, ref: "R" + Date.now().toString(36) + (p.ref || "").slice(0, 12), callback: new URL(request.url).origin + "/api/pay/opay-callback" });
    await rpc("pay_refund_apply", { p_secret: sec, p_id: p.id, p_amount: amount });
    return json({ ok: true });
  } catch (e) { return json({ error: String(e.message || e).slice(0, 200) }, 502); }
};
