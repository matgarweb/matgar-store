import * as L from "../lib/lib.mjs";
const DEFAULT = [{ k: "intro", on: true }, { k: "reviews", on: true }, { k: "categories", on: true }, { k: "catsecs", on: true }, { k: "trust", on: true }, { k: "featured", on: false }, { k: "latest", on: false }, { k: "about", on: true }];
export default async (req, context) => {
  try {
    const [S, cats, Z, latest, featured] = await Promise.all([L.settings(), L.categories(), L.zones(),
      L.rest(`products?select=${L.PCOLS}&listed=eq.true&order=created_at.desc&limit=24`),
      L.rest(`products?select=${L.PCOLS}&listed=eq.true&featured=eq.true&order=created_at.desc&limit=12`)]);
    const tm = await L.tiersFor([...latest, ...featured].filter((p, i, a) => a.findIndex(x => x.id === p.id) === i));
    const homeCats = cats.filter(c => c.show_home !== false);
    const b = L.baseUrl(req, S), name = S.store_name || "المتجر";
    const title = name + (S.tagline ? " | " + S.tagline : "");
    const desc = L.cut(S.seo_description || S.tagline || name, 160);
    const hi = L.safeUrl(S.hero_image_url);
    const cta = /^(\/|https?:\/\/)/.test(S.hero_cta_link || "") && S.hero_cta_text ? `<a class="btn heroBtn" href="${L.esc(S.hero_cta_link)}">${L.esc(S.hero_cta_text)}</a>` : "";
    const slider = L.heroSliderHtml(S, name);
    const hero = slider || `<section class="hero ${hi ? "img" : ""}" ${hi ? `style="background-image:url('${L.esc(hi.replace(/'/g, "%27"))}')"` : ""}><h1>${L.esc(S.hero_title || name)}</h1><p>${L.esc(S.hero_subtitle || "")}</p>${cta}</section>`;
    let layoutCfg = DEFAULT; try { const j = JSON.parse(S.home_layout || ""); if (Array.isArray(j) && j.length) layoutCfg = j } catch (e) {}
    if (S.home_layout_v !== "2") {
    ["catsecs", "reviews", "intro"].forEach(k => { if (!layoutCfg.some(x => x.k === k)) layoutCfg = [{ k, on: true }, ...layoutCfg] });
    if (!layoutCfg.some(x => x.k === "chats")) { const ai = layoutCfg.findIndex(x => x.k === "about"); layoutCfg = [...layoutCfg.slice(0, ai >= 0 ? ai : layoutCfg.length), { k: "chats", on: true }, ...layoutCfg.slice(ai >= 0 ? ai : layoutCfg.length)]; }
    if (!layoutCfg.some(x => x.k === "track")) { const ti = layoutCfg.findIndex(x => x.k === "trust"); layoutCfg = [...layoutCfg.slice(0, ti >= 0 ? ti + 1 : 1), { k: "track", on: true }, ...layoutCfg.slice(ti >= 0 ? ti + 1 : 1)]; }
    }
    let cs = []; try { cs = JSON.parse(S.home_cat_sections || "[]") } catch (e) {}
    cs = (Array.isArray(cs) ? cs : []).filter(x => x && x.on !== false).map(x => ({ c: cats.find(c => c.slug === x.slug), n: Math.min(12, Math.max(2, Number(x.n) || 8)) })).filter(x => x.c).slice(0, 10);
    const csData = await Promise.all(cs.map(x => L.rest(`products?select=${L.PCOLS}&listed=eq.true&category_id=eq.${encodeURIComponent(x.c.id)}&order=created_at.desc&limit=${x.n}`).catch(() => [])));
    const csTm = await L.tiersFor(csData.flat().filter((p, i, a) => a.findIndex(y => y.id === p.id) === i));
    const bgOf = v => /^#[0-9a-fA-F]{6}$/.test(v || "") ? v : "";
    const lnkOk = v => /^(\/(?!\/)|https:\/\/)/.test(String(v || ""));
    const cust = layoutCfg.filter(x => x.k === "cat" && x.on && x.slug).map(x => ({ x, c: cats.find(c => c.slug === x.slug), n: Math.min(24, Math.max(2, Number(x.n) || 8)) })).filter(y => y.c).slice(0, 12);
    const custData = await Promise.all(cust.map(y => L.rest(`products?select=${L.PCOLS}&listed=eq.true&category_id=eq.${encodeURIComponent(y.c.id)}&order=created_at.desc&limit=${y.n}`).catch(() => [])));
    const custTm = await L.tiersFor(custData.flat().filter((p, i, a) => a.findIndex(y => y.id === p.id) === i));
    const sec = {
      cat: x => { const i = cust.findIndex(y => y.x === x); if (i < 0 || !custData[i].length) return ""; const y = cust[i], bg = bgOf(x.bg), cols = [1, 2, 3].includes(+x.cols) ? +x.cols : 2, cards = L.cardsHtml(custData[i], custTm);
        return `<section class="csec${bg ? " cbg" : ""}"${bg ? ` style="background:${bg}"` : ""}><div class="csec-h"><h2 class="sec">${L.esc(String(x.title || "").trim().slice(0, 60) || y.c.name)}</h2>${x.more === false ? "" : `<a class="csec-m" href="/c/${L.esc(encodeURIComponent(y.c.slug))}">عرض الكل</a>`}</div>${x.layout === "scroll" ? `<div class="hscroll gc${cols}">${cards}</div>` : `<div class="grid gc${cols}">${cards}</div>`}</section>` },
      catrow: x => { const n = Math.min(4, Math.max(1, Number(x.cols) || (x.items || []).length || 2)); const its = (Array.isArray(x.items) ? x.items : []).slice(0, n).map(i => ({ c: cats.find(c => c.slug === (i && i.slug)), t: String((i && i.t) || "").slice(0, 160) })).filter(i => i.c); if (!its.length) return "";
        const t = String(x.title || "").trim().slice(0, 60);
        return `<section class="cgs">${t ? `<h2 class="sec">${L.esc(t)}</h2>` : ""}<div class="cg c${n}">${its.map(i => `<a class="cgi" href="/c/${L.esc(encodeURIComponent(i.c.slug))}">${L.safeUrl(i.c.image_url) ? `<img src="${L.esc(i.c.image_url)}" alt="${L.esc(i.c.name)}" loading="lazy">` : `<span class="cgp">${L.esc(i.c.name.slice(0, 1))}</span>`}<b>${L.esc(i.c.name)}</b>${i.t ? `<small>${L.esc(i.t)}</small>` : ""}</a>`).join("")}</div></section>` },
      code: x => { const h = String(x.html || "").slice(0, 20000); if (!h.trim()) return "";
        const doc = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><base target="_blank"><style>body{margin:0;font-family:system-ui,sans-serif}</style></head><body>${h}<script>(function(){function p(){parent.postMessage({ocode:1,h:document.documentElement.scrollHeight},"*")}addEventListener("load",p);try{new ResizeObserver(p).observe(document.body)}catch(e){}setTimeout(p,300)})()</script></body></html>`;
        return `<section class="codes"><iframe class="codef" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" loading="lazy" referrerpolicy="no-referrer" title="محتوى" srcdoc="${L.esc(doc)}" style="width:100%;border:0;height:120px"></iframe></section>` },
      video: x => { const m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/))([A-Za-z0-9_-]{11})/.exec(String(x.url || "")); if (!m) return ""; const t = String(x.title || "").trim().slice(0, 80);
        return `<section class="vid">${t ? `<h2 class="sec">${L.esc(t)}</h2>` : ""}<div class="vidf"><iframe src="https://www.youtube-nocookie.com/embed/${m[1]}" title="${L.esc(t || "فيديو")}" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div></section>` },
      text: x => { const t = String(x.title || "").trim().slice(0, 80), b = String(x.body || "").trim().slice(0, 1500); if (!t && !b) return ""; const bg = bgOf(x.bg); return `<section class="txs${bg ? " cbg" : ""}"${bg ? ` style="background:${bg}"` : ""}>${t ? `<h2 class="sec">${L.esc(t)}</h2>` : ""}${b ? `<p>${L.esc(b)}</p>` : ""}</section>` },
      banner: x => { const im = L.safeUrl(x.img); if (!im) return ""; const img = `<img src="${L.esc(im)}" alt="${L.esc(String(x.alt || "").slice(0, 120))}" loading="lazy">`; return `<section class="bns">${lnkOk(x.link) ? `<a href="${L.esc(x.link)}">${img}</a>` : img}</section>` },
      intro: () => L.introHtml(S),
      reviews: () => L.reviewsHtml(S),
      chats: () => L.chatsHtml(S),
      catsecs: () => cs.map((x, i) => csData[i].length ? `<section class="csec"><div class="csec-h"><h2 class="sec">${L.esc(x.c.name)}</h2><a class="csec-m" href="/c/${L.esc(encodeURIComponent(x.c.slug))}">عرض الكل</a></div><div class="grid">${L.cardsHtml(csData[i], csTm)}</div></section>` : "").join(""),
      trust: () => L.trustHtml(S),
      track: () => "",
      categories: () => {
        let g = null; try { g = JSON.parse(S.home_cat_grid || "null") } catch (e) {}
        if (g && Array.isArray(g.items)) {
          const cols = [1, 2, 3].includes(+g.cols) ? +g.cols : 2;
          const its = g.items.filter(x => x && x.on !== false).map(x => ({ c: cats.find(c => c.slug === x.slug), t: String(x.t || "").slice(0, 160) })).filter(x => x.c);
          if (!its.length) return "";
          return `<section><h2 class="sec">${L.esc(S.home_cat_title || "تسوق حسب القسم")}</h2><div class="cg c${cols}">${its.map(x => `<a class="cgi" href="/c/${L.esc(encodeURIComponent(x.c.slug))}">${L.safeUrl(x.c.image_url) ? `<img src="${L.esc(x.c.image_url)}" alt="${L.esc(x.c.name)}" loading="lazy">` : `<span class="cgp">${L.esc(x.c.name.slice(0, 1))}</span>`}<b>${L.esc(x.c.name)}</b>${x.t ? `<small>${L.esc(x.t)}</small>` : ""}</a>`).join("")}</div></section>`;
        }
        return homeCats.length ? `<section><h2 class="sec">تسوق حسب القسم</h2><div class="catgrid">${homeCats.map(c => `<a class="cc" href="/c/${L.esc(encodeURIComponent(c.slug))}">${L.safeUrl(c.image_url) ? `<img src="${L.esc(c.image_url)}" alt="${L.esc(c.name)}" width="120" height="120" loading="lazy">` : `<span class="ci">${L.esc(c.name.slice(0, 1))}</span>`}<b>${L.esc(c.name)}</b></a>`).join("")}</div></section>` : "";
      },
      featured: () => featured.length ? `<section><h2 class="sec">منتجات مميزة</h2><div class="grid">${L.cardsHtml(featured, tm)}</div></section>` : "",
      latest: () => `<section><h2 class="sec">أحدث المنتجات</h2><div class="grid">${L.cardsHtml(latest, tm)}</div><p style="text-align:center"><a class="btn gray" href="/products">عرض كل المنتجات</a></p></section>`,
      about: () => `<section class="about"><h2>عن ${L.esc(name)}</h2><p>${L.esc(S.seo_description || "")} نوصل لجميع محافظات مصر والدفع عند الاستلام. نبيع جملة وقطاعي، <a href="/wholesale">اطلب عرض سعر جملة</a>.</p></section>`
    };
    const main = `<div id="secs">${layoutCfg.filter(x => x.on && sec[x.k]).map(x => sec[x.k](x)).join("")}</div>
<section id="res" hidden><h2 class="sec" id="gt"></h2><div id="grid" class="grid"></div></section>`;
    return L.send(L.layout({
      req, S, cats, zonesList: Z, title, desc, path: "/", currentCat: null,
      ld: [L.orgLd(b, S), { "@context": "https://schema.org", "@type": "WebSite", name, url: b, inLanguage: "ar-EG", potentialAction: { "@type": "SearchAction", target: b + "/?q={search_term_string}", "query-input": "required name=search_term_string" } }],
      body: { hero, main }
    }));
  } catch (e) { return L.fail(e) }
};
export const config = { path: ["/"] };
