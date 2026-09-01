// public/js/dashboard.js — Dedicated Customer Dashboard Portal Controller

let customerToken = localStorage.getItem("customer_token");
let dashboardData = null;

document.addEventListener("DOMContentLoaded", () => {
    // Auth Check
    if (!customerToken) {
        window.location.href = "/#signin";
        return;
    }

    loadStoreBranding();
    fetchDashboardData();
});

// Load Store Branding
async function loadStoreBranding() {
    try {
        const res = await fetch("/api/settings");
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.data) {
                const s = data.data;
                const siteNameEl = document.getElementById("site-name");
                const footerNameEl = document.getElementById("footer-site-name");
                const noticeTextEl = document.getElementById("notice-text");
                const noticeCloneEl = document.getElementById("notice-text-clone");
                const logoImgEl = document.getElementById("site-logo-img");
                const logoIconEl = document.getElementById("site-logo-icon");

                if (siteNameEl && s.site_name) siteNameEl.textContent = s.site_name;
                if (footerNameEl && s.site_name) footerNameEl.textContent = s.site_name;
                if (s.notice) {
                    if (noticeTextEl) noticeTextEl.textContent = s.notice;
                    if (noticeCloneEl) noticeCloneEl.textContent = s.notice;
                }
                if (s.site_logo && logoImgEl && logoIconEl) {
                    logoImgEl.src = s.site_logo;
                    logoImgEl.style.display = "block";
                    logoIconEl.style.display = "none";
                }
            }
        }
    } catch (_) {}
}

// Fetch Customer & Real-Time DNS Data
async function fetchDashboardData(isManualSync = false) {
    const refreshBtn = document.getElementById("btn-refresh-dns");
    if (isManualSync && refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = `<span>⏳</span> Syncing...`;
    }

    try {
        const res = await fetch("/api/user/me", {
            headers: {
                "Authorization": `Bearer ${customerToken}`
            }
        });

        if (res.status === 401) {
            localStorage.removeItem("customer_token");
            localStorage.removeItem("customer_user");
            window.location.href = "/#signin";
            return;
        }

        const json = await res.json();
        if (json.success && json.user) {
            dashboardData = json;
            renderCustomerHeader(json.user);
            renderMetrics(json);
            renderDnsPasses(json.active_dns || [], json.suspended_dns || []);
            renderOrderHistory(json.orders || []);
        } else {
            alert("Error loading customer data: " + (json.error || "Unknown error"));
        }
    } catch (e) {
        console.error("Dashboard load error:", e);
    } finally {
        if (isManualSync && refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = `<span class="refresh-icon">🔄</span> Sync Live Status`;
        }
    }
}

// Render Header & Welcome Section
function renderCustomerHeader(user) {
    const navName = document.getElementById("nav-user-name");
    const welcomeName = document.getElementById("welcome-name");
    const welcomeEmail = document.getElementById("welcome-email");

    const firstName = user.name ? user.name.split(" ")[0] : "Customer";
    if (navName) navName.textContent = firstName;
    if (welcomeName) welcomeName.textContent = user.name || "Customer";
    if (welcomeEmail) {
        welcomeEmail.textContent = `Account: ${user.email} ${user.phone ? `• ${user.phone}` : ''}`;
    }
}

// Render Metrics
function renderMetrics(data) {
    const activeCountEl = document.getElementById("metric-active-count");
    const totalOrdersEl = document.getElementById("metric-total-orders");

    const activeList = data.active_dns || [];
    const ordersList = data.orders || [];

    if (activeCountEl) activeCountEl.textContent = activeList.length;
    if (totalOrdersEl) totalOrdersEl.textContent = ordersList.length;
}

