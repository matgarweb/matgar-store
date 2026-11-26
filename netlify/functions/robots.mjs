import * as L from "../lib/lib.mjs";
export default async (req, context) => {
  let b; try { b = L.baseUrl(req, await L.settings()) } catch (e) { b = L.baseUrl(req, {}) }
  return L.send(`User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /admin.js\n\nSitemap: ${b}/sitemap.xml\n`, "public, s-maxage=3600", "text/plain; charset=utf-8");
};
export const config = { path: ["/robots.txt"] };
