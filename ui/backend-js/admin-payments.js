import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession } from "../js/api-client.js";

window.toast = toast;
injectSidebar("payments.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Payments & Billing");

const metaKey = "admin_payment_meta";
const tableBodyEl = document.getElementById("txn-tbody");
const patientInputEl = document.getElementById("pay-pid");
const amountInputEl = document.getElementById("pay-amt");
const methodInputEl = document.getElementById("pay-method");
const descInputEl = document.getElementById("pay-desc");

let payments = [];
let patientsById = {};
let paymentMeta = {};
let paymentConfig = { mockMode: true };

const parseJson = (value, fallback = {}) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatMoney = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2
  })}`;

const toTitle = (value = "") => {
  const text = String(value || "").replace(/_/g, " ").trim();
  if (!text) return "-";
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const statusBadge = (status = "") => {
  const normalized = String(status).toLowerCase();
  if (normalized === "verified" || normalized === "success") return '<span class="badge badge-green">Success</span>';
  if (normalized === "failed" || normalized === "refunded") return '<span class="badge badge-red">Failed</span>';
  return '<span class="badge badge-yellow">Pending</span>';
};

const loadMeta = () => {
  paymentMeta = parseJson(sessionStorage.getItem(metaKey), {});
};

const saveMeta = () => {
  sessionStorage.setItem(metaKey, JSON.stringify(paymentMeta));
};

const getMeta = (payment) => paymentMeta[payment.razorpayOrderId || payment._id] || {};

const renderStats = () => {
  const statEls = document.querySelectorAll(".stat-grid .stat-card .stat-value");

  const totalRevenue = payments
    .filter((payment) => payment.status === "verified")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const pendingAmount = payments
    .filter((payment) => payment.status === "created")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const failedAmount = payments
    .filter((payment) => payment.status === "failed")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const insuranceAmount = payments
    .filter((payment) => {
      const meta = getMeta(payment);
      const method = String(payment.method || meta.method || "").toLowerCase();
      return method.includes("insurance");
    })
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  if (statEls[0]) statEls[0].textContent = formatMoney(totalRevenue);
  if (statEls[1]) statEls[1].textContent = formatMoney(pendingAmount);
  if (statEls[2]) statEls[2].textContent = formatMoney(failedAmount);
  if (statEls[3]) statEls[3].textContent = formatMoney(insuranceAmount);
};

const paymentPatientLabel = (payment) => {
  const meta = getMeta(payment);
  if (meta.patientLabel) return meta.patientLabel;

  const userId = typeof payment.user === "string" ? payment.user : payment.user?._id;
  if (userId && patientsById[userId]?.name) return patientsById[userId].name;

  return `PAT-${String(userId || "NA").slice(-6).toUpperCase()}`;
};

const paymentMethodLabel = (payment) => {
  const meta = getMeta(payment);
  return payment.method || meta.method || "Online";
};

const paymentDescription = (payment) => {
  const meta = getMeta(payment);
  if (meta.desc) return meta.desc;
  if (payment.appointment?.doctor?.name) {
    return `Consultation - ${payment.appointment.doctor.name}`;
  }
  return "General Payment";
};

const paymentDate = (payment) => {
  const date = new Date(payment.createdAt);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
};

const sortPayments = (list) => [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

const renderTransactions = () => {
  if (!tableBodyEl) return;

  const rows = sortPayments(payments);
  if (!rows.length) {
    tableBodyEl.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;color:var(--text-500)">No payment records found.</td>
      </tr>`;
    return;
  }

  tableBodyEl.innerHTML = rows
    .map((payment) => {
      const id = payment.razorpayPaymentId || payment.razorpayOrderId || payment._id || "-";
      return `
        <tr>
          <td><code style="color:var(--blue);font-size:.78rem">${escapeHtml(String(id).slice(0, 20))}</code></td>
          <td>${escapeHtml(paymentPatientLabel(payment))}</td>
          <td style="font-weight:700;color:#16a34a">${escapeHtml(formatMoney(payment.amount))}</td>
          <td><span class="badge badge-blue">${escapeHtml(paymentMethodLabel(payment))}</span></td>
          <td style="color:var(--text-400)">${escapeHtml(paymentDescription(payment))}</td>
          <td style="color:var(--text-500)">${escapeHtml(paymentDate(payment))}</td>
          <td>${statusBadge(payment.status)}</td>
        </tr>`;
    })
    .join("");
};

