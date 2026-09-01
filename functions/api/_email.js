// functions/api/_email.js — Multi-Provider Email, OTP & Order Approval Notification Dispatcher
import { getSetting } from "./_db.js";

// Helper to send 6-digit OTP code to Gmail
export async function sendOtpEmail(env, toEmail, toName, otpCode) {
    const provider = await getSetting(env, "email_provider", "none");
    const siteName = await getSetting(env, "site_name", "UltraDNS");

    if (provider === "none" || !provider) {
        return { success: false, skipped: true, error: "Email verification is disabled" };
    }

    const subject = `Your Verification Code: ${otpCode} — ${siteName}`;
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #090d16; color: #f8fafc; margin: 0; padding: 20px; }
            .card { max-width: 480px; margin: 0 auto; background: #121a2b; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 30px; }
            .header { text-align: center; margin-bottom: 25px; }
            .logo { font-size: 22px; font-weight: 800; color: #38bdf8; letter-spacing: -0.5px; }
            .badge { background: #6366f1; color: #fff; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 700; margin-left: 4px; }
            .title { font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 10px; }
            .text { font-size: 14px; color: #94a3b8; line-height: 1.5; margin-bottom: 20px; }
            .otp-box { background: rgba(99, 102, 241, 0.12); border: 2px dashed #6366f1; border-radius: 8px; padding: 18px; text-align: center; margin: 25px 0; }
            .otp-code { font-family: 'Courier New', monospace; font-size: 36px; font-weight: 900; letter-spacing: 10px; color: #38bdf8; }
            .footer { font-size: 12px; color: #64748b; text-align: center; margin-top: 25px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 15px; }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="header">
                <span class="logo">${siteName}</span>
                <span class="badge">SECURE</span>
            </div>
            <div class="title">Hello ${toName || 'User'},</div>
            <div class="text">
                Thank you for joining <b>${siteName}</b>. Please use the 6-digit verification code below to verify your Gmail address and activate your customer account:
            </div>
            <div class="otp-box">
                <div class="otp-code">${otpCode}</div>
            </div>
            <div class="text" style="font-size: 13px;">
                ⚡ This code is valid for <b>10 minutes</b>. Never share this code with anyone.
            </div>
            <div class="footer">
                &copy; ${new Date().getFullYear()} ${siteName}. All rights reserved.<br>
                Automated Security Verification.
            </div>
        </div>
    </body>
    </html>
    `;

    return sendViaBrevo(env, toEmail, toName, subject, htmlContent, siteName);
}

// Helper to send instant Order Approval & DNS Credentials Email
export async function sendOrderApprovedEmail(env, toEmail, toName, orderDetails) {
    const provider = await getSetting(env, "email_provider", "none");
    const siteName = await getSetting(env, "site_name", "UltraDNS");

    if (provider === "none" || !provider) {
        return { success: false, skipped: true };
    }

    const { order_id, plan_name, client_id, dns_url, expire_date } = orderDetails;
    const subject = `🎉 Order Approved & DNS Active: ${order_id} — ${siteName}`;

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #090d16; color: #f8fafc; margin: 0; padding: 20px; }
            .card { max-width: 520px; margin: 0 auto; background: #121a2b; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 30px; }
            .logo { font-size: 22px; font-weight: 800; color: #38bdf8; text-align: center; margin-bottom: 20px; }
            .box { background: rgba(0,0,0,0.35); border: 1px solid rgba(99,102,241,0.3); border-radius: 8px; padding: 18px; margin: 20px 0; }
            .dns-host { font-family: monospace; font-size: 16px; color: #38bdf8; font-weight: 800; padding: 8px 12px; background: rgba(56,189,248,0.1); border-radius: 6px; }
            .footer { font-size: 12px; color: #64748b; text-align: center; margin-top: 25px; }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="logo">⚡ ${siteName}</div>
            <h3 style="color:#fff; margin-bottom:8px;">Hello ${toName || 'Valued Customer'},</h3>
            <p style="color:#cbd5e1; font-size:14px;">Your order <b>${order_id}</b> for <b>${plan_name}</b> has been verified and approved!</p>
            
            <div class="box">
                <div style="font-size:12px; color:#94a3b8; margin-bottom:4px;">YOUR ASSIGNED PRIVATE DNS HOSTNAME:</div>
                <div class="dns-host">${dns_url}</div>
                <div style="margin-top:12px; font-size:13px; color:#cbd5e1;">
                    <div>👤 <b>PIN / Username:</b> <code>${client_id}</code></div>
                    <div>⏳ <b>Expires:</b> ${expire_date || 'Active'}</div>
                </div>
            </div>

            <h4 style="color:#38bdf8; font-size:14px; margin-bottom:8px;">📱 Quick Setup:</h4>
            <ol style="color:#94a3b8; font-size:13px; padding-left:20px; line-height:1.6;">
                <li>Android: Settings ➔ Connections ➔ Private DNS ➔ Enter <code>${dns_url}</code></li>
                <li>iOS: Login to your account to download the 1-Click DNS Profile.</li>
            </ol>

            <div class="footer">
                &copy; ${new Date().getFullYear()} ${siteName}. Fast & Encrypted Private DNS.
            </div>
        </div>
    </body>
    </html>
    `;

    return sendViaBrevo(env, toEmail, toName, subject, htmlContent, siteName);
}

async function sendViaBrevo(env, toEmail, toName, subject, htmlContent, siteName) {
    const apiKey = await getSetting(env, "brevo_api_key", "");
    const senderEmail = await getSetting(env, "brevo_sender_email", "");
    const senderName = await getSetting(env, "brevo_sender_name", siteName);

    if (!apiKey || !senderEmail) {
        return { success: false, error: "Brevo API credentials not configured in admin" };
    }

    try {
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                "accept": "application/json",
                "api-key": apiKey,
                "content-type": "application/json"
            },
            body: JSON.stringify({
                sender: { name: senderName, email: senderEmail },
                to: [{ email: toEmail, name: toName || toEmail }],
                subject: subject,
                htmlContent: htmlContent
            })
        });

        const data = await res.json();
        if (res.ok) {
            return { success: true, messageId: data.messageId, provider: "brevo" };
        } else {
            return { success: false, error: data.message || "Brevo email failed" };
        }
    } catch (e) {
        return { success: false, error: e.message };
    }
}
