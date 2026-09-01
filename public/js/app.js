// public/js/app.js — Dynamic Storefront Theme, Content & Mobile Logic
let siteConfig = null;
let currentPlan = null;
let customerToken = localStorage.getItem("customer_token") || "";
let customerUser = JSON.parse(localStorage.getItem("customer_user") || "null");
const antiBotMountedAt = Date.now();

document.addEventListener("DOMContentLoaded", () => {
    const footerYear = document.getElementById("footer-year");
    if (footerYear) footerYear.textContent = new Date().getFullYear();
    
    loadSiteConfig();
    renderNavbarAuth();
    if (customerToken) {
        fetchCustomerData();
    }
});

// Mobile Navigation Toggle
window.toggleMobileMenu = function() {
    const drawer = document.getElementById("mobile-drawer");
    if (drawer) {
        drawer.classList.toggle("active");
    }
};

window.closeMobileMenu = function() {
    const drawer = document.getElementById("mobile-drawer");
    if (drawer) {
        drawer.classList.remove("active");
    }
};

// 🛡️ Client-Side Invisible Anti-Bot Token Generator
async function generateAntiBotPayload() {
    const ts = antiBotMountedAt.toString();
    const nonce = Math.floor(100000 + Math.random() * 900000).toString();
    const raw = `${nonce}:${ts}:ultradns_guard`;
    
    let hash = "";
    try {
        const msgBuffer = new TextEncoder().encode(raw);
        const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
        hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
    } catch (_) {
        hash = "fallback";
    }

    return {
        _ab_ts: ts,
        _ab_pow: `${nonce}:${ts}:${hash}`,
        _hp_fax: "",
        _hp_company: "",
        website_url_trap: ""
    };
}

// Load dynamic config from D1 Database & Inject Live Theme Tokens
async function loadSiteConfig() {
    try {
        const res = await fetch("/api/config");
        const json = await res.json();
        if (json.success && json.data) {
            siteConfig = json.data;
            applyThemeTokens();
            renderConfig();
        }
    } catch (e) {
        console.error("Failed to load config:", e);
    }
}

// 🎨 Live CSS Variables & Theme Injection
function applyThemeTokens() {
    if (!siteConfig) return;
    const root = document.documentElement;

    if (siteConfig.theme_primary) {
        root.style.setProperty("--primary", siteConfig.theme_primary);
        root.style.setProperty("--border-glow", `${siteConfig.theme_primary}4D`);
    }
    if (siteConfig.theme_primary_hover) {
        root.style.setProperty("--primary-hover", siteConfig.theme_primary_hover);
    }
    if (siteConfig.theme_accent) {
        root.style.setProperty("--accent-cyan", siteConfig.theme_accent);
    }
    if (siteConfig.theme_bg_mode) {
        document.body.dataset.bg = siteConfig.theme_bg_mode;
    }
}

