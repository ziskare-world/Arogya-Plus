import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession, formatCurrencyINR, formatDate } from "../js/api-client.js";

window.toast = toast;
injectSidebar("payments.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Payments & Billing");

// DOM References
const paymentsBody = document.getElementById("payments-body");
const balanceDueEl = document.getElementById("balance-due");
const totalPaidEl = document.getElementById("total-paid");
const invoicesClearedEl = document.getElementById("invoices-cleared");
const pendingInvoicesEl = document.getElementById("pending-invoices");
const ledgerCountBadge = document.getElementById("ledger-count-badge");
const billingSearchInput = document.getElementById("billing-search");
const filterBtns = document.querySelectorAll(".billing-filter-btn");

// Payment Modal Elements
const paymentModal = document.getElementById("payment-modal");
const paymentForm = document.getElementById("payment-form");
const payAmountInput = document.getElementById("pay-amount-input");
const payAppointmentIdInput = document.getElementById("pay-appointment-id");
const paySubmitBtn = document.getElementById("pay-submit-btn");
const openPayBalanceBtn = document.getElementById("open-pay-balance-btn");
const closePaymentModalBtn = document.getElementById("close-payment-modal-btn");
const cancelPaymentModalBtn = document.getElementById("cancel-payment-modal-btn");

const methodGateway = document.getElementById("method-gateway");
const methodUpi = document.getElementById("method-upi");
const upiSection = document.getElementById("upi-section");
const summaryBaseAmount = document.getElementById("summary-base-amount");
const summaryGstAmount = document.getElementById("summary-gst-amount");
const summaryTotalAmount = document.getElementById("summary-total-amount");

// Invoice Modal Elements
const invoiceModal = document.getElementById("invoice-modal");
const closeInvoiceModalBtn = document.getElementById("close-invoice-modal-btn");
const invModalNumber = document.getElementById("inv-modal-number");
const invModalDate = document.getElementById("inv-modal-date");
const invModalStatusBadge = document.getElementById("inv-modal-status-badge");
const invPatientName = document.getElementById("inv-patient-name");
const invPatientContact = document.getElementById("inv-patient-contact");
const invPatientEmail = document.getElementById("inv-patient-email");
const invDoctorName = document.getElementById("inv-doctor-name");
const invDoctorDept = document.getElementById("inv-doctor-dept");
const invDoctorClinic = document.getElementById("inv-doctor-clinic");
const invItemDesc = document.getElementById("inv-item-desc");
const invItemBase = document.getElementById("inv-item-base");
const invItemGst = document.getElementById("inv-item-gst");
const invItemTotal = document.getElementById("inv-item-total");
const invGrandTotal = document.getElementById("inv-grand-total");
const invCryptoHash = document.getElementById("inv-crypto-hash");

// Verification Modal Elements
const verificationModal = document.getElementById("verification-modal");
const closeVerifyModalBtn = document.getElementById("close-verify-modal-btn");
const closeVerifyModalBtn2 = document.getElementById("close-verify-modal-btn-2");
const verifyViewInvoiceBtn = document.getElementById("verify-view-invoice-btn");
const verInvoiceNum = document.getElementById("ver-invoice-num");
const verPayId = document.getElementById("ver-pay-id");
const verOrderId = document.getElementById("ver-order-id");
const verAmount = document.getElementById("ver-amount");
const verHash = document.getElementById("ver-hash");

// State
let allPayments = [];
let currentBalanceDue = 0;
let selectedPaymentMethod = "gateway"; // 'gateway' or 'upi'
let activeFilter = "all";
let searchTerm = "";
let currentUserSession = null;
let lastVerifiedPaymentId = null;

const paymentBadge = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "verified") {
    return '<span class="badge badge-green">✓ Verified & Paid</span>';
  }
  if (normalized === "failed") {
    return '<span class="badge badge-red">✕ Payment Failed</span>';
  }
  return '<span class="badge badge-yellow">⏳ Pending Settlement</span>';
};

