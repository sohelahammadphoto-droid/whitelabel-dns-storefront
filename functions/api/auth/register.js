// functions/api/auth/register.js — Customer Registration & Optional Gmail OTP API
import { initDb, hashPassword, createCustomerToken, getSetting, json, handleOptions } from "../_db.js";
import { sendOtpEmail } from "../_email.js";
import { verifyAntiBot } from "../_antibot.js";

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

        // 🛡️ Invisible Anti-Bot & Anti-Scraping Check
        const antiBot = await verifyAntiBot(request, body, env);
        if (!antiBot.ok) {
            return json({ success: false, error: antiBot.error }, antiBot.status || 400);
        }
        const name = (body.name || "").trim();
        const email = (body.email || "").trim().toLowerCase();
        const password = body.password || "";
        const phone = (body.phone || "").trim();

        if (!name) {
            return json({ success: false, error: "Name is required" }, 400);
        }

        // Strict Gmail Validation
        if (!email || !email.endsWith("@gmail.com")) {
            return json({ success: false, error: "Only valid @gmail.com addresses are allowed for registration" }, 400);
        }

        if (!password || password.length < 6) {
            return json({ success: false, error: "Password must be at least 6 characters long" }, 400);
        }

        // Check if email already registered
        const existing = await env.DB.prepare("SELECT id FROM customers WHERE email = ?").bind(email).first();
        if (existing) {
            return json({ success: false, error: "An account with this Gmail already exists. Please log in." }, 409);
        }

        const emailProvider = await getSetting(env, "email_provider", "none");

        // If email verification is enabled (brevo / gmail_smtp)
        if (emailProvider && emailProvider !== "none") {
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
            const passwordHash = await hashPassword(password);
            const tempData = JSON.stringify({ name, email, password_hash: passwordHash, phone });
            const expiresAt = Date.now() + 10 * 60 * 1000; // 10 mins

            await env.DB.prepare(`
                INSERT INTO otps (email, otp_code, temp_data, expires_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(email) DO UPDATE SET otp_code = excluded.otp_code, temp_data = excluded.temp_data, expires_at = excluded.expires_at
            `).bind(email, otpCode, tempData, expiresAt).run();

            // Send OTP email
            const sendResult = await sendOtpEmail(env, email, name, otpCode);
            if (!sendResult.success && !sendResult.skipped) {
                console.error("Email send failed:", sendResult.error);
                return json({ 
                    success: false, 
                    error: "Failed to send OTP email: " + (sendResult.error || "Please contact admin.") 
                }, 500);
            }

            return json({
                success: true,
                needs_otp: true,
                message: `Verification code sent to ${email}. Please check your inbox or spam folder.`,
                email: email
            });
        }

        // Direct Registration when OTP is disabled
        const passwordHash = await hashPassword(password);
        const insertRes = await env.DB.prepare(`
            INSERT INTO customers (name, email, password_hash, phone)
            VALUES (?, ?, ?, ?)
        `).bind(name, email, passwordHash, phone).run();

        const customerId = insertRes.meta.last_row_id;
        const customer = {
            id: customerId,
            name,
            email,
            phone
        };

        const token = createCustomerToken({ ...customer, password_hash: passwordHash });

        return json({
            success: true,
            needs_otp: false,
            message: "Account created successfully!",
            token,
            user: customer
        }, 201);
    } catch (e) {
        console.error("Register error:", e);
        return json({ success: false, error: "Registration failed: " + e.message }, 500);
    }
}
