import { toast } from '../js/utils.js';
import { injectSidebar, renderTopbar } from '../js/sidebar.js';
import { apiRequest, ensureSession, formatCurrencyINR, formatDate } from '../js/api-client.js';

window.toast = toast;
injectSidebar('payments.html');
document.getElementById('topbar-container').innerHTML = renderTopbar('Payments & Billing');

const paymentsBody = document.getElementById('payments-body');
const balanceDueEl = document.getElementById('balance-due');
const totalPaidEl = document.getElementById('total-paid');

const paymentModal = document.getElementById('payment-modal');
const paymentForm = document.getElementById('payment-form');
const payAmountInput = document.getElementById('pay-amount-input');
const paySubmitBtn = document.getElementById('pay-submit-btn');

let currentBalanceDue = 0;

const paymentBadge = (status) => {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'verified') return '<span class="badge badge-green">Paid</span>';
    if (normalized === 'failed') return '<span class="badge badge-red">Failed</span>';
    return '<span class="badge badge-yellow">Pending</span>';
};

const buildDescription = (payment) => {
    if (payment.appointment?.doctor?.name) {
        return `${payment.appointment.doctor.name} Consultation`;
    }
    return 'General Medical Invoicing';
};

const renderPayments = (payments) => {
    if (!paymentsBody) return;

    if (!payments.length) {
        paymentsBody.innerHTML = `
          <tr>
            <td colspan="4" style="text-align:center;color:var(--text-400);padding:16px">No payment records found.</td>
          </tr>`;
        return;
    }

    paymentsBody.innerHTML = payments.map((payment) => `
      <tr>
        <td>${formatDate(payment.createdAt)}</td>
        <td>${buildDescription(payment)}</td>
        <td>${formatCurrencyINR(payment.amount || 0)}</td>
        <td>${paymentBadge(payment.status)}</td>
      </tr>
    `).join('');
};

const loadBilling = async () => {
    const data = await apiRequest('/api/user/billing');
    const summary = data.summary || {};
    const payments = data.payments || [];

    currentBalanceDue = Number(summary.balanceDue || 0);
    balanceDueEl.textContent = formatCurrencyINR(currentBalanceDue);
    totalPaidEl.textContent = formatCurrencyINR(summary.totalPaid || 0);

    if (payAmountInput && currentBalanceDue > 0) {
        payAmountInput.value = currentBalanceDue.toString();
    }

    renderPayments(payments);
};

const openPaymentModal = () => {
    if (payAmountInput && currentBalanceDue > 0) {
        payAmountInput.value = currentBalanceDue.toString();
    }
    if (paymentModal) paymentModal.classList.remove('hidden');
};

const closePaymentModal = () => {
    if (paymentModal) paymentModal.classList.add('hidden');
};

window.openPaymentModal = openPaymentModal;
window.closePaymentModal = closePaymentModal;

if (paymentModal) {
    paymentModal.addEventListener('click', (event) => {
        if (event.target === paymentModal) closePaymentModal();
    });
}

if (paymentForm) {
    paymentForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const amount = parseFloat(payAmountInput?.value || '0');
        if (isNaN(amount) || amount <= 0) {
            toast('Please enter a valid payment amount', 'error');
            return;
        }

        try {
            if (paySubmitBtn) {
                paySubmitBtn.disabled = true;
                paySubmitBtn.textContent = 'Processing...';
            }

            const orderRes = await apiRequest('/api/payments/create-order', {
                method: 'POST',
                body: JSON.stringify({ amount })
            });

            const configRes = await apiRequest('/api/payments/config');
            const razorpayKey = configRes.key;

            if (orderRes.order?.id?.startsWith('mock_order_') || !razorpayKey || typeof window.Razorpay === 'undefined') {
                // Execute Mock verification flow
                await apiRequest('/api/payments/verify', {
                    method: 'POST',
                    body: JSON.stringify({
                        razorpay_order_id: orderRes.order.id,
                        razorpay_payment_id: `mock_pay_${Date.now()}`,
                        razorpay_signature: 'mock_signature'
                    })
                });

                toast('Payment processed successfully (Mock Mode)', 'success');
                closePaymentModal();
                await loadBilling();
            } else {
                // Open real Razorpay Checkout modal
                const options = {
                    key: razorpayKey,
                    amount: orderRes.order.amount,
                    currency: orderRes.order.currency,
                    name: 'ArogyaPlus Healthcare',
                    description: 'Medical Services & Consultation Payment',
                    order_id: orderRes.order.id,
                    handler: async (response) => {
                        try {
                            await apiRequest('/api/payments/verify', {
                                method: 'POST',
                                body: JSON.stringify({
                                    razorpay_order_id: response.razorpay_order_id,
                                    razorpay_payment_id: response.razorpay_payment_id,
                                    razorpay_signature: response.razorpay_signature
                                })
                            });
                            toast('Payment completed & verified successfully!', 'success');
                            closePaymentModal();
                            await loadBilling();
                        } catch (err) {
                            toast(err.message || 'Payment verification failed', 'error');
                        }
                    },
                    modal: {
                        ondismiss: () => {
                            toast('Payment checkout cancelled', 'info');
                        }
                    }
                };

                const rzp = new window.Razorpay(options);
                rzp.open();
            }
        } catch (error) {
            toast(error.message || 'Failed to initiate payment', 'error');
        } finally {
            if (paySubmitBtn) {
                paySubmitBtn.disabled = false;
                paySubmitBtn.textContent = 'Proceed to Pay';
            }
        }
    });
}

const init = async () => {
    const session = ensureSession({
        allowedRoles: ['patient'],
        onDenied: () => toast('Please login as user', 'error')
    });
    if (!session.allowed) return;

    try {
        await loadBilling();
    } catch (error) {
        toast(error.message, 'error');
    }
};

init();
