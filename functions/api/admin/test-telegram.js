// functions/api/admin/test-telegram.js — Test Telegram Bot Alert from Admin Panel
import { initDb, verifyAuth, getAllSettings, json, handleOptions } from "../_db.js";

export async function onRequest(context) {
    if (context.request.method === "OPTIONS") return handleOptions();
    return handleTestTelegram(context);
}

export async function onRequestOptions() {
    return handleOptions();
}

export async function onRequestPost(context) {
    return handleTestTelegram(context);
}

async function handleTestTelegram(context) {
    const { request, env } = context;
    try {
        await initDb(env);

        if (!await verifyAuth(request, env)) {
            return json({ success: false, error: "Unauthorized" }, 401);
        }

        let body = {};
        try {
            body = await request.json();
        } catch {
            body = {};
        }

        const s = await getAllSettings(env);
        const token = (body.bot_token || s.telegram_bot_token || env.TELEGRAM_BOT_TOKEN || "").trim();
        const chatId = (body.chat_id || s.telegram_chat_id || env.TELEGRAM_CHAT_ID || "").trim();

        if (!token) {
            return json({ success: false, error: "Telegram Bot Token is missing. Enter it in settings." }, 400);
        }
        if (!chatId) {
            return json({ success: false, error: "Telegram Chat ID is missing. Enter it in settings." }, 400);
        }

        const siteName = s.site_name || "UltraDNS Store";
        const testMsg = `🔔 <b>Telegram Order Alert Test</b>\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `✅ <b>Status:</b> Connected & Working!\n` +
            `🏪 <b>Store:</b> ${siteName}\n` +
            `⏰ <b>Timestamp:</b> ${new Date().toUTCString()}\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `🎉 Your store will automatically notify you here when new orders arrive!`;

        const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text: testMsg,
                parse_mode: "HTML"
            })
        });

        let data = {};
        try {
            data = await tgRes.json();
        } catch {
            data = {};
        }

        if (!tgRes.ok || !data.ok) {
            const errMsg = data.description || `Telegram API returned status ${tgRes.status}`;
            return json({
                success: false,
                error: errMsg,
                details: data
            }, 400);
        }

        return json({
            success: true,
            message: "✓ Test notification sent to Telegram successfully! Check your Telegram chat."
        });
    } catch (e) {
        return json({ success: false, error: "Server error: " + (e.message || String(e)) }, 500);
    }
}
