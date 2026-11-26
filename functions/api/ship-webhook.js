// POST /api/ship-webhook?c=<carrier id>  (carrier -> store status updates). Needs the carrier's webhook token (header "authorization" or "x-webhook-token", or ?k=).
import { json, rpc } from "../../netlify/lib/pay.mjs";
const pick = (o, ks) => { for (const k of ks) { const v = k.split(".").reduce((a, p) => (a == null ? a : a[p]), o); if (v != null && v !== "") return String(v) } return "" };
export const onRequestPost = async ({ request, env }) => {
  try {
    const u = new URL(request.url), c = (u.searchParams.get("c") || "").toLowerCase().replace(/[^a-z0-9_-]/g, ""), sec = env.NOTIFY_SECRET || "";
    const tok = (request.headers.get("x-webhook-token") || request.headers.get("authorization") || u.searchParams.get("k") || "").replace(/^Bearer\s+/i, "").trim();
    const b = await request.json().catch(() => null); if (!b || !c || !sec) return json({ ok: false }, 400);
    const tracking = pick(b, ["trackingNumber", "tracking_number", "TrackingNumber", "barcode", "Barcode", "tracking_no", "data.trackingNumber", "waybill", "AWB"]);
    const status = pick(b, ["state.value", "state", "status", "Status", "delivery_status", "data.status", "event", "StatusCode", "OrderStatus"]);
    if (!tracking || !status) return json({ ok: true, ignored: true });
    return json(await rpc("carrier_webhook_apply", { p_secret: sec, p_carrier: c, p_token: tok, p_tracking: tracking, p_status: status.slice(0, 80), p_raw: {} }));
  } catch (e) { return json({ ok: false }, 403); }
};
