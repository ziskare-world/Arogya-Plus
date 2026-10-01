import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession, formatDateTime } from "../js/api-client.js";

window.toast = toast;
injectSidebar("appointments.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("My Appointments");

const modal = document.getElementById("book-modal");
const bookForm = document.getElementById("book-form");
const submitBtn = document.getElementById("book-submit-btn");
const doctorSelect = document.getElementById("doctor-id");
const consultationTypeSelect = document.getElementById("appointment-consultation-type");
const listEl = document.getElementById("appt-list");
const ratingModalEl = document.getElementById("rating-modal");
const ratingDoctorLabelEl = document.getElementById("rating-modal-doctor");
const ratingReviewInputEl = document.getElementById("rating-review-input");
const ratingSubmitBtnEl = document.getElementById("rating-submit-btn");
const ratingStarsEl = document.getElementById("rating-stars");
const ratingValueLabelEl = document.getElementById("rating-value-label");

// Family & Location Elements
const targetSelfRadio = document.getElementById("target-self");
const targetFamilyRadio = document.getElementById("target-family");
const familySelectWrapper = document.getElementById("family-select-wrapper");
const familyMemberSelect = document.getElementById("family-member-select");
const familyMemberSummary = document.getElementById("family-member-summary");
const locCurrentRadio = document.getElementById("loc-current");
const locFamilyRadio = document.getElementById("loc-family");
const locFamilyLabel = document.getElementById("loc-family-label");
const locCustomRadio = document.getElementById("loc-custom");
const customLocationFields = document.getElementById("custom-location-fields");
const customAddressInput = document.getElementById("custom-location-address");
const customCityInput = document.getElementById("custom-location-city");
const locationActiveBadge = document.getElementById("location-active-badge");

// AI Elements
const aiSymptomInput = document.getElementById("ai-symptom-input");
const aiMatchDoctorBtn = document.getElementById("ai-match-doctor-btn");
const aiMatchResult = document.getElementById("ai-match-result");

let doctors = [];
let appointments = [];
let familyMembers = [];
let activeUser = null;
let ratingModalAppointmentId = "";
let ratingModalSelectedValue = 5;
let ratingModalSubmitting = false;
let currentPatientCoords = null;
let lastAiTriage = null;

const statusBadge = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "confirmed") return '<span class="badge badge-green">Confirmed</span>';
  if (normalized === "completed") return '<span class="badge badge-blue">Completed</span>';
  if (normalized === "cancelled") return '<span class="badge badge-red">Cancelled</span>';
  return '<span class="badge badge-yellow">Pending</span>';
};

const consultationTypeDetails = (appointment) => {
  const normalized = String(appointment?.consultationType || "").toLowerCase();
  if (normalized === "video") {
    return { value: "video", label: "Video Consultancy" };
  }
  if (normalized === "in_person") {
    return { value: "in_person", label: "In-Person" };
  }

  const text = `${appointment?.reason || ""} ${appointment?.notes || ""}`.toLowerCase();
  if (text.includes("video") || text.includes("tele")) {
    return { value: "video", label: "Video Consultancy" };
  }

  return { value: "in_person", label: "In-Person" };
};

const findAppointmentRecord = (appointmentId = "") =>
  appointments.find((item) => String(item?._id || item?.id || "") === String(appointmentId)) || null;

const normalizeId = (value = "") => String(value || "").trim();

const renderRatingStars = () => {
  if (!ratingStarsEl) return;
  const starButtons = Array.from(ratingStarsEl.querySelectorAll("button[data-value]"));
  starButtons.forEach((button) => {
    const value = Number(button.getAttribute("data-value") || 0);
    button.classList.toggle("active", value <= ratingModalSelectedValue);
    button.setAttribute("aria-checked", value === ratingModalSelectedValue ? "true" : "false");
  });
  if (ratingValueLabelEl) {
    ratingValueLabelEl.textContent = `${ratingModalSelectedValue}/5`;
  }
};

const closeRatingModal = () => {
  if (ratingModalSubmitting) return;
  ratingModalAppointmentId = "";
  ratingModalSelectedValue = 5;
  if (ratingReviewInputEl) ratingReviewInputEl.value = "";
  renderRatingStars();
  if (ratingModalEl) ratingModalEl.classList.add("hidden");
};

