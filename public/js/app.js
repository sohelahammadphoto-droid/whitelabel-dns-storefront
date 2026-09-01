// public/js/app.js — Dynamic Storefront Theme, Content & Mobile Logic
let siteConfig = null;
let currentPlan = null;
let selectedCurrency = localStorage.getItem("selected_currency") || "SAR";
let currentCoupon = null;
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

// Mobile Navigation Toggle with animated hamburger ↔ X
window.toggleMobileMenu = function() {
    const drawer = document.getElementById("mobile-drawer");
    const btn = document.getElementById("mobile-toggle-btn");
    if (drawer) drawer.classList.toggle("active");
    if (btn) btn.classList.toggle("active");
};

window.closeMobileMenu = function() {
    const drawer = document.getElementById("mobile-drawer");
    const btn = document.getElementById("mobile-toggle-btn");
    if (drawer) drawer.classList.remove("active");
    if (btn) btn.classList.remove("active");
};

// Close mobile menu on outside click
document.addEventListener("click", function(e) {
    const drawer = document.getElementById("mobile-drawer");
    const btn = document.getElementById("mobile-toggle-btn");
    if (drawer && drawer.classList.contains("active")) {
        if (!drawer.contains(e.target) && !btn.contains(e.target)) {
            closeMobileMenu();
        }
    }
});

// Close modals when clicking backdrop
document.addEventListener("click", function(e) {
    if (e.target.classList.contains("modal-overlay")) {
        const modals = document.querySelectorAll(".modal-overlay");
        modals.forEach(m => m.style.display = "none");
    }
});

// Close modals on Escape key
document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
        const modals = document.querySelectorAll(".modal-overlay");
        modals.forEach(m => m.style.display = "none");
        closeMobileMenu();
    }
});

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
            injectCustomCode();
            renderConfig();
        }
    } catch (e) {
        console.error("Failed to load config:", e);
    }
}

// 🎨 Live CSS Variables & Theme Mode Injection
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

// 💉 Inject Custom CSS and Custom JS from Admin
function injectCustomCode() {
    if (!siteConfig) return;

    if (siteConfig.custom_css) {
        const styleTag = document.getElementById("dynamic-custom-css");
        if (styleTag) styleTag.textContent = siteConfig.custom_css;
    }

    if (siteConfig.custom_js) {
        try {
            const script = document.createElement("script");
            script.textContent = siteConfig.custom_js;
            document.body.appendChild(script);
        } catch (err) {
            console.error("Custom JS error:", err);
        }
    }
}

// 💱 Currency Conversion Helper
function getCurrencyDetails() {
    const defaultCurr = { code: "SAR", symbol: "﷼", rate: 1.0 };
    if (!siteConfig || !siteConfig.currencies) return defaultCurr;
    return siteConfig.currencies.find(c => c.code === selectedCurrency) || siteConfig.currencies[0] || defaultCurr;
}

function formatPrice(baseAmountInSAR) {
    const curr = getCurrencyDetails();
    const converted = baseAmountInSAR * curr.rate;
    return {
        amount: Math.round(converted),
        symbol: curr.symbol,
        code: curr.code
    };
}

function handleCurrencyChange(newCurr) {
    selectedCurrency = newCurr;
    localStorage.setItem("selected_currency", newCurr);
    
    // Sync both desktop and mobile selects
    const dSelect = document.getElementById("currency-select");
    const mSelect = document.getElementById("mobile-currency-select");
    if (dSelect) dSelect.value = newCurr;
    if (mSelect) mSelect.value = newCurr;

    renderPlans();
    if (currentPlan) {
        updateOrderModalPrice();
    }
}

