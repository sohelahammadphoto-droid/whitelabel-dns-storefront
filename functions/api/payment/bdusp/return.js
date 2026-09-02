// functions/api/payment/bdusp/return.js — BDUSP Pay Customer Return & Verification
import { initDb, getSetting } from "../../_db.js";
import { processCompletedPayment } from "../uddoktapay/_process.js";

export async function onRequest(context) {
    const { request, env } = context;
    await initDb(env);

    const url = new URL(request.url);
    const transactionId = url.searchParams.get("transactionId") || url.searchParams.get("transaction_id") || "";
    let orderId = url.searchParams.get("order_id") || "";

    const apiKey = (await getSetting(env, "bdusp_api_key", "") || "").trim();
    const secretKey = (await getSetting(env, "bdusp_secret_key", "") || "").trim();
    const brandKey = (await getSetting(env, "bdusp_brand_key", "") || "").trim();

    if (transactionId && apiKey && secretKey && brandKey) {
        try {
            const verifyRes = await fetch("https://pay.bdusp.com/api/payment/verify", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "API-KEY": apiKey,
                    "SECRET-KEY": secretKey,
                    "BRAND-KEY": brandKey
                },
                body: JSON.stringify({ transaction_id: transactionId })
            });

            const verifyData = await verifyRes.json();
            console.log("BDUSP Verify Response:", JSON.stringify(verifyData));

            if (verifyData.status === "COMPLETED") {
                const payload = {
                    ...verifyData,
                    transaction_id: transactionId,
                    payment_method: `BDUSP Pay (${verifyData.payment_method || 'Auto'})`
                };
                const result = await processCompletedPayment(env, payload);
                if (result.order_id) {
                    orderId = result.order_id;
                }
            }
        } catch (e) {
            console.error("Error during BDUSP payment verification:", e);
        }
    }

    const origin = `${url.protocol}//${url.host}`;
    const redirectTarget = `${origin}/dashboard.html?payment=success&order_id=${encodeURIComponent(orderId || transactionId)}`;

    return Response.redirect(redirectTarget, 302);
}