const openRatingModal = (appointment) => {
  const appointmentId = normalizeId(appointment?._id || appointment?.id);
  if (!appointmentId) {
    toast("Appointment ID is missing", "error");
    return;
  }

  ratingModalAppointmentId = appointmentId;
  const doctorName = String(appointment?.doctor?.name || "Doctor").trim();
  if (ratingDoctorLabelEl) {
    ratingDoctorLabelEl.textContent = `Rate your consultation with ${doctorName}`;
  }
  ratingModalSelectedValue = 5;
  if (ratingReviewInputEl) ratingReviewInputEl.value = "";
  renderRatingStars();
  if (ratingModalEl) ratingModalEl.classList.remove("hidden");
};

const submitRatingFromModal = async () => {
  const appointmentId = normalizeId(ratingModalAppointmentId);
  if (!appointmentId) return;

  ratingModalSubmitting = true;
  if (ratingSubmitBtnEl) {
    ratingSubmitBtnEl.disabled = true;
    ratingSubmitBtnEl.textContent = "Submitting...";
  }

  try {
    await apiRequest(`/api/appointments/${appointmentId}/rate`, {
      method: "PATCH",
      body: JSON.stringify({
        rating: ratingModalSelectedValue,
        review: String(ratingReviewInputEl?.value || "").trim()
      })
    });
    toast("Thank you for your rating!", "success");
    closeRatingModal();
    await loadAppointments();
  } catch (error) {
    toast(error.message, "error");
  } finally {
    ratingModalSubmitting = false;
    if (ratingSubmitBtnEl) {
      ratingSubmitBtnEl.disabled = false;
      ratingSubmitBtnEl.textContent = "Submit Rating";
    }
  }
};

const openUserVideoPanel = (appointment) => {
  const appointmentId = normalizeId(appointment?._id || appointment?.id);
  if (!appointmentId) {
    toast("Appointment details not found", "error");
    return;
  }

  const params = new URLSearchParams({
    appointmentId,
    token: appointment?.tokenNumber || ""
  });

  const doctorName = String(appointment?.doctor?.name || "").trim();
  if (doctorName) {
    params.set("doctor", doctorName);
  }

  const popup = window.open(
    `/user/video-consultation?${params.toString()}`,
    "_blank",
    "noopener,noreferrer,width=1280,height=840"
  );

  if (!popup) {
    toast("Popup blocked. Please allow popups and retry.", "error");
  }
};

const renderDoctorOptions = () => {
  if (!doctorSelect) return;

  if (!doctors.length) {
    doctorSelect.innerHTML = '<option value="">No doctors available</option>';
    return;
  }

  doctorSelect.innerHTML = doctors
    .map((doctor) => {
      const spec = doctor.specialization ? ` - ${doctor.specialization}` : "";
      const fee = doctor.consultationFee ? ` (₹${doctor.consultationFee})` : "";
      const rating = doctor.rating ? ` [★ ${doctor.rating}]` : "";
      return `<option value="${doctor._id}">${doctor.name}${spec}${fee}${rating}</option>`;
    })
    .join("");
};

const qrModalEl = document.getElementById("qr-modal");
const qrTokenLabelEl = document.getElementById("qr-token-label");
const qrDoctorLabelEl = document.getElementById("qr-doctor-label");
const qrCodeImgEl = document.getElementById("qr-code-img");

const closeQrModal = () => {
  if (qrModalEl) qrModalEl.classList.add("hidden");
};

const openQrModal = async (appointmentId) => {
  const appointment = findAppointmentRecord(appointmentId);
  if (!appointment) {
    toast("Appointment details not found", "error");
    return;
  }

  try {
    const data = await apiRequest(`/api/appointments/${appointmentId}/token-qr`);
    if (qrTokenLabelEl) qrTokenLabelEl.textContent = data.tokenNumber || appointment.tokenNumber || "APT-PASS";
    if (qrDoctorLabelEl) qrDoctorLabelEl.textContent = `Check-in Token for Dr. ${appointment.doctor?.name || "Assigned Doctor"}`;
    if (qrCodeImgEl) qrCodeImgEl.src = data.qrDataUrl || "";
    if (qrModalEl) qrModalEl.classList.remove("hidden");
  } catch (error) {
    toast(error.message || "Failed to load check-in QR pass", "error");
  }
};

window.closeQrModal = closeQrModal;

if (qrModalEl) {
  qrModalEl.addEventListener("click", (event) => {
    if (event.target === qrModalEl) closeQrModal();
  });
}

