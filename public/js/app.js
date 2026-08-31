// public/js/app.js — Public Storefront Application Logic
let siteConfig = null;

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("footer-year").textContent = new Date().getFullYear();
    loadStoreConfig();
});

async function loadStoreConfig() {
    try {
        const res = await fetch("/api/config");
        const json = await res.json();
        if (json.success && json.data) {
            siteConfig = json.data;
            renderConfig(siteConfig);
        }
    } catch (e) {
        console.error("Config load error:", e);
    }
}

function renderConfig(config) {
    if (config.site_name) {
        document.getElementById("site-name").textContent = config.site_name;
        document.title = `${config.site_name} — High Speed Private DNS`;
    }
    if (config.tagline) {
        document.getElementById("tagline").textContent = config.tagline;
    }
    if (config.notice) {
        document.getElementById("notice-text").textContent = config.notice;
    }
    if (config.owner_name) {
        document.getElementById("footer-owner").textContent = config.owner_name;
    }
    if (config.support_whatsapp) {
        const cleanWa = config.support_whatsapp.replace(/[^0-9+]/g, "");
        document.getElementById("whatsapp-link").href = `https://wa.me/${cleanWa}?text=${encodeURIComponent("Hello! I need assistance with Private DNS.")}`;
    }

    // Render Plans
    const plansContainer = document.getElementById("plans-container");
    if (config.plans && config.plans.length > 0) {
        const currency = config.currency_symbol || config.currency || "SAR";
        plansContainer.innerHTML = config.plans.map(p => `
            <div class="pricing-card ${p.popular ? 'popular' : ''}">
                ${p.badge ? `<span class="plan-badge">${p.badge}</span>` : ''}
                <div>
                    <h3 class="plan-name">${p.name}</h3>
                    <div class="plan-price-wrap">
                        <span class="plan-price">${p.price}</span>
                        <span class="plan-currency">${currency}</span>
                        <span class="plan-duration">/ ${p.duration_days} Days Access</span>
                    </div>
                    <ul class="plan-features">
                        ${(p.features || ["High Speed Server", "Zero-Lag Banking", "24/7 Support"]).map(f => `<li>${f}</li>`).join('')}
                    </ul>
                </div>
                <button class="btn-primary" style="width: 100%;" onclick="openOrderModal('${p.id}')">
                    ⚡ Get ${p.name}
                </button>
            </div>
        `).join('');
    }

    // Render Payment Options in Modal
    const paymentSelect = document.getElementById("order-payment-method");
    if (config.payment_methods && config.payment_methods.length > 0) {
        paymentSelect.innerHTML = config.payment_methods.map((m, idx) => `
            <option value="${m.id}" ${idx === 0 ? 'selected' : ''}>${m.name}</option>
        `).join('');
        updatePaymentInstruction();
    }
}

function openOrderModal(planId) {
    if (!siteConfig || !siteConfig.plans) return;
    const plan = siteConfig.plans.find(p => p.id === planId) || siteConfig.plans[0];
    const currency = siteConfig.currency_symbol || siteConfig.currency || "SAR";

    document.getElementById("order-plan-id").value = plan.id;
    document.getElementById("modal-plan-title").textContent = `Order ${plan.name}`;
    document.getElementById("modal-plan-price").textContent = `${plan.price} ${currency} (${plan.duration_days} Days)`;
    
    document.getElementById("order-modal").classList.add("active");
}

function closeOrderModal() {
    document.getElementById("order-modal").classList.remove("active");
}

function updatePaymentInstruction() {
    if (!siteConfig || !siteConfig.payment_methods) return;
    const selectedId = document.getElementById("order-payment-method").value;
    const method = siteConfig.payment_methods.find(m => m.id === selectedId) || siteConfig.payment_methods[0];

    document.getElementById("payment-instruction-text").textContent = method.instructions || `Send payment to: ${method.account_name || ''}`;
    document.getElementById("payment-number-display").textContent = method.number || "Contact Admin";
}

function copyPaymentNumber() {
    const num = document.getElementById("payment-number-display").textContent;
    navigator.clipboard.writeText(num).then(() => {
        alert("Payment number copied to clipboard: " + num);
    });
}

async function submitOrder(e) {
    e.preventDefault();
    const submitBtn = document.getElementById("order-submit-btn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Processing Order...";

    const payload = {
        plan_id: document.getElementById("order-plan-id").value,
        customer_name: document.getElementById("order-name").value.trim(),
        customer_phone: document.getElementById("order-phone").value.trim(),
        payment_method: document.getElementById("order-payment-method").value,
        trx_id: document.getElementById("order-trx").value.trim()
    };

    try {
        const res = await fetch("/api/order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
            alert(`🎉 ${data.message}\n\nOrder ID: ${data.data.order_id}\n\nPlease keep your Order ID safe.`);
            closeOrderModal();
            document.getElementById("order-form").reset();
            // Pre-fill search box
            document.getElementById("checker-query").value = data.data.order_id;
            checkDnsStatus();
        } else {
            alert("⚠️ " + (data.error || "Order failed."));
        }
    } catch (err) {
        alert("⚠️ Connection error: " + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Confirm & Submit Order";
    }
}

async function checkDnsStatus() {
    const query = document.getElementById("checker-query").value.trim();
    if (!query) {
        alert("Please enter your Phone Number, Order ID, or DNS PIN.");
        return;
    }

    const resultBox = document.getElementById("checker-result");
    resultBox.style.display = "block";
    resultBox.innerHTML = `<div style="text-align:center; color: var(--text-secondary);">Checking status...</div>`;

    try {
        const res = await fetch(`/api/check-status?q=${encodeURIComponent(query)}`);
        const json = await res.json();

        if (!json.success || !json.data) {
            resultBox.innerHTML = `
                <div style="color: #f87171; font-weight: 600;">
                    ❌ ${json.error || "No active record found. Please verify your details or contact support."}
                </div>
            `;
            return;
        }

        const d = json.data;
        const isApproved = d.status === "approved" || d.status === "active";

        resultBox.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <div>
                    <span style="font-size: 18px; font-weight: 800; color: #fff;">${d.customer_name}</span>
                    <span style="display:block; font-size:12px; color:var(--text-muted);">Order: ${d.order_id}</span>
                </div>
                <span class="status-pill" style="${isApproved ? 'color:#34d399;' : 'color:#f59e0b;'}">
                    ${d.status.toUpperCase()}
                </span>
            </div>

            ${isApproved ? `
                <div style="background: rgba(0,0,0,0.4); padding: 14px; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 12px;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Your Private DNS Hostname:</div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <code style="font-size: 15px; font-weight: 800; color: #38bdf8;">${d.dns_url}</code>
                        <button class="copy-btn" onclick="navigator.clipboard.writeText('${d.dns_url}').then(() => alert('DNS Hostname Copied!'))">Copy DNS</button>
                    </div>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--text-secondary);">
                    <span>Plan: <b>${d.plan_name}</b></span>
                    <span>Expires: <b>${d.expire_date}</b></span>
                </div>
            ` : `
                <div style="color: #fbbf24; font-size: 13px; line-height: 1.5;">
                    ⏳ Your order is currently under verification. Once our team verifies your payment reference, your DNS code will become active here immediately!
                </div>
            `}
        `;
    } catch (e) {
        resultBox.innerHTML = `<div style="color: #f87171;">Connection error. Please try again.</div>`;
    }
}
