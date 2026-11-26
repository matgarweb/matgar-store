/* Customer accounts: sign up / log in, account page (orders, wallet, data). Talks to Supabase Auth over REST with the public key. */
(() => {
  const A = window.SUPABASE_URL, K = window.SUPABASE_KEY, $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = n => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const load = () => { try { return JSON.parse(localStorage.getItem("mk_sess") || "null") } catch (e) { return null } };
  let sess = load(), prof = null, wallet = null;
  const save = s => { sess = s; if (s) localStorage.setItem("mk_sess", JSON.stringify(s)); else localStorage.removeItem("mk_sess") };
  const mk = j => j && j.access_token ? { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600), user: { id: j.user.id, email: j.user.email } } : null;
  const aerr = j => { const m = String(j.msg || j.error_description || j.message || j.error || ""); if (/already|registered/i.test(m)) return "الإيميل ده مسجل قبل كده، سجّل دخول"; if (/invalid login|invalid_credentials/i.test(m)) return "الإيميل أو الباسورد غلط"; if (/password/i.test(m)) return "الباسورد لازم يكون 6 حروف أو أرقام على الأقل"; if (/rate|limit|seconds/i.test(m)) return "محاولات كتير، جرّب بعد شوية"; if (/email/i.test(m)) return "اكتب إيميل صحيح"; return "حصلت مشكلة، حاول تاني" };
  async function token() {
    if (!sess) return null;
    if (sess.expires_at - 60 < Date.now() / 1000) {
      try { const r = await fetch(A + "/auth/v1/token?grant_type=refresh_token", { method: "POST", headers: { apikey: K, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: sess.refresh_token }) }); const j = await r.json(); if (r.ok && j.access_token) save(mk(j)); else { save(null); prof = wallet = null; draw(); return null } } catch (e) { return sess.access_token }
    }
    return sess.access_token;
  }
  const api = async (path, opt = {}) => { const t = await token(); if (!t) throw new Error("auth"); const r = await fetch(A + path, { ...opt, headers: { apikey: K, Authorization: "Bearer " + t, "Content-Type": "application/json", ...(opt.headers || {}) } }); const j = await r.json().catch(() => null); if (!r.ok) throw new Error((j && j.message) || "err"); return j };
  const rpc = (n, b) => api("/rest/v1/rpc/" + n, { method: "POST", body: JSON.stringify(b || {}) });
  const arpc = async (n, b) => { const r = await fetch(A + "/rest/v1/rpc/" + n, { method: "POST", headers: { apikey: K, "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }); const j = await r.json().catch(() => null); if (!r.ok) throw new Error((j && j.message) || "err"); return j };
  async function loadProfile() { try { const j = await api("/rest/v1/customer_profiles?select=*&user_id=eq." + sess.user.id); prof = j && j[0] || {}; } catch (e) { prof = prof || {} } try { wallet = await rpc("my_wallet") } catch (e) { wallet = null } }
  async function saveProfile(p) { prof = { ...(prof || {}), ...p }; await api("/rest/v1/customer_profiles?on_conflict=user_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ user_id: sess.user.id, full_name: prof.full_name || null, phone: prof.phone || null, phone2: prof.phone2 || null, address: prof.address || null, governorate: prof.governorate || null, updated_at: new Date().toISOString() }) }) }
  window.MKAuth = { token, get logged() { return !!sess }, get balance() { return wallet && wallet.ok ? Number(wallet.balance) || 0 : 0 }, get profile() { return prof }, refresh: async () => { if (sess) await loadProfile() } };

  /* header button */
  const btn = document.createElement("button"); btn.id = "accBtn"; btn.type = "button"; btn.className = "accbtn";
  const hdr = document.querySelector("header.top"), cb = $("cartBtn"); if (hdr) hdr.insertBefore(btn, cb || null);
  const draw = () => { btn.innerHTML = sess ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg><span>حسابي</span>' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg><span>دخول</span>' };
  draw();
  const bn = $("bnAcc"); if (bn) bn.onclick = () => btn.onclick();

  /* modal */
  const ov = document.createElement("div"); ov.className = "accov"; ov.hidden = true; ov.innerHTML = '<div class="accbox" role="dialog" aria-modal="true"><button class="accx" type="button" aria-label="إغلاق">&times;</button><div id="accbody"></div></div>'; document.body.appendChild(ov);
  const body = () => $("accbody"), close = () => { ov.hidden = true; document.body.style.overflow = "" }, open = () => { ov.hidden = false; document.body.style.overflow = "hidden" };
  ov.querySelector(".accx").onclick = close; ov.onclick = e => { if (e.target === ov) close() };
  btn.onclick = async () => { open(); if (sess) { body().innerHTML = '<p class="accm">جاري التحميل...</p>'; await loadProfile(); account("orders") } else authView("login") };

  function forgotView() {
    body().innerHTML = '<h3>استرجاع كلمة السر</h3><p class="accm">اكتب إيميل حسابك وهنبعتلك رابط تغيّر منه كلمة السر.</p><form id="fgf" novalidate><label>الإيميل</label><input id="fg_e" type="email" dir="ltr" autocomplete="email"><p class="accerr" id="fg_err"></p><button class="btn big" id="fg_s" type="submit">إرسال الرابط</button></form><p class="accm"><a href="#" id="fg_b">رجوع لتسجيل الدخول</a></p>';
    $("fg_b").onclick = e => { e.preventDefault(); authView("login") };
    $("fgf").onsubmit = async e => { e.preventDefault(); const em = $("fg_e").value.trim(), err = $("fg_err"), b = $("fg_s"); err.textContent = ""; err.className = "accerr"; if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) { err.textContent = "اكتب إيميل صحيح"; return } b.disabled = true; b.textContent = "لحظة...";
      try { await arpc("request_password_reset", { p_email: em, p_origin: location.origin }); err.className = "accm"; err.textContent = "لو الإيميل ده مسجل عندنا، هيوصلك رابط استرجاع خلال دقيقة (راجع Spam كمان). الرابط صالح لمدة ساعة."; b.textContent = "تم الإرسال" }
      catch (x) { err.textContent = /[\u0600-\u06FF]/.test(x.message) ? x.message : "تعذر الإرسال، حاول تاني"; b.disabled = false; b.textContent = "إرسال الرابط" } } }
  function resetView(tk) {
    ov.hidden = false; document.body.style.overflow = "hidden";
    body().innerHTML = '<h3>كلمة سر جديدة</h3><form id="rsf" novalidate><label>كلمة السر الجديدة</label><input id="rs_w" type="password" dir="ltr" autocomplete="new-password" minlength="6"><p class="accerr" id="rs_err"></p><button class="btn big" id="rs_s" type="submit">حفظ كلمة السر</button></form>';
    $("rsf").onsubmit = async e => { e.preventDefault(); const err = $("rs_err"), b = $("rs_s"), pw = $("rs_w").value; err.textContent = ""; if (pw.length < 6) { err.textContent = "كلمة السر 6 حروف أو أرقام على الأقل"; return } b.disabled = true; b.textContent = "لحظة...";
      try { await arpc("reset_password", { p_token: tk, p_password: pw }); history.replaceState(null, "", location.pathname); body().innerHTML = '<h3>تم تغيير كلمة السر</h3><p class="accm">تقدر دلوقتي تسجل دخول بكلمة السر الجديدة.</p><button class="btn big" id="rs_go" type="button">تسجيل الدخول</button>'; $("rs_go").onclick = () => authView("login") }
      catch (x) { err.textContent = /[\u0600-\u06FF]/.test(x.message) ? x.message : "تعذر الحفظ، اطلب رابط جديد"; b.disabled = false; b.textContent = "حفظ كلمة السر" } } }
  function authView(mode) {
    const su = mode === "signup";
    body().innerHTML = `<h3>${su ? "إنشاء حساب" : "تسجيل الدخول"}</h3><div class="acctabs"><button type="button" data-m="login" class="${su ? "" : "on"}">دخول</button><button type="button" data-m="signup" class="${su ? "on" : ""}">إنشاء حساب</button></div>
<form id="accf" novalidate>${su ? '<label>الاسم</label><input id="af_n" autocomplete="name" maxlength="60"><label>رقم الموبايل</label><input id="af_p" type="tel" inputmode="tel" autocomplete="tel" placeholder="01XXXXXXXXX">' : ""}
<label>الإيميل</label><input id="af_e" type="email" dir="ltr" autocomplete="email"><label>الباسورد</label><input id="af_w" type="password" dir="ltr" autocomplete="${su ? "new-password" : "current-password"}" minlength="6">
<p class="accerr" id="af_err"></p><button class="btn big" id="af_s" type="submit">${su ? "إنشاء الحساب" : "دخول"}</button></form><p class="accm">${su ? "الحساب بيخليك تتابع طلباتك وتستخدم رصيد الحساب / قسيمة الشراء. ولسه تقدر تشتري كزائر من غير حساب." : "تقدر تشتري كزائر من غير حساب."}</p>${su ? "" : '<p class="accm"><a href="#" id="af_fg">هل نسيت كلمة السر؟</a></p>'}`;
    const fg = $("af_fg"); if (fg) fg.onclick = e => { e.preventDefault(); forgotView() };
    body().querySelectorAll(".acctabs button").forEach(b => b.onclick = () => authView(b.dataset.m));
    $("accf").onsubmit = async e => {
      e.preventDefault(); const err = $("af_err"), b = $("af_s"); err.textContent = "";
      const em = $("af_e").value.trim(), pw = $("af_w").value;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) { err.textContent = "اكتب إيميل صحيح"; return } if (pw.length < 6) { err.textContent = "الباسورد 6 حروف أو أرقام على الأقل"; return }
      let nm = "", ph = ""; if (su) { nm = $("af_n").value.trim(); ph = $("af_p").value.trim(); if (nm.length < 2) { err.textContent = "اكتب الاسم"; return } if (!/^(\+?20|0020|0)?1[0125]\d{8}$/.test(ph.replace(/\D/g, ""))) { err.textContent = "رقم الموبايل غير صحيح"; return } }
      b.disabled = true; b.textContent = "لحظة...";
      try {
        const r = await fetch(A + (su ? "/auth/v1/signup" : "/auth/v1/token?grant_type=password"), { method: "POST", headers: { apikey: K, "Content-Type": "application/json" }, body: JSON.stringify(su ? { email: em, password: pw, data: { full_name: nm } } : { email: em, password: pw }) });
        const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(aerr(j));
        const s = mk(j); if (!s) throw new Error("لازم تأكد الإيميل الأول، شوف رسالة التأكيد على الإيميل");
        save(s); prof = {}; if (su) await saveProfile({ full_name: nm, phone: ph.replace(/\D/g, "") }).catch(() => {}); await loadProfile(); draw(); account("orders");
        if (location.pathname.indexOf("/p/") !== 0) try { document.dispatchEvent(new Event("mk-auth")) } catch (x) {}
      } catch (x) { err.textContent = x.message || "حصلت مشكلة"; b.disabled = false; b.textContent = su ? "إنشاء الحساب" : "دخول" }
    };
  }

  async function account(tab) {
    const bal = wallet && wallet.ok ? Number(wallet.balance) || 0 : 0;
    body().innerHTML = `<h3>أهلاً ${esc((prof && prof.full_name) || sess.user.email)}</h3><div class="accwal"><span>رصيد الحساب / قسيمة الشراء</span><b>${fmt(bal)} جنيه</b></div>
<div class="acctabs"><button type="button" data-t="orders" class="${tab === "orders" ? "on" : ""}">طلباتي</button><button type="button" data-t="wallet" class="${tab === "wallet" ? "on" : ""}">رصيدي</button><button type="button" data-t="data" class="${tab === "data" ? "on" : ""}">بياناتي</button></div><div id="acctab"></div><button type="button" class="btn gray" id="acclo">تسجيل الخروج</button>`;
    body().querySelectorAll(".acctabs button").forEach(b => b.onclick = () => account(b.dataset.t));
    $("acclo").onclick = () => { save(null); prof = wallet = null; draw(); close(); try { document.dispatchEvent(new Event("mk-auth")) } catch (x) {} };
    const t = $("acctab");
    if (tab === "orders") {
      t.innerHTML = '<p class="accm">جاري التحميل...</p>';
      try {
        const j = await rpc("my_orders"), o = (j && j.orders) || [];
        t.innerHTML = o.length ? o.map(x => `<div class="accord"><div class="accrow"><b>طلب #${esc(x.order_no)}</b><span>${new Date(x.date).toLocaleDateString("ar-EG")}</span></div><div class="accrow"><span>${esc(x.status || "")}</span><b>${fmt(x.total)} جنيه</b></div>${Number(x.wallet_used) > 0 ? `<div class="accm">اتدفع من رصيد الحساب: ${fmt(x.wallet_used)} جنيه</div>` : ""}<ul>${(x.items || []).map(i => `<li>${esc(i.name)} × ${esc(i.qty)}</li>`).join("")}</ul></div>`).join("") : '<p class="accm">لسه مفيش طلبات على حسابك.</p>';
      } catch (e) { t.innerHTML = '<p class="accm">تعذر تحميل الطلبات.</p>' }
    } else if (tab === "wallet") {
      const l = (wallet && wallet.ledger) || [], K2 = { topup: "شحن رصيد", refund: "استرجاع", adjust: "تعديل", spend: "دفع طلب" };
      t.innerHTML = '<p class="accm">رصيد الحساب / قسيمة الشراء بيتشحن من المتجر، وتقدر تستخدمه في الدفع وقت الطلب.</p>' + (l.length ? l.map(x => `<div class="accrow led"><span>${K2[x.kind] || x.kind}${x.order_no ? " #" + esc(x.order_no) : ""}${x.note ? " - " + esc(x.note) : ""}<small>${new Date(x.at).toLocaleDateString("ar-EG")}</small></span><b class="${Number(x.amount) < 0 ? "neg" : "pos"}">${Number(x.amount) > 0 ? "+" : ""}${fmt(x.amount)}</b></div>`).join("") : '<p class="accm">مفيش حركات لسه.</p>');
    } else {
      const p = prof || {};
      t.innerHTML = `<form id="accd" novalidate><label>الاسم</label><input id="ad_n" value="${esc(p.full_name)}" maxlength="80"><label>رقم الموبايل</label><input id="ad_p" type="tel" value="${esc(p.phone)}"><label>رقم موبايل تاني</label><input id="ad_p2" type="tel" value="${esc(p.phone2)}"><label>المحافظة</label><input id="ad_g" value="${esc(p.governorate)}" maxlength="40"><label>العنوان</label><textarea id="ad_a" rows="3" maxlength="400">${esc(p.address)}</textarea><label>الإيميل</label><input value="${esc(sess.user.email)}" disabled dir="ltr"><p class="accerr" id="ad_m"></p><button class="btn" type="submit">حفظ البيانات</button></form>`;
      $("accd").onsubmit = async e => { e.preventDefault(); try { await saveProfile({ full_name: $("ad_n").value.trim(), phone: $("ad_p").value.replace(/\D/g, ""), phone2: $("ad_p2").value.replace(/\D/g, ""), governorate: $("ad_g").value.trim(), address: $("ad_a").value.trim() }); $("ad_m").style.color = "#15803d"; $("ad_m").textContent = "تم الحفظ" } catch (x) { $("ad_m").style.color = ""; $("ad_m").textContent = "تعذر الحفظ" } };
    }
  }

  /* checkout: prefill + wallet option */
  const hook = async () => {
    const f = $("ck"); if (!f || f.dataset.acc) return; f.dataset.acc = "1";
    const sb = $("csub"), row = document.createElement("div"); row.className = "walrow";
    if (!sess) { row.innerHTML = '<p class="accm">عندك حساب؟ <a href="#" id="walin">سجّل دخول</a> عشان تستخدم رصيد الحساب / قسيمة الشراء وبياناتك تتملى لوحدها.</p>'; sb.parentNode.insertBefore(row, sb); const a = row.querySelector("#walin"); a.onclick = e => { e.preventDefault(); btn.click() }; return }
    await loadProfile(); const p = prof || {}, set = (id, v) => { const el = $(id); if (el && !el.value && v) el.value = v };
    const parts = String(p.full_name || "").split(" "); set("cn", parts[0]); set("cn2", parts.slice(1).join(" ")); set("cp", p.phone); set("cp2", p.phone2); set("cem", sess.user.email); set("ca", p.address); if ($("cg") && !$("cg").value && p.governorate) { try { $("cg").value = p.governorate } catch (x) {} }
    const bal = window.MKAuth.balance; if (bal > 0) { row.innerHTML = `<label class="walchk"><input type="checkbox" id="usewal"> ادفع من رصيد الحساب / قسيمة الشراء (متاح ${fmt(bal)} جنيه)</label><p class="accm" id="walnote"></p>`; sb.parentNode.insertBefore(row, sb); const upd = () => { const t = window.__mkTotal && window.__mkTotal(), n = $("walnote"); if (!n) return; if (!$("usewal").checked || t == null) { n.textContent = ""; return } n.textContent = bal >= t ? "الطلب كله هيتدفع من رصيد الحساب." : "هيتخصم " + fmt(bal) + " جنيه من رصيد الحساب والباقي " + fmt(t - bal) + " جنيه بطريقة الدفع المختارة." }; row.addEventListener("change", upd); f.addEventListener("change", upd) }
  };
  new MutationObserver(hook).observe(document.body, { childList: true, subtree: true }); hook();
  try { const rt = new URLSearchParams(location.search).get("reset"); if (rt && /^[0-9a-f]{64}$/.test(rt)) { setTimeout(() => { if (sess) { save(null); prof = wallet = null; draw() } resetView(rt) }, 300) } } catch (e) {}
  if (sess) token().then(t => { if (t) loadProfile() });
})();
