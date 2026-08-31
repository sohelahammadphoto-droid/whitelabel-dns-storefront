// functions/api/auth/register.js — Customer Registration API
import { initDb, hashPassword, createCustomerToken, json, handleOptions } from "../_db.js";

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
        const name = (body.name || "").trim();
        const email = (body.email || "").trim().toLowerCase();
        const password = body.password || "";
        const phone = (body.phone || "").trim();

        if (!name) {
            return json({ success: false, error: "Name is required" }, 400);
        }

        if (!email || !email.includes("@") || !email.includes(".")) {
            return json({ success: false, error: "Valid Gmail/Email address is required" }, 400);
        }

        if (!password || password.length < 6) {
            return json({ success: false, error: "Password must be at least 6 characters long" }, 400);
        }

        // Check if email already registered
        const existing = await env.DB.prepare("SELECT id FROM customers WHERE email = ?").bind(email).first();
        if (existing) {
            return json({ success: false, error: "An account with this email already exists. Please log in." }, 409);
        }

        // Hash password & insert
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

        const token = createCustomerToken(customer);

        return json({
            success: true,
            message: "Account created successfully!",
            token,
            user: customer
        }, 201);
    } catch (e) {
        console.error("Register error:", e);
        return json({ success: false, error: "Registration failed: " + e.message }, 500);
    }
}
