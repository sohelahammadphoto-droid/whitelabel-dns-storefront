// functions/api/payment/uddoktapay/return.js — Return Handler After Payment
export async function onRequestGet(context) {
    const { request } = context;
    const url = new URL(request.url);
    const orderId = url.searchParams.get("order_id") || "";
    const invoiceId = url.searchParams.get("invoice_id") || "";

    const origin = `${url.protocol}//${url.host}`;
    const redirectTarget = `${origin}/dashboard.html?payment=success&order_id=${encodeURIComponent(orderId || invoiceId)}`;

    return Response.redirect(redirectTarget, 302);
}