const updateBreakdownCard = () => {
  const breakdownCard = document.querySelector(".grid-2 .card:nth-child(2)");
  if (!breakdownCard) return;

  const summary = {
    insurance: 0,
    creditCard: 0,
    cash: 0,
    other: 0
  };

  payments.forEach((payment) => {
    const amount = Number(payment.amount || 0);
    const method = String(paymentMethodLabel(payment)).toLowerCase();
    if (method.includes("insurance")) {
      summary.insurance += amount;
    } else if (method.includes("credit")) {
      summary.creditCard += amount;
    } else if (method.includes("cash")) {
      summary.cash += amount;
    } else {
      summary.other += amount;
    }
  });

  const total = summary.insurance + summary.creditCard + summary.cash + summary.other || 1;
  const rows = [
    { label: "Insurance", value: summary.insurance, percent: Math.round((summary.insurance / total) * 100), color: "var(--blue)" },
    { label: "Credit Card", value: summary.creditCard, percent: Math.round((summary.creditCard / total) * 100), color: "var(--blue)" },
    { label: "Cash", value: summary.cash, percent: Math.round((summary.cash / total) * 100), color: "var(--green)" },
    { label: "UPI / Other", value: summary.other, percent: Math.round((summary.other / total) * 100), color: "var(--purple)" }
  ];

  const content = rows
    .map(
      (item) => `
        <div class="flex-between">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:10px;height:10px;border-radius:50%;background:${item.color}"></div>
            <span style="font-size:.83rem">${item.label}</span>
          </div>
          <div style="font-weight:700">${formatMoney(item.value)} <span style="color:var(--text-500);font-size:.75rem">${item.percent}%</span></div>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${item.percent}%;background:${item.color}"></div></div>`
    )
    .join("");

  const cardBody = breakdownCard.querySelector("div[style*='display:flex;flex-direction:column;gap:12px']");
  if (cardBody) {
    cardBody.innerHTML = content;
  }
};

const loadPayments = async () => {
  if (tableBodyEl) {
    tableBodyEl.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;color:var(--text-500)">Loading transactions...</td>
      </tr>`;
  }

  const data = await apiRequest("/api/payment/my");
  payments = data.payments || [];
};

const loadPatients = async () => {
  const data = await apiRequest("/api/admin/users?role=patient");
  const users = data.users || [];
  patientsById = users.reduce((acc, user) => {
    const id = user._id || user.id;
    if (id) acc[id] = user;
    return acc;
  }, {});
};

const loadPaymentConfig = async () => {
  try {
    const data = await apiRequest("/api/payment/config");
    paymentConfig = {
      mockMode: Boolean(data.mockMode)
    };
  } catch (error) {
    paymentConfig = { mockMode: true };
  }
};

const refreshPaymentsView = async () => {
  await loadPayments();
  renderStats();
  renderTransactions();
  updateBreakdownCard();
};

window.showPayForm = function showPayForm() {
  const formCard = document.getElementById("pay-form-card");
  if (formCard) {
    formCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};

window.addPayment = async function addPayment() {
  const patientLabel = String(patientInputEl?.value || "").trim();
  const amount = Number(amountInputEl?.value || 0);
  const method = String(methodInputEl?.value || "").trim() || "Online";
  const desc = String(descInputEl?.value || "").trim() || "Payment";

  if (!patientLabel || !amount) {
    toast("Fill required fields", "error");
    return;
  }
  if (amount <= 0) {
    toast("Amount must be greater than zero", "error");
    return;
  }

  try {
    const orderData = await apiRequest("/api/payment/create-order", {
      method: "POST",
      body: JSON.stringify({ amount })
    });

    const orderId = orderData.order?.id || orderData.payment?.razorpayOrderId || "";
    if (orderId) {
      paymentMeta[orderId] = { patientLabel, method, desc };
      saveMeta();
    }

    if (paymentConfig.mockMode && orderId) {
      await apiRequest("/api/payment/verify", {
        method: "POST",
        body: JSON.stringify({
          razorpay_order_id: orderId,
          razorpay_payment_id: `mock_payment_${Date.now()}`,
          razorpay_signature: "mock_signature"
        })
      });
      toast(`Payment of ${formatMoney(amount)} processed for ${patientLabel}`, "success");
    } else {
      toast(`Payment order created for ${patientLabel}`, "success");
    }

    if (patientInputEl) patientInputEl.value = "";
    if (amountInputEl) amountInputEl.value = "";
    if (descInputEl) descInputEl.value = "";
    if (methodInputEl) methodInputEl.selectedIndex = 0;

    await refreshPaymentsView();
  } catch (error) {
    toast(error.message, "error");
  }
};

const init = async () => {
  const session = ensureSession({
    allowedRoles: ["admin"],
    onDenied: () => toast("Please login as admin", "error")
  });
  if (!session.allowed) return;

  loadMeta();

  try {
    await Promise.all([loadPaymentConfig(), loadPatients(), refreshPaymentsView()]);
  } catch (error) {
    toast(error.message, "error");
    payments = [];
    renderStats();
    renderTransactions();
    updateBreakdownCard();
  }
};

init();

