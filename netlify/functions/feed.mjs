import * as L from "../lib/lib.mjs";
const clean = s => String(s ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4900);
const money = n => Number(n).toFixed(2) + " EGP";
const x = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
const csv = s => '"' + String(s ?? "").replace(/"/g, '""') + '"';
export default async (req) => {
  const path = new URL(req.url).pathname;
  let S = {}; try { S = await L.settings() } catch (e) {}
  const b = L.baseUrl(req, S), brand = S.store_name || "";
  let prods = [];
  for (let from = 0; ; from += 1000) {
    const d = await L.rest(`products?select=id,name,description,price,sale_price,image_url,slug,in_stock&listed=eq.true&price=gt.1&order=created_at.desc&limit=1000&offset=${from}`);
    prods = prods.concat(d); if (d.length < 1000) break;
  }
  prods = prods.filter(p => p.slug && p.name && L.safeUrl(p.image_url) && Number(p.price) > 0);
  const row = p => {
    const sale = p.sale_price != null && +p.sale_price > 0 && +p.sale_price < +p.price ? +p.sale_price : null;
    return { id: p.id, title: String(p.name).slice(0, 150), description: clean(p.description) || String(p.name), availability: p.in_stock ? "in stock" : "out of stock", condition: "new", price: money(p.price), sale_price: sale ? money(sale) : "", link: L.pUrl(b, p), image_link: p.image_url, brand };
  };
  const rows = prods.map(row);
  if (path.endsWith(".csv")) {
    const cols = ["id", "title", "description", "availability", "condition", "price", "sale_price", "link", "image_link", "brand"];
    const out = [cols.join(",")].concat(rows.map(r => cols.map(c => csv(r[c])).join(","))).join("\n");
    return L.send(out, "public, s-maxage=900", "text/csv; charset=utf-8");
  }
  const items = rows.map(r => `<item><g:id>${x(r.id)}</g:id><g:title>${x(r.title)}</g:title><g:description>${x(r.description)}</g:description><g:link>${x(r.link)}</g:link><g:image_link>${x(r.image_link)}</g:image_link><g:availability>${r.availability}</g:availability><g:condition>new</g:condition><g:price>${r.price}</g:price>${r.sale_price ? `<g:sale_price>${r.sale_price}</g:sale_price>` : ""}${r.brand ? `<g:brand>${x(r.brand)}</g:brand>` : ""}<g:identifier_exists>no</g:identifier_exists></item>`).join("");
  return L.send(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>${x(brand)}</title><link>${x(b)}</link><description>${x(brand)}</description>${items}</channel></rss>`, "public, s-maxage=900", "application/xml; charset=utf-8");
};
export const config = { path: ["/feed/google.xml", "/feed/meta.csv"] };