// Render dynamic texts, hero titles, buttons and announcements
function renderConfig() {
    if (!siteConfig) return;

    // --- 1. Section Visibility Toggles (WordPress-Style Section Controller) ---\n    toggleSection("notice-bar-wrap", siteConfig.show_notice);
    toggleSection("hero-section", siteConfig.show_hero);
    toggleSection("stats-section", siteConfig.show_stats);
    toggleSection("features-section", siteConfig.show_features);
    toggleSection("plans", siteConfig.show_pricing);
    toggleSection("check", siteConfig.show_checker);
    toggleSection("testimonials-section", siteConfig.show_testimonials);
    toggleSection("faq", siteConfig.show_faq);
    toggleSection("guide", siteConfig.show_guide);
    toggleSection("custom-html-section", siteConfig.show_custom_html);

    // --- 2. Branding & Logo & Favicon ---
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

    // --- 3. Notice Announcement Bar ---
    const noticeText = document.getElementById("notice-text");
    if (noticeText && siteConfig.notice) {
        noticeText.textContent = siteConfig.notice;
    }

    // --- 4. Hero Section ---
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

    // --- 5. Features Section ---
    if (siteConfig.features_title) {
        const el = document.getElementById("features-title");
        if (el) el.textContent = siteConfig.features_title;
    }
    if (siteConfig.features_subtitle) {
        const el = document.getElementById("features-subtitle");
        if (el) el.textContent = siteConfig.features_subtitle;
    }

    // --- 6. Pricing Section ---
    if (siteConfig.pricing_title) {
        const el = document.getElementById("pricing-title");
        if (el) el.textContent = siteConfig.pricing_title;
    }
    if (siteConfig.pricing_subtitle) {
        const el = document.getElementById("pricing-subtitle");
        if (el) el.textContent = siteConfig.pricing_subtitle;
    }

    // --- 7. Status Checker ---
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

    // --- 8. Testimonials Section ---
    if (siteConfig.testimonials_title) {
        const el = document.getElementById("testimonials-title");
        if (el) el.textContent = siteConfig.testimonials_title;
    }
    if (siteConfig.testimonials_subtitle) {
        const el = document.getElementById("testimonials-subtitle");
        if (el) el.textContent = siteConfig.testimonials_subtitle;
    }

    // --- 9. FAQ Section ---
    if (siteConfig.faq_title) {
        const el = document.getElementById("faq-title");
        if (el) el.textContent = siteConfig.faq_title;
    }
    if (siteConfig.faq_subtitle) {
        const el = document.getElementById("faq-subtitle");
        if (el) el.textContent = siteConfig.faq_subtitle;
    }

    // --- 10. Floating WhatsApp Support Button ---
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

    // Render all dynamic sections
    renderStats();
    renderFeatures();
    renderPlans();
    renderTestimonials();
    renderFaqs();
    renderCustomHtml();
    renderPaymentMethods();
    renderCurrencyDropdowns();
}

function toggleSection(id, isVisible) {
    const el = document.getElementById(id);
    if (el) {
        el.style.display = isVisible !== false ? "" : "none";
    }
}

// 💱 Render Currency Dropdowns
function renderCurrencyDropdowns() {
    if (!siteConfig || !siteConfig.currencies) return;
    const dSelect = document.getElementById("currency-select");
    const mSelect = document.getElementById("mobile-currency-select");

    const html = siteConfig.currencies.map(c => `
        <option value="${c.code}" ${c.code === selectedCurrency ? 'selected' : ''}>${c.symbol} ${c.code}</option>
    `).join('');

    if (dSelect) dSelect.innerHTML = html;
    if (mSelect) mSelect.innerHTML = html;
}

// 📊 Render Stats Section
function renderStats() {
    const container = document.getElementById("stats-container");
    if (!container || !siteConfig || !siteConfig.stats) return;

    container.innerHTML = siteConfig.stats.map(s => `
        <div class="stat-box">
            <div class="stat-box-icon">${s.icon || '⚡'}</div>
            <div class="stat-box-num">${s.value}</div>
            <div class="stat-box-label">${s.label}</div>
        </div>
    `).join('');
}

// 🛡️ Render Features Section
function renderFeatures() {
    const container = document.getElementById("features-container");
    if (!container || !siteConfig || !siteConfig.features) return;

    container.innerHTML = siteConfig.features.map(f => `
        <div class="feature-card">
            <span class="feature-icon">${f.icon || '🛡️'}</span>
            <div>
                <h3>${f.title}</h3>
                <p>${f.desc}</p>
            </div>
        </div>
    `).join('');
}

// ⚡ Render Pricing Plans
function renderPlans() {
    const container = document.getElementById("plans-container");
    if (!siteConfig || !siteConfig.plans || !container) return;

    const btnText = siteConfig.btn_plan_card_text || "⚡ Get Instant Access";

    container.innerHTML = siteConfig.plans.map(p => {
        const formatted = formatPrice(p.price);
        return `
        <div class="pricing-card ${p.popular ? 'popular' : ''}">
            ${p.badge ? `<div class="card-badge">${p.badge}</div>` : ''}
            <div class="card-plan-name">${p.name}</div>
            <div class="price-wrap">
                <span class="price-val">${formatted.amount}</span>
                <span class="price-cur">${formatted.symbol}</span>
                <span class="price-period">/ ${p.duration_days} Days</span>
            </div>
            <ul class="feature-list">
                ${(p.features || []).map(f => `<li><span class="check-icon">✓</span> ${f}</li>`).join('')}
            </ul>
            <button class="plan-btn ${p.popular ? 'plan-btn-popular' : ''}" onclick="openOrderModal('${p.id}')">
                ${btnText}
            </button>
        </div>
        `;
    }).join('');
}

