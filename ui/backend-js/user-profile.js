        import { toast } from '../js/utils.js';
        import { injectSidebar, renderTopbar } from '../js/sidebar.js';
        import { apiRequest, clearAuthState, ensureSession, getAuthState } from '../js/api-client.js';

        window.toast = toast;
        injectSidebar('profile.html');
        document.getElementById('topbar-container').innerHTML = renderTopbar('My Profile');

        const nameInput = document.getElementById('profile-name');
        const emailInput = document.getElementById('profile-email');
        const phoneInput = document.getElementById('profile-phone');
        const saveButton = document.getElementById('save-profile-btn');

        const syncStoredUser = (profile) => {
            const { user } = getAuthState();
            const nextUser = {
                ...(user || {}),
                ...(profile || {})
            };

            localStorage.setItem('smart_hospital_user', JSON.stringify(nextUser));
            sessionStorage.setItem('arogya_user', JSON.stringify({
                name: nextUser.name,
                email: nextUser.email,
                role: nextUser.role
            }));
        };

        const loadProfile = async () => {
            const data = await apiRequest('/api/user/profile');
            const profile = data.profile || {};
            nameInput.value = profile.name || '';
            emailInput.value = profile.email || '';
            phoneInput.value = profile.phone || '';
        };

        const saveProfile = async () => {
            saveButton.disabled = true;
            saveButton.textContent = 'Saving...';

            const payload = {
                name: nameInput.value.trim(),
                email: emailInput.value.trim(),
                phone: phoneInput.value.trim()
            };

            try {
                const data = await apiRequest('/api/user/profile', {
                    method: 'PATCH',
                    body: JSON.stringify(payload)
                });
                syncStoredUser(data.profile);
                document.getElementById('topbar-container').innerHTML = renderTopbar('My Profile');
                toast('Profile updated successfully', 'success');
            } catch (error) {
                toast(error.message, 'error');
            } finally {
                saveButton.disabled = false;
                saveButton.textContent = 'Save Profile';
            }
        };

        const changePassword = async () => {
            const currentPassword = window.prompt('Enter current password');
            if (!currentPassword) return;

            const newPassword = window.prompt('Enter new password (minimum 6 characters)');
            if (!newPassword) return;

            try {
                await apiRequest('/api/user/change-password', {
                    method: 'PATCH',
                    body: JSON.stringify({ currentPassword, newPassword })
                });
                toast('Password changed successfully', 'success');
            } catch (error) {
                toast(error.message, 'error');
            }
        };

        const deleteAccount = async () => {
            const confirmed = window.confirm('This will deactivate your account. Continue?');
            if (!confirmed) return;

            try {
                await apiRequest('/api/user/account', { method: 'DELETE' });
                clearAuthState();
                toast('Account deactivated', 'success');
                setTimeout(() => {
                    window.location.href = '/login';
                }, 700);
            } catch (error) {
                toast(error.message, 'error');
            }
        };

        document.getElementById('change-password-btn').addEventListener('click', changePassword);
        document.getElementById('delete-account-btn').addEventListener('click', deleteAccount);
        saveButton.addEventListener('click', saveProfile);

        const init = async () => {
            const session = ensureSession({
                allowedRoles: ['patient'],
                onDenied: () => toast('Please login as user', 'error')
            });
            if (!session.allowed) return;

            try {
                await loadProfile();
            } catch (error) {
                toast(error.message, 'error');
            }
        };

        init();
    
