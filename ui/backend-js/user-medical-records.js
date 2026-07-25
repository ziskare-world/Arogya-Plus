        import { toast } from '../js/utils.js';
        import { injectSidebar, renderTopbar } from '../js/sidebar.js';
        import { apiRequest, ensureSession, downloadTextFile, formatDate } from '../js/api-client.js';

        window.toast = toast;
        injectSidebar('medical-records.html');
        document.getElementById('topbar-container').innerHTML = renderTopbar('Medical Records');

        const modal = document.getElementById('record-modal');
        const form = document.getElementById('record-form');
        const submitBtn = document.getElementById('record-submit-btn');
        const listEl = document.getElementById('record-list');

        let records = [];

        const renderRecords = () => {
            if (!records.length) {
                listEl.innerHTML = '<div class="muted">No records uploaded yet.</div>';
                return;
            }

            listEl.innerHTML = records.map((record) => `
                <div style="padding:16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
                    <div>
                        <div style="font-weight:700">${record.title}</div>
                        <div class="muted">${record.recordType || 'General'} - ${formatDate(record.recordDate || record.createdAt)}</div>
                    </div>
                    <button class="btn btn-ghost btn-sm" type="button" data-action="download" data-id="${record._id}">Download</button>
                </div>
            `).join('');
        };

        const loadRecords = async () => {
            const data = await apiRequest('/api/user/medical-records');
            records = data.records || [];
            renderRecords();
        };

        const openRecordModal = () => {
            modal.classList.remove('hidden');
        };

        const closeRecordModal = () => {
            modal.classList.add('hidden');
            form.reset();
        };

        window.openRecordModal = openRecordModal;
        window.closeRecordModal = closeRecordModal;

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeRecordModal();
            }
        });

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';

            const dateValue = document.getElementById('record-date').value;
            const payload = {
                title: document.getElementById('record-title').value.trim(),
                recordType: document.getElementById('record-type').value.trim(),
                recordDate: dateValue ? new Date(dateValue).toISOString() : undefined,
                notes: document.getElementById('record-notes').value.trim(),
                documentUrl: document.getElementById('record-url').value.trim()
            };

            try {
                await apiRequest('/api/user/medical-records', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                toast('Record uploaded successfully', 'success');
                closeRecordModal();
                await loadRecords();
            } catch (error) {
                toast(error.message, 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Save Record';
            }
        });

        listEl.addEventListener('click', async (event) => {
            const button = event.target.closest('button[data-action="download"]');
            if (!button) return;

            const recordId = button.getAttribute('data-id');
            if (!recordId) return;

            try {
                const data = await apiRequest(`/api/user/medical-records/${recordId}/download`);
                downloadTextFile(data.fileName || 'medical-record.txt', data.content || '');
                toast('Download started', 'success');
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

            try {
                await loadRecords();
            } catch (error) {
                toast(error.message, 'error');
            }
        };

        init();
    