// Render dynamic texts, hero titles, buttons and announcements
function renderConfig() {
    if (!siteConfig) return;

    // --- 1. Branding & Logo & Favicon ---
    const logoImg = document.getElementById("site-logo-img");
    const logoIcon = document.getElementById("site-logo-icon");

    if (siteConfig.site_logo && logoImg) {
        logoImg.src = siteConfig.site_logo;
        logoImg.style.display = "inline-block";
        if (logoIcon) logoIcon.style.display = "none";
    } else {
        if (logoImg) logoImg.style.display = "none";
        if (logoIcon) logoIcon.style.display = "inline-flex";
    }

    if (siteConfig.site_favicon) {
        const favEl = document.getElementById("site-favicon");
        if (favEl) favEl.href = siteConfig.site_favicon;
    }

    if (siteConfig.site_name) {
        const el = document.getElementById("site-name");
        if (el) el.textContent = siteConfig.site_name;
        document.title = `${siteConfig.site_name} — High Speed & Banking DNS Access`;
    }
    if (siteConfig.site_badge) {
        const el = document.getElementById("site-badge");
        if (el) el.textContent = siteConfig.site_badge;
    }
    if (siteConfig.owner_name) {
        const el = document.getElementById("footer-owner");
        if (el) el.textContent = siteConfig.owner_name;
    }

    // --- 2. Notice Announcement Bar ---
    const noticeWrap = document.getElementById("notice-bar-wrap");
    const noticeText = document.getElementById("notice-text");
    if (noticeWrap && noticeText) {
        if (siteConfig.notice_enabled === false) {
            noticeWrap.style.display = "none";
        } else {
            noticeWrap.style.display = "block";
            if (siteConfig.notice) noticeText.textContent = siteConfig.notice;
        }
    }

    // --- 3. Hero Section ---
    if (siteConfig.hero_pill_text) {
        const el = document.getElementById("hero-pill");
        if (el) el.textContent = siteConfig.hero_pill_text;
    }
    if (siteConfig.hero_title_line1) {
        const el = document.getElementById("hero-title-line1");
        if (el) el.textContent = siteConfig.hero_title_line1;
    }
    if (siteConfig.hero_title_line2) {
        const el = document.getElementById("hero-title-line2");
        if (el) el.textContent = siteConfig.hero_title_line2;
    }
    if (siteConfig.hero_subtitle) {
        const el = document.getElementById("hero-subtitle");
        if (el) el.textContent = siteConfig.hero_subtitle;
    }
    if (siteConfig.btn_hero_buy_text) {
        const el = document.getElementById("btn-hero-buy");
        if (el) el.textContent = siteConfig.btn_hero_buy_text;
    }
    if (siteConfig.btn_hero_check_text) {
        const el = document.getElementById("btn-hero-check");
        if (el) el.textContent = siteConfig.btn_hero_check_text;
    }

    // --- 4. Features Section ---
    if (siteConfig.features_title) {
        const el = document.getElementById("features-title");
        if (el) el.textContent = siteConfig.features_title;
    }
    if (siteConfig.features_subtitle) {
        const el = document.getElementById("features-subtitle");
        if (el) el.textContent = siteConfig.features_subtitle;
    }

    // --- 5. Pricing Section ---
    if (siteConfig.pricing_title) {
        const el = document.getElementById("pricing-title");
        if (el) el.textContent = siteConfig.pricing_title;
    }
    if (siteConfig.pricing_subtitle) {
        const el = document.getElementById("pricing-subtitle");
        if (el) el.textContent = siteConfig.pricing_subtitle;
    }

    // --- 6. Status Checker ---
    if (siteConfig.checker_title) {
        const el = document.getElementById("checker-title");
        if (el) el.textContent = siteConfig.checker_title;
    }
    if (siteConfig.checker_subtitle) {
        const el = document.getElementById("checker-subtitle");
        if (el) el.textContent = siteConfig.checker_subtitle;
    }
    if (siteConfig.checker_input_placeholder) {
        const el = document.getElementById("checker-query");
        if (el) el.placeholder = siteConfig.checker_input_placeholder;
    }
    if (siteConfig.btn_checker_text) {
        const el = document.getElementById("btn-checker");
        if (el) el.textContent = siteConfig.btn_checker_text;
    }

    // --- 7. Floating WhatsApp Support Button ---
    const waLink = document.getElementById("whatsapp-link");
    if (waLink) {
        if (siteConfig.floating_support_enabled !== false && siteConfig.support_whatsapp) {
            const cleanWa = siteConfig.support_whatsapp.replace(/[^0-9]/g, "");
            const customMsg = encodeURIComponent(siteConfig.support_whatsapp_msg || "Hello, I need assistance with Private DNS");
            waLink.href = `https://api.whatsapp.com/send?phone=${cleanWa}&text=${customMsg}`;
            waLink.style.display = "flex";
        } else {
            waLink.style.display = "none";
        }
    }

    renderPlans();
    renderPaymentMethods();
}

function renderPlans() {
    const container = document.getElementById("plans-container");
    if (!siteConfig || !siteConfig.plans || !container) return;

    const btnText = siteConfig.btn_plan_card_text || "⚡ Get Instant Access";

    container.innerHTML = siteConfig.plans.map(p => `
        <div class="pricing-card ${p.popular ? 'popular' : ''}">
            ${p.badge ? `<div class="card-badge">${p.badge}</div>` : ''}
            <div class="card-plan-name">${p.name}</div>
            <div class="price-wrap">
                <span class="price-val">${p.price}</span>
                <span class="price-cur">${siteConfig.currency_symbol || '﷼'}</span>
                <span class="price-period">/ ${p.duration_days} Days</span>
            </div>
            <ul class="feature-list">
                ${(p.features || []).map(f => `<li><span class="check-icon">✓</span> ${f}</li>`).join('')}
            </ul>
            <button class="plan-btn ${p.popular ? 'plan-btn-popular' : ''}" onclick="openOrderModal('${p.id}')">
                ${btnText}
            </button>
        </div>
    `).join('');
}

