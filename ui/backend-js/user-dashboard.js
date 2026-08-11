        import { toast } from '../js/utils.js';
        import { injectSidebar, renderTopbar } from '../js/sidebar.js';
        import { apiRequest, ensureSession, formatCurrencyINR } from '../js/api-client.js';
        import { initAiChatWidget } from '../js/ai-chat-widget.js';

        window.toast = toast;
        injectSidebar('dashboard.html');
        document.getElementById('topbar-container').innerHTML = renderTopbar('User Dashboard');
        initAiChatWidget();

        const toStatusBadge = (status) => {
            const normalized = String(status || '').toLowerCase();
            if (normalized === 'confirmed') return { className: 'badge badge-green', label: 'Confirmed' };
            if (normalized === 'completed') return { className: 'badge badge-blue', label: 'Completed' };
            if (normalized === 'cancelled') return { className: 'badge badge-red', label: 'Cancelled' };
            return { className: 'badge badge-blue', label: 'N/A' };
        };

        const formatCompactTime = (value) => {
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return '-';
            return date.toLocaleString();
        };

        const renderRecentActivity = (activity = []) => {
            const container = document.getElementById('recent-activity');
            if (!activity.length) {
                container.innerHTML = `
                  <div style="display:flex;gap:12px;font-size:.85rem">
                    <span style="opacity:.6">--</span>
                    <span>No activity found</span>
                  </div>`;
                return;
            }

            container.innerHTML = activity.map((item) => `
              <div style="display:flex;gap:12px;font-size:.85rem">
                <span style="opacity:.6;min-width:120px">${formatCompactTime(item.createdAt)}</span>
                <span>${item.title}${item.subtitle ? `: ${item.subtitle}` : ''}</span>
              </div>`).join('');
        };

        const renderDashboard = (data, currentUser) => {
            const summary = data.summary || {};

            document.getElementById('welcome-title').textContent = `Welcome back, ${currentUser?.name || 'User'}!`;
            document.getElementById('dashboard-subtitle').textContent = `You have ${summary.upcomingAppointments ?? 0} upcoming appointment(s) and ${summary.refillsDue ?? 0} refill due.`;
            document.getElementById('stat-appointments').textContent = String(summary.upcomingAppointments ?? 0);
            document.getElementById('stat-refills').textContent = String(summary.refillsDue ?? 0);
            document.getElementById('stat-records').textContent = String(summary.recentRecords ?? 0);
            document.getElementById('stat-balance').textContent = formatCurrencyINR(summary.outstandingBalance ?? 0);

            const next = data.nextAppointment;
            if (!next) {
                document.getElementById('next-avatar').textContent = '--';
                document.getElementById('next-doctor').textContent = 'No appointment scheduled';
                document.getElementById('next-details').textContent = '';
                const status = document.getElementById('next-status');
                status.className = 'badge badge-blue';
                status.textContent = 'N/A';
            } else {
                const doctorName = next.doctor?.name || 'Assigned doctor';
                const initials = doctorName
                    .split(' ')
                    .filter(Boolean)
                    .map((part) => part[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2) || 'DR';
                document.getElementById('next-avatar').textContent = initials;
                document.getElementById('next-doctor').textContent = doctorName;
                const detailParts = [];
                if (next.doctor?.specialization) detailParts.push(next.doctor.specialization);
                detailParts.push(formatCompactTime(next.appointmentDate));
                document.getElementById('next-details').textContent = detailParts.join(' - ');
                const statusTag = toStatusBadge(next.status);
                const status = document.getElementById('next-status');
                status.className = statusTag.className;
                status.textContent = statusTag.label;
            }

            renderRecentActivity(data.recentActivity || []);
        };

        const init = async () => {
            const session = ensureSession({
                allowedRoles: ['patient'],
                onDenied: () => toast('Please login as user', 'error')
            });

            if (!session.allowed) return;

            try {
                const data = await apiRequest('/api/user/dashboard');
                renderDashboard(data, session.user);
            } catch (error) {
                toast(error.message, 'error');
            }
        };

        init();
    
