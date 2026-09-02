// functions/api/auth/login.js — Customer Login API
import { initDb, verifyPassword, createCustomerToken, json, handleOptions } from "../_db.js";
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
        const email = (body.email || "").trim().toLowerCase();
        const password = body.password || "";

        if (!email || !password) {
            return json({ success: false, error: "Email and password are required" }, 400);
        }

        const customer = await env.DB.prepare("SELECT * FROM customers WHERE email = ?").bind(email).first();
        if (!customer) {
            return json({ success: false, error: "No account found with this email" }, 401);
        }

        const isValid = await verifyPassword(password, customer.password_hash);
        if (!isValid) {
            return json({ success: false, error: "Invalid password" }, 401);
        }

        const userSafe = {
            id: customer.id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone || "",
            created_at: customer.created_at
        };

        const token = createCustomerToken({ ...userSafe, password_hash: customer.password_hash });

        return json({
            success: true,
            message: "Login successful!",
            token,
            user: userSafe
        });
    } catch (e) {
        console.error("Login error:", e);
        return json({ success: false, error: "Login failed: " + e.message }, 500);
    }
}
