        import { toast } from '../js/utils.js';
        import { injectSidebar, renderTopbar } from '../js/sidebar.js';
        import { apiRequest, ensureSession, formatCurrencyINR } from '../js/api-client.js';
        import { setupVoiceDictation } from '../js/voice-assistant.js';

        window.toast = toast;
        injectSidebar('dashboard.html');
        document.getElementById('topbar-container').innerHTML = renderTopbar('User Dashboard');

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

        const checkProfileStatus = async () => {
            try {
                const status = await apiRequest('/api/user/profile-status');
                const banner = document.getElementById('profile-setup-banner');
                const badge = document.getElementById('banner-pct-badge');
                const subtext = document.getElementById('banner-subtext');

                if (banner && (!status.isProfileComplete || status.familyMemberCount === 0)) {
                    banner.style.display = 'block';
                    if (badge) {
                        badge.textContent = `${status.completionPercentage || 0}% Complete`;
                    }
                    if (subtext) {
                        if (status.familyMemberCount === 0) {
                            subtext.textContent = 'Add up to 5 family member profiles (parents, children, spouse) to book doctors & dispatch ambulances for them anywhere!';
                        } else {
                            subtext.textContent = `You have added ${status.familyMemberCount}/5 family members. Complete missing profile details for full remote healthcare access.`;
                        }
                    }
                }
            } catch (e) {
                // Non-critical, ignore
            }
        };

        const setupAiAssistant = () => {
            const input = document.getElementById('ai-quick-symptoms');
            const btn = document.getElementById('ai-quick-match-btn');
            const voiceBtn = document.getElementById('voice-dashboard-btn');
            const voiceStatus = document.getElementById('voice-dashboard-status');

            if (!btn || !input) return;

            const handleMatch = () => {
                const symptoms = input.value.trim();
                if (!symptoms) {
                    toast('Please enter symptoms or a condition', 'warning');
                    input.focus();
                    return;
                }
                sessionStorage.setItem('arogya_ai_query', symptoms);
                window.location.href = `appointments.html?symptoms=${encodeURIComponent(symptoms)}&ai=1`;
            };

            btn.addEventListener('click', handleMatch);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') handleMatch();
            });

            if (voiceBtn) {
                setupVoiceDictation({
                    buttonEl: voiceBtn,
                    inputEl: input,
                    statusEl: voiceStatus,
                    onResult: (text) => {
                        if (text) {
                            toast(`Voice recognized: "${text}"`, 'info');
                            setTimeout(() => {
                                handleMatch();
                            }, 500);
                        }
                    }
                });
            }
        };

        const init = async () => {
            const session = ensureSession({
                allowedRoles: ['patient'],
                onDenied: () => toast('Please login as user', 'error')
            });

            if (!session.allowed) return;

            setupAiAssistant();

            try {
                const data = await apiRequest('/api/user/dashboard');
                renderDashboard(data, session.user);
                await checkProfileStatus();
            } catch (error) {
                toast(error.message, 'error');
            }
        };

        init();
    
