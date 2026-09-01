// functions/api/admin/test-email.js — Send Test Email from Admin Panel
import { initDb, verifyAuth, json, handleOptions } from "../_db.js";
import { sendOtpEmail } from "../_email.js";

export async function onRequest(context) {
    if (context.request.method === "OPTIONS") return handleOptions();
    return handleTestEmail(context);
}

export async function onRequestOptions() {
    return handleOptions();
}

export async function onRequestPost(context) {
    return handleTestEmail(context);
}

async function handleTestEmail(context) {
    const { request, env } = context;
    await initDb(env);

    const isAuthorized = await verifyAuth(request, env);
    if (!isAuthorized) {
        return json({ success: false, error: "Unauthorized" }, 401);
    }

    try {
        const body = await request.json();
        const testEmail = (body.test_email || "").trim();

        if (!testEmail || !testEmail.includes("@")) {
            return json({ success: false, error: "Please enter a valid recipient email" }, 400);
        }

        const testOtp = "123456";
        const result = await sendOtpEmail(env, testEmail, "Admin Tester", testOtp);

        if (result.success) {
            return json({
                success: true,
                message: `Test email sent successfully via [${result.provider}] to ${testEmail}! Check your inbox.`,
                provider: result.provider
            });
        } else {
            return json({
                success: false,
                error: result.error || "Failed to send email. Check credentials.",
                details: result.details || null
            }, 400);
        }
    } catch (e) {
        return json({ success: false, error: e.message }, 500);
    }
}
