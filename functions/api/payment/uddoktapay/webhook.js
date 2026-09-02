// functions/api/payment/uddoktapay/webhook.js — IPN Webhook Handler
import { initDb, getSetting, json, handleOptions } from "../../_db.js";
import { processCompletedPayment } from "./_process.js";

export async function onRequestOptions() {
    return handleOptions();
}

export async function onRequest(context) {
    if (context.request.method === "OPTIONS") return handleOptions();
    return onRequestPost(context);
}

export async function onRequestPost(context) {
    const { request, env } = context;
    await initDb(env);

    if (!env.DB) {
        return json({ success: false, error: "Database not configured" }, 500);
    }

    try {
        const receivedKey = request.headers.get("RT-UDDOKTAPAY-API-KEY") || 
                            request.headers.get("RT-PAYMENTLY-API-KEY") || 
                            request.headers.get("X-API-KEY") || 
                            request.headers.get("x-api-key") || "";
        const storedApiKey = await getSetting(env, "uddoktapay_api_key", "");

        if (!storedApiKey || (receivedKey && receivedKey !== storedApiKey)) {
            console.warn("UddoktaPay Webhook Signature Mismatch! Received:", receivedKey);
            return json({ success: false, error: "Unauthorized: Invalid API Key" }, 401);
        }

        const body = await request.json();
        console.log("UddoktaPay Webhook Payload:", JSON.stringify(body));

        const status = String(body.status || "").toUpperCase();
        if (status !== "COMPLETED") {
            return json({ success: true, message: `Status is ${status}, skipping.` });
        }

        const result = await processCompletedPayment(env, body);
        return json(result);
    } catch (e) {
        console.error("Webhook exception:", e);
        return json({ success: false, error: e.message }, 500);
    }
}
