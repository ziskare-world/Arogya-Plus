import { toast } from '../js/utils.js';
import { injectSidebar, renderTopbar } from '../js/sidebar.js';
import { apiRequest, ensureSession, formatCurrencyINR, formatDate } from '../js/api-client.js';

window.toast = toast;
injectSidebar('insurance.html');
document.getElementById('topbar-container').innerHTML = renderTopbar('Insurance Claims');

const claimModal = document.getElementById('claim-modal');
const claimForm = document.getElementById('claim-form');
const claimSubmitBtn = document.getElementById('claim-submit-btn');
const claimsBody = document.getElementById('claims-body');

const statTotalEl = document.getElementById('stat-total-claims');
const statPendingEl = document.getElementById('stat-pending-claims');
const statApprovedEl = document.getElementById('stat-approved-claims');
const statRejectedEl = document.getElementById('stat-rejected-claims');

let claimsList = [];

const statusBadge = (status) => {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'approved') return '<span class="badge badge-green">Approved</span>';
    if (normalized === 'rejected') return '<span class="badge badge-red">Rejected</span>';
    if (normalized === 'under_review') return '<span class="badge badge-yellow">Under Review</span>';
    return '<span class="badge badge-blue">Pending</span>';
};

const renderStats = (claims = []) => {
    const total = claims.length;
    const pending = claims.filter(c => ['pending', 'under_review'].includes(String(c.status || '').toLowerCase())).length;
    const approved = claims.filter(c => String(c.status || '').toLowerCase() === 'approved').length;
    const rejected = claims.filter(c => String(c.status || '').toLowerCase() === 'rejected').length;

    if (statTotalEl) statTotalEl.textContent = String(total);
    if (statPendingEl) statPendingEl.textContent = String(pending);
    if (statApprovedEl) statApprovedEl.textContent = String(approved);
    if (statRejectedEl) statRejectedEl.textContent = String(rejected);
};

const renderClaims = (claims = []) => {
    if (!claimsBody) return;

    if (!claims.length) {
        claimsBody.innerHTML = `
            <tr>
                <td colspan="7" class="muted" style="text-align:center;padding:16px">No insurance claims submitted yet. Click "+ File New Claim" to get started.</td>
            </tr>`;
        return;
    }

    claimsBody.innerHTML = claims.map((claim) => `
        <tr>
            <td>${formatDate(claim.createdAt)}</td>
            <td><strong>${claim.providerName || '-'}</strong></td>
            <td><code>${claim.policyNumber || '-'}</code></td>
            <td>${formatCurrencyINR(claim.claimAmount || 0)}</td>
            <td>${claim.claimReason || '-'}</td>
            <td>${statusBadge(claim.status)}</td>
            <td class="muted">${claim.adminRemark || 'No remark'}</td>
        </tr>
    `).join('');
};

const loadClaims = async () => {
    const data = await apiRequest('/api/insurance/my');
    claimsList = data.claims || [];
    renderStats(claimsList);
    renderClaims(claimsList);
};

const openClaimModal = () => {
    if (claimModal) claimModal.classList.remove('hidden');
};

const closeClaimModal = () => {
    if (claimModal) claimModal.classList.add('hidden');
    if (claimForm) claimForm.reset();
};

window.openClaimModal = openClaimModal;
window.closeClaimModal = closeClaimModal;

if (claimModal) {
    claimModal.addEventListener('click', (event) => {
        if (event.target === claimModal) closeClaimModal();
    });
}

if (claimForm) {
    claimForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const providerName = String(document.getElementById('provider-name-input')?.value || '').trim();
        const policyNumber = String(document.getElementById('policy-number-input')?.value || '').trim();
        const claimAmount = parseFloat(document.getElementById('claim-amount-input')?.value || '0');
        const claimReason = String(document.getElementById('claim-reason-input')?.value || '').trim();

        if (!providerName || !policyNumber || claimAmount <= 0 || !claimReason) {
            toast('Please fill out all required fields with valid details', 'error');
            return;
        }

        try {
            if (claimSubmitBtn) {
                claimSubmitBtn.disabled = true;
                claimSubmitBtn.textContent = 'Submitting...';
            }

            await apiRequest('/api/insurance/claims', {
                method: 'POST',
                body: JSON.stringify({
                    providerName,
                    policyNumber,
                    claimAmount,
                    claimReason
                })
            });

            toast('Insurance claim submitted successfully', 'success');
            closeClaimModal();
            await loadClaims();
        } catch (error) {
            toast(error.message || 'Failed to submit claim', 'error');
        } finally {
            if (claimSubmitBtn) {
                claimSubmitBtn.disabled = false;
                claimSubmitBtn.textContent = 'Submit Claim';
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
        await loadClaims();
    } catch (error) {
        toast(error.message, 'error');
    }
};

init();