const getDoctorInfo = (payment) => {
  if (payment?.appointment?.doctor) {
    const doc = payment.appointment.doctor;
    return {
      name: doc.name ? (doc.name.startsWith("Dr.") ? doc.name : `Dr. ${doc.name}`) : "ArogyaPlus Medical Team",
      specialization: doc.specialization || "Clinical Specialist",
      clinicAddress: doc.clinicAddress || "Hospital OPD Wing",
      phone: doc.phone || "1800-AROGYA"
    };
  }
  return {
    name: "ArogyaPlus Healthcare Network",
    specialization: "General Medical Services",
    clinicAddress: "Main Hospital Facility",
    phone: "1800-AROGYA"
  };
};

const buildDescription = (payment) => {
  if (payment?.serviceDescription) return payment.serviceDescription;
  const doc = getDoctorInfo(payment);
  return `Consultation & EHR with ${doc.name}`;
};

const updateAmountSummary = (val) => {
  const num = parseFloat(val || "0");
  if (isNaN(num) || num <= 0) {
    if (summaryBaseAmount) summaryBaseAmount.textContent = "₹0.00";
    if (summaryGstAmount) summaryGstAmount.textContent = "₹0.00";
    if (summaryTotalAmount) summaryTotalAmount.textContent = "₹0.00";
    return;
  }

  const base = Math.round((num / 1.18) * 100) / 100;
  const gst = Math.round((num - base) * 100) / 100;

  if (summaryBaseAmount) summaryBaseAmount.textContent = formatCurrencyINR(base);
  if (summaryGstAmount) summaryGstAmount.textContent = formatCurrencyINR(gst);
  if (summaryTotalAmount) summaryTotalAmount.textContent = formatCurrencyINR(num);
};

