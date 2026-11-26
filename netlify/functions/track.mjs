import * as L from "../lib/lib.mjs";
// Order tracking page: the customer enters the phone number used on the order and sees only that phone's own orders.
// The lookup runs in the database (track_by_phone), which rate-limits attempts.
export default async (req, context) => {
  try {
    const [S, cats, Z] = await Promise.all([L.settings(), L.categories(), L.zones()]);
    const name = S.store_name || "المتجر";
    const main = `${L.crumbHtml([["الرئيسية", "/"], ["تتبع الطلب", "/track"]])}<h1 class="sec">تتبع طلبك</h1><div id="trkpage" class="box"></div>`;
    return L.send(L.layout({ req, S, cats, zonesList: Z, title: `تتبع طلبك | ${name}`, desc: L.cut(`تابع حالة طلبك من ${name} برقم الموبايل.`, 160), path: "/track", robots: "noindex,follow", body: { main } }));
  } catch (e) { return L.fail(e) }
};
export const config = { path: ["/track"] };
