        import { toast } from '../js/utils.js';
        import { injectSidebar, renderTopbar } from '../js/sidebar.js';
        import { apiRequest, ensureSession, formatDate } from '../js/api-client.js';
        import { generatePrescriptionPdf } from '../js/pdf-generator.js';

        window.toast = toast;
        injectSidebar('prescriptions.html');
        document.getElementById('topbar-container').innerHTML = renderTopbar('Prescriptions');

        const listEl = document.getElementById('prescriptions-list');
        let prescriptions = [];
        let currentUser = null;

        const prescriptionStatusBadge = (status) => {
            const normalized = String(status || '').toLowerCase();
            if (normalized === 'active') return '<span class="badge badge-green">Active</span>';
            if (normalized === 'completed') return '<span class="badge badge-blue">Completed</span>';
            return '<span class="badge badge-red">Discontinued</span>';
        };

        const renderPrescriptions = () => {
            if (!prescriptions.length) {
                listEl.innerHTML = '<div class="muted">No prescriptions available.</div>';
                return;
            }

            listEl.innerHTML = prescriptions.map((prescription) => {
                const doctorName = prescription.doctor?.name || 'Assigned Doctor';
                const refillText = prescription.nextRefillDate ? `Next refill: ${formatDate(prescription.nextRefillDate)}` : 'No refill date';
                return `
                <div class="card" style="border-left:4px solid var(--blue)">
                    <div class="flex-between" style="gap:12px;flex-wrap:wrap">
                        <div style="flex:1">
                            <div style="font-weight:700;font-size:1.1rem">${prescription.medicineName}</div>
                            <div class="muted">${doctorName} - ${prescription.frequency || 'As directed'}</div>
                            <div class="muted" style="margin-top:4px">${prescription.dosage || 'Dosage not specified'} | ${refillText}</div>
                            <div style="margin-top:8px">${prescriptionStatusBadge(prescription.status)}</div>
                        </div>
                        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                            <button class="btn btn-outline btn-sm" type="button" data-action="download-pdf" data-id="${prescription._id}">
                                <span>📄</span> Download Rx PDF
                            </button>
                            <button class="btn btn-primary btn-sm" type="button" data-action="refill" data-id="${prescription._id}">Refill</button>
                        </div>
                    </div>
                </div>`;
            }).join('');
        };

        const loadPrescriptions = async () => {
            const data = await apiRequest('/api/user/prescriptions');
            prescriptions = data.prescriptions || [];
            renderPrescriptions();
        };

        listEl.addEventListener('click', async (event) => {
            const pdfBtn = event.target.closest('button[data-action="download-pdf"]');
            if (pdfBtn) {
                const id = pdfBtn.getAttribute('data-id');
                const rx = prescriptions.find((p) => String(p._id) === String(id));
                if (!rx) {
                    toast('Prescription details not found', 'error');
                    return;
                }

                generatePrescriptionPdf({
                    prescriptionId: `RX-${String(rx._id).slice(-6).toUpperCase()}`,
                    date: rx.createdAt ? formatDate(rx.createdAt) : formatDate(new Date()),
                    doctor: rx.doctor || { name: 'Dr. Medical Officer', specialization: 'Consultant Physician' },
                    patient: currentUser || { name: 'Patient' },
                    medications: [{
                        name: rx.medicineName,
                        dosage: rx.dosage || '1 Tab',
                        frequency: rx.frequency || '1-0-1',
                        instructions: rx.instructions || 'Take with water after meals',
                        duration: '5 Days'
                    }],
                    clinicalNotes: rx.instructions || 'Complete full dosage schedule as advised. Stay well hydrated.',
                    nextFollowUp: rx.nextRefillDate ? formatDate(rx.nextRefillDate) : 'As directed by physician',
                    allergies: currentUser?.allergies || []
                });
                return;
            }

            const button = event.target.closest('button[data-action="refill"]');
            if (!button) return;
            const id = button.getAttribute('data-id');
            if (!id) return;

            try {
                await apiRequest(`/api/user/prescriptions/${id}/refill-request`, {
                    method: 'POST'
                });
                toast('Refill request submitted', 'success');
                await loadPrescriptions();
            } catch (error) {
                toast(error.message, 'error');
            }
        });

        const init = async () => {
            const session = ensureSession({
                allowedRoles: ['patient'],
                onDenied: () => toast('Please login as user', 'error')
            });
            if (!session.allowed) return;
            currentUser = session.user;

            try {
                await loadPrescriptions();
            } catch (error) {
                toast(error.message, 'error');
            }
        };

        init();
    
