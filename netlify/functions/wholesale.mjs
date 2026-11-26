import * as L from "../lib/lib.mjs";
export default async (req, context) => {
  try {
    const [S, cats, Z] = await Promise.all([L.settings(), L.categories(), L.zones()]);
    const name = S.store_name || "المتجر", b = L.baseUrl(req, S);
    const wa = String(S.whatsapp || "").replace(/\D/g, "");
    const main = `${L.crumbHtml([["الرئيسية", "/"], ["طلب جملة", "/wholesale"]])}<h1 class="sec">اطلب عرض سعر جملة</h1>
<p class="lead">بنبيع جملة وقطاعي. اكتب المنتجات والكميات اللي محتاجها وهنتواصل معاك بسعر الجملة.</p>
<form id="wf" class="box formbox" novalidate><label>الاسم</label><input id="wn" maxlength="80" required>
<label>رقم الموبايل</label><input id="wp" type="tel" inputmode="tel" placeholder="01XXXXXXXXX" required>
<label>اسم النشاط / المحل (اختياري)</label><input id="wb" maxlength="120">
<label>المحافظة</label><select id="wg"><option value="">اختر</option>${Z.map(z => `<option>${L.esc(z.governorate)}</option>`).join("")}</select>
<label>المنتجات والكميات المطلوبة</label><textarea id="wm" rows="5" maxlength="1000" required></textarea>
<input id="wweb" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;width:1px;height:1px" aria-hidden="true">
<p class="msg" id="werr"></p><button class="btn full" id="wsub" type="submit">إرسال الطلب</button>
${wa ? `<a class="btn wa2" href="https://wa.me/${L.esc(wa)}?text=${encodeURIComponent("عايز عرض سعر جملة")}" target="_blank" rel="noopener">أو كلمنا على واتساب</a>` : ""}</form>
<div id="wdone" class="done" hidden><div class="tick">&#10003;</div><h3>وصلنا طلبك</h3><p>هنتواصل معاك قريباً على الرقم اللي كتبته.</p><a class="btn" href="/">الرجوع للمتجر</a></div>`;
    return L.send(L.layout({ req, S, cats, zonesList: Z, title: `طلب جملة | ${name}`, desc: L.cut(`اطلب عرض سعر جملة من ${name}. أسعار خاصة للكميات مع التوصيل لجميع محافظات مصر.`, 160), path: "/wholesale", ld: [L.crumbLd(b, [["الرئيسية", "/"], ["طلب جملة", "/wholesale"]])], body: { main } }));
  } catch (e) { return L.fail(e) }
};
export const config = { path: ["/wholesale"] };