// ========================================================
// LENSKART-STYLE MULTI-PROFILE CHOOSER & REMOTE MANAGEMENT
// ========================================================
let activeProfileId = "self";

const getAvatarMeta = (member, isSelf = false) => {
  if (isSelf) return { cls: "avatar-self", icon: "👤", tag: "Self" };
  const rel = String(member?.relationship || "").toLowerCase();
  if (rel.includes("dad") || rel.includes("father")) return { cls: "avatar-dad", icon: "👨", tag: member.relationship || "Dad" };
  if (rel.includes("mom") || rel.includes("mother")) return { cls: "avatar-mom", icon: "👩", tag: member.relationship || "Mom" };
  if (rel.includes("child") || rel.includes("son") || rel.includes("daughter")) return { cls: "avatar-child", icon: "🧒", tag: member.relationship || "Child" };
  if (rel.includes("brother") || rel.includes("sister")) return { cls: "avatar-other", icon: "🧑", tag: member.relationship || "Sibling" };
  return { cls: "avatar-other", icon: "👤", tag: member.relationship || "Profile" };
};

const loadFamilyMembers = async () => {
  try {
    const data = await apiRequest("/api/user/family-members");
    familyMembers = data.familyMembers || [];
    renderProfilePills();
  } catch (e) {
    familyMembers = [];
    renderProfilePills();
  }
};

const renderProfilePills = () => {
  const pillsContainer = document.getElementById("appointment-profile-pills");
  if (!pillsContainer) return;

  const countBadge = document.getElementById("appointment-profile-count");
  if (countBadge) {
    const total = 1 + familyMembers.length;
    countBadge.textContent = `${total} Profile${total > 1 ? "s" : ""} in Account`;
  }

  let html = "";

  // 1. Myself Pill (Primary account)
  const isSelfActive = activeProfileId === "self";
  html += `
    <div class="profile-pill ${isSelfActive ? "active" : ""}" data-profile-id="self" id="pill-profile-self" role="button" tabindex="0">
      <div class="profile-pill-avatar avatar-self">👤</div>
      <div class="profile-pill-text">
        <span class="profile-pill-name">${activeUser?.name || "Myself"}</span>
        <span class="profile-pill-tag">Primary Account</span>
      </div>
      <div class="profile-pill-check">✓</div>
    </div>
  `;

  // 2. Family Members Pills (Like Lenskart multiple profiles)
  familyMembers.forEach((member) => {
    const meta = getAvatarMeta(member);
    const isActive = activeProfileId === String(member._id);
    html += `
      <div class="profile-pill ${isActive ? "active" : ""}" data-profile-id="${member._id}" id="pill-profile-${member._id}" role="button" tabindex="0">
        <div class="profile-pill-avatar ${meta.cls}">${meta.icon}</div>
        <div class="profile-pill-text">
          <span class="profile-pill-name">${member.name}</span>
          <span class="profile-pill-tag">${meta.tag}</span>
        </div>
        <div class="profile-pill-check">✓</div>
      </div>
    `;
  });

  // 3. Add Profile Pill (if under 5 limit)
  if (familyMembers.length < 5) {
    html += `
      <div class="profile-pill-add" id="pill-add-profile" role="button" tabindex="0" title="Add profile like Lenskart">
        <span style="font-size:1.1rem;line-height:1">➕</span>
        <span>Add Profile</span>
      </div>
    `;
  }

  pillsContainer.innerHTML = html;

  // Bind click on pills
  pillsContainer.querySelectorAll(".profile-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const pid = pill.getAttribute("data-profile-id");
      selectProfile(pid);
    });
  });

  const addPill = document.getElementById("pill-add-profile");
  if (addPill) {
    addPill.addEventListener("click", () => {
      const drawer = document.getElementById("quick-add-profile-drawer");
      if (drawer) {
        drawer.style.display = drawer.style.display === "none" ? "grid" : "none";
        if (drawer.style.display === "grid") {
          document.getElementById("quick-profile-name")?.focus();
        }
      }
    });
  }

  updateActiveProfileStrip();
};

