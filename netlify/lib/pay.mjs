// Payment gateway helpers (Paymob + OPay). Runs in Cloudflare Pages Functions. Secrets come from Supabase Vault through a secret-gated RPC, never from the browser.
const SB = "https://jqnuvrpltyfpusvfrouc.supabase.co/rest/v1", KEY = "sb_publishable_y5gxi2ZIuc8WiDMxKUNCHg_RMolyDh2";
export const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
export async function rpc(name, args, token) {
  const r = await fetch(`${SB}/rpc/${name}`, { method: "POST", headers: { apikey: KEY, Authorization: "Bearer " + (token || KEY), "Content-Type": "application/json" }, body: JSON.stringify(args || {}) });
  const t = await r.text(); let d = null; try { d = JSON.parse(t) } catch (e) { }
  if (!r.ok) throw new Error((d && (d.message || d.hint)) || ("db " + r.status));
  return d;
}
export const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
export async function hmacSha512(key, msg) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg)));
}
export function safeEq(a, b) { a = String(a || "").toLowerCase(); b = String(b || "").toLowerCase(); if (!a || a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0 }
// ---- SHA3-512 + HMAC (OPay callbacks use HMAC-SHA3-512, not available in WebCrypto) ----
const RC = [0x1n, 0x8082n, 0x800000000000808An, 0x8000000080008000n, 0x808bn, 0x80000001n, 0x8000000080008081n, 0x8000000000008009n, 0x8an, 0x88n, 0x80008009n, 0x8000000an, 0x8000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n, 0x8000000000008002n, 0x8000000000000080n, 0x800an, 0x800000008000000an, 0x8000000080008081n, 0x8000000000008080n, 0x80000001n, 0x8000000080008008n];
const ROT = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44], PI = [10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1];
const M64 = (1n << 64n) - 1n, rotl = (x, n) => ((x << BigInt(n)) | (x >> BigInt(64 - n))) & M64;
function keccakF(s) {
  const C = new Array(5);
  for (let r = 0; r < 24; r++) {
    for (let x = 0; x < 5; x++) C[x] = s[x] ^ s[x + 5] ^ s[x + 10] ^ s[x + 15] ^ s[x + 20];
    for (let x = 0; x < 5; x++) { const d = C[(x + 4) % 5] ^ rotl(C[(x + 1) % 5], 1); for (let y = 0; y < 25; y += 5) s[y + x] ^= d }
    let t = s[1]; for (let i = 0; i < 24; i++) { const j = PI[i], b = s[j]; s[j] = rotl(t, ROT[i]); t = b }
    for (let y = 0; y < 25; y += 5) { for (let x = 0; x < 5; x++) C[x] = s[y + x]; for (let x = 0; x < 5; x++) s[y + x] = C[x] ^ ((~C[(x + 1) % 5] & M64) & C[(x + 2) % 5]) }
    s[0] ^= RC[r];
  }
}
export function sha3_512(bytes) {
  const rate = 72, n = (Math.floor(bytes.length / rate) + 1) * rate, buf = new Uint8Array(n); buf.set(bytes); buf[bytes.length] ^= 0x06; buf[n - 1] ^= 0x80;
  const s = new Array(25).fill(0n);
  for (let o = 0; o < n; o += rate) { for (let i = 0; i < rate / 8; i++) { let v = 0n; for (let k = 7; k >= 0; k--) v = (v << 8n) | BigInt(buf[o + i * 8 + k]); s[i] ^= v } keccakF(s) }
  const out = new Uint8Array(64); for (let i = 0; i < 8; i++) { let v = s[i]; for (let k = 0; k < 8; k++) { out[i * 8 + k] = Number(v & 0xffn); v >>= 8n } }
  return out;
}
export function hmacSha3_512(key, msg) {
  const enc = new TextEncoder(), rate = 72; let k = enc.encode(key); if (k.length > rate) k = sha3_512(k);
  const ip = new Uint8Array(rate).fill(0x36), op = new Uint8Array(rate).fill(0x5c); for (let i = 0; i < k.length; i++) { ip[i] ^= k[i]; op[i] ^= k[i] }
  const m = enc.encode(msg), a = new Uint8Array(rate + m.length); a.set(ip); a.set(m, rate);
  const inner = sha3_512(a), b = new Uint8Array(rate + 64); b.set(op); b.set(inner, rate);
  return hex(sha3_512(b));
}
// ---- Paymob ----
const PM = "https://accept.paymob.com";
export const pmMethodId = (cfg, m) => ({ card: cfg.paymob_card_id, wallet: cfg.paymob_wallet_id, valu: cfg.paymob_valu_id, applepay: cfg.paymob_applepay_id })[m] || "";
export async function paymobCreate(cfg, o, origin) {
  const id = pmMethodId(cfg, o.method); if (!id) throw new Error("الطريقة دي مش مفعلة");
  const cents = Math.round(o.amount * 100), nm = String(o.name || "عميل").trim().split(/\s+/), ph = String(o.phone || "").replace(/\D/g, "");
  const body = { amount: cents, currency: "EGP", payment_methods: [/^\d+$/.test(id) ? Number(id) : id], items: [{ name: "طلب رقم " + o.order_no, amount: cents, description: "طلب من المتجر", quantity: 1 }],
    billing_data: { first_name: nm[0] || "عميل", last_name: nm.slice(1).join(" ") || "-", phone_number: ph.startsWith("0") ? "+2" + ph : "+" + ph, email: o.email || "customer@example.com", country: "EG", city: "NA", street: "NA", building: "NA", floor: "NA", apartment: "NA", state: "NA" },
    special_reference: o.ref, notification_url: origin + "/api/pay/paymob-webhook", redirection_url: origin + "/api/pay/return?o=" + o.order_no, extras: { order_no: String(o.order_no) } };
  const r = await fetch(PM + "/v1/intention/", { method: "POST", headers: { Authorization: "Token " + cfg.paymob_secret_key, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.client_secret) throw new Error("Paymob: " + (d.detail || JSON.stringify(d).slice(0, 160) || r.status));
  return { url: PM + "/unifiedcheckout/?publicKey=" + encodeURIComponent(cfg.paymob_public_key) + "&clientSecret=" + encodeURIComponent(d.client_secret) };
}
export async function paymobRefund(cfg, txn, amount) {
  const r = await fetch(PM + "/api/acceptance/void_refund/refund", { method: "POST", headers: { Authorization: "Token " + cfg.paymob_secret_key, "Content-Type": "application/json" }, body: JSON.stringify({ transaction_id: Number(txn), amount_cents: Math.round(amount * 100) }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.success === "false" || d.success === false) throw new Error("Paymob refund: " + (d.detail || d.message || d.data?.message || r.status));
  return d;
}
const g = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
const PMK = ["amount_cents", "created_at", "currency", "error_occured", "has_parent_transaction", "obj.id", "integration_id", "is_3d_secure", "is_auth", "is_capture", "is_refunded", "is_standalone_payment", "is_voided", "order.id", "owner", "pending", "source_data.pan", "source_data.sub_type", "source_data.type", "success"];
export async function paymobVerify(obj, hmac, secret) {
  const s = PMK.map(k => { const v = k === "obj.id" ? obj.id : g(obj, k); return v == null ? "" : String(v) }).join("");
  return safeEq(await hmacSha512(secret, s), hmac);
}
// ---- OPay ----
export const opHost = sandbox => sandbox ? "https://testapi.opaycheckout.com" : "https://liveapi.opaycheckout.com";
export async function opayCreate(cfg, o, origin) {
  const body = { country: "EG", reference: o.ref, amount: { total: Math.round(o.amount * 100), currency: "EGP" }, returnUrl: origin + "/api/pay/return?o=" + o.order_no, cancelUrl: origin + "/api/pay/return?o=" + o.order_no + "&c=1", callbackUrl: origin + "/api/pay/opay-callback", expireAt: 30, customerVisitSource: "BROWSER",
    userInfo: { userId: "o" + o.order_no, userName: String(o.name || "").slice(0, 60) || "customer", userMobile: String(o.phone || ""), userEmail: o.email || "" }, product: { name: "طلب رقم " + o.order_no, description: "طلب من المتجر" } };
  const r = await fetch(opHost(cfg.opay_sandbox) + "/api/v1/international/cashier/create", { method: "POST", headers: { Authorization: "Bearer " + cfg.opay_public_key, MerchantId: cfg.opay_merchant_id, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.code !== "00000" || !d.data?.cashierUrl) throw new Error("OPay: " + (d.message || r.status));
  return { url: d.data.cashierUrl };
}
const sortObj = v => Array.isArray(v) ? v.map(sortObj) : v && typeof v === "object" ? Object.keys(v).sort().reduce((a, k) => (a[k] = sortObj(v[k]), a), {}) : v;
export async function opayRefund(cfg, o) {
  const body = { country: "EG", amount: { currency: "EGP", total: Math.round(o.amount * 100) }, originalReference: o.original, reference: o.ref, refundWay: "Original", callbackUrl: o.callback };
  const text = JSON.stringify(sortObj(body)), sig = await hmacSha512(cfg.opay_secret_key, text);
  const r = await fetch(opHost(cfg.opay_sandbox) + "/api/v1/international/payment/refund/create", { method: "POST", headers: { Authorization: "Bearer " + sig, MerchantId: cfg.opay_merchant_id, "Content-Type": "application/json" }, body: text });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.code !== "00000") throw new Error("OPay refund: " + (d.message || r.status));
  return d;
}
export function opayVerify(cb, secret) {
  const p = cb && cb.payload; if (!p || !cb.sha512) return false;
  const s = `{Amount:"${p.amount}",Currency:"${p.currency}",Reference:"${p.reference}",Refunded:${p.refunded ? "t" : "f"},Status:"${p.status}",Timestamp:"${p.timestamp}",Token:"${p.token == null ? "" : p.token}",TransactionID:"${p.transactionId}"}`;
  return safeEq(hmacSha3_512(secret, s), cb.sha512);
}
