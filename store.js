/* Storefront client: pixels, cart, checkout (cash on delivery), home search.
   Talks to Supabase only through the public key: reads public tables and calls the place_order function. */
(function () {
  const S = window.__S || {};
  const $ = i => document.getElementById(i);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = n => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const safeUrl = u => (/^https?:\/\//i.test(u || "") ? u : "");
  const waNum = String(S.whatsapp || window.WHATSAPP || "").replace(/\D/g, "");
  const wa = t => "https://wa.me/" + waNum + (t ? "?text=" + encodeURIComponent(t) : "");

  /* ---------- pixels ---------- */
  function inject(code) { const s = document.createElement("script"); s.textContent = code; document.head.appendChild(s) }
  (function pixels() {
    const m = (S.meta_pixel_id || "").trim(), t = (S.tiktok_pixel_id || "").trim(), g = (S.ga_id || "").trim();
    const on = k => S[k] !== "0", gt = (S.gtm_id || "").trim();
    if (/^\d{5,20}$/.test(m) && on("app_meta_on")) inject("!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','" + m + "');fbq('track','PageView');");
    if (/^[A-Za-z0-9]{8,30}$/.test(t) && on("app_tiktok_on")) inject("!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie'],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e,n){var i='https://analytics.tiktok.com/i18n/pixel/events.js';ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement('script');o.type='text/javascript',o.async=!0,o.src=i+'?sdkid='+e+'&lib='+t;var a=document.getElementsByTagName('script')[0];a.parentNode.insertBefore(o,a)};ttq.load('" + t + "');ttq.page()}(window,document,'ttq');");
    if (/^GTM-[A-Z0-9]{4,12}$/.test(gt) && on("app_gtm_on")) inject("window.dataLayer=window.dataLayer||[];(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i;f.parentNode.insertBefore(j,f)})(window,document,'script','dataLayer','" + gt + "');");
    if (/^(G|AW)-[A-Za-z0-9-]{4,20}$/.test(g) && on("app_ga_on")) { const s = document.createElement("script"); s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + g; document.head.appendChild(s); inject("window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','" + g + "');") }
  })();
  const sid = (() => { try { let v = localStorage.getItem("sid"); if (!v || v.length < 16) { v = crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2) + "-anon0000"; localStorage.setItem("sid", v) } return v } catch (e) { return "" } })();
  const logEv = k => { if (!sid || navigator.doNotTrack === "1") return; try { fetch(window.SUPABASE_URL + "/rest/v1/rpc/log_event", { method: "POST", headers: { apikey: window.SUPABASE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p_sid: sid, p_kind: k, p_path: location.pathname, p_website: "" }), keepalive: true }).catch(() => {}) } catch (e) {} };
  setTimeout(() => logEv("view"), 400);
  // ev: AddToCart | InitiateCheckout | Purchase | Lead ; d: {value, items:[{id,name,price,qty}], order_no}
  function track(ev, d) {
    d = d || {}; const items = d.items || []; if (ev === "AddToCart") logEv("cart"); else if (ev === "InitiateCheckout") logEv("checkout");
    const ids = items.map(i => String(i.id)), cur = "EGP", eid = ev === "Purchase" && d.order_no ? "p" + d.order_no : null;
    try { if (window.fbq) {
      const p = { value: d.value, currency: cur };
      if (ev !== "Lead") { p.content_ids = ids; p.content_type = "product"; p.contents = items.map(i => ({ id: String(i.id), quantity: i.qty })); p.num_items = items.reduce((a, i) => a + i.qty, 0) }
      else p.content_name = d.name;
      if (eid) fbq("track", ev, p, { eventID: eid }); else fbq("track", ev, p) } } catch (e) {}
    try { if (window.ttq) {
      const map = { Purchase: "PlaceAnOrder", Lead: "Contact" };
      ttq.track(map[ev] || ev, { value: d.value, currency: cur, contents: items.map(i => ({ content_id: String(i.id), content_name: i.name, quantity: i.qty, price: i.price })), content_type: "product", ...(eid ? { event_id: eid } : {}) }) } } catch (e) {}
    try { if (window.gtag) {
      const map = { ViewContent: "view_item", AddToCart: "add_to_cart", InitiateCheckout: "begin_checkout", Purchase: "purchase", Lead: "generate_lead" };
      gtag("event", map[ev], { value: d.value, currency: cur, ...(d.order_no ? { transaction_id: String(d.order_no) } : {}), items: items.map(i => ({ item_id: String(i.id), item_name: i.name, price: i.price, quantity: i.qty })) }) } } catch (e) {}
  }
  try { if (/^GTM-/.test((S.gtm_id || "").trim()) && S.app_gtm_on !== "0") { const gm = { ViewContent: "view_item", AddToCart: "add_to_cart", InitiateCheckout: "begin_checkout", Purchase: "purchase" }, _t = track; window.StoreTrack = (ev, d) => { _t(ev, d); d = d || {}; if (gm[ev]) { window.dataLayer = window.dataLayer || []; dataLayer.push({ ecommerce: null }); dataLayer.push({ event: gm[ev], ecommerce: { currency: "EGP", value: d.value, ...(d.order_no ? { transaction_id: String(d.order_no) } : {}), items: (d.items || []).map(i => ({ item_id: String(i.id), item_name: i.name, price: i.price, quantity: i.qty })) } }) } }; track = window.StoreTrack } } catch (e) {}
  window.StoreTrack = window.StoreTrack || track;
  try { const pa = document.querySelector(".pinfo [data-add],.stick [data-add]"); if (pa && window.StoreTrack) setTimeout(() => window.StoreTrack("ViewContent", { value: Number(pa.dataset.price), items: [{ id: pa.dataset.id, name: pa.dataset.name, price: Number(pa.dataset.price), qty: 1 }] }), 600) } catch (e) {}

  /* ---------- cart (prices shown here are for display; the server re-prices everything) ---------- */
  let cart = [], waMode = false, coupon = null, voucher = null, couponOn = null, payId = "cod", proofPath = null;
  const methods = () => { try { const a = JSON.parse(S.payment_methods || "[]"); return Array.isArray(a) ? a.filter(m => m && (m.on === true || m.on === "1" || m.on === "true") && m.id && m.name && (m.kind === "cod" || String(m.detail || "").trim())) : [] } catch (e) { return [] } };
  const payKind = () => { const m = methods().find(x => x.id === payId); return m ? m.kind : "cod" };
  const btnText = () => (vAll() ? "تأكيد الطلب - مدفوع بالقسيمة" : payKind() === "cod" ? "تأكيد الطلب - الدفع عند الاستلام" : "تأكيد الطلب");
  const totalNow0 = () => { const g = $("cg") ? $("cg").value : "", sh = shipFor(g); return sh == null ? null : sub() - couponDisc() + sh - vDisc(sh) };
  const totalNow = totalNow0; window.__mkTotal = () => totalNow0();
  try { cart = JSON.parse(localStorage.getItem("cart") || "[]").filter(i => i && i.id && i.qty > 0) } catch (e) {}
  const save = () => { coupon = null; try { localStorage.setItem("cart", JSON.stringify(cart)) } catch (e) {} };
  const unit = (i, q) => { let p = i.price; (i.tiers || []).forEach(t => { if (q >= t[0] && t[1] < p) p = t[1] }); return p };
  const unitOf = i => unit(i, i.qty);
  let varIds = null; const loadVarIds = () => (varIds = varIds || fetch(window.SUPABASE_URL + "/rest/v1/product_variants?select=product_id", { headers: { apikey: window.SUPABASE_KEY } }).then(r => r.json()).then(j => new Set(Array.isArray(j) ? j.map(x => x.product_id) : [])).catch(() => new Set()));
  setTimeout(loadVarIds, 800);
  document.addEventListener("change", e => { const r = e.target.closest && e.target.closest("[name=var]"); if (!r) return; const p = r.dataset.price; document.querySelectorAll(".pinfo .pr .price,.stick .price").forEach(el => el.textContent = Number(p).toLocaleString("en-US") + " جنيه"); const o = document.querySelector(".pinfo .pr .old"); if (o) o.textContent = r.dataset.old ? Number(r.dataset.old).toLocaleString("en-US") : "" });
  const sub = () => cart.reduce((a, i) => a + i.qty * unitOf(i), 0);
  const freeMin = () => parseFloat(S.free_shipping_min) || 0;
  const zones = window.__Z || [];
  const zoneFee = g => { const z = zones.find(z => z.governorate === g); return z ? Number(z.fee) : null };
  const shipFor = g => (freeMin() > 0 && sub() >= freeMin() ? 0 : zoneFee(g));
  function add(it, qty) {
    const min = it.min || 1; qty = Math.max(min, Math.min(5000, parseInt(qty) || min));
    const x = cart.find(c => c.id === it.id && (c.vid || "") === (it.vid || "")); if (x) x.qty = Math.min(5000, x.qty + qty); else cart.push({ ...it, qty });
    save(); render(); track("AddToCart", { value: unit(it, qty) * qty, items: [{ id: it.id, name: it.name, price: unit(it, qty), qty }] }); toast("تمت الإضافة للسلة");
  }
  function toast(t) { let e = $("toast"); if (!e) { e = document.createElement("div"); e.id = "toast"; document.body.appendChild(e) } e.textContent = t; e.className = "show"; clearTimeout(toast.t); toast.t = setTimeout(() => (e.className = ""), 1600) }

  /* ---------- UI ---------- */
  document.body.insertAdjacentHTML("beforeend", `<div id="ov" class="ov" hidden></div><aside id="drawer" class="drawer" hidden role="dialog" aria-label="السلة"><div class="dh"><b id="dtitle">سلة المشتريات</b><button class="gray sm" id="dclose">إغلاق</button></div><div id="dbody"></div></aside><div id="bar" class="bar" hidden></div>`);

  /* contact widget */
  if (S.contact_widget !== "0") {
    const cv = (k, d) => { const v = String(S[k] == null ? "" : S[k]).trim(); return v === "" ? d : v }, P = cv("cw_phone", "201270266866").replace(/\D/g, ""), ic = {
      wa: '<path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.800-1.100-4.600-4-4.700-4.200-.1-.2-1.100-1.500-1.100-2.800s.7-2 1-2.300c.2-.3.500-.3.700-.3h.5c.2 0 .4 0 .6.500l.8 2c.1.2.1.400 0 .5l-.4.600c-.1.200-.3.300-.1.600.7 1.100 1.500 2 2.700 2.600.3.200.5.100.700-.1l.8-1c.2-.3.400-.2.600-.1l1.900.9c.3.100.4.200.5.400 0 .2 0 .8-.2 1.400z"/>',
      ms: '<path d="M12 2C6.500 2 2 6.200 2 11.500c0 2.900 1.300 5.500 3.500 7.200V22l3.200-1.800c1.100.3 2.100.4 3.300.4 5.500 0 10-4.200 10-9.500S17.500 2 12 2zm1 12.800l-2.500-2.700-4.900 2.700 5.400-5.700 2.600 2.700 4.800-2.700-5.400 5.700z"/>',
      fb: '<path d="M14 8V6.500c0-.7.200-1 1.200-1H17V2h-2.800C11.300 2 10 3.700 10 6v2H8v3.500h2V22h4v-10.500h2.700L17 8z"/>',
      ig: '<path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3.500a4.500 4.500 0 1 1 0 9 4.500 4.500 0 0 1 0-9zm0 2a2.500 2.500 0 1 0 0 5 2.500 2.500 0 0 0 0-5zm5.300-3.300a1.100 1.100 0 1 1 0 2.200 1.100 1.100 0 0 1 0-2.200z"/>',
      ph: '<path d="M6.600 10.800a15 15 0 0 0 6.600 6.600l2.200-2.200c.3-.3.700-.4 1-.2 1.100.4 2.300.6 3.600.6.600 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.400-1 1-1h3.500c.6 0 1 .4 1 1 0 1.300.2 2.500.6 3.600.1.300 0 .700-.2 1l-2.300 2.200z"/>',
      tt: '<path d="M16.500 2h-3.200v13.200a2.800 2.800 0 1 1-2.800-2.800c.3 0 .6 0 .8.100V9.200a6 6 0 1 0 5.200 5.900V8.500a7.200 7.200 0 0 0 4.200 1.300V6.600A4.300 4.300 0 0 1 16.500 2z"/>'
    };
    const L = [["wa", "WhatsApp", "#20B038", "https://wa.me/" + P], ["ms", "Messenger", "#0068FF", "https://m.me/" + cv("cw_ms", "663625230164164")], ["fb", "Facebook", "#1877F2", "https://www.facebook.com/" + cv("cw_fb", "663625230164164")], ["ig", "Instagram", "#F00073", "https://www.instagram.com/" + cv("cw_ig", "mtb5eee") + "/"], ["ph", "اتصل بينا", "#29CC6A", "tel:+" + P], ["tt", "TikTok", "#000000", "https://www.tiktok.com/@" + cv("cw_tt", "0mtb5e")]];
    const cw = document.createElement("div"); cw.className = "cw";
    cw.innerHTML = '<div class="cw-list">' + L.map(x => '<a class="cw-i" data-t="' + x[1] + '" style="background:' + x[2] + '" href="' + x[3] + '"' + (x[3].startsWith("tel:") ? "" : ' target="_blank" rel="noopener"') + ' aria-label="' + x[1] + '"><svg width="24" height="24" viewBox="0 0 24 24" fill="#fff">' + ic[x[0]] + '</svg></a>').join("") + '</div><button class="cw-main" type="button" aria-label="تواصل معانا"><svg width="26" height="26" viewBox="0 0 24 24" fill="#fff"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg></button><span class="cw-t">تواصل معانا</span>';
    cw.querySelector(".cw-main").onclick = () => cw.classList.toggle("open");
    document.body.appendChild(cw);
  }
  /* ---- order tracking by phone ---- */
  function trkUI(root, auto) {
    const E = x => String(x).replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
    const PAY = { pending: "بانتظار تأكيد الدفع", paid: "تم تأكيد الدفع", cod: "الدفع عند الاستلام" };
    const dmy = iso => { const d = new Date(iso); return isNaN(d) ? "" : String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear() };
    let last = ""; try { last = localStorage.getItem("tph") || "" } catch (x) {}
    root.innerHTML = '<p class="lead">اكتب رقم الموبايل اللي سجلت بيه الطلب وهتشوف طلباتك وحالة كل طلب.</p><form class="trkf" novalidate><input type="tel" inputmode="tel" placeholder="01XXXXXXXXX" autocomplete="tel" value="' + E(last) + '"><button class="btn" type="submit">عرض طلباتي</button></form><p class="msg trke"></p><div class="trkres"></div>';
    const f = root.querySelector("form"), inp = f.querySelector("input"), err = root.querySelector(".trke"), res = root.querySelector(".trkres"), btn = f.querySelector("button");
    const card = (o, steps) => {
      const si = steps.indexOf(o.status), pay = o.pay === "pending" || o.pay === "paid" ? E(o.method || "تحويل") + " - " + (PAY[o.pay] || "") : PAY.cod;
      const stepsH = o.cancelled || !steps.length ? "" : '<ol class="trk">' + steps.map((n, i) => '<li class="' + (i <= si ? "on" : "") + '"><span>' + (i <= si ? "&#10003;" : i + 1) + "</span>" + E(n) + "</li>").join("") + "</ol>";
      const items = (o.items || []).map(x => "<li><span>" + E(x.n) + " &times; " + Number(x.q) + "</span><b>" + Number(x.p * x.q).toLocaleString("en-US") + " جنيه</b></li>").join("");
      return '<details class="tord"><summary><b>طلب #' + Number(o.no) + '</b><span class="tst" style="background:' + (/^#[0-9a-fA-F]{6}$/.test(o.color || "") ? o.color : "#666") + '">' + E(o.status) + '</span><span class="muted">' + dmy(o.created_at) + " - " + Number(o.total || 0).toLocaleString("en-US") + " جنيه</span></summary>" + stepsH + '<p class="muted"><b>الدفع:</b> ' + pay + '</p>' + (o.carrier ? '<p class="muted"><b>الشحن:</b> ' + E(o.carrier) + (o.tracking ? " - رقم التتبع " + E(o.tracking) : "") + (o.cstatus ? " - حالة الشحنة: " + E(o.cstatus) : "") + "</p>" : "") + '<ul class="titems">' + items + '</ul><p><b>الإجمالي شامل الشحن: ' + Number(o.total || 0).toLocaleString("en-US") + " جنيه</b></p></details>";
    };
    const run = () => {
      err.textContent = ""; res.innerHTML = ""; const ph = inp.value.trim();
      if (ph.replace(/\D/g, "").length < 8) { err.textContent = "اكتب رقم الموبايل"; return }
      btn.disabled = true; btn.textContent = "جاري البحث...";
      fetch(window.SUPABASE_URL + "/rest/v1/rpc/track_by_phone", { method: "POST", headers: { apikey: window.SUPABASE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p_phone: ph }) })
        .then(r => r.json()).then(j => {
          btn.disabled = false; btn.textContent = "عرض طلباتي";
          if (!j || !j.ok) { err.textContent = j && j.message && /[\u0600-\u06FF]/.test(j.message) ? j.message : "تعذر عرض الطلبات، حاول تاني"; return }
          try { localStorage.setItem("tph", ph) } catch (x) {}
          res.innerHTML = j.orders.map(o => card(o, j.steps || [])).join("");
          const d = res.querySelector("details"); if (d && j.orders.length === 1) d.open = true;
        }).catch(() => { btn.disabled = false; btn.textContent = "عرض طلباتي"; err.textContent = "تعذر الاتصال، حاول تاني" });
    };
    f.onsubmit = e => { e.preventDefault(); run() };
    if (auto) run();
  }
  if ($("trkpage")) { let a = ""; try { a = sessionStorage.getItem("trk") || ""; sessionStorage.removeItem("trk"); if (a) localStorage.setItem("tph", a) } catch (x) {} trkUI($("trkpage"), !!a) }
  if ($("trkfab")) $("trkfab").onclick = () => {
    if (location.pathname === "/track") { scrollTo(0, 0); return }
    let m = $("trkm");
    if (!m) { m = document.createElement("div"); m.id = "trkm"; m.className = "trkm"; m.innerHTML = '<div class="trkp" role="dialog" aria-label="تتبع طلبك"><button class="trkx" type="button" aria-label="إغلاق">&times;</button><h3>تتبع طلبك</h3><div class="trkb"></div></div>'; document.body.appendChild(m); trkUI(m.querySelector(".trkb"), false); m.onclick = e => { if (e.target === m || e.target.closest(".trkx")) m.hidden = true } }
    m.hidden = false; const i = m.querySelector("input"); if (i) i.focus();
  };
  function open() { $("ov").hidden = false; $("drawer").hidden = false; view("cart") }
  function close() { $("ov").hidden = true; $("drawer").hidden = true }
  $("ov").onclick = close; $("dclose").onclick = close; $("cartBtn").onclick = open;
  window.addEventListener("message", e => { const d = e.data; if (!d || d.ocode !== 1) return; for (const f of document.querySelectorAll("iframe.codef")) if (f.contentWindow === e.source) f.style.height = Math.max(40, Math.min(3000, Math.ceil(Number(d.h) || 0))) + "px" });
  document.addEventListener("click", e => {
    const ot = e.target.closest("[data-ostphone]"); if (ot) { try { if (window.__lastPhone) sessionStorage.setItem("trk", window.__lastPhone) } catch (x) {} }
    const a = e.target.closest("[data-add]"); if (a) { let tiers = []; try { tiers = JSON.parse(a.dataset.tiers || "[]") } catch (x) {} const pq = $("pq"); const inPage = a.closest(".pinfo,.stick"); const base = { id: a.dataset.id, name: a.dataset.name, price: Number(a.dataset.price), image: a.dataset.image, slug: a.dataset.slug, min: parseInt(a.dataset.min) || 1, tiers };
      let vars = []; try { vars = JSON.parse(a.dataset.vars || "[]") } catch (x) {}
      if (vars.length) { const r = document.querySelector("[name=var]:checked"); if (!r) { toast("اختر الخيار الأول"); const v = $("vars"); if (v) v.scrollIntoView({ block: "center" }); return } const v = vars.find(x => x.id === r.value); if (!v) return; base.vid = v.id; base.name = base.name + " - " + v.label; base.price = v.price; add(base, pq && inPage ? pq.value : 0); return }
      if (!inPage) { loadVarIds().then(set => { if (set.has(base.id)) location.href = "/p/" + encodeURIComponent(base.slug); else add(base, 0) }); return }
      add(base, pq && inPage ? pq.value : 0); return }
    const w = e.target.closest("[data-wa]"); if (w) track("Lead", { name: w.dataset.name, value: Number(w.dataset.price) });
  });
  function render() {
    const n = cart.reduce((a, i) => a + i.qty, 0); $("cartCount").textContent = n; $("cartCount").style.display = n ? "flex" : "none";
    const bar = $("bar"); bar.hidden = !n || !$("drawer").hidden || !!$("stick"); bar.innerHTML = n ? `<button class="btn" id="barbtn">عرض السلة (${n}) - ${fmt(sub())} جنيه</button>` : "";
    if (n) $("barbtn").onclick = open;
    if (!$("drawer").hidden && $("dtitle").dataset.v === "cart") view("cart");
  }
  const vDisc = sh => (voucher && sh != null ? Math.min(voucher.value, sub() - couponDisc() + sh) : 0);
  const vAll = () => { const g = $("cg") ? $("cg").value : "", sh = shipFor(g); return !!(voucher && sh != null && voucher.value >= sub() - couponDisc() + sh) };
  const couponDisc = () => (coupon ? Math.min(coupon.disc, sub()) : 0);
  function summary(g) {
    const s = sub(), disc = couponDisc(), sh = shipFor(g), vd = vDisc(sh), minZ = zones.length ? Math.min(...zones.map(z => +z.fee)) : 0, maxZ = zones.length ? Math.max(...zones.map(z => +z.fee)) : 0;
    const shTxt = sh === 0 ? "مجاني" : sh == null ? (zones.length ? `${fmt(minZ)}${maxZ !== minZ ? " - " + fmt(maxZ) : ""} جنيه (حسب المحافظة)` : "حسب المحافظة") : fmt(sh) + " جنيه";
    return `<div class="sum"><div><span>المنتجات</span><b>${fmt(s)} جنيه</b></div><div><span>الشحن</span><b>${shTxt}</b></div>${disc ? `<div><span>${coupon.auto ? "خصم تلقائي" : "خصم الكوبون (" + esc(coupon.code) + ")"}</span><b>-${fmt(disc)} جنيه</b></div>` : ""}${vd ? `<div><span>قسيمة شراء (${esc(voucher.code)})</span><b>-${fmt(vd)} جنيه</b></div>` : ""}<div class="tot"><span>${vd && s - disc + sh - vd <= 0 ? "الإجمالي (مدفوع بالقسيمة)" : payKind() === "cod" ? "الإجمالي (الدفع عند الاستلام)" : "الإجمالي المطلوب تحويله"}</span><b>${sh == null ? fmt(s - disc) + " + الشحن" : fmt(s - disc + sh - vd) + " جنيه"}</b></div>${freeMin() > 0 && s < freeMin() ? `<small>أضف ${fmt(freeMin() - s)} جنيه للحصول على شحن مجاني</small>` : ""}</div>` }
  function waShort(no, name, phone, key) { return `طلب جديد رقم #${no}\nالاسم: ${name}\nالموبايل: ${phone}\nالفاتورة PDF: ${location.origin}/api/notify-order?k=${key}` }
  function waCart() { return "عايز أطلب:\n" + cart.map(i => `- ${i.name} × ${i.qty} (${fmt(unitOf(i))} جنيه)`).join("\n") + `\nالمنتجات: ${fmt(sub())} جنيه` }
  function nextTier(i) { const t = (i.tiers || []).filter(t => t[0] > i.qty && t[1] < unitOf(i)).sort((a, b) => a[0] - b[0])[0]; return t ? `<small class="tn">اطلب ${t[0]} قطعة بسعر ${fmt(t[1])} للقطعة</small>` : "" }
  const OST = { ost_banner: "طلبك قيد المعالجة الآن؛ سيتم الشحن قريبًا.", ost_s1: "تم الشراء الآن", ost_s2: "يتم معالجة طلبك", ost_s3: "تم التوصيل", ost_s3d: "خلال ٣ إلى ٧ أيام عمل", ost_foot: "سيتم التواصل معك هاتفياً أو عبر الواتساب خلال 24 ساعة لتأكيد الشحن." };
  function ostHtml() {
    if ((S.ost_on || "1") === "0") return "";
    const t = k => esc(String(S[k] || "").trim() || OST[k]), d = new Date(), dt = String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
    return `<div class="ost"><div class="ost-b"><i class="ost-dot"></i>${t("ost_banner")}</div><div class="ost-w"><div class="ost-l"></div>
<div class="ost-s done"><div class="ost-c"><span class="ost-e">🛍️</span><span class="ost-k">✓</span></div><div class="ost-t">${t("ost_s1")}</div><div class="ost-d">${dt}</div></div>
<div class="ost-s act"><div class="ost-c"><span class="ost-e">🚚</span><span class="ost-k">✓</span></div><div class="ost-t">${t("ost_s2")}</div><div class="ost-d">${dt}</div></div>
<div class="ost-s"><div class="ost-c"><span class="ost-e">📍</span></div><div class="ost-t">${t("ost_s3")}</div><div class="ost-d hl">${t("ost_s3d")}</div></div></div>
<div class="ost-f"><span>📞</span> ${t("ost_foot")}</div><a class="ost-a" href="/track" data-ostphone>تابع حالة طلبك برقم الموبايل</a></div>`;
  }
  function view(v) {
    $("dtitle").dataset.v = v; const b = $("dbody");
    if (v === "cart") {
      $("dtitle").textContent = "سلة المشتريات";
      if (!cart.length) { b.innerHTML = `<div class="empty">السلة فارغة</div>`; $("bar").hidden = true; return }
      b.innerHTML = cart.map((i, k) => `<div class="li">${safeUrl(i.image) ? `<img src="${esc(i.image)}" alt="" width="56" height="56">` : `<div class="ph s"></div>`}<div class="lt"><a href="/p/${esc(encodeURIComponent(i.slug || ""))}">${esc(i.name)}</a><span>${fmt(unitOf(i))} جنيه ${unitOf(i) < i.price ? "(سعر الجملة)" : ""}</span>${nextTier(i)}</div>
        <div class="qty"><button class="sm gray" data-q="${k}" data-d="-1">-</button><input class="qin" data-qi="${k}" type="number" inputmode="numeric" value="${i.qty}" min="${i.min || 1}"><button class="sm gray" data-q="${k}" data-d="1">+</button></div><button class="sm red" data-rm="${k}" aria-label="حذف">x</button></div>`).join("") + summary("") +
        `<button class="btn full" id="tocheck">إتمام الطلب</button><a class="btn full wa2" id="cartwa" target="_blank" rel="noopener" href="${esc(wa(waCart()))}">أو اطلب عبر واتساب</a>`;
      const setQ = (i, q) => { i.qty = Math.max(i.min || 1, Math.min(5000, parseInt(q) || (i.min || 1))); save(); render() };
      b.querySelectorAll("[data-q]").forEach(x => x.onclick = () => { const i = cart[+x.dataset.q]; setQ(i, i.qty + +x.dataset.d) });
      b.querySelectorAll("[data-qi]").forEach(x => x.onchange = () => setQ(cart[+x.dataset.qi], x.value));
      b.querySelectorAll("[data-rm]").forEach(x => x.onclick = () => { cart.splice(+x.dataset.rm, 1); save(); render() });
      $("tocheck").onclick = () => { track("InitiateCheckout", { value: sub(), items: cart.map(i => ({ id: i.id, name: i.name, price: unitOf(i), qty: i.qty })) }); view("form") };
      $("cartwa").onclick = e => { e.preventDefault(); waMode = true; track("Lead", { name: "cart", value: sub() }); view("form") };
    } else if (v === "form") {
      $("dtitle").textContent = "بيانات التوصيل";
      b.innerHTML = `<form id="ck" novalidate><div class="cnrow"><div><label>الاسم الأول</label><input id="cn" autocomplete="given-name" required maxlength="40"></div><div><label>الاسم الأخير</label><input id="cn2" autocomplete="family-name" required maxlength="40"></div></div>
        <label>الإيميل</label><input id="cem" type="email" inputmode="email" autocomplete="email" dir="ltr" placeholder="name@example.com" required maxlength="120">
        <label>رقم الموبايل</label><input id="cp" type="tel" inputmode="tel" autocomplete="tel" placeholder="01XXXXXXXXX" required>
        <label>رقم موبايل آخر (احتياطي)</label><input id="cp2" type="tel" inputmode="tel" autocomplete="tel" placeholder="01XXXXXXXXX" required>
        <label>المحافظة</label><select id="cg" required><option value="">اختر المحافظة</option>${zones.map(z => `<option value="${esc(z.governorate)}">${esc(z.governorate)}</option>`).join("")}</select>
        <label>العنوان بالتفصيل (المنطقة، الشارع، رقم المبنى)</label><textarea id="ca" rows="3" required maxlength="400"></textarea>
        <label>ملاحظات (اختياري)</label><input id="cnote" maxlength="300">
        <div id="cpbox" hidden><label>كود الخصم (اختياري)</label><div class="cprow"><input id="cpin" dir="ltr" maxlength="30" autocomplete="off" autocapitalize="characters"><button type="button" class="btn gray" id="cpgo">تطبيق</button></div><p class="msg" id="cpmsg"></p></div>
        <div id="vbox"><label>إضافة قسيمة شراء</label><div class="cprow"><input id="vin" dir="ltr" maxlength="30" autocomplete="off" autocapitalize="characters" placeholder="كود القسيمة"><button type="button" class="btn gray" id="vgo">تطبيق</button></div><p class="msg" id="vmsg"></p></div>
        <input id="web" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;width:1px;height:1px" aria-hidden="true">
        <div id="paybox"></div><div id="csum">${summary("")}</div><p class="msg" id="cerr"></p>
        <button class="btn full" id="csub" type="submit">${btnText()}</button><button class="gray full btn" id="cback" type="button">رجوع للسلة</button></form>`;
      try { const g = localStorage.getItem("gov"); if (g && zoneFee(g) != null) { $("cg").value = g; $("csum").innerHTML = summary(g) } } catch (e) {}
      $("cg").onchange = () => { try { localStorage.setItem("gov", $("cg").value) } catch (e) {} refreshTotals() };
      renderPay();
      $("cback").onclick = () => { waMode = false; view("cart") }; $("ck").onsubmit = submit;
      let abT = null; const abSave = () => { const ph = ($("cp").value || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\D/g, ""); if (!/^(20|0020|0)?1[0125]\d{8}$/.test(ph) || !cart.length) return; let k = sessionStorage.getItem("ckey"); if (!k) { k = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2)); sessionStorage.setItem("ckey", k) } fetch(window.SUPABASE_URL + "/rest/v1/rpc/save_abandoned", { method: "POST", headers: { apikey: window.SUPABASE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p_key: k, p_name: (($("cn").value || "") + " " + ($("cn2") ? $("cn2").value || "" : "")).trim(), p_phone: ph, p_governorate: $("cg").value || null, p_items: cart.map(i => ({ id: i.id, name: i.name, qty: i.qty, price: unitOf(i) })), p_total: sub(), p_website: $("web") ? $("web").value : "" }), keepalive: true }).catch(() => {}) };
      $("ck").addEventListener("input", () => { clearTimeout(abT); abT = setTimeout(abSave, 2500) }); $("ck").addEventListener("change", () => { clearTimeout(abT); abT = setTimeout(abSave, 800) });
      initCoupon(); initVoucher();
    } else if (v === "done") { $("dtitle").textContent = "تم استلام طلبك" }
  }
  function initVoucher() {
    const go = $("vgo"); if (!go) return; if (voucher) { $("vin").value = voucher.code; $("vmsg").className = "ok"; $("vmsg").textContent = "تم تطبيق القسيمة: " + fmt(voucher.value) + " جنيه" }
    go.onclick = async () => {
      const code = $("vin").value.trim().toUpperCase(), m = $("vmsg"); m.className = "msg"; m.textContent = "";
      if (!code) { voucher = null; refreshTotals(); return }
      go.disabled = true;
      try { const r = await fetch(window.SUPABASE_URL + "/rest/v1/rpc/voucher_check", { method: "POST", headers: { apikey: window.SUPABASE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p_code: code, p_total: totalNow() || 0 }) }); const j = await r.json();
        if (j && j.ok) { voucher = { code, value: Number(j.value) }; m.className = "ok"; m.textContent = "تم تطبيق القسيمة: " + fmt(j.value) + " جنيه" } else { voucher = null; m.textContent = (j && j.message) || "قسيمة الشراء غير صالحة" } }
      catch (e) { voucher = null; m.textContent = "تعذر التحقق من القسيمة" }
      go.disabled = false; refreshTotals() };
  }
  async function initCoupon() {
    try { if (couponOn === null) { const r = await fetch(window.SUPABASE_URL + "/rest/v1/rpc/coupons_active", { method: "POST", headers: { apikey: window.SUPABASE_KEY, "Content-Type": "application/json" }, body: "{}" }); couponOn = (await r.json()) === true } } catch (e) { couponOn = false }
    const box = $("cpbox"); if (!box || !couponOn) return; box.hidden = false;
    if (!coupon && !window.__noAuto) { try { const r = await fetch(window.SUPABASE_URL + "/rest/v1/rpc/auto_coupon", { method: "POST", headers: { apikey: window.SUPABASE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p_subtotal: sub() }) }); const c = await r.json(); if (typeof c === "string" && c) { const r2 = await fetch(window.SUPABASE_URL + "/rest/v1/rpc/check_coupon", { method: "POST", headers: { apikey: window.SUPABASE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p_code: c, p_subtotal: sub() }) }); const j = await r2.json(); if (j && j.ok) { coupon = { code: c, disc: Number(j.discount), auto: true }; refreshTotals() } } } catch (e) {} }
    if (coupon) { $("cpin").value = coupon.code; $("cpmsg").textContent = "تم تطبيق الخصم"; $("cpmsg").className = "ok" }
    $("cpgo").onclick = async () => {
      window.__noAuto = true;
      const code = $("cpin").value.trim().toUpperCase(), m = $("cpmsg"); m.className = "msg"; m.textContent = "";
      if (!code) { coupon = null; refreshTotals(); return }
      $("cpgo").disabled = true;
      try { const r = await fetch(window.SUPABASE_URL + "/rest/v1/rpc/check_coupon", { method: "POST", headers: { apikey: window.SUPABASE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p_code: code, p_subtotal: sub() }) }); const j = await r.json();
        if (j && j.ok) { coupon = { code, disc: Number(j.discount) }; m.className = "ok"; m.textContent = "تم تطبيق الخصم: " + fmt(j.discount) + " جنيه" } else { coupon = null; m.textContent = (j && j.message) || "كود الخصم غير صالح" } }
      catch (e) { coupon = null; m.textContent = "تعذر التحقق من الكود" }
      $("cpgo").disabled = false; refreshTotals() };
  }
  function refreshTotals() { $("csum").innerHTML = summary($("cg").value); try { renderPay() } catch (e) {} const sb0 = $("csub"); if (sb0) sb0.textContent = btnText(); try { $("ck").dispatchEvent(new Event("change")) } catch (e) {} const t = $("paytot"); if (t) { const v = totalNow(); t.textContent = v == null ? "إجمالي الطلب (اختر المحافظة الأول)" : fmt(v) + " جنيه" } }
  function renderPay() {
    const ms = methods(), box = $("paybox"); if (!box) return;
    if (vAll()) { box.innerHTML = '<p class="accm">قسيمة الشراء بتغطي الطلب كله، مفيش دفع إضافي.</p>'; return }
    if (!ms.length || (ms.length === 1 && ms[0].kind === "cod")) { box.innerHTML = ""; payId = ms.length ? ms[0].id : "cod"; return }
    if (!ms.some(m => m.id === payId)) payId = ms[0].id;
    const m = ms.find(x => x.id === payId), v = totalNow();
    box.innerHTML = `<label>طريقة الدفع</label><div class="pays">${ms.map(x => `<label class="pay${x.id === payId ? " on" : ""}"><input type="radio" name="pm" value="${esc(x.id)}" ${x.id === payId ? "checked" : ""}><span>${esc(x.name)}</span></label>`).join("")}</div>` +
      (m.kind === "cod" ? "" : `<div class="payinfo"><p>1) حوّل <b id="paytot">${v == null ? "إجمالي الطلب (اختر المحافظة الأول)" : fmt(v) + " جنيه"}</b> بالظبط على ${esc(m.name)}:</p><div class="paydet"><b dir="ltr">${esc(m.detail)}</b><button type="button" class="btn gray" id="paycopy">نسخ</button></div>${m.note ? `<p class="muted">${esc(m.note)}</p>` : ""}<p>2) ارفع صورة التحويل (إجباري) وتقدر تكتب رقم العملية كمان:</p><input type="file" id="payfile" accept="image/*"><input id="payref" placeholder="رقم العملية / المرجع (اختياري)" maxlength="60"><p class="muted">طلبك هيتسجل "بانتظار تأكيد الدفع" وهنأكده بعد مراجعة التحويل.</p></div>`);
    box.querySelectorAll("[name=pm]").forEach(r => r.onchange = () => { payId = r.value; renderPay(); $("csum").innerHTML = summary($("cg").value); $("csub").textContent = btnText() });
    const c = $("paycopy"); if (c) c.onclick = async () => { try { await navigator.clipboard.writeText(m.detail) } catch (e) { const t = document.createElement("textarea"); t.value = m.detail; document.body.appendChild(t); t.select(); try { document.execCommand("copy") } catch (x) {} t.remove() } c.textContent = "تم النسخ"; setTimeout(() => (c.textContent = "نسخ"), 1500) };
    $("csub").textContent = btnText();
  }
  async function uploadProof(file) {
    if (proofPath) return proofPath;
    let blob = file;
    try { const bm = await createImageBitmap(file), sc = Math.min(1, 1600 / Math.max(bm.width, bm.height)), cv = document.createElement("canvas"); cv.width = Math.round(bm.width * sc); cv.height = Math.round(bm.height * sc); cv.getContext("2d").drawImage(bm, 0, 0, cv.width, cv.height); blob = await new Promise(r => cv.toBlob(r, "image/jpeg", 0.82)) } catch (e) { if (file.size > 4500000 || !/^image\/(jpeg|png|webp)$/.test(file.type)) throw e }
    const type = blob.type === "image/png" || blob.type === "image/webp" || blob.type === "image/jpeg" ? blob.type : "image/jpeg", ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
    const path = (crypto.randomUUID ? crypto.randomUUID() : "") + "." + ext;
    const r = await fetch(window.SUPABASE_URL + "/storage/v1/object/payment-proofs/" + path, { method: "POST", headers: { apikey: window.SUPABASE_KEY, Authorization: "Bearer " + window.SUPABASE_KEY, "Content-Type": type }, body: blob });
    if (!r.ok) throw new Error("upload " + r.status);
    proofPath = path; return path;
  }
  const fail = m => { $("cerr").textContent = m; $("csub").disabled = false; $("csub").textContent = btnText() };
  async function submit(e) {
    e.preventDefault(); const btn = $("csub"); $("cerr").textContent = "";
    const fn = $("cn").value.trim(), ln = $("cn2").value.trim(), name = (fn + " " + ln).trim(), phone = $("cp").value.trim(), phone2 = $("cp2").value.trim(), email = $("cem").value.trim(), addr = $("ca").value.trim();
    const okPh = v => /^(\+?20|0020|0)?1[0125]\d{8}$/.test(v.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\D/g, ""));
    if (fn.length < 2) return fail("اكتب الاسم الأول"); if (ln.length < 2) return fail("اكتب الاسم الأخير");
    if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/.test(email)) return fail("اكتب إيميل صحيح (مثال name@gmail.com)");
    if (!okPh(phone2)) return fail("اكتب رقم موبايل آخر صحيح (مثال 01001234567)"); if (!/^(\+?20|0020|0)?1[0125]\d{8}$/.test(phone.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\D/g, "").replace(/^/, ""))) return fail("رقم الموبايل غير صحيح (مثال 01001234567)");
    if (!$("cg").value) return fail("اختر المحافظة"); if (addr.length < 8) return fail("اكتب العنوان بالتفصيل");
    let proof = null, ref = null;
    const useWal = !!($("usewal") && $("usewal").checked && window.MKAuth && window.MKAuth.logged), walAll = (useWal && totalNow() != null && window.MKAuth.balance >= totalNow()) || vAll();
    if (payKind() !== "cod" && !walAll) {
      ref = ($("payref").value || "").trim(); const f = $("payfile").files[0];
      if (!f && !proofPath) return fail("لازم ترفع صورة التحويل (سكرين شوت) عشان نأكد الدفع");
      if (f) { btn.disabled = true; btn.textContent = "جاري رفع الصورة..."; try { proof = await uploadProof(f) } catch (e) { btn.disabled = false; btn.textContent = btnText(); return fail("تعذر رفع الصورة، جرب صورة تانية") } } else { proof = proofPath }
    }
    btn.disabled = true; btn.textContent = "جاري إرسال الطلب...";
    let key = sessionStorage.getItem("ckey"); if (!key) { key = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2)); sessionStorage.setItem("ckey", key) }
    const snapshot = cart.map(i => ({ id: i.id, name: i.name, price: unitOf(i), qty: i.qty }));
    try {
      const r = await fetch(window.SUPABASE_URL + "/rest/v1/rpc/place_order", { method: "POST", headers: { apikey: window.SUPABASE_KEY, "Content-Type": "application/json", Authorization: "Bearer " + ((useWal && await window.MKAuth.token()) || window.SUPABASE_KEY) },
        body: JSON.stringify({ p_use_wallet: useWal, p_name: name, p_phone: phone, p_governorate: $("cg").value, p_address: addr, p_notes: $("cnote").value.trim(), p_items: cart.map(i => ({ product_id: i.id, qty: i.qty, variant_id: i.vid || null })), p_key: key, p_website: $("web").value, p_coupon: coupon ? coupon.code : null, p_voucher: voucher ? voucher.code : null, p_pay_method: methods().length && !walAll ? payId : null, p_pay_ref: ref, p_pay_proof: proof, p_email: email, p_phone2: phone2 }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return fail(j.message && /[\u0600-\u06FF]/.test(j.message) ? j.message : "تعذر إرسال الطلب، حاول مرة أخرى أو اطلب عبر واتساب");
      const okey = key; const wasWa = waMode; waMode = false; coupon = null; voucher = null; proofPath = null; sessionStorage.removeItem("ckey"); cart = []; save(); render(); view("done");
      try { sessionStorage.setItem("trk", phone) } catch (x) {}
      $("dbody").innerHTML = `<div class="done"><div class="tick">&#10003;</div><h3>شكراً ${esc(name)}!</h3>${j.order_no ? `<p>رقم طلبك: <b>#${esc(j.order_no)}</b></p>` : ""}<p>${Number(j.wallet_used) > 0 ? `<p>اتخصم <b>${fmt(j.wallet_used)} جنيه</b> من رصيد محفظتك${Number(j.remaining) > 0 ? `، والباقي <b>${fmt(j.remaining)} جنيه</b>` : ", والطلب اتدفع بالكامل"}.</p>` : ""}${j.payment_status === "pending" ? `المطلوب تحويله: <b>${fmt(j.remaining != null ? j.remaining : j.total)} جنيه</b>` : (Number(j.remaining) === 0 ? `الإجمالي: <b>${fmt(j.total)} جنيه</b> (مدفوع من القسيمة / رصيد الحساب)` : `الإجمالي: <b>${fmt(j.total)} جنيه</b>${Number(j.wallet_used) > 0 ? `، المطلوب عند الاستلام <b>${fmt(j.remaining)} جنيه</b>` : " (الدفع عند الاستلام)"}`)}</p>${j.payment_status === "pending" ? `<p>طلبك مسجل <b>بانتظار تأكيد الدفع</b>. هنراجع التحويل ونتواصل معاك.</p>` : ""}<p>سنتواصل معك على ${esc(phone)} لتأكيد الطلب.</p>${(window.__lastPhone = phone, "")}${ostHtml()}${S.order_done_msg ? `<p class="odm">${esc(S.order_done_msg).replace(/\n/g, "<br>")}</p>` : ""}${j.order_no ? `<p><a href="/track">تابع حالة طلبك</a></p>` : ""}${wasWa && j.order_no ? `<a class="btn full wa2" id="dwa" target="_blank" rel="noopener" href="${esc(wa(waShort(j.order_no, name, phone, okey)))}">ابعت الطلب والفاتورة على واتساب</a>` : ""}<button class="btn full" id="dok">متابعة التسوق</button></div>`;
      $("dok").onclick = close;
      if (j.order_no && payKind() === "cod" && j.payment_status !== "paid" && Number(j.remaining != null ? j.remaining : j.total) > 0) payOnline(j.order_no, phone);
      if (j.order_no !== 0) track("Purchase", { value: Number(j.total), order_no: j.order_no, items: snapshot });
    } catch (err) { fail("تعذر الاتصال، تحقق من الإنترنت أو اطلب عبر واتساب") }
  }


  /* ---------- optional online payment (shown only when the owner enabled a gateway and saved its keys) ---------- */
  async function payOnline(orderNo, phone) {
    try {
      const r = await fetch(window.SUPABASE_URL + "/rest/v1/rpc/pay_public_methods", { method: "POST", headers: { apikey: window.SUPABASE_KEY, "Content-Type": "application/json" }, body: "{}" });
      const m = await r.json(); const L = [["card", "بطاقة بنكية"], ["wallet", "محفظة موبايل"], ["valu", "valU تقسيط"], ["applepay", "Apple Pay"], ["opay", "OPay"]].filter(x => m && m[x[0]]);
      if (!L.length || !$("dbody")) return;
      const box = document.createElement("div"); box.className = "payon";
      box.innerHTML = '<p><b>تحب تدفع أونلاين دلوقتي؟</b> (اختياري، وتقدر تدفع عند الاستلام)</p><div class="payb">' + L.map(x => '<button type="button" data-pm="' + x[0] + '">' + x[1] + "</button>").join("") + '</div><p class="payerr" style="color:#c0392b"></p>';
      $("dbody").appendChild(box);
      box.querySelectorAll("[data-pm]").forEach(b => b.onclick = async () => {
        b.disabled = true; box.querySelector(".payerr").textContent = "";
        try { const rr = await fetch("/api/pay/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_no: orderNo, phone, method: b.dataset.pm }) }); const jj = await rr.json(); if (!rr.ok || !jj.url) throw new Error(jj.error || "تعذر بدء الدفع"); location.href = jj.url }
        catch (e) { box.querySelector(".payerr").textContent = e.message; b.disabled = false }
      });
    } catch (e) { }
  }
  /* ---------- search: Arabic-tolerant, suggestions with thumbnails ---------- */
  const norm = t => String(t || "").toLowerCase().replace(/[\u064B-\u065F\u0640]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\s+/g, " ").trim();
  window.__norm = norm;
  let all = null, loading = null, tiersAll = {};
  async function loadCatalog() {
    if (all) return; if (loading) return loading;
    loading = (async () => {
      const H = { apikey: window.SUPABASE_KEY }; let out = [];
      for (let from = 0; ; from += 1000) {
        const r = await fetch(window.SUPABASE_URL + "/rest/v1/products?select=id,name,slug,price,sale_price,image_url,in_stock,min_order_qty&listed=eq.true&order=created_at.desc", { headers: { ...H, Range: from + "-" + (from + 999) } });
        const d = await r.json(); if (!Array.isArray(d)) break; out = out.concat(d); if (d.length < 1000) break }
      try { const r = await fetch(window.SUPABASE_URL + "/rest/v1/product_price_tiers?select=product_id,min_qty,unit_price&order=min_qty.asc", { headers: H }); (await r.json()).forEach(t => (tiersAll[t.product_id] = tiersAll[t.product_id] || []).push([t.min_qty, +t.unit_price])) } catch (e) {}
      out.forEach(p => (p._n = norm(p.name))); all = out })();
    return loading;
  }
  const effPrice = p => (p.sale_price != null && +p.sale_price > 0 && +p.sale_price < +p.price ? +p.sale_price : +p.price);
  const find = t => { const w = norm(t).split(" ").filter(Boolean); return all.filter(p => w.every(x => p._n.includes(x))) };
  const q = $("q"), sug = $("sug");
  if (q) {
    q.addEventListener("focus", () => loadCatalog());
    let tm; q.addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(async () => {
      const t = q.value.trim(); if (norm(t).length < 2) { sug.hidden = true; return }
      await loadCatalog(); const l = find(t).slice(0, 6);
      sug.innerHTML = l.map(p => `<a href="/p/${esc(encodeURIComponent(p.slug))}">${safeUrl(p.image_url) ? `<img src="${esc(p.image_url)}" alt="" width="40" height="40">` : `<span class="ph s"></span>`}<span>${esc(p.name)}</span><b>${fmt(effPrice(p))}</b></a>`).join("") + `<a class="all" href="/?q=${encodeURIComponent(t)}">عرض كل النتائج</a>`;
      sug.hidden = !l.length }, 150) });
    document.addEventListener("click", e => { if (!e.target.closest("#sf")) sug.hidden = true });
    // results grid (home page only)
    if ($("res")) {
      const card = p => { const pr = effPrice(p), img = safeUrl(p.image_url), t = tiersAll[String(p.id)] || [], out = p.in_stock === false;
        const sl = pr < +p.price; return `<article class="card">${sl ? `<span class="badge">-${Math.round((1 - pr / p.price) * 100)}%</span>` : ""}<a href="/p/${esc(encodeURIComponent(p.slug))}" class="imgl">${img ? `<img src="${esc(img)}" alt="${esc(p.name)}" width="400" height="400" loading="lazy">` : `<div class="ph"></div>`}</a><div class="in"><h3><a href="/p/${esc(encodeURIComponent(p.slug))}">${esc(p.name)}</a></h3><div class="pr"><span class="price${sl ? " sale" : ""}">${fmt(pr)} جنيه</span>${sl ? `<span class="old">${fmt(p.price)}</span>` : ""}</div>${sl ? `<div class="save">وفّر ${fmt(p.price - pr)} جنيه</div>` : ""}${out ? `<button class="btn add" disabled>نفذت الكمية</button>` : `<button class="btn add" data-add data-id="${esc(p.id)}" data-name="${esc(p.name)}" data-price="${pr}" data-image="${esc(img)}" data-slug="${esc(p.slug)}" data-min="${p.min_order_qty || 1}" data-tiers="${esc(JSON.stringify(t))}">أضف للسلة</button>`}</div></article>` };
      const show = async t => { sug.hidden = true; if (!norm(t)) { $("res").hidden = true; $("secs").hidden = false; return }
        await loadCatalog(); const l = find(t); $("secs").hidden = true; $("res").hidden = false; $("gt").textContent = "نتائج البحث عن: " + t + " (" + l.length + ")";
        $("grid").innerHTML = l.slice(0, 60).map(card).join("") || `<div class="empty">لا توجد نتائج. جرب كلمة أخرى أو <a href="/wholesale">اطلب منتج غير موجود</a></div>` };
      $("sf").addEventListener("submit", e => { e.preventDefault(); history.replaceState(null, "", q.value.trim() ? "/?q=" + encodeURIComponent(q.value.trim()) : "/"); show(q.value.trim()) });
      const m = location.search.match(/[?&]q=([^&]+)/); if (m) { q.value = decodeURIComponent(m[1].replace(/\+/g, " ")); show(q.value) }
    }
  }

  /* ---------- wholesale request form ---------- */
  if ($("wf")) $("wf").onsubmit = async e => {
    e.preventDefault(); const err = $("werr"); err.textContent = ""; const btn = $("wsub");
    if ($("wn").value.trim().length < 2) return (err.textContent = "اكتب اسمك");
    if ($("wm").value.trim().length < 5) return (err.textContent = "اكتب المنتجات والكميات المطلوبة");
    btn.disabled = true; btn.textContent = "جاري الإرسال...";
    try {
      const r = await fetch(window.SUPABASE_URL + "/rest/v1/rpc/submit_wholesale", { method: "POST", headers: { apikey: window.SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ p_name: $("wn").value.trim(), p_phone: $("wp").value.trim(), p_business: $("wb").value.trim(), p_governorate: $("wg").value, p_message: $("wm").value.trim(), p_website: $("wweb").value }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { err.textContent = j.message && /[\u0600-\u06FF]/.test(j.message) ? j.message : "تعذر الإرسال، حاول مرة أخرى"; btn.disabled = false; btn.textContent = "إرسال الطلب"; return }
      track("Lead", { name: "wholesale" }); $("wf").hidden = true; $("wdone").hidden = false;
    } catch (x) { err.textContent = "تعذر الاتصال"; btn.disabled = false; btn.textContent = "إرسال الطلب" }
  };
  render();
})();

// product gallery: click a thumbnail to swap the main image
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("#thumbs button"); if (!b) return;
  const m = document.getElementById("gmain"); if (!m) return;
  m.src = b.dataset.src; document.querySelectorAll("#thumbs button").forEach(x => x.classList.toggle("on", x === b));
});

