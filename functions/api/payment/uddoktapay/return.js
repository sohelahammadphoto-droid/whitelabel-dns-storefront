// functions/api/payment/uddoktapay/return.js — Instant Verification on Customer Redirect
import { initDb, getSetting } from "../../_db.js";
import { processCompletedPayment } from "./_process.js";

export async function onRequest(context) {
    const { request, env } = context;
    await initDb(env);

    const url = new URL(request.url);
    const invoiceId = url.searchParams.get("invoice_id") || "";
    let orderId = url.searchParams.get("order_id") || "";

    const apiKey = await getSetting(env, "uddoktapay_api_key", "");
    let baseUrl = (await getSetting(env, "uddoktapay_base_url", "") || "").trim();
    baseUrl = baseUrl.replace(/\/+$/, "")
                     .replace(/\/api\/checkout-v2\/?$/i, "")
                     .replace(/\/api\/checkout\/?$/i, "")
                     .replace(/\/api\/?$/i, "");

    // ⚡ If invoice_id received, actively verify payment with UddoktaPay API
    if (invoiceId && apiKey && baseUrl) {
        try {
            const verifyEndpoint = `${baseUrl}/api/verify-payment`;
            const verifyRes = await fetch(verifyEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "RT-UDDOKTAPAY-API-KEY": apiKey
                },
                body: JSON.stringify({ invoice_id: invoiceId })
            });

            const verifyData = await verifyRes.json();
            console.log("UddoktaPay Return Verify Response:", JSON.stringify(verifyData));

            if (verifyData.status === "COMPLETED") {
                const result = await processCompletedPayment(env, verifyData);
                if (result.order_id) {
                    orderId = result.order_id;
                }
            }
        } catch (e) {
            console.error("Error during return payment verification:", e);
        }
    }

    const origin = `${url.protocol}//${url.host}`;
    const redirectTarget = `${origin}/dashboard.html?payment=success&order_id=${encodeURIComponent(orderId || invoiceId)}`;

    return Response.redirect(redirectTarget, 302);
}