const selectProfile = (profileId) => {
  activeProfileId = String(profileId || "self");

  // Update pills UI
  const pillsContainer = document.getElementById("appointment-profile-pills");
  if (pillsContainer) {
    pillsContainer.querySelectorAll(".profile-pill").forEach((pill) => {
      const pid = pill.getAttribute("data-profile-id");
      pill.classList.toggle("active", pid === activeProfileId);
    });
  }

  // Update backward compatibility inputs
  if (activeProfileId === "self") {
    if (targetSelfRadio) targetSelfRadio.checked = true;
    if (targetFamilyRadio) targetFamilyRadio.checked = false;
    if (locFamilyLabel) locFamilyLabel.style.display = "none";
    if (locCurrentRadio) locCurrentRadio.checked = true;
    if (customLocationFields) customLocationFields.style.display = "none";
  } else {
    if (targetSelfRadio) targetSelfRadio.checked = false;
    if (targetFamilyRadio) targetFamilyRadio.checked = true;
    if (locFamilyLabel) locFamilyLabel.style.display = "flex";
    if (familyMemberSelect) familyMemberSelect.value = activeProfileId;

    const member = familyMembers.find((m) => String(m._id) === activeProfileId);
    if (member && (member.address || member.city)) {
      if (locFamilyRadio) locFamilyRadio.checked = true;
      if (customLocationFields) customLocationFields.style.display = "none";
    } else {
      if (locCurrentRadio) locCurrentRadio.checked = true;
    }
  }

  updateActiveProfileStrip();
  updateLocationBadge();
};

const updateActiveProfileStrip = () => {
  const strip = document.getElementById("active-profile-strip");
  const title = document.getElementById("active-profile-title");
  const meta = document.getElementById("active-profile-meta");
  if (!strip || !title) return;

  if (activeProfileId === "self") {
    strip.style.display = "flex";
    strip.style.background = "#f0fdf4";
    strip.style.borderColor = "#bbf7d0";
    title.innerHTML = `👤 Consultation for: <strong>${activeUser?.name || "Myself"}</strong> (Primary)`;
    title.style.color = "#166534";
    if (meta) meta.textContent = "• Using your current profile";
  } else {
    const member = familyMembers.find((m) => String(m._id) === activeProfileId);
    if (member) {
      strip.style.display = "flex";
      strip.style.background = "#eff6ff";
      strip.style.borderColor = "#bfdbfe";
      title.innerHTML = `👨‍👩‍👧 Consultation for: <strong>${member.name}</strong> (${member.relationship || "Profile"})`;
      title.style.color = "#1e40af";
      const loc = member.city || member.address || "";
      if (meta) meta.textContent = loc ? `• 📍 Remote: ${loc}` : "• Family Profile";
    }
  }
};

const initQuickAddProfile = () => {
  const closeBtn = document.getElementById("close-quick-add-btn");
  const saveBtn = document.getElementById("save-quick-profile-btn");
  const drawer = document.getElementById("quick-add-profile-drawer");

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      if (drawer) drawer.style.display = "none";
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const nameInput = document.getElementById("quick-profile-name");
      const relInput = document.getElementById("quick-profile-rel");
      const cityInput = document.getElementById("quick-profile-city");

      const name = nameInput?.value.trim();
      if (!name) {
        toast("Profile Name is required", "warning");
        nameInput?.focus();
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";

      try {
        const payload = {
          name,
          relationship: relInput?.value || "Other",
          city: cityInput?.value.trim() || undefined
        };

        const res = await apiRequest("/api/user/family-members", {
          method: "POST",
          body: JSON.stringify(payload)
        });

        toast(`Profile "${name}" added successfully!`, "success");
        if (drawer) drawer.style.display = "none";
        if (nameInput) nameInput.value = "";
        if (cityInput) cityInput.value = "";

        // Reload and activate newly created profile
        await loadFamilyMembers();
        if (res.familyMember?._id) {
          selectProfile(res.familyMember._id);
        }
      } catch (err) {
        toast(err.message || "Failed to add profile", "error");
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save & Select";
      }
    });
  }
};

const updateLocationBadge = () => {
  const mode = document.querySelector('input[name="location-mode"]:checked')?.value || "current";
  if (mode === "current") {
    locationActiveBadge.innerHTML = "📍 Using <strong>current browser location</strong> for doctor distance calculation.";
  } else if (mode === "remote_saved") {
    const selectedMember = getSelectedFamilyMember();
    const loc = selectedMember?.address || selectedMember?.city || "Family member saved address";
    locationActiveBadge.innerHTML = `🏠 Using family member's remote address: <strong>${loc}</strong>`;
  } else if (mode === "custom_remote") {
    const addr = customAddressInput?.value.trim();
    const city = customCityInput?.value.trim();
    const display = [addr, city].filter(Boolean).join(", ") || "Custom remote location";
    locationActiveBadge.innerHTML = `🗺️ Using custom remote place: <strong>${display}</strong>`;
  }
};

