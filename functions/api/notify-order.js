// POST /api/notify-order  (called by the database trigger). Builds the invoice PDF and sends it to the owner's Telegram bot.
const SB = "__SUPABASE_URL__/rest/v1", KEY = "__SUPABASE_KEY__";
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = n => Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
const safeUrl = u => (/^https:\/\//.test(u || "") ? u : "");
function eq(a, b) { if (!a || !b || a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0 }

function invoiceHtml(o, items, st) {
  const sub = items.reduce((a, i) => a + i.qty * i.unit_price, 0), ship = Math.max(0, Number(o.total) - sub);
  const date = new Date(o.created_at).toLocaleDateString("en-GB", { timeZone: "Africa/Cairo", day: "2-digit", month: "2-digit", year: "numeric" });
  const wa = st.whatsapp || "", waShow = wa.startsWith("20") ? "0" + wa.slice(2) : wa;
  const name = st.store_name || "المتجر", brand = /^#[0-9a-fA-F]{6}$/.test(st.primary_color || "") ? st.primary_color : "#7a3e1d";
  const logo = safeUrl(st.logo_url);
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;600;800&display=swap" rel="stylesheet"><style>
@page{size:A4;margin:0}*{box-sizing:border-box}
body{margin:0;font-family:'Noto Kufi Arabic','Segoe UI',Tahoma,sans-serif;color:#2b2118;background:#fff;font-size:12.5px;line-height:1.7}
.pg{width:210mm;min-height:296mm;position:relative;padding-bottom:30mm}
.hd{background:linear-gradient(135deg,${brand} 0%,#4f2410 100%);color:#fff;padding:12mm 14mm 10mm;display:flex;align-items:center;gap:14px}
.hd img{width:72px;height:72px;border-radius:50%;background:#fff;object-fit:cover;border:3px solid #ffffff55}
.hd h1{margin:0;font-size:26px;font-weight:800}.hd p{margin:2px 0 0;font-size:12px;opacity:.9}
.hd .no{margin-right:auto;text-align:left;direction:rtl}.hd .no b{display:block;font-size:20px}.hd .no span{font-size:12px;opacity:.9}
.bar{height:5px;background:repeating-linear-gradient(90deg,#d9a35f 0 18px,#f3d9a8 18px 36px)}
.bd{padding:9mm 14mm 0}
.cust{border:1.5px solid #ead9c6;background:#faf5ee;border-radius:12px;padding:10px 14px;display:grid;grid-template-columns:1fr 1fr;gap:4px 18px}
.cust h3{grid-column:1/3;margin:0 0 2px;color:${brand};font-size:14px}.cust div span{color:#8a7766}.cust .full{grid-column:1/3}
table{width:100%;border-collapse:separate;border-spacing:0;margin-top:9mm;font-size:12px}
th{background:${brand};color:#fff;padding:8px;font-weight:600;text-align:center}
th:first-child{border-radius:0 10px 0 0}th:last-child{border-radius:10px 0 0 0}
td{padding:8px;border-bottom:1px solid #eee3d6;text-align:center;vertical-align:middle}
td.nm{text-align:right;width:44%}td.im{width:64px}
td img{width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid #ead9c6;display:block}
.noimg{width:56px;height:56px;border-radius:8px;background:#f1e8dc}
.tot{margin:8mm 0 0 0;width:64%;margin-right:auto;border:1.5px solid #ead9c6;border-radius:12px;overflow:hidden}
.tot div{display:flex;justify-content:space-between;padding:8px 14px;border-bottom:1px solid #f0e6da}
.tot .g{background:${brand};color:#fff;font-size:16px;font-weight:800;border:0}
.pay{margin-top:7mm;padding:9px 14px;border-radius:10px;background:#f4ebdf;color:#5c3419;font-weight:600}
.ft{position:absolute;bottom:0;left:0;right:0;background:#4f2410;color:#fff;padding:7mm 14mm;display:flex;justify-content:space-between;align-items:center}
.ft b{font-size:14px}.ft small{opacity:.85;display:block}.num{direction:ltr;unicode-bidi:embed;display:inline-block}
</style></head><body><div class="pg">
<div class="hd">${logo ? `<img src="${esc(logo)}">` : ""}<div><h1>${esc(name)}</h1><p>${esc(st.tagline || "")}</p></div>
<div class="no"><b>فاتورة طلب رقم ${esc(o.order_no)}</b><span>${esc(date)}</span></div></div><div class="bar"></div>
<div class="bd">
<div class="cust"><h3>بيانات العميل</h3>
<div><span>الاسم: </span><b>${esc(o.customer_name)}</b></div><div><span>الموبايل: </span><b class="num">${esc(o.phone)}</b></div>
<div class="full"><span>العنوان: </span><b>${esc([o.governorate, o.address].filter(Boolean).join(" - "))}</b></div>
${o.notes ? `<div class="full"><span>ملاحظات: </span>${esc(o.notes)}</div>` : ""}</div>
<table><tr><th>الصورة</th><th>المنتج</th><th>سعر الوحدة</th><th>الكمية</th><th>الإجمالي</th></tr>
${items.map(i => `<tr><td class="im">${safeUrl(i.image_url) ? `<img src="${esc(i.image_url)}">` : '<div class="noimg"></div>'}</td><td class="nm">${esc(i.product_name)}</td><td>${fmt(i.unit_price)} جنيه</td><td>${esc(i.qty)}</td><td><b>${fmt(i.qty * i.unit_price)} جنيه</b></td></tr>`).join("")}</table>
<div class="tot"><div><span>إجمالي المنتجات</span><b>${fmt(sub)} جنيه</b></div><div><span>الشحن</span><b>${ship > 0 ? fmt(ship) + " جنيه" : "مجاني"}</b></div><div class="g"><span>الإجمالي المطلوب</span><span>${fmt(o.total)} جنيه</span></div></div>
<div class="pay">${esc(o.payment_status === "pending" ? `طريقة الدفع: ${o.payment_method || ""} - بانتظار تأكيد الدفع` : o.payment_status === "paid" ? `طريقة الدفع: ${o.payment_method || ""} - تم تأكيد الدفع` : "طريقة الدفع: الدفع عند الاستلام")}${o.payment_ref ? esc(" - رقم العملية: " + o.payment_ref) : ""}</div></div>
<div class="ft"><div><b>شكراً لثقتك في ${esc(name)}</b><small>للطلب بالجملة وأي استفسار تواصل معنا على واتساب</small></div><div><b class="num">${esc(waShow)}</b>${st.site_url ? `<small class="num">${esc(String(st.site_url).replace(/^https?:\/\//, ""))}</small>` : ""}</div></div>
</div></body></html>`;
}

export const onRequestPost = async ({ request, env }) => {
  let d; try { d = await request.json() } catch { return new Response("bad json", { status: 400 }) }
  const auth = request.headers.get("authorization") || "";
  let o, items, download = false;
  if (/^Bearer /i.test(auth)) {
    // Admin download: verify the signed-in admin, read the order under their own permissions.
    const H = { apikey: KEY, Authorization: auth };
    const u = await fetch("__SUPABASE_URL__/auth/v1/user", { headers: H });
    if (!u.ok || !/^[0-9a-f-]{36}$/i.test(String(d.order_id || ""))) return new Response("forbidden", { status: 403 });
    const r = await (await fetch(`${SB}/orders?id=eq.${d.order_id}&select=order_no,customer_name,phone,address,governorate,notes,total,created_at,payment_method,payment_status,payment_ref,order_items(product_id,product_name,qty,unit_price)`, { headers: H })).json().catch(() => []);
    if (!Array.isArray(r) || !r[0]) return new Response("not found", { status: 404 });
    o = r[0]; items = (o.order_items || []).slice(0, 30); download = true;
    const ids = items.map(i => i.product_id).filter(Boolean);
    if (ids.length) {
      const ps = await (await fetch(`${SB}/products?select=id,image_url&id=in.(${ids.join(",")})`, { headers: { apikey: KEY } })).json().catch(() => []);
      const m = Object.fromEntries((ps || []).map(p => [p.id, p.image_url]));
      items = items.map(i => ({ ...i, image_url: m[i.product_id] }));
    }
  } else {
    if (!eq(request.headers.get("x-notify-secret") || "", env.NOTIFY_SECRET || "")) return new Response("forbidden", { status: 403 });
    o = d.order; items = Array.isArray(d.items) ? d.items.slice(0, 30) : [];
  }
  if (!o || !items.length) return new Response("bad data", { status: 400 });
  const rows = await (await fetch(`${SB}/settings?select=key,value`, { headers: { apikey: KEY } })).json().catch(() => []);
  const st = Object.fromEntries((rows || []).map(r => [r.key, r.value]));
  const html = invoiceHtml(o, items, st);
  const pr = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-run/pdf`, {
    method: "POST", headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ html, gotoOptions: { waitUntil: "networkidle0", timeout: 20000 }, pdfOptions: { format: "a4", printBackground: true, preferCSSPageSize: true } })
  });
  if (!pr.ok) return new Response("pdf failed " + pr.status + " " + (await pr.text()).slice(0, 300), { status: 502 });
  const pdf = await pr.arrayBuffer();
  if (download || request.headers.get("x-preview") === "1") return new Response(pdf, { headers: { "content-type": "application/pdf" } });
  const fd = new FormData();
  fd.append("chat_id", env.TG_CHAT_ID);
  fd.append("caption", `🧾 فاتورة الطلب #${o.order_no} جاهزة لإرسالها للعميل`);
  fd.append("document", new Blob([pdf], { type: "application/pdf" }), `invoice-${o.order_no}.pdf`);
  const tr = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendDocument`, { method: "POST", body: fd });
  return new Response(JSON.stringify({ ok: tr.ok, status: tr.status, bytes: pdf.byteLength }), { status: tr.ok ? 200 : 502, headers: { "content-type": "application/json" } });
};

// GET /api/notify-order?k=<order key>: public invoice PDF for the customer's own order (key is the random id made in their browser).
export const onRequestGet = async ({ request, env }) => {
  const k = new URL(request.url).searchParams.get("k") || "";
  if (k.length < 8 || k.length > 80) return new Response("not found", { status: 404, headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" } });
  const H = { apikey: KEY, "Content-Type": "application/json" };
  const r = await (await fetch(`${SB}/rpc/invoice_by_key`, { method: "POST", headers: H, body: JSON.stringify({ p_key: k }) })).json().catch(() => null);
  if (!r || !r.order || !(r.items || []).length) return new Response("not found", { status: 404 });
  const rows = await (await fetch(`${SB}/settings?select=key,value`, { headers: { apikey: KEY } })).json().catch(() => []);
  const st = Object.fromEntries((rows || []).map(x => [x.key, x.value]));
  const pr = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-run/pdf`, {
    method: "POST", headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ html: invoiceHtml(r.order, r.items.slice(0, 30), st), gotoOptions: { waitUntil: "networkidle0", timeout: 20000 }, pdfOptions: { format: "a4", printBackground: true, preferCSSPageSize: true } })
  });
  if (!pr.ok) return new Response("try again", { status: 502 });
  return new Response(await pr.arrayBuffer(), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="invoice-${r.order.order_no}.pdf"`, "cache-control": "no-store, private", "pragma": "no-cache", "referrer-policy": "no-referrer", "x-content-type-options": "nosniff", "x-robots-tag": "noindex, nofollow, noarchive" } });
};
