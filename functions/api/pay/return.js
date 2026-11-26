// Customer comes back from the gateway: only a redirect to the tracking page. The payment itself is confirmed by the signed callback, never by this URL.
export const onRequestGet = async ({ request }) => {
  const u = new URL(request.url), n = (u.searchParams.get("o") || "").replace(/\D/g, "").slice(0, 10);
  return Response.redirect(u.origin + "/track?pay=return" + (n ? "&o=" + n : ""), 302);
};
