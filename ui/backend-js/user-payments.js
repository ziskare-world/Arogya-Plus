        import { toast } from '../js/utils.js';
        import { injectSidebar, renderTopbar } from '../js/sidebar.js';
        import { apiRequest, ensureSession, formatCurrencyINR, formatDate } from '../js/api-client.js';

        window.toast = toast;
        injectSidebar('payments.html');
        document.getElementById('topbar-container').innerHTML = renderTopbar('Payments & Billing');

        const paymentsBody = document.getElementById('payments-body');
        const balanceDueEl = document.getElementById('balance-due');
        const totalPaidEl = document.getElementById('total-paid');

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
            return 'General Billing Entry';
        };

        const renderPayments = (payments) => {
            if (!payments.length) {
                paymentsBody.innerHTML = `
                  <tr>
                    <td colspan="4" style="text-align:center;color:var(--text-400)">No payment records found.</td>
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

            balanceDueEl.textContent = formatCurrencyINR(summary.balanceDue || 0);
            totalPaidEl.textContent = formatCurrencyINR(summary.totalPaid || 0);
            renderPayments(payments);
        };

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
    