// ⭐ Render Testimonials Section
function renderTestimonials() {
    const container = document.getElementById("testimonials-container");
    if (!container || !siteConfig || !siteConfig.testimonials) return;

    container.innerHTML = siteConfig.testimonials.map(t => {
        const stars = "★".repeat(t.rating || 5);
        const initial = (t.name || "U")[0].toUpperCase();
        return `
        <div class="testimonial-card">
            <div>
                <div class="testimonial-stars">${stars}</div>
                <div class="testimonial-text">"${t.text}"</div>
            </div>
            <div class="testimonial-author">
                <div class="testimonial-avatar">${initial}</div>
                <div>
                    <div class="testimonial-name">${t.name}</div>
                    <div class="testimonial-role">${t.role || 'Verified User'}</div>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

// ❓ Render FAQ Accordion Section
function renderFaqs() {
    const container = document.getElementById("faq-container");
    if (!container || !siteConfig || !siteConfig.faqs) return;

    container.innerHTML = siteConfig.faqs.map((f, i) => `
        <div class="faq-item ${i === 0 ? 'active' : ''}" onclick="toggleFaq(this)">
            <div class="faq-question">
                <span>${f.q}</span>
                <span class="faq-icon">+</span>
            </div>
            <div class="faq-answer">
                ${f.a}
            </div>
        </div>
    `).join('');
}

window.toggleFaq = function(el) {
    el.classList.toggle("active");
};

// 🧩 Render Custom HTML Block
function renderCustomHtml() {
    const container = document.getElementById("custom-html-container");
    if (!container || !siteConfig || !siteConfig.custom_html) return;
    container.innerHTML = siteConfig.custom_html;
}

// Render Payment Methods
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
        password: document.getElementById("login-password").value.trim()
    };

    try {
        const res = await fetch("/api/customer/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const json = await res.json();

        if (json.success) {
            customerToken = json.token;
            customerUser = json.customer;
            localStorage.setItem("customer_token", customerToken);
            localStorage.setItem("customer_user", JSON.stringify(customerUser));
            
            closeAuthModal();
            renderNavbarAuth();
            openUserModal();
        } else if (json.unverified) {
            pendingOtpEmail = payload.email;
            document.getElementById("otp-display-email").textContent = pendingOtpEmail;
            switchAuthTab('otp');
            startResendTimer();
        } else {
            alert("❌ " + (json.error || "Login failed"));
        }
    } catch (err) {
        alert("Login error: " + err.message);
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
        password: document.getElementById("reg-password").value.trim()
    };

    try {
        const res = await fetch("/api/customer/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const json = await res.json();

        if (json.success) {
            if (json.requires_otp) {
                pendingOtpEmail = payload.email;
                document.getElementById("otp-display-email").textContent = pendingOtpEmail;
                switchAuthTab('otp');
                startResendTimer();
            } else {
                customerToken = json.token;
                customerUser = json.customer;
                localStorage.setItem("customer_token", customerToken);
                localStorage.setItem("customer_user", JSON.stringify(customerUser));
                closeAuthModal();
                renderNavbarAuth();
                openUserModal();
            }
        } else {
            alert("❌ " + (json.error || "Registration failed"));
        }
    } catch (err) {
        alert("Registration error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "✨ Create Account";
    }
}

async function handleVerifyOtp(e) {
    e.preventDefault();
    const btn = document.getElementById("otp-submit-btn");
    btn.disabled = true;
    btn.textContent = "Verifying...";

    const code = document.getElementById("otp-input-code").value.trim();

    try {
        const res = await fetch("/api/customer/verify-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: pendingOtpEmail, code: code })
        });
        const json = await res.json();

        if (json.success) {
            customerToken = json.token;
            customerUser = json.customer;
            localStorage.setItem("customer_token", customerToken);
            localStorage.setItem("customer_user", JSON.stringify(customerUser));

            alert("🎉 Account verified successfully!");
            closeAuthModal();
            renderNavbarAuth();
            openUserModal();
        } else {
            alert("❌ " + (json.error || "Invalid code"));
        }
    } catch (err) {
        alert("Verification error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "✓ Verify & Activate Account";
    }
}

async function handleResendOtp() {
    const btn = document.getElementById("otp-resend-btn");
    btn.disabled = true;
    btn.textContent = "Sending...";

    try {
        const res = await fetch("/api/customer/resend-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: pendingOtpEmail })
        });
        const json = await res.json();
        if (json.success) {
            alert("✉️ A new 6-digit code has been sent to your Gmail.");
            startResendTimer();
        } else {
            alert("❌ " + (json.error || "Failed to resend"));
            btn.disabled = false;
            btn.textContent = "Resend Code";
        }
    } catch (err) {
        alert("Error: " + err.message);
        btn.disabled = false;
        btn.textContent = "Resend Code";
    }
}

function startResendTimer() {
    let timeLeft = 60;
    const btn = document.getElementById("otp-resend-btn");
    if (!btn) return;
    
    btn.disabled = true;
    if (resendTimer) clearInterval(resendTimer);

    resendTimer = setInterval(() => {
        btn.textContent = `Resend in ${timeLeft}s`;
        timeLeft--;
        if (timeLeft < 0) {
            clearInterval(resendTimer);
            btn.disabled = false;
            btn.textContent = "Resend Code";
        }
    }, 1000);
}

function handleCustomerLogout() {
    customerToken = "";
    customerUser = null;
    localStorage.removeItem("customer_token");
    localStorage.removeItem("customer_user");
    closeUserModal();
    renderNavbarAuth();
}

async function openUserModal() {
    if (!customerToken) {
        openAuthModal();
        return;
    }

    const modal = document.getElementById("user-modal");
    if (modal) modal.style.display = "flex";

    if (customerUser) {
        const nameEl = document.getElementById("user-display-name");
        const emailEl = document.getElementById("user-display-email");
        if (nameEl) nameEl.textContent = customerUser.name;
        if (emailEl) emailEl.textContent = customerUser.email;
    }

    fetchCustomerData();
}

function closeUserModal() {
    const modal = document.getElementById("user-modal");
    if (modal) modal.style.display = "none";
}

async function fetchCustomerData() {
    if (!customerToken) return;

    try {
        const res = await fetch("/api/customer/me", {
            headers: { "Authorization": `Bearer ${customerToken}` }
        });
        const json = await res.json();

        if (json.success && json.customer) {
            customerUser = json.customer;
            localStorage.setItem("customer_user", JSON.stringify(customerUser));

            // Render Active Services
            const activeContainer = document.getElementById("user-active-services");
            const activeList = json.active_services || [];

            if (activeContainer) {
                if (activeList.length === 0) {
                    activeContainer.innerHTML = `
                        <div style="background: rgba(255,255,255,0.03); border: 1px dashed var(--border-color); border-radius: 8px; padding: 18px; text-align: center; color: var(--text-muted); font-size: 13px;">
                            No active DNS subscriptions found under this email. Choose a plan below to connect!
                        </div>
                    `;
                } else {
                    activeContainer.innerHTML = activeList.map(s => `
                        <div class="user-service-card">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                                <div>
                                    <span style="font-size: 14px; font-weight: 800; color: #fff;">${s.plan_name}</span>
                                    <div style="font-size: 11px; color: var(--text-muted);">PIN: <b style="color: #38bdf8;">${s.client_id}</b></div>
                                </div>
                                <span class="badge badge-approved">Active</span>
                            </div>
                            <div class="dns-copy-box">
                                <span class="dns-hostname-val">${s.dns_url}</span>
                                <button type="button" class="copy-btn" onclick="navigator.clipboard.writeText('${s.dns_url}').then(() => alert('Copied DNS: ${s.dns_url}'))">Copy Host</button>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 12px; color: var(--text-muted);">
                                <span>Expires: <b style="color: #cbd5e1;">${s.expire_date || 'Active'}</b></span>
                                <a href="/api/invoice?id=${s.order_id}" target="_blank" style="color: #38bdf8; font-weight: 700; text-decoration: none;">🧾 View Receipt ↗</a>
                            </div>
                        </div>
                    `).join('');
                }
            }

            // Render Orders History
            const ordersContainer = document.getElementById("user-order-history");
            const orderList = json.orders || [];

            if (ordersContainer) {
                if (orderList.length === 0) {
                    ordersContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 12px; padding: 10px 0;">No past orders.</div>`;
                } else {
                    ordersContainer.innerHTML = orderList.map(o => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid var(--border-color); font-size: 13px;">
                            <div>
                                <b style="color: #fff;">${o.plan_name}</b>
                                <div style="font-size: 11px; color: var(--text-muted);">${o.order_id} • ${o.created_at || ''}</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-weight: 700; color: #34d399;">${o.amount} ${o.currency || 'SAR'}</div>
                                <span class="badge badge-${o.status}" style="font-size: 10px; padding: 2px 6px;">${o.status}</span>
                            </div>
                        </div>
                    `).join('');
                }
            }
        } else if (res.status === 401) {
            handleCustomerLogout();
        }
    } catch (e) {
        console.error("Me fetch error:", e);
    }
}

// ----------------------------------------------------
// Order Modal & Checkout
// ----------------------------------------------------
function openOrderModal(planId) {
    if (!siteConfig || !siteConfig.plans) return;
    const plan = siteConfig.plans.find(p => p.id === planId);
    if (!plan) return;

    currentPlan = plan;
    currentCoupon = null;

    const modal = document.getElementById("order-modal");
    document.getElementById("order-plan-id").value = plan.id;
    document.getElementById("modal-plan-title").textContent = `Order ${plan.name}`;
    
    // Clear coupon input & reset status
    const couponInput = document.getElementById("order-coupon-code");
    const couponMsg = document.getElementById("coupon-status-msg");
    const couponBadge = document.getElementById("coupon-applied-badge");
    if (couponInput) couponInput.value = "";
    if (couponMsg) {
        couponMsg.textContent = "";
        couponMsg.className = "coupon-status-msg";
    }
    if (couponBadge) couponBadge.style.display = "none";

    // Autofill user details if logged in
    if (customerUser) {
        const nameIn = document.getElementById("order-name");
        const phoneIn = document.getElementById("order-phone");
        const emailIn = document.getElementById("order-email");
        if (nameIn && customerUser.name) nameIn.value = customerUser.name;
        if (phoneIn && customerUser.phone) phoneIn.value = customerUser.phone;
        if (emailIn && customerUser.email) emailIn.value = customerUser.email;
    }

    updateOrderModalPrice();
    if (modal) modal.style.display = "flex";
}

function closeOrderModal() {
    const modal = document.getElementById("order-modal");
    if (modal) modal.style.display = "none";
}

function updateOrderModalPrice() {
    if (!currentPlan) return;
    let basePrice = currentPlan.price;

    if (currentCoupon) {
        if (currentCoupon.discount_type === "percent") {
            basePrice = Math.max(0, basePrice * (1 - currentCoupon.discount_val / 100));
        } else {
            basePrice = Math.max(0, basePrice - currentCoupon.discount_val);
        }
    }

    const formatted = formatPrice(basePrice);
    const priceEl = document.getElementById("modal-plan-price");
    if (priceEl) {
        priceEl.textContent = `${formatted.amount} ${formatted.symbol} (${formatted.code})`;
    }
}

// 🎟️ Apply Coupon Code Validation
async function applyCouponCode() {
    const input = document.getElementById("order-coupon-code");
    const msg = document.getElementById("coupon-status-msg");
    const badge = document.getElementById("coupon-applied-badge");
    const btn = document.getElementById("coupon-apply-btn");

    if (!input || !currentPlan) return;
    const code = input.value.trim().toUpperCase();

    if (!code) {
        msg.textContent = "Please enter a coupon code.";
        msg.className = "coupon-status-msg coupon-status-err";
        return;
    }

    btn.disabled = true;
    btn.textContent = "...";

    try {
        const res = await fetch(`/api/coupon?code=${encodeURIComponent(code)}&amount=${currentPlan.price}`);
        const json = await res.json();

        if (json.success && json.coupon) {
            currentCoupon = json.coupon;
            msg.textContent = `✓ Coupon applied! Discount: ${json.discount_amount} SAR`;
            msg.className = "coupon-status-msg coupon-status-ok";
            if (badge) badge.style.display = "block";
            updateOrderModalPrice();
        } else {
            currentCoupon = null;
            msg.textContent = `❌ ${json.error || "Invalid coupon"}`;
            msg.className = "coupon-status-msg coupon-status-err";
            if (badge) badge.style.display = "none";
            updateOrderModalPrice();
        }
    } catch (err) {
        msg.textContent = "Coupon check error: " + err.message;
        msg.className = "coupon-status-msg coupon-status-err";
    } finally {
        btn.disabled = false;
        btn.textContent = "Apply";
    }
}

async function submitOrder(e) {
    e.preventDefault();
    const btn = document.getElementById("order-submit-btn");
    btn.disabled = true;
    btn.textContent = "Submitting Order...";

    const antiBot = await generateAntiBotPayload();
    const planId = document.getElementById("order-plan-id").value;

    const payload = {
        ...antiBot,
        plan_id: planId,
        customer_name: document.getElementById("order-name").value.trim(),
        customer_phone: document.getElementById("order-phone").value.trim(),
        customer_email: document.getElementById("order-email").value.trim(),
        payment_method: document.getElementById("order-payment-method").value,
        trx_id: document.getElementById("order-trx").value.trim(),
        currency: selectedCurrency,
        coupon_code: currentCoupon ? currentCoupon.code : null
    };

    try {
        const res = await fetch("/api/order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const json = await res.json();

        if (json.success) {
            alert(`🎉 Order Placed Successfully!\n\nOrder ID: ${json.order_id}\nStatus: Verification in progress.\nWe will activate your private DNS immediately after checking the TrxID.`);
            closeOrderModal();
            document.getElementById("order-form").reset();
            
            if (customerToken) {
                fetchCustomerData();
            }
        } else {
            alert("❌ Failed to place order: " + (json.error || "Please check details."));
        }
    } catch (err) {
        alert("Submission error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Confirm & Submit Order";
    }
}

// ----------------------------------------------------
// Status Checker Logic
// ----------------------------------------------------
async function checkDnsStatus() {
    const input = document.getElementById("checker-query");
    const resultBox = document.getElementById("checker-result");
    const btn = document.getElementById("btn-checker");

    const query = input.value.trim();
    if (!query) {
        alert("Please enter your phone number or DNS PIN.");
        return;
    }

    btn.disabled = true;
    btn.textContent = "Checking...";
    resultBox.style.display = "none";

    try {
        const res = await fetch(`/api/order/check?q=${encodeURIComponent(query)}`);
        const json = await res.json();

        resultBox.style.display = "block";
        if (json.success && json.data) {
            const d = json.data;
            const isApproved = d.status === "approved";

            resultBox.innerHTML = `
                <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); border-radius: 8px; padding: 18px; text-align: left;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <span style="font-weight: 800; font-size: 15px; color: #fff;">Status: <span class="badge badge-${d.status}">${d.status}</span></span>
                        <span style="font-size: 12px; color: var(--text-muted);">${d.plan_name}</span>
                    </div>

                    ${isApproved && d.dns_url ? `
                        <div class="dns-copy-box" style="margin-bottom: 10px;">
                            <span class="dns-hostname-val">${d.dns_url}</span>
                            <button type="button" class="copy-btn" onclick="navigator.clipboard.writeText('${d.dns_url}').then(() => alert('Copied: ${d.dns_url}'))">Copy Host</button>
                        </div>
                        <div style="font-size: 13px; color: #cbd5e1; line-height: 1.6;">
                            <div>👤 <b>PIN / User:</b> <code style="color: #38bdf8;">${d.client_id}</code></div>
                            <div>⏳ <b>Expires:</b> ${d.expire_date || 'Active'}</div>
                        </div>
                        <div style="margin-top: 12px;">
                            <a href="/api/invoice?id=${d.order_id}" target="_blank" style="color: #38bdf8; font-size: 12px; font-weight: 700; text-decoration: none;">🧾 View Digital Invoice ↗</a>
                        </div>
                    ` : `
                        <p style="color: #fbbf24; font-size: 13px; margin: 0;">Your payment is currently under verification. DNS credentials will appear here once approved!</p>
                    `}
                </div>
            `;
        } else {
            resultBox.innerHTML = `
                <div style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; padding: 14px; color: #f87171;">
                    ❌ No active order or PIN found for "<b>${query}</b>".
                </div>
            `;
        }
    } catch (e) {
        resultBox.style.display = "block";
        resultBox.innerHTML = `<div style="color: #f87171;">Error checking status: ${e.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = (siteConfig && siteConfig.btn_checker_text) || "Check Status";
    }
}
