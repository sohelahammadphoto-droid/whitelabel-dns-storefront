// functions/api/_antibot.js — Smart Invisible Hybrid Anti-Bot & Anti-Scraping Engine
import { getSetting } from "./_db.js";

const KNOWN_BOT_USER_AGENTS = [
    "python-requests",
    "aiohttp",
    "httpclient",
    "curl/",
    "wget/",
    "scrapy",
    "libwww-perl",
    "go-http-client",
    "postmanruntime",
    "headlesschrome"
];

/**
 * Validates request against multi-layer invisible anti-bot shields
 * Returns { ok: true } or { ok: false, error: string, status: number }
 */
export async function verifyAntiBot(request, body, env) {
    const ua = (request.headers.get("User-Agent") || "").toLowerCase();

    // Layer 1: Block known aggressive automated scrapers / bot headers
    for (const botUa of KNOWN_BOT_USER_AGENTS) {
        if (ua.includes(botUa)) {
            return {
                ok: false,
                error: "Automated tool or bot detected. Please use a regular browser.",
                status: 403
            };
        }
    }

    if (!body || typeof body !== "object") {
        return { ok: true }; // Nothing to check
    }

    // Layer 2: Honeypot Traps (Invisible to real humans, auto-filled by spam bots)
    const honeypotFields = [
        body._hp_fax,
        body._hp_company,
        body.website_url_trap,
        body.phone_confirm_trap
    ];
    for (const val of honeypotFields) {
        if (val && typeof val === "string" && val.trim().length > 0) {
            return {
                ok: false,
                error: "Bot activity detected (honeypot triggered).",
                status: 400
            };
        }
    }

    // Layer 3: Timing Analysis (Instant submissions under 800ms are automated scripts)
    const abTimestamp = parseInt(body._ab_ts, 10);
    if (abTimestamp && !isNaN(abTimestamp)) {
        const now = Date.now();
        const elapsed = now - abTimestamp;

        // Submitting in less than 800ms from form mount is physically impossible for a human
        if (elapsed < 800) {
            return {
                ok: false,
                error: "Submission was unusually fast. Please try again normally.",
                status: 429
            };
        }

        // Token expired after 3 hours
        if (elapsed > 3 * 3600 * 1000) {
            return {
                ok: false,
                error: "Session security token expired. Please refresh the page and try again.",
                status: 400
            };
        }
    }

    // Layer 4: Client-Side Micro Proof-of-Work (PoW) validation
    // Lightweight check to ensure JavaScript executed in real browser
    if (body._ab_pow && typeof body._ab_pow === "string") {
        try {
            const [nonce, ts, hash] = body._ab_pow.split(":");
            if (nonce && ts && hash) {
                // Verify hash matches simple SHA-256 pattern
                const checkStr = `${nonce}:${ts}:ultradns_guard`;
                const expectedHash = await sha256Hex(checkStr);
                if (hash !== expectedHash) {
                    return {
                        ok: false,
                        error: "Security verification failed. Please ensure JavaScript is enabled.",
                        status: 403
                    };
                }
            }
        } catch (_) {
            // Ignore minor parse errors to avoid blocking legitimate users
        }
    }

    // Layer 5: Cloudflare Turnstile Verification (Optional - only if configured in Admin)
    const turnstileSecret = await getSetting(env, "turnstile_secret_key", "");
    const turnstileToken = (body.turnstile_token || "").trim();

    if (turnstileSecret && turnstileToken) {
        try {
            const clientIp = request.headers.get("CF-Connecting-IP") || "";
            const cfFormData = new FormData();
            cfFormData.append("secret", turnstileSecret);
            cfFormData.append("response", turnstileToken);
            if (clientIp) cfFormData.append("remoteip", clientIp);

            const cfRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
                method: "POST",
                body: cfFormData
            });
            const cfData = await cfRes.json();

            if (!cfData.success) {
                return {
                    ok: false,
                    error: "Turnstile verification failed. Please retry.",
                    status: 403
                };
            }
        } catch (e) {
            console.error("Turnstile verify error:", e);
            // In case Cloudflare verification endpoint has network issue, fail open or log warning
        }
    }

    return { ok: true };
}

// SHA-256 Helper for Edge / Cloudflare Workers
async function sha256Hex(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}
