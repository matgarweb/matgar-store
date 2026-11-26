import { sanitizeHtml, toText } from "./sanitize.mjs";
// Shared helpers for the server-rendered pages (Netlify Functions).
// Only PUBLIC data is read, with the public (publishable) key. No private table is touched.
const SUPABASE_URL = (globalThis.process && process.env.SUPABASE_URL) || "__SUPABASE_URL__";
const SUPABASE_KEY = (globalThis.process && process.env.SUPABASE_KEY) || "__SUPABASE_KEY__";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = n => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
const safeUrl = u => (/^https?:\/\//i.test(u || "") ? u : "");
const jsonLd = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;
const inlineJson = o => JSON.stringify(o).replace(/</g, "\\u003c").replace(/\u2028|\u2029/g, "");
const dec = s => { try { return /%/.test(s) ? decodeURIComponent(s) : s } catch (e) { return s } };

// Reads query params + path params from a standard Request (Netlify Functions v2).
function params(req, ctx) {
  const u = new URL(req.url), p = {};
  u.searchParams.forEach((v, k) => (p[k] = v));
  if (ctx && ctx.params) for (const k of Object.keys(ctx.params)) if (p[k] == null) p[k] = ctx.params[k];
  if (!p.slug) { const m = /^\/[pc]\/([^/?]+)/.exec(u.pathname); if (m) p.slug = m[1] }
  return p;
}
async function rest(path, { count } = {}) {
  const r = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    headers: { apikey: SUPABASE_KEY, ...(count ? { Prefer: "count=exact" } : {}) }
  });
  if (!r.ok) throw new Error("db " + r.status + " " + (await r.text()).slice(0, 200));
  const data = await r.json();
  const m = /\/(\d+)$/.exec(r.headers.get("content-range") || "");
  return count ? { data, total: m ? +m[1] : data.length } : data;
}
async function settings() {
  const rows = await rest("settings?select=key,value");
  const s = {}; rows.forEach(r => (s[r.key] = r.value)); return s;
}
const zones = () => rest("shipping_zones?select=governorate,fee&active=eq.true&order=sort_order.asc");
async function tiersFor(prods) {
  const ids = prods.map(p => String(p.id)); if (!ids.length) return {};
  const rows = await rest("product_price_tiers?select=product_id,min_qty,unit_price,label&order=min_qty.asc&product_id=in.(" + ids.map(i => encodeURIComponent('"' + i + '"')).join(",") + ")");
  const m = {}; rows.forEach(r => (m[r.product_id] = m[r.product_id] || []).push(r)); return m;
}
const categories = () => rest("categories?select=id,name,slug,image_url,description,sort_order,show_home,show_menu,show_footer&active=eq.true&order=sort_order.asc,name.asc");
const PCOLS = "id,name,slug,description,price,sale_price,image_url,category_id,updated_at,created_at,in_stock,featured,min_order_qty,images,attributes,listed";

