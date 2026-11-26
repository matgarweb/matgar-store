import * as L from "../lib/lib.mjs";
const x = s => L.esc(s);
export default async (req, context) => {
  try {
    const S = await L.settings(), b = L.baseUrl(req, S);
    const cats = await L.categories();
    let prods = [], from = 0;
    for (;;) { const d = await L.rest(`products?select=slug,image_url,name,updated_at&listed=eq.true&order=created_at.desc&limit=1000&offset=${from}`); prods = prods.concat(d); if (d.length < 1000) break; from += 1000 }
    const day = d => (d ? String(d).slice(0, 10) : null);
    const url = (loc, lm, extra) => `<url><loc>${x(loc)}</loc>${lm ? `<lastmod>${lm}</lastmod>` : ""}${extra || ""}</url>`;
    const out = [url(b + "/"), url(b + "/products"), url(b + "/wholesale"), ...cats.map(c => url(L.cUrl(b, c))),
      ...prods.filter(p => p.slug).map(p => url(L.pUrl(b, p), day(p.updated_at), L.safeUrl(p.image_url) ? `<image:image><image:loc>${x(p.image_url)}</image:loc><image:title>${x(p.name)}</image:title></image:image>` : ""))];
    return L.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${out.join("\n")}\n</urlset>`, "public, s-maxage=3600, stale-while-revalidate=86400", "application/xml; charset=utf-8");
  } catch (e) { return L.fail(e) }
};
export const config = { path: ["/sitemap.xml"] };