// Render Active and Suspended DNS Passes
function renderDnsPasses(activeList, suspendedList) {
    const container = document.getElementById("active-dns-container");
    if (!container) return;

    const hasActive = activeList && activeList.length > 0;
    const hasSuspended = suspendedList && suspendedList.length > 0;

    if (!hasActive && !hasSuspended) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div style="font-size: 32px; margin-bottom: 8px;">⚡</div>
                <h3 style="color: #fff; font-size: 16px; margin-bottom: 6px;">No Active DNS Pass Found</h3>
                <p style="margin-bottom: 16px;">You don't have any active encrypted DNS passes right now.</p>
                <a href="/#plans" class="btn-primary" style="padding: 8px 18px; font-size: 12px; display: inline-flex;">
                    Browse Available Plans ↗
                </a>
            </div>
        `;
        return;
    }

    let cardsHtml = '';

    // 1. Render Active Passes
    if (hasActive) {
        cardsHtml += activeList.map(dns => `
            <div class="dns-pass-card">
                <div class="dns-pass-header">
                    <div>
                        <span class="dns-plan-badge">${dns.plan_name || 'Active DNS Plan'}</span>
                        <h3 style="color: #fff; font-size: 16px; margin: 4px 0 0;">Private DNS Host</h3>
                    </div>
                    <span class="badge badge-approved">ACTIVE</span>
                </div>

                <div class="dns-hostname-box">
                    <span class="dns-hostname-code">${dns.dns_url}</span>
                    <button class="btn-copy-mini" onclick="copyToClipboard('${dns.dns_url}', this)">
                        📋 Copy
                    </button>
                </div>

                <div class="dns-meta-row">
                    <span>PIN: <b style="color: #fff;">${dns.client_id}</b></span>
                    <span>Expires: <b style="color: #38bdf8;">${dns.expire_date || 'Active'}</b></span>
                </div>

                <div class="dns-actions-row">
                    <button class="btn-primary" style="padding: 8px 14px; font-size: 12px; flex: 1;" onclick="copyToClipboard('${dns.dns_url}', this)">
                        📋 Copy Hostname
                    </button>
                    <button class="btn-secondary" style="padding: 8px 14px; font-size: 12px;" onclick="downloadIosProfile('${dns.client_id}', '${dns.dns_url}')">
                        🍏 iOS Profile
                    </button>
                </div>
            </div>
        `).join('');
    }

    // 2. Render Suspended / Banned Passes
    if (hasSuspended) {
        cardsHtml += suspendedList.map(dns => `
            <div class="dns-pass-card" style="border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.06);">
                <div class="dns-pass-header">
                    <div>
                        <span style="font-size: 11px; font-weight: 800; color: #f87171; text-transform: uppercase;">${dns.plan_name || 'DNS Pass'}</span>
                        <h3 style="color: #fca5a5; font-size: 16px; margin: 4px 0 0;">Suspended DNS Host</h3>
                    </div>
                    <span class="badge badge-banned">${dns.status ? dns.status.toUpperCase() : 'SUSPENDED'}</span>
                </div>

                <div class="dns-hostname-box" style="border-color: rgba(239, 68, 68, 0.3); background: rgba(0,0,0,0.5);">
                    <span class="dns-hostname-code" style="color: #f87171; text-decoration: line-through;">${dns.dns_url || `${dns.client_id}.dnsbd.pp.ua`}</span>
                    <span style="font-size: 11px; color: #f87171; font-weight: 700;">🚫 Inactive</span>
                </div>

                <div class="dns-meta-row">
                    <span>PIN: <b style="color: #fff;">${dns.client_id}</b></span>
                    <span>Expires: <b>${dns.expire_date || 'Suspended'}</b></span>
                </div>

                ${dns.ban_reason ? `
                    <div style="margin-bottom: 14px; padding: 8px 12px; background: rgba(239, 68, 68, 0.15); border-left: 3px solid #ef4444; border-radius: 4px; font-size: 11px; color: #fca5a5;">
                        <b>${dns.ban_reason}</b>
                        ${dns.detected_ips && dns.detected_ips.length ? `<div style="margin-top: 4px; color: #fecaca; font-family: monospace;">Detected IPs: ${dns.detected_ips.join(', ')}</div>` : ''}
                    </div>
                ` : `
                    <div style="margin-bottom: 14px; padding: 8px 12px; background: rgba(239, 68, 68, 0.1); border-left: 3px solid #ef4444; border-radius: 4px; font-size: 11px; color: #fca5a5;">
                        This DNS connection is suspended. Contact store support to restore your pass.
                    </div>
                `}

                <div class="dns-actions-row">
                    <a href="/#plans" class="btn-primary" style="padding: 8px 14px; font-size: 12px; flex: 1; text-decoration: none; text-align: center; justify-content: center;">
                        ⚡ Renew / Purchase New Pass
                    </a>
                </div>
            </div>
        `).join('');
    }

    container.innerHTML = cardsHtml;
}

// Render Order & Invoice History
function renderOrderHistory(orders) {
    const container = document.getElementById("order-history-container");
    if (!container) return;

    if (!orders || orders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No past order records found for this account.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = orders.map(o => `
        <div class="order-row-item">
            <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <b style="color: #fff; font-size: 14px;">${o.order_id}</b>
                    <span class="badge badge-${o.status}">${o.status}</span>
                </div>
                <div class="order-meta-info">
                    ${o.plan_name} • <b>${o.amount} ${o.currency}</b> • Payment: ${o.payment_method} ${o.trx_id ? `(Trx: ${o.trx_id})` : ''}
                </div>
                ${o.dns_url && o.status !== 'banned' && o.status !== 'rejected' ? `
                    <div style="font-size: 12px; color: #38bdf8; margin-top: 4px;">
                        Host: <code>${o.dns_url}</code> (PIN: <b>${o.client_id}</b>)
                    </div>
                ` : ''}
                ${o.ban_reason ? `
                    <div style="margin-top: 6px; padding: 6px 10px; background: rgba(239, 68, 68, 0.12); border-left: 3px solid #ef4444; border-radius: 4px; font-size: 11px; color: #fca5a5;">
                        <b>${o.ban_reason}</b>
                        ${o.detected_ips && o.detected_ips.length ? `<div style="margin-top: 2px; color: #f87171; font-family: monospace;">Detected IPs: ${o.detected_ips.join(', ')}</div>` : ''}
                    </div>
                ` : (o.admin_note ? `
                    <div style="margin-top: 4px; font-size: 11px; color: var(--text-muted);">
                        Note: ${o.admin_note}
                    </div>
                ` : '')}
                <div>
                    <a href="/api/invoice?id=${o.order_id}" target="_blank" class="invoice-link-btn">
                        🧾 View Official Invoice / Receipt ↗
                    </a>
                </div>
            </div>
            <div style="text-align: right; font-size: 12px; color: var(--text-muted);">
                ${o.created_at ? o.created_at.split(' ')[0] : ''}
            </div>
        </div>
    `).join('');
}

// Copy to Clipboard Utility
function copyToClipboard(text, btn) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        const original = btn.textContent;
        btn.textContent = "✅ Copied!";
        btn.style.borderColor = "#34d399";
        setTimeout(() => {
            btn.textContent = original;
            btn.style.borderColor = "";
        }, 2000);
    }).catch(() => {
        alert("DNS Hostname: " + text);
    });
}

// Download iOS Profile (.mobileconfig)
function downloadIosProfile(clientId, dotDomain) {
    const cleanHost = (dotDomain || clientId || "private-dns-server.com").trim();
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

// Logout Handler
function handleDashboardLogout() {
    if (confirm("Are you sure you want to sign out?")) {
        localStorage.removeItem("customer_token");
        localStorage.removeItem("customer_user");
        window.location.href = "/";
    }
}
