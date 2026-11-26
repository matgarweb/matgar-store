(function(){
// Whitelist HTML sanitizer (no DOM needed, same code runs on the server and in the dashboard preview).
// Anything not on the lists is removed. Scripts, iframes, forms, event handlers, javascript: links are impossible.
const TAGS = {
  p: [], br: [], hr: [], b: [], strong: [], i: [], em: [], u: [], s: [], small: [], mark: [], sup: [], sub: [],
  h2: [], h3: [], h4: [], h5: [], h6: [], pre: [], code: [], iframe: ["src", "width", "height"], video: ["src", "controls", "width", "height", "poster"], ul: [], ol: [], li: [], blockquote: [], div: [], span: [], section: [], figure: [], figcaption: [],
  table: [], thead: [], tbody: [], tr: [], td: ["colspan", "rowspan"], th: ["colspan", "rowspan"],
  a: ["href", "title"], img: ["src", "alt", "width", "height"]
};
// class names that may be used (they only style the description; their CSS lives in style.css under .rich)
const CLASSES = new Set(["ecom-wrapper","hero-card","benefits-grid","benefit-box","benefit-icon","benefit-title","benefit-sub","specs-table","specs-label","specs-value","trust-banner","trust-highlight"]);
const VOID = { br: 1, hr: 1, img: 1 };
const DROP = /<(script|style|object|embed|svg|math|form|textarea|select|noscript|template|title|head|button|audio|canvas|link|meta|base)\b[\s\S]*?(?:<\/\1\s*>|$)/gi;
const STYLE_OK = /^(color|background|background-color|text-align|font-size|font-weight|font-style|line-height|padding(-top|-bottom|-left|-right)?|margin(-top|-bottom|-left|-right)?|border(-top|-bottom|-left|-right)?|border-radius|border-color|border-width|border-style|width|max-width|text-decoration|direction|letter-spacing)$/;
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", colon: ":", tab: "\t", newline: "\n" };
const decodeEnt = s => String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (m, e) => {
  e = e.toLowerCase();
  if (e[0] === "#") { const n = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "" }
  return NAMED[e] != null ? NAMED[e] : m;
});
const cleanUrl = (v, img) => {
  const u = decodeEnt(v).replace(/[\u0000-\u0020\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g, "");
  if (img) return /^https:\/\//i.test(u) || /^\/(?!\/)/.test(u) ? u : "";
  return /^(https?:\/\/|mailto:|tel:|#|\/(?!\/))/i.test(u) ? u : "";
};
const cleanStyle = v => {
  const out = [];
  for (const d of decodeEnt(v).split(";")) {
    const i = d.indexOf(":"); if (i < 1) continue;
    const k = d.slice(0, i).trim().toLowerCase(), val = d.slice(i + 1).trim();
    if (!STYLE_OK.test(k) || !val || val.length > 120) continue;
    if (/url\s*\(|expression|javascript|behavior|@|\\|<|>|\/\*|;/i.test(val)) continue;
    if (!/^[#a-z0-9\s.,%()\-+!'"]*$/i.test(val)) continue;
    out.push(k + ":" + val);
  }
  return out.join(";");
};
function sanitizeHtml(input) {
  let s = String(input == null ? "" : input).slice(0, 30000);
  if (!/<[a-zA-Z\/!]/.test(s)) return esc(s).replace(/&quot;/g, '"').replace(/\r?\n/g, "<br>");
  s = s.replace(/<!--[\s\S]*?(?:-->|$)/g, "").replace(DROP, "");
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
  const stack = []; let out = "", last = 0, m;
  const text = t => t.replace(/&(?!(?:#\d+|#x[0-9a-f]+|[a-z]+);)/gi, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  while ((m = re.exec(s))) {
    out += text(s.slice(last, m.index)); last = re.lastIndex;
    const close = m[1] === "/", tag = m[2].toLowerCase();
    if (!(tag in TAGS)) continue;
    if (close) { const i = stack.lastIndexOf(tag); if (i < 0) continue; while (stack.length > i) out += "</" + stack.pop() + ">"; continue }
    let attrs = "", ext = false;
    const ar = /([a-zA-Z][a-zA-Z0-9:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g; let a;
    const seen = {};
    while ((a = ar.exec(m[3]))) {
      const k = a[1].toLowerCase(), v = a[2] ?? a[3] ?? a[4] ?? ""; if (seen[k]) continue; seen[k] = 1;
      if (k === "class") { const c = decodeEnt(v).split(/\s+/).filter(x => CLASSES.has(x)).join(" "); if (c) attrs += ` class="${c}"`; continue }
      if (k === "style") { const c = cleanStyle(v); if (c) attrs += ` style="${esc(c)}"`; continue }
      if (!TAGS[tag].includes(k)) continue;
      if (k === "href") { const u = cleanUrl(v, false); if (u) { attrs += ` href="${esc(u)}"`; ext = /^https?:/i.test(u) } continue }
      if (k === "src" && tag === "iframe") { const u = decodeEnt(v).replace(/[\u0000-\u0020]/g, ""); if (/^https:\/\/(www\.youtube\.com|www\.youtube-nocookie\.com|player\.vimeo\.com)\/(embed|video)\//i.test(u)) attrs += ` src="${esc(u)}"`; continue }
      if ((k === "src" || k === "poster") && tag === "video") { const u = cleanUrl(v, true); if (u) attrs += ` ${k}="${esc(u)}"`; continue }
      if (k === "controls") { attrs += " controls"; continue }
      if (k === "src") { const u = cleanUrl(v, true); if (u) attrs += ` src="${esc(u)}"`; continue }
      if (k === "width" || k === "height" || k === "colspan" || k === "rowspan") { if (/^\d{1,4}$/.test(v.trim())) attrs += ` ${k}="${v.trim()}"`; continue }
      attrs += ` ${k}="${esc(decodeEnt(v).slice(0, 300))}"`;
    }
    if (tag === "img") { if (!/ src="/.test(attrs)) continue; out += `<img${attrs} loading="lazy">`; continue }
    if (tag === "iframe") { if (!/ src="/.test(attrs)) continue; out += `<iframe${attrs} loading="lazy" allowfullscreen referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-presentation"></iframe>`; const e = s.indexOf("</iframe", re.lastIndex); if (e >= 0) { const g = s.indexOf(">", e); if (g >= 0) { re.lastIndex = g + 1; last = g + 1 } } continue }
    if (tag === "video") { if (!/ src="/.test(attrs)) continue; attrs += ' preload="metadata"'; }
    if (tag === "a") { if (!/ href="/.test(attrs)) continue; attrs += ext ? ' target="_blank" rel="noopener nofollow ugc"' : ""; }
    if (VOID[tag]) { out += `<${tag}${attrs}>`; continue }
    stack.push(tag); out += `<${tag}${attrs}>`;
  }
  out += text(s.slice(last));
  while (stack.length) out += "</" + stack.pop() + ">";
  return out;
}
function toText(input) {
  return decodeEnt(String(input == null ? "" : input).replace(DROP, " ").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

window.sanitizeHtml=sanitizeHtml;window.toText=toText;})();
