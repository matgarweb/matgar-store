import * as L from "../lib/lib.mjs";
// Editable legal pages. Text lives in settings (legal_<slug>_text); a page is public only when legal_<slug>_on = "1".
export const LEGAL = { privacy: "سياسة الخصوصية", terms: "الشروط والأحكام", refund: "سياسة الاسترجاع والاستبدال", shipping: "سياسة الشحن والتوصيل" };
export default async (req, context) => {
  try {
    const [S, cats] = await Promise.all([L.settings(), L.categories()]);
    const slug = decodeURIComponent(new URL(req.url).pathname.replace(/\/+$/, "").split("/").pop() || "");
    const text = String(S["legal_" + slug + "_text"] || "").trim();
    if (!LEGAL[slug] || S["legal_" + slug + "_on"] !== "1" || !text || /\[\[/.test(text)) return L.notFound(req, S, cats, "الصفحة");
    const name = S.store_name || "المتجر", title = LEGAL[slug];
    const body = text.split(/\n{2,}/).map(par => {
      const t = par.trim();
      if (/^#\s/.test(t)) return `<h2>${L.esc(t.replace(/^#\s+/, ""))}</h2>`;
      return `<p>${L.esc(t).replace(/\n/g, "<br>")}</p>`;
    }).join("\n");
    const main = `${L.crumbHtml([["الرئيسية", "/"], [title, "/legal/" + slug]])}<h1 class="sec">${L.esc(title)}</h1><div class="box legal">${body}</div>`;
    return L.send(L.layout({ req, S, cats, title: `${title} | ${name}`, desc: L.cut(text.replace(/\s+/g, " "), 160), path: "/legal/" + slug, body: { main } }));
  } catch (e) { return L.fail(e) }
};
export const config = { path: ["/legal/*"] };
