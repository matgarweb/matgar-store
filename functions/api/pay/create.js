// POST /api/pay/create {order_no, phone, method: card|wallet|valu|applepay|opay} -> {url} to redirect the customer to the gateway.
import { json, rpc, paymobCreate, opayCreate } from "../../../netlify/lib/pay.mjs";
export const onRequestPost = async ({ request, env }) => {
  try {
    const b = await request.json().catch(() => ({})), method = String(b.method || ""), origin = new URL(request.url).origin, sec = env.NOTIFY_SECRET || "";
    if (!sec) return json({ error: "الدفع الأونلاين مش جاهز" }, 503);
    if (!["card", "wallet", "valu", "applepay", "opay"].includes(method)) return json({ error: "طريقة دفع غير صالحة" }, 400);
    const pub = await rpc("pay_public_methods", {});
    if (!pub[method]) return json({ error: "طريقة الدفع دي مش متاحة حالياً" }, 400);
    const info = await rpc("pay_order_info", { p_secret: sec, p_order_no: parseInt(b.order_no, 10) || 0, p_phone: String(b.phone || "") }).catch(() => null);
    if (!info) return json({ error: "الطلب مش موجود أو رقم الموبايل غلط" }, 404);
    if (!(info.due > 0)) return json({ error: "الطلب ده مدفوع بالكامل" }, 400);
    const cfg = await rpc("pay_server_config", { p_secret: sec });
    const provider = method === "opay" ? "opay" : "paymob", ref = "M" + info.order_no + "-" + Date.now().toString(36);
    const o = { order_no: info.order_no, name: info.name, phone: info.phone, email: info.email, amount: Number(info.due), method, ref };
    const sandbox = provider === "opay" ? !!cfg.opay_sandbox : !!cfg.paymob_sandbox;
    const out = provider === "opay" ? await opayCreate(cfg, o, origin) : await paymobCreate(cfg, o, origin);
    await rpc("pay_create_row", { p_secret: sec, p_order: info.id, p_provider: provider, p_method: method, p_amount: o.amount, p_ref: ref, p_sandbox: sandbox });
    return json({ url: out.url });
  } catch (e) { return json({ error: String(e.message || e).slice(0, 200) }, 502); }
};
