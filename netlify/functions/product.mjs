import * as L from "../lib/lib.mjs";
export default async (req, context) => {
  try {
    const slug = L.dec(L.params(req, context).slug || "");
    const [S, cats, Z, rows] = await Promise.all([L.settings(), L.categories(), L.zones(), L.rest(`products?select=${L.PCOLS}&active=eq.true&slug=eq.${encodeURIComponent(slug)}&limit=1`)]);
    const p = rows[0];
    if (!p) return L.notFound(req, S, cats, "المنتج");
    const b = L.baseUrl(req, S), name = S.store_name || "المتجر";
    const cat = cats.find(c => c.id === p.category_id);
    const related = p.category_id ? (await L.rest(`products?select=${L.PCOLS}&listed=eq.true&category_id=eq.${encodeURIComponent(p.category_id)}&id=neq.${encodeURIComponent(p.id)}&order=created_at.desc&limit=8`)) : [];
    const tm = await L.tiersFor([p, ...related]);
    let vrows = []; try { vrows = await L.rest(`product_variants?select=id,label,price,sale_price,in_stock&product_id=eq.${encodeURIComponent(p.id)}&order=sort_order.asc,created_at.asc`) } catch (e) {}
    const vEff = v => v.price == null ? L.price(p) : (v.sale_price != null && +v.sale_price > 0 && +v.sale_price < +v.price ? +v.sale_price : +v.price);
    const vars = vrows.filter(v => v.in_stock !== false);
    const tiers = tm[String(p.id)] || [], min = p.min_order_qty || 1, out = p.in_stock === false;
    const pr = L.price(p), sale = L.isSale(p), imgs = L.imagesOf(p), img = imgs[0] || "";
    const plain = L.toText(p.description || "");
    const path = "/p/" + encodeURIComponent(p.slug);
    const crumbs = [["الرئيسية", "/"], ...(cat ? [[cat.name, "/c/" + encodeURIComponent(cat.slug)]] : [["كل المنتجات", "/products"]]), [p.name, path]];
    const desc = L.cut(plain || `اشتري ${p.name} من ${name} بسعر ${L.fmt(pr)} جنيه مصري. توصيل لجميع محافظات مصر والدفع عند الاستلام.`, 160);
    const ld = [
      { "@context": "https://schema.org", "@type": "Product", name: p.name, ...(imgs.length ? { image: imgs } : {}), description: L.cut(plain || p.name, 500), sku: String(p.id), ...(cat ? { category: cat.name } : {}), brand: { "@type": "Brand", name },
        offers: { "@type": "Offer", url: b + path, priceCurrency: "EGP", price: pr.toFixed(2), availability: out ? "https://schema.org/OutOfStock" : "https://schema.org/InStock", itemCondition: "https://schema.org/NewCondition", eligibleRegion: { "@type": "Country", name: "EG" }, seller: { "@type": "Organization", name } } },
      L.crumbLd(b, crumbs), L.orgLd(b, S)];
    const wa = String(S.whatsapp || "").replace(/\D/g, "");
    const msg = encodeURIComponent(`عايز أطلب: ${p.name} - السعر ${L.fmt(pr)} جنيه`);
    const attrs = `data-add data-id="${L.esc(p.id)}" data-name="${L.esc(p.name)}" data-price="${L.esc(pr)}" data-image="${L.esc(img)}" data-slug="${L.esc(p.slug)}" data-min="${min}" data-tiers="${L.esc(JSON.stringify(tiers.map(x => [x.min_qty, +x.unit_price])))}"${vars.length ? ` data-vars="${L.esc(JSON.stringify(vars.map(v => ({ id: v.id, label: v.label, price: vEff(v) }))))}"` : ""}`;
    const varHtml = vrows.length ? `<div class="vars" id="vars"><b>اختر الخيار:</b>${vrows.map(v => `<label class="var${v.in_stock === false ? " off" : ""}"><input type="radio" name="var" value="${L.esc(v.id)}" data-price="${L.esc(vEff(v))}" data-old="${v.price != null && vEff(v) < +v.price ? L.esc(v.price) : ""}" ${v.in_stock === false ? "disabled" : ""}><span>${L.esc(v.label)}${v.price != null ? ` - ${L.fmt(vEff(v))} جنيه` : ""}${v.in_stock === false ? " (نفذ)" : ""}</span></label>`).join("")}</div>` : "";
    const attrList = Array.isArray(p.attributes) ? p.attributes.filter(a => a && a.k && a.v) : [];
    const attrHtml = attrList.length ? `<h2>المواصفات</h2><table class="attrs">${attrList.map(a => `<tr><th>${L.esc(a.k)}</th><td>${L.esc(a.v)}</td></tr>`).join("")}</table>` : "";
    const tierTbl = tiers.length ? `<h2>أسعار الكمية (جملة)</h2><table class="tiers"><tr><th>الكمية</th><th>سعر القطعة</th><th></th></tr><tr><td>1+</td><td>${L.fmt(pr)} جنيه</td><td></td></tr>${tiers.map(t => `<tr><td>${t.min_qty}+</td><td><b>${L.fmt(t.unit_price)} جنيه</b></td><td>${L.esc(t.label || "")}</td></tr>`).join("")}</table>` : "";
    const main = `${L.crumbHtml(crumbs)}
<article class="prod"><div class="pgal"><div class="pimg">${img ? `<img id="gmain" src="${L.esc(img)}" alt="${L.esc(p.name)}" width="800" height="800" fetchpriority="high">` : `<div class="ph"></div>`}${sale ? `<span class="badge">خصم ${Math.round((1 - pr / p.price) * 100)}%</span>` : ""}</div>${imgs.length > 1 ? `<div class="thumbs" id="thumbs">${imgs.map((u, i) => `<button type="button" class="${i ? "" : "on"}" data-src="${L.esc(u)}" aria-label="صورة ${i + 1}"><img src="${L.esc(u)}" alt="${L.esc(p.name)} - ${i + 1}" width="64" height="64" loading="lazy"></button>`).join("")}</div>` : ""}</div>
<div class="pinfo"><h1>${L.esc(p.name)}</h1>${cat ? `<p class="muted">القسم: <a href="/c/${L.esc(encodeURIComponent(cat.slug))}">${L.esc(cat.name)}</a></p>` : ""}
<div class="pr big"><span class="price${sale ? " sale" : ""}">${L.fmt(pr)} جنيه</span>${sale ? `<span class="old">${L.fmt(p.price)}</span><span class="offpct">-${Math.round((1 - pr / p.price) * 100)}%</span>` : ""}</div>${sale ? `<div class="save big">وفّر ${L.fmt(p.price - pr)} جنيه</div>` : ""}
<p class="muted">${out ? "نفذت الكمية حالياً" : "متوفر"} - التوصيل لجميع محافظات مصر - الدفع عند الاستلام${min > 1 ? ` - أقل كمية للطلب ${min}` : ""}</p>
${varHtml}
${tierTbl}
${out ? `<button class="btn big" disabled>نفذت الكمية</button>` : `<label class="ql">الكمية <input id="pq" type="number" inputmode="numeric" min="${min}" max="5000" value="${min}"></label><button class="btn add big" id="mainadd" ${attrs}>أضف للسلة</button>`}
${wa ? `<a class="btn wa2" data-wa data-name="${L.esc(p.name)}" data-price="${L.esc(pr)}" href="https://wa.me/${L.esc(wa)}?text=${msg}" target="_blank" rel="noopener">اطلب عبر واتساب</a>` : ""}
<p class="muted">تشتري بالجملة؟ <a href="/wholesale">اطلب عرض سعر</a></p>
${attrHtml}
${p.description ? `<h2>وصف المنتج</h2><div class="desc rich">${L.descHtml(p.description)}</div>` : ""}
${S.return_policy ? `<details class="rp prp"><summary>سياسة الاسترجاع</summary><p class="desc">${L.esc(S.return_policy).replace(/\n/g, "<br>")}</p></details>` : ""}</div></article>
${related.length ? `<h2 class="sec">منتجات مشابهة</h2><div class="grid">${L.cardsHtml(related, tm, 0)}</div>` : ""}
${out ? "" : `<div class="stick" id="stick"><div><b>${L.esc(L.cut(p.name, 28))}</b><span class="price">${L.fmt(pr)} جنيه</span></div><button class="btn" id="stickadd" ${attrs}>أضف للسلة</button></div>`}`;
    return L.send(L.layout({ req, S, cats, zonesList: Z, title: `${L.cut(p.name, 62)} | ${name}`, desc, path, ld, robots: p.listed === false ? "noindex,follow" : undefined, body: { main }, currentCat: cat ? cat.slug : null, og: { type: "product", title: p.name, image: img } }));
  } catch (e) { return L.fail(e) }
};
export const config = { path: ["/p/:slug"] };
