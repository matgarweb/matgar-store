/* Bulk product import from a CSV file. Runs in the dashboard, uses the admin's own login (RLS),
   nothing is sent anywhere else. Depends on admin.js globals: D, sb, $, esc, flash, num, V, sanitizeHtml. */
let impMode=false,IMP=null;
const MARKETING=/عروض|تخفيض|ترندي|الأكثر|اكثر|خصم|offer|sale|trend|best/i;
function parseCSV(t){
 t=String(t).replace(/^\uFEFF/,"");const rows=[];let row=[],f="",q=false;
 for(let i=0;i<t.length;i++){const c=t[i];
  if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=c}
  else if(c==='"')q=true;
  else if(c===","){row.push(f);f=""}
  else if(c==="\n"||c==="\r"){if(c==="\r"&&t[i+1]==="\n")i++;row.push(f);f="";if(row.length>1||row[0]!=="")rows.push(row);row=[]}
  else f+=c}
 if(f!==""||row.length){row.push(f);if(row.length>1||row[0]!=="")rows.push(row)}
 return rows}
const AL={handle:["handle","slug"],title:["title","name","الاسم"],desc:["description","الوصف"],sku:["sku"],qty:["quantity","qty","stock"],price:["regular price","price","السعر"],sale:["sale price","sale_price"],cost:["cost","cost price","التكلفة"],images:["images","image","الصور"],status:["status"],coll:["collections","collection","categories","category"]};
const toNum=s=>{s=String(s||"").trim().replace(/[\u0660-\u0669]/g,d=>d.charCodeAt(0)-0x660).replace(/,/g,"");return s===""?NaN:Number(s)};
const mkSlug=h=>(String(h||"").toLowerCase().replace(/[\u064B-\u065F\u0640]/g,"").replace(/[^a-z0-9\u0621-\u063A\u0641-\u064A\u0660-\u0669\u066E-\u06D3]+/g,"-").replace(/^-+|-+$/g,"")||"").slice(0,80);
const stockOf=q=>{q=String(q||"").trim().toLowerCase();if(q==="")return true;if(/^(available|in stock|متوفر|instock)$/.test(q))return true;if(/^(out of stock|unavailable|sold out|نفذ|نفذت|غير متوفر)$/.test(q))return false;const n=toNum(q);return isNaN(n)?true:n>0};
function impAnalyze(){
 const R=IMP.rows,H=R[0].map(h=>h.trim().toLowerCase()),col={};
 for(const k in AL){const i=H.findIndex(h=>AL[k].includes(h));col[k]=i}
 IMP.col=col;IMP.items=[];IMP.fatal=null;
 if(col.title<0||col.price<0){IMP.fatal="الملف لازم يحتوي أعمدة Title و Regular Price على الأقل. الأعمدة الموجودة: "+R[0].join(" | ");return}
 const g=(r,k)=>col[k]<0?"":(r[col[k]]||"").trim();
 const seen=new Map(),bySku=new Map(),bySlug=new Map();
 D.products.forEach(p=>{if(p.sku)bySku.set(String(p.sku).trim(),p);if(p.slug)bySlug.set(p.slug,p)});
 const colls=new Map();
 R.slice(1).forEach((r,ix)=>{
  const it={line:ix+2,errors:[],warnings:[],action:"new"};IMP.items.push(it);
  const title=g(r,"title"),handle=g(r,"handle"),sku=g(r,"sku");
  it.title=title;it.handle=handle;it.sku=sku;
  if(!title){const dup=handle&&seen.has(handle);if(dup){it.action="skip";it.warnings.push("صف إضافي لنفس المنتج (خيارات/variants) تم تجاهله");return}it.errors.push("الاسم (Title) فارغ")}
  const key=handle||title;if(seen.has(key)&&title){it.action="skip";it.warnings.push("مكرر داخل الملف (نفس الـ Handle)، استُخدم أول صف");return}seen.set(key,1);
  const price=toNum(g(r,"price"));if(isNaN(price)||price<=0)it.errors.push("السعر غير صحيح: "+(g(r,"price")||"فارغ"));
  if(!isNaN(price)&&price>0&&price<=1)it.warnings.push("السعر "+price+" جنيه فقط، تأكد أنه صحيح في الملف");
  let sale=toNum(g(r,"sale"));if(isNaN(sale)||sale<=0)sale=null;else if(sale>=price){it.warnings.push("سعر الخصم أكبر من أو يساوي السعر، تم تجاهله");sale=null}
  let cost=toNum(g(r,"cost"));if(isNaN(cost)||cost<0)cost=null;
  const imgs=g(r,"images").split(/\s+/).filter(Boolean),good=imgs.filter(u=>/^https:\/\//i.test(u));
  if(imgs.length>good.length)it.warnings.push((imgs.length-good.length)+" رابط صورة غير صالح (ليس https) تم تجاهله");
  if(good.length>12)it.warnings.push("أكثر من 12 صورة، أُخذت أول 12");
  if(!good.length)it.warnings.push("بدون صور");
  const st=g(r,"status").toUpperCase();
  const raw=g(r,"desc");let desc=raw?sanitizeHtml(raw).replace(/<p>(\s|&nbsp;)*<\/p>/g,"").trim():"";if(!toText(desc)&&!/<img/.test(desc))desc="";
  if(raw.length>30000)it.warnings.push("الوصف طويل جداً وسيُقص عند 30000 حرف");
  const cl=g(r,"coll").split(",").map(x=>x.trim()).filter(Boolean);cl.forEach(c=>colls.set(c,(colls.get(c)||0)+1));
  const slug=mkSlug(handle);
  const ex=(sku&&bySku.get(sku))||(slug&&bySlug.get(slug))||null;
  Object.assign(it,{price,sale,cost,imgs:good.slice(0,12),active:st!=="DRAFT"&&st!=="ARCHIVED"&&st!=="HIDDEN",stock:stockOf(g(r,"qty")),desc:desc||null,cl,slug,ex});
  if(it.errors.length)it.action="error";else if(ex)it.action=IMP.mode==="update"?"update":"skip";
  if(ex&&it.action==="skip"&&!it.errors.length)it.warnings.push("موجود بالفعل في المتجر، تم تخطيه");
 });
 // mapping of Collections -> categories (kept between re-analysis)
 IMP.map=IMP.map||{};const catByName=new Map(D.cats.map(c=>[c.name.trim(),c]));
 for(const [n,c] of colls){IMP.colls=colls;if(!IMP.map[n]){const e=catByName.get(n);IMP.map[n]=e?"cat:"+e.id:MARKETING.test(n)?"ignore":"new"}}
 impAssign()}
function impAssign(){
 IMP.catCount={};IMP.items.forEach(it=>{it.catName=null;it.catAct=null;if(!it.cl)return;for(const n of it.cl){const a=IMP.map[n];if(a&&a!=="ignore"){it.catAct=a;it.catName=n;break}}
  if(it.catAct&&it.action!=="error"&&it.action!=="skip"){const k=it.catAct==="new"?"new:"+it.catName:it.catAct;IMP.catCount[k]=(IMP.catCount[k]||0)+1}})}
const impCnt=a=>IMP.items.filter(i=>i.action===a).length;
V.import=()=>{
 const x=IMP;
 $("view").innerHTML=`<div class="box"><h3>استيراد منتجات من ملف CSV</h3>
 <p class="hint">ارفع الملف (CSV بترميز UTF-8). لو الملف Excel: من Excel اختر Save As / حفظ باسم > CSV UTF-8. سيتم عرض معاينة وأخطاء قبل أي إضافة، ولن يُحفظ شيء إلا بعد ضغط "ابدأ الاستيراد".</p>
 <div class="row"><div><label>الملف</label><input id="impf" type="file" accept=".csv,text/csv"></div>
 <div><label>لو المنتج موجود بالفعل (نفس SKU أو الـ Handle)</label><select id="impm"><option value="skip" ${x&&x.mode==="skip"||!x?"selected":""}>تخطي (الأمان)</option><option value="update" ${x&&x.mode==="update"?"selected":""}>تحديث السعر والوصف والصور والحالة</option></select></div></div>
 <button class="gray" id="impback">رجوع للمنتجات</button> <span id="impmsg" class="msg"></span></div><div id="impbody"></div>`;
 $("impback").onclick=()=>{impMode=false;IMP=null;V.products()};
 $("impf").onchange=async()=>{const f=$("impf").files[0];if(!f)return;
  try{const rows=parseCSV(await f.text());if(rows.length<2)return flash("impmsg","الملف فاضي أو بدون صفوف منتجات");IMP={rows,mode:$("impm").value,map:{},fname:f.name};impAnalyze();flash("impmsg","",true);impDraw()}catch(e){flash("impmsg","تعذر قراءة الملف: "+e.message)}};
 $("impm").onchange=()=>{if(IMP){IMP.mode=$("impm").value;impAnalyze();impDraw()}};
 if(IMP&&!IMP.done)impDraw();else if(IMP&&IMP.done)impResult()};
function impDraw(){
 const x=IMP,b=$("impbody");if(x.fatal){b.innerHTML=`<div class="box msg">${esc(x.fatal)}</div>`;return}
 const nNew=impCnt("new"),nUp=impCnt("update"),nSk=impCnt("skip"),nEr=impCnt("error"),nW=x.items.filter(i=>i.warnings.length&&i.action!=="skip").length;
 const catOpts=n=>`<option value="new" ${x.map[n]==="new"?"selected":""}>إنشاء قسم جديد بنفس الاسم</option><option value="ignore" ${x.map[n]==="ignore"?"selected":""}>تجاهل (لا تضعه قسماً)</option>${D.cats.map(c=>`<option value="cat:${esc(c.id)}" ${x.map[n]==="cat:"+c.id?"selected":""}>ربط بقسم: ${esc(c.name)}</option>`).join("")}`;
 const colls=[...(x.colls||[])].sort((a,b)=>b[1]-a[1]);
 const used=Object.entries(x.catCount).map(([k,n])=>{const nm=k.startsWith("new:")?k.slice(4)+" (جديد)":(D.cats.find(c=>"cat:"+c.id===k)||{}).name;return `${esc(nm)}: ${n}`}).join(" | ");
 const shown=x.items.filter(i=>i.action!=="skip"||i.warnings.length).filter(i=>i.errors.length||i.warnings.length).slice(0,60);
 b.innerHTML=`<div class="box"><h3>ملخص الملف: ${esc(x.fname)}</h3><div class="stat"><div>صفوف<b>${x.items.length}</b></div><div>منتجات جديدة<b>${nNew}</b></div><div>تحديث<b>${nUp}</b></div><div>تخطي<b>${nSk}</b></div><div>أخطاء (لن تُستورد)<b style="color:#c0392b">${nEr}</b></div><div>تحذيرات<b>${nW}</b></div></div>
 ${(()=>{const lo=x.items.filter(i=>i.price>0&&i.price<=1&&i.action!=="error").length;return lo?`<p class="msg">تنبيه: ${lo} منتج سعره 1 جنيه أو أقل في الملف. لو ده غلط في، صحّحه قبل الاستيراد أو عدّل الأسعار بعده.</p>`:""})()}
 <p class="hint">المنتج في المتجر ليه قسم واحد فقط: بنختار أول قسم في خانة Collections مش متجاهَل. الوصف بيتنضّف من الأكواد الخطيرة، والصور بتُستخدم كروابطها (بدون تنزيل). الحالة DRAFT بتُستورد مخفية. الكمية "Available" معناها متوفر.</p></div>
 ${colls.length?`<div class="box"><h3>الأقسام (Collections)</h3><p class="hint">عدّل لكل اسم: إنشاء قسم، ربطه بقسم موجود، أو تجاهله. النتيجة: ${used||"بدون أقسام"}</p><div class="scroll"><table><tr><th>الاسم في الملف</th><th>عدد المنتجات</th><th>الإجراء</th></tr>${colls.map(([n,c],i)=>`<tr><td>${esc(n)}</td><td>${c}</td><td><select data-cm="${i}">${catOpts(n)}</select></td></tr>`).join("")}</table></div></div>`:""}
 ${shown.length?`<div class="box"><h3>أخطاء وتحذيرات (أول ${shown.length})</h3><div class="scroll"><table><tr><th>سطر</th><th>المنتج</th><th>ملاحظات</th></tr>${shown.map(i=>`<tr><td>${i.line}</td><td>${esc(i.title||i.handle||"-")}</td><td>${i.errors.map(e=>`<span style="color:#c0392b">${esc(e)}</span>`).concat(i.warnings.map(esc)).join("<br>")}</td></tr>`).join("")}</table></div></div>`:""}
 <div class="box"><h3>معاينة (أول 8 منتجات)</h3><div class="scroll"><table><tr><th></th><th>الاسم</th><th>السعر</th><th>خصم</th><th>تكلفة</th><th>القسم</th><th>صور</th><th>حالة</th><th>الإجراء</th></tr>${x.items.filter(i=>i.action!=="error").slice(0,8).map(i=>`<tr><td>${i.imgs&&i.imgs[0]?`<img src="${esc(i.imgs[0])}" alt="" loading="lazy">`:""}</td><td>${esc(i.title)}</td><td>${i.price}</td><td>${i.sale??"-"}</td><td>${i.cost??"-"}</td><td>${esc(i.catName&&i.catAct!=="ignore"?(i.catAct.startsWith("cat:")?(D.cats.find(c=>"cat:"+c.id===i.catAct)||{}).name:i.catName):"-")}</td><td>${(i.imgs||[]).length}</td><td>${i.active?"ظاهر":"مخفي"}${i.stock?"":" / نفذ"}</td><td>${{new:"جديد",update:"تحديث",skip:"تخطي"}[i.action]}</td></tr>`).join("")}</table></div>
 <p style="margin-top:12px"><button id="impgo" ${nNew+nUp?"":"disabled"}>ابدأ الاستيراد (${nNew} جديد${nUp?" + "+nUp+" تحديث":""})</button> <span id="impprog" class="msg"></span></p></div>`;
 b.querySelectorAll("[data-cm]").forEach(s=>s.onchange=()=>{x.map[colls[+s.dataset.cm][0]]=s.value;impAssign();impDraw()});
 const go=$("impgo");if(go)go.onclick=impRun}
async function impRun(){
 const x=IMP,prog=t=>flash("impprog",t,true);$("impgo").disabled=true;
 const batch="imp-"+new Date().toISOString().replace(/[-:T]/g,"").slice(0,12),res={added:0,updated:0,failed:[],cats:0,batch};
 try{
  // 1) categories
  const need=new Set();x.items.forEach(i=>{if((i.action==="new"||i.action==="update")&&i.catAct==="new")need.add(i.catName)});
  const catId={};D.cats.forEach(c=>catId[c.name.trim()]=c.id);
  let so=D.cats.reduce((m,c)=>Math.max(m,c.sort_order||0),0);
  for(const n of need){if(catId[n])continue;prog("إنشاء القسم: "+n);const {data,error}=await sb.from("categories").insert({name:n,sort_order:(so+=10),active:true}).select().single();if(error)throw error;D.cats.push(data);catId[n]=data.id;res.cats++}
  const catOf=i=>!i.catAct||i.catAct==="ignore"?null:i.catAct==="new"?catId[i.catName]:i.catAct.slice(4);
  const fields=i=>({name:i.title,description:i.desc,price:i.price,sale_price:i.sale,image_url:i.imgs[0]||null,images:i.imgs,category_id:catOf(i)||null,active:i.active,in_stock:i.stock,sku:i.sku||null});
  const saveCost=async rows=>{rows=rows.filter(r=>r.cost!=null);if(!rows.length)return;const {error}=await sb.from("product_costs").upsert(rows.map(r=>({product_id:String(r.id),cost:r.cost,updated_at:new Date().toISOString()})));if(error)throw error;rows.forEach(r=>D.costs[String(r.id)]=r.cost)};
  // 2) new products in batches of 100
  const news=x.items.filter(i=>i.action==="new");
  for(let s=0;s<news.length;s+=100){
   const ch=news.slice(s,s+100);prog(`إضافة المنتجات ${Math.min(s+100,news.length)} / ${news.length}`);
   const rows=ch.map(i=>({...fields(i),slug:i.slug||undefined,featured:false,min_order_qty:1,import_batch:batch}));
   let r=await sb.from("products").insert(rows).select();
   if(!r.error&&r.data.length===ch.length){res.added+=ch.length;D.products.unshift(...r.data);await saveCost(r.data.map((d,k)=>({id:d.id,cost:ch[k].cost})))}
   else{ // isolate the bad row(s): one by one
    for(const i of ch){const one=await sb.from("products").insert({...fields(i),slug:i.slug||undefined,featured:false,min_order_qty:1,import_batch:batch}).select().single();
     if(one.error)res.failed.push({line:i.line,title:i.title,err:one.error.message});else{res.added++;D.products.unshift(one.data);try{await saveCost([{id:one.data.id,cost:i.cost}])}catch(e){res.failed.push({line:i.line,title:i.title,err:"التكلفة لم تُحفظ: "+e.message})}}}}
  }
  // 3) updates (6 at a time)
  const ups=x.items.filter(i=>i.action==="update");let done=0;
  for(let s=0;s<ups.length;s+=6){await Promise.all(ups.slice(s,s+6).map(async i=>{
    const {data,error}=await sb.from("products").update(fields(i)).eq("id",i.ex.id).select().single();
    if(error)return res.failed.push({line:i.line,title:i.title,err:error.message});
    Object.assign(i.ex,data);res.updated++;try{await saveCost([{id:data.id,cost:i.cost}])}catch(e){res.failed.push({line:i.line,title:i.title,err:"التكلفة: "+e.message})}}));
   done=Math.min(s+6,ups.length);prog(`تحديث المنتجات ${done} / ${ups.length}`)}
 }catch(e){res.failed.push({line:"-",title:"توقف الاستيراد",err:e.message})}
 x.done=true;x.res=res;impResult()}
function impResult(){
 const r=IMP.res;$("impbody").innerHTML=`<div class="box"><h3>نتيجة الاستيراد</h3><div class="stat"><div>أُضيف<b>${r.added}</b></div><div>تحدّث<b>${r.updated}</b></div><div>أقسام جديدة<b>${r.cats}</b></div><div>فشل<b style="color:#c0392b">${r.failed.length}</b></div></div>
 ${r.failed.length?`<div class="scroll"><table><tr><th>سطر</th><th>المنتج</th><th>السبب</th></tr>${r.failed.map(f=>`<tr><td>${f.line}</td><td>${esc(f.title)}</td><td>${esc(f.err)}</td></tr>`).join("")}</table></div><p class="hint">لو توقف الاستيراد في النص: ارفع نفس الملف تاني بوضع "تخطي" وهيكمل الباقي فقط.</p>`:""}
 <p class="hint">رقم الدفعة: <b dir="ltr">${esc(r.batch)}</b> (محفوظ مع كل منتج جديد، يمكن التراجع عنه).</p>
 ${r.added?`<button class="red" id="impundo">تراجع: حذف المنتجات المضافة في هذه الدفعة (${r.added})</button> `:""}<button id="impdone">تم، عرض المنتجات</button> <span id="impmsg2" class="msg"></span></div>`;
 $("impdone").onclick=()=>{impMode=false;IMP=null;V.products()};
 const u=$("impundo");if(u)u.onclick=async()=>{if(!confirm("حذف كل المنتجات المضافة في هذه الدفعة فقط؟"))return;
  const ids=D.products.filter(p=>p.import_batch===r.batch).map(p=>p.id);
  for(let s=0;s<ids.length;s+=100){const ch=ids.slice(s,s+100);let e=(await sb.from("product_costs").delete().in("product_id",ch.map(String))).error||(await sb.from("products").delete().in("id",ch)).error;if(e)return flash("impmsg2","خطأ: "+e.message)}
  D.products=D.products.filter(p=>p.import_batch!==r.batch);flash("impmsg2","تم الحذف ("+ids.length+")",true);u.disabled=true}}