function renderPaymentMethods() {
    const select = document.getElementById("order-payment-method");
    if (!siteConfig || !siteConfig.payment_methods || !select) return;

    select.innerHTML = siteConfig.payment_methods.map(m => `
        <option value="${m.id}">${m.name} (${m.number})</option>
    `).join('');
    updatePaymentInstruction();
}

function updatePaymentInstruction() {
    const select = document.getElementById("order-payment-method");
    if (!siteConfig || !siteConfig.payment_methods || !select) return;

    const selected = siteConfig.payment_methods.find(m => m.id === select.value) || siteConfig.payment_methods[0];
    if (selected) {
        const textEl = document.getElementById("payment-instruction-text");
        const numEl = document.getElementById("payment-number-display");
        if (textEl) textEl.textContent = selected.instructions || `Send payment to ${selected.name} number below and enter TrxID.`;
        if (numEl) numEl.textContent = `${selected.number} (${selected.account_name || 'Personal'})`;
    }
}

function copyPaymentNumber() {
    const numDisplay = document.getElementById("payment-number-display");
    if (!numDisplay) return;
    const numText = numDisplay.textContent.split(' ')[0];
    navigator.clipboard.writeText(numText).then(() => {
        alert("Payment number copied: " + numText);
    });
}

// ----------------------------------------------------
// Customer Authentication & Navbar Handling
// ----------------------------------------------------
function renderNavbarAuth() {
    const container = document.getElementById("nav-auth-container");
    const mobileContainer = document.getElementById("mobile-nav-auth-container");

    const content = (customerToken && customerUser) ? `
        <div class="user-btn-wrap">
            <button class="user-pill" onclick="openUserModal()">
                <span>👤</span> <span>${customerUser.name.split(' ')[0]}</span>
            </button>
        </div>
    ` : `
        <button class="nav-btn" onclick="openAuthModal()">🔑 Sign In</button>
    `;

    if (container) container.innerHTML = content;
    if (mobileContainer) {
        mobileContainer.innerHTML = (customerToken && customerUser) ? `
            <button class="btn-primary" style="width: 100%; justify-content: center;" onclick="closeMobileMenu(); openUserModal();">
                👤 My Account (${customerUser.name.split(' ')[0]})
            </button>
        ` : `
            <button class="btn-primary" style="width: 100%; justify-content: center;" onclick="closeMobileMenu(); openAuthModal();">
                🔑 Sign In / Account
            </button>
        `;
    }
}

function openAuthModal(defaultTab = 'login') {
    const modal = document.getElementById("auth-modal");
    if (modal) modal.style.display = "flex";
    switchAuthTab(defaultTab);
}

function closeAuthModal() {
    const modal = document.getElementById("auth-modal");
    if (modal) modal.style.display = "none";
}

let pendingOtpEmail = "";
let resendTimer = null;

function switchAuthTab(tab) {
    const isLogin = tab === 'login';
    const isRegister = tab === 'register';
    const isOtp = tab === 'otp';

    const loginTabBtn = document.getElementById("tab-login-btn");
    const regTabBtn = document.getElementById("tab-register-btn");
    if (loginTabBtn) loginTabBtn.classList.toggle("active", isLogin);
    if (regTabBtn) regTabBtn.classList.toggle("active", isRegister);
    
    const loginForm = document.getElementById("login-form");
    const regForm = document.getElementById("register-form");
    const otpForm = document.getElementById("otp-form");

    if (loginForm) loginForm.style.display = isLogin ? "block" : "none";
    if (regForm) regForm.style.display = isRegister ? "block" : "none";
    if (otpForm) otpForm.style.display = isOtp ? "block" : "none";
}

async function handleCustomerLogin(e) {
    e.preventDefault();
    const btn = document.getElementById("login-submit-btn");
    btn.disabled = true;
    btn.textContent = "Signing In...";

    const antiBot = await generateAntiBotPayload();
    const payload = {
        ...antiBot,
        email: document.getElementById("login-email").value.trim(),
        password: document.getElementById("login-password").value
    };

    try {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
            customerToken = data.token;
            customerUser = data.user;
            localStorage.setItem("customer_token", customerToken);
            localStorage.setItem("customer_user", JSON.stringify(customerUser));
            closeAuthModal();
            renderNavbarAuth();
            openUserModal();
        } else {
            alert("❌ " + (data.error || "Login failed"));
        }
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Sign In to Account";
    }
}