function baseUrl(req, S) {
  const u = (S.site_url || "").trim().replace(/\/+$/, "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || new URL(req.url).host;
  let uh = ""; try { uh = new URL(u).host } catch (e) {}
  if (/^https?:\/\//i.test(u) && (uh === host || !/\.pages\.dev$/.test(host))) return u;
  const proto = req.headers.get("x-forwarded-proto") || (/^localhost|127\./.test(host) ? "http" : "https");
  return proto + "://" + host;
}
const pUrl = (b, p) => b + "/p/" + encodeURIComponent(p.slug);
const cUrl = (b, c) => b + "/c/" + encodeURIComponent(c.slug);
const price = p => (p.sale_price != null && +p.sale_price > 0 && +p.sale_price < +p.price ? +p.sale_price : +p.price);
const isSale = p => price(p) < +p.price;

function card(p, first, tiers) {
  const pr = price(p), sale = isSale(p), href = "/p/" + encodeURIComponent(p.slug);
  const img = safeUrl(p.image_url), t = tiers || [], min = p.min_order_qty || 1, out = p.in_stock === false;
  const off = sale ? Math.round((1 - pr / p.price) * 100) : 0;
  const best = t.length ? t[t.length - 1] : null;
  return `<article class="card">${out ? `<span class="badge gr">نفذت الكمية</span>` : sale ? `<span class="badge">-${off}%</span>` : ""}<a href="${esc(href)}" class="imgl">${img ? `<img src="${esc(img)}" alt="${esc(p.name)}" width="400" height="400" ${first ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"'}>` : `<div class="ph"></div>`}</a>
<div class="in"><h3><a href="${esc(href)}">${esc(p.name)}</a></h3><div class="pr"><span class="price${sale ? " sale" : ""}">${fmt(pr)} جنيه</span>${sale ? `<span class="old">${fmt(p.price)}</span>` : ""}</div>${sale ? `<div class="save">وفّر ${fmt(p.price - pr)} جنيه</div>` : ""}
${best ? `<div class="tierhint">جملة ${fmt(best.unit_price)} ج عند ${best.min_qty}+</div>` : min > 1 ? `<div class="tierhint">أقل كمية ${min}</div>` : ""}
${out ? `<button class="btn add" disabled>نفذت الكمية</button>` : `<button class="btn add" data-add data-id="${esc(p.id)}" data-name="${esc(p.name)}" data-price="${esc(pr)}" data-image="${esc(img)}" data-slug="${esc(p.slug)}" data-min="${min}" data-tiers="${esc(JSON.stringify(t.map(x => [x.min_qty, +x.unit_price])))}">أضف للسلة</button>`}</div></article>`;
}
const cardsHtml = (list, tm, firstN = 2) => list.map((p, i) => card(p, i < firstN, tm[String(p.id)])).join("");
const trustHtml = S => {
  const items = [["🚚", 2], ["💵", 1], ["🏷️", 3], ["💬", 4]].map(([ic, n]) => [ic, S["trust" + n + "_t"], S["trust" + n + "_d"]]).filter(x => x[1]);
  if (S.return_policy) items.push(["↩️", "سياسة الاسترجاع", L_cut(S.return_policy, 60)]);
  return items.length ? `<section class="trust" aria-label="مميزات المتجر">${items.map(x => `<div><span class="ic">${x[0]}</span><b>${esc(x[1])}</b><small>${esc(x[2] || "")}</small></div>`).join("")}</section>` : "";
};
const L_cut = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s };


// Social links shown as brand-coloured icons (no text). Only valid https links are shown.
const SOCIAL = [
  ["facebook_url", "فيسبوك", "#1877f2", '<path d="M14 8h2V5h-2.5C11 5 10 6.5 10 8.5V11H8v3h2v6h3v-6h2.5l.5-3h-3V8.8c0-.5.2-.8 1-.8z" fill="#fff"/>'],
  ["instagram_url", "إنستجرام", "#d6249f", '<g fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"><rect x="5" y="5" width="14" height="14" rx="4"/><circle cx="12" cy="12" r="3.2"/><path d="M16.6 7.4h.01"/></g>'],
  ["tiktok_url", "تيك توك", "#111", '<path d="M13 5h2.2c.2 1.6 1.2 2.7 2.8 3v2.3c-1 0-2-.3-2.8-.8V15a4 4 0 1 1-4-4c.2 0 .5 0 .8.1v2.4a1.7 1.7 0 1 0 1 1.5V5z" fill="#fff"/>'],
  ["youtube_url", "يوتيوب", "#ff0000", '<path d="M18.6 8.2a1.8 1.8 0 0 0-1.3-1.3C16.2 6.6 12 6.6 12 6.6s-4.2 0-5.3.3A1.8 1.8 0 0 0 5.4 8.2 19 19 0 0 0 5.2 12c0 1.3.1 2.6.2 3.8.2.6.7 1.1 1.3 1.3 1.1.3 5.3.3 5.3.3s4.2 0 5.3-.3a1.8 1.8 0 0 0 1.3-1.3c.1-1.2.2-2.5.2-3.8s-.1-2.6-.2-3.8z" fill="#fff"/><path d="M10.5 14.6V9.4l4.2 2.6z" fill="#ff0000"/>'],
  ["x_url", "إكس", "#000", '<path d="M7 7l10 10M17 7L7 17" stroke="#fff" stroke-width="2" stroke-linecap="round"/>'],
  ["telegram_url", "تيليجرام", "#229ed9", '<path d="M17.5 7L6.5 11.3l3 1.1 1.1 3.6 1.7-2.2 3 2.2L17.5 7z" fill="#fff"/>'],
  ["whatsapp_url", "واتساب", "#25d366", '<path d="M12 6a6 6 0 0 0-5.1 9.1L6 18l3-.8A6 6 0 1 0 12 6zm3.1 8.2c-.1.3-.7.7-1 .7-.3 0-.6.1-2-.4-1.7-.7-2.7-2.4-2.8-2.5-.1-.1-.7-.9-.7-1.7s.4-1.2.6-1.4c.1-.2.3-.2.4-.2h.3c.1 0 .2 0 .4.3l.5 1.3c0 .1 0 .2 0 .3l-.2.4-.3.3c-.1.1-.2.2-.1.4.1.2.5.8 1 1.3.7.6 1.3.8 1.5.9.2.1.3.1.4-.1l.5-.7c.1-.2.3-.1.4-.1l1.2.6c.2.1.3.1.3.2.1.1.1.5-.1.8z" fill="#fff"/>']
];
const socialHtml = S => {
  const l = SOCIAL.filter(x => /^https:\/\//.test(S[x[0]] || "")).map(x => `<a class="soc" href="${esc(S[x[0]])}" target="_blank" rel="noopener nofollow" aria-label="${x[1]}" title="${x[1]}"><svg width="36" height="36" viewBox="0 0 24 24" role="img" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="${x[2]}"/>${x[3]}</svg></a>`);
  return l.length ? `<p class="socs">${l.join("")}</p>` : "";
};
const sameAs = S => SOCIAL.map(x => S[x[0]]).filter(u => /^https:\/\//.test(u || ""));
const imagesOf = p => { let a = Array.isArray(p.images) ? p.images : []; a = a.filter(u => /^https?:\/\//i.test(u || "")); if (!a.length && /^https?:\/\//i.test(p.image_url || "")) a = [p.image_url]; return a.slice(0, 12) };
// Hero slider (setting hero_slides = JSON list, hero_interval = seconds each slide stays). Returns "" when there are no valid slides.
const heroSlides = S => {
  let a = []; try { a = JSON.parse(S.hero_slides || "[]") } catch (e) {}
  if (!Array.isArray(a)) return [];
  const okLink = u => /^(\/(?!\/)|https:\/\/)/.test(String(u || "")) && String(u).length < 300;
  return a.map(x => ({ img: safeUrl(x && x.img) && /^https:/i.test(x.img) ? x.img : "", img2: safeUrl(x && x.img2) && /^https:/i.test(x.img2) ? x.img2 : "", alt: String((x && x.alt) || "").slice(0, 120),
    btns: (Array.isArray(x && x.btns) ? x.btns : []).filter(b => b && String(b.text || "").trim() && okLink(b.link)).slice(0, 2).map(b => ({ text: String(b.text).trim().slice(0, 40), link: String(b.link) })) }))
    .filter(x => x.img).slice(0, 8);
};
const heroSliderHtml = (S, name) => {
  const sl = heroSlides(S); if (!sl.length) return "";
  const ms = Math.min(10, Math.max(1, Number(S.hero_interval) || 2)) * 1000;
  return `<section class="hs" data-hs data-ms="${ms}" aria-roledescription="carousel" aria-label="العروض"><h1 class="sr-only">${esc(S.hero_title || name)}</h1><div class="hs-track">${sl.map((x, i) => `<div class="hs-slide${i ? "" : " on"}" role="group" aria-label="${i + 1} / ${sl.length}">${x.img2 ? `<picture><source media="(min-width:760px)" srcset="${esc(x.img2)}">` : ""}<img src="${esc(x.img)}" alt="${esc(x.alt || name)}" width="1080" height="1080" ${i ? 'loading="lazy" decoding="async"' : 'fetchpriority="high"'}>${x.img2 ? "</picture>" : ""}${x.btns.length ? `<div class="hs-btns">${x.btns.map((b, j) => `<a class="hs-btn${j ? " b2" : ""}" href="${esc(b.link)}"${/^https:/.test(b.link) ? ' rel="noopener" target="_blank"' : ""}>${esc(b.text)}</a>`).join("")}</div>` : ""}</div>`).join("")}</div>${sl.length > 1 ? `<div class="hs-dots">${sl.map((x, i) => `<button type="button" aria-label="الشريحة ${i + 1}" class="${i ? "" : "on"}"></button>`).join("")}</div>` : ""}</section>`;
};
const tickerHtml = S => {
  if (S.ticker_on !== "1") return "";
  let a = []; try { a = JSON.parse(S.ticker_items || "[]") } catch (e) {}
  a = (Array.isArray(a) ? a : []).map(x => String(x || "").trim().slice(0, 140)).filter(Boolean).slice(0, 12);
  if (!a.length) return "";
  const col = v => (/^#[0-9a-fA-F]{6}$/.test(v || "") ? v : "");
  const pps = { 1: 30, 2: 55, 3: 90 }[String(S.ticker_speed)] || 55;
  const one = a.map(t => `<span class="tk-i">${esc(t)}</span>`).join("");
  const secs = Math.max(8, Math.round(a.join("").length * 9 / pps * 3) / 3 + a.length * 60 / pps);
  const st = [col(S.ticker_bg) && `--tkbg:${col(S.ticker_bg)}`, col(S.ticker_fg) && `--tkfg:${col(S.ticker_fg)}`, `--tks:${secs.toFixed(1)}s`].filter(Boolean).join(";");
  return `<div class="tk" style="${st}" role="region" aria-label="إعلانات"><div class="tk-t"><div class="tk-g">${one}</div><div class="tk-g" aria-hidden="true">${one}</div></div></div>`;
};
const INTRO_DEFAULT = "متخصصون في توفير جميع أدوات ورفايع المطبخ العصرية بأسعار الجملة الحقيقية من أول قطعة، نجمع لك بين الجودة والخامات والتوفير العالي بدون حد أدنى للشراء.";
const introHtml = S => {
  if (S.intro_on === "0") return "";
  const t = String(S.intro_text === undefined ? INTRO_DEFAULT : S.intro_text).trim().slice(0, 400);
  return t ? `<section class="intro" aria-label="نبذة"><span class="ib b1"></span><span class="ib b2"></span><span class="ib b3"></span><p>${esc(t)}</p></section>` : "";
};
const chatsHtml = S => {
  if (S.chats_on === "0") return "";
  let a = []; try { a = JSON.parse(S.chats || "[]") } catch (e) {}
  a = (Array.isArray(a) ? a : []).map(c => (Array.isArray(c && c.msgs) ? c.msgs : []).map(m => ({ d: m && m.d === "out" ? "out" : "in", t: String((m && m.t) || "").trim().slice(0, 600), tm: String((m && m.tm) || "").trim().slice(0, 12) })).filter(m => m.t)).filter(c => c.length).slice(0, 30);
  if (!a.length) return "";
  const title = String(S.chats_title === undefined ? "من محادثات عملاء المتجر" : S.chats_title).trim().slice(0, 100), sub = String(S.chats_sub === undefined ? "آراء وانطباعات حقيقية لعملاء بعد استلام أوردراتهم (اسحب لرؤية المزيد)" : S.chats_sub).trim().slice(0, 160);
  const brand = "المتجر", th = esc(title).replace(brand, `<span>${brand}</span>`);
  return `<section class="wch" aria-label="${esc(title)}">${title ? `<h2 class="sec">&#128172; ${th}</h2>` : ""}${sub ? `<p class="lead">${esc(sub)}</p>` : ""}<div class="wch-w"><button class="wch-b" data-d="r" type="button" aria-label="السابق">&#10094;</button><div class="wch-c" tabindex="0">${a.map(c => `<div class="wch-box"><span class="wch-ok">عميل موثّق &#10003;</span>${c.map(m => `<div class="wch-m ${m.d}"><div class="wch-t">${esc(m.t).replace(/\n/g, "<br>")}</div>${m.tm ? `<span class="wch-tm">${esc(m.tm)}</span>` : ""}</div>`).join("")}</div>`).join("")}</div><button class="wch-b" data-d="l" type="button" aria-label="التالي">&#10095;</button></div></section>`;
};
const reviewsHtml = S => {
  let a = []; try { a = JSON.parse(S.reviews || "[]") } catch (e) {}
  a = (Array.isArray(a) ? a : []).map(x => ({ img: safeUrl(x && x.img) && /^https:/i.test(x.img) ? x.img : "", name: String((x && x.name) || "").trim().slice(0, 60), text: String((x && x.text) || "").trim().slice(0, 500) })).filter(x => x.img || x.text).slice(0, 20);
  if (!a.length) return "";
  const title = String(S.reviews_title === undefined ? "آراء عملائنا" : S.reviews_title).trim().slice(0, 80);
  return `<section class="rv">${title ? `<h2 class="sec">${esc(title)}</h2>` : ""}<div class="rv-row" tabindex="0">${a.map((x, i) => `<figure class="rv-c${x.img ? " withimg" : ""}">${x.img ? `<a href="${esc(x.img)}" target="_blank" rel="noopener"><img src="${esc(x.img)}" alt="${esc(x.name ? "رأي " + x.name : "رأي عميل")}" loading="lazy" decoding="async" width="300" height="400"></a>` : ""}${x.text ? `<blockquote>${esc(x.text)}</blockquote>` : ""}${x.name ? `<figcaption>${esc(x.name)}</figcaption>` : ""}</figure>`).join("")}</div></section>`;
};
const descHtml = d => sanitizeHtml(d);
function layout({ req, S, cats, zonesList, title, desc, path, og = {}, ld = [], body, robots, prev, next, currentCat }) {
  const b = baseUrl(req, S), name = S.store_name || "المتجر";
  const canonical = b + path;
  const color = /^#[0-9a-fA-F]{6}$/.test(S.primary_color || "") ? S.primary_color : "#7a3e1d";
  const accent = /^#[0-9a-fA-F]{6}$/.test(S.accent_color || "") ? S.accent_color : "#25a244";
  const FONTS = { "Cairo": "Cairo:wght@400;600;700", "Tajawal": "Tajawal:wght@400;500;700", "Almarai": "Almarai:wght@400;700;800", "IBM Plex Sans Arabic": "IBM+Plex+Sans+Arabic:wght@400;500;700", "Noto Kufi Arabic": "Noto+Kufi+Arabic:wght@400;600;700", "Changa": "Changa:wght@400;600;700" };
  const font = FONTS[S.font_family] ? S.font_family : "Cairo";
  const bgc = /^#[0-9a-fA-F]{6}$/.test(S.bg_color || "") ? S.bg_color : "";
  const logoPx = { s: 32, m: 40, l: 56 }[S.logo_size] || 40;
  const bodyCls = [S.product_cols_mobile === "1" ? "pc1" : "", S.card_img === "tall" ? "cimg-tall" : "", S.card_badge === "0" ? "nobadge" : "", S.card_tier === "0" ? "notier" : "", S.card_radius === "l" ? "cr-l" : S.card_radius === "s" ? "cr-s" : ""].filter(Boolean).join(" ");
  const logo = safeUrl(S.logo_url), favicon = safeUrl(S.favicon_url) || logo, ogImg = safeUrl(og.image) || safeUrl(S.hero_image_url) || logo;
  const publicS = {}; const zs = zonesList || []; ["store_name", "contact_widget", "cw_phone", "cw_ms", "cw_fb", "cw_ig", "cw_tt", "whatsapp", "meta_pixel_id", "tiktok_pixel_id", "ga_id", "shipping_fee", "free_shipping_min", "payment_methods", "order_done_msg", "ost_on", "ost_banner", "ost_s1", "ost_s2", "ost_s3", "ost_s3d", "ost_foot", "gtm_id", "app_meta_on", "app_tiktok_on", "app_ga_on", "app_gtm_on", "primary_color", "accent_color"].forEach(k => (publicS[k] = S[k] || ""));
  const menuCats = (cats || []).filter(c => c.show_menu !== false), footCats = (cats || []).filter(c => c.show_footer === true);
  let navx = []; try { navx = JSON.parse(S.nav_extra || "[]") } catch (e) {}
  navx = (Array.isArray(navx) ? navx : []).filter(x => x && String(x.text || "").trim() && /^(\/(?!\/)|https:\/\/)/.test(String(x.link || ""))).slice(0, 8);
  const extraChips = navx.map(x => `<a class="chip" href="${esc(x.link)}">${esc(String(x.text).trim().slice(0, 30))}</a>`).join("");
  const chips = S.nav_chips === "0" ? "" : (cats || []).length || extraChips ? `<nav class="cats" aria-label="الأقسام"><a class="chip ${currentCat === "" ? "on" : ""}" href="/products">كل المنتجات</a>${menuCats.map(c => `<a class="chip ${currentCat === c.slug ? "on" : ""}" href="/c/${esc(encodeURIComponent(c.slug))}">${safeUrl(c.image_url) ? `<img src="${esc(c.image_url)}" alt="" width="22" height="22" loading="lazy">` : ""}${esc(c.name)}</a>`).join("")}${extraChips}</nav>` : "";
  return `<!DOCTYPE html><html lang="ar-EG" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<link rel="alternate" hreflang="ar-EG" href="${esc(canonical)}"><link rel="alternate" hreflang="x-default" href="${esc(canonical)}">
${prev ? `<link rel="prev" href="${esc(b + prev)}">` : ""}${next ? `<link rel="next" href="${esc(b + next)}">` : ""}
<meta name="robots" content="${robots || "index,follow,max-image-preview:large"}">
<meta name="geo.region" content="EG"><meta name="geo.placename" content="مصر"><meta name="theme-color" content="${esc(color)}">
<meta property="og:type" content="${esc(og.type || "website")}"><meta property="og:locale" content="ar_EG"><meta property="og:site_name" content="${esc(name)}">
<meta property="og:title" content="${esc(og.title || title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(canonical)}">
${ogImg ? `<meta property="og:image" content="${esc(ogImg)}">` : ""}
<meta name="twitter:card" content="${ogImg ? "summary_large_image" : "summary"}"><meta name="twitter:title" content="${esc(og.title || title)}"><meta name="twitter:description" content="${esc(desc)}">
${favicon ? `<link rel="icon" href="${esc(favicon)}">` : ""}
<link rel="preconnect" href="__SUPABASE_URL__" crossorigin><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${FONTS[font]}&display=swap">
<link rel="stylesheet" href="/style.css">
<style>:root{--primary:${color};--accent:${accent};--font:'${font}';--logo:${logoPx}px${bgc ? `;--bg:${bgc}` : ""}}</style>
${ld.map(jsonLd).join("\n")}
</head><body${bodyCls ? ` class="${bodyCls}"` : ""}>
${tickerHtml(S)}<header class="top"><a class="brand" href="/">${logo ? `<img src="${esc(logo)}" alt="${esc(name)}" width="40" height="40">` : ""}<span class="name">${esc(name)}</span></a>${S.nav_wholesale === "0" ? "" : `<a class="hl" href="/wholesale">طلب جملة</a>`}<button class="cartbtn" id="cartBtn" aria-label="السلة"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 7H6"/></svg><span id="cartCount" class="cnt">0</span></button></header>
${body.afterHeader || ""}
${body.hero || ""}
<main class="wrap"><form class="search" id="sf" action="/" role="search" autocomplete="off"><input id="q" name="q" type="search" placeholder="ابحث عن منتج..." aria-label="بحث" enterkeyhint="search"><div id="sug" class="sug" hidden></div></form>${chips}${body.main}</main>
<footer>${S.footer_text ? `<p>${esc(S.footer_text)}</p>` : `<p>${esc(S.tagline || "")}</p>`}
<p class="fl"><a href="/products">كل المنتجات</a> · <a href="/wholesale">طلب جملة</a> · <a href="/track">تتبع طلبك</a>${(() => { let a = []; try { a = JSON.parse(S.footer_links || "[]") } catch (e) {} return (Array.isArray(a) ? a : []).filter(x => x && String(x.text || "").trim() && /^(\/(?!\/)|https:\/\/)/.test(String(x.link || ""))).slice(0, 8).map(x => ` · <a href="${esc(x.link)}">${esc(String(x.text).trim().slice(0, 40))}</a>`).join("") })()}${[["privacy","سياسة الخصوصية"],["terms","الشروط والأحكام"],["refund","الاسترجاع والاستبدال"],["shipping","الشحن والتوصيل"]].filter(([k]) => S["legal_" + k + "_on"] === "1" && S["legal_" + k + "_text"] && !/\[\[/.test(S["legal_" + k + "_text"])).map(([k, t]) => ` · <a href="/legal/${k}">${t}</a>`).join("")}${S.contact_phone ? ` · <a href="tel:${esc(S.contact_phone)}">${esc(S.contact_phone)}</a>` : ""}${S.contact_email ? ` · <a href="mailto:${esc(S.contact_email)}">${esc(S.contact_email)}</a>` : ""}</p>
${footCats.length ? `<nav class="fcats" aria-label="الأقسام">${footCats.map(c => `<a href="/c/${esc(encodeURIComponent(c.slug))}">${esc(c.name)}</a>`).join(" · ")}</nav>` : ""}${socialHtml(S)}${S.contact_address ? `<p>${esc(S.contact_address)}</p>` : ""}${S.return_policy ? `<details class="rp"><summary>سياسة الاسترجاع</summary><p>${esc(S.return_policy)}</p></details>` : ""}
<p>© ${new Date().getFullYear()} ${esc(name)} - مصر</p></footer>
<nav class="bnav" aria-label="التنقل"><a href="/" class="${path === "/" ? "on" : ""}"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg><span>الرئيسية</span></a><a href="/products" class="${path === "/products" || path.startsWith("/products?") || path.startsWith("/c/") ? "on" : ""}"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/></svg><span>متجر</span></a><button type="button" id="bnAcc" class="bnacc"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg><span>حسابي</span></button></nav>
<button class="trkfab" id="trkfab" type="button" aria-label="تتبع طلبك">&#128666; تتبع طلبك</button>

<script>window.__S=${inlineJson(publicS)};window.SUPABASE_URL=${inlineJson(SUPABASE_URL)};window.SUPABASE_KEY=${inlineJson(SUPABASE_KEY)};window.__Z=${inlineJson(zs)};</script>
<script src="/store.js" defer></script><script src="/account.js" defer></script>
</body></html>`;
}

function send(html, cache, type, status) {
  const c = cache || "public, s-maxage=300, stale-while-revalidate=86400";
  // Browser always revalidates; Netlify's CDN keeps the page (so repeat visits do not run the function = save credits).
  return new Response(html, { status: status || 200, headers: { "Content-Type": type || "text/html; charset=utf-8", "Cache-Control": "public, max-age=0, must-revalidate", "Netlify-CDN-Cache-Control": c === "no-store" ? "no-store" : c + ", durable" } });
}
const orgLd = (b, S) => ({
  "@context": "https://schema.org", "@type": "Organization", name: S.store_name || "المتجر", url: b,
  ...(safeUrl(S.logo_url) ? { logo: S.logo_url } : {}),
  areaServed: { "@type": "Country", name: "Egypt" },
  ...(sameAs(S).length ? { sameAs: sameAs(S) } : {}),
  ...(S.whatsapp ? { contactPoint: { "@type": "ContactPoint", telephone: "+" + String(S.whatsapp).replace(/\D/g, ""), contactType: "customer service", areaServed: "EG", availableLanguage: "ar" } } : {})
});
const crumbLd = (b, items) => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it[0], item: b + it[1] })) });
const crumbHtml = items => `<nav class="crumbs" aria-label="مسار التصفح">${items.map((it, i) => i === items.length - 1 ? `<span>${esc(it[0])}</span>` : `<a href="${esc(it[1])}">${esc(it[0])}</a>`).join(" › ")}</nav>`;
const cut = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s };
function fail(e) { console.error(e); return send(`<!DOCTYPE html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>خطأ مؤقت</title><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>الموقع يتحدث الآن، حاول بعد دقيقة</h2></body></html>`, "no-store", null, 502) }
function notFound(req, S, cats, what) {
  return send( layout({ req, S, cats, title: "الصفحة غير موجودة | " + (S.store_name || ""), desc: "الصفحة غير موجودة", path: new URL(req.url).pathname, robots: "noindex", body: { main: `<div class="empty"><h1>${esc(what)} غير موجود</h1><p><a class="btn" href="/">الرجوع للرئيسية</a></p></div>` } }), "public, s-maxage=60", null, 404);
}
export { introHtml, reviewsHtml, chatsHtml, heroSliderHtml, tickerHtml, imagesOf, descHtml, toText, socialHtml, params, zones, tiersFor, cardsHtml, trustHtml, rest, settings, categories, PCOLS, esc, fmt, safeUrl, baseUrl, pUrl, cUrl, price, isSale, card, layout, send, orgLd, crumbLd, crumbHtml, cut, fail, notFound, dec, jsonLd, SUPABASE_URL };
