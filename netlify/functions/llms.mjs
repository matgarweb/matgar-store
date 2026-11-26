import * as L from "../lib/lib.mjs";
// Plain-text summary for AI assistants (llms.txt convention). Public data only.
export default async (req, context) => {
  try {
    const [S, cats] = await Promise.all([L.settings(), L.categories()]); const b = L.baseUrl(req, S);
    const top = await L.rest(`products?select=name,slug,price,sale_price&listed=eq.true&order=created_at.desc&limit=50`);
    const t = `# ${S.store_name || "المتجر"}\n\n> ${S.seo_description || S.tagline || ""}\n\nمتجر مصري، الأسعار بالجنيه المصري (EGP)، التوصيل لجميع محافظات مصر، الدفع عند الاستلام.\n\n## الأقسام\n${cats.map(c => `- [${c.name}](${L.cUrl(b, c)})${c.description ? ": " + L.cut(c.description, 150) : ""}`).join("\n")}\n\n## أحدث المنتجات\n${top.map(p => `- [${p.name}](${L.pUrl(b, p)}): ${L.fmt(L.price(p))} جنيه`).join("\n")}\n\n- [خريطة الموقع](${b}/sitemap.xml)\n`;
    return L.send(t, "public, s-maxage=3600", "text/plain; charset=utf-8");
  } catch (e) { return L.fail(e) }
};
export const config = { path: ["/llms.txt"] };