async function handleCustomerRegister(e) {
    e.preventDefault();
    const btn = document.getElementById("reg-submit-btn");
    btn.disabled = true;
    btn.textContent = "Creating Account...";

    const antiBot = await generateAntiBotPayload();
    const payload = {
        ...antiBot,
        name: document.getElementById("reg-name").value.trim(),
        email: document.getElementById("reg-email").value.trim(),
        phone: document.getElementById("reg-phone").value.trim(),
        password: document.getElementById("reg-password").value
    };

    try {
        const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
            if (data.requireOtp) {
                pendingOtpEmail = payload.email;
                document.getElementById("otp-display-email").textContent = pendingOtpEmail;
                switchAuthTab('otp');
                startResendCountdown();
            } else {
                customerToken = data.token;
                customerUser = data.user;
                localStorage.setItem("customer_token", customerToken);
                localStorage.setItem("customer_user", JSON.stringify(customerUser));
                closeAuthModal();
                renderNavbarAuth();
                openUserModal();
            }
        } else {
            alert("❌ " + (data.error || "Registration failed"));
        }
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "✨ Create Account";
    }
}

async function handleVerifyOtp(e) {
    e.preventDefault();
    const btn = document.getElementById("otp-submit-btn");
    const code = document.getElementById("otp-input-code").value.trim();

    btn.disabled = true;
    btn.textContent = "Verifying...";

    try {
        const res = await fetch("/api/auth/verify-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: pendingOtpEmail, otp: code })
        });
        const data = await res.json();

        if (data.success) {
            customerToken = data.token;
            customerUser = data.user;
            localStorage.setItem("customer_token", customerToken);
            localStorage.setItem("customer_user", JSON.stringify(customerUser));
            closeAuthModal();
            renderNavbarAuth();
            openUserModal();
        } else {
            alert("❌ " + (data.error || "Invalid OTP code"));
        }
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "✓ Verify & Activate Account";
    }
}

function startResendCountdown() {
    let seconds = 60;
    const btn = document.getElementById("otp-resend-btn");
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = `Resend in ${seconds}s`;

    if (resendTimer) clearInterval(resendTimer);

    resendTimer = setInterval(() => {
        seconds--;
        if (seconds > 0) {
            btn.textContent = `Resend in ${seconds}s`;
        } else {
            clearInterval(resendTimer);
            btn.disabled = false;
            btn.textContent = "Resend Code";
        }
    }, 1000);
}

function handleCustomerLogout() {
    localStorage.removeItem("customer_token");
    localStorage.removeItem("customer_user");
    customerToken = "";
    customerUser = null;
    closeUserModal();
    renderNavbarAuth();
    alert("You have logged out.");
}

// ----------------------------------------------------
// Customer Account Dashboard & Active DNS Fetching
// ----------------------------------------------------
async function openUserModal() {
    if (!customerToken) {
        return openAuthModal();
    }
    const modal = document.getElementById("user-modal");
    if (modal) modal.style.display = "flex";

    const nameEl = document.getElementById("user-display-name");
    const emailEl = document.getElementById("user-display-email");
    if (nameEl) nameEl.textContent = customerUser ? customerUser.name : "My Account";
    if (emailEl) emailEl.textContent = customerUser ? customerUser.email : "";
    fetchCustomerData();
}

function closeUserModal() {
    const modal = document.getElementById("user-modal");
    if (modal) modal.style.display = "none";
}

async function fetchCustomerData() {
    try {
        const res = await fetch("/api/user/me", {
            headers: { "Authorization": `Bearer ${customerToken}` }
        });
        const data = await res.json();

        if (!data.success) {
            if (res.status === 401) {
                handleCustomerLogout();
            }
            return;
        }

        renderUserActiveDns(data.active_dns);
        renderUserOrderHistory(data.orders);
    } catch (e) {
        console.error("Failed to load customer profile:", e);
    }
}

