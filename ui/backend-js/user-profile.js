import { toast } from '../js/utils.js';
import { injectSidebar, renderTopbar } from '../js/sidebar.js';
import { apiRequest, clearAuthState, ensureSession, getAuthState } from '../js/api-client.js';

window.toast = toast;
injectSidebar('profile.html');
document.getElementById('topbar-container').innerHTML = renderTopbar('My Profile & Family Care');

// Form inputs
const nameInput = document.getElementById('profile-name');
const emailInput = document.getElementById('profile-email');
const phoneInput = document.getElementById('profile-phone');
const ageInput = document.getElementById('profile-age');
const genderInput = document.getElementById('profile-gender');
const bloodGroupInput = document.getElementById('profile-blood-group');
const addressInput = document.getElementById('profile-address');
const cityInput = document.getElementById('profile-city');
const latInput = document.getElementById('profile-lat');
const lngInput = document.getElementById('profile-lng');
const historyInput = document.getElementById('profile-history');
const allergiesInput = document.getElementById('profile-allergies');
const saveButton = document.getElementById('save-profile-btn');

// Family modal inputs
const familyModal = document.getElementById('family-modal');
const familyForm = document.getElementById('family-form');
const familyModalTitle = document.getElementById('family-modal-title');
const familyMemberIdInput = document.getElementById('family-member-id');
const familyNameInput = document.getElementById('family-name');
const familyRelationshipInput = document.getElementById('family-relationship');
const familyAgeInput = document.getElementById('family-age');
const familyGenderInput = document.getElementById('family-gender');
const familyBloodGroupInput = document.getElementById('family-blood-group');
const familyPhoneInput = document.getElementById('family-phone');
const familyAddressInput = document.getElementById('family-address');
const familyCityInput = document.getElementById('family-city');
const familyLatInput = document.getElementById('family-lat');
const familyLngInput = document.getElementById('family-lng');
const familyHistoryInput = document.getElementById('family-history');
const familyAllergiesInput = document.getElementById('family-allergies');
const familyEmergencyInput = document.getElementById('family-emergency-contact');
const familyMembersGrid = document.getElementById('family-members-grid');
const familyCountBadge = document.getElementById('family-count-badge');
const addFamilyBtn = document.getElementById('add-family-btn');
const bannerAddFamilyBtn = document.getElementById('banner-add-family-btn');

let currentFamilyMembers = [];

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

const renderCompletionStatus = (completion = {}) => {
    const pct = completion.completionPercentage || 0;
    const isComplete = completion.isProfileComplete || pct >= 80;
    const missing = completion.missingFields || [];

    const titleEl = document.getElementById('completion-title');
    const badgeEl = document.getElementById('completion-badge');
    const barEl = document.getElementById('completion-progress-bar');
    const textEl = document.getElementById('completion-missing-text');

    if (titleEl) titleEl.textContent = `Profile Completion: ${pct}%`;
    if (barEl) barEl.style.width = `${pct}%`;

    if (badgeEl) {
        if (isComplete) {
            badgeEl.className = 'badge badge-green';
            badgeEl.textContent = 'Profile Complete & Remote Ready';
        } else {
            badgeEl.className = 'badge badge-amber';
            badgeEl.textContent = `${pct}% Incomplete`;
        }
    }

    if (textEl) {
        if (missing.length === 0) {
            textEl.textContent = 'Awesome! Your medical profile and family contacts are complete. You can seamlessly book healthcare anywhere.';
        } else {
            textEl.innerHTML = `<strong>Next steps to complete:</strong> ${missing.join(' • ')}`;
        }
    }
};