const renderPayments = () => {
  if (!paymentsBody) return;

  let filtered = [...allPayments];

  if (activeFilter === "due") {
    filtered = filtered.filter((p) => String(p.status).toLowerCase() !== "verified");
  } else if (activeFilter === "paid") {
    filtered = filtered.filter((p) => String(p.status).toLowerCase() === "verified");
  }

  if (searchTerm.trim()) {
    const q = searchTerm.toLowerCase();
    filtered = filtered.filter((p) => {
      const invNum = String(p.invoiceNumber || p._id || "").toLowerCase();
      const desc = String(buildDescription(p)).toLowerCase();
      const doc = String(p?.appointment?.doctor?.name || "").toLowerCase();
      return invNum.includes(q) || desc.includes(q) || doc.includes(q);
    });
  }

  if (ledgerCountBadge) {
    ledgerCountBadge.textContent = `${filtered.length} Records`;
  }

  if (!filtered.length) {
    paymentsBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:var(--text-400);padding:24px">
          No payment records found matching your filter criteria.
        </td>
      </tr>`;
    return;
  }

  paymentsBody.innerHTML = filtered
    .map((payment) => {
      const isPaid = String(payment.status).toLowerCase() === "verified";
      const invoiceNumber = payment.invoiceNumber || `INV-${String(payment._id).slice(-6).toUpperCase()}`;
      const doc = getDoctorInfo(payment);
      const paymentId = String(payment._id);
      const amountNum = Number(payment.amount || 0);

      const actionButtons = isPaid
        ? `
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-outline btn-sm" onclick="window.viewTaxInvoice('${paymentId}')" title="View & Print Official Medical Invoice">
              📄 Invoice
            </button>
            <button class="btn btn-primary btn-sm" onclick="window.viewPaymentVerification('${paymentId}')" title="View Cryptographic Verification Certificate">
              🛡️ Proof
            </button>
          </div>`
        : `
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" onclick="window.quickPayInvoice('${paymentId}', ${amountNum})" title="Pay this invoice now">
              💳 Pay Now
            </button>
            <button class="btn btn-outline btn-sm" onclick="window.viewTaxInvoice('${paymentId}')" title="View Bill Preview">
              📄 Bill
            </button>
          </div>`;

      return `
        <tr>
          <td>
            <div style="font-weight:700;font-family:monospace;color:var(--blue)">${invoiceNumber}</div>
            <div style="font-size:0.72rem;color:var(--text-400)">${payment.method || "Online"}</div>
          </td>
          <td>
            <div style="font-weight:600;color:var(--text-100)">${formatDate(payment.createdAt)}</div>
          </td>
          <td>
            <div style="font-weight:600;color:var(--text-100)">${buildDescription(payment)}</div>
            <div style="font-size:0.75rem;color:var(--text-400)">${doc.specialization} • ${doc.clinicAddress}</div>
          </td>
          <td>
            <div style="font-weight:800;color:var(--text-100)">${formatCurrencyINR(amountNum)}</div>
            <div style="font-size:0.72rem;color:var(--text-400)">Inc. 18% GST</div>
          </td>
          <td>${paymentBadge(payment.status)}</td>
          <td>${actionButtons}</td>
        </tr>`;
    })
    .join("");
};

const updateFilterTabCounters = () => {
  const allCount = allPayments.length;
  const dueCount = allPayments.filter((p) => String(p.status).toLowerCase() !== "verified").length;
  const paidCount = allPayments.filter((p) => String(p.status).toLowerCase() === "verified").length;

  filterBtns.forEach((btn) => {
    const f = btn.getAttribute("data-filter");
    if (f === "all") btn.textContent = `All Bills (${allCount})`;
    if (f === "due") btn.textContent = `⏳ Due / Unpaid (${dueCount})`;
    if (f === "paid") btn.textContent = `✅ Verified & Paid (${paidCount})`;
  });
};

const loadBilling = async () => {
  const data = await apiRequest("/api/user/billing");
  const summary = data.summary || {};
  allPayments = data.payments || [];

  currentBalanceDue = Number(summary.balanceDue || 0);
  if (balanceDueEl) balanceDueEl.textContent = formatCurrencyINR(currentBalanceDue);
  if (totalPaidEl) totalPaidEl.textContent = formatCurrencyINR(summary.totalPaid || 0);
  if (invoicesClearedEl) invoicesClearedEl.textContent = String(summary.verifiedCount || 0);
  if (pendingInvoicesEl) pendingInvoicesEl.textContent = String(summary.pendingCount || 0);

  if (payAmountInput && currentBalanceDue > 0) {
    payAmountInput.value = currentBalanceDue.toString();
    updateAmountSummary(currentBalanceDue);
  }

  updateFilterTabCounters();
  renderPayments();
};

// Open and Close Payment Modal
const openPaymentModal = (prefillAmount = null, appointmentId = null) => {
  const amt = prefillAmount !== null ? prefillAmount : (currentBalanceDue > 0 ? currentBalanceDue : 500);
  if (payAmountInput) {
    payAmountInput.value = amt.toString();
    updateAmountSummary(amt);
  }
  if (payAppointmentIdInput) {
    payAppointmentIdInput.value = appointmentId || "";
  }
  selectPaymentMethod("gateway");
  if (paymentModal) paymentModal.classList.remove("hidden");
};

const closePaymentModal = () => {
  if (paymentModal) paymentModal.classList.add("hidden");
};

window.openPaymentModal = openPaymentModal;
window.closePaymentModal = closePaymentModal;

window.quickPayInvoice = (paymentId, amount) => {
  const payment = allPayments.find((p) => String(p._id) === String(paymentId));
  const appointmentId = payment?.appointment?._id || null;
  openPaymentModal(amount, appointmentId);
};

// Payment Method Selection
const selectPaymentMethod = (method) => {
  selectedPaymentMethod = method;
  if (method === "gateway") {
    methodGateway.classList.add("selected");
    methodUpi.classList.remove("selected");
    upiSection.classList.add("hidden");
    paySubmitBtn.textContent = "Proceed to Razorpay Checkout";
  } else {
    methodUpi.classList.add("selected");
    methodGateway.classList.remove("selected");
    upiSection.classList.remove("hidden");
    paySubmitBtn.textContent = "Verify & Confirm UPI Payment";
  }
};

if (methodGateway) methodGateway.addEventListener("click", () => selectPaymentMethod("gateway"));
if (methodUpi) methodUpi.addEventListener("click", () => selectPaymentMethod("upi"));

if (openPayBalanceBtn) openPayBalanceBtn.addEventListener("click", () => openPaymentModal());
if (closePaymentModalBtn) closePaymentModalBtn.addEventListener("click", closePaymentModal);
if (cancelPaymentModalBtn) cancelPaymentModalBtn.addEventListener("click", closePaymentModal);
if (paymentModal) {
  paymentModal.addEventListener("click", (e) => {
    if (e.target === paymentModal) closePaymentModal();
  });
}

if (payAmountInput) {
  payAmountInput.addEventListener("input", (e) => {
    updateAmountSummary(e.target.value);
  });
}

// Open Detailed Medical Tax Invoice Modal
window.viewTaxInvoice = async (paymentId) => {
  try {
    let invoiceData = null;
    try {
      const res = await apiRequest(`/api/payments/invoice/${paymentId}`);
      if (res && res.invoice) invoiceData = res.invoice;
    } catch {
      // fallback to local payment object
      const p = allPayments.find((item) => String(item._id) === String(paymentId));
      if (p) {
        const net = Number(p.amount || 0);
        const base = Math.round((net / 1.18) * 100) / 100;
        invoiceData = {
          invoiceNumber: p.invoiceNumber || `INV-${String(p._id).slice(-8).toUpperCase()}`,
          date: p.createdAt,
          status: p.status,
          amount: net,
          baseAmount: base,
          gstAmount: Math.round((net - base) * 100) / 100,
          serviceDescription: buildDescription(p),
          verificationHash: `APV-${String(p._id).slice(-10).toUpperCase()}`,
          doctor: getDoctorInfo(p)
        };
      }
    }

    if (!invoiceData) {
      toast("Invoice details could not be loaded", "error");
      return;
    }

    const doc = invoiceData.doctor || getDoctorInfo({});
    const isPaid = String(invoiceData.status).toLowerCase() === "verified";

    invModalNumber.textContent = invoiceData.invoiceNumber || "INV-2026-PREVIEW";
    invModalDate.textContent = `Date: ${formatDate(invoiceData.date || new Date())}`;
    invModalStatusBadge.innerHTML = isPaid
      ? '<span class="badge badge-green">PAID & SETTLED</span>'
      : '<span class="badge badge-yellow">PAYMENT DUE</span>';

    invPatientName.textContent = currentUserSession?.name || "Patient";
    invPatientContact.textContent = `📞 ${currentUserSession?.phone || "+91 98765 43210"}`;
    invPatientEmail.textContent = `✉️ ${currentUserSession?.email || "patient@arogyaplus.com"}`;

    invDoctorName.textContent = doc.name;
    invDoctorDept.textContent = doc.specialization || "Department of Clinical Services";
    invDoctorClinic.textContent = doc.clinicAddress || "Hospital OPD Wing";

    invItemDesc.textContent = invoiceData.serviceDescription || "Clinical Consultation & Care";
    invItemBase.textContent = formatCurrencyINR(invoiceData.baseAmount || 0);
    invItemGst.textContent = formatCurrencyINR(invoiceData.gstAmount || 0);
    invItemTotal.textContent = formatCurrencyINR(invoiceData.amount || 0);
    invGrandTotal.textContent = formatCurrencyINR(invoiceData.amount || 0);
    invCryptoHash.textContent = invoiceData.verificationHash || `APV-${String(paymentId).slice(-8).toUpperCase()}`;

    if (invoiceModal) invoiceModal.classList.remove("hidden");
  } catch (err) {
    toast(err.message || "Failed to open invoice", "error");
  }
};

const closeInvoiceModal = () => {
  if (invoiceModal) invoiceModal.classList.add("hidden");
};

if (closeInvoiceModalBtn) closeInvoiceModalBtn.addEventListener("click", closeInvoiceModal);
if (invoiceModal) {
  invoiceModal.addEventListener("click", (e) => {
    if (e.target === invoiceModal) closeInvoiceModal();
  });
}

// Open Payment Verification Modal
window.viewPaymentVerification = (paymentId) => {
  const payment = allPayments.find((p) => String(p._id) === String(paymentId));
  if (!payment) return;

  lastVerifiedPaymentId = paymentId;
  verInvoiceNum.textContent = payment.invoiceNumber || `INV-${String(payment._id).slice(-8).toUpperCase()}`;
  verPayId.textContent = payment.razorpayPaymentId || `pay_sim_${Date.now()}`;
  verOrderId.textContent = payment.razorpayOrderId || `order_sim_${Date.now()}`;
  verAmount.textContent = formatCurrencyINR(payment.amount || 0);
  verHash.textContent = `SHA256: ${String(payment.razorpaySignature || payment._id).slice(0, 28).toUpperCase()}`;

  if (verificationModal) verificationModal.classList.remove("hidden");
};

const closeVerifyModal = () => {
  if (verificationModal) verificationModal.classList.add("hidden");
};

if (closeVerifyModalBtn) closeVerifyModalBtn.addEventListener("click", closeVerifyModal);
if (closeVerifyModalBtn2) closeVerifyModalBtn2.addEventListener("click", closeVerifyModal);
if (verifyViewInvoiceBtn) {
  verifyViewInvoiceBtn.addEventListener("click", () => {
    closeVerifyModal();
    if (lastVerifiedPaymentId) window.viewTaxInvoice(lastVerifiedPaymentId);
  });
}

if (verificationModal) {
  verificationModal.addEventListener("click", (e) => {
    if (e.target === verificationModal) closeVerifyModal();
  });
}

// Payment Form Submission & Verification Execution
if (paymentForm) {
  paymentForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const amount = parseFloat(payAmountInput?.value || "0");
    const appointmentId = payAppointmentIdInput?.value || undefined;

    if (isNaN(amount) || amount <= 0) {
      toast("Please enter a valid payment amount", "error");
      return;
    }

    try {
      if (paySubmitBtn) {
        paySubmitBtn.disabled = true;
        paySubmitBtn.textContent = "Processing Transaction...";
      }

      // Step 1: Create Order
      const orderRes = await apiRequest("/api/payments/create-order", {
        method: "POST",
        body: JSON.stringify({ amount, appointmentId })
      });

      const configRes = await apiRequest("/api/payments/config");
      const razorpayKey = configRes.key;

      const executeVerification = async (payload) => {
        const verifyRes = await apiRequest("/api/payments/verify", {
          method: "POST",
          body: JSON.stringify(payload)
        });

        toast("Payment verified and recorded successfully!", "success");
        closePaymentModal();
        await loadBilling();

        // Show Verification Certificate Modal
        if (verifyRes.payment) {
          window.viewPaymentVerification(verifyRes.payment._id);
        }
      };

      // If Mock mode, or if UPI / QR code was selected:
      if (
        selectedPaymentMethod === "upi" ||
        orderRes.order?.id?.startsWith("mock_order_") ||
        !razorpayKey ||
        typeof window.Razorpay === "undefined"
      ) {
        const mockPayId = `pay_${selectedPaymentMethod === "upi" ? "upi" : "card"}_${Date.now()}`;
        await executeVerification({
          razorpay_order_id: orderRes.order.id,
          razorpay_payment_id: mockPayId,
          razorpay_signature: "mock_signature",
          method: selectedPaymentMethod === "upi" ? "UPI / Instant QR Scan" : "Razorpay Cards & Netbanking"
        });
      } else {
        // Real Razorpay Checkout modal
        const options = {
          key: razorpayKey,
          amount: orderRes.order.amount,
          currency: orderRes.order.currency,
          name: "ArogyaPlus Healthcare Network",
          description: "Clinical Services & Consultation Payment",
          order_id: orderRes.order.id,
          handler: async (response) => {
            try {
              await executeVerification({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                method: "Razorpay Payment Gateway"
              });
            } catch (err) {
              toast(err.message || "Payment verification failed", "error");
            }
          },
          modal: {
            ondismiss: () => {
              toast("Payment checkout cancelled", "info");
            }
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      }
    } catch (error) {
      toast(error.message || "Failed to initiate payment", "error");
    } finally {
      if (paySubmitBtn) {
        paySubmitBtn.disabled = false;
        paySubmitBtn.textContent =
          selectedPaymentMethod === "upi"
            ? "Verify & Confirm UPI Payment"
            : "Proceed to Razorpay Checkout";
      }
    }
  });
}

// Filter Tab Handlers
filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = btn.getAttribute("data-filter") || "all";
    renderPayments();
  });
});

// Search Filter Handler
if (billingSearchInput) {
  billingSearchInput.addEventListener("input", (e) => {
    searchTerm = e.target.value || "";
    renderPayments();
  });
}

const init = async () => {
  const session = ensureSession({
    allowedRoles: ["patient"],
    onDenied: () => toast("Please login as user", "error")
  });
  if (!session.allowed) return;
  currentUserSession = session.user;

  try {
    await loadBilling();
  } catch (error) {
    toast(error.message, "error");
  }
};

init();