document.querySelectorAll(".wch-w").forEach(w => { const c = w.querySelector(".wch-c"); w.querySelectorAll(".wch-b").forEach(b => b.onclick = () => c.scrollBy({ left: (b.dataset.d === "l" ? -1 : 1) * c.clientWidth, behavior: "smooth" })) });
// hero slider: fade, auto-advance, pause on touch/hover/hidden tab, swipe, dots
(function () {
  document.querySelectorAll("[data-hs]").forEach(root => {
    const sl = [...root.querySelectorAll(".hs-slide")], dots = [...root.querySelectorAll(".hs-dots button")];
    if (sl.length < 2) return;
    const hold = Math.max(1000, +root.dataset.ms || 2000), still = false;
    let i = 0, t = null, paused = false;
    const show = n => { i = (n + sl.length) % sl.length; sl.forEach((s, k) => s.classList.toggle("on", k === i)); dots.forEach((d, k) => d.classList.toggle("on", k === i)) };
    const stop = () => { clearTimeout(t); t = null };
    const loop = () => { stop(); if (paused || still || document.hidden) return; t = setTimeout(() => { show(i + 1); loop() }, hold) };
    dots.forEach((d, k) => d.addEventListener("click", () => { show(k); loop() }));
    let x0 = null, resume = null;
    root.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; paused = true; stop(); clearTimeout(resume) }, { passive: true });
    root.addEventListener("touchend", e => { const dx = (e.changedTouches[0].clientX - x0); if (Math.abs(dx) > 40) show(i + (dx > 0 ? 1 : -1)); x0 = null; resume = setTimeout(() => { paused = false; loop() }, 3000) }, { passive: true });
    root.addEventListener("mouseenter", () => { paused = true; stop() });
    root.addEventListener("mouseleave", () => { paused = false; loop() });
    document.addEventListener("visibilitychange", loop);
    loop();
  });
})();