const renderFamilyMembers = (familyMembers = []) => {
    currentFamilyMembers = familyMembers;
    const count = familyMembers.length;
    familyCountBadge.textContent = `${count} of 5 Added`;

    if (count >= 5) {
        familyCountBadge.className = 'badge badge-amber';
        addFamilyBtn.disabled = true;
        addFamilyBtn.title = 'Max 5 family members allowed';
        if (bannerAddFamilyBtn) bannerAddFamilyBtn.style.display = 'none';
    } else {
        familyCountBadge.className = 'badge badge-blue';
        addFamilyBtn.disabled = false;
        addFamilyBtn.title = '';
        if (bannerAddFamilyBtn) bannerAddFamilyBtn.style.display = 'inline-block';
    }

    if (count === 0) {
        familyMembersGrid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:32px;background:#f8fafc;border-radius:12px;border:1px dashed var(--border)">
                <div style="font-size:2rem;margin-bottom:8px">👥</div>
                <div style="font-weight:700;color:var(--text-1);margin-bottom:4px">No Family Profiles Added Yet</div>
                <div class="muted" style="font-size:0.85rem;max-width:460px;margin:0 auto 16px">Add multiple profiles under your Gmail account like Lenskart. Only Name is required! You can use them to book doctors or dispatch ambulances to remote places.</div>
                <button class="btn btn-primary btn-sm" onclick="window.openFamilyModal()">➕ Add First Profile</button>
            </div>
        `;
        return;
    }

    let cardsHtml = familyMembers.map((member) => {
        const initials = (member.name || 'P').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        const address = member.address || (member.city ? member.city : 'Remote Location');
        const blood = member.bloodGroup && member.bloodGroup !== 'Unknown' ? member.bloodGroup : 'Blood: Unknown';
        const hasCoords = member.coordinates?.lat && member.coordinates?.lng;

        return `
            <div class="card" style="padding:16px;border-radius:14px;border:1px solid var(--border);position:relative;display:flex;flex-direction:column;justify-content:space-between">
                <div>
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
                        <div style="display:flex;align-items:center;gap:12px">
                            <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg, #3b82f6, #1d4ed8);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.05rem">
                                ${initials}
                            </div>
                            <div>
                                <div style="font-weight:700;color:var(--text-1);font-size:1rem">${member.name}</div>
                                <div style="display:flex;align-items:center;gap:6px;margin-top:2px">
                                    <span class="badge badge-blue" style="font-size:0.75rem">${member.relationship || 'Profile'}</span>
                                    ${member.isEmergencyContact ? '<span class="badge badge-red" style="font-size:0.75rem">Emergency SOS</span>' : ''}
                                </div>
                            </div>
                        </div>
                        <div style="display:flex;gap:4px">
                            <button class="btn btn-ghost btn-sm" style="padding:4px 8px" onclick="window.editFamilyMember('${member._id}')" title="Edit">✏️</button>
                            <button class="btn btn-ghost btn-sm" style="padding:4px 8px;color:var(--red)" onclick="window.deleteFamilyMember('${member._id}', '${member.name}')" title="Remove">🗑️</button>
                        </div>
                    </div>

                    <div style="font-size:0.83rem;display:flex;flex-direction:column;gap:6px;margin-bottom:14px;padding:10px;background:#f8fafc;border-radius:8px">
                        <div><strong>Age / Gender:</strong> ${member.age ? member.age + ' yrs' : 'N/A'} • ${member.gender || 'Other'} • <span style="color:#ef4444;font-weight:600">${blood}</span></div>
                        ${member.phone ? `<div><strong>Phone:</strong> ${member.phone}</div>` : ''}
                        <div><strong>Remote Address:</strong> 📍 ${address} ${hasCoords ? '<span title="GPS Synced" style="color:#22c55e">✓</span>' : ''}</div>
                        ${member.medicalHistory?.length ? `<div><strong>Medical History:</strong> ${member.medicalHistory.join(', ')}</div>` : ''}
                        ${member.allergies?.length ? `<div><strong>Allergies:</strong> ${member.allergies.join(', ')}</div>` : ''}
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
                    <button class="btn btn-outline btn-sm" style="justify-content:center;font-size:0.8rem;gap:4px" onclick="location.href='appointments.html?familyId=${member._id}'">
                        📅 Book Doctor
                    </button>
                    <button class="btn btn-outline btn-sm" style="justify-content:center;font-size:0.8rem;color:#dc2626;border-color:#fca5a5;gap:4px" onclick="location.href='ambulance-booking.html?familyId=${member._id}'">
                        🚑 Call Ambulance
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // If slots are available (up to 5), show interactive + Add Profile card like Lenskart
    if (familyMembers.length < 5) {
        cardsHtml += `
            <div class="card" onclick="window.openFamilyModal()" style="padding:24px 16px;border-radius:14px;border:2px dashed #94a3b8;background:#f8fafc;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;min-height:220px;text-align:center;transition:all 0.2s ease" onmouseover="this.style.borderColor='#2563eb';this.style.background='#eff6ff'" onmouseout="this.style.borderColor='#94a3b8';this.style.background='#f8fafc'">
                <div style="width:48px;height:48px;border-radius:50%;background:#e0e7ff;color:#2563eb;display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin-bottom:10px">
                    ➕
                </div>
                <div style="font-weight:700;font-size:0.95rem;color:var(--text-1)">Add Another Profile</div>
                <div class="muted" style="font-size:0.8rem;margin-top:4px">Only Name required • Multi-profile account</div>
                <span class="badge badge-blue" style="margin-top:8px">${5 - familyMembers.length} slot(s) remaining</span>
            </div>
        `;
    }

    familyMembersGrid.innerHTML = cardsHtml;
};

const loadProfile = async () => {
    const data = await apiRequest('/api/user/profile');
    const profile = data.profile || {};
    const completion = data.completion || {};

    nameInput.value = profile.name || '';
    emailInput.value = profile.email || '';
    phoneInput.value = profile.phone || '';
    ageInput.value = profile.age || '';
    genderInput.value = profile.gender || 'other';
    bloodGroupInput.value = profile.bloodGroup || 'Unknown';
    addressInput.value = profile.address || '';
    cityInput.value = profile.city || '';
    latInput.value = profile.coordinates?.lat || '';
    lngInput.value = profile.coordinates?.lng || '';
    historyInput.value = (profile.medicalHistory || []).join(', ');
    allergiesInput.value = (profile.allergies || []).join(', ');

    renderCompletionStatus(completion);
    renderFamilyMembers(profile.familyMembers || []);
};

const saveProfile = async () => {
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    const coords = (latInput.value && lngInput.value)
        ? { lat: parseFloat(latInput.value), lng: parseFloat(lngInput.value) }
        : undefined;

    const payload = {
        name: nameInput.value.trim(),
        phone: phoneInput.value.trim(),
        age: ageInput.value ? parseInt(ageInput.value, 10) : undefined,
        gender: genderInput.value,
        bloodGroup: bloodGroupInput.value,
        address: addressInput.value.trim(),
        city: cityInput.value.trim(),
        coordinates: coords,
        medicalHistory: historyInput.value.split(',').map(s => s.trim()).filter(Boolean),
        allergies: allergiesInput.value.split(',').map(s => s.trim()).filter(Boolean)
    };

    try {
        const data = await apiRequest('/api/user/profile', {
            method: 'PATCH',
            body: JSON.stringify(payload)
        });
        syncStoredUser(data.profile);
        renderCompletionStatus(data.completion);
        document.getElementById('topbar-container').innerHTML = renderTopbar('My Profile & Family Care');
        toast('Profile updated successfully', 'success');
    } catch (error) {
        toast(error.message, 'error');
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Save Profile Changes';
    }
};

// Family Member Modal Functions (Lenskart Style)
window.openFamilyModal = () => {
    if (currentFamilyMembers.length >= 5) {
        toast('You have reached the maximum limit of 5 profiles in your account.', 'warning');
        return;
    }
    familyModalTitle.textContent = 'Add Profile to Account';
    familyMemberIdInput.value = '';
    familyForm.reset();
    if (familyRelationshipInput) familyRelationshipInput.value = 'Other';
    familyModal.classList.remove('hidden');
};

window.closeFamilyModal = () => {
    familyModal.classList.add('hidden');
    familyForm.reset();
    familyMemberIdInput.value = '';
};

window.editFamilyMember = (memberId) => {
    const member = currentFamilyMembers.find(m => m._id === memberId);
    if (!member) return;

    familyModalTitle.textContent = 'Edit Profile';
    familyMemberIdInput.value = member._id;
    familyNameInput.value = member.name || '';
    familyRelationshipInput.value = member.relationship || 'Other';
    familyAgeInput.value = member.age || '';
    familyGenderInput.value = member.gender || 'other';
    familyBloodGroupInput.value = member.bloodGroup || 'Unknown';
    familyPhoneInput.value = member.phone || '';
    familyAddressInput.value = member.address || '';
    familyCityInput.value = member.city || '';
    familyLatInput.value = member.coordinates?.lat || '';
    familyLngInput.value = member.coordinates?.lng || '';
    familyHistoryInput.value = (member.medicalHistory || []).join(', ');
    familyAllergiesInput.value = (member.allergies || []).join(', ');
    familyEmergencyInput.checked = Boolean(member.isEmergencyContact);

    familyModal.classList.remove('hidden');
};

window.deleteFamilyMember = async (memberId, memberName) => {
    if (!window.confirm(`Are you sure you want to remove ${memberName} from your profiles?`)) {
        return;
    }

    try {
        const data = await apiRequest(`/api/user/family-members/${memberId}`, {
            method: 'DELETE'
        });
        toast(data.message || 'Profile removed', 'success');
        await loadProfile();
    } catch (error) {
        toast(error.message, 'error');
    }
};

familyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const memberId = familyMemberIdInput.value;
    const submitBtn = document.getElementById('family-submit-btn');

    const name = familyNameInput.value.trim();
    if (!name) {
        toast('Profile Name is required', 'warning');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    const coords = (familyLatInput.value && familyLngInput.value)
        ? { lat: parseFloat(familyLatInput.value), lng: parseFloat(familyLngInput.value) }
        : undefined;

    const payload = {
        name,
        relationship: familyRelationshipInput?.value || 'Other',
        age: familyAgeInput.value ? parseInt(familyAgeInput.value, 10) : undefined,
        gender: familyGenderInput.value || 'other',
        bloodGroup: familyBloodGroupInput.value || 'Unknown',
        phone: familyPhoneInput.value.trim() || undefined,
        address: familyAddressInput.value.trim() || undefined,
        city: familyCityInput.value.trim() || undefined,
        coordinates: coords,
        medicalHistory: familyHistoryInput.value ? familyHistoryInput.value.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        allergies: familyAllergiesInput.value ? familyAllergiesInput.value.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        isEmergencyContact: familyEmergencyInput.checked
    };

    try {
        if (memberId) {
            await apiRequest(`/api/user/family-members/${memberId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            toast(`Profile "${name}" updated successfully`, 'success');
        } else {
            await apiRequest('/api/user/family-members', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            toast(`Profile "${name}" added to account!`, 'success');
        }
        window.closeFamilyModal();
        await loadProfile();
    } catch (error) {
        toast(error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Profile';
    }
});

// Geolocation Helpers
const detectCoordinates = (onSuccess) => {
    if (!navigator.geolocation) {
        toast('Geolocation is not supported by your browser', 'warning');
        return;
    }
    toast('Detecting GPS coordinates...', 'info');
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = Number(position.coords.latitude.toFixed(6));
            const lng = Number(position.coords.longitude.toFixed(6));
            onSuccess(lat, lng);
            toast(`GPS detected: ${lat}, ${lng}`, 'success');
        },
        (error) => {
            toast(`GPS detection failed: ${error.message}`, 'warning');
        },
        { enableHighAccuracy: true, timeout: 8000 }
    );
};

document.getElementById('detect-user-coords-btn')?.addEventListener('click', () => {
    detectCoordinates((lat, lng) => {
        latInput.value = lat;
        lngInput.value = lng;
    });
});

document.getElementById('detect-family-coords-btn')?.addEventListener('click', () => {
    detectCoordinates((lat, lng) => {
        familyLatInput.value = lat;
        familyLngInput.value = lng;
    });
});

addFamilyBtn?.addEventListener('click', window.openFamilyModal);
bannerAddFamilyBtn?.addEventListener('click', window.openFamilyModal);

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

document.getElementById('change-password-btn')?.addEventListener('click', changePassword);
document.getElementById('delete-account-btn')?.addEventListener('click', deleteAccount);
saveButton?.addEventListener('click', saveProfile);

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
