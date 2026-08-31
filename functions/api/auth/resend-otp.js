// functions/api/auth/resend-otp.js — Resend Gmail OTP API
import { initDb, json, handleOptions } from "../_db.js";
import { sendOtpEmail } from "../_email.js";

export async function onRequestOptions() {
    return handleOptions();
}

export async function onRequestPost(context) {
    const { request, env } = context;
    await initDb(env);

    if (!env.DB) {
        return json({ success: false, error: "Database not configured" }, 500);
    }

    try {
        const body = await request.json();
        const email = (body.email || "").trim().toLowerCase();

        if (!email) {
            return json({ success: false, error: "Email is required" }, 400);
        }

        const otpRecord = await env.DB.prepare("SELECT * FROM otps WHERE email = ?").bind(email).first();
        if (!otpRecord) {
            return json({ success: false, error: "No pending registration found for this email." }, 404);
        }

        const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 10 * 60 * 1000;

        await env.DB.prepare("UPDATE otps SET otp_code = ?, expires_at = ? WHERE email = ?")
            .bind(newOtp, expiresAt, email).run();

        let userData = {};
        try { userData = JSON.parse(otpRecord.temp_data); } catch {}

        const sendResult = await sendOtpEmail(env, email, userData.name || "", newOtp);
        if (!sendResult.success && !sendResult.skipped) {
            return json({ success: false, error: "Failed to resend email: " + sendResult.error }, 500);
        }

        return json({
            success: true,
            message: `A new verification code has been sent to ${email}`
        });
    } catch (e) {
        return json({ success: false, error: e.message }, 500);
    }
}
