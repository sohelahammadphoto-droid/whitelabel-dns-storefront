// functions/api/_antibot.js — Invisible Multi-Layer Anti-Bot & Anti-Scraping Defense
import { getSetting } from "./_db.js";

export async function verifyAntiBot(request, body, env) {
    // Layer 1: Honeypot trap check
    const honeypotFields = ["_hp_fax", "_hp_company", "website_url_trap"];
    for (const field of honeypotFields) {
        if (body && body[field] && String(body[field]).trim().length > 0) {
            return { ok: false, error: "Bot activity detected (HP-101)", status: 400 };
        }
    }

    // Layer 2: Rapid-fire submission timing analysis
    const clientTs = parseInt(body._ab_ts, 10);
    if (!clientTs || isNaN(clientTs)) {
        return { ok: false, error: "Security challenge missing. Please refresh.", status: 400 };
    }
    const elapsedMs = Date.now() - clientTs;
    if (elapsedMs < 600) {
        return { ok: false, error: "Submission too fast. Please take your time.", status: 400 };
    }

    // Layer 3: Client-side cryptographic Proof-of-Work (PoW) verification
    const powToken = body._ab_pow || "";
    const parts = powToken.split(":");
    if (parts.length === 3) {
        const [nonce, ts, hash] = parts;
        const raw = `${nonce}:${ts}:ultradns_guard`;
        try {
            const msgBuffer = new TextEncoder().encode(raw);
            const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
            const expectedHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
            if (hash !== expectedHash) {
                return { ok: false, error: "Security validation failed. Please refresh page.", status: 403 };
            }
        } catch {
            // Ignore if crypto subtle fails
        }
    }

    // Layer 4: Optional Cloudflare Turnstile token validation
    const turnstileSecret = await getSetting(env, "turnstile_secret_key", env.TURNSTILE_SECRET_KEY || "");
    const turnstileResponse = body["cf-turnstile-response"] || body.turnstile_token;
    if (turnstileSecret && turnstileResponse) {
        try {
            const formData = new FormData();
            formData.append("secret", turnstileSecret);
            formData.append("response", turnstileResponse);
            formData.append("remoteip", request.headers.get("CF-Connecting-IP") || "");

            const cfRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
                method: "POST",
                body: formData
            });
            const cfOutcome = await cfRes.json();
            if (!cfOutcome.success) {
                return { ok: false, error: "Turnstile captcha verification failed. Please try again.", status: 403 };
            }
        } catch (e) {
            console.error("Turnstile verify error:", e);
        }
    }

    return { ok: true };
}
