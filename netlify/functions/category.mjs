import * as L from "../lib/lib.mjs";
const PER = 48;
export default async (req, context) => {
  try {
    const u = { searchParams: { get: k => L.params(req, context)[k] ?? null } };
    const slug = L.dec(u.searchParams.get("slug") || "");
    const page = Math.max(1, parseInt(u.searchParams.get("page")) || 1);
    const [S, cats, Z] = await Promise.all([L.settings(), L.categories(), L.zones()]);
    const b = L.baseUrl(req, S), name = S.store_name || "المتجر";
    let cat = null;
    if (slug) { cat = cats.find(c => c.slug === slug); if (!cat) return L.notFound(req, S, cats, "القسم") }
    const num = v => { const n = parseFloat(v); return isFinite(n) && n >= 0 ? n : null };
    const mn = num(u.searchParams.get("min")), mx = num(u.searchParams.get("max")), stock = u.searchParams.get("stock") === "1";
    const sort = ["price_asc", "price_desc"].includes(u.searchParams.get("sort")) ? u.searchParams.get("sort") : "new";
    const filtered = mn !== null || mx !== null || stock || sort !== "new";
    const filter = (cat ? `&category_id=eq.${encodeURIComponent(cat.id)}` : "") + (mn !== null ? `&price=gte.${mn}` : "") + (mx !== null ? `&price=lte.${mx}` : "") + (stock ? "&in_stock=eq.true" : "");
    const order = sort === "price_asc" ? "price.asc" : sort === "price_desc" ? "price.desc" : "created_at.desc";
    const fq = [mn !== null ? "min=" + mn : "", mx !== null ? "max=" + mx : "", stock ? "stock=1" : "", sort !== "new" ? "sort=" + sort : ""].filter(Boolean);
    const grouped = !cat && !filtered;
    let prods, total;
    if (grouped) {
      const light = await L.rest(`products?select=id,category_id,created_at&listed=eq.true&order=created_at.desc&limit=3000`);
      const rank = id => { const i = cats.findIndex(c => c.id === id); return i < 0 ? 9999 : i };
      const sorted = light.map((x, i) => ({ ...x, r: rank(x.category_id), i })).sort((a, b) => a.r - b.r || a.i - b.i);
      total = sorted.length;
      const ids = sorted.slice((page - 1) * PER, page * PER).map(x => x.id);
      const rows = ids.length ? await L.rest(`products?select=${L.PCOLS}&id=in.(${ids.map(encodeURIComponent).join(",")})`) : [];
      prods = ids.map(id => rows.find(r => r.id === id)).filter(Boolean);
    } else ({ data: prods, total } = await L.rest(`products?select=${L.PCOLS}&listed=eq.true${filter}&order=${order}&limit=${PER}&offset=${(page - 1) * PER}`, { count: true }));
    const pages = Math.max(1, Math.ceil(total / PER));
    const tm = await L.tiersFor(prods);
    if (page > pages) return L.notFound(req, S, cats, "الصفحة");
    const base = cat ? "/c/" + encodeURIComponent(cat.slug) : "/products";
    const path = base + (page > 1 ? "?page=" + page : "");
    const qsOf = pg => { const p = [...fq, pg > 1 ? "page=" + pg : ""].filter(Boolean); return base + (p.length ? "?" + p.join("&") : "") };
    const label = cat ? cat.name : "كل المنتجات";
    const crumbs = [["الرئيسية", "/"], ...(cat ? [[cat.name, base]] : [["كل المنتجات", base]])];
    const title = `${label}${page > 1 ? " - صفحة " + page : ""} | ${name}`;
    const desc = L.cut((cat && cat.description) || `تسوق ${label} من ${name} بأفضل الأسعار مع التوصيل لجميع محافظات مصر والدفع عند الاستلام.`, 160);
    const pager = pages > 1 ? `<nav class="pager">${page > 1 ? `<a class="btn gray" href="${L.esc(qsOf(page - 1))}">السابق</a>` : ""}<span>صفحة ${page} من ${pages}</span>${page < pages ? `<a class="btn gray" href="${L.esc(qsOf(page + 1))}">التالي</a>` : ""}</nav>` : "";
    const groupedHtml = () => {
      const runs = []; prods.forEach(p => { const k = p.category_id || ""; const last = runs[runs.length - 1]; if (last && last.k === k) last.l.push(p); else runs.push({ k, l: [p] }) });
      return runs.map(r => { const c = cats.find(x => x.id === r.k); return `<section class="csec"><div class="csec-h"><h2 class="sec">${L.esc(c ? c.name : "منتجات أخرى")}</h2>${c ? `<a class="csec-m" href="/c/${L.esc(encodeURIComponent(c.slug))}">عرض كل القسم</a>` : ""}</div><div class="grid">${L.cardsHtml(r.l, tm)}</div></section>` }).join("") || `<div class="empty">لا توجد منتجات</div>`;
    };
    const main = `${L.crumbHtml(crumbs)}<div class="sthead"><h1 class="sec">${L.esc(grouped ? "المتجر" : label)}</h1>${grouped ? `<span>${total} منتج مرتبين حسب القسم</span>` : ""}</div>
<details class="filters" ${filtered ? "open" : ""}><summary>تصفية وترتيب</summary><form method="get" action="${L.esc(base)}"><div class="row"><div><label>السعر من</label><input name="min" type="number" inputmode="numeric" min="0" value="${mn ?? ""}"></div><div><label>إلى</label><input name="max" type="number" inputmode="numeric" min="0" value="${mx ?? ""}"></div></div><label>الترتيب</label><select name="sort"><option value="new" ${sort === "new" ? "selected" : ""}>الأحدث</option><option value="price_asc" ${sort === "price_asc" ? "selected" : ""}>السعر: الأقل أولاً</option><option value="price_desc" ${sort === "price_desc" ? "selected" : ""}>السعر: الأعلى أولاً</option></select><label class="chk"><input type="checkbox" name="stock" value="1" ${stock ? "checked" : ""}>المتوفر فقط</label><button class="btn" type="submit">تطبيق</button> <a class="btn gray" href="${L.esc(base)}">مسح</a></form></details>${cat && cat.description ? `<p class="lead">${L.esc(cat.description)}</p>` : ""}
${grouped ? groupedHtml() : `<div class="grid">${L.cardsHtml(prods, tm) || `<div class="empty">لا توجد منتجات</div>`}</div>`}${pager}`;
    const ld = [L.crumbLd(b, crumbs), { "@context": "https://schema.org", "@type": "CollectionPage", name: label, url: b + path, inLanguage: "ar-EG", mainEntity: { "@type": "ItemList", itemListElement: prods.map((p, i) => ({ "@type": "ListItem", position: (page - 1) * PER + i + 1, url: L.pUrl(b, p), name: p.name })) } }];
    return L.send(L.layout({ req, S, cats, zonesList: Z, robots: filtered ? "noindex,follow" : undefined, title, desc, path, ld, body: { main }, currentCat: cat ? cat.slug : "", prev: page > 1 ? qsOf(page - 1) : null, next: page < pages ? qsOf(page + 1) : null, og: { image: prods[0] && prods[0].image_url } }));
  } catch (e) { return L.fail(e) }
};
export const config = { path: ["/products","/c/:slug"] };
