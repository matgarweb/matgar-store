const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=i=>document.getElementById(i);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dmy=iso=>/^\d{4}-\d\d-\d\d/.test(iso||"")?iso.slice(8,10)+"/"+iso.slice(5,7)+"/"+iso.slice(0,4):"";
const pdmy=t=>{const m=/^(\d{1,2})\D(\d{1,2})\D(\d{4})$/.exec(String(t||"").replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).trim());return m?m[3]+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0"):""};
const dIn=(id,v)=>`<input id="${id}" type="text" inputmode="numeric" dir="ltr" placeholder="DD/MM/YYYY" maxlength="10" autocomplete="off" value="${esc(v)}">`;
const imgOf=i=>{const p=D.products.find(x=>String(x.id)===String(i.product_id));const u=p&&p.image_url;return /^https?:\/\//.test(u||"")?u:""};
const fmt=n=>Number(n||0).toLocaleString("en-US",{maximumFractionDigits:2});
const num=v=>{const n=parseFloat(String(v).replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)));return isNaN(n)?0:n};
const today=()=>new Date().toISOString().slice(0,10);
const D={products:[],costs:{},tiers:{},cats:[],statuses:[],orders:[],settings:{},zones:[],wholesale:[]};
const NAV=[["home","الرئيسية"],["products","المنتجات"],["cats","الأقسام"],["orders","الطلبات"],["customers","العملاء"],["abandoned","سلات متروكة"],["reports","التقارير والأرباح"],["analytics","التحليلات"],["legal","الصفحات القانونية"],["apps","التطبيقات"],["look","مظهر المتجر"],["shipping","الشحن"],["coupons","العروض وكوبونات الخصم"],["wallet","المحفظة"],["payments","الدفع الأونلاين"],["carriers","عقود شركات الشحن"],["settings","الإعدادات"],["staff","الموظفين والصلاحيات"]];
const AREA={products:"products",cats:"products",orders:"orders",customers:"customers",abandoned:"abandoned",reports:"reports",analytics:"reports",legal:"pages",apps:"apps",look:"settings",shipping:"shipping",coupons:"discounts",settings:"settings",staff:"permissions",wallet:"wallet",payments:"payment",carriers:"shipping"};
const AREAS=[["orders","الطلبات"],["abandoned","السلات المتروكة"],["products","المنتجات والأقسام"],["reviews","التقييمات"],["customers","العملاء"],["discounts","الخصومات والكوبونات"],["settings","الإعدادات (المتجر/الدومين)"],["reports","التقارير والتحليلات"],["apps","التطبيقات"],["payment","الدفع"],["shipping","الشحن"],["pages","الصفحات"],["wallet","المحفظة (القسائم والرصيد)"],["permissions","الموظفين والصلاحيات"]];
let ME={owner:true,perms:{}};const lvl=a=>ME.owner?"full":(ME.perms[a]||"none");
const V={};let tab="home";
async function fetchAll(build){let out=[],from=0;for(;;){const {data,error}=await build().range(from,from+999);if(error)throw error;out=out.concat(data);if(data.length<1000)break;from+=1000}return out}
const flash=(id,t,ok)=>{const e=$(id);if(e){e.textContent=t;e.className=ok?"ok":"msg"}};
const setting=(k,d="")=>D.settings[k]??d;
function csv(name,rows){const t="\ufeff"+rows.map(r=>r.map(c=>{c=String(c??"");return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(",")).join("\r\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([t],{type:"text/csv;charset=utf-8"}));a.download=name;a.click()}

/* ---------- auth + shell ---------- */
let inviteMode=false;
async function login(){if(inviteMode){const em=$("em").value.trim(),pw=$("pw").value,code=$("ic").value.trim();if(!em||pw.length<6||!code){$("err").textContent="اكتب الإيميل وباسورد (6 حروف على الأقل) وكود الدعوة";return}let r=await sb.auth.signUp({email:em,password:pw});if(r.error&&!/registered/i.test(r.error.message)){$("err").textContent="خطأ: "+r.error.message;return}if(!r.data||!r.data.session){r=await sb.auth.signInWithPassword({email:em,password:pw});if(r.error){$("err").textContent="خطأ في الدخول: "+r.error.message;return}}const {error:ce}=await sb.rpc("claim_staff",{p_code:code});if(ce){$("err").textContent="كود الدعوة غير صحيح أو منتهي";await sb.auth.signOut();return}return start()}const {error}=await sb.auth.signInWithPassword({email:$("em").value.trim(),password:$("pw").value});if(error){$("err").textContent="خطأ في الدخول: "+error.message;return}start()}
$("loginBtn").onclick=login;$("invT").onclick=()=>{inviteMode=!inviteMode;$("ic").style.display=inviteMode?"":"none";$("loginBtn").textContent=inviteMode?"تفعيل حساب الموظف":"دخول";$("invT").textContent=inviteMode?"رجوع للدخول العادي":"حساب موظف بكود دعوة"};$("pw").onkeydown=e=>{if(e.key==="Enter")login()};
$("lo").onclick=async()=>{await sb.auth.signOut();location.reload()};
$("menu").onclick=()=>document.body.classList.toggle("open");$("shade").onclick=()=>document.body.classList.remove("open");


V.carriers=async function(){const v=$("view");v.innerHTML='<div class="box skel"></div><div class="box skel"></div>';
 const [cs,pr,mp,ss]=await Promise.all([sb.from("carriers").select("*").order("sort"),sb.from("carrier_prices").select("*"),sb.from("carrier_status_map").select("*"),sb.rpc("carrier_secret_status")]);
 if(cs.error)return v.innerHTML='<div class="box msg">'+esc(cs.error.message)+'</div>';
 const st=ss.data||{},govs=D.zones.map(z=>z.governorate);
 const fld=(c,f,l)=>`<label>${l} ${st["carrier_"+c.id+"_"+f]?'<span class="pill" style="background:#16a34a">محفوظ</span>':'<span class="pill" style="background:#6b7280">غير مضاف</span>'}</label><input type="password" autocomplete="off" id="cs_${c.id}_${f}" placeholder="${st["carrier_"+c.id+"_"+f]?"اتركه فاضي لو مش عايز تغيّره":"الصق القيمة هنا"}">`;
 v.innerHTML=`<p class="hint">الوضع الحالي "شحن ذاتي (بدون عقد)" شغال زي ما هو. أي شركة هنا بتتفعّل لما تضيف بياناتها وعقدك معاها. كل المعلومات المكتوبة "مؤكد" جاية من مصدر رسمي مذكور، و"افتراض" لازم تراجعها. الخانات الفاضية تكتبها أنت.</p>
 ${cs.data.map(c=>{const ps=(pr.data||[]).filter(p=>p.carrier_id===c.id),ms=(mp.data||[]).filter(m=>m.carrier_id===c.id);return `<details class="box carr" data-c="${esc(c.id)}"><summary><b>${esc(c.name)}</b> <span class="pill" style="background:${c.enabled?"#16a34a":"#6b7280"}">${c.enabled?"مفعّلة":"غير مفعّلة"}</span></summary>
 <label class="tgl"><input type="checkbox" id="ce_${c.id}" ${c.enabled?"checked":""}> تفعيل ${esc(c.name)}</label>
 ${c.docs_url?`<p class="hint">التوثيق الرسمي: <a href="${esc(c.docs_url)}" target="_blank" rel="noopener" dir="ltr">${esc(c.docs_url)}</a></p>`:""}
 <h4>معلومات موثّقة</h4>${(c.facts||[]).map(f=>`<div class="fact"><span class="chip" style="background:${f.s==="confirmed"?"#16a34a1a":"#d977061a"};color:${f.s==="confirmed"?"#15803d":"#b45309"}">${f.s==="confirmed"?"مؤكد":"افتراض"}</span> ${esc(f.t)}<br><small>المصدر: ${esc(f.src||"")}</small></div>`).join("")||"<p class='hint'>لا توجد معلومات مسجلة</p>"}
 ${c.kind==="api"?`<h4>بيانات الربط (بتتحفظ مشفّرة)</h4>${fld(c,"api_key","API Key / Token")}${fld(c,"username","اسم المستخدم / Account")}${fld(c,"password","كلمة المرور")}${fld(c,"account_no","رقم الحساب")}${fld(c,"pin","PIN (لو مطلوب)")}
 <h4>استقبال تحديثات الحالة (Webhook)</h4><p class="hint">اعطي الشركة الرابط ده ومعاه الرمز السري: <span dir="ltr">${location.origin}/api/ship-webhook?c=${esc(c.id)}</span> ${st["carrier_"+c.id+"_webhook_token"]?'<span class="pill" style="background:#16a34a">الرمز محفوظ</span>':""}</p><button class="sm gray" data-wt="${esc(c.id)}" type="button">${st["carrier_"+c.id+"_webhook_token"]?"توليد رمز جديد":"توليد رمز سري"}</button> <span id="wt_${c.id}" dir="ltr"></span>`:""}
 <h4>الشروط والتغطية</h4><label>شروط العقد (اكتبها أنت)</label><textarea id="ct_${c.id}" rows="3">${esc(c.terms||"")}</textarea><label>مناطق التغطية</label><textarea id="cc_${c.id}" rows="2">${esc(c.coverage||"")}</textarea><label>المناطق المحظورة / غير المغطاة</label><textarea id="cr_${c.id}" rows="2">${esc(c.restricted||"")}</textarea><label>ملاحظات</label><textarea id="cn_${c.id}" rows="2">${esc(c.notes||"")}</textarea>
 <h4>أسعار الشحن لكل محافظة (فاضية لحد ما تكتبها)</h4><div class="scroll"><table><tr><th>المحافظة</th><th>السعر</th><th>رسوم COD</th><th>المدة</th></tr>${govs.map(g=>{const p=ps.find(x=>x.governorate===g)||{};return `<tr data-g="${esc(g)}"><td>${esc(g)}</td><td><input class="cp-p" type="number" inputmode="decimal" value="${esc(p.price??"")}"></td><td><input class="cp-c" type="number" inputmode="decimal" value="${esc(p.cod_fee??"")}"></td><td><input class="cp-d" value="${esc(p.days||"")}"></td></tr>`}).join("")}</table></div>
 <h4>ربط حالات الشركة بحالات الطلب</h4><p class="hint">اكتب حالة الشركة زي ما بتوصل منها واختار حالة الطلب المقابلة. لو فاضي، الحالة بتتسجل بس من غير تغيير حالة الطلب. وتقدر تغيّر حالة أي طلب يدوي في أي وقت.</p><div class="mrows">${ms.map(m=>mrow(m)).join("")}</div><button class="sm gray" data-ma="${esc(c.id)}" type="button">+ حالة</button>
 <div style="margin-top:12px"><button data-cs="${esc(c.id)}" type="button">حفظ ${esc(c.name)}</button> ${c.kind==="manual"&&c.id!=="self"?`<button class="sm red" data-cd="${esc(c.id)}" type="button">حذف</button>`:""} <span id="cm_${c.id}"></span></div></details>`}).join("")}
 <div class="box"><h4>إضافة شركة شحن أخرى</h4><div class="row"><input id="cnew" placeholder="اسم الشركة"><button id="cnewb" type="button">إضافة</button></div></div>`;
 function mrow(m){return `<div class="mrow row"><input class="m-s" value="${esc(m.carrier_status||"")}" placeholder="حالة الشركة"><select class="m-o"><option value="">بدون تغيير</option>${D.statuses.map(s=>`<option value="${esc(s.id)}" ${m.order_status_id===s.id?"selected":""}>${esc(s.name)}</option>`).join("")}</select><button class="sm red m-x" type="button">x</button></div>`}
 const wire=r=>r.querySelectorAll(".m-x").forEach(b=>b.onclick=()=>b.closest(".mrow").remove());wire(v);
 v.querySelectorAll("[data-ma]").forEach(b=>b.onclick=()=>{b.previousElementSibling.insertAdjacentHTML("beforeend",mrow({}));wire(b.previousElementSibling)});
 v.querySelectorAll("[data-wt]").forEach(b=>b.onclick=async()=>{const t=[...crypto.getRandomValues(new Uint8Array(24))].map(x=>x.toString(16).padStart(2,"0")).join("");const {error}=await sb.rpc("carrier_secret_set",{p_carrier:b.dataset.wt,p_field:"webhook_token",p_value:t});if(error)return alert(error.message);$("wt_"+b.dataset.wt).textContent=t;toast("اتولّد الرمز، انسخه دلوقتي (مش هيظهر تاني)")});
 v.querySelectorAll("[data-cs]").forEach(b=>b.onclick=async()=>{const id=b.dataset.cs,box=b.closest(".carr");flash("cm_"+id,"جاري الحفظ...",true);try{
  let r=await sb.from("carriers").update({enabled:$("ce_"+id).checked,terms:$("ct_"+id).value||null,coverage:$("cc_"+id).value||null,restricted:$("cr_"+id).value||null,notes:$("cn_"+id).value||null,updated_at:new Date().toISOString()}).eq("id",id);if(r.error)throw r.error;
  for(const f of ["api_key","username","password","account_no","pin"]){const e=$("cs_"+id+"_"+f);if(e&&e.value.trim()){r=await sb.rpc("carrier_secret_set",{p_carrier:id,p_field:f,p_value:e.value.trim()});if(r.error)throw r.error}}
  const rows=[...box.querySelectorAll("tr[data-g]")].map(t=>({carrier_id:id,governorate:t.dataset.g,price:t.querySelector(".cp-p").value!==""?num(t.querySelector(".cp-p").value):null,cod_fee:t.querySelector(".cp-c").value!==""?num(t.querySelector(".cp-c").value):null,days:t.querySelector(".cp-d").value.trim()||null}));
  r=await sb.from("carrier_prices").upsert(rows);if(r.error)throw r.error;
  r=await sb.from("carrier_status_map").delete().eq("carrier_id",id);if(r.error)throw r.error;
  const ms=[...box.querySelectorAll(".mrow")].map(m=>({carrier_id:id,carrier_status:m.querySelector(".m-s").value.trim(),order_status_id:m.querySelector(".m-o").value||null})).filter(m=>m.carrier_status);
  if(ms.length){r=await sb.from("carrier_status_map").upsert(ms);if(r.error)throw r.error}
  toast("تم حفظ "+id);V.carriers()}catch(e){flash("cm_"+id,"خطأ: "+(e.message||e))}});
 v.querySelectorAll("[data-cd]").forEach(b=>b.onclick=async()=>{if(!confirm("حذف الشركة؟"))return;const {error}=await sb.from("carriers").delete().eq("id",b.dataset.cd);if(error)return alert(error.message);V.carriers()});
 $("cnewb").onclick=async()=>{const n=$("cnew").value.trim();if(!n)return;const id=(n.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"c")+"-"+Math.random().toString(36).slice(2,5);const {error}=await sb.from("carriers").insert({id,name:n,kind:"manual",sort:100});if(error)return alert(error.message);V.carriers()};
};
V.payments=async function(){const v=$("view");v.innerHTML='<div class="box skel"></div><div class="box skel"></div>';
 const [c,st,pl]=await Promise.all([sb.rpc("pay_cfg_get"),sb.rpc("pay_secret_status"),sb.rpc("pay_list",{})]);
 if(c.error)return v.innerHTML='<div class="box msg">'+esc(c.error.message)+'</div>';
 const cf=c.data||{},ss=st.data||{},rows=pl.data||[],origin=location.origin;
 const sec=(id,label)=>`<label>${label} ${ss[id]?'<span class="pill" style="background:#16a34a">محفوظ</span>':'<span class="pill" style="background:#6b7280">غير مضاف</span>'}</label><input type="password" autocomplete="off" id="ps_${id}" placeholder="${ss[id]?"اتركه فاضي لو مش عايز تغيّره":"الصق القيمة هنا"}">`;
 const tg=(id,label,on)=>`<label class="tgl"><input type="checkbox" id="${id}" ${on?"checked":""}> ${label}</label>`;
 const stc={paid:["مدفوع","#16a34a"],pending:["بانتظار","#d97706"],failed:["فشل","#dc2626"]};
 v.innerHTML=`<div class="box"><h3>💳 Paymob (بطاقة / محفظة موبايل / valU / Apple Pay)</h3>
 <p class="hint">أنشئ حسابك في Paymob بنفسك، وبعدين الصق المفاتيح هنا (بتتحفظ مشفّرة ومحدش بيشوفها تاني). التفعيل تلقائي بعد الحفظ.</p>
 ${tg("pm_on","تفعيل Paymob",cf.paymob_enabled)}${tg("pm_sb","وضع تجريبي (Sandbox): استعمل مفاتيح Test وأرقام Integration الـ Test",cf.paymob_sandbox)}
 <div class="row"><div><label>Integration ID للبطاقة</label><input id="pm_card" dir="ltr" value="${esc(cf.paymob_card_id||"")}"></div><div><label>Integration ID للمحفظة</label><input id="pm_wallet" dir="ltr" value="${esc(cf.paymob_wallet_id||"")}"></div></div>
 <div class="row"><div><label>Integration ID لـ valU</label><input id="pm_valu" dir="ltr" value="${esc(cf.paymob_valu_id||"")}"></div><div><label>Integration ID لـ Apple Pay</label><input id="pm_ap" dir="ltr" value="${esc(cf.paymob_applepay_id||"")}"></div></div>
 ${sec("paymob_secret_key","Secret Key")}${sec("paymob_public_key","Public Key")}${sec("paymob_hmac","HMAC Secret")}${sec("paymob_api_key","API Key (اختياري)")}
 <p class="hint">رابط الإشعار (Webhook) بيتبعت تلقائي مع كل عملية: <span dir="ltr">${origin}/api/pay/paymob-webhook</span>. الوضع التجريبي في Paymob بيتحدد بنوع المفاتيح والـ Integration IDs (Test أو Live)، والتبديل بيتم هنا بتغيير القيم.</p></div>
 <div class="box"><h3>💳 OPay</h3>${tg("op_on","تفعيل OPay",cf.opay_enabled)}${tg("op_sb","وضع تجريبي (Sandbox)",cf.opay_sandbox)}
 <label>Merchant ID</label><input id="op_mid" dir="ltr" value="${esc(cf.opay_merchant_id||"")}">${sec("opay_public_key","Public Key")}${sec("opay_secret_key","Secret Key")}
 <p class="hint">رابط الاستدعاء (Callback) بيتبعت تلقائي: <span dir="ltr">${origin}/api/pay/opay-callback</span></p></div>
 <button id="paysave">حفظ إعدادات الدفع</button> <span id="paym"></span>
 <p class="hint">طرق الدفع الأونلاين مش بتظهر للعملاء إلا لما تكون مفعّلة ومفاتيحها محفوظة. أي دفع أونلاين بيتأكد بس من إشعار موقّع من الشركة، ومفيش حاجة بتتعلّم مدفوعة بدون كده.</p>
 <div class="box"><h3>عمليات الدفع الأونلاين</h3>${rows.length?rows.map(r=>`<div class="prow2"><div><b>${esc(r.provider==="paymob"?"Paymob":"OPay")}</b> - ${esc(r.method||"")} ${r.sandbox?'<span class="chip">تجريبي</span>':""}<br><small dir="ltr">${esc(dtm(r.created_at))} | ${esc(r.provider_txn||r.provider_ref||"")}</small></div><div><b>${fmt(r.amount)} جنيه</b> <span class="pill" style="background:${(stc[r.status]||stc.pending)[1]}">${(stc[r.status]||stc.pending)[0]}</span>${Number(r.refunded)>0?`<br><small>مردود: ${fmt(r.refunded)}</small>`:""}${r.status==="paid"&&Number(r.amount)-Number(r.refunded||0)>0?`<br><button class="sm red" data-rf="${esc(r.id)}" data-left="${Number(r.amount)-Number(r.refunded||0)}" type="button">رد مبلغ</button>`:""}</div></div>`).join(""):"<p>لا توجد عمليات بعد</p>"}</div>`;
 const setS=async(id)=>{const val=$("ps_"+id).value.trim();if(!val)return;const {error}=await sb.rpc("pay_secret_set",{p_name:id,p_value:val});if(error)throw error};
 $("paysave").onclick=async()=>{flash("paym","جاري الحفظ...",true);try{
  const {error}=await sb.rpc("pay_cfg_save",{p:{paymob_enabled:$("pm_on").checked,paymob_sandbox:$("pm_sb").checked,paymob_card_id:$("pm_card").value,paymob_wallet_id:$("pm_wallet").value,paymob_valu_id:$("pm_valu").value,paymob_applepay_id:$("pm_ap").value,opay_enabled:$("op_on").checked,opay_sandbox:$("op_sb").checked,opay_merchant_id:$("op_mid").value}});if(error)throw error;
  for(const id of ["paymob_secret_key","paymob_public_key","paymob_hmac","paymob_api_key","opay_public_key","opay_secret_key"])await setS(id);
  toast("تم حفظ إعدادات الدفع");V.payments()}catch(e){flash("paym","خطأ: "+(e.message||e))}};
 v.querySelectorAll("[data-rf]").forEach(b=>b.onclick=async()=>{const left=Number(b.dataset.left),a=Number(String(prompt("المبلغ المراد رده (جنيه). الحد الأقصى "+left+":",left)||"").replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)));if(!(a>0))return;if(!confirm("تأكيد رد "+a+" جنيه للعميل؟ العملية مش بترجع."))return;b.disabled=true;
  try{const {data}=await sb.auth.getSession();const r=await fetch("/api/pay/refund",{method:"POST",headers:{Authorization:"Bearer "+data.session.access_token,"Content-Type":"application/json"},body:JSON.stringify({payment_id:b.dataset.rf,amount:a})});const j=await r.json();if(!r.ok)throw new Error(j.error||r.status);toast("تم رد المبلغ");V.payments()}catch(e){alert(e.message);b.disabled=false}});
};
V.wallet=async function(){const v=$("view");v.innerHTML='<div class="box skel"></div><div class="box skel"></div>';
 const [a,b,c]=await Promise.all([sb.rpc("admin_vouchers"),sb.rpc("admin_wallet_all"),sb.rpc("admin_accounts",{p_q:null})]);
 if(a.error){v.innerHTML='<div class="box msg">'+esc(a.error.message)+'</div>';return}
 const vs=a.data||[],led=b.data||[],accs=c.data||[],K={topup:"شحن",refund:"استرجاع",adjust:"تعديل",spend:"دفع طلب"};
 const dt=x=>x?new Date(x).toLocaleDateString("ar-EG"):"بدون انتهاء";
 v.innerHTML=`<div class="box"><h3>إنشاء قسيمة شراء</h3><p class="hint">اكتب القيمة. لو سيبت الكود فاضي هيتولد كود تلقائي. لو اخترت عميل، القيمة بتنزل في رصيد حسابه مباشرة بدون كود.</p>
 <label>القيمة (جنيه)</label><input id="vv" type="number" min="1" inputmode="decimal"><label>الكود (اختياري)</label><input id="vc" dir="ltr" maxlength="30"><label>تاريخ الانتهاء (اختياري)</label><input id="ve" type="date"><label><input id="vs" type="checkbox" style="width:auto"> استخدام مرة واحدة (لو أقل من الطلب الباقي يتلغي)</label><label>ملاحظة</label><input id="vn" maxlength="100"><label>تخصيص لعميل (اختياري)</label><select id="vu"><option value="">بدون - كود عام</option>${accs.map(x=>`<option value="${x.user_id}">${esc(x.name||x.email)} - ${esc(x.phone||x.email)}</option>`).join("")}</select><button id="vgo" type="button">إنشاء</button><div id="vres"></div></div>
 <div class="box"><h3>شحن / خصم رصيد حساب عميل</h3><select id="au"><option value="">اختار العميل</option>${accs.map(x=>`<option value="${x.user_id}">${esc(x.name||x.email)} - رصيد ${fmt(x.balance)}</option>`).join("")}</select><input id="aa" type="number" inputmode="decimal" placeholder="المبلغ"><input id="an" placeholder="ملاحظة"><div class="row"><button id="aadd" type="button" class="sm">شحن</button><button id="asub" type="button" class="sm gray">خصم</button></div></div>
 <div class="box"><h3>القسائم (${vs.length})</h3>${vs.length?vs.map(x=>`<div class="ord"><b dir="ltr">${esc(x.code)}</b> ${x.active?"":'<span style="color:#c0392b">(ملغاة/مستهلكة)</span>'}<div>القيمة ${fmt(x.value)} - المتبقي <b>${fmt(x.remaining)}</b> جنيه - ${x.single_use?"مرة واحدة":"قابلة للتجزئة"} - ينتهي: ${dt(x.expires_at)}</div>${x.note?`<small>${esc(x.note)}</small>`:""}${(x.uses||[]).length?`<div><small>استخدام: ${x.uses.map(u=>"طلب #"+(u.order_no||"-")+" ("+fmt(u.amount)+")").join("، ")}</small></div>`:""}<button class="sm gray" data-vt="${x.id}" data-on="${x.active?0:1}" type="button">${x.active?"إلغاء القسيمة":"تفعيل"}</button></div>`).join(""):"<p>لا توجد قسائم</p>"}</div>
 <div class="box"><h3>سجل كل الحركات (آخر 200)</h3>${led.length?led.map(x=>`<div class="ord">${esc(K[x.kind]||x.kind)}${x.order_no?" #"+x.order_no:""} : <b style="color:${x.amount>0?"#1a8f3c":"#c0392b"}">${x.amount>0?"+":""}${fmt(x.amount)}</b> - ${esc(x.email||"")} <small>${dmy(x.at)} ${esc(x.note||"")}</small></div>`).join(""):"<p>لا توجد حركات</p>"}</div>`;
 $("vgo").onclick=async()=>{const val=Number($("vv").value);if(!(val>0))return alert("اكتب القيمة");const e=$("ve").value;const {data,error}=await sb.rpc("admin_voucher_create",{p_code:$("vc").value.trim(),p_value:val,p_expires:e?new Date(e+"T23:59:59").toISOString():null,p_single:$("vs").checked,p_note:$("vn").value.trim(),p_user:$("vu").value||null});if(error)return alert(error.message);const msg=data.credited?`تم شحن رصيد حساب العميل. الرصيد الجديد ${fmt(data.balance)} جنيه`:`كود القسيمة: <b dir="ltr" style="font-size:20px">${esc(data.code)}</b>`;await V.wallet();$("vres").innerHTML=`<div class="box" style="background:#e8f8ee">${msg}</div>`};
 const adj=async k=>{const u=$("au").value,amt=Number($("aa").value);if(!u||!(amt>0))return alert("اختار العميل واكتب المبلغ");const {error}=await sb.rpc("admin_wallet_adjust",{p_user:u,p_amount:k==="sub"?-amt:amt,p_kind:k==="sub"?"adjust":"topup",p_note:$("an").value.trim()});if(error)return alert(error.message);V.wallet()};
 $("aadd").onclick=()=>adj("add");$("asub").onclick=()=>adj("sub");
 v.querySelectorAll("[data-vt]").forEach(b=>b.onclick=async()=>{const {error}=await sb.rpc("admin_voucher_toggle",{p_id:b.dataset.vt,p_active:b.dataset.on==="1"});if(error)return alert(error.message);V.wallet()});
};

V.staff=async function(){const v=$("view");v.innerHTML='<div class="box skel"></div><div class="box skel"></div>';const {data,error}=await sb.rpc("staff_list");if(error){v.innerHTML='<div class="box msg">'+esc(error.message)+'</div>';return}
 const lab={none:"ممنوع",read:"قراءة",full:"كامل"};
 const sel=(a,c)=>`<label style="display:flex;justify-content:space-between;gap:8px;margin:4px 0"><span>${a[1]}</span><select data-a="${a[0]}">${["none","read","full"].map(x=>`<option value="${x}" ${x===(c||"none")?"selected":""}>${lab[x]}</option>`).join("")}</select></label>`;
 const rows=(data||[]).map(s=>`<div class="box" data-sid="${s.id}"><b>${esc(s.name||s.email)}</b> <small>${esc(s.email)}</small><br><small>${s.joined?"✅ فعّل حسابه":"⏳ لسه ما فعّلش (محتاج كود الدعوة)"}</small><div class="pg">${AREAS.map(a=>sel(a,(s.perms||{})[a[0]])).join("")}</div><button data-save>حفظ الصلاحيات</button> <button data-inv>كود دعوة جديد</button> <button data-del style="background:#c0392b">حذف</button><div class="icode"></div></div>`).join("");
 v.innerHTML=`<div class="box"><h3>إضافة موظف</h3><input id="sem" type="email" placeholder="إيميل الموظف"><input id="snm" placeholder="الاسم"><div id="snp">${AREAS.map(a=>sel(a,"none")).join("")}</div><button id="sadd">إضافة وإنشاء كود دعوة</button><div id="sres"></div><p><small>الموظف يفتح صفحة الدخول، يختار "حساب موظف بكود دعوة"، يكتب إيميله وباسورد من اختياره والكود. الكود بيتعرض مرة واحدة وصالح 7 أيام. حسابك (المدير) دايماً صلاحياته كاملة.</small></p></div>`+(rows||'<div class="box msg">لا يوجد موظفين بعد</div>');
 const perms=el=>{const o={};el.querySelectorAll("select[data-a]").forEach(x=>o[x.dataset.a]=x.value);return o};
 const showCode=(el,c)=>{el.innerHTML=c?`<div class="box" style="background:#e8f8ee">كود الدعوة (يظهر مرة واحدة): <b style="font-size:20px;letter-spacing:2px">${esc(c)}</b></div>`:""};
 $("sadd").onclick=async()=>{const em=$("sem").value.trim();if(!em)return alert("اكتب الإيميل");const {data:c,error:e}=await sb.rpc("staff_save",{p_email:em,p_name:$("snm").value.trim(),p_perms:perms($("snp")),p_new_invite:true});if(e)return alert(e.message);showCode($("sres"),c&&c.invite_code);setTimeout(()=>{const h=$("sres").innerHTML;V.staff().then(()=>{$("sres").innerHTML=h})},50)};
 v.querySelectorAll("[data-sid]").forEach(b=>{const s=data.find(x=>x.id===b.dataset.sid);b.querySelector("[data-save]").onclick=async()=>{const {error:e}=await sb.rpc("staff_save",{p_email:s.email,p_name:s.name||"",p_perms:perms(b),p_new_invite:false});alert(e?e.message:"تم الحفظ")};b.querySelector("[data-inv]").onclick=async()=>{const {data:c,error:e}=await sb.rpc("staff_save",{p_email:s.email,p_name:s.name||"",p_perms:perms(b),p_new_invite:true});if(e)return alert(e.message);showCode(b.querySelector(".icode"),c&&c.invite_code)};b.querySelector("[data-del]").onclick=async()=>{if(!confirm("حذف الموظف؟"))return;const {error:e}=await sb.rpc("staff_remove",{p_id:s.id});if(e)return alert(e.message);V.staff()}});
};

async function start(){
 const {data}=await sb.auth.getSession();if(!data.session)return;
 $("login").style.display="none";$("app").style.display="flex";$("view").innerHTML='<div class="box skel"></div><div class="box skel"></div>';
 try{const {data:mp}=await sb.rpc("my_perms");if(mp)ME={owner:!!mp.owner,perms:mp.perms||{}}}catch(e){}
 try{await loadAll()}catch(e){$("view").innerHTML=`<div class="box msg">تعذر تحميل البيانات: ${esc(e.message)}<br>تأكد أنك دخلت بحساب المدير وأنك شغلت ملفات SQL (المرحلة 1 ثم 2).</div>`;return}
 const h=location.hash.slice(1);go(NAV.some(n=>n[0]===h)?h:"home");
}
async function loadAll(){
 const [products,costs,tiers,orders,wh,cats,sts,set,zones,vars]=await Promise.all([
  fetchAll(()=>sb.from("products").select("*").order("created_at",{ascending:false})),
  fetchAll(()=>sb.from("product_costs").select("*")),
  fetchAll(()=>sb.from("product_price_tiers").select("*").order("min_qty")),
  fetchAll(()=>sb.from("orders").select("*,order_items(*)").order("created_at",{ascending:false})),
  fetchAll(()=>sb.from("wholesale_requests").select("*").order("created_at",{ascending:false})),
  sb.from("categories").select("*").order("sort_order").order("name"),
  sb.from("order_statuses").select("*").order("sort_order"),
  sb.from("settings").select("key,value"),
  sb.from("shipping_zones").select("*").order("sort_order"),
  fetchAll(()=>sb.from("product_variants").select("*").order("sort_order").order("created_at"))]);
 for(const r of [cats,sts,set,zones])if(r.error)throw r.error;
 D.products=products;D.costs={};costs.forEach(c=>D.costs[c.product_id]=c.cost);D.tiers={};tiers.forEach(t=>(D.tiers[t.product_id]=D.tiers[t.product_id]||[]).push(t));
 D.vars={};vars.forEach(v=>(D.vars[v.product_id]=D.vars[v.product_id]||[]).push(v));D.orders=orders;D.wholesale=wh;D.cats=cats.data;D.statuses=sts.data;D.zones=zones.data;D.settings={};set.data.forEach(r=>D.settings[r.key]=r.value);
}
const newStatusId=()=>(D.statuses[0]||{}).id;
const newOrders=()=>D.orders.filter(o=>o.status_id===newStatusId()).length;
const newWh=()=>D.wholesale.filter(w=>w.status==="جديد").length;
const IC={home:"🏠",products:"📦",cats:"🗂️",orders:"🧾",customers:"👥",abandoned:"🛒",reports:"📊",analytics:"📈",legal:"📄",apps:"🧩",look:"🎨",shipping:"🚚",coupons:"🏷️",wallet:"💳",payments:"💰",carriers:"🚛",settings:"⚙️",staff:"🔐"};
function drawNav(){const bd={orders:newOrders()+newWh()};$("nav").innerHTML=NAV.filter(n=>!AREA[n[0]]||lvl(AREA[n[0]])!=="none").map(n=>`<button data-t="${n[0]}" class="${n[0]===tab?"on":""}"><span class="ni">${IC[n[0]]||"•"}</span><span class="nt">${n[1]}</span>${bd[n[0]]?`<span class="bd">${bd[n[0]]}</span>`:""}</button>`).join("");$("nav").querySelectorAll("button").forEach(b=>b.onclick=()=>go(b.dataset.t))}
function go(t){if(AREA[t]&&lvl(AREA[t])==="none"){t="home"}tab=t;if(t==="look")lookSub=null;location.hash=t;document.body.classList.remove("open");$("ptitle").textContent=NAV.find(n=>n[0]===t)[1];drawNav();V[t]();if(AREA[t]&&lvl(AREA[t])==="read"){$("view").insertAdjacentHTML("afterbegin","<div class=\"box msg\" style=\"background:#fff7e0\">🔒 صلاحيتك هنا: قراءة فقط. أي تعديل هيترفض.</div>")}scrollTo(0,0)}
async function upload(file,prefix){const ext=(file.name.split(".").pop()||"jpg").replace(/[^a-zA-Z0-9]/g,"").slice(0,5)||"jpg";const path=(prefix?prefix+"/":"")+Date.now()+"-"+Math.random().toString(36).slice(2,8)+"."+ext;
 const {error}=await sb.storage.from("product-images").upload(path,file,{contentType:file.type||undefined});if(error)throw error;return sb.storage.from("product-images").getPublicUrl(path).data.publicUrl}
const catName=id=>(D.cats.find(c=>c.id===id)||{}).name||"";
const catOpts=sel=>`<option value="">بدون تصنيف</option>`+D.cats.map(c=>`<option value="${esc(c.id)}" ${c.id===sel?"selected":""}>${esc(c.name)}</option>`).join("");
const stOf=id=>D.statuses.find(s=>s.id===id);
const itemsCost=o=>(o.order_items||[]).reduce((a,i)=>a+i.qty*Number(i.unit_cost),0);
const orderProfit=o=>Number(o.total)-itemsCost(o)-Number(o.shipping_cost);
const tierPrice=(p,q)=>{let pr=p.sale_price&&p.sale_price<p.price?p.sale_price:p.price;(D.tiers[String(p.id)]||[]).forEach(t=>{if(q>=t.min_qty&&Number(t.unit_price)<pr)pr=Number(t.unit_price)});return pr};

/* ---------- generic settings form ---------- */
function F(list){return list.map(f=>{const [k,l,t]=f;const v=D.settings[k]??"";
 if(t==="color")return `<div><label>${l}</label><input type="color" data-k="${k}" value="${esc(v||(k==="bg_color"?"#faf7f2":k==="ticker_fg"?"#ffffff":"#7a3e1d"))}"></div>`;
 if(t==="area")return `<label>${l}</label><textarea data-k="${k}" rows="3">${esc(v)}</textarea>`;
 if(t==="img")return `<div><label>${l} ${v?`<img src="${esc(v)}" height="36" alt="">`:""}</label><input type="file" accept="image/*" data-up="${k}"></div>`;
 return `<label>${l}</label><input data-k="${k}" value="${esc(v)}" ${t==="ltr"?'dir="ltr"':""} ${t==="num"?'inputmode="decimal"':""}>`}).join("")}
async function saveBlock(root,msg,extra){
 flash(msg,"جاري الحفظ...",true);
 try{
  const rows=[...root.querySelectorAll("[data-k]")].map(i=>({key:i.dataset.k,value:i.value.trim()}));
  for(const f of root.querySelectorAll("[data-up]"))if(f.files[0])rows.push({key:f.dataset.up,value:await upload(f.files[0],"site")});
  const g=k=>rows.find(r=>r.key===k);
  if(g("site_url")){g("site_url").value=g("site_url").value.replace(/\/+$/,"");if(g("site_url").value&&!/^https?:\/\/[^\s\/]+$/.test(g("site_url").value))return flash(msg,"عنوان الموقع لازم يبدأ بـ https:// بدون مسار")}
  if(g("meta_pixel_id")&&g("meta_pixel_id").value&&!/^\d{5,20}$/.test(g("meta_pixel_id").value))return flash(msg,"Meta Pixel ID لازم يكون أرقام فقط");
  if(g("ga_id")&&g("ga_id").value&&!/^(G|AW)-[A-Za-z0-9-]{4,20}$/.test(g("ga_id").value))return flash(msg,"رقم Google Analytics لازم يبدأ بـ G-");
  if(g("whatsapp"))g("whatsapp").value=g("whatsapp").value.replace(/\D/g,"");
  for(const k of ["free_shipping_min","courier_cost","shipping_fee"])if(g(k))g(k).value=String(Math.max(0,num(g(k).value)));
  for(const k of ["facebook_url","instagram_url","tiktok_url","youtube_url","x_url","telegram_url","whatsapp_url"])if(g(k)&&g(k).value&&!/^https:\/\//.test(g(k).value))return flash(msg,"روابط التواصل لازم تبدأ بـ https://");
  if(extra)rows.push(...extra());{const m=new Map();rows.forEach(r=>m.set(r.key,r));rows.length=0;rows.push(...m.values())}
  const {error}=await sb.from("settings").upsert(rows.map(r=>({...r,updated_at:new Date().toISOString()})));if(error)throw error;
  rows.forEach(r=>D.settings[r.key]=r.value);flash(msg,"تم الحفظ",true);return true;
 }catch(e){flash(msg,"خطأ: "+e.message)}
}

/* ---------- home ---------- */
V.home=()=>{
 const m=today().slice(0,7),ok=o=>(stOf(o.status_id)||{counts_in_profit:true}).counts_in_profit;
 const td=D.orders.filter(o=>o.order_date===today()&&ok(o)),mo=D.orders.filter(o=>o.order_date.slice(0,7)===m&&ok(o));
 const noCost=D.products.filter(p=>D.costs[String(p.id)]==null).length,noCat=D.products.filter(p=>!p.category_id).length,oos=D.products.filter(p=>p.in_stock===false).length;
 const todos=[];
 if(newOrders())todos.push(`عندك ${newOrders()} طلب جديد <button class="sm" data-g="orders">افتح الطلبات</button>`);
 if(newWh())todos.push(`${newWh()} طلب جملة جديد <button class="sm" data-g="orders">افتح</button>`);
 if(!setting("site_url"))todos.push(`لم تكتب عنوان الموقع الرسمي (مهم للسيو) <button class="sm" data-g="settings">الإعدادات</button>`);
 if(!setting("return_policy"))todos.push(`لم تكتب سياسة الاسترجاع <button class="sm" data-g="settings">الإعدادات</button>`);
 if(noCost)todos.push(`${noCost} منتج بدون سعر تكلفة (الربح لن يحسب صح) <button class="sm" data-g="products">المنتجات</button>`);
 if(noCat)todos.push(`${noCat} منتج بدون قسم <button class="sm" data-g="products">المنتجات</button>`);
 if(oos)todos.push(`${oos} منتج نفذت كميته`);
 $("view").innerHTML=`${todos.map(t=>`<div class="todo">${t}</div>`).join("")}
 <div class="stat"><div>طلبات جديدة<b>${newOrders()}</b></div><div>مبيعات اليوم<b>${fmt(td.reduce((a,o)=>a+Number(o.total),0))}</b></div><div>ربح اليوم<b>${fmt(td.reduce((a,o)=>a+orderProfit(o),0))}</b></div><div>ربح الشهر<b>${fmt(mo.reduce((a,o)=>a+orderProfit(o),0))}</b></div><div>المنتجات<b>${D.products.length}</b></div></div>
 <div class="box" style="margin-top:14px"><h3>آخر الطلبات</h3>${D.orders.slice(0,6).map(o=>`<div class="ord"><b>#${o.order_no} ${esc(o.customer_name)}</b> ${o.source==="web"?`<span class="pill" style="background:#0891b2">من الموقع</span>`:""} <span class="pill" style="background:${esc((stOf(o.status_id)||{}).color||"#999")}">${esc((stOf(o.status_id)||{}).name||"")}</span> - ${fmt(o.total)} جنيه</div>`).join("")||"لا توجد طلبات بعد"}</div>
 <div class="box"><h3>اختصارات</h3><div class="grid2"><button data-g="products">+ منتج</button><button data-g="orders">+ طلب</button><button data-g="look">تعديل الصفحة الرئيسية</button><button data-g="shipping">أسعار الشحن</button></div></div>`;
 document.querySelectorAll("[data-g]").forEach(b=>b.onclick=()=>go(b.dataset.g));
};

/* ---------- products ---------- */
let editP=null,lim=100,gal=[],pPage=false,pTab="";
const galOf=p=>{const a=Array.isArray(p.images)?p.images.filter(Boolean):[];return a.length?a.slice():(p.image_url?[p.image_url]:[])};
async function shrink(file){ // resize big photos in the browser (max 1400px, JPEG) so the store loads fast and storage lasts
 try{if(!/^image\/(jpeg|png|webp)$/.test(file.type))return file;const bm=await createImageBitmap(file);const k=Math.min(1,1400/Math.max(bm.width,bm.height));if(k===1&&file.size<400000)return file;
  const c=document.createElement("canvas");c.width=Math.round(bm.width*k);c.height=Math.round(bm.height*k);c.getContext("2d").drawImage(bm,0,0,c.width,c.height);
  const b=await new Promise(r=>c.toBlob(r,"image/jpeg",0.85));return b&&b.size<file.size?new File([b],file.name.replace(/\.\w+$/,"")+".jpg",{type:"image/jpeg"}):file}catch(e){return file}}
const RT=[["عريض","<b>","</b>"],["عنوان","<h3>","</h3>"],["قائمة","<ul>\n<li>","</li>\n<li></li>\n</ul>"],["رابط",'<a href="https://">',"</a>"],["صورة",'<img src="https://" alt="">',""],["فاصل","<hr>",""],["لون أحمر",'<span style="color:#c0392b">',"</span>"],["صندوق ملون",'<div style="background:#fff4e5;border:1px solid #f5c98b;border-radius:10px;padding:12px">',"</div>"],["جدول",'<table>\n<tr><th>الخاصية</th><th>القيمة</th></tr>\n<tr><td></td><td></td></tr>\n</table>',""]];
function drawGal(){const g=$("gal");if(!g)return;g.innerHTML=gal.map((u,i)=>`<div class="gi"><img src="${esc(u)}" alt=""><span>${i===0?"<b>الرئيسية</b>":""}</span><div><button type="button" class="sm gray" data-gm="${i}" title="قبل">▶</button><button type="button" class="sm gray" data-gn="${i}" title="بعد">◀</button><button type="button" class="sm red" data-gx="${i}">x</button></div></div>`).join("")||'<p class="hint">لا توجد صور بعد</p>';
 g.querySelectorAll("[data-gm]").forEach(b=>b.onclick=()=>{const i=+b.dataset.gm;if(i>0){[gal[i-1],gal[i]]=[gal[i],gal[i-1]];drawGal()}});
 g.querySelectorAll("[data-gn]").forEach(b=>b.onclick=()=>{const i=+b.dataset.gn;if(i<gal.length-1){[gal[i+1],gal[i]]=[gal[i],gal[i+1]];drawGal()}});
 g.querySelectorAll("[data-gx]").forEach(b=>b.onclick=()=>{gal.splice(+b.dataset.gx,1);drawGal()})}
const tierRow=t=>`<div class="tier"><div><label>من كمية</label><input class="t-q" type="number" inputmode="numeric" min="2" value="${esc(t.min_qty??"")}"></div><div><label>سعر القطعة</label><input class="t-p" type="number" inputmode="decimal" value="${esc(t.unit_price??"")}"></div><div><label>اسم (اختياري: جملة، كرتونة)</label><input class="t-l" value="${esc(t.label)}"></div><button class="sm red t-x" type="button">x</button></div>`;

function toast(t){const e=document.createElement("div");e.className="toast";e.textContent=t;document.body.appendChild(e);setTimeout(()=>e.classList.add("show"),10);setTimeout(()=>{e.classList.remove("show");setTimeout(()=>e.remove(),300)},2400)}
const TMURL="https://cdnjs.cloudflare.com/ajax/libs/tinymce/7.3.0/tinymce.min.js";
function initEd(){const run=()=>{if(!window.tinymce||!$("pd"))return;tinymce.remove("#pd");document.querySelectorAll(".rtb,.rprev").forEach(e=>e.remove());tinymce.init({selector:"#pd",license_key:"gpl",directionality:"rtl",height:440,menubar:"edit view insert format tools table",plugins:"advlist autolink lists link image media table code fullscreen searchreplace charmap wordcount preview anchor visualblocks",toolbar:"undo redo | blocks | bold italic underline forecolor backcolor | alignright aligncenter alignleft | bullist numlist | link image media | table | code fullscreen",branding:false,promotion:false,toolbar_mode:"wrap",menubar_sticky:false,convert_urls:false,relative_urls:false,automatic_uploads:true,images_upload_handler:async bi=>{const b=bi.blob();return await upload(await shrink(new File([b],bi.filename(),{type:b.type})))},media_alt_source:false,content_style:"body{font-family:Cairo,Tahoma,sans-serif;font-size:15px}"})};
 if(window.tinymce)return run();if(window.__tmL)return;window.__tmL=1;const sc=document.createElement("script");sc.src=TMURL;sc.onload=run;sc.onerror=()=>{window.__tmL=0};document.head.appendChild(sc)}
V.products=()=>{
 if(typeof impMode!=="undefined"&&impMode)return V.import();
 const q=($("ps")||{}).value||"",fc=($("pc")||{}).value||"";
 const list=D.products.filter(p=>(!pTab||(p.status||(p.active?"active":"inactive"))===pTab)&&(!q||(p.name||"").includes(q))&&(!fc||(fc==="none"?!p.category_id:p.category_id===fc)));
 const p=editP||{};const ts=editP?(D.tiers[String(p.id)]||[]):[];
 $("view").innerHTML=`<div class="box" id="pform" style="display:${pPage?"block":"none"}"><button class="sm gray" id="pback" type="button">&rarr; رجوع للمنتجات</button> <button class="sm gray" id="impopen" style="float:left">استيراد من Excel / CSV</button><h3>${editP?"تعديل منتج":"منتج جديد"}</h3>
 <label>الاسم</label><input id="pn" value="${esc(p.name)}"><label>الوصف (محرر غني: صور، فيديو، جداول، وكود HTML من قائمة Tools ثم Source code)</label>
 <div class="rtb">${RT.map((t,i)=>`<button type="button" class="sm gray" data-rt="${i}">${t[0]}</button>`).join("")}</div><textarea id="pd" rows="7" dir="auto">${esc(p.description)}</textarea>
 <details class="rprev"><summary>معاينة الوصف كما سيظهر</summary><div id="pdprev" class="desc rich"></div></details>
 <div class="row"><div><label>السعر الأصلي (قبل الخصم)</label><input id="pp" type="number" inputmode="decimal" value="${esc(p.price)}"></div><div><label>سعر الخصم (اللي العميل بيدفعه، اختياري ولازم أقل من الأصلي)</label><input id="psl" type="number" inputmode="decimal" value="${esc(p.sale_price)}"></div><div><label>سعر التكلفة (سري)</label><input id="pcost" type="number" inputmode="decimal" value="${esc(editP?D.costs[String(p.id)]??"":"")}"></div></div>
 <div class="row"><div><label>التصنيف</label><select id="pcat">${catOpts(p.category_id)}</select></div><div><label>أقل كمية للطلب</label><input id="pmoq" type="number" inputmode="numeric" min="1" value="${esc(p.min_order_qty||1)}"></div></div>
 <h4>أسعار الجملة حسب الكمية (اختياري)</h4><p class="hint">مثال: من 10 قطع سعر القطعة 90، من 24 (كرتونة) سعر القطعة 80. السلة تحسب السعر تلقائياً حسب الكمية.</p>
 <div id="tiers">${ts.map(tierRow).join("")}</div><button class="sm gray" id="tadd" type="button">+ شريحة سعر</button>
 <h4>الخيارات (متغيرات: اللون / المقاس / ...) اختياري</h4><p class="hint">لو ضفت خيارات، العميل لازم يختار واحد قبل الإضافة للسلة. اكتب اسم الخيار زي "أحمر / كبير". السعر فاضي = نفس سعر المنتج. الخيار المتوقف مش بيظهر للشراء.</p>
 <div id="vrows">${((editP&&D.vars[String(editP.id)])||[]).map(varRow).join("")}</div><button class="sm gray" id="vadd" type="button">+ خيار</button>
 <h4>المواصفات (خصائص المنتج) اختياري</h4><p class="hint">مثال: الخامة: ستانلس ستيل، البلد: مصر. بتظهر جدول في صفحة المنتج.</p>
 <div id="arows">${(Array.isArray(p.attributes)?p.attributes:[]).map(attrRow).join("")}</div><button class="sm gray" id="aadd" type="button">+ خاصية</button>
 <label style="margin-top:10px">صور المنتج (حتى 12، الأولى هي الرئيسية)</label><div id="gal" class="gal"></div><input id="pfs" type="file" accept="image/*" multiple><span id="gm" class="msg"></span>
 <div class="stsel"><label>حالة المنتج</label><select id="pstat">${[["active","نشط"],["inactive","غير نشط"],["unlisted","غير مدرج"]].map(o=>`<option value="${o[0]}" ${(editP?(p.status||(p.active?"active":"inactive")):"active")===o[0]?"selected":""}>${o[1]}</option>`).join("")}</select><p class="hint">نشط: ظاهر ويتباع. غير نشط: مخفي تماماً. غير مدرج: بيفتح بالرابط المباشر بس، ومش ظاهر في الأقسام والبحث.</p></div><div class="row"><label><input type="checkbox" id="pst" ${editP?(p.in_stock!==false?"checked":""):"checked"}>متوفر</label><label><input type="checkbox" id="pfe" ${p.featured?"checked":""}>منتج مميز (يظهر في الرئيسية)</label></div>
 <button id="psave">حفظ</button> <button class="gray" id="pcancel">إلغاء</button> <span id="pm"></span></div>
 <div class="box" id="plbox" style="display:${pPage?"none":"block"}"><div class="ptabs">${[["","الجميع"],["active","نشط"],["inactive","غير نشط"],["unlisted","غير مدرج"]].map(t=>`<button type="button" data-pt="${t[0]}" class="${pTab===t[0]?"on":""}">${t[1]} <i>${D.products.filter(p=>!t[0]||(p.status||(p.active?"active":"inactive"))===t[0]).length}</i></button>`).join("")}</div><div class="row"><input id="ps" placeholder="بحث في المنتجات" value="${esc(q)}"><select id="pc"><option value="">كل التصنيفات</option><option value="none" ${fc==="none"?"selected":""}>بدون تصنيف</option>${D.cats.map(c=>`<option value="${esc(c.id)}" ${fc===c.id?"selected":""}>${esc(c.name)}</option>`).join("")}</select></div>
 <p><button id="pnew" type="button">+ منتج جديد</button> <button class="sm gray" id="impopen2" type="button">استيراد Excel / CSV</button> عدد المنتجات: ${list.length} <button class="sm gray" id="pexp" type="button">تصدير المنتجات CSV</button> <button class="sm gray" id="ptpl" type="button">تحميل قالب فاضي</button></p><div class="plist">
 ${list.slice(0,lim).map(x=>{const pr=x.sale_price??x.price,st=x.status||(x.active?"active":"inactive"),sc={active:["نشط","#16a34a"],inactive:["غير نشط","#6b7280"],unlisted:["غير مدرج","#d97706"]}[st],nv=(D.vars[String(x.id)]||[]).length;return `<div class="prow" data-e="${esc(x.id)}" role="button" tabindex="0">${x.image_url?`<img loading="lazy" src="${esc(x.image_url)}" alt="">`:`<span class="noimg"></span>`}<div class="pinf"><b>${esc(x.name)}</b><small>${esc(catName(x.category_id))||"بدون قسم"}${nv?" - "+nv+" خيارات":""}</small><div class="pchips"><span class="chip" style="background:${sc[1]}1a;color:${sc[1]}">${sc[0]}</span><span class="chip ${x.in_stock===false?"cr":"cg"}">${x.in_stock===false?"نفذ":"متوفر"}</span>${(D.tiers[String(x.id)]||[]).length?`<span class="chip">جملة</span>`:""}${x.featured?`<span class="chip">مميز</span>`:""}</div></div><div class="ppr">${fmt(pr)} <small>جنيه</small></div><button class="sm red" data-d="${esc(x.id)}" type="button" title="حذف">&#128465;</button></div>`}).join("")||"<p>لا توجد منتجات</p>"}
</div>
 ${list.length>lim?`<button class="gray" id="pmore" style="display:block;margin:12px auto">عرض المزيد</button>`:""}</div>`;
 $("ps").oninput=()=>{lim=100;const pos=$("ps").selectionStart;V.products();$("ps").focus();$("ps").setSelectionRange(pos,pos)};$("pc").onchange=()=>{lim=100;V.products()};
 const PH=["Handle","Title","Description","SKU","Quantity","Regular Price","Sale Price","Cost","Images","Status","Collections"];
 $("pexp").onclick=()=>csv("products-"+today()+".csv",[PH].concat(list.map(x=>{const im=Array.isArray(x.images)&&x.images.length?x.images:(x.image_url?[x.image_url]:[]);const c=D.costs[String(x.id)];return [x.slug||"",x.name,x.description||"",x.sku||"",x.in_stock===false?"out of stock":"available",x.price,x.sale_price??"",c??"",im.join(" "),x.active?"ACTIVE":"DRAFT",catName(x.category_id)==="-"?"":catName(x.category_id)]})));
 $("ptpl").onclick=()=>csv("products-template.csv",[PH,["example-product","اسم المنتج","وصف المنتج","","available","100","","60","https://example.com/image1.jpg","ACTIVE","اسم القسم"]]);
 if($("pmore"))$("pmore").onclick=()=>{lim+=100;V.products()};
 const wireV=()=>{document.querySelectorAll(".v-x").forEach(b=>b.onclick=()=>b.closest(".vrow").remove());document.querySelectorAll(".a-x").forEach(b=>b.onclick=()=>b.closest(".arow").remove())};wireV();
 $("vadd").onclick=()=>{$("vrows").insertAdjacentHTML("beforeend",varRow({in_stock:true}));wireV()};$("aadd").onclick=()=>{$("arows").insertAdjacentHTML("beforeend",attrRow({}));wireV()};
 const wireT=()=>document.querySelectorAll(".t-x").forEach(b=>b.onclick=()=>b.closest(".tier").remove());wireT();
 $("tadd").onclick=()=>{$("tiers").insertAdjacentHTML("beforeend",tierRow({}));wireT()};
 drawGal();$("impopen").onclick=()=>{impMode=true;V.import()};
 $("pfs").onchange=async()=>{const fs=[...$("pfs").files];for(const f of fs){if(gal.length>=12){flash("gm","الحد الأقصى 12 صورة");break}try{flash("gm","جاري رفع "+f.name+"...",true);gal.push(await upload(await shrink(f)));drawGal()}catch(e){flash("gm","خطأ في الرفع: "+e.message);return}}flash("gm","تم الرفع",true);$("pfs").value=""};
 const prev=()=>{$("pdprev").innerHTML=window.sanitizeHtml($("pd").value)};$("pd").oninput=prev;prev();
 document.querySelectorAll("[data-rt]").forEach(b=>b.onclick=()=>{const t=RT[+b.dataset.rt],ta=$("pd"),a=ta.selectionStart,e=ta.selectionEnd,sel=ta.value.slice(a,e);ta.value=ta.value.slice(0,a)+t[1]+sel+t[2]+ta.value.slice(e);ta.focus();prev()});
 $("psave").onclick=saveProduct;$("pcancel").onclick=()=>{editP=null;gal=[];pPage=false;V.products()};
 const find=id=>D.products.find(x=>String(x.id)===id);
 document.querySelectorAll("#view .prow").forEach(b=>b.onclick=ev=>{if(ev.target.closest("[data-d]"))return;editP=find(b.dataset.e);gal=galOf(editP);pPage=true;V.products();scrollTo(0,0)});
 $("pnew").onclick=()=>{editP=null;gal=[];pPage=true;V.products();scrollTo(0,0)};$("impopen2").onclick=()=>{impMode=true;V.import()};$("pback").onclick=()=>{editP=null;gal=[];pPage=false;V.products()};
 document.querySelectorAll("#view [data-pt]").forEach(b=>b.onclick=()=>{pTab=b.dataset.pt;lim=100;V.products()});
 if(pPage)initEd();
 document.querySelectorAll("#view [data-d]").forEach(b=>b.onclick=async()=>{const x=find(b.dataset.d);if(!confirm("حذف المنتج: "+x.name+"؟"))return;const {error}=await sb.from("products").delete().eq("id",x.id);if(error)return alert(error.message);const k=String(x.id);await sb.from("product_costs").delete().eq("product_id",k);await sb.from("product_price_tiers").delete().eq("product_id",k);D.products=D.products.filter(y=>y!==x);V.products()});
};
const varRow=v=>`<div class="vrow row" data-id="${esc(v.id||"")}"><div><label>اسم الخيار</label><input class="v-l" maxlength="60" value="${esc(v.label)}"></div><div><label>السعر (اختياري)</label><input class="v-p" type="number" inputmode="decimal" value="${esc(v.price)}"></div><div><label>سعر الخصم (اللي العميل بيدفعه، اختياري ولازم أقل من الأصلي)</label><input class="v-s" type="number" inputmode="decimal" value="${esc(v.sale_price)}"></div><label><input type="checkbox" class="v-i" style="width:auto" ${v.in_stock!==false?"checked":""}> متوفر</label><button class="sm red v-x" type="button">حذف</button></div>`;
const attrRow=a=>`<div class="arow row"><div><label>الخاصية</label><input class="a-k" maxlength="60" value="${esc(a.k)}"></div><div><label>القيمة</label><input class="a-v" maxlength="200" value="${esc(a.v)}"></div><button class="sm red a-x" type="button">حذف</button></div>`;
async function saveProduct(){
 flash("pm","جاري الحفظ...",true);
 try{
  if(window.tinymce)tinymce.triggerSave();
  if(gal.length>12)return flash("pm","الحد الأقصى 12 صورة");
  if($("psl").value&&num($("psl").value)>0&&num($("psl").value)>=num($("pp").value)){const t=$("pp").value;$("pp").value=$("psl").value;$("psl").value=t;if(num($("psl").value)>=num($("pp").value))$("psl").value="";alert("سعر الخصم لازم يكون أقل من الأصلي، فبدّلت الخانتين تلقائي")}
  const row={name:$("pn").value.trim(),description:$("pd").value,price:num($("pp").value),sale_price:$("psl").value?num($("psl").value):null,image_url:gal[0]||null,images:gal.slice(),category_id:$("pcat").value||null,status:$("pstat").value,in_stock:$("pst").checked,featured:$("pfe").checked,min_order_qty:Math.max(1,parseInt($("pmoq").value)||1),attributes:[...document.querySelectorAll(".arow")].map(r=>({k:r.querySelector(".a-k").value.trim(),v:r.querySelector(".a-v").value.trim()})).filter(a=>a.k&&a.v)};
  if(!row.name||!row.price)return flash("pm","الاسم والسعر مطلوبين");
  const tiers=[...document.querySelectorAll(".tier")].map(r=>({min_qty:parseInt(r.querySelector(".t-q").value),unit_price:num(r.querySelector(".t-p").value),label:r.querySelector(".t-l").value.trim()||null})).filter(t=>t.min_qty>=2&&t.unit_price>0);
  if(new Set(tiers.map(t=>t.min_qty)).size!==tiers.length)return flash("pm","كمية مكررة في شرائح الأسعار");
  const r=editP?await sb.from("products").update(row).eq("id",editP.id).select().single():await sb.from("products").insert(row).select().single();
  if(r.error)throw r.error;const pid=String(r.data.id);
  if($("pcost").value!==""){const {error}=await sb.from("product_costs").upsert({product_id:pid,cost:num($("pcost").value),updated_at:new Date().toISOString()});if(error)throw error;D.costs[pid]=num($("pcost").value)}
  const del=await sb.from("product_price_tiers").delete().eq("product_id",pid);if(del.error)throw del.error;
  if(tiers.length){const {data,error}=await sb.from("product_price_tiers").insert(tiers.map(t=>({...t,product_id:pid}))).select();if(error)throw error;D.tiers[pid]=data.sort((a,b)=>a.min_qty-b.min_qty)}else delete D.tiers[pid];
  const vr=[...document.querySelectorAll(".vrow")].map((r,i)=>({id:r.dataset.id||null,label:r.querySelector(".v-l").value.trim(),price:r.querySelector(".v-p").value!==""?num(r.querySelector(".v-p").value):null,sale_price:r.querySelector(".v-s").value!==""?num(r.querySelector(".v-s").value):null,in_stock:r.querySelector(".v-i").checked,sort_order:i})).filter(v=>v.label);
  if(new Set(vr.map(v=>v.label)).size!==vr.length)return flash("pm","اسم خيار مكرر");
  const keep=vr.filter(v=>v.id).map(v=>v.id),old=(D.vars[pid]||[]).map(v=>v.id).filter(id=>!keep.includes(id));
  if(old.length){const {error}=await sb.from("product_variants").delete().in("id",old);if(error)throw error}
  const ups=vr.filter(v=>v.id).map(v=>({...v,product_id:pid})),ins=vr.filter(v=>!v.id).map(v=>({label:v.label,price:v.price,sale_price:v.sale_price,in_stock:v.in_stock,sort_order:v.sort_order,product_id:pid}));
  if(ups.length){const {error}=await sb.from("product_variants").upsert(ups);if(error)throw error}
  if(ins.length){const {error}=await sb.from("product_variants").insert(ins);if(error)throw error}
  {const {data,error}=await sb.from("product_variants").select("*").eq("product_id",pid).order("sort_order");if(error)throw error;if(data.length)D.vars[pid]=data;else delete D.vars[pid]}
  if(editP)Object.assign(editP,r.data);else D.products.unshift(r.data);
  editP=null;gal=[];pPage=false;V.products();scrollTo(0,0);toast("تم حفظ المنتج");
 }catch(e){flash("pm","خطأ: "+e.message)}
}

/* ---------- customers (built from orders, grouped by phone) ---------- */
let custQ="",custOpen=null;
const normPh=p=>{p=String(p||"").replace(/[\u0660-\u0669]/g,d=>d.charCodeAt(0)-0x660).replace(/\D/g,"");return p.length>=10?p.slice(-10):p};
let custF="all",custData=null,custLed={};
const VBADGE='<svg class="vbadge" title="حساب مسجّل" width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#1d9bf0"/><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
async function custLoad(){
 const [a,b]=await Promise.all([sb.rpc("admin_customers"),sb.rpc("admin_accounts")]);
 if(a.error)throw a.error;
 const rows=(a.data||[]).map(r=>({...r,key:r.phone}));const have=new Set(rows.map(r=>r.user_id).filter(Boolean));
 (b.data||[]).forEach(x=>{if(!have.has(x.user_id))rows.push({key:"u:"+x.user_id,phone:x.phone||"",name:x.name||x.email,phone2:x.phone2,email:x.email,address:x.address,governorate:x.governorate,orders:0,total_spent:0,last_order:x.created_at,user_id:x.user_id,registered:true,balance:x.balance,items:[]})});
 custData=rows}
V.customers=async()=>{
 $("view").innerHTML='<div class="box skel"></div><div class="box skel"></div>';
 try{await custLoad()}catch(e){$("view").innerHTML='<div class="box"><p class="msg">تعذر تحميل العملاء: '+esc(e.message||e)+'</p></div>';return}
 custDraw()};
function custOrders(c){return D.orders.filter(o=>(c.user_id&&o.user_id===c.user_id)||(c.phone&&normPh(o.phone)===normPh(c.phone)))}
function custDraw(){
 const all=custData||[],q=custQ.trim().toLowerCase(),qd=q.replace(/\D/g,"");
 const list=all.filter(c=>(custF==="all"||(custF==="reg"?c.registered:!c.registered))&&(!q||(c.name||"").toLowerCase().includes(q)||(c.email||"").toLowerCase().includes(q)||(qd&&String(c.phone||"").includes(qd))));
 const reg=all.filter(c=>c.registered).length,tot=all.reduce((a,c)=>a+Number(c.total_spent||0),0);
 $("view").innerHTML=`<div class="box"><div class="stat"><div>كل العملاء<b>${all.length}</b></div><div>مسجّلين (شارة زرقا)<b>${reg}</b></div><div>زوار<b>${all.length-reg}</b></div></div>
 <p class="hint">كل مشتري بيتضاف تلقائي من أول طلب (بدون تكرار حسب رقم الموبايل). الشارة الزرقا للي عمل حساب أو سجّل دخول من الموقع. إجمالي مشترياتهم: ${fmt(tot)} جنيه.</p>
 <div class="row"><input id="cq" placeholder="بحث بالاسم أو الموبايل أو الإيميل" value="${esc(custQ)}"><select id="cf"><option value="all"${custF==="all"?" selected":""}>الكل</option><option value="reg"${custF==="reg"?" selected":""}>مسجّلين</option><option value="guest"${custF==="guest"?" selected":""}>زوار</option></select> <button class="sm gray" id="ccsv" type="button" style="width:auto;align-self:center;padding:8px 14px">تصدير CSV</button></div>
 <p>عدد النتائج: ${list.length}</p><div class="scroll"><table><tr><th>العميل</th><th>الموبايل</th><th>الطلبات</th><th>إجمالي الشراء</th><th>آخر طلب</th><th></th></tr>
 ${list.slice(0,200).map(c=>`<tr><td>${esc(c.name||"")} ${c.registered?VBADGE:""}</td><td dir="ltr">${esc(c.phone||"")}</td><td>${c.orders}</td><td>${fmt(c.total_spent)}</td><td>${c.last_order?dmy(c.last_order):""}</td><td><button class="sm" data-c="${esc(c.key)}">${custOpen===c.key?"إخفاء":"التفاصيل"}</button></td></tr>${custOpen===c.key?`<tr><td colspan="6">${custDetail(c)}</td></tr>`:""}`).join("")}</table></div>${list.length>200?"<p class='hint'>أول 200 نتيجة، استخدم البحث.</p>":""}</div>`;
 $("cq").oninput=()=>{custQ=$("cq").value;const p=$("cq").selectionStart;custDraw();$("cq").focus();$("cq").setSelectionRange(p,p)};
 $("cf").onchange=()=>{custF=$("cf").value;custDraw()};
 document.querySelectorAll("#view [data-c]").forEach(b=>b.onclick=async()=>{custOpen=custOpen===b.dataset.c?null:b.dataset.c;const c=custData.find(x=>x.key===custOpen);if(c&&c.user_id){const {data}=await sb.rpc("admin_wallet_ledger",{p_user:c.user_id});custLed[c.user_id]=data||[]}custDraw()});
 document.querySelectorAll("#view [data-wa]").forEach(b=>b.onclick=async()=>{const c=custData.find(x=>x.key===custOpen),amt=Number($("wamt").value),note=$("wnote").value.trim(),sign=b.dataset.wa==="add"?1:-1;if(!(amt>0))return flash("wmsg","اكتب مبلغ صحيح");if(!confirm((sign>0?"شحن ":"خصم ")+fmt(amt)+" جنيه "+(sign>0?"في":"من")+" محفظة "+(c.name||c.email)+"؟"))return;b.disabled=true;const {data,error}=await sb.rpc("admin_wallet_adjust",{p_user:c.user_id,p_amount:sign*amt,p_kind:sign>0?"topup":"adjust",p_note:note||(sign>0?"شحن من المتجر":"خصم من المتجر")});b.disabled=false;if(error)return flash("wmsg",error.message);c.balance=data.balance;const l=await sb.rpc("admin_wallet_ledger",{p_user:c.user_id});custLed[c.user_id]=l.data||[];custDraw();flash("wmsg","تم",true)});
 $("ccsv").onclick=()=>csv("customers-"+today()+".csv",[["الاسم","الموبايل","موبايل 2","الإيميل","المحافظة","العنوان","مسجّل","عدد الطلبات","إجمالي الشراء","رصيد الحساب / قسيمة الشراء"]].concat(list.map(c=>[c.name,c.phone,c.phone2||"",c.email||"",c.governorate||"",c.address||"",c.registered?"نعم":"لا",c.orders,c.total_spent,c.balance==null?"":c.balance])));
}
function custDetail(c){
 const os=custOrders(c),led=custLed[c.user_id]||[],K2={topup:"شحن",refund:"استرجاع",adjust:"تعديل",spend:"دفع طلب"};
 return `<div class="oact" style="flex-direction:column;align-items:stretch;gap:8px">
 <div><b>${esc(c.name||"")}</b> ${c.registered?VBADGE+" حساب مسجّل":"زائر (من غير حساب)"}</div>
 <div>الموبايل: <span dir="ltr">${esc(c.phone||"-")}</span> | موبايل تاني: <span dir="ltr">${esc(c.phone2||"-")}</span></div>
 <div>الإيميل: <span dir="ltr">${esc(c.email||"-")}</span></div><div>العنوان: ${esc([c.governorate,c.address].filter(Boolean).join(" - ")||"-")}</div>
 <div>عدد الطلبات: <b>${c.orders}</b> | إجمالي الشراء: <b>${fmt(c.total_spent)} جنيه</b></div>
 <div>الأصناف اللي طلبها: ${(c.items&&c.items.length)?c.items.map(esc).join("، "):"-"}</div>
 <div><b>الطلبات:</b></div>${os.length?os.map(o=>`<div class="ord"><b>#${o.order_no}</b> ${dmy(o.created_at)} - ${esc((stOf(o.status_id)||{}).name||"")} - ${fmt(o.total)} جنيه${Number(o.wallet_used)>0?" (من الرصيد "+fmt(o.wallet_used)+")":""}${Number(o.voucher_used)>0?" (قسيمة "+fmt(o.voucher_used)+")":""}</div>`).join(""):"<div>-</div>"}
 ${c.registered?`<div class="box" style="margin:6px 0"><b>اللي العميل شايفه في حسابه</b><div>رصيد الحساب / قسيمة الشراء: <b>${fmt(c.balance)} جنيه</b></div>
 <div class="row"><input id="wamt" type="number" inputmode="decimal" placeholder="المبلغ"><input id="wnote" placeholder="ملاحظة (اختياري)"></div>
 <div class="row"><button class="sm" data-wa="add" type="button">شحن رصيد الحساب</button><button class="sm gray" data-wa="sub" type="button">خصم من المحفظة</button></div><p id="wmsg" class="msg"></p>
 <div><b>سجل رصيد الحساب:</b></div>${led.length?led.map(x=>`<div class="ord">${esc(K2[x.kind]||x.kind)}${x.order_no?" #"+x.order_no:""} : <b style="color:${Number(x.amount)<0?"#c0392b":"#15803d"}">${Number(x.amount)>0?"+":""}${fmt(x.amount)}</b> - ${dmy(x.at)}${x.note?" - "+esc(x.note):""}${x.by?" (بواسطة "+esc(x.by)+")":""}</div>`).join(""):"<div>مفيش حركات</div>"}</div>`:""}</div>`}

/* ---------- abandoned checkouts ---------- */
V.abandoned=async()=>{
 $("view").innerHTML='<div class="box skel"></div><div class="box skel"></div>';
 const {data,error}=await sb.from("abandoned_checkouts").select("*").order("updated_at",{ascending:false}).limit(500);
 if(error){$("view").innerHTML=`<div class="box msg">تعذر التحميل: ${esc(error.message)}</div>`;return}
 const byPh=new Map();D.orders.forEach(o=>{const k=normPh(o.phone);(byPh.get(k)||byPh.set(k,[]).get(k)).push(o)});
 const rows=data.map(a=>{const k=normPh(a.phone),done=(byPh.get(k)||[]).some(o=>o.created_at>=a.created_at);return {...a,done,mins:Math.round((Date.now()-new Date(a.updated_at))/60000)}});
 const open=rows.filter(r=>!r.done),wait=r=>r.mins<30;
 const ago=m=>m<60?m+" دقيقة":m<1440?Math.round(m/60)+" ساعة":Math.round(m/1440)+" يوم";
 const wa=r=>{const p="2"+String(r.phone).replace(/^0/,"");const t=`أهلاً ${r.name||""}، لاحظنا إنك بدأت طلب من المتجر ومكملتوش. تحب نساعدك تكمله؟`;return "https://wa.me/"+p+"?text="+encodeURIComponent(t)};
 $("view").innerHTML=`<div class="box"><p class="hint">بيتسجل الطلب هنا لما العميل يكتب رقم موبايل صحيح في صفحة إتمام الطلب ويسيبها من غير ما يؤكد. أي طلب اتأكد بنفس الرقم بعد كده بيتشال من القايمة تلقائياً. الرسالة بتتبعت بضغطتك إنت على زرار واتساب، مفيش رسايل بتتبعت أوتوماتيك.</p>
 <div class="stat"><div>سلات متروكة<b>${open.filter(r=>!wait(r)).length}</b></div><div>قيد الإتمام (أقل من 30 دقيقة)<b>${open.filter(wait).length}</b></div><div>قيمتها<b>${fmt(open.reduce((a,r)=>a+Number(r.total),0))}</b></div></div>
 ${open.length?`<div class="scroll"><table><tr><th>العميل</th><th>الموبايل</th><th>المحافظة</th><th>المنتجات</th><th>القيمة</th><th>من</th><th></th></tr>${open.map(r=>`<tr><td>${esc(r.name||"-")}</td><td dir="ltr">${esc(r.phone)}</td><td>${esc(r.governorate||"")}</td><td>${(r.items||[]).map(i=>esc(i.name)+" ×"+esc(i.qty)).join("<br>")}</td><td>${fmt(r.total)}</td><td>${wait(r)?"قيد الإتمام":ago(r.mins)}</td><td><a class="sm" target="_blank" rel="noopener" href="${esc(wa(r))}">واتساب</a> <button class="sm red" data-ab="${esc(r.id)}">حذف</button></td></tr>`).join("")}</table></div>`:"<p>مفيش سلات متروكة دلوقتي.</p>"}
 ${rows.some(r=>r.done)?`<button class="sm gray" id="abclean" type="button">مسح اللي اتأكدت طلباتها (${rows.filter(r=>r.done).length})</button>`:""}</div>`;
 document.querySelectorAll("#view [data-ab]").forEach(b=>b.onclick=async()=>{if(!confirm("حذف السجل ده؟"))return;const {error}=await sb.from("abandoned_checkouts").delete().eq("id",b.dataset.ab);if(error)return alert(error.message);V.abandoned()});
 if($("abclean"))$("abclean").onclick=async()=>{const ids=rows.filter(r=>r.done).map(r=>r.id);const {error}=await sb.from("abandoned_checkouts").delete().in("id",ids);if(error)return alert(error.message);V.abandoned()};
};

/* ---------- analytics ---------- */
let anDays=30;
V.analytics=async()=>{
 $("view").innerHTML='<div class="box skel"></div><div class="box skel"></div>';
 const {data:A,error}=await sb.rpc("admin_analytics",{p_days:anDays});
 if(error){$("view").innerHTML=`<div class="box msg">تعذر التحميل: ${esc(error.message)}</div>`;return}
 const since=new Date(Date.now()-anDays*864e5).toISOString(),ok=o=>(stOf(o.status_id)||{counts_in_profit:true}).counts_in_profit;
 const os=D.orders.filter(o=>o.created_at>=since&&o.source==="web"),all=D.orders.filter(o=>o.created_at>=since),oc=all.filter(ok);
 const pct=(a,b)=>b?Math.round(a/b*100)+"%":"-";
 const gv={};oc.forEach(o=>{const g=o.governorate||"غير محدد";gv[g]=gv[g]||{n:0,t:0};gv[g].n++;gv[g].t+=Number(o.total)||0});
 const gl=Object.entries(gv).sort((a,b)=>b[1].n-a[1].n),gmax=gl.length?gl[0][1].n:1;
 const out=D.products.filter(p=>p.in_stock===false),hidden=D.products.filter(p=>!p.active).length;
 const nameBySlug=new Map(D.products.map(p=>[p.slug,p.name]));
 const dmax=Math.max(1,...A.daily.map(d=>d.visitors));
 $("view").innerHTML=`<div class="box"><div class="row"><label>الفترة</label><select id="and"><option value="7" ${anDays===7?"selected":""}>آخر 7 أيام</option><option value="30" ${anDays===30?"selected":""}>آخر 30 يوم</option><option value="90" ${anDays===90?"selected":""}>آخر 90 يوم</option></select></div>
 <p class="hint">الزيارات بتتسجل من أول ما التحليلات اشتغلت فقط، وبدون أي بيانات شخصية: معرّف عشوائي مجهول على جهاز الزائر وصفحة الزيارة. مفيش IP ولا اسم ولا موبايل. الزائر اللي بيشغّل "Do Not Track" مش بيتسجل.</p>
 <div class="stat"><div>زوار مختلفين<b>${A.visitors}</b></div><div>مشاهدات صفحات<b>${A.views}</b></div><div>طلبات<b>${all.length}</b></div><div>إجمالي المبيعات<b>${fmt(oc.reduce((a,o)=>a+Number(o.total||0),0))}</b></div></div></div>
 <div class="box"><h3>قمع الشراء</h3><table><tr><th>المرحلة</th><th>العدد</th><th>من اللي قبلها</th></tr>
 <tr><td>زاروا المتجر</td><td>${A.visitors}</td><td></td></tr><tr><td>أضافوا للسلة</td><td>${A.cart}</td><td>${pct(A.cart,A.visitors)}</td></tr><tr><td>بدأوا إتمام الطلب</td><td>${A.checkout}</td><td>${pct(A.checkout,A.cart)}</td></tr><tr><td>أتموا الطلب (من الموقع)</td><td>${os.length}</td><td>${pct(os.length,A.checkout)}</td></tr></table></div>
 <div class="box"><h3>الزوار يوم بيوم</h3>${A.daily.length?A.daily.map(d=>`<div class="ord"><span dir="ltr">${esc(d.d)}</span> <div style="display:inline-block;height:10px;background:#7c3f1d;border-radius:5px;width:${Math.max(4,Math.round(d.visitors/dmax*60))}%"></div> <b>${d.visitors}</b> زائر / ${d.views} مشاهدة</div>`).join(""):"<p>لسه مفيش زيارات متسجلة.</p>"}</div>
 <div class="box"><h3>أكتر المنتجات مشاهدة</h3>${A.top.length?A.top.map(t=>{const sl=decodeURIComponent(t.path.replace("/p/",""));return `<div class="ord">${esc(nameBySlug.get(sl)||sl)} <b>${t.views}</b></div>`}).join(""):"<p>لسه مفيش بيانات.</p>"}</div>
 <div class="box"><h3>الطلبات حسب المحافظة (غير الملغية)</h3>${gl.length?gl.map(([g,v])=>`<div class="ord">${esc(g)}: <b>${v.n}</b> طلب - ${fmt(v.t)} جنيه <div style="height:8px;background:#7c3f1d;border-radius:4px;width:${Math.max(4,Math.round(v.n/gmax*100))}%"></div></div>`).join(""):"<p>مفيش طلبات في الفترة دي.</p>"}</div>
 <div class="box"><h3>المخزون</h3><p>منتجات معلّمة "نفذت الكمية": <b>${out.length}</b> - منتجات مخفية: <b>${hidden}</b> - إجمالي المنتجات: <b>${D.products.length}</b></p><p class="hint">المخزون عندك حالة متوفر/نفذ مش كميات، عشان كده مفيش عدّاد كميات.</p>${out.slice(0,40).map(p=>`<div class="ord">${esc(p.name)}</div>`).join("")}</div>`;
 $("and").onchange=()=>{anDays=+$("and").value;V.analytics()};
};

/* ---------- legal pages ---------- */
const LEGAL_T={"privacy": "# سياسة الخصوصية\n\nبنحترم خصوصيتك. الصفحة دي بتشرح إيه البيانات اللي بنسجلها وبنستخدمها ليه.\n\n# البيانات اللي بنجمعها\n\nلما تعمل طلب: الاسم، رقم الموبايل، العنوان والمحافظة، وملاحظاتك على الطلب. ولو دفعت بتحويل بنستلم صورة إيصال التحويل اللي بترفعها.\n\n# حفظ بيانات الطلب قبل التأكيد (السلات المتروكة)\n\nبمجرد ما تكتب اسمك ورقم موبايلك في صفحة إتمام الطلب، بنحتفظ بالاسم والموبايل والمنتجات اللي في سلتك حتى لو ما أكدتش الطلب، عشان نقدر نتواصل معاك لو حصلت مشكلة أثناء الطلب. لو عايز تمسح بياناتك دي، كلمنا وهنمسحها.\n\n# تسجيل الزيارات\n\nبنسجل زيارات الموقع بشكل مجهول: معرّف عشوائي بيتخزّن على جهازك وصفحة الزيارة فقط، من غير اسم ولا رقم موبايل ولا عنوان IP. الغرض إننا نعرف إيه المنتجات الأكتر مشاهدة ونحسّن المتجر. لو متصفحك مفعّل خاصية \"Do Not Track\" مش بنسجّل زيارتك. البيانات دي بتتمسح تلقائيا بعد 120 يوم.\n\n# استخدام البيانات\n\nبنستخدم بياناتك لتجهيز طلبك وشحنه، وللتواصل معاك بخصوصه، ولمتابعة حالته. مش بنبيع بياناتك لأي حد. بنشاركها بس مع شركة الشحن بالقدر اللازم لتوصيل طلبك.\n\n# ملفات تعريف الارتباط والتخزين المحلي\n\nالموقع بيحفظ على جهازك سلة المشتريات والمعرّف المجهول المذكور فوق. [[لو بتستخدم بيكسل إعلانات (ميتا / تيك توك / جوجل) اذكر ده هنا، ولو مش بتستخدم امسح الجملة دي]]\n\n# حقوقك والتواصل\n\nتقدر تطلب تعديل أو مسح بياناتك في أي وقت عن طريق: [[اكتب رقم الواتساب أو الإيميل اللي هتستقبل عليه الطلبات]]\n\nآخر تحديث: [[اكتب التاريخ]]", "terms": "# الشروط والأحكام\n\nباستخدامك للموقع وإتمام طلب منه، أنت موافق على الشروط دي.\n\n# الطلبات\n\nالطلب بيتأكد بعد مراجعته من المتجر. ممكن نتواصل معاك على رقم الموبايل لتأكيد التفاصيل. بنحتفظ بحق إلغاء الطلب لو المنتج مش متاح أو لو فيه خطأ واضح في السعر أو البيانات، وبنبلّغك بذلك.\n\n# الأسعار\n\nالأسعار بالجنيه المصري. رسوم الشحن بتظهر في صفحة إتمام الطلب حسب المحافظة قبل ما تأكد.\n\n# الدفع\n\nطرق الدفع المتاحة بتظهر في صفحة إتمام الطلب (الدفع عند الاستلام أو التحويل على الأرقام المعروضة). في حالة التحويل، الطلب بيفضل \"بانتظار تأكيد الدفع\" لحد ما المتجر يراجع إيصال التحويل ويأكده.\n\n# الاسترجاع والشحن\n\nتفاصيل الاسترجاع والاستبدال والشحن موجودة في صفحاتها الخاصة بالمتجر.\n\n# بيانات المتجر\n\nاسم المتجر / النشاط: [[اكتب الاسم القانوني للمتجر أو النشاط]]\nوسيلة التواصل: [[اكتب رقم الواتساب أو الإيميل]]\n\n# تعديل الشروط\n\nممكن نعدّل الشروط دي، والنسخة المنشورة على الموقع هي المعمول بها.\n\nآخر تحديث: [[اكتب التاريخ]]", "refund": "# سياسة الاسترجاع والاستبدال\n\n# مدة الاسترجاع\n\nتقدر تطلب استرجاع أو استبدال خلال [[اكتب عدد الأيام]] من استلام الطلب.\n\n# شروط الاسترجاع\n\n[[اكتب حالة المنتج المقبولة للاسترجاع: مثلا غير مستخدم وفي عبوته الأصلية. واكتب أي منتجات مستثناة من الاسترجاع]]\n\n# لو المنتج وصلك بعيب أو غلط\n\n[[اكتب إزاي العميل يبلّغك، وهل المتجر بيتحمل مصاريف الشحن في الحالة دي]]\n\n# طريقة طلب الاسترجاع\n\nكلمنا على [[اكتب رقم الواتساب أو الإيميل]] واكتب رقم الطلب وسبب الاسترجاع.\n\n# رد المبلغ\n\n[[اكتب طريقة ومدة رد المبلغ، وهل مصاريف الشحن بتتردّ]]\n\nآخر تحديث: [[اكتب التاريخ]]", "shipping": "# سياسة الشحن والتوصيل\n\n# مناطق التوصيل\n\nبنوصّل لمحافظات مصر اللي بتظهر في صفحة إتمام الطلب. رسوم الشحن بتتحدد حسب المحافظة وبتظهر قبل ما تأكد طلبك.\n\n# مدة التوصيل\n\n[[اكتب المدة المتوقعة للتوصيل لكل منطقة (مثلا القاهرة والجيزة، باقي المحافظات)]]\n\n# تجهيز الطلب\n\n[[اكتب المدة اللي بيتجهز فيها الطلب قبل الشحن]]\n\n# تتبع الطلب\n\nتقدر تتابع حالة طلبك من صفحة \"تتبع طلبك\" برقم الطلب ورقم الموبايل.\n\n# الاستلام\n\n[[اكتب ملاحظات الاستلام: مثلا الاتصال بالعميل قبل الوصول، وإيه اللي بيحصل لو العميل مردّش]]\n\nآخر تحديث: [[اكتب التاريخ]]"};
const LEGAL_N={privacy:"سياسة الخصوصية",terms:"الشروط والأحكام",refund:"سياسة الاسترجاع والاستبدال",shipping:"سياسة الشحن والتوصيل"};
const lgFl=(e,t,ok)=>{e.textContent=t;e.className=ok?"ok":"msg"};
V.legal=()=>{
 $("view").innerHTML=`<div class="box"><p class="hint">دي مسودات جاهزة بتعدّلها بنفسك. الأماكن اللي بين [[ ]] لازم تتملّى بمعلوماتك الحقيقية (مدة الاسترجاع، مدد التوصيل، بيانات التواصل). الصفحة ما بتتنشرش ولا بتظهر في الفوتر غير لما تشيل كل علامات [[ ]] وتفعّل "نشر". استخدم سطر يبدأ بـ "# " للعنوان الفرعي، وسطر فاضي بين الفقرات.</p></div>`+Object.keys(LEGAL_N).map(k=>{
  const saved=setting("legal_"+k+"_text",""),on=setting("legal_"+k+"_on","")==="1";
  return `<div class="box" data-lg="${k}"><h3>${LEGAL_N[k]} ${on?'<span class="tag">منشورة</span>':'<span class="tag">غير منشورة</span>'}</h3>${saved?"":'<p class="hint">ده قالب مسودة، لسه ما اتحفظش.</p>'}<textarea rows="14" style="width:100%">${esc(saved||LEGAL_T[k])}</textarea><label><input type="checkbox" class="lgon" ${on?"checked":""}> نشر الصفحة (رابط /legal/${k} وتظهر في الفوتر)</label><br><button class="lgsave">حفظ</button> ${on?`<a href="/legal/${k}" target="_blank">فتح الصفحة</a>`:""} <button class="sm gray lgreset">رجّع القالب</button> <span class="lgm"></span></div>`}).join("");
 wire($("view"),".lgsave",b=>b.onclick=async()=>{
  const bx=b.closest("[data-lg]"),k=bx.dataset.lg,t=bx.querySelector("textarea").value.trim(),pub=bx.querySelector(".lgon").checked,m=bx.querySelector(".lgm");
  if(pub&&/\[\[/.test(t))return lgFl(m,"لسه فيه أماكن بين [[ ]] لازم تتملّى أو تتشال قبل النشر");
  if(pub&&!t)return lgFl(m,"اكتب نص الصفحة الأول");
  const rows=[{key:"legal_"+k+"_text",value:t},{key:"legal_"+k+"_on",value:pub?"1":"0"}];
  const {error}=await sb.from("settings").upsert(rows.map(r=>({...r,updated_at:new Date().toISOString()})),{onConflict:"key"});
  if(error)return lgFl(m,"خطأ: "+error.message);rows.forEach(r=>D.settings[r.key]=r.value);lgFl(m,"تم الحفظ (التغيير بيظهر للعملاء خلال 5 دقايق)",true)});
 wire($("view"),".lgreset",b=>b.onclick=()=>{const bx=b.closest("[data-lg]");if(confirm("ترجّع القالب الأصلي في الخانة (مش هيتحفظ غير لما تدوس حفظ)؟"))bx.querySelector("textarea").value=LEGAL_T[bx.dataset.lg]});
};

/* ---------- categories ---------- */
let editC=null;
V.cats=()=>{
 const c=editC||{};
 $("view").innerHTML=`<div class="box"><h3>${editC?"تعديل قسم":"قسم جديد"} (مثال: منظفات، أجهزة كهربائية، أدوات مطبخ)</h3>
 <label>الاسم</label><input id="cn" value="${esc(c.name)}"><label>وصف القسم (يظهر في صفحة القسم ويفيد محركات البحث)</label><textarea id="cd">${esc(c.description)}</textarea>
 <label>صورة (اختياري، تظهر في الرئيسية)</label><input id="cf" type="file" accept="image/*">
 <label><input type="checkbox" id="ca" ${editC?(c.active?"checked":""):"checked"}>ظاهر في المتجر (تعطيله يخفيه تماماً)</label>
 <p class="hint">أماكن ظهور القسم:</p><div class="row"><label><input type="checkbox" id="cH" ${editC&&c.show_home===false?"":"checked"}>الصفحة الرئيسية</label><label><input type="checkbox" id="cM" ${editC&&c.show_menu===false?"":"checked"}>شريط الأقسام العلوي</label><label><input type="checkbox" id="cF" ${editC&&c.show_footer?"checked":""}>الفوتر</label></div>
 <button id="csave">حفظ</button> <button class="gray" id="ccancel">إلغاء</button> <span id="cm"></span></div>
 <div class="box"><p class="hint">استخدم الأسهم لترتيب الأقسام كما تظهر في المتجر.</p><div class="scroll"><table><tr><th>ترتيب</th><th>الاسم</th><th>الرابط</th><th>المنتجات</th><th>ظاهر</th><th>الرئيسية</th><th>الشريط</th><th>الفوتر</th><th></th></tr>
 ${D.cats.map((x,i)=>`<tr><td><button class="sm gray" data-u="${i}">▲</button> <button class="sm gray" data-w="${i}">▼</button></td><td>${esc(x.name)}</td><td dir="ltr">/c/${esc(x.slug||"")}</td><td>${D.products.filter(p=>p.category_id===x.id).length}</td><td>${x.active?"نعم":"لا"}</td>${[["show_home",x.show_home!==false],["show_menu",x.show_menu!==false],["show_footer",x.show_footer===true]].map(f=>`<td><input type="checkbox" class="pl" data-pl="${f[0]}" data-id="${esc(x.id)}" ${f[1]?"checked":""}></td>`).join("")}<td><button class="sm" data-e="${esc(x.id)}">تعديل</button> <button class="sm red" data-d="${esc(x.id)}">حذف</button></td></tr>`).join("")||"<tr><td colspan=9>لا توجد أقسام</td></tr>"}</table></div></div>`;
 $("ccancel").onclick=()=>{editC=null;V.cats()};
 $("csave").onclick=async()=>{try{
  let img=editC?editC.image_url:null;const f=$("cf").files[0];if(f)img=await upload(f,"cats");
  const row={name:$("cn").value.trim(),description:$("cd").value.trim()||null,active:$("ca").checked,show_home:$("cH").checked,show_menu:$("cM").checked,show_footer:$("cF").checked,image_url:img};if(!editC)row.sort_order=D.cats.length*10+10;
  if(!row.name)return flash("cm","الاسم مطلوب");
  const {error}=editC?await sb.from("categories").update(row).eq("id",editC.id):await sb.from("categories").insert(row);
  if(error)throw error;editC=null;await reloadCats();
 }catch(e){flash("cm","خطأ: "+e.message)}};
 document.querySelectorAll("#view .pl").forEach(b=>b.onchange=async()=>{const x=D.cats.find(y=>y.id===b.dataset.id);const {error}=await sb.from("categories").update({[b.dataset.pl]:b.checked}).eq("id",x.id);if(error){b.checked=!b.checked;return alert(error.message)}x[b.dataset.pl]=b.checked});
 const move=async(i,d)=>{const j=i+d;if(j<0||j>=D.cats.length)return;const a=D.cats.slice();[a[i],a[j]]=[a[j],a[i]];
  for(let k=0;k<a.length;k++){const {error}=await sb.from("categories").update({sort_order:(k+1)*10}).eq("id",a[k].id);if(error)return alert(error.message)}await reloadCats()};
 document.querySelectorAll("[data-u]").forEach(b=>b.onclick=()=>move(+b.dataset.u,-1));document.querySelectorAll("[data-w]").forEach(b=>b.onclick=()=>move(+b.dataset.w,1));
 document.querySelectorAll("#view [data-e]").forEach(b=>b.onclick=()=>{editC=D.cats.find(x=>x.id===b.dataset.e);V.cats();scrollTo(0,0)});
 document.querySelectorAll("#view [data-d]").forEach(b=>b.onclick=async()=>{const x=D.cats.find(y=>y.id===b.dataset.d);if(!confirm("حذف القسم "+x.name+"؟ المنتجات تبقى بدون قسم."))return;const {error}=await sb.from("categories").delete().eq("id",x.id);if(error)return alert(error.message);D.products.forEach(p=>{if(p.category_id===x.id)p.category_id=null});await reloadCats()});
};
async function reloadCats(){const {data,error}=await sb.from("categories").select("*").order("sort_order").order("name");if(error)return alert(error.message);D.cats=data;V.cats()}

/* ---------- orders (+ wholesale requests) ---------- */
const oOpen=new Set();let editO=null,showForm=false,totalManual=false,otab="orders";
function itemRow(i={}){return `<div class="item"><div><label>المنتج</label><input class="in-name" list="plist" value="${esc(i.product_name)}" data-pid="${esc(i.product_id||"")}"></div>
 <div><label>الكمية</label><input class="in-qty" type="number" inputmode="numeric" min="1" value="${esc(i.qty||1)}"></div>
 <div><label>سعر القطعة</label><input class="in-price" type="number" inputmode="decimal" value="${esc(i.unit_price??"")}"></div>
 <div><label>التكلفة</label><input class="in-cost" type="number" inputmode="decimal" value="${esc(i.unit_cost??"")}"></div>
 <button class="sm red in-del" type="button">x</button></div>`}
const sumItems=()=>[...document.querySelectorAll(".item")].reduce((s,r)=>s+num(r.querySelector(".in-qty").value)*num(r.querySelector(".in-price").value),0);
const recalc=()=>{if(!totalManual)$("ot").value=sumItems()};
function wireItems(){document.querySelectorAll(".item").forEach(r=>{
 const auto=()=>{const p=D.products.find(x=>String(x.id)===r.querySelector(".in-name").dataset.pid);if(p&&!r.querySelector(".in-price").dataset.m)r.querySelector(".in-price").value=tierPrice(p,num(r.querySelector(".in-qty").value)||1)};
 r.querySelector(".in-name").onchange=e=>{const p=D.products.find(x=>x.name===e.target.value);if(p){e.target.dataset.pid=String(p.id);delete r.querySelector(".in-price").dataset.m;const c=D.costs[String(p.id)];r.querySelector(".in-cost").value=c??"";auto()}else e.target.dataset.pid="";recalc()};
 r.querySelector(".in-qty").oninput=()=>{auto();recalc()};r.querySelector(".in-price").oninput=e=>{e.target.dataset.m=1;recalc()};r.querySelector(".in-cost").oninput=recalc;
 r.querySelector(".in-del").onclick=()=>{r.remove();recalc()}})}
V.orders=()=>{
 $("view").innerHTML=`<div class="sub"><button data-s="orders" class="${otab==="orders"?"on":""}">الطلبات (${D.orders.length})</button><button data-s="wh" class="${otab==="wh"?"on":""}">طلبات الجملة ${newWh()?`(${newWh()} جديد)`:`(${D.wholesale.length})`}</button></div><div id="sv"></div>`;
 document.querySelectorAll(".sub [data-s]").forEach(b=>b.onclick=()=>{otab=b.dataset.s;V.orders()});(otab==="orders"?ordersView:whView)();
};
function payBlock(x){const st=x.payment_status;if(!st||st==="cod")return "";
 return `<div class="opay"><b>الدفع:</b> ${esc(x.payment_method||"")} ${st==="paid"?`<span class="pill" style="background:#16a34a">تم تأكيد الدفع</span>`:`<span class="pill" style="background:#d97706">بانتظار تأكيد الدفع</span>`}${x.payment_ref?`<div dir="ltr">رقم العملية: ${esc(x.payment_ref)}</div>`:""}<div class="oact">${x.payment_proof?`<button class="sm gray" type="button" data-proof="${esc(x.payment_proof)}">عرض صورة التحويل</button>`:""}${st==="paid"?`<button class="sm gray" type="button" data-pay="${esc(x.id)}">إلغاء تأكيد الدفع</button>`:`<button class="sm" type="button" data-pay="${esc(x.id)}">تأكيد استلام الدفع</button>`}</div></div>`}
let otf="",openO=null;
function filteredOrders(){const fs=($("of")||{}).value||"",q=($("oq")||{}).value||"",d1=($("od1")||{}).value||"",d2=($("od2")||{}).value||"",fg=($("og")||{}).value||"";
 return D.orders.filter(o=>(otf!=="unpaid"||o.payment_status==="pending"||o.payment_status==="partial")&&(otf!=="noship"||!o.carrier)&&(!fs||o.status_id===fs)&&(!fg||o.governorate===fg)&&(!pdmy(d1)||o.order_date>=pdmy(d1))&&(!pdmy(d2)||o.order_date<=pdmy(d2))&&(!q||[o.customer_name,o.phone,o.address,String(o.order_no)].some(v=>(v||"").includes(q))))}
function ordersView(){
  if(openO&&D.orders.find(x=>x.id===openO)){return orderPage()}openO=null;
 const fs=($("of")||{}).value||"",q=($("oq")||{}).value||"",d1=($("od1")||{}).value||"",d2=($("od2")||{}).value||"",fg=($("og")||{}).value||"";
 const list=filteredOrders();const o=editO||{};const govs=D.zones.map(z=>z.governorate);
 $("sv").innerHTML=`<datalist id="plist">${D.products.map(p=>`<option value="${esc(p.name)}">`).join("")}</datalist>
 <button id="onew">+ طلب جديد</button>
 <div class="box" id="oform" style="display:${showForm?"block":"none"};margin-top:12px"><h3>${editO?"تعديل طلب رقم "+o.order_no:"طلب جديد"}</h3>
  <div class="row"><div><label>اسم العميل</label><input id="oc" value="${esc(o.customer_name)}"></div><div><label>الموبايل</label><input id="oph" type="tel" value="${esc(o.phone)}"></div></div>
  <div class="row"><div><label>موبايل آخر</label><input id="oph2" type="tel" value="${esc(o.phone2||"")}"></div><div><label>الإيميل</label><input id="oem" type="email" dir="ltr" value="${esc(o.email||"")}"></div></div>
  <div class="row"><div><label>المحافظة</label><select id="ogv"><option value="">-</option>${govs.map(g=>`<option ${g===o.governorate?"selected":""}>${esc(g)}</option>`).join("")}</select></div><div><label>الحالة</label><select id="os">${D.statuses.map(s=>`<option value="${esc(s.id)}" ${(o.status_id||newStatusId())===s.id?"selected":""}>${esc(s.name)}</option>`).join("")}</select></div><div><label>تاريخ الطلب</label>${dIn("odt",dmy(o.order_date||today()))}</div></div>
  <label>العنوان</label><textarea id="oa">${esc(o.address)}</textarea>
  <h4>المنتجات</h4><div id="items">${(o.order_items&&o.order_items.length?o.order_items:[{}]).map(itemRow).join("")}</div><button class="sm gray" id="oadd" type="button">+ إضافة منتج</button>
  <div class="row" style="margin-top:10px"><div><label>الإجمالي المطلوب من العميل (شامل الشحن)</label><input id="ot" type="number" inputmode="decimal" value="${esc(o.total??0)}"></div><div><label>تكلفة الشحن علينا</label><input id="osh" type="number" inputmode="decimal" value="${esc(o.shipping_cost??setting("courier_cost",0))}"></div></div>
  <label>ملاحظات العميل</label><input id="on" value="${esc(o.notes)}"><label>ملاحظاتي على الطلب (داخلية)</label><textarea id="oan" rows="2">${esc(o.admin_notes)}</textarea>
  <button id="osave">حفظ الطلب</button> <button class="gray" id="ocancel">إلغاء</button> <span id="om"></span></div>
  <div class="ostc">${D.statuses.map(t=>{const n=D.orders.filter(o=>o.status_id===t.id).length;return `<button type="button" class="ostcard${fs===t.id?" on":""}" data-sf="${esc(t.id)}" style="border-top:3px solid ${esc(t.color||"#6b7280")}"><b>${n}</b><span>${esc(t.name)}</span></button>`}).join("")}</div>
  <div class="otabs">${[["","الكل"],["unpaid","غير مدفوع"],["noship","بدون شركة شحن"]].map(t=>`<button type="button" data-ot="${t[0]}" class="${otf===t[0]?"on":""}">${t[1]}</button>`).join("")}</div>
 <div class="box"><div class="row"><select id="of"><option value="">كل الحالات</option>${D.statuses.map(s=>`<option value="${esc(s.id)}" ${fs===s.id?"selected":""}>${esc(s.name)}</option>`).join("")}</select><select id="og"><option value="">كل المحافظات</option>${govs.map(g=>`<option ${fg===g?"selected":""}>${esc(g)}</option>`).join("")}</select><input id="oq" placeholder="بحث: اسم / موبايل / رقم الطلب" value="${esc(q)}"><div><label>من</label>${dIn("od1",d1)}</div><div><label>إلى</label>${dIn("od2",d2)}</div></div>
 <p>عدد الطلبات: ${list.length} <button class="sm gray" id="ocsv">تصدير Excel/CSV</button></p>
  ${list.slice(0,100).map(orow).join("")||"<p>لا توجد طلبات</p>"}
 ${list.length>100?`<p>يظهر أحدث 100 طلب. استخدم الفلاتر أو التصدير.</p>`:""}</div>`;
 wireItems();totalManual=!!editO;$("ot").oninput=()=>{totalManual=true};
 $("onew").onclick=()=>{editO=null;showForm=true;ordersView();scrollTo(0,0)};
  document.querySelectorAll("#sv [data-open]").forEach(b=>b.onclick=()=>{openO=b.dataset.open;ordersView();scrollTo(0,0)});
  document.querySelectorAll("#sv [data-sf]").forEach(b=>b.onclick=()=>{const v=b.classList.contains("on")?"":b.dataset.sf;$("of").value=v;ordersView()});
  document.querySelectorAll("#sv [data-ot]").forEach(b=>b.onclick=()=>{otf=b.dataset.ot;ordersView()});
 $("oadd").onclick=()=>{$("items").insertAdjacentHTML("beforeend",itemRow());wireItems()};
 $("ocancel").onclick=()=>{editO=null;showForm=false;ordersView()};$("osave").onclick=saveOrder;
 ["of","og","od1","od2"].forEach(i=>$(i).onchange=ordersView);$("oq").oninput=()=>{const pos=$("oq").selectionStart;ordersView();$("oq").focus();$("oq").setSelectionRange(pos,pos)};
 $("ocsv").onclick=()=>csv("orders-"+today()+".csv",[["رقم","التاريخ","العميل","الموبايل","المحافظة","العنوان","المنتجات","الإجمالي","تكلفة المنتجات","الشحن علينا","الربح","الحالة","المصدر","ملاحظات"],...filteredOrders().map(x=>[x.order_no,dmy(x.order_date),x.customer_name,x.phone,x.governorate,x.address,(x.order_items||[]).map(i=>i.product_name+" × "+i.qty).join(" | "),x.total,itemsCost(x),x.shipping_cost,orderProfit(x),(stOf(x.status_id)||{}).name,x.source,[x.notes,x.admin_notes].filter(Boolean).join(" / ")])]);
 document.querySelectorAll("#sv .ohd").forEach(h=>{const tg=()=>{const id=h.dataset.tg,c=h.parentElement,b=c.querySelector(".obody"),o=!oOpen.has(id);o?oOpen.add(id):oOpen.delete(id);c.classList.toggle("open",o);b.hidden=!o;h.querySelector(".chev").innerHTML=o?"&#9650;":"&#9660;"};h.onclick=tg;h.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();tg()}}});
 document.querySelectorAll(".st").forEach(s=>s.onchange=async()=>{const {error}=await sb.from("orders").update({status_id:s.value}).eq("id",s.dataset.id);if(error)return alert(error.message);D.orders.find(x=>x.id===s.dataset.id).status_id=s.value;drawNav();ordersView()});
 document.querySelectorAll("#sv [data-inv]").forEach(b=>b.onclick=async()=>{const x=D.orders.find(y=>y.id===b.dataset.inv),t0=b.textContent;b.disabled=true;b.textContent="جاري تجهيز الفاتورة...";try{const {data}=await sb.auth.getSession();const r=await fetch("/api/notify-order",{method:"POST",headers:{Authorization:"Bearer "+data.session.access_token,"Content-Type":"application/json"},body:JSON.stringify({order_id:x.id})});if(!r.ok)throw new Error("فشل تجهيز الفاتورة ("+r.status+")");const u=URL.createObjectURL(await r.blob()),a=document.createElement("a");a.href=u;a.download="invoice-"+x.order_no+".pdf";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000)}catch(e){alert(e.message||"فشل")}b.disabled=false;b.textContent=t0});
 document.querySelectorAll("#sv [data-pay]").forEach(b=>b.onclick=async()=>{const x=D.orders.find(y=>y.id===b.dataset.pay),v=x.payment_status==="paid"?"pending":"paid";if(v==="paid"&&!confirm("تأكيد إنك استلمت مبلغ الطلب #"+x.order_no+" ("+fmt(x.total)+" جنيه)؟"))return;const {error}=await sb.from("orders").update({payment_status:v}).eq("id",x.id);if(error)return alert(error.message);x.payment_status=v;ordersView()});
 document.querySelectorAll("#sv [data-proof]").forEach(b=>b.onclick=async()=>{const {data,error}=await sb.storage.from("payment-proofs").createSignedUrl(b.dataset.proof,600);if(error)return alert("تعذر فتح الصورة: "+error.message);b.closest(".oact").insertAdjacentHTML("afterend",`<a href="${esc(data.signedUrl)}" target="_blank" rel="noopener"><img class="proof" src="${esc(data.signedUrl)}" alt="صورة التحويل"></a>`);b.remove()});
 document.querySelectorAll("#sv [data-e]").forEach(b=>b.onclick=()=>{editO=D.orders.find(x=>x.id===b.dataset.e);showForm=true;ordersView();scrollTo(0,0)});
 document.querySelectorAll("#sv [data-d]").forEach(b=>b.onclick=async()=>{const x=D.orders.find(y=>y.id===b.dataset.d);if(!confirm("حذف الطلب #"+x.order_no+"؟"))return;const {error}=await sb.from("orders").delete().eq("id",x.id);if(error)return alert(error.message);D.orders=D.orders.filter(y=>y!==x);drawNav();ordersView()});
}

const dtm=iso=>{if(!iso)return "";const d=new Date(iso),p=n=>String(n).padStart(2,"0");return p(d.getDate())+"/"+p(d.getMonth()+1)+"/"+d.getFullYear()+" "+p(d.getHours())+":"+p(d.getMinutes())};
const payInfo=x=>{const ps=x.payment_status;return ps==="paid"?["تم الدفع","#16a34a"]:ps==="partial"?["مدفوع جزئياً","#d97706"]:ps==="pending"?["بانتظار الدفع","#d97706"]:["عند الاستلام","#6b7280"]};
function orow(x){const s=stOf(x.status_id)||{},its=(x.order_items||[]).filter(i=>Number(i.unit_price)>=0),n=its.reduce((a,i)=>a+Number(i.qty),0),pi=payInfo(x);
 return `<div class="orow" data-open="${esc(x.id)}" role="button" tabindex="0"><div class="or1"><span><b class="on0">#${x.order_no}</b> <b>${esc(x.customer_name)}</b></span><span class="stb" style="background:${esc(s.color||"#6b7280")}">${esc(s.name||"")}</span></div><div class="or2"><span dir="ltr">${esc(dmy(x.order_date))}</span><b>${fmt(x.total)} جنيه</b><span class="pill" style="background:${pi[1]}">${pi[0]}</span><span>${n} قطعة</span><span class="orc">${x.carrier?esc(x.carrier):"لم يُشحن"}</span></div></div>`}
async function orderPage(){
 const x=D.orders.find(y=>y.id===openO),s=stOf(x.status_id)||{},all=x.order_items||[],its=all.filter(i=>Number(i.unit_price)>=0),disc=all.filter(i=>Number(i.unit_price)<0),n=its.reduce((a,i)=>a+Number(i.qty),0),sub=its.reduce((a,i)=>a+Number(i.qty)*Number(i.unit_price),0),discV=disc.reduce((a,i)=>a+Number(i.qty)*Number(i.unit_price),0),ship=Math.max(0,Number(x.total)-sub-discV),pi=payInfo(x),paid=x.payment_status==="paid"?Number(x.total):Number(x.paid_amount||0),wal=Number(x.wallet_used||0),vou=Number(x.voucher_used||0);
 const rest=Math.max(0,Number(x.total)-(x.payment_status==="paid"?Number(x.total):paid+wal+vou));
 $("sv").innerHTML=`<div class="opg"><div class="oph"><button class="sm gray" id="obk" type="button">&rarr; رجوع للطلبات</button><h2 style="margin:8px 0">طلب #${x.order_no} <span class="stb" style="background:${esc(s.color||"#6b7280")}">${esc(s.name||"")}</span></h2><small dir="ltr">${esc(dtm(x.created_at))}</small></div>
 <div class="opgrid"><div class="opmain">
  <div class="box"><h3>المنتجات (${n} قطعة)</h3>${its.map(i=>`<div class="ol">${imgOf(i)?`<img src="${esc(imgOf(i))}" alt="" loading="lazy">`:`<span class="noimg"></span>`}<div class="oln">${esc(i.product_name)}</div><div class="olq" dir="ltr">${i.qty} × ${fmt(i.unit_price)} = <b>${fmt(Number(i.qty)*Number(i.unit_price))}</b></div></div>`).join("")}</div>
  <div class="box"><h3><span class="dot" style="background:${pi[1]}"></span> ${pi[0]}</h3>
   <div class="kv"><span>المجموع الجزئي</span><b>${fmt(sub)} جنيه</b></div>${disc.map(i=>`<div class="kv"><span>${esc(i.product_name)}</span><b>${fmt(Number(i.qty)*Number(i.unit_price))} جنيه</b></div>`).join("")}<div class="kv"><span>الشحن</span><b>${fmt(ship)} جنيه</b></div><div class="kv tt"><span>المجموع</span><b>${fmt(x.total)} جنيه</b></div>
   <div class="kv"><span>وسيلة الدفع</span><b>${esc(x.payment_method||"الدفع عند الاستلام")}</b></div>${vou>0?`<div class="kv"><span>مدفوع بقسيمة${x.voucher_code?" ("+esc(x.voucher_code)+")":""}</span><b>${fmt(vou)} جنيه</b></div>`:""}${wal>0?`<div class="kv"><span>مدفوع من رصيد الحساب</span><b>${fmt(wal)} جنيه</b></div>`:""}<div class="kv"><span>المدفوع (يدوي)</span><b>${fmt(paid)} جنيه</b></div><div class="kv"><span>المتبقي</span><b>${fmt(rest)} جنيه</b></div>
   <div class="oact">${x.payment_status!=="paid"?`<button class="sm" data-pf="full" type="button">مدفوع بالكامل</button><button class="sm gray" data-pf="part" type="button">مدفوع جزئياً</button>`:`<button class="sm gray" data-pf="undo" type="button">إلغاء تأكيد الدفع</button>`}${x.payment_proof?`<button class="sm gray" data-proof="${esc(x.payment_proof)}" type="button">صورة التحويل</button>`:""}</div></div>
  <div class="box"><h3>الشحن</h3><label>شركة الشحن</label><input id="ocar" list="ocarl" value="${esc(x.carrier||"")}" placeholder="اختار أو اكتب اسم الشركة"><datalist id="ocarl"><option value="شحن ذاتي"><option value="Aramex"><option value="Bosta"><option value="MyLerz"></datalist><label style="margin-top:8px">رقم التتبع (لو عندك)</label><input id="otrk" dir="ltr" value="${esc(x.tracking_no||"")}">${x.carrier_status?`<p class="hint">حالة الشحنة من الشركة: <b>${esc(x.carrier_status)}</b></p>`:""}<button class="sm" id="ocars" type="button" style="margin-top:6px">حفظ الشحن</button><p class="hint">العنوان: ${esc(x.governorate||"")} - ${esc(x.address||"")}</p></div>
  <div class="box"><h3>الجدول الزمني والملاحظات</h3><div class="row"><input id="onote" placeholder="أضف ملاحظة أو تعليق"><button class="sm" id="onadd" type="button">إضافة</button></div><div id="otl">جاري التحميل...</div></div>
 </div><div class="opside">
  <div class="box"><h3>بيانات العميل</h3><b>${esc(x.customer_name)}</b>${x.user_id?` <span class="pill" style="background:#2563eb">حساب مسجل</span>`:""}<div dir="ltr" class="ocl">${esc(x.phone||"")} ${x.phone?`<a href="https://wa.me/${esc(String(x.phone).replace(/\D/g,"").replace(/^0/,"20"))}" target="_blank" rel="noopener">واتساب</a>`:""}</div>${x.phone2?`<div dir="ltr" class="ocl">${esc(x.phone2)}</div>`:""}${x.email?`<div dir="ltr" class="ocl">${esc(x.email)}</div>`:""}<hr><small>عنوان الشحن</small><div>${esc(x.governorate||"")}<br>${esc(x.address||"")}</div>${x.notes?`<div class="hint">ملاحظة العميل: ${esc(x.notes)}</div>`:""}</div>
  <div class="box"><h3>حالة الطلب</h3><select id="ost" style="border-color:${esc(s.color||"#ccc")}">${D.statuses.map(t=>`<option value="${esc(t.id)}" ${t.id===x.status_id?"selected":""}>${esc(t.name)}</option>`).join("")}</select>
   <div class="oact" style="margin-top:10px"><button class="sm" data-inv="${esc(x.id)}" type="button">تحميل الفاتورة PDF</button><button class="sm gray" id="oed" type="button">تعديل الطلب</button><button class="sm red" id="odel" type="button">حذف</button></div></div>
 </div></div></div>`;
 const upd=async(patch,msg)=>{const {error}=await sb.from("orders").update(patch).eq("id",x.id);if(error)return alert(error.message);Object.assign(x,patch);orderPage()};
 $("obk").onclick=()=>{openO=null;ordersView();scrollTo(0,0)};
 $("ost").onchange=async e=>{const {error}=await sb.from("orders").update({status_id:e.target.value}).eq("id",x.id);if(error)return alert(error.message);x.status_id=e.target.value;orderPage()};
 $("ocars").onclick=()=>upd({carrier:$("ocar").value.trim()||null,tracking_no:$("otrk").value.trim()||null});
 document.querySelectorAll("#sv [data-pf]").forEach(b=>b.onclick=()=>{const k=b.dataset.pf;if(k==="full"){if(!confirm("تأكيد إنك استلمت كامل مبلغ الطلب #"+x.order_no+" ("+fmt(x.total)+" جنيه)؟"))return;upd({payment_status:"paid",paid_amount:Number(x.total)})}else if(k==="part"){const v=Number(String(prompt("المبلغ المدفوع (جنيه):","")||"").replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)));if(!(v>0&&v<Number(x.total)))return alert("اكتب مبلغ أكبر من صفر وأقل من إجمالي الطلب");upd({payment_status:"partial",paid_amount:v})}else{if(!confirm("إلغاء تأكيد الدفع؟"))return;upd({payment_status:"pending",paid_amount:0})}});
 document.querySelectorAll("#sv [data-proof]").forEach(b=>b.onclick=async()=>{const {data,error}=await sb.storage.from("payment-proofs").createSignedUrl(b.dataset.proof,600);if(error)return alert("تعذر فتح الصورة");window.open(data.signedUrl,"_blank")});
 $("oed").onclick=()=>{editO=x;showForm=true;openO=null;ordersView();scrollTo(0,0)};
 $("odel").onclick=async()=>{if(!confirm("حذف الطلب #"+x.order_no+"؟"))return;const {error}=await sb.from("orders").delete().eq("id",x.id);if(error)return alert(error.message);D.orders=D.orders.filter(y=>y.id!==x.id);openO=null;ordersView()};
 document.querySelectorAll("#sv [data-inv]").forEach(b=>b.onclick=async()=>{const x=D.orders.find(y=>y.id===b.dataset.inv),t0=b.textContent;b.disabled=true;b.textContent="جاري تجهيز الفاتورة...";try{const {data}=await sb.auth.getSession();const r=await fetch("/api/notify-order",{method:"POST",headers:{Authorization:"Bearer "+data.session.access_token,"Content-Type":"application/json"},body:JSON.stringify({order_id:x.id})});if(!r.ok)throw new Error("فشل تجهيز الفاتورة ("+r.status+")");const u=URL.createObjectURL(await r.blob()),a=document.createElement("a");a.href=u;a.download="invoice-"+x.order_no+".pdf";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000)}catch(e){alert(e.message||"فشل")}b.disabled=false;b.textContent=t0});
 const tl=async()=>{const {data,error}=await sb.from("order_events").select("*").eq("order_id",x.id).order("created_at",{ascending:false});$("otl").innerHTML=error?esc(error.message):(data||[]).map(e=>`<div class="tle"><span class="tld ${esc(e.kind)}"></span><div><div>${esc(e.text||"")}</div><small dir="ltr">${esc(dtm(e.created_at))}${e.by_email?" - "+esc(e.by_email):""}</small></div></div>`).join("")||"لا توجد أحداث"};
 tl();
 $("onadd").onclick=async()=>{const t=$("onote").value.trim();if(!t)return;const {error}=await sb.from("order_events").insert({order_id:x.id,kind:"note",text:t,by_email:((await sb.auth.getSession()).data.session||{user:{}}).user.email||null});if(error)return alert(error.message);$("onote").value="";tl()};
}
async function saveOrder(){
 flash("om","جاري الحفظ...",true);
 try{
  const items=[...document.querySelectorAll(".item")].map(r=>({product_id:r.querySelector(".in-name").dataset.pid||null,product_name:r.querySelector(".in-name").value.trim(),qty:Math.max(1,parseInt(r.querySelector(".in-qty").value)||1),unit_price:num(r.querySelector(".in-price").value),unit_cost:num(r.querySelector(".in-cost").value)})).filter(i=>i.product_name);
  const row={customer_name:$("oc").value.trim(),phone:$("oph").value.trim(),phone2:$("oph2").value.trim()||null,email:$("oem").value.trim()||null,governorate:$("ogv").value||null,address:$("oa").value.trim(),notes:$("on").value.trim(),admin_notes:$("oan").value.trim()||null,status_id:$("os").value||null,order_date:pdmy($("odt").value)||today(),total:num($("ot").value),shipping_cost:num($("osh").value)};
  if(!row.customer_name)return flash("om","اسم العميل مطلوب");if(!items.length)return flash("om","أضف منتج واحد على الأقل");
  let id,oldIds=[];
  if(editO){id=editO.id;oldIds=(editO.order_items||[]).map(i=>i.id);const {error}=await sb.from("orders").update(row).eq("id",id);if(error)throw error}
  else{const {data,error}=await sb.from("orders").insert(row).select("id").single();if(error)throw error;id=data.id}
  const {error:ie}=await sb.from("order_items").insert(items.map(i=>({...i,order_id:id})));if(ie)throw ie;
  if(oldIds.length){const {error}=await sb.from("order_items").delete().in("id",oldIds);if(error)throw error}
  const {data:fresh,error:fe}=await sb.from("orders").select("*,order_items(*)").eq("id",id).single();if(fe)throw fe;
  const k=D.orders.findIndex(x=>x.id===id);if(k>=0)D.orders[k]=fresh;else D.orders.unshift(fresh);
  editO=null;showForm=false;drawNav();ordersView();
 }catch(e){flash("om","خطأ: "+e.message)}
}
const WST=["جديد","تم التواصل","تم الاتفاق","مرفوض"];
function whView(){
 $("sv").innerHTML=`<div class="box">${D.wholesale.map(w=>`<div class="ord"><div class="h"><b>${esc(w.name)}</b><span>${esc(String(w.created_at).slice(0,10))}</span></div><div>${esc(w.phone)} <a href="https://wa.me/${esc(w.phone.replace(/\D/g,"").replace(/^0/,"20"))}" target="_blank" rel="noopener">واتساب</a> ${w.business?" - "+esc(w.business):""} ${w.governorate?" - "+esc(w.governorate):""}</div><div style="white-space:pre-wrap">${esc(w.message)}</div>
 <div class="row" style="margin-top:6px"><select data-ws="${esc(w.id)}">${WST.map(s=>`<option ${s===w.status?"selected":""}>${s}</option>`).join("")}</select><input data-wn="${esc(w.id)}" placeholder="ملاحظاتي" value="${esc(w.notes)}"><button class="sm red" data-wd="${esc(w.id)}">حذف</button></div></div>`).join("")||"<p>لا توجد طلبات جملة بعد. الصفحة: /wholesale</p>"}</div>`;
 const upd=async(id,v)=>{const {error}=await sb.from("wholesale_requests").update(v).eq("id",id);if(error)return alert(error.message);Object.assign(D.wholesale.find(x=>x.id===id),v);drawNav()};
 document.querySelectorAll("[data-ws]").forEach(s=>s.onchange=()=>upd(s.dataset.ws,{status:s.value}).then(V.orders));
 document.querySelectorAll("[data-wn]").forEach(s=>s.onchange=()=>upd(s.dataset.wn,{notes:s.value}));
 document.querySelectorAll("[data-wd]").forEach(b=>b.onclick=async()=>{if(!confirm("حذف الطلب؟"))return;const {error}=await sb.from("wholesale_requests").delete().eq("id",b.dataset.wd);if(error)return alert(error.message);D.wholesale=D.wholesale.filter(x=>x.id!==b.dataset.wd);drawNav();V.orders()});
}

/* ---------- reports ---------- */
let rf="",rt="",rinit=false;const monthStart=()=>today().slice(0,8)+"01";
V.reports=()=>{
 if(!rinit){rf=monthStart();rt=today();rinit=true}
 const ok=D.orders.filter(o=>(stOf(o.status_id)||{counts_in_profit:true}).counts_in_profit&&(!rf||o.order_date>=rf)&&(!rt||o.order_date<=rt));
 const rev=ok.reduce((a,o)=>a+Number(o.total),0),cost=ok.reduce((a,o)=>a+itemsCost(o),0),ship=ok.reduce((a,o)=>a+Number(o.shipping_cost),0),profit=rev-cost-ship;
 const grp=kf=>{const m={};ok.forEach(o=>{const k=kf(o),g=m[k]||(m[k]={n:0,rev:0,pf:0});g.n++;g.rev+=Number(o.total);g.pf+=orderProfit(o)});return Object.entries(m).sort((a,b)=>b[0].localeCompare(a[0]))};
 const pm={};ok.forEach(o=>(o.order_items||[]).forEach(i=>{const k=i.product_id||i.product_name,g=pm[k]||(pm[k]={name:i.product_name,q:0,rev:0,pf:0});g.q+=i.qty;g.rev+=i.qty*Number(i.unit_price);g.pf+=i.qty*(Number(i.unit_price)-Number(i.unit_cost))}));
 const pl=Object.values(pm),tbl=(rows,h)=>`<div class="scroll"><table><tr>${h.map(x=>`<th>${x}</th>`).join("")}</tr>${rows.join("")||`<tr><td colspan=${h.length}>لا توجد بيانات</td></tr>`}</table></div>`;
 const days=grp(o=>o.order_date),months=grp(o=>o.order_date.slice(0,7));
 $("view").innerHTML=`<div class="box"><div class="row"><div><label>من</label>${dIn("rf",dmy(rf))}</div><div><label>إلى</label>${dIn("rt",dmy(rt))}</div></div>
 <button class="sm gray" id="r1">هذا الشهر</button> <button class="sm gray" id="r2">آخر 30 يوم</button> <button class="sm gray" id="r3">الكل</button> <button class="sm" id="rcsv">تصدير التقرير CSV</button>
 <p class="hint">الربح = إجمالي الطلب - تكلفة المنتجات - تكلفة الشحن. الحالات غير المحسوبة: ${esc(D.statuses.filter(s=>!s.counts_in_profit).map(s=>s.name).join("، "))||"لا يوجد"} (من الإعدادات).</p></div>
 <div class="stat"><div>الطلبات<b>${ok.length}</b></div><div>المبيعات<b>${fmt(rev)}</b></div><div>التكلفة<b>${fmt(cost)}</b></div><div>الشحن<b>${fmt(ship)}</b></div><div>صافي الربح<b class="${profit>=0?"pos":"neg"}">${fmt(profit)}</b></div></div>
 <div class="box" style="margin-top:14px"><h3>حسب اليوم</h3>${tbl(days.slice(0,60).map(([k,g])=>`<tr><td dir="ltr">${dmy(k)}</td><td>${g.n}</td><td>${fmt(g.rev)}</td><td>${fmt(g.pf)}</td></tr>`),["اليوم","الطلبات","المبيعات","الربح"])}</div>
 <div class="box"><h3>حسب الشهر</h3>${tbl(months.map(([k,g])=>`<tr><td>${k}</td><td>${g.n}</td><td>${fmt(g.rev)}</td><td>${fmt(g.pf)}</td></tr>`),["الشهر","الطلبات","المبيعات","الربح"])}</div>
 <div class="box"><h3>الأكثر مبيعاً</h3>${tbl(pl.slice().sort((a,b)=>b.q-a.q).slice(0,10).map(g=>`<tr><td>${esc(g.name)}</td><td>${g.q}</td><td>${fmt(g.rev)}</td><td>${fmt(g.pf)}</td></tr>`),["المنتج","الكمية","المبيعات","الربح"])}</div>
 <div class="box"><h3>الأكثر ربحاً</h3>${tbl(pl.slice().sort((a,b)=>b.pf-a.pf).slice(0,10).map(g=>`<tr><td>${esc(g.name)}</td><td>${g.q}</td><td>${fmt(g.rev)}</td><td>${fmt(g.pf)}</td></tr>`),["المنتج","الكمية","المبيعات","الربح"])}</div>`;
 const set=(a,b)=>{rf=a;rt=b;V.reports()};
 $("rf").onchange=()=>set(pdmy($("rf").value),pdmy($("rt").value));$("rt").onchange=()=>set(pdmy($("rf").value),pdmy($("rt").value));
 $("r1").onclick=()=>set(monthStart(),today());$("r2").onclick=()=>set(new Date(Date.now()-30*864e5).toISOString().slice(0,10),today());$("r3").onclick=()=>set("","");
 $("rcsv").onclick=()=>csv("report-"+today()+".csv",[["ملخص","الطلبات",ok.length,"المبيعات",rev,"التكلفة",cost,"الشحن",ship,"الربح",profit],[],["اليوم","الطلبات","المبيعات","الربح"],...days.map(([k,g])=>[dmy(k),g.n,g.rev,g.pf]),[],["الشهر","الطلبات","المبيعات","الربح"],...months.map(([k,g])=>[k,g.n,g.rev,g.pf]),[],["المنتج","الكمية","المبيعات","الربح"],...pl.sort((a,b)=>b.q-a.q).map(g=>[g.name,g.q,g.rev,g.pf])]);
};

/* ---------- store look (everything on the home page) ---------- */
const SECS={intro:"بطاقة التعريف بالمتجر (النص الملون)",reviews:"آراء العملاء",chats:"محادثات العملاء (واتساب)",catsecs:"أقسام المنتجات (التي تختارها)",trust:"شريط المميزات (الدفع عند الاستلام...)",featured:"المنتجات المميزة",latest:"أحدث المنتجات",about:"نبذة عن المتجر"};
const BADGE={intro:["<svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"vertical-align:-2px\"><path d=\"M5 6V4h14v2\"/><path d=\"M12 4v16\"/><path d=\"M9 20h6\"/></svg>","تعريف"],reviews:["⭐","آراء"],chats:["💬","محادثات"],catsecs:["<svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"vertical-align:-2px\"><path d=\"M20 12l-8 8-9-9V3h8z\"/><circle cx=\"7.5\" cy=\"7.5\" r=\"1.2\"/></svg>","منتجات"],trust:["<svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"vertical-align:-2px\"><path d=\"M8 6h12M8 12h12M8 18h12\"/><circle cx=\"4\" cy=\"6\" r=\"1\"/><circle cx=\"4\" cy=\"12\" r=\"1\"/><circle cx=\"4\" cy=\"18\" r=\"1\"/></svg>","مميزات"],featured:["<svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"vertical-align:-2px\"><path d=\"M20 12l-8 8-9-9V3h8z\"/><circle cx=\"7.5\" cy=\"7.5\" r=\"1.2\"/></svg>","منتجات"],latest:["<svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"vertical-align:-2px\"><path d=\"M20 12l-8 8-9-9V3h8z\"/><circle cx=\"7.5\" cy=\"7.5\" r=\"1.2\"/></svg>","منتجات"],about:["<svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"vertical-align:-2px\"><path d=\"M5 6V4h14v2\"/><path d=\"M12 4v16\"/><path d=\"M9 20h6\"/></svg>","نبذة"],catrow:["<svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"vertical-align:-2px\"><path d=\"M3 8h18v12H3z\"/><path d=\"M8 8V5h8v3\"/><path d=\"M12 12v4\"/></svg>","مجموعات (صف أقسام)"],cat:["<svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"vertical-align:-2px\"><path d=\"M20 12l-8 8-9-9V3h8z\"/><circle cx=\"7.5\" cy=\"7.5\" r=\"1.2\"/></svg>","منتجات قسم"],text:["<svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"vertical-align:-2px\"><path d=\"M5 6V4h14v2\"/><path d=\"M12 4v16\"/><path d=\"M9 20h6\"/></svg>","نص"],banner:["<svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"vertical-align:-2px\"><path d=\"M6 3h9l4 4v14H6z\"/><path d=\"M9 11h7M9 15h7\"/></svg>","بانر / لافتة"],code:["<svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"vertical-align:-2px\"><path d=\"M8 7l-5 5 5 5M16 7l5 5-5 5\"/></svg>","كود"],video:["<svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"vertical-align:-2px\"><rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M10 9l5 3-5 3z\" fill=\"currentColor\"/></svg>","فيديو"]};
const CUSTOM={code:"كود / HTML",video:"فيديو",catrow:"صف أقسام",cat:"قسم منتجات",text:"نبذة / نص",banner:"بانر صورة"};
let layout=null;
const getLayout=()=>{if(layout)return layout;let j=[];try{j=JSON.parse(setting("home_layout"))}catch(e){}const V2=D.settings.home_layout_v==="2";const keys=Object.keys(SECS);j=(Array.isArray(j)?j:[]).filter(x=>x&&(SECS[x.k]||CUSTOM[x.k]));if(V2){j.forEach(x=>{if(CUSTOM[x.k]&&!x.id)x.id=x.k});return layout=j}if(!j.some(x=>x.k==="chats")){const ai=j.findIndex(x=>x.k==="about");j.splice(ai>=0?ai:j.length,0,{k:"chats",on:true})}const NEWK=["intro","reviews","catsecs"],front=[];keys.forEach(k=>{if(!j.some(x=>x.k===k))(NEWK.includes(k)?front:j).push({k,on:true})});j=[...front,...j];return layout=j};
let lookSub=null;
const INTRO_DEF="متخصصون في توفير جميع أدوات ورفايع المطبخ العصرية بأسعار الجملة الحقيقية من أول قطعة، نجمع لك بين الجودة والخامات والتوفير العالي بدون حد أدنى للشراء.";
const LK=[["logo","🏷️","اللوجو","رفع اللوجو، حجمه، أيقونة المتجر"],["colors","🎨","الألوان","ألوان المتجر والأزرار والخلفية"],["fonts","🔤","الخطوط","اختر خطاً عربياً مع معاينة"],["ticker","📢","شريط الإعلانات","الشريط المتحرك أعلى الموقع"],["hero","🖼️","سلايدر البانر","صور متعددة وأزرار بنصك"],["product","🛍️","عرض المنتجات والقائمة","شكل الكروت وقائمة الأقسام"],["home","🏠","أقسام الصفحة الرئيسية","التعريف، آراء العملاء، أقسام المنتجات، المميزات"],["footer","📄","الفوتر","نص أسفل الموقع"],["contact","📞","بيانات التواصل","واتساب، هاتف، إيميل، عنوان"],["social","🔗","شبكات التواصل","فيسبوك، إنستجرام، تيك توك..."],["chatsx","💬","محادثات العملاء (واتساب)","شات واتساب حقيقي من عملاء: إضافة وتعديل وحذف"],["donemsg","✅","رسالة تأكيد الطلب","النص اللي بيظهر للعميل بعد ما يأكد طلبه"],["maint","🛠️","وضع الصيانة","قفل المتجر مؤقتاً برسالة للزوار"]];
const jparse=(k)=>{try{const a=JSON.parse(D.settings[k]||"[]");return Array.isArray(a)?a:[]}catch(e){return[]}};
const mvArr=(a,i,d)=>{const j=i+d;if(j<0||j>=a.length)return false;[a[i],a[j]]=[a[j],a[i]];return true};
const wire=(root,sel,fn)=>root.querySelectorAll(sel).forEach(fn);
let lkTab="order",lkTabs="";
const homeTabs=cur=>{lkTab=cur;lkTabs=`<div class="sub">${[["order","الترتيب"],["intro","شريط التعريف"],["reviews","آراء العملاء"],["chats","محادثات واتساب"],["cats","أقسام المنتجات"],["trust","المميزات"]].map(t=>`<button type="button" data-ht="${t[0]}" class="${t[0]===cur?"on":""}">${t[1]}</button>`).join("")}</div>`};
function lkPage(title,inner,init,extra,save){
 $("view").innerHTML=`<div id="lk"><p><button class="sm gray" id="lkback" type="button">← رجوع لمظهر المتجر</button></p><h2 style="margin:6px 0 12px">${title}</h2>${lkTabs}${inner}<button id="lsave">${save||"حفظ"}</button> <span id="lm"></span></div>`;
 lkTabs="";wire($("lk"),"[data-ht]",b=>b.onclick=()=>{lkTab=b.dataset.ht;V.look()});
 $("lkback").onclick=()=>{lookSub=null;V.look()};
 init&&init();
 $("lsave").onclick=()=>{const chk=extra&&extra.check&&extra.check();if(chk)return flash("lm",chk);saveBlock($("lk"),"lm",extra&&extra.rows).then(ok=>{if(ok&&extra&&extra.after)extra.after()})};
}
V.look=()=>{
 if(!lookSub){layout=null;lkTab="order";$("view").innerHTML=`<p class="hint">اختر الجزء الذي تريد تعديله. كل جزء له صفحته وزر حفظ خاص به.</p><div class="grid2">${LK.map(c=>`<button class="box lkc" data-lk="${c[0]}" type="button" style="text-align:right;cursor:pointer;background:#fff;color:inherit;border:1px solid var(--line);margin:0"><div style="font-size:28px">${c[1]}</div><b>${c[2]}</b><div class="hint" style="margin:4px 0 0">${c[3]}</div></button>`).join("")}</div>`;
  wire($("view"),"[data-lk]",b=>b.onclick=()=>{lookSub=b.dataset.lk;V.look();scrollTo(0,0)});return}
 LKP[lookSub]();
};
const LKP={
 ticker(){
  const TK=jparse("ticker_items").map(String);if(!TK.length)TK.push("");
  lkPage("شريط الإعلانات المتحرك",`<div class="box"><p class="hint">رسائل تتحرك باستمرار فوق الهيدر من اليمين لليسار، وتتوقف عند اللمس. اكتب ما تريد بنفسك. الشريط متوقف افتراضياً حتى تفعّله.</p>
  <label><input type="checkbox" id="tkon" ${D.settings.ticker_on==="1"?"checked":""} style="width:auto"> تشغيل الشريط</label>
  <div id="tkl"></div><button class="sm gray" id="tkadd" type="button">+ رسالة جديدة</button>
  <div class="row"><div><label>السرعة</label><select data-k="ticker_speed">${[["1","بطيئة"],["2","متوسطة"],["3","سريعة"]].map(o=>`<option value="${o[0]}" ${(D.settings.ticker_speed||"2")===o[0]?"selected":""}>${o[1]}</option>`).join("")}</select></div>${F([["ticker_bg","لون الخلفية","color"],["ticker_fg","لون النص","color"]])}</div>
  <label><input type="checkbox" id="tkdef" style="width:auto" ${D.settings.ticker_bg?"":"checked"}> استخدام ألوان المتجر الأساسية بدل الألوان أعلاه</label></div>`,
  ()=>{const draw=()=>{$("tkl").innerHTML=TK.map((t,i)=>`<div class="lay"><input data-tk="${i}" value="${esc(t)}" maxlength="140" placeholder="اكتب رسالة الشريط هنا"><button class="sm gray" data-tu="${i}" type="button">▲</button><button class="sm gray" data-td="${i}" type="button">▼</button><button class="sm red" data-tx="${i}" type="button">حذف</button></div>`).join("");
    wire($("tkl"),"[data-tk]",e=>e.oninput=()=>{TK[+e.dataset.tk]=e.value});
    wire($("tkl"),"[data-tu]",b=>b.onclick=()=>{if(mvArr(TK,+b.dataset.tu,-1))draw()});wire($("tkl"),"[data-td]",b=>b.onclick=()=>{if(mvArr(TK,+b.dataset.td,1))draw()});
    wire($("tkl"),"[data-tx]",b=>b.onclick=()=>{TK.splice(+b.dataset.tx,1);draw()})};
   $("tkadd").onclick=()=>{TK.push("");draw()};draw()},
  {rows:()=>{const r=[{key:"ticker_items",value:JSON.stringify(TK.map(t=>t.trim()).filter(Boolean))},{key:"ticker_on",value:$("tkon").checked?"1":"0"}];if($("tkdef").checked)r.push({key:"ticker_bg",value:""},{key:"ticker_fg",value:""});return r}})},
 hero(){
  const SL=jparse("hero_slides").map(x=>({img:x.img||"",img2:x.img2||"",alt:x.alt||"",btns:(x.btns||[]).slice(0,2).map(b=>({text:b.text||"",link:b.link||""}))}));
  const isKnown=v=>v==="/"||v==="/products"||v==="/wholesale"||D.cats.some(c=>c.slug&&"/c/"+c.slug===v);
  const linkOpts=sel=>{const base=[["/","الصفحة الرئيسية"],["/products","كل المنتجات"],["/wholesale","طلب جملة"]].concat(D.cats.filter(c=>c.slug).map(c=>["/c/"+c.slug,"قسم: "+c.name]));
   const known=base.some(o=>o[0]===sel);return base.map(o=>`<option value="${esc(o[0])}" ${o[0]===sel?"selected":""}>${esc(o[1])}</option>`).join("")+`<option value="__custom" ${sel&&!known?"selected":""}>رابط آخر...</option>`};
  lkPage("سلايدر البانر",`<div class="box"><p class="hint">كل شريحة: صورة + زر أو زرين بنص من اختيارك ووجهة تختارها. تتحرك تلقائياً وتتوقف عند اللمس، ويمكن سحبها بالإصبع. الصورة الأساسية مربعة للموبايل (يفضّل 1080×1080)، وصورة الكمبيوتر العريضة اختيارية (يفضّل 1920×720).</p><div id="hsl"></div><button class="sm gray" id="hsadd" type="button">+ شريحة جديدة</button>
   <div class="row"><div><label>ثواني بقاء كل شريحة (1 إلى 10)</label><input data-k="hero_interval" inputmode="decimal" value="${esc(D.settings.hero_interval||"2")}"></div></div></div>
   <div class="box"><h3>البانر البسيط (يظهر فقط عند عدم وجود شرائح)</h3>${F([["hero_title","العنوان"],["hero_subtitle","النص"]])}<div class="row">${F([["hero_cta_text","نص الزر"],["hero_cta_link","رابط الزر (مثال /products)","ltr"],["hero_image_url","صورة البانر","img"]])}</div></div>`,
  ()=>{const draw=()=>{$("hsl").innerHTML=SL.map((s,i)=>`<div class="lay" style="display:block"><div class="row" style="align-items:center"><b>شريحة ${i+1}</b><span>${s.img?`<img src="${esc(s.img)}" height="44" alt="">`:"بدون صورة"}</span><button class="sm gray" data-su="${i}" type="button">▲</button><button class="sm gray" data-sd="${i}" type="button">▼</button><button class="sm red" data-sx="${i}" type="button">حذف</button></div>
    <label>الصورة (مربعة للموبايل)</label><input type="file" accept="image/*" data-si="${i}">
    <label>صورة الكمبيوتر العريضة (اختيارية) ${s.img2?`<img src="${esc(s.img2)}" height="30" alt=""> <button class="sm gray" data-s2x="${i}" type="button">إزالة</button>`:""}</label><input type="file" accept="image/*" data-s2="${i}">
    ${[0,1].map(j=>{const b=s.btns[j];if(!b)return j===0||s.btns[0]?`<button class="sm gray" data-sb="${i}" type="button">+ إضافة زر</button>`:"";
     const known=isKnown(b.link)||!b.link;return `<div class="row"><div><label>نص الزر ${j+1}</label><input data-bt="${i}:${j}" value="${esc(b.text)}" maxlength="40"></div><div><label>الوجهة</label><select data-bl="${i}:${j}">${linkOpts(b.link||"/products")}</select><input data-bc="${i}:${j}" dir="ltr" placeholder="/page أو https://..." value="${known?"":esc(b.link)}" style="${known?"display:none":""}"></div><button class="sm red" data-bx="${i}:${j}" type="button">×</button></div>`}).join("")}</div>`).join("")||'<p class="hint">لا توجد شرائح بعد.</p>';
   const q=(s,f)=>wire($("hsl"),s,f);
   q("[data-su]",b=>b.onclick=()=>{if(mvArr(SL,+b.dataset.su,-1))draw()});q("[data-sd]",b=>b.onclick=()=>{if(mvArr(SL,+b.dataset.sd,1))draw()});
   q("[data-sx]",b=>b.onclick=()=>{SL.splice(+b.dataset.sx,1);draw()});q("[data-s2x]",b=>b.onclick=()=>{SL[+b.dataset.s2x].img2="";draw()});
   q("[data-sb]",b=>b.onclick=()=>{SL[+b.dataset.sb].btns.push({text:"",link:"/products"});draw()});
   q("[data-bx]",b=>b.onclick=()=>{const [i,j]=b.dataset.bx.split(":").map(Number);SL[i].btns.splice(j,1);draw()});
   q("[data-bt]",e=>e.oninput=()=>{const [i,j]=e.dataset.bt.split(":").map(Number);SL[i].btns[j].text=e.value});
   q("[data-bl]",e=>{const [i,j]=e.dataset.bl.split(":").map(Number);if(e.value!=="__custom"&&!SL[i].btns[j].link)SL[i].btns[j].link=e.value;
    e.onchange=()=>{const c=document.querySelector(`#hsl [data-bc="${i}:${j}"]`);if(e.value==="__custom"){c.style.display="";SL[i].btns[j].link=c.value}else{c.style.display="none";SL[i].btns[j].link=e.value}}});
   q("[data-bc]",e=>e.oninput=()=>{const [i,j]=e.dataset.bc.split(":").map(Number);SL[i].btns[j].link=e.value.trim()});
   const up=(attr,field)=>q("["+attr+"]",e=>e.onchange=async()=>{const f=e.files[0];if(!f)return;flash("lm","جاري رفع الصورة...",true);try{const sm=await shrink(f);SL[+e.getAttribute(attr)][field]=await upload(sm,"hero");draw();flash("lm","تم رفع الصورة. اضغط حفظ.",true)}catch(x){flash("lm","فشل رفع الصورة")}});
   up("data-si","img");up("data-s2","img2")};
   $("hsadd").onclick=()=>{SL.push({img:"",img2:"",alt:"",btns:[]});draw()};draw()},
  {check:()=>{for(const [i,s] of SL.entries()){if(!s.img)return "الشريحة "+(i+1)+" بدون صورة. ارفع صورة أو احذفها.";
     for(const b of s.btns){if(!b.text.trim()||!b.link)return "الشريحة "+(i+1)+": اكتب نص الزر أو احذفه.";if(!/^(\/(?!\/)|https:\/\/)/.test(b.link))return "الشريحة "+(i+1)+": الرابط لازم يبدأ بـ / أو https://"}}
    const e=$("lk").querySelector('[data-k="hero_interval"]');e.value=String(Math.min(10,Math.max(1,num(e.value)||2)))},
   rows:()=>[{key:"hero_slides",value:JSON.stringify(SL.map(s=>({img:s.img,img2:s.img2,alt:s.alt,btns:s.btns.map(b=>({text:b.text.trim(),link:b.link}))})))}]})},
 intro(){
  homeTabs("intro");lkPage("شريط التعريف بالمتجر",`<div class="box"><p class="hint">شريط ملوّن متحرك تحت البانر. عدّل النص كما تريد أو أوقفه.</p><label><input type="checkbox" id="ion" ${D.settings.intro_on==="0"?"":"checked"} style="width:auto"> إظهار الشريط</label>
   <label>النص</label><textarea data-k="intro_text" rows="4" maxlength="400">${esc(D.settings.intro_text===undefined?INTRO_DEF:D.settings.intro_text)}</textarea></div>`,null,{rows:()=>[{key:"intro_on",value:$("ion").checked?"1":"0"}]})},
 reviews(){
  homeTabs("reviews");const RV=jparse("reviews").map(x=>({img:x.img||"",name:x.name||"",text:x.text||""}));
  lkPage("آراء العملاء",`<div class="box"><p class="hint">ارفع صور محادثات واتساب أو أي صور، أو اكتب الرأي بنفسك. تظهر كشرائط قابلة للسحب. لا يوجد أي رأي جاهز، والقسم يختفي إن كان فارغاً.</p>
   <label>عنوان القسم</label><input data-k="reviews_title" value="${esc(D.settings.reviews_title===undefined?"آراء عملائنا":D.settings.reviews_title)}" maxlength="80"><div id="rvl"></div><button class="sm gray" id="rvadd" type="button">+ رأي جديد</button></div>`,
  ()=>{const draw=()=>{$("rvl").innerHTML=RV.map((r,i)=>`<div class="lay" style="display:block"><div class="row" style="align-items:center"><b>${i+1}</b><span>${r.img?`<img src="${esc(r.img)}" height="56" alt="">`:""}</span><button class="sm gray" data-ru="${i}" type="button">▲</button><button class="sm gray" data-rd="${i}" type="button">▼</button><button class="sm red" data-rx="${i}" type="button">حذف</button></div>
    <label>صورة (اختيارية) ${r.img?`<button class="sm gray" data-rix="${i}" type="button">إزالة الصورة</button>`:""}</label><input type="file" accept="image/*" data-ri="${i}">
    <label>اسم العميل (اختياري)</label><input data-rn="${i}" value="${esc(r.name)}" maxlength="60"><label>نص الرأي (اختياري)</label><textarea data-rt="${i}" rows="2" maxlength="500">${esc(r.text)}</textarea></div>`).join("")||'<p class="hint">لا توجد آراء بعد.</p>';
   const q=(s,f)=>wire($("rvl"),s,f);
   q("[data-ru]",b=>b.onclick=()=>{if(mvArr(RV,+b.dataset.ru,-1))draw()});q("[data-rd]",b=>b.onclick=()=>{if(mvArr(RV,+b.dataset.rd,1))draw()});
   q("[data-rx]",b=>b.onclick=()=>{RV.splice(+b.dataset.rx,1);draw()});q("[data-rix]",b=>b.onclick=()=>{RV[+b.dataset.rix].img="";draw()});
   q("[data-rn]",e=>e.oninput=()=>{RV[+e.dataset.rn].name=e.value});q("[data-rt]",e=>e.oninput=()=>{RV[+e.dataset.rt].text=e.value});
   q("[data-ri]",e=>e.onchange=async()=>{const f=e.files[0];if(!f)return;flash("lm","جاري رفع الصورة...",true);try{const sm=await shrink(f);RV[+e.dataset.ri].img=await upload(sm,"reviews");draw();flash("lm","تم رفع الصورة. اضغط حفظ.",true)}catch(x){flash("lm","فشل رفع الصورة")}})};
   $("rvadd").onclick=()=>{RV.push({img:"",name:"",text:""});draw()};draw()},
  {check:()=>{const i=RV.findIndex(r=>!r.img&&!r.text.trim());if(i>=0)return "الرأي "+(i+1)+" فارغ. أضف صورة أو نصاً أو احذفه."},rows:()=>[{key:"reviews",value:JSON.stringify(RV.map(r=>({img:r.img,name:r.name.trim(),text:r.text.trim()})))}]})},
 chats(){
  homeTabs("chats");const CH=jparse("chats").map(c=>({msgs:(Array.isArray(c.msgs)?c.msgs:[]).map(m=>({d:m.d==="out"?"out":"in",t:m.t||"",tm:m.tm||""}))}));
  lkPage("محادثات العملاء (واتساب)",`<div class="box"><p class="hint">كل محادثة بتظهر كشاشة شات واتساب بشارة "عميل موثّق". كل رسالة إما من العميل (أبيض) أو من المتجر (أخضر). القسم بيظهر في الرئيسية بين الأقسام، وتقدر تخفيه أو تغيّر مكانه من تبويب "الترتيب". اكتب نصوص حقيقية بس.</p>
   <label>عنوان القسم</label><input data-k="chats_title" value="${esc(D.settings.chats_title===undefined?"من محادثات عملاء المتجر":D.settings.chats_title)}" maxlength="100"><label>سطر تحت العنوان</label><input data-k="chats_sub" value="${esc(D.settings.chats_sub===undefined?"آراء وانطباعات حقيقية لعملاء بعد استلام أوردراتهم (اسحب لرؤية المزيد)":D.settings.chats_sub)}" maxlength="160">
   <label><input type="checkbox" id="chon" ${D.settings.chats_on==="0"?"":"checked"}> إظهار القسم في الصفحة الرئيسية</label><div id="chl"></div><button class="sm gray" id="chadd" type="button">+ محادثة جديدة</button></div>`,
  ()=>{const draw=()=>{$("chl").innerHTML=CH.map((c,i)=>`<div class="lay" style="display:block"><div class="row" style="align-items:center"><b>محادثة ${i+1}</b><button class="sm gray" data-cu="${i}" type="button">▲</button><button class="sm gray" data-cd="${i}" type="button">▼</button><button class="sm red" data-cx="${i}" type="button">حذف المحادثة</button></div>
    ${c.msgs.map((m,j)=>`<div class="row" style="align-items:flex-start;margin-top:6px"><select data-md="${i}.${j}"><option value="in" ${m.d==="in"?"selected":""}>العميل</option><option value="out" ${m.d==="out"?"selected":""}>المتجر</option></select><textarea data-mt="${i}.${j}" rows="2" maxlength="600" style="flex:1">${esc(m.t)}</textarea><input data-mm="${i}.${j}" value="${esc(m.tm)}" placeholder="الوقت مثال ١٠:٤٦ ص" maxlength="12" style="max-width:120px"><button class="sm red" data-mx="${i}.${j}" type="button">x</button></div>`).join("")}
    <button class="sm gray" data-ma="${i}" type="button">+ رسالة</button></div>`).join("")||'<p class="hint">لا توجد محادثات.</p>';
   const q=(s,f)=>wire($("chl"),s,f),ix=e=>e.split(".").map(Number);
   q("[data-cu]",b=>b.onclick=()=>{if(mvArr(CH,+b.dataset.cu,-1))draw()});q("[data-cd]",b=>b.onclick=()=>{if(mvArr(CH,+b.dataset.cd,1))draw()});q("[data-cx]",b=>b.onclick=()=>{if(confirm("حذف المحادثة؟")){CH.splice(+b.dataset.cx,1);draw()}});
   q("[data-ma]",b=>b.onclick=()=>{const m=CH[+b.dataset.ma].msgs;m.push({d:m.length&&m[m.length-1].d==="in"?"out":"in",t:"",tm:""});draw()});
   q("[data-mx]",b=>b.onclick=()=>{const[i,j]=ix(b.dataset.mx);CH[i].msgs.splice(j,1);draw()});
   q("[data-md]",e=>e.onchange=()=>{const[i,j]=ix(e.dataset.md);CH[i].msgs[j].d=e.value});q("[data-mt]",e=>e.oninput=()=>{const[i,j]=ix(e.dataset.mt);CH[i].msgs[j].t=e.value});q("[data-mm]",e=>e.oninput=()=>{const[i,j]=ix(e.dataset.mm);CH[i].msgs[j].tm=e.value})};
   $("chadd").onclick=()=>{CH.push({msgs:[{d:"in",t:"",tm:""},{d:"out",t:"",tm:""}]});draw()};draw()},
  {check:()=>{const i=CH.findIndex(c=>!c.msgs.some(m=>m.t.trim()));if(i>=0)return "المحادثة "+(i+1)+" مفيهاش رسايل. اكتب رسالة أو احذفها."},rows:()=>[{key:"chats",value:JSON.stringify(CH.map(c=>({msgs:c.msgs.filter(m=>m.t.trim()).map(m=>({d:m.d,t:m.t.trim(),tm:m.tm.trim()}))})))},{key:"chats_on",value:$("chon").checked?"1":"0"}]})},
 home(){({order:LKP.h_order,trust:LKP.h_trust,intro:LKP.intro,reviews:LKP.reviews,chats:LKP.chats,cats:LKP.h_cats,cgrid:LKP.h_cgrid}[lkTab]||LKP.h_order)()},
 h_order(){
  homeTabs("order");layout=null;const Ly=getLayout();
  const nm=x=>(D.cats.find(c=>c.slug===x)||{}).name||"";const rid=()=>"c"+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
  Ly.forEach(x=>{if(CUSTOM[x.k]&&!x.id)x.id=rid()});
  const OPEN={};const lname=x=>x.k==="catrow"?"صف أقسام: "+((x.items||[]).map(i=>nm(i.slug)).filter(Boolean).join(" + ")||"اختر الأقسام"):x.k==="cat"?"قسم منتجات: "+(nm(x.slug)||"اختر قسم"):x.k==="text"?"نبذة/نص: "+(x.title||"بدون عنوان"):x.k==="banner"?"بانر صورة":x.k==="code"?"كود / HTML":x.k==="video"?"فيديو: "+(x.title||x.url||"بدون رابط"):SECS[x.k];
  lkPage("الصفحة الرئيسية: الأقسام والترتيب",`<div class="box"><p class="hint">اسحب القسم من علامة ⋮⋮ لفوق أو لتحت (أو استخدم الأسهم). تقدر تخفي أو تحذف أي قسم (حتى التعريف وآراء العملاء) وترجعه تاني من "+ إضافة قسم". الشارة بتوضح نوع كل قسم. "تعديل" بيفتح إعدادات القسم. "+ إضافة قسم" بيضيف قسم جديد. البانر المتحرك والشريط العلوي ثابتين في الأعلى. بعد ما تخلص اضغط حفظ.</p><div id="lay"></div><div style="margin-top:10px"><button class="sm" id="addsec" type="button">+ إضافة قسم</button></div><div id="addm" class="box" hidden style="margin-top:8px"><b>اختار نوع القسم اللي تضيفه:</b><div id="addb" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"></div></div><datalist id="lnkl">${["/","/products","/wholesale"].concat(D.cats.filter(c=>c.slug).map(c=>"/c/"+c.slug)).map(v=>`<option value="${esc(v)}">`).join("")}</datalist></div>`,
  ()=>{
   const editor=(x,i)=>{
    const bgT=`<label><input type="checkbox" data-fbg="${i}" ${x.bg?"checked":""} style="width:auto"> لون خلفية للقسم</label> <input type="color" data-f="bg" data-i="${i}" value="${esc(x.bg||"#f3e9df")}" style="width:60px;padding:2px;margin:0">`;
    if(x.k==="cat")return `<label>القسم</label><select data-f="slug" data-i="${i}"><option value="">اختر القسم</option>${D.cats.filter(c=>c.slug).map(c=>`<option value="${esc(c.slug)}" ${c.slug===x.slug?"selected":""}>${esc(c.name)}</option>`).join("")}</select>
     <label>عنوان القسم (اختياري، الافتراضي اسم القسم)</label><input data-f="title" data-i="${i}" maxlength="60" value="${esc(x.title||"")}">
     <div class="row"><div><label>شكل العرض</label><select data-f="layout" data-i="${i}"><option value="grid" ${x.layout!=="scroll"?"selected":""}>شبكة</option><option value="scroll" ${x.layout==="scroll"?"selected":""}>سلايدر أفقي</option></select></div>
     <div><label>منتجات في الصف (موبايل)</label><select data-f="cols" data-i="${i}" data-num="1">${[1,2,3].map(n=>`<option ${n===(+x.cols||2)?"selected":""}>${n}</option>`).join("")}</select></div>
     <div><label>عدد المنتجات</label><select data-f="n" data-i="${i}" data-num="1">${[4,6,8,10,12,16,20,24].map(n=>`<option ${n===(+x.n||8)?"selected":""}>${n}</option>`).join("")}</select></div></div>
     <label><input type="checkbox" data-f="more" data-i="${i}" ${x.more===false?"":"checked"} style="width:auto"> زر "عرض الكل"</label><div>${bgT}</div>`;
    if(x.k==="catrow"){x.items=x.items||[];const n=Math.min(4,Math.max(1,+x.cols||2));while(x.items.length<n)x.items.push({slug:"",t:""});
     return `<label>كام قسم جنب بعض في الصف؟</label><select data-f="cols" data-i="${i}" data-num="1">${[1,2,3,4].map(c=>`<option ${c===n?"selected":""}>${c}</option>`).join("")}</select><label>عنوان فوق الصف (اختياري)</label><input data-f="title" data-i="${i}" maxlength="60" value="${esc(x.title||"")}">`+x.items.slice(0,n).map((it,j)=>`<div class="box" style="margin:8px 0"><b>القسم ${j+1}</b><select data-ci="${i}:${j}"><option value="">اختر القسم</option>${D.cats.filter(c=>c.slug).map(c=>`<option value="${esc(c.slug)}" ${c.slug===it.slug?"selected":""}>${esc(c.name)}</option>`).join("")}</select><input data-ct="${i}:${j}" maxlength="120" placeholder="سطر تعريف قصير تحت القسم (اختياري)" value="${esc(it.t||"")}"></div>`).join("")+`<p class="hint">ضيف تحت الصف قسم "نبذة / نص" أو بانر صورة بالترتيب اللي تحبه. الزائر يدخل القسم من الصورة، أو من زر "متجر" تحت.</p>`}
    if(x.k==="text")return `<label>العنوان</label><input data-f="title" data-i="${i}" maxlength="80" value="${esc(x.title||"")}"><label>النص</label><textarea data-f="body" data-i="${i}" rows="4" maxlength="1500">${esc(x.body||"")}</textarea><div>${bgT}</div>`;
    if(x.k==="code")return `<label>كود HTML / CSS / JavaScript</label><textarea data-f="html" data-i="${i}" dir="ltr" rows="10" maxlength="20000" style="font-family:monospace;font-size:13px">${esc(x.html||"")}</textarea><p class="hint">الكود بيشتغل جوه إطار معزول (sandbox): ما يقدرش يقرا سلة العميل ولا بيانات المتجر ولا يغير باقي الصفحة. الروابط بتفتح في تبويب جديد. محتوى الكود عام (أي حد يشوفه).</p>`;
    if(x.k==="video")return `<label>رابط فيديو يوتيوب</label><input data-f="url" data-i="${i}" dir="ltr" maxlength="200" placeholder="https://www.youtube.com/watch?v=..." value="${esc(x.url||"")}"><label>عنوان فوق الفيديو (اختياري)</label><input data-f="title" data-i="${i}" maxlength="80" value="${esc(x.title||"")}"><p class="hint">يوتيوب بس (youtube.com أو youtu.be). الفيديو بيشتغل جوه الصفحة.</p>`;
    if(x.k==="banner")return `<label>الصورة ${x.img?`<img src="${esc(x.img)}" height="40" alt="">`:""}</label><input type="file" accept="image/*" data-bi="${i}"><label>وصف الصورة (اختياري)</label><input data-f="alt" data-i="${i}" maxlength="120" value="${esc(x.alt||"")}"><label>رابط عند الضغط (اختياري، يبدأ بـ / أو https://)</label><input data-f="link" data-i="${i}" list="lnkl" dir="ltr" value="${esc(x.link||"")}">`;
    return `<p class="hint">القسم ده جاهز ومعموله تعديل من تبويبه فوق (مثلاً: شريط التعريف، آراء العملاء، محادثات واتساب، شبكة الأقسام). هنا تقدر تظهره أو تخفيه وتحركه.</p>`};
   const draw=()=>{$("lay").innerHTML=Ly.map((x,i)=>{const id=x.id||x.k;return `<div class="lay sec-row" data-i="${i}" style="flex-wrap:wrap;align-items:center"><span data-dh="${i}" title="اسحب" style="cursor:grab;touch-action:none;padding:6px 10px;font-size:20px;user-select:none">⋮⋮</span><input type="checkbox" data-on="${i}" ${x.on?"checked":""}><span class="tb" style="background:#f3e9df;border-radius:12px;padding:2px 8px;font-size:12px;white-space:nowrap">${(BADGE[x.k]||["▫️",""])[0]} ${(BADGE[x.k]||["",""])[1]}</span><span style="flex:1;min-width:110px">${esc(lname(x))}</span><button class="sm gray" data-u="${i}" type="button">▲</button><button class="sm gray" data-w="${i}" type="button">▼</button><button class="sm" data-ed="${i}" type="button">تعديل</button><button class="sm red" data-rm="${i}" type="button">حذف</button><div style="flex-basis:100%" ${OPEN[id]?"":"hidden"}>${OPEN[id]?editor(x,i):""}</div></div>`}).join("");
    const q=(sel,f)=>wire($("lay"),sel,f);
    q("[data-on]",c=>c.onchange=()=>{Ly[+c.dataset.on].on=c.checked});q("[data-u]",b=>b.onclick=()=>{if(mvArr(Ly,+b.dataset.u,-1))draw()});q("[data-w]",b=>b.onclick=()=>{if(mvArr(Ly,+b.dataset.w,1))draw()});
    q("[data-ed]",b=>b.onclick=()=>{const x=Ly[+b.dataset.ed],id=x.id||x.k;OPEN[id]=!OPEN[id];draw()});
    q("[data-rm]",b=>b.onclick=()=>{if(confirm("حذف القسم ده من الصفحة الرئيسية؟ تقدر ترجعه تاني من إضافة قسم.")){Ly.splice(+b.dataset.rm,1);draw()}});
    q("[data-f]",e=>{const f=()=>{const x=Ly[+e.dataset.i];x[e.dataset.f]=e.type==="checkbox"?e.checked:e.dataset.num?+e.value:e.value;if(e.dataset.f==="cols"&&x.k==="catrow"){x.items=x.items||[];while(x.items.length<x.cols)x.items.push({slug:"",t:""})}if(e.dataset.f==="bg"&&!document.querySelector(`#lay [data-fbg="${e.dataset.i}"]`).checked)x.bg=""};e.addEventListener(e.tagName==="SELECT"||e.type==="checkbox"?"change":"input",f);if(["slug","title","cols"].includes(e.dataset.f))e.addEventListener("change",()=>draw())});
    q("[data-ci]",e=>e.onchange=()=>{const[i,j]=e.dataset.ci.split(":").map(Number);Ly[i].items[j].slug=e.value;draw()});q("[data-ct]",e=>e.oninput=()=>{const[i,j]=e.dataset.ct.split(":").map(Number);Ly[i].items[j].t=e.value});
    q("[data-fbg]",c=>c.onchange=()=>{const x=Ly[+c.dataset.fbg];x.bg=c.checked?document.querySelector(`#lay [data-f="bg"][data-i="${c.dataset.fbg}"]`).value:""});
    q("[data-bi]",e=>e.onchange=async()=>{const f=e.files[0];if(!f)return;flash("lm","جاري رفع الصورة...",true);try{const sm=await shrink(f);Ly[+e.dataset.bi].img=await upload(sm,"home");draw();flash("lm","تم رفع الصورة. اضغط حفظ.",true)}catch(x){flash("lm","فشل رفع الصورة")}});
    q("[data-dh]",h=>h.onpointerdown=e=>{e.preventDefault();const row=h.closest(".sec-row");h.setPointerCapture(e.pointerId);row.style.opacity=".55";const box=$("lay");
     h.onpointermove=ev=>{const rows=[...box.children].filter(r=>r!==row);const t=rows.find(r=>{const b=r.getBoundingClientRect();return ev.clientY<b.top+b.height/2});if(t){if(row.nextSibling!==t)box.insertBefore(row,t)}else if(box.lastChild!==row)box.appendChild(row)};
     const end=()=>{h.onpointermove=h.onpointerup=h.onpointercancel=null;const order=[...box.children].map(r=>+r.dataset.i);const nl=order.map(i=>Ly[i]);Ly.splice(0,Ly.length,...nl);draw()};h.onpointerup=end;h.onpointercancel=end})};
   const ADDT=[["intro","intro"],["reviews","reviews"],["chats","chats"],["catrow","catrow"],["cat","cat"],["video","video"],["banner","banner"],["text","text"],["code","code"],["featured","featured"],["latest","latest"],["trust","trust"],["about","about"]];
   const ADDL={intro:"بطاقة التعريف",reviews:"آراء العملاء (صور/نص)",chats:"آراء محادثات واتساب",catrow:"صف أقسام (مجموعات)",cat:"منتجات من قسم",video:"فيديو يوتيوب",banner:"بانر صورة",text:"نبذة / نص",code:"كود / HTML",featured:"المنتجات المميزة",latest:"أحدث المنتجات",trust:"شريط المميزات",about:"نبذة عن المتجر"};
   const SINGLE=["intro","reviews","chats","featured","latest","trust","about"];
   const drawAdd=()=>{$("addb").innerHTML=ADDT.filter(([k])=>!SINGLE.includes(k)||!Ly.some(y=>y.k===k)).map(([k])=>`<button class="sm gray" data-add="${k}" type="button">${(BADGE[k]||["",""])[0]} ${ADDL[k]}</button>`).join("");
    wire($("addb"),"[data-add]",b=>b.onclick=()=>{const k=b.dataset.add,x={k,on:true};if(CUSTOM[k])x.id=rid();if(k==="catrow")Object.assign(x,{cols:2,title:"",items:[{slug:"",t:""},{slug:"",t:""}]});if(k==="cat")Object.assign(x,{slug:"",title:"",layout:"grid",cols:2,n:8,more:true,bg:""});if(k==="text")Object.assign(x,{title:"",body:"",bg:""});if(k==="banner")Object.assign(x,{img:"",alt:"",link:""});if(k==="video")Object.assign(x,{url:"",title:""});if(k==="code")Object.assign(x,{html:""});
     const at=Ly.findIndex(y=>y.k==="about");Ly.splice(at>=0?at:Ly.length,0,x);if(CUSTOM[k])OPEN[x.id]=true;$("addm").hidden=true;draw();setTimeout(()=>{const r=document.querySelector(`#lay [data-i="${Ly.indexOf(x)}"]`);r&&r.scrollIntoView({block:"center"})},50)})};
   $("addsec").onclick=()=>{drawAdd();$("addm").hidden=!$("addm").hidden};
   draw()},
  {check:()=>{for(const x of Ly){if(!x.on)continue;if(x.k==="catrow"&&(x.items||[]).slice(0,+x.cols||2).some(i=>!i.slug))return "في صف أقسام فيه خانة قسم فاضية. اختار القسم أو قلل العدد أو احذف الصف.";if(x.k==="cat"&&!x.slug)return "في قسم منتجات من غير ما تختار القسم. اختار القسم أو احذفه.";if(x.k==="code"&&!(x.html||"").trim())return "في قسم كود فاضي. اكتب الكود أو احذفه.";if(x.k==="video"&&!/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/))[A-Za-z0-9_-]{11}/.test(x.url||""))return "رابط الفيديو لازم يكون رابط يوتيوب صحيح.";if(x.k==="banner"&&!x.img)return "في بانر من غير صورة. ارفع صورة أو احذفه.";if(x.k==="banner"&&x.link&&!/^(\/(?!\/)|https:\/\/)/.test(x.link))return "رابط البانر لازم يبدأ بـ / أو https://";if(x.k==="text"&&!(x.title||"").trim()&&!(x.body||"").trim())return "في قسم نص فاضي. اكتب فيه أو احذفه."}},
   rows:()=>[{key:"home_layout",value:JSON.stringify(Ly.map(x=>{const o={...x};if(o.title!=null)o.title=String(o.title).trim();return o}))},{key:"home_layout_v",value:"2"}],after:()=>{layout=null}})},
 h_cats(){
  homeTabs("cats");
  let CS=jparse("home_cat_sections").filter(x=>x&&D.cats.some(c=>c.slug===x.slug)).map(x=>({slug:x.slug,on:true,n:+x.n||8}));
  D.cats.filter(c=>c.slug&&!CS.some(x=>x.slug===c.slug)).forEach(c=>CS.push({slug:c.slug,on:false,n:8}));
  lkPage("أقسام المنتجات في الرئيسية",`<div class="box"><p class="hint">اختر الأقسام (مطبخ، الأكثر رواجاً، تنظيف، أجهزة كهربائية...) التي تظهر منتجاتها في الصفحة الرئيسية، ورتّبها، وحدد عدد المنتجات لكل قسم. تُضاف الأقسام من شاشة "الأقسام".</p><div id="csl"></div></div>`,
  ()=>{const nm=s=>(D.cats.find(c=>c.slug===s)||{}).name||s;
   const d2=()=>{$("csl").innerHTML=CS.map((x,i)=>`<div class="lay"><input type="checkbox" data-co="${i}" ${x.on?"checked":""}><span>${esc(nm(x.slug))}</span><select data-cn="${i}" style="width:auto;margin:0">${[4,6,8,12].map(n=>`<option ${n===x.n?"selected":""}>${n}</option>`).join("")}</select><button class="sm gray" data-cu="${i}" type="button">▲</button><button class="sm gray" data-cd="${i}" type="button">▼</button></div>`).join("")||'<p class="hint">أضف أقساماً من شاشة الأقسام أولاً.</p>';
    wire($("csl"),"[data-co]",c=>c.onchange=()=>{CS[+c.dataset.co].on=c.checked});wire($("csl"),"[data-cn]",c=>c.onchange=()=>{CS[+c.dataset.cn].n=+c.value});
    wire($("csl"),"[data-cu]",b=>b.onclick=()=>{if(mvArr(CS,+b.dataset.cu,-1))d2()});wire($("csl"),"[data-cd]",b=>b.onclick=()=>{if(mvArr(CS,+b.dataset.cd,1))d2()})};d2()},
  {rows:()=>[{key:"home_cat_sections",value:JSON.stringify(CS.filter(x=>x.on).map(x=>({slug:x.slug,n:x.n})))}]})},
 h_cgrid(){
  homeTabs("cgrid");
  let G={cols:2,items:[]};try{const j=JSON.parse(D.settings.home_cat_grid||"null");if(j&&Array.isArray(j.items)){G.cols=[1,2,3].includes(+j.cols)?+j.cols:2;G.items=j.items.filter(x=>x&&D.cats.some(c=>c.slug===x.slug)).map(x=>({slug:x.slug,on:x.on!==false,t:x.t||""}))}}catch(e){}
  const seeded=G.items.length>0;
  D.cats.filter(c=>c.slug&&!G.items.some(x=>x.slug===c.slug)).forEach(c=>G.items.push({slug:c.slug,on:!seeded&&c.show_home!==false,t:""}));
  lkPage("شبكة الأقسام (بالصور)",`<div class="box"><p class="hint">دي الشبكة اللي بتظهر في الصفحة الرئيسية. رتّب الأقسام بالأسهم (فوق/تحت)، اختار كام قسم في الصف، واكتب سطر تعريف قصير تحت كل قسم (اختياري). القسم المقفول مش بيظهر.</p><label>كام قسم في الصف؟</label><select id="gcols" style="width:auto"><option value="1">قسم واحد في الصف</option><option value="2">قسمين في الصف</option><option value="3">3 أقسام في الصف</option></select><div id="gl"></div><p class="hint">الأقسام الجديدة تتضاف من شاشة "الأقسام". أماكن القسم في الشبكة: الصف الأول هو أول عنصرين مثلاً لو اخترت قسمين في الصف.</p></div>`,
  ()=>{$("gcols").value=String(G.cols);$("gcols").onchange=()=>{G.cols=+$("gcols").value};
   const nm=s=>(D.cats.find(c=>c.slug===s)||{}).name||s;
   const d=()=>{$("gl").innerHTML=G.items.map((x,i)=>`<div class="lay" style="flex-wrap:wrap"><input type="checkbox" data-go="${i}" ${x.on?"checked":""}><b>${esc(nm(x.slug))}</b><button class="sm gray" data-gu="${i}" type="button">▲</button><button class="sm gray" data-gd="${i}" type="button">▼</button><input data-gt="${i}" value="${esc(x.t)}" maxlength="120" placeholder="سطر تعريف قصير (اختياري)" style="flex-basis:100%;margin:4px 0 0"></div>`).join("");
    wire($("gl"),"[data-go]",c=>c.onchange=()=>{G.items[+c.dataset.go].on=c.checked});wire($("gl"),"[data-gt]",c=>c.oninput=()=>{G.items[+c.dataset.gt].t=c.value});
    wire($("gl"),"[data-gu]",b=>b.onclick=()=>{if(mvArr(G.items,+b.dataset.gu,-1))d()});wire($("gl"),"[data-gd]",b=>b.onclick=()=>{if(mvArr(G.items,+b.dataset.gd,1))d()})};d()},
  {rows:()=>[{key:"home_cat_grid",value:JSON.stringify({cols:G.cols,items:G.items.map(x=>({slug:x.slug,on:x.on,t:x.t.trim()}))})}]})},
 h_trust(){
  homeTabs("trust");
  lkPage("شريط المميزات",`<div class="box"><p class="hint">مربعات صغيرة في الصفحة الرئيسية. اترك العنوان فارغاً لإخفاء المربع. اكتب فقط ما هو صحيح فعلاً في متجرك.</p>${[1,2,3,4].map(n=>`<div class="row"><div>${F([["trust"+n+"_t","عنوان "+n]])}</div><div>${F([["trust"+n+"_d","وصف "+n]])}</div></div>`).join("")}</div>`)},
 logo(){
  lkPage("اللوجو",`<div class="box">${F([["logo_url","اللوجو (يظهر في أعلى المتجر)","img"]])}
   <label>حجم اللوجو</label><select data-k="logo_size">${[["s","صغير"],["m","متوسط"],["l","كبير"]].map(o=>`<option value="${o[0]}" ${(D.settings.logo_size||"m")===o[0]?"selected":""}>${o[1]}</option>`).join("")}</select>
   ${F([["favicon_url","أيقونة المتجر (تظهر في تبويب المتصفح، مربعة، يفضّل 256×256)","img"]])}
   <p class="hint">إن لم ترفع أيقونة يُستخدم اللوجو. اسم المتجر والشعار النصي يُعدّلان من الإعدادات.</p>${F([["store_name","اسم المتجر"],["tagline","شعار نصي قصير"]])}</div>`)},
 colors(){
  lkPage("ألوان المتجر",`<div class="box"><div class="row">${F([["primary_color","اللون الأساسي (الهيدر والعناوين)","color"],["accent_color","لون الأزرار","color"],["bg_color","لون خلفية الصفحات","color"]])}</div>
   <label><input type="checkbox" id="bgdef" style="width:auto" ${D.settings.bg_color?"":"checked"}> استخدام خلفية المتجر الافتراضية الدافئة</label></div>`,null,{rows:()=>$("bgdef").checked?[{key:"bg_color",value:""}]:[]})},
 fonts(){
  const FN=[["Cairo","Cairo"],["Tajawal","Tajawal"],["Almarai","Almarai"],["IBM Plex Sans Arabic","IBM Plex Sans Arabic"],["Noto Kufi Arabic","Noto Kufi Arabic"],["Changa","Changa"]];
  if(!document.getElementById("fontprev")){const l=document.createElement("link");l.id="fontprev";l.rel="stylesheet";l.href="https://fonts.googleapis.com/css2?"+["Cairo:wght@400;700","Tajawal:wght@400;700","Almarai:wght@400;700","IBM+Plex+Sans+Arabic:wght@400;700","Noto+Kufi+Arabic:wght@400;700","Changa:wght@400;700"].map(f=>"family="+f).join("&")+"&display=swap";document.head.appendChild(l)}
  const cur=FN.some(f=>f[0]===D.settings.font_family)?D.settings.font_family:"Cairo";
  lkPage("الخطوط",`<div class="box"><p class="hint">اختر الخط الذي يناسب متجرك. المعاينة بالأسفل بنفس شكل الخط، واضغط حفظ ليظهر في المتجر.</p>${FN.map(f=>`<label class="lay" style="cursor:pointer;display:block"><input type="radio" name="ff" value="${esc(f[0])}" ${f[0]===cur?"checked":""} style="width:auto"> <b>${esc(f[1])}</b><div style="font-family:'${esc(f[0])}',sans-serif;font-size:20px;margin-top:6px;line-height:1.7">أدوات مطبخ عصرية بأسعار الجملة الحقيقية<br><span style="font-size:15px">طقم أواني ١٢٣٤٥٦ - توصيل لجميع المحافظات</span></div></label>`).join("")}</div>`,null,{rows:()=>[{key:"font_family",value:document.querySelector('input[name=ff]:checked').value}]})},
 product(){
  const sel=(k,list,def)=>`<select data-k="${k}">${list.map(o=>`<option value="${o[0]}" ${(D.settings[k]||def)===o[0]?"selected":""}>${o[1]}</option>`).join("")}</select>`;
  const NX=jparse("nav_extra").map(x=>({text:x.text||"",link:x.link||""}));
  lkPage("عرض المنتجات والقائمة الرئيسية",`<div class="box"><h3>شكل كروت المنتجات</h3>
   <label>عدد المنتجات في الصف على الموبايل</label>${sel("product_cols_mobile",[["2","منتجان بجانب بعض"],["1","منتج واحد كبير"]],"2")}
   <label>شكل صورة المنتج</label>${sel("card_img",[["sq","مربعة"],["tall","طولية (4:5)"]],"sq")}
   <label>حواف الكرت</label>${sel("card_radius",[["m","متوسطة"],["l","دائرية أكثر"],["s","حادة"]],"m")}
   <label>شارة نسبة الخصم</label>${sel("card_badge",[["1","إظهار"],["0","إخفاء"]],"1")}
   <label>سطر سعر الجملة / أقل كمية تحت السعر</label>${sel("card_tier",[["1","إظهار"],["0","إخفاء"]],"1")}</div>
   <div class="box"><h3>القائمة الرئيسية (شريط الأقسام)</h3><p class="hint">أقسام الشريط تُحدَّد من شاشة "الأقسام" (أماكن ظهور القسم). هنا التحكم العام وروابط إضافية.</p>
   <label>شريط الأقسام تحت البحث</label>${sel("nav_chips",[["1","إظهار"],["0","إخفاء"]],"1")}
   <label>رابط "طلب جملة" في الهيدر</label>${sel("nav_wholesale",[["1","إظهار"],["0","إخفاء"]],"1")}
   <label>روابط إضافية في الشريط (حتى 8)</label><div id="nxl"></div><button class="sm gray" id="nxadd" type="button">+ رابط</button></div>`,
  ()=>{const lo=sel=>{const base=[["/","الصفحة الرئيسية"],["/products","كل المنتجات"],["/wholesale","طلب جملة"]].concat(D.cats.filter(c=>c.slug).map(c=>["/c/"+c.slug,"قسم: "+c.name]));return base.map(o=>`<option value="${esc(o[0])}" ${o[0]===sel?"selected":""}>${esc(o[1])}</option>`).join("")};
   const d=()=>{$("nxl").innerHTML=NX.map((x,i)=>`<div class="lay"><input data-nt="${i}" value="${esc(x.text)}" maxlength="30" placeholder="النص"><select data-nl="${i}" style="margin:0">${lo(x.link||"/products")}</select><button class="sm red" data-nx="${i}" type="button">حذف</button></div>`).join("");
    wire($("nxl"),"[data-nt]",e=>e.oninput=()=>{NX[+e.dataset.nt].text=e.value});wire($("nxl"),"[data-nl]",e=>{if(!NX[+e.dataset.nl].link)NX[+e.dataset.nl].link=e.value;e.onchange=()=>{NX[+e.dataset.nl].link=e.value}});wire($("nxl"),"[data-nx]",b=>b.onclick=()=>{NX.splice(+b.dataset.nx,1);d()})};
   $("nxadd").onclick=()=>{if(NX.length<8){NX.push({text:"",link:"/products"});d()}};d()},
  {check:()=>NX.some(x=>!x.text.trim())?"اكتب نص كل رابط إضافي أو احذفه.":"",rows:()=>[{key:"nav_extra",value:JSON.stringify(NX.map(x=>({text:x.text.trim(),link:x.link})))}]})},
 chatsx(){LKP.chats()},
 donemsg(){
  lkPage("رسالة تأكيد الطلب",`<div class="box"><p class="hint">النص ده بيظهر للعميل في شاشة "شكراً" بعد تأكيد الطلب، تحت رقم الطلب وبيانات الدفع. اتركه فاضي لو مش عايز رسالة إضافية. اكتب اللي تعدّ بيه فعلاً بس (مثلاً مدة التوصيل لو متأكد منها).</p>${F([["order_done_msg","رسالة تأكيد الطلب","area"]])}</div><div class="box"><h3>كارت تتبع الطلب (بعد التأكيد)</h3><p class="hint">كارت بثلاث خطوات (تم الشراء، يتم معالجة طلبك، تم التوصيل) بتاريخ الطلب تلقائي، وتحته رابط لتتبع الطلب. عدّل أي نص تحت.</p><label>إظهار الكارت</label><select data-k="ost_on"><option value="1" ${D.settings.ost_on==="0"?"":"selected"}>إظهار</option><option value="0" ${D.settings.ost_on==="0"?"selected":""}>إخفاء</option></select>${F([["ost_banner","الشريط الأحمر (أعلى الكارت)"],["ost_s1","الخطوة 1"],["ost_s2","الخطوة 2"],["ost_s3","الخطوة 3"],["ost_s3d","نص تحت الخطوة 3 (مثال: خلال ... أيام)"],["ost_foot","الملاحظة السفلية"]])}</div><div class="box"><h3>✉️ إيميل تأكيد الطلب للعميل</h3><p class="hint">بيتبعت تلقائياً من إيميل المتجر (Gmail) لإيميل العميل لحظة تأكيد الطلب. الحد اليومي 100 إيميل (حد جوجل المجاني). لو الإيميل فشل الطلب بيتسجل عادي ومبيتأثرش. اكتب اللي تعدّ بيه فعلاً بس.</p><label>الإرسال</label><select data-k="email_on"><option value="0" ${D.settings.email_on==="1"?"":"selected"}>متوقف</option><option value="1" ${D.settings.email_on==="1"?"selected":""}>شغال</option></select>${F([["email_subject","عنوان الإيميل"],["email_body","نص الإيميل","area"]])}<p class="hint">رموز بتتبدّل ببيانات الطلب: <b dir="ltr">{name} {order_no} {date} {items} {subtotal} {shipping} {total} {payment} {address} {governorate} {phone} {phone2} {delivery_time}</b><br>{items} = جدول المنتجات بالكميات والأسعار. {delivery_time} بياخد نص "خلال ... أيام" من كارت تتبع الطلب (الخطوة 3).</p><button class="sm gray" id="empv" type="button">معاينة بمثال</button><div id="emprev" style="margin-top:8px"></div></div>`,()=>{$("empv").onclick=()=>{const g=k=>(document.querySelector(`[data-k="${k}"]`)||{}).value||"";const e=t=>String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");const v={name:"أحمد",order_no:"123",date:"25/11/2026",phone:"01001234567",phone2:"01101234567",address:"المنطقة، الشارع، رقم المبنى",governorate:"القاهرة",payment:"الدفع عند الاستلام",subtotal:"250 جنيه",shipping:"50 جنيه",total:"300 جنيه",delivery_time:D.settings.ost_s3d||""};const it='<table style="width:100%;border-collapse:collapse"><tr style="background:#f6efe6"><th style="padding:6px;text-align:right">المنتج</th><th>الكمية</th><th style="text-align:left">الإجمالي</th></tr><tr><td style="padding:6px;border-bottom:1px solid #eee">منتج تجريبي</td><td style="text-align:center">2</td><td style="text-align:left">250 جنيه</td></tr></table>';const f=(t,h)=>e(t).replace(/\{(\w+)\}/g,(m,k)=>k==="items"?(h?it:"[جدول المنتجات]"):(k in v?e(v[k]):m));$("emprev").innerHTML='<div class="box" style="background:#fff"><b>'+f(g("email_subject"),0)+'</b><hr><div dir="rtl" style="line-height:1.9">'+f(g("email_body"),1).replace(/\n/g,"<br>")+"</div></div>"}})},
 maint(){
  lkPage("وضع الصيانة",`<div class="box"><p class="hint">لما تفعّله، الزوار بيشوفوا صفحة "المتجر في صيانة" بدل المتجر (ممكن يفضل ظاهر لهم لحد 5 دقايق بسبب التخزين المؤقت). لوحة التحكم مش بتتأثر. الطلبات الجاية من متصفح كان فاتح قبلها ممكن تدخل لحد ما يقفل الصفحة.</p><label>الحالة</label><select data-k="maintenance_on"><option value="0" ${D.settings.maintenance_on==="1"?"":"selected"}>المتجر شغال</option><option value="1" ${D.settings.maintenance_on==="1"?"selected":""}>وضع الصيانة مفعّل</option></select>${F([["maintenance_msg","الرسالة اللي بتظهر للزوار","area"]])}</div>`)},
 footer(){
  const FL=jparse("footer_links").map(x=>({text:x.text||"",link:x.link||""}));
  lkPage("الفوتر",`<div class="box">${F([["footer_text","نص الفوتر"]])}<p class="hint">يظهر أسفل كل الصفحات مع الأقسام التي فعّلت لها "الفوتر" وبيانات التواصل وروابط السوشيال.</p></div><div class="box"><h3>روابط إضافية في الفوتر</h3><p class="hint">الرابط لازم يبدأ بـ / (صفحة في المتجر مثل /products) أو https://. الصفحات القانونية بتظهر لوحدها بعد نشرها.</p><div id="fll"></div><button class="sm gray" id="fladd" type="button">+ رابط</button></div>`,
  ()=>{const draw=()=>{$("fll").innerHTML=FL.map((x,i)=>`<div class="row" style="align-items:center;margin-top:6px"><input data-fn="${i}" value="${esc(x.text)}" placeholder="النص" maxlength="40"><input data-fu="${i}" dir="ltr" value="${esc(x.link)}" placeholder="/products أو https://..." maxlength="300"><button class="sm red" data-fx="${i}" type="button">x</button></div>`).join("");
   wire($("fll"),"[data-fn]",e=>e.oninput=()=>{FL[+e.dataset.fn].text=e.value});wire($("fll"),"[data-fu]",e=>e.oninput=()=>{FL[+e.dataset.fu].link=e.value});wire($("fll"),"[data-fx]",b=>b.onclick=()=>{FL.splice(+b.dataset.fx,1);draw()})};$("fladd").onclick=()=>{FL.push({text:"",link:""});draw()};draw()},
  {check:()=>{const b=FL.find(x=>(x.text.trim()||x.link.trim())&&(!x.text.trim()||!/^(\/(?!\/)|https:\/\/)/.test(x.link.trim())));if(b)return "كل رابط محتاج نص ورابط صحيح (يبدأ بـ / أو https://)"},rows:()=>[{key:"footer_links",value:JSON.stringify(FL.filter(x=>x.text.trim()&&x.link.trim()).map(x=>({text:x.text.trim(),link:x.link.trim()})))}]})},
 contact(){
  lkPage("بيانات التواصل",`<div class="box">${F([["whatsapp","رقم الواتساب (دولي بدون +، مثال 201001234567)","ltr"],["contact_phone","رقم الهاتف (يظهر في الفوتر)","ltr"],["contact_email","الإيميل","ltr"],["contact_address","العنوان"]])}</div>`)},
 social(){
  lkPage("شبكات التواصل",`<div class="box"><p class="hint">تظهر في الفوتر كأيقونات. اترك الحقل فارغاً لإخفاء المنصة. الرابط لازم يبدأ بـ https://</p>${F([["facebook_url","فيسبوك","ltr"],["instagram_url","إنستجرام","ltr"],["tiktok_url","تيك توك","ltr"],["youtube_url","يوتيوب","ltr"],["x_url","X (تويتر)","ltr"],["telegram_url","تيليجرام","ltr"],["whatsapp_url","رابط واتساب (اختياري)","ltr"]])}</div>`)}
};

/* ---------- apps (integrations) ---------- */
V.apps=async()=>{
 let sec={};try{const {data}=await sb.rpc("app_secret_status");sec=data||{}}catch(e){}
 const O=location.origin,S=D.settings,isOn=k=>S[k]!=="0",isOn1=k=>S[k]==="1";
 const APPS=[
  {id:"meta",ico:"📘",name:"Meta (فيسبوك وإنستجرام)",desc:"بيكسل + Conversions API لتتبع الشراء وإعلانات فيسبوك وإنستجرام.",on:"app_meta_on",ids:[["meta_pixel_id","Pixel ID (أرقام فقط)","^\\d{5,20}$"]],srv:{on:"app_meta_capi_on",secret:"meta_capi_token",label:"Conversions API (إرسال الشراء من السيرفر)",slabel:"Access Token للـ Conversions API"},extra:[["meta_test_code","Test Event Code (اختياري، للاختبار فقط ثم امسحه)"]],events:"PageView، ViewContent، AddToCart، InitiateCheckout، Purchase (من المتصفح) + Purchase من السيرفر بنفس رقم الحدث لمنع التكرار."},
  {id:"tiktok",ico:"🎵",name:"TikTok",desc:"بيكسل + Events API لتتبع الشراء وإعلانات تيك توك.",on:"app_tiktok_on",ids:[["tiktok_pixel_id","Pixel ID (حروف وأرقام)","^[A-Za-z0-9]{8,30}$"]],srv:{on:"app_tiktok_capi_on",secret:"tiktok_events_token",label:"Events API (إرسال الشراء من السيرفر)",slabel:"Access Token للـ Events API"},events:"PageView، ViewContent، AddToCart، InitiateCheckout، PlaceAnOrder (الشراء) من المتصفح + الشراء من السيرفر بنفس رقم الحدث."},
  {id:"ga",ico:"📊",name:"Google Analytics 4",desc:"تحليلات الزيارات والمبيعات + Measurement Protocol لإرسال الشراء من السيرفر.",on:"app_ga_on",ids:[["ga_id","Measurement ID (يبدأ بـ G-)","^(G|AW)-[A-Za-z0-9-]{4,20}$"]],srv:{on:"app_ga_mp_on",secret:"ga4_api_secret",label:"Measurement Protocol (إرسال الشراء من السيرفر)",slabel:"API Secret"},events:"page_view، view_item، add_to_cart، begin_checkout، purchase."},
  {id:"gtm",ico:"🏷️",name:"Google Tag Manager",desc:"حاوية GTM لإدارة أي أكواد تسويق من غير تعديل المتجر. الأحداث بتتبعت في dataLayer.",on:"app_gtm_on",ids:[["gtm_id","Container ID (يبدأ بـ GTM-)","^GTM-[A-Z0-9]{4,12}$"]],events:"view_item، add_to_cart، begin_checkout، purchase في dataLayer (بصيغة ecommerce بتاعة GA4)."},
  {id:"gmc",ico:"🛍️",name:"Google Merchant Center",desc:"رابط خلاصة المنتجات لعرض منتجاتك في Google Shopping. أضفه في Merchant Center > المنتجات > الخلاصات.",feed:"/feed/google.xml",note:"الخلاصة بتتحدّث تلقائياً من المنتجات النشطة (الاسم، الوصف، السعر، الصورة، التوفر). المنتجات اللي سعرها 1 جنيه (مؤقت) أو من غير صورة بتتستبعد."},
  {id:"cat",ico:"📦",name:"كتالوج Meta و TikTok Shop",desc:"رابط ملف CSV لكتالوج المنتجات. أضفه في Meta Commerce Manager (Data source بالرابط) وفي TikTok Catalog Manager.",feed:"/feed/meta.csv",note:"نفس شروط الاستبعاد. رقم المنتج في الكتالوج هو نفس content_id اللي بيبعته البيكسل."}];
 const badge=a=>{if(a.feed)return ["جاهز","ok"];if(S[a.on]==="0")return ["متوقف","off"];const miss=a.ids.some(i=>!S[i[0]]);return miss?["محتاج بيانات","warn"]:["شغال","ok"]};
 $("view").innerHTML=`<p class="hint">ربط المتجر بأدوات التسويق والتحليل (زي تطبيقات Shopify). كل أداة ليها إعداداتها، وبتشتغل في المتجر بعد الحفظ (التغيير بيظهر للزوار خلال 5 دقايق بسبب التخزين المؤقت). التوكنات السرية بتتخزن في خزنة السيرفر ومش بتظهر تاني ولا بتتبعت للمتصفح.</p><div id="apps">${APPS.map(a=>{const b=badge(a);return `<div class="box app" data-app="${a.id}" style="margin-bottom:12px"><div style="display:flex;align-items:center;gap:10px;cursor:pointer" data-ah="${a.id}"><div style="font-size:28px">${a.ico}</div><div style="flex:1"><b>${a.name}</b><div class="hint" style="margin:2px 0 0">${a.desc}</div></div><span class="pill ${b[1]}" style="padding:3px 10px;border-radius:12px;font-size:12px;background:${b[1]==="ok"?"#dff3e3":b[1]==="warn"?"#fff1cf":"#eee"}">${b[0]}</span></div><div class="abody" data-ab="${a.id}" hidden style="margin-top:10px">${a.feed?`<label>رابط الخلاصة</label><div class="row" style="align-items:center"><input readonly dir="ltr" value="${O}${a.feed}" id="fu_${a.id}"><button class="sm gray" type="button" data-cp="fu_${a.id}">نسخ</button></div><p class="hint">${a.note}</p>`:`<label>الحالة</label><select data-k="${a.on}"><option value="1" ${isOn(a.on)?"selected":""}>مفعّل</option><option value="0" ${isOn(a.on)?"":"selected"}>متوقف</option></select>${a.ids.map(i=>`<label>${i[1]}</label><input data-k="${i[0]}" dir="ltr" value="${esc(S[i[0]]||"")}" data-re="${i[2]}" autocomplete="off">`).join("")}${(a.extra||[]).map(i=>`<label>${i[1]}</label><input data-k="${i[0]}" dir="ltr" value="${esc(S[i[0]]||"")}" autocomplete="off">`).join("")}${a.srv?`<h4 style="margin:12px 0 4px">${a.srv.label}</h4><label>الحالة</label><select data-k="${a.srv.on}"><option value="0" ${isOn1(a.srv.on)?"":"selected"}>متوقف</option><option value="1" ${isOn1(a.srv.on)?"selected":""}>مفعّل</option></select><label>${a.srv.slabel} ${sec[a.srv.secret]?'<b style="color:#2a7a3b">(محفوظ ✓)</b>':'<b style="color:#a66">(غير محفوظ)</b>'}</label><input type="password" id="sc_${a.id}" dir="ltr" autocomplete="new-password" placeholder="${sec[a.srv.secret]?"اكتب قيمة جديدة للتغيير أو سيبه فاضي":"الصق التوكن هنا"}">${sec[a.srv.secret]?`<button class="sm red" type="button" data-sd="${a.id}">مسح التوكن المحفوظ</button>`:""}<p class="hint">التوكن بيتبعت مرة واحدة للسيرفر ويتخزن مشفّر، ومحدش يقدر يشوفه بعد كده.</p>`:""}<p class="hint"><b>الأحداث:</b> ${a.events}</p><button type="button" data-as="${a.id}">حفظ</button> <span id="am_${a.id}"></span>`}</div></div>`}).join("")}</div>`;
 wire($("view"),"[data-ah]",h=>h.onclick=()=>{const b=document.querySelector(`[data-ab="${h.dataset.ah}"]`);b.hidden=!b.hidden});
 wire($("view"),"[data-cp]",b=>b.onclick=async()=>{const i=$(b.dataset.cp);try{await navigator.clipboard.writeText(i.value)}catch(e){i.select();document.execCommand("copy")}b.textContent="تم النسخ";setTimeout(()=>b.textContent="نسخ",1500)});

 {const cw=k=>S[k]??"";const fld=[["cw_phone","واتساب واتصال (رقم بصيغة دولية، مثال 2010XXXXXXXX)",""],["cw_ms","Messenger (رقم الصفحة أو اسمها)",""],["cw_fb","Facebook (رقم الصفحة أو اسمها)",""],["cw_ig","Instagram (اسم الحساب)",""],["cw_tt","TikTok (اسم الحساب بدون @)",""]];
 $("view").insertAdjacentHTML("beforeend",`<div class="box" id="cwbox"><h3>💬 زر التواصل (تواصل معانا)</h3><p class="hint">زر دهبي على يمين المتجر بيفتح أزرار واتساب وماسنجر وفيسبوك وإنستجرام واتصال وتيك توك. أي خانة تسيبها فاضية بتاخد القيمة الافتراضية الظاهرة جواها. لإخفاء الزر كله شيل علامة الإظهار.</p><label class="chk"><input type="checkbox" id="cw_on" ${S.contact_widget==="0"?"":"checked"}> إظهار الزر في المتجر</label>${fld.map(f=>`<label>${f[1]}</label><input data-cw="${f[0]}" dir="ltr" placeholder="${f[2]}" value="${esc(cw(f[0]))}">`).join("")}<button class="sm" id="cw_s" type="button">حفظ</button> <span id="cw_m"></span></div>`);
 $("cw_s").onclick=async()=>{const rows=[{key:"contact_widget",value:$("cw_on").checked?"1":"0"},...[...document.querySelectorAll("[data-cw]")].map(i=>({key:i.dataset.cw,value:i.value.trim().replace(/^@/,"").replace(/^\+/,"")}))];try{const {error}=await sb.from("settings").upsert(rows.map(r=>({...r,updated_at:new Date().toISOString()})));if(error)throw error;rows.forEach(r=>D.settings[r.key]=r.value);flash("cw_m","تم الحفظ، بيظهر في المتجر بعد ريفرش",true)}catch(e){flash("cw_m","خطأ: "+e.message)}}}
 const A=id=>APPS.find(a=>a.id===id);
 wire($("view"),"[data-as]",b=>b.onclick=async()=>{const a=A(b.dataset.as),root=document.querySelector(`[data-ab="${a.id}"]`),m="am_"+a.id;
  const rows=[...root.querySelectorAll("[data-k]")].map(i=>({key:i.dataset.k,value:i.value.trim()}));
  for(const i of root.querySelectorAll("[data-re]")){const v=i.value.trim();if(v&&!new RegExp(i.dataset.re).test(v))return flash(m,"الرقم ده شكله غلط، راجعه من حساب المنصة")}
  const sv=$("sc_"+a.id);flash(m,"جاري الحفظ...",true);
  try{const {error}=await sb.from("settings").upsert(rows.map(r=>({...r,updated_at:new Date().toISOString()})));if(error)throw error;rows.forEach(r=>D.settings[r.key]=r.value);
   if(sv&&sv.value.trim()){const {error:e2}=await sb.rpc("app_secret_set",{p_name:a.srv.secret,p_value:sv.value.trim()});if(e2)throw e2;sv.value=""}
   flash(m,"تم الحفظ",true);setTimeout(()=>V.apps(),700)}catch(e){flash(m,"خطأ: "+e.message)}});
 wire($("view"),"[data-sd]",b=>b.onclick=async()=>{const a=A(b.dataset.sd);if(!confirm("مسح التوكن المحفوظ؟ الإرسال من السيرفر هيتوقف."))return;const {error}=await sb.rpc("app_secret_set",{p_name:a.srv.secret,p_value:""});if(error)return alert(error.message);V.apps()});
};

/* ---------- shipping ---------- */
V.shipping=()=>{
 $("view").innerHTML=`<div class="box" id="shb"><h3>إعدادات الشحن</h3>${F([["free_shipping_min","شحن مجاني للطلبات من (جنيه، 0 = بدون)","num"],["courier_cost","تكلفة الشحن علينا لكل طلب (جنيه، تدخل في حساب الربح)","num"]])}<button id="shs">حفظ</button> <span id="shm"></span></div>
 <div class="box"><h3>سعر الشحن لكل محافظة</h3><p class="hint">يظهر للعميل قبل تأكيد الطلب. المحافظة المعطّلة لا تظهر في الطلب. الأسعار الأولية مؤقتة، عدّلها.</p>
 <div class="row" style="align-items:end"><div><label>تطبيق سعر موحد على الكل</label><input id="zall" type="number" inputmode="decimal"></div><button id="zallb" class="gray">تطبيق</button></div>
 <div class="scroll"><table><tr><th>المحافظة</th><th>السعر</th><th>مفعّلة</th></tr>${D.zones.map(z=>`<tr><td>${esc(z.governorate)}</td><td><input class="zf" data-g="${esc(z.governorate)}" type="number" inputmode="decimal" value="${esc(z.fee)}" style="margin:0"></td><td><input class="za" data-g="${esc(z.governorate)}" type="checkbox" ${z.active?"checked":""}></td></tr>`).join("")}</table></div>
 <button id="zs" style="margin-top:10px">حفظ أسعار المحافظات</button> <span id="zm"></span></div>`;
 $("shs").onclick=()=>saveBlock($("shb"),"shm");
 $("zallb").onclick=()=>document.querySelectorAll(".zf").forEach(i=>i.value=Math.max(0,num($("zall").value)));
 $("zs").onclick=async()=>{try{flash("zm","جاري الحفظ...",true);const rows=D.zones.map(z=>({governorate:z.governorate,sort_order:z.sort_order,fee:Math.max(0,num(document.querySelector(`.zf[data-g="${CSS.escape(z.governorate)}"]`).value)),active:document.querySelector(`.za[data-g="${CSS.escape(z.governorate)}"]`).checked}));
  const {error}=await sb.from("shipping_zones").upsert(rows);if(error)throw error;D.zones=rows;flash("zm","تم الحفظ",true)}catch(e){flash("zm","خطأ: "+e.message)}};
};

V.coupons=async()=>{
 $("view").innerHTML='<div class="box skel"></div><div class="box skel"></div>';
 const {data,error}=await sb.from("coupons").select("*").order("created_at",{ascending:false});
 if(error){$("view").innerHTML=`<div class="box msg">تعذر تحميل الكوبونات: ${esc(error.message)}</div>`;return}
 const act=data.filter(c=>c.active).length;
 const desc=c=>c.kind==="percent"?num(c.value)+"%"+(c.max_discount?" (حد أقصى "+fmt(c.max_discount)+" جنيه)":""):fmt(c.value)+" جنيه";
 $("view").innerHTML=`<div class="box"><h3>العروض وكوبونات الخصم</h3><p class="hint">${act?`عندك ${act} كود مفعّل، وحقل الكوبون ظاهر للعملاء في صفحة إتمام الطلب.`:"مفيش أي كود مفعّل حالياً، فحقل الكوبون مش ظاهر للعملاء. أي كود تضيفه بيفضل متوقف لحد ما تفعّله."} الخصم بيتحسب على ثمن المنتجات (من غير الشحن) ويظهر في الفاتورة والتيليجرام.</p></div>
 <div class="box" id="cpn"><h3 id="chead">إضافة كود جديد</h3>
  <label>الكود (حروف إنجليزي أو أرقام)</label><input id="cc" dir="ltr" maxlength="30" autocomplete="off">
  <label>نوع الخصم</label><select id="ck"><option value="percent">نسبة %</option><option value="fixed">مبلغ ثابت بالجنيه</option></select>
  <label>قيمة الخصم</label><input id="cv" inputmode="decimal">
  <label>أقل قيمة منتجات لتفعيل الكود (جنيه، 0 = بدون)</label><input id="cm" inputmode="decimal" value="0">
  <label>أقصى خصم بالجنيه (للنسبة فقط، اتركه فارغاً = بدون)</label><input id="cx" inputmode="decimal">
  <label>عدد مرات الاستخدام الكلي (فارغ = بدون حد)</label><input id="cu" inputmode="numeric">
  <label>ينتهي يوم (DD/MM/YYYY، فارغ = بدون)</label>${dIn("ce","")}
  <label>اسم العرض / ملاحظة لنفسك (اختياري)</label><input id="cn" maxlength="120">
  <label><input type="checkbox" id="ca" style="width:auto"> تفعيل الكود</label>
  <label><input type="checkbox" id="cauto" style="width:auto"> خصم تلقائي: يتطبق لوحده على أي طلب بيحقق الشروط من غير ما العميل يكتب الكود</label>
  <button id="cadd">إضافة الكود</button> <button id="ccancel" class="gray" type="button" style="display:none">إلغاء التعديل</button> <span id="cm2"></span></div>
 <div class="box"><h3>الأكواد (${data.length})</h3>${data.length?`<div class="scroll"><table><tr><th>الكود</th><th>الخصم</th><th>الشروط</th><th>استُخدم</th><th>مفعّل</th><th></th></tr>${data.map(c=>`<tr><td dir="ltr"><b>${esc(c.code)}</b>${c.auto?" <small>(تلقائي)</small>":""}${c.note?`<br><small>${esc(c.note)}</small>`:""}</td><td>${esc(desc(c))}</td><td>${[c.min_subtotal>0?"من "+fmt(c.min_subtotal)+" جنيه":"",c.expires_at?"ينتهي "+dmy(c.expires_at):"",c.max_uses?"حد "+c.max_uses:""].filter(Boolean).join(" - ")||"-"}</td><td>${c.used_count}</td><td><input type="checkbox" class="ctog" data-c="${esc(c.code)}" ${c.active?"checked":""}></td><td><button class="sm gray cedit" data-c="${esc(c.code)}">تعديل</button> <button class="sm red cdel" data-c="${esc(c.code)}">حذف</button></td></tr>`).join("")}</table></div>`:`<p class="hint">لا توجد أكواد.</p>`}</div>`;
 let editing=null;
 const fillForm=c=>{editing=c?c.code:null;$("cc").value=c?c.code:"";$("cc").disabled=!!c;$("ck").value=c?c.kind:"percent";$("cv").value=c?num(c.value):"";$("cm").value=c?num(c.min_subtotal):"0";$("cx").value=c&&c.max_discount?num(c.max_discount):"";$("cu").value=c&&c.max_uses?c.max_uses:"";$("ce").value=c&&c.expires_at?dmy(c.expires_at):"";$("cn").value=c&&c.note?c.note:"";$("ca").checked=!!(c&&c.active);$("cauto").checked=!!(c&&c.auto);$("chead").textContent=c?"تعديل الكود "+c.code:"إضافة كود جديد";$("cadd").textContent=c?"حفظ التعديل":"إضافة الكود";$("ccancel").style.display=c?"":"none";flash("cm2","",true)};
 $("ccancel").onclick=()=>fillForm(null);
 document.querySelectorAll(".cedit").forEach(x=>x.onclick=()=>{fillForm(data.find(c=>c.code===x.dataset.c));$("cpn").scrollIntoView({behavior:"smooth"})});
 $("cadd").onclick=async()=>{
  const code=$("cc").value.trim().toUpperCase(),kind=$("ck").value,val=num($("cv").value);
  if(!editing&&!/^[A-Z0-9_-]{3,30}$/.test(code))return flash("cm2","الكود لازم 3 حروف أو أرقام إنجليزي على الأقل");
  if(!(val>0)||(kind==="percent"&&val>100))return flash("cm2","اكتب قيمة خصم صحيحة");
  let exp=null;if($("ce").value.trim()){const d=pdmy($("ce").value);if(!d)return flash("cm2","تاريخ الانتهاء غير صحيح");exp=new Date(d+"T23:59:59+02:00").toISOString()}
  const row={code,kind,value:val,min_subtotal:Math.max(0,num($("cm").value)),max_discount:kind==="percent"&&num($("cx").value)>0?num($("cx").value):null,max_uses:num($("cu").value)>0?Math.floor(num($("cu").value)):null,expires_at:exp,active:$("ca").checked,auto:$("cauto").checked,note:$("cn").value.trim()||null};
  flash("cm2","جاري الحفظ...",true);
  if(editing){const {code:_c,...upd}=row;const {error:e2}=await sb.from("coupons").update(upd).eq("code",editing);if(e2)return flash("cm2","خطأ: "+e2.message);return V.coupons()}
  const {error}=await sb.from("coupons").insert(row);
  if(error)return flash("cm2",/duplicate/.test(error.message)?"الكود موجود بالفعل":"خطأ: "+error.message);V.coupons()};
 document.querySelectorAll(".ctog").forEach(x=>x.onchange=async()=>{const {error}=await sb.from("coupons").update({active:x.checked}).eq("code",x.dataset.c);if(error){alert("خطأ: "+error.message)}V.coupons()});
 document.querySelectorAll(".cdel").forEach(x=>x.onclick=async()=>{if(!confirm("حذف الكود "+x.dataset.c+"؟"))return;const {error}=await sb.from("coupons").delete().eq("code",x.dataset.c);if(error)alert("خطأ: "+error.message);V.coupons()});
};

/* ---------- settings ---------- */
const stRow=s=>`<div class="row st-row" data-id="${esc(s.id)}" style="align-items:end"><div><label>الاسم</label><input class="sn" value="${esc(s.name)}"></div><div style="flex:0 0 70px;min-width:70px"><label>اللون</label><input class="sc" type="color" value="${esc(s.color)}"></div><div style="flex:0 0 80px;min-width:80px"><label>الترتيب</label><input class="so" type="number" value="${esc(s.sort_order)}"></div><div style="flex:0 0 130px;min-width:130px"><label><input class="sp" type="checkbox" ${s.counts_in_profit?"checked":""}>تُحسب في الأرباح</label></div><button class="sm red sdel" type="button">حذف</button></div>`;
V.settings=()=>{
 $("view").innerHTML=`<div id="sb1"><div class="box"><h3>التواصل</h3>${F([["whatsapp","رقم الواتساب (دولي بدون +، مثال 201001234567)","ltr"],["contact_phone","رقم الهاتف (يظهر في الفوتر)","ltr"],["contact_email","الإيميل","ltr"],["contact_address","العنوان"],["facebook_url","رابط فيسبوك","ltr"],["instagram_url","رابط إنستجرام","ltr"],["tiktok_url","رابط تيك توك","ltr"],["youtube_url","رابط يوتيوب","ltr"],["x_url","رابط إكس (تويتر)","ltr"],["telegram_url","رابط تيليجرام","ltr"],["whatsapp_url","رابط واتساب (اختياري)","ltr"]])}<p class="hint">تظهر الروابط في الفوتر كأيقونات بشعار كل منصة. اترك الحقل فارغاً لإخفاء المنصة. الرابط لازم يبدأ بـ https://</p></div>
 <div class="box"><h3>السياسات والسيو</h3>${F([["return_policy","سياسة الاسترجاع (اكتبها بنفسك، تظهر في المتجر)","area"],["seo_description","وصف المتجر لمحركات البحث","area"],["site_url","عنوان الموقع الرسمي (مثال https://example.com)","ltr"]])}</div>
 <div class="box"><h3>البيكسل والتحليلات</h3><p class="hint">اترك الحقل فارغاً لإيقافه.</p>${F([["meta_pixel_id","Meta Pixel ID (أرقام فقط)","ltr"],["tiktok_pixel_id","TikTok Pixel ID","ltr"],["ga_id","Google Analytics ID (يبدأ بـ G-)","ltr"]])}</div>
 <button id="sset">حفظ</button> <span id="sm"></span></div>
 <div class="box" id="pmbox" style="margin-top:14px"><h3>طرق الدفع</h3><p class="hint">أضف كل طريقة دفع (الدفع عند الاستلام، InstaPay، محفظة إلكترونية). الطريقة المتوقفة أو اللي مفيهاش رقم/عنوان ما بتظهرش للعميل. لو مفيش أي طريقة مفعّلة، المتجر بيشتغل بالدفع عند الاستلام فقط. الطلب اللي بيتدفع بتحويل بيتسجل "بانتظار تأكيد الدفع" لحد ما تأكده من صفحة الطلبات.</p><div id="pmlist">${pmList().map(pmRow).join("")}</div><button class="sm gray" id="pmadd" type="button">+ طريقة دفع</button> <button id="pmsave" type="button">حفظ طرق الدفع</button> <span id="pmm"></span></div>
 <div class="box" style="margin-top:14px"><h3>حالات الطلبات</h3><p class="hint">أول حالة في القائمة (حسب الترتيب) تُعطى للطلبات القادمة من الموقع.</p><div id="stlist">${D.statuses.map(stRow).join("")}</div><button class="sm gray" id="stadd">+ حالة جديدة</button> <button id="stsave">حفظ الحالات</button> <span id="stm"></span>
 <p class="hint">"تُحسب في الأرباح": ألغِ العلامة للحالات التي لا تدخل في المبيعات (مثل ملغي). لا يمكن حذف حالة مستخدمة في طلبات.</p></div>`;
 $("sset").onclick=()=>saveBlock($("sb1"),"sm");
 $("pmadd").onclick=()=>{$("pmlist").insertAdjacentHTML("beforeend",pmRow({id:"",kind:"instapay",name:"InstaPay",detail:"",note:"",on:false}));wirePm()};$("pmsave").onclick=savePm;wirePm();
 $("stadd").onclick=()=>{$("stlist").insertAdjacentHTML("beforeend",stRow({id:"",name:"",color:"#6b7280",sort_order:D.statuses.length+1,counts_in_profit:true}));wireSt()};$("stsave").onclick=saveStatuses;wireSt();
};
const PM_KINDS=[["cod","الدفع عند الاستلام"],["instapay","InstaPay"],["wallet","محفظة إلكترونية"],["other","تحويل آخر"]];
function pmList(){try{const a=JSON.parse(setting("payment_methods","[]"));if(Array.isArray(a)&&a.length)return a}catch(e){}return [{id:"cod",kind:"cod",name:"الدفع عند الاستلام",detail:"",note:"",on:true}]}
const pmRow=m=>`<div class="box pm-row" data-id="${esc(m.id)}"><div class="row"><div><label>النوع</label><select class="pk">${PM_KINDS.map(k=>`<option value="${k[0]}" ${k[0]===m.kind?"selected":""}>${k[1]}</option>`).join("")}</select></div><div><label>الاسم اللي يظهر للعميل</label><input class="pn" maxlength="40" value="${esc(m.name)}"></div></div><label>رقم المحفظة / عنوان الدفع (IPA)</label><input class="pd" dir="ltr" maxlength="120" value="${esc(m.detail||"")}"><label>ملاحظة للعميل (اختياري)</label><input class="pt" maxlength="200" value="${esc(m.note||"")}"><label><input type="checkbox" class="po" style="width:auto" ${m.on?"checked":""}> مفعّلة</label> <button class="sm red pdel" type="button">حذف</button></div>`;
function wirePm(){document.querySelectorAll(".pdel").forEach(b=>b.onclick=()=>b.closest(".pm-row").remove())}
async function savePm(){
 try{const rows=[...document.querySelectorAll(".pm-row")].map(r=>({id:r.dataset.id||"m"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),kind:r.querySelector(".pk").value,name:r.querySelector(".pn").value.trim(),detail:r.querySelector(".pd").value.trim(),note:r.querySelector(".pt").value.trim(),on:r.querySelector(".po").checked}));
  for(const m of rows){if(!m.name)return flash("pmm","اكتب اسم لكل طريقة دفع");if(m.kind!=="cod"&&m.on&&!m.detail)return flash("pmm","اكتب الرقم أو العنوان لـ "+m.name+" قبل تفعيلها")}
  const value=JSON.stringify(rows);const {error}=await sb.from("settings").upsert({key:"payment_methods",value},{onConflict:"key"});if(error)throw error;D.settings.payment_methods=value;flash("pmm","تم الحفظ (التغيير بيظهر للعملاء خلال 5 دقايق)",true)
 }catch(e){flash("pmm","خطأ: "+e.message)}
}
function wireSt(){document.querySelectorAll(".sdel").forEach(b=>b.onclick=async()=>{const r=b.closest(".st-row"),id=r.dataset.id;if(id){if(!confirm("حذف هذه الحالة؟"))return;const {error}=await sb.from("order_statuses").delete().eq("id",id);if(error)return alert("لا يمكن الحذف (ربما مستخدمة في طلبات): "+error.message);D.statuses=D.statuses.filter(s=>s.id!==id)}r.remove()})}
async function saveStatuses(){
 try{const rows=[...document.querySelectorAll(".st-row")].map(r=>({id:r.dataset.id,name:r.querySelector(".sn").value.trim(),color:r.querySelector(".sc").value,sort_order:parseInt(r.querySelector(".so").value)||0,counts_in_profit:r.querySelector(".sp").checked})).filter(r=>r.name);
  for(const r of rows){const {id,...v}=r;const {error}=id?await sb.from("order_statuses").update(v).eq("id",id):await sb.from("order_statuses").insert(v);if(error)throw error}
  const {data,error}=await sb.from("order_statuses").select("*").order("sort_order");if(error)throw error;D.statuses=data;V.settings();flash("stm","تم الحفظ",true);drawNav()
 }catch(e){flash("stm","خطأ: "+e.message)}
}
start();