function renderUserActiveDns(activeDnsList) {
    const container = document.getElementById("user-active-services");
    if (!container) return;

    if (!activeDnsList || activeDnsList.length === 0) {
        container.innerHTML = `
            <div style="background: rgba(0,0,0,0.2); border: 1px dashed var(--border-color); border-radius: 8px; padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">
                No active Private DNS subscription found.<br>Choose a plan below to activate instant DNS access.
            </div>
        `;
        return;
    }

    container.innerHTML = activeDnsList.map(dns => `
        <div class="active-dns-card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #38bdf8;">${dns.plan_name}</span>
                    <h4 style="font-size: 16px; color: #fff; margin: 4px 0;">DNS Host: <code style="color: #38bdf8; font-size: 14px;">${dns.dns_url}</code></h4>
                    <span style="font-size: 12px; color: var(--text-muted);">PIN: <b style="color:#fff;">${dns.client_id}</b> | Expires: <b>${dns.expire_date || 'Active'}</b></span>
                </div>
                <span class="badge badge-approved">ACTIVE</span>
            </div>

            <div style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap;">
                <button class="btn-primary" style="padding: 6px 12px; font-size: 12px;" onclick="navigator.clipboard.writeText('${dns.dns_url}').then(() => alert('Copied DNS Hostname: ${dns.dns_url}'))">
                    📋 Copy Hostname
                </button>
                <button class="btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="downloadIosProfile('${dns.client_id}', '${dns.dns_url}')">
                    🍏 iOS Profile
                </button>
            </div>
        </div>
    `).join('');
}

function renderUserOrderHistory(orders) {
    const container = document.getElementById("user-order-history");
    if (!container) return;

    if (!orders || orders.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 15px; font-size: 13px;">No orders found</div>`;
        return;
    }

    container.innerHTML = orders.map(o => `
        <div class="order-history-item">
            <div>
                <b style="color:#fff; font-size: 13px;">${o.order_id}</b>
                <div style="font-size: 11px; color: var(--text-muted);">${o.plan_name} • ${o.amount} ${o.currency}</div>
            </div>
            <div style="text-align: right;">
                <span class="badge badge-${o.status}">${o.status}</span>
                ${o.dns_url ? `<div style="font-size: 11px; color: #38bdf8; margin-top: 2px;"><code>${o.dns_url}</code></div>` : ''}
            </div>
        </div>
    `).join('');
}