const getSelectedFamilyMember = () => {
  if (activeProfileId === "self") return null;
  return familyMembers.find((m) => String(m._id) === activeProfileId) || null;
};

// Location mode toggle
document.querySelectorAll('input[name="location-mode"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    const mode = radio.value;
    if (customLocationFields) {
      customLocationFields.style.display = mode === "custom_remote" ? "grid" : "none";
    }
    updateLocationBadge();
  });
});

customAddressInput?.addEventListener("input", updateLocationBadge);
customCityInput?.addEventListener("input", updateLocationBadge);

// ==========================================
// AI SMART DOCTOR MATCHING
// ==========================================
const runAiDoctorMatch = async () => {
  const symptoms = aiSymptomInput?.value.trim();
  if (!symptoms) {
    toast("Please enter your symptoms or disease", "warning");
    aiSymptomInput?.focus();
    return;
  }

  aiMatchDoctorBtn.disabled = true;
  aiMatchDoctorBtn.innerHTML = "<span>🤖 Analyzing...</span>";

  // Determine patient coordinates
  let coords = null;
  const isFamily = targetFamilyRadio?.checked;
  const locMode = document.querySelector('input[name="location-mode"]:checked')?.value || "current";

  if (locMode === "remote_saved" && isFamily) {
    const member = getSelectedFamilyMember();
    if (member?.coordinates?.lat && member?.coordinates?.lng) {
      coords = member.coordinates;
    }
  } else if (locMode === "current") {
    coords = currentPatientCoords;
  }

  const selectedMember = isFamily ? getSelectedFamilyMember() : null;
  const age = selectedMember?.age || activeUser?.age || 30;

  try {
    const data = await apiRequest("/api/ai/auto-assign-doctor", {
      method: "POST",
      body: JSON.stringify({
        symptoms: symptoms.split(",").map((s) => s.trim()),
        disease: symptoms,
        coordinates: coords,
        age
      })
    });

    lastAiTriage = data.triage || null;

    if (data.success && data.matchedDoctor) {
      const doc = data.matchedDoctor;
      const score = data.matchScore || 95;
      const dist = data.distanceKm !== null ? `${data.distanceKm} km away` : "Nearby";
      const urgency = data.triage?.urgencyLevel || "medium";
      const urgencyColor = urgency === "critical" ? "#dc2626" : urgency === "high" ? "#ea580c" : "#2563eb";

      if (aiMatchResult) {
        aiMatchResult.style.display = "block";
        aiMatchResult.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
            <div>
              <div style="font-weight:800;color:var(--text-1);font-size:0.95rem">
                🎯 Best Match: Dr. ${doc.name}
              </div>
              <div style="font-size:0.83rem;color:var(--text-2)">
                ${doc.specialization || data.targetSpecialty} • ★ ${doc.rating || 4.9} • ₹${doc.consultationFee || 500}
              </div>
            </div>
            <div style="text-align:right">
              <span class="badge" style="background:#dcfce7;color:#15803d;font-weight:700">${score}% Match</span>
              <div style="font-size:0.75rem;margin-top:2px;color:${urgencyColor};font-weight:700">${urgency.toUpperCase()} PRIORITY</div>
            </div>
          </div>
          <div style="font-size:0.82rem;line-height:1.4;color:#475569;margin-bottom:8px">
            ${data.explanation || `Auto-matched based on your condition and doctor's clinic availability.`}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding-top:6px;border-top:1px dashed #cbd5e1">
            <span style="font-size:0.8rem;color:#64748b">📍 ${dist}</span>
            <span style="font-size:0.8rem;color:#16a34a;font-weight:600">✓ Auto-selected in Doctor list below</span>
          </div>
        `;
      }

      // Auto-select this doctor in dropdown
      if (doctorSelect) {
        doctorSelect.value = doc._id;
      }

      // Pre-fill reason if empty
      const reasonInput = document.getElementById("appointment-reason");
      if (reasonInput && !reasonInput.value.trim()) {
        reasonInput.value = symptoms;
      }

      toast(`Matched Dr. ${doc.name} (${score}% match)`, "success");
    }
  } catch (error) {
    toast(error.message || "Failed to analyze symptoms", "error");
  } finally {
    aiMatchDoctorBtn.disabled = false;
    aiMatchDoctorBtn.innerHTML = "<span>AI Auto-Match</span>";
  }
};

aiMatchDoctorBtn?.addEventListener("click", runAiDoctorMatch);
aiSymptomInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    runAiDoctorMatch();
  }
});

// Render Appointments List
const renderAppointments = () => {
  if (!listEl) return;

  if (!appointments.length) {
    listEl.innerHTML =
      '<div class="muted" style="padding:16px;text-align:center">No appointments found. Book your first appointment.</div>';
    return;
  }

  listEl.innerHTML = appointments
    .map((appointment) => {
      const doctorName = appointment.doctor?.name || "Doctor";
      const doctorSpec = appointment.doctor?.specialization ? ` (${appointment.doctor.specialization})` : "";
      const status = String(appointment.status || "pending").toLowerCase();
      const consultation = consultationTypeDetails(appointment);
      const subtitleParts = [formatDateTime(appointment.appointmentDate), consultation.label];
      if (appointment.tokenNumber) subtitleParts.push(`Token: ${appointment.tokenNumber}`);
      if (appointment.reason) subtitleParts.push(`Reason: ${appointment.reason}`);

      const existingRating = Number(appointment.doctorRating || 0);
      if (existingRating >= 1 && existingRating <= 5) {
        subtitleParts.push(`Your Rating: ${existingRating}/5`);
      }

      const isFamily = appointment.bookedFor === "family";
      const familyName = appointment.patientDetails?.name || "Family Member";
      const relationship = appointment.patientDetails?.relationship || "Family";
      const locText = appointment.patientLocation?.city || appointment.patientLocation?.address;
      const aiSpec = appointment.aiTriage?.predictedSpecialty;

      const canJoinVideoCall = consultation.value === "video" && status === "confirmed";
      const canModify = !["completed", "cancelled"].includes(status);
      const canRateDoctor = status === "completed" && !(existingRating >= 1 && existingRating <= 5);
      const canViewQr = status !== "cancelled";

      const actions = [];
      if (canJoinVideoCall) {
        actions.push(
          `<button class="btn btn-primary btn-sm" type="button" data-action="join-video" data-id="${appointment._id}">Join Video Call</button>`
        );
      }
      if (canViewQr) {
        actions.push(
          `<button class="btn btn-outline btn-sm" type="button" data-action="view-qr" data-id="${appointment._id}">View QR Pass</button>`
        );
      }
      if (canRateDoctor) {
        actions.push(
          `<button class="btn btn-success btn-sm" type="button" data-action="rate-doctor" data-id="${appointment._id}">Rate Doctor</button>`
        );
      }
      if (canModify) {
        actions.push(
          `<button class="btn btn-ghost btn-sm" type="button" data-action="reschedule" data-id="${appointment._id}">Reschedule</button>`
        );
        actions.push(
          `<button class="btn btn-outline btn-sm" type="button" data-action="cancel" data-id="${appointment._id}">Cancel</button>`
        );
      }

      return `
        <div style="padding:16px;border:1px solid var(--border);border-radius:12px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span style="font-weight:700;font-size:1.05rem">${doctorName}${doctorSpec}</span>
              ${
                isFamily
                  ? `<span class="badge" style="background:#fef3c7;color:#92400e;font-size:0.75rem">👨‍👩‍👧 For: ${familyName} (${relationship})</span>`
                  : `<span class="badge badge-blue" style="font-size:0.75rem">👤 For: Myself</span>`
              }
              ${
                aiSpec
                  ? `<span class="badge" style="background:#ede9fe;color:#6b21a8;font-size:0.75rem">🤖 AI: ${aiSpec}</span>`
                  : ""
              }
            </div>
            <div class="muted" style="margin-top:4px">${subtitleParts.join(" • ")}</div>
            ${locText ? `<div style="font-size:0.8rem;color:#64748b;margin-top:2px">📍 Location: ${locText}</div>` : ""}
            <div style="margin-top:8px">${statusBadge(appointment.status)}</div>
          </div>
          <div class="actions-row">
            ${actions.length ? actions.join("") : '<span class="muted">No actions</span>'}
          </div>
        </div>`;
    })
    .join("");
};

const loadDoctors = async () => {
  const data = await apiRequest("/api/auth/doctors");
  doctors = data.doctors || [];
  renderDoctorOptions();
};

const loadAppointments = async () => {
  const data = await apiRequest("/api/appointments/my");
  appointments = data.appointments || [];
  renderAppointments();
};

const openBookModal = () => {
  if (modal) modal.classList.remove("hidden");
  // Set default appointment date to tomorrow at 10:00 AM
  const dateInput = document.getElementById("appointment-date");
  if (dateInput && !dateInput.value) {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    tomorrow.setHours(10, 0, 0, 0);
    dateInput.value = tomorrow.toISOString().slice(0, 16);
  }
};

const closeBookModal = () => {
  if (modal) modal.classList.add("hidden");
  if (bookForm) bookForm.reset();
  if (familySelectWrapper) familySelectWrapper.style.display = "none";
  if (locFamilyLabel) locFamilyLabel.style.display = "none";
  if (customLocationFields) customLocationFields.style.display = "none";
  if (aiMatchResult) aiMatchResult.style.display = "none";
  lastAiTriage = null;
};

window.openBookModal = openBookModal;
window.closeBookModal = closeBookModal;
window.closeRatingModal = closeRatingModal;

if (modal) {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeBookModal();
  });
}

if (ratingModalEl) {
  ratingModalEl.addEventListener("click", (event) => {
    if (event.target === ratingModalEl) closeRatingModal();
  });
}

if (ratingStarsEl) {
  ratingStarsEl.addEventListener("click", (event) => {
    const starButton = event.target.closest("button[data-value]");
    if (!starButton) return;
    const nextValue = Number(starButton.getAttribute("data-value") || 0);
    if (!Number.isInteger(nextValue) || nextValue < 1 || nextValue > 5) return;
    ratingModalSelectedValue = nextValue;
    renderRatingStars();
  });
}

if (ratingSubmitBtnEl) {
  ratingSubmitBtnEl.addEventListener("click", () => {
    submitRatingFromModal();
  });
}

// Appointment Form Submission
if (bookForm) {
  bookForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Booking...";
    }

    const parsedDate = new Date(document.getElementById("appointment-date")?.value || "");
    if (Number.isNaN(parsedDate.getTime())) {
      toast("Please select a valid date/time", "error");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Confirm & Book Appointment";
      }
      return;
    }

    const isFamily = targetFamilyRadio?.checked;
    const selectedMember = isFamily ? getSelectedFamilyMember() : null;

    if (isFamily && !selectedMember) {
      toast("Please select a family member profile", "warning");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Confirm & Book Appointment";
      }
      return;
    }

    const locMode = document.querySelector('input[name="location-mode"]:checked')?.value || "current";

    let patientLocation = null;
    if (locMode === "remote_saved" && selectedMember) {
      patientLocation = {
        address: selectedMember.address || "",
        city: selectedMember.city || "",
        coordinates: selectedMember.coordinates || undefined
      };
    } else if (locMode === "custom_remote") {
      patientLocation = {
        address: customAddressInput?.value.trim() || "",
        city: customCityInput?.value.trim() || ""
      };
    } else {
      patientLocation = {
        address: activeUser?.address || "",
        city: activeUser?.city || "",
        coordinates: currentPatientCoords || undefined
      };
    }

    const patientDetails = isFamily && selectedMember
      ? {
          name: selectedMember.name,
          relationship: selectedMember.relationship,
          age: selectedMember.age,
          gender: selectedMember.gender,
          bloodGroup: selectedMember.bloodGroup,
          phone: selectedMember.phone
        }
      : {
          name: activeUser?.name || "Self",
          relationship: "Self",
          age: activeUser?.age,
          gender: activeUser?.gender,
          bloodGroup: activeUser?.bloodGroup,
          phone: activeUser?.phone
        };

    const payload = {
      doctorId: doctorSelect?.value || "",
      appointmentDate: parsedDate.toISOString(),
      consultationType: consultationTypeSelect?.value || "in_person",
      reason: String(document.getElementById("appointment-reason")?.value || "").trim(),
      notes: String(document.getElementById("appointment-notes")?.value || "").trim(),
      bookedFor: isFamily ? "family" : "self",
      familyMemberId: isFamily && selectedMember ? selectedMember._id : null,
      patientDetails,
      locationType: locMode,
      patientLocation,
      aiTriage: lastAiTriage
        ? {
            symptoms: aiSymptomInput?.value.split(",").map((s) => s.trim()).filter(Boolean),
            predictedSpecialty: lastAiTriage.predictedSpecialty,
            urgencyLevel: lastAiTriage.urgencyLevel,
            diagnosisHint: lastAiTriage.diagnosisHint,
            autoAssigned: true,
            confidence: lastAiTriage.confidence
          }
        : undefined
    };

    try {
      await apiRequest("/api/appointments", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      const targetName = isFamily && selectedMember ? selectedMember.name : "you";
      toast(`Appointment booked successfully for ${targetName}!`, "success");
      closeBookModal();
      await loadAppointments();
    } catch (error) {
      toast(error.message, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Confirm & Book Appointment";
      }
    }
  });
}

if (listEl) {
  listEl.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const action = button.getAttribute("data-action");
    const appointmentId = button.getAttribute("data-id");
    if (!appointmentId) return;

    try {
      if (action === "join-video") {
        const appointment = findAppointmentRecord(appointmentId);
        if (!appointment) {
          toast("Appointment details not found", "error");
          return;
        }
        openUserVideoPanel(appointment);
        return;
      }

      if (action === "view-qr") {
        await openQrModal(appointmentId);
        return;
      }

      if (action === "rate-doctor") {
        const appointment = findAppointmentRecord(appointmentId);
        if (!appointment) {
          toast("Appointment details not found", "error");
          return;
        }
        if (String(appointment.status || "").toLowerCase() !== "completed") {
          toast("You can rate only completed consultations", "info");
          return;
        }
        openRatingModal(appointment);
        return;
      }

      if (action === "cancel") {
        const confirmed = window.confirm("Cancel this appointment?");
        if (!confirmed) return;
        await apiRequest(`/api/appointments/${appointmentId}/cancel`, { method: "PATCH" });
        toast("Appointment cancelled", "success");
        await loadAppointments();
        return;
      }

      if (action === "reschedule") {
        const appointment = findAppointmentRecord(appointmentId);
        const defaultDate = appointment?.appointmentDate
          ? new Date(appointment.appointmentDate).toISOString().slice(0, 16)
          : "";
        const newDateInput = window.prompt("Enter new date/time (YYYY-MM-DDTHH:mm)", defaultDate);
        if (!newDateInput) return;

        const parsedDate = new Date(newDateInput);
        if (Number.isNaN(parsedDate.getTime())) {
          toast("Invalid date format. Use YYYY-MM-DDTHH:mm", "error");
          return;
        }

        const reasonInput =
          window.prompt("Update reason (optional)", appointment?.reason || "") || appointment?.reason;

        await apiRequest(`/api/appointments/${appointmentId}/reschedule`, {
          method: "PATCH",
          body: JSON.stringify({
            appointmentDate: parsedDate.toISOString(),
            reason: reasonInput
          })
        });
        toast("Appointment rescheduled", "success");
        await loadAppointments();
      }
    } catch (error) {
      toast(error.message, "error");
    }
  });
}

// Check Geolocation
const detectBrowserLocation = () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        currentPatientCoords = {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6))
        };
      },
      () => {},
      { timeout: 5000 }
    );
  }
};

const handleUrlParams = () => {
  const url = new URL(window.location.href);
  const familyId = url.searchParams.get("familyId");
  const symptomsParam = url.searchParams.get("symptoms") || sessionStorage.getItem("arogya_ai_query");
  const autoAi = url.searchParams.get("ai");

  if (familyId) {
    openBookModal();
    selectProfile(familyId);
  }

  if (symptomsParam) {
    openBookModal();
    if (aiSymptomInput) {
      aiSymptomInput.value = symptomsParam;
    }
    if (autoAi === "1") {
      setTimeout(() => {
        runAiDoctorMatch();
      }, 400);
    }
    sessionStorage.removeItem("arogya_ai_query");
  }
};

const init = async () => {
  const session = ensureSession({
    allowedRoles: ["patient"],
    onDenied: () => toast("Please login as user", "error")
  });
  if (!session.allowed) return;
  activeUser = session.user;

  renderRatingStars();
  detectBrowserLocation();
  initQuickAddProfile();

  try {
    await Promise.all([loadDoctors(), loadAppointments(), loadFamilyMembers()]);
    handleUrlParams();
  } catch (error) {
    toast(error.message, "error");
  }
};

init();
