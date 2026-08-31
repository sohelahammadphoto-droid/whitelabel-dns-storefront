// functions/api/auth/verify-otp.js — Customer OTP Verification & Final Account Creation
import { initDb, createCustomerToken, json, handleOptions } from "../_db.js";

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
        const otpCode = (body.otp_code || "").trim();

        if (!email || !otpCode) {
            return json({ success: false, error: "Email and 6-digit verification code are required" }, 400);
        }

        const otpRecord = await env.DB.prepare("SELECT * FROM otps WHERE email = ?").bind(email).first();
        if (!otpRecord) {
            return json({ success: false, error: "No pending verification found for this Gmail. Please register again." }, 404);
        }

        if (Date.now() > otpRecord.expires_at) {
            await env.DB.prepare("DELETE FROM otps WHERE email = ?").bind(email).run();
            return json({ success: false, error: "Verification code has expired. Please request a new code." }, 400);
        }

        if (otpRecord.otp_code !== otpCode) {
            return json({ success: false, error: "Invalid verification code. Please check your Gmail and try again." }, 400);
        }

        // OTP is correct! Extract temp data and create customer account
        let userData;
        try {
            userData = JSON.parse(otpRecord.temp_data);
        } catch {
            return json({ success: false, error: "Registration session corrupted. Please register again." }, 500);
        }

        // Insert into customers table
        const insertRes = await env.DB.prepare(`
            INSERT INTO customers (name, email, password_hash, phone)
            VALUES (?, ?, ?, ?)
        `).bind(userData.name, userData.email, userData.password_hash, userData.phone || "").run();

        // Clean up OTP record
        await env.DB.prepare("DELETE FROM otps WHERE email = ?").bind(email).run();

        const customerId = insertRes.meta.last_row_id;
        const customer = {
            id: customerId,
            name: userData.name,
            email: userData.email,
            phone: userData.phone || ""
        };

        const token = createCustomerToken(customer);

        return json({
            success: true,
            message: "Gmail verified and account activated successfully!",
            token,
            user: customer
        }, 201);
    } catch (e) {
        console.error("Verify OTP error:", e);
        return json({ success: false, error: "Verification failed: " + e.message }, 500);
    }
}