function downloadIosProfile(clientId, dotDomain) {
    const cleanHost = (dotDomain || `${clientId}.dnsbd.pp.ua`).trim();
    const mobileconfig = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>DNSSettings</key>
            <dict>
                <key>DNSProtocol</key>
                <string>HTTPS</string>
                <key>ServerURL</key>
                <string>https://${cleanHost}/dns-query</string>
            </dict>
            <key>PayloadDescription</key>
            <string>Configures Encrypted DNS-over-HTTPS for ${cleanHost}</string>
            <key>PayloadDisplayName</key>
            <string>Private DNS (${clientId})</string>
            <key>PayloadIdentifier</key>
            <string>com.dns.profile.${clientId}</string>
            <key>PayloadType</key>
            <string>com.apple.dnsSettings.managed</string>
            <key>PayloadUUID</key>
            <string>${crypto.randomUUID()}</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
        </dict>
    </array>
    <key>PayloadDisplayName</key>
    <string>Private DNS Access (${clientId})</string>
    <key>PayloadIdentifier</key>
    <string>com.dns.profile.${clientId}.main</string>
    <key>PayloadRemovalDisallowed</key>
    <false/>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>${crypto.randomUUID()}</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
</dict>
</plist>`;

    const blob = new Blob([mobileconfig], { type: "application/x-apple-aspen-config" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${clientId}-dns.mobileconfig`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ----------------------------------------------------
// Order Modal Handling & Submission
// ----------------------------------------------------
function openOrderModal(planId) {
    if (!siteConfig || !siteConfig.plans) return;
    currentPlan = siteConfig.plans.find(p => p.id === planId) || siteConfig.plans[0];

    const planIdEl = document.getElementById("order-plan-id");
    const planTitleEl = document.getElementById("modal-plan-title");
    const planPriceEl = document.getElementById("modal-plan-price");

    if (planIdEl) planIdEl.value = currentPlan.id;
    if (planTitleEl) planTitleEl.textContent = `Order ${currentPlan.name}`;
    if (planPriceEl) planPriceEl.textContent = `${currentPlan.price} ${siteConfig.currency_symbol || '﷼'}`;

    // Auto-fill if user logged in
    if (customerUser) {
        const nameIn = document.getElementById("order-name");
        const phoneIn = document.getElementById("order-phone");
        const emailIn = document.getElementById("order-email");
        if (nameIn) nameIn.value = customerUser.name || "";
        if (phoneIn) phoneIn.value = customerUser.phone || "";
        if (emailIn) emailIn.value = customerUser.email || "";
    }

    const modal = document.getElementById("order-modal");
    if (modal) modal.style.display = "flex";
}

function closeOrderModal() {
    const modal = document.getElementById("order-modal");
    if (modal) modal.style.display = "none";
}

async function submitOrder(e) {
    e.preventDefault();
    const btn = document.getElementById("order-submit-btn");
    btn.disabled = true;
    btn.textContent = "Processing Order...";

    const antiBot = await generateAntiBotPayload();
    const payload = {
        ...antiBot,
        plan_id: currentPlan.id,
        plan_name: currentPlan.name,
        duration_days: currentPlan.duration_days,
        amount: currentPlan.price,
        currency: siteConfig.currency || "SAR",
        customer_name: document.getElementById("order-name").value.trim(),
        customer_phone: document.getElementById("order-phone").value.trim(),
        customer_email: document.getElementById("order-email").value.trim(),
        payment_method: document.getElementById("order-payment-method").value,
        trx_id: document.getElementById("order-trx").value.trim()
    };

    const headers = { "Content-Type": "application/json" };
    if (customerToken) {
        headers["Authorization"] = `Bearer ${customerToken}`;
    }

    try {
        const res = await fetch("/api/order", {
            method: "POST",
            headers: headers,
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
            alert(`🎉 ${data.message}\n\nOrder ID: ${data.data.order_id}\nAmount: ${data.data.amount} ${data.data.currency}`);
            closeOrderModal();
            if (customerToken) {
                fetchCustomerData();
                openUserModal();
            }
        } else {
            alert("❌ " + (data.error || "Order submission failed"));
        }
    } catch (err) {
        alert("❌ Connection error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Confirm & Submit Order";
    }
}

// ----------------------------------------------------
// Public DNS Status Checker
// ----------------------------------------------------
async function checkDnsStatus() {
    const input = document.getElementById("checker-query");
    const resultBox = document.getElementById("checker-result");
    const btn = document.getElementById("btn-checker");

    const query = (input ? input.value : "").trim();
    if (!query) {
        alert("Please enter your Phone Number or DNS PIN");
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = "Checking...";
    }
    resultBox.style.display = "none";

    try {
        const res = await fetch(`/api/check-status?q=${encodeURIComponent(query)}`);
        const json = await res.json();

        resultBox.style.display = "block";
        if (json.success && json.data) {
            const d = json.data;
            resultBox.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <b style="color: #38bdf8; font-size: 16px;">${d.client_id || d.order_id}</b>
                    <span class="badge badge-${d.status}">${d.status}</span>
                </div>
                <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.6;">
                    <div>🌐 <b>Private DNS:</b> <code style="color: #fff;">${d.dns_url || 'Pending Activation'}</code></div>
                    <div>⏳ <b>Validity:</b> ${d.duration_days ? `${d.duration_days} Days` : '--'} (Expires: ${d.expire_date || 'N/A'})</div>
                    <div>👤 <b>Customer:</b> ${d.customer_name}</div>
                </div>
                ${d.dns_url ? `
                    <div style="margin-top: 14px; display: flex; gap: 8px;">
                        <button class="btn-primary" style="padding: 6px 14px; font-size: 12px;" onclick="navigator.clipboard.writeText('${d.dns_url}').then(() => alert('Copied DNS Hostname: ${d.dns_url}'))">
                            📋 Copy DNS Hostname
                        </button>
                    </div>
                ` : ''}
            `;
        } else {
            resultBox.innerHTML = `
                <div style="color: #f87171; font-size: 13px; text-align: center;">
                    ❌ ${json.error || "No active order or PIN found matching your query."}
                </div>
            `;
        }
    } catch (e) {
        resultBox.style.display = "block";
        resultBox.innerHTML = `<div style="color: #f87171; font-size: 13px;">Error: ${e.message}</div>`;
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = siteConfig && siteConfig.btn_checker_text ? siteConfig.btn_checker_text : "Check Status";
        }
    }
}
