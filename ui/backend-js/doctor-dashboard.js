import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession, formatCurrencyINR } from "../js/api-client.js";

window.toast = toast;
injectSidebar("dashboard.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Doctor Dashboard");

// DOM Elements
const doctorGreetingEl = document.getElementById("doctor-greeting");
const doctorSubtitleEl = document.getElementById("doctor-subtitle");
const doctorSpecialtyLabel = document.getElementById("doctor-specialty-label");
const doctorStatusDot = document.getElementById("doctor-status-dot");
const doctorStatusText = document.getElementById("doctor-status-text");
const toggleAvailabilityBtn = document.getElementById("toggle-availability-btn");

const statTodayVisits = document.getElementById("stat-today-visits");
const statCompletedConsults = document.getElementById("stat-completed-consults");
const statUrgentReviews = document.getElementById("stat-urgent-reviews");
const statRating = document.getElementById("stat-rating");

const earningTotal = document.getElementById("earning-total");
const earningTotalSub = document.getElementById("earning-total-sub");
const earningPending = document.getElementById("earning-pending");
const earningToday = document.getElementById("earning-today");
const earningFee = document.getElementById("earning-fee");

const openFeeModalBtn = document.getElementById("open-fee-modal-btn");
const closeFeeModalBtn = document.getElementById("close-fee-modal-btn");
const cancelFeeModalBtn = document.getElementById("cancel-fee-modal-btn");
const feeModal = document.getElementById("fee-modal");
const feeForm = document.getElementById("fee-form");
const consultationFeeInput = document.getElementById("consultation-fee-input");
const saveFeeSubmitBtn = document.getElementById("save-fee-submit-btn");

const scheduleTbody = document.getElementById("schedule-tbody");
const scheduleCountBadge = document.getElementById("schedule-count-badge");
const scheduleSearchInput = document.getElementById("schedule-search");
const filterBtns = document.querySelectorAll(".schedule-filter-btn");

const consultModal = document.getElementById("consultation-modal");
const closeConsultModalBtn = document.getElementById("close-consult-modal-btn");
const consultModalContent = document.getElementById("consultation-modal-content");
const modalPatientTitle = document.getElementById("modal-patient-title");

let currentSchedule = [];
let activeFilter = "all";
let searchTerm = "";
let currentDoctorData = null;

const getTimeGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  if (hour < 21) return "Good Evening";
  return "Good Night";
};

const formatDoctorName = (name = "Doctor") => {
  const trimmed = String(name || "Doctor").trim();
  if (/^dr\.?/i.test(trimmed)) return trimmed.replace(/^dr\s*/i, "Dr. ");
  return `Dr. ${trimmed}`;
};

const formatSlotTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatSlotDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};

const badgeClassByStatus = (status = "") => {
  const normalized = String(status).toLowerCase();
  if (normalized === "confirmed") return "badge badge-green";
  if (normalized === "completed") return "badge badge-blue";
  if (normalized === "cancelled") return "badge badge-red";
  return "badge badge-yellow";
};

const consultationTypeDetails = (appointment) => {
  const normalized = String(appointment?.consultationType || "").toLowerCase();
  if (normalized === "video") {
    return { value: "video", label: "📹 Telehealth Video", badgeClass: "badge badge-purple" };
  }
  if (normalized === "in_person") {
    return { value: "in_person", label: "🏥 In-Person Clinic", badgeClass: "badge badge-cyan" };
  }

  const text = `${appointment?.reason || ""} ${appointment?.notes || ""}`.toLowerCase();
  if (text.includes("video") || text.includes("tele")) {
    return { value: "video", label: "📹 Telehealth Video", badgeClass: "badge badge-purple" };
  }

  return { value: "in_person", label: "🏥 In-Person Clinic", badgeClass: "badge badge-cyan" };
};

const findAppointmentRecord = (appointmentId = "") =>
  currentSchedule.find(
    (item) => String(item?._id || item?.id || "").trim() === String(appointmentId || "").trim()
  ) || null;

const openDoctorVideoPanel = (appointment) => {
  const appointmentId = String(appointment?._id || appointment?.id || "").trim();
  if (!appointmentId) {
    toast("Appointment ID is missing", "error");
    return;
  }

  const params = new URLSearchParams({ role: "doctor", appointmentId });
  const patientName = String(appointment?.patient?.name || "").trim();
  if (patientName) {
    params.set("patient", patientName);
  }

  const popup = window.open(
    `/doctor/video-consultation?${params.toString()}`,
    "_blank",
    "noopener,noreferrer,width=1280,height=840"
  );

  if (!popup) {
    toast("Popup blocked. Please allow popups and retry.", "error");
  }
};

const updateAvailabilityUI = (isAvailable) => {
  if (!doctorStatusDot || !doctorStatusText) return;
  if (isAvailable) {
    doctorStatusDot.className = "status-dot-pulse";
    doctorStatusText.textContent = "Online & Available";
    doctorStatusText.style.color = "#ffffff";
  } else {
    doctorStatusDot.className = "status-dot-pulse busy";
    doctorStatusText.textContent = "Away / In Session";
    doctorStatusText.style.color = "#fef08a";
  }
};

const appointmentActionMarkup = (appointment) => {
  const normalized = String(appointment?.status || "").toLowerCase();
  const consultation = consultationTypeDetails(appointment);
  const isVideoConsult = consultation.value === "video";
  const appointmentId = String(appointment?._id || appointment?.id || "");

  const viewDetailsBtn = `
    <button class="btn btn-outline btn-sm" data-action="view-details" data-id="${appointmentId}" title="View Patient Details">
      👁️ Details
    </button>`;

  if (normalized === "pending") {
    return `
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" data-action-status="confirmed" data-id="${appointmentId}">
          ${isVideoConsult ? "Confirm Video" : "Confirm"}
        </button>
        ${viewDetailsBtn}
      </div>`;
  }

  if (normalized === "confirmed" && isVideoConsult) {
    return `
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" data-action="start-video-call" data-id="${appointmentId}">
          📞 Call
        </button>
        <button class="btn btn-success btn-sm" data-action-status="completed" data-id="${appointmentId}">
          Complete
        </button>
        ${viewDetailsBtn}
      </div>`;
  }

  if (normalized === "confirmed") {
    return `
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <button class="btn btn-success btn-sm" data-action-status="completed" data-id="${appointmentId}">
          Complete
        </button>
        ${viewDetailsBtn}
      </div>`;
  }

  if (normalized === "completed") {
    return `
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <span class="badge badge-green">✓ Finished</span>
        ${viewDetailsBtn}
      </div>`;
  }

  return `
    <div style="display:flex;gap:6px;align-items:center">
      <span class="badge badge-yellow">${appointment.status || "N/A"}</span>
      ${viewDetailsBtn}
    </div>`;
};

const openConsultationDetailsModal = (appointment) => {
  if (!consultModal || !consultModalContent) return;
  const consultation = consultationTypeDetails(appointment);
  const patientName = appointment.patient?.name || "Patient";
  const patientEmail = appointment.patient?.email || "No email on record";
  const patientPhone = appointment.patient?.phone || "Not provided";
  const token = appointment.tokenNumber || "N/A";
  const appointmentId = String(appointment?._id || appointment?.id || "");

  modalPatientTitle.textContent = `${patientName} — Consultation Record`;
  consultModalContent.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:#f8fafc;padding:14px;border-radius:8px;border:1px solid var(--border)">
      <div>
        <div style="font-size:0.75rem;color:var(--text-400);text-transform:uppercase;font-weight:700">Token ID</div>
        <div style="font-weight:700;font-family:monospace;color:var(--blue)">${token}</div>
      </div>
      <div>
        <div style="font-size:0.75rem;color:var(--text-400);text-transform:uppercase;font-weight:700">Scheduled Time</div>
        <div style="font-weight:600">${formatSlotTime(appointment.appointmentDate)} (${formatSlotDate(appointment.appointmentDate)})</div>
      </div>
      <div>
        <div style="font-size:0.75rem;color:var(--text-400);text-transform:uppercase;font-weight:700">Patient Contact</div>
        <div style="font-size:0.88rem;color:var(--text-200)">📞 ${patientPhone}</div>
        <div style="font-size:0.8rem;color:var(--text-400)">✉️ ${patientEmail}</div>
      </div>
      <div>
        <div style="font-size:0.75rem;color:var(--text-400);text-transform:uppercase;font-weight:700">Consultation Channel</div>
        <span class="${consultation.badgeClass}">${consultation.label}</span>
      </div>
    </div>

    <div>
      <div style="font-size:0.82rem;font-weight:700;color:var(--text-200);margin-bottom:4px">Chief Clinical Complaint / Reason</div>
      <div style="padding:10px 14px;background:#ffffff;border:1px solid var(--border);border-radius:6px;font-size:0.9rem;color:var(--text-300)">
        ${appointment.reason || "General healthcare follow-up"}
      </div>
    </div>

    ${appointment.notes ? `
    <div>
      <div style="font-size:0.82rem;font-weight:700;color:var(--text-200);margin-bottom:4px">Doctor Clinical Notes</div>
      <div style="padding:10px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;font-size:0.88rem;color:#166534">
        ${appointment.notes}
      </div>
    </div>` : ""}

    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:8px;padding-top:14px;border-top:1px solid var(--border);flex-wrap:wrap">
      <a href="../doctor/prescriptions.html?patient=${encodeURIComponent(patientName)}" class="btn btn-outline btn-sm">
        📝 Prescribe Rx
      </a>
      <div style="display:flex;gap:8px">
        ${consultation.value === "video" ? `
          <button class="btn btn-primary btn-sm" onclick="window.doctorStartVideo('${appointmentId}')">
            📹 Start Telehealth Call
          </button>
        ` : ""}
        <button class="btn btn-ghost btn-sm" onclick="window.closeConsultModal()">Close</button>
      </div>
    </div>
  `;

  consultModal.classList.remove("hidden");
};

window.closeConsultModal = () => {
  if (consultModal) consultModal.classList.add("hidden");
};

window.doctorStartVideo = (appointmentId) => {
  const appointment = findAppointmentRecord(appointmentId);
  if (appointment) {
    openDoctorVideoPanel(appointment);
  }
};

const renderScheduleRows = () => {
  if (!scheduleTbody) return;

  let filtered = [...currentSchedule];

  // Filter by pill tab
  if (activeFilter === "video") {
    filtered = filtered.filter((a) => consultationTypeDetails(a).value === "video");
  } else if (activeFilter === "in_person") {
    filtered = filtered.filter((a) => consultationTypeDetails(a).value === "in_person");
  } else if (activeFilter === "confirmed") {
    filtered = filtered.filter((a) => String(a.status).toLowerCase() === "confirmed");
  }

  // Filter by search term
  if (searchTerm.trim()) {
    const q = searchTerm.toLowerCase();
    filtered = filtered.filter((a) => {
      const pName = String(a.patient?.name || "").toLowerCase();
      const token = String(a.tokenNumber || "").toLowerCase();
      const reason = String(a.reason || "").toLowerCase();
      return pName.includes(q) || token.includes(q) || reason.includes(q);
    });
  }

  if (scheduleCountBadge) {
    scheduleCountBadge.textContent = `${filtered.length} Scheduled`;
  }

  if (!filtered.length) {
    scheduleTbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:var(--text-400);padding:24px">
          No appointments found matching your filter criteria.
        </td>
      </tr>`;
    return;
  }

  scheduleTbody.innerHTML = filtered
    .map((appointment) => {
      const statusClass = badgeClassByStatus(appointment.status);
      const consultation = consultationTypeDetails(appointment);
      const patientName = appointment.patient?.name || "Patient";
      const token = appointment.tokenNumber || `AP-${appointment._id.slice(-4).toUpperCase()}`;

      return `
        <tr>
          <td><span class="token-tag">${token}</span></td>
          <td>
            <div style="font-weight:700;color:var(--text-100)">${formatSlotTime(appointment.appointmentDate)}</div>
            <div style="font-size:0.75rem;color:var(--text-400)">${formatSlotDate(appointment.appointmentDate)}</div>
          </td>
          <td>
            <div style="font-weight:600;color:var(--text-100)">${patientName}</div>
            <div style="font-size:0.78rem;color:var(--text-400)">${appointment.reason || "Consultation"}</div>
          </td>
          <td><span class="${consultation.badgeClass}">${consultation.label}</span></td>
          <td><span class="${statusClass}">${appointment.status || "pending"}</span></td>
          <td>
            ${appointmentActionMarkup(appointment)}
          </td>
        </tr>`;
    })
    .join("");
};

const updateFilterTabCounters = () => {
  const allCount = currentSchedule.length;
  const videoCount = currentSchedule.filter((a) => consultationTypeDetails(a).value === "video").length;
  const inPersonCount = currentSchedule.filter((a) => consultationTypeDetails(a).value === "in_person").length;
  const confirmedCount = currentSchedule.filter((a) => String(a.status).toLowerCase() === "confirmed").length;

  filterBtns.forEach((btn) => {
    const f = btn.getAttribute("data-filter");
    if (f === "all") btn.textContent = `All (${allCount})`;
    if (f === "video") btn.textContent = `📹 Video (${videoCount})`;
    if (f === "in_person") btn.textContent = `🏥 In-Person (${inPersonCount})`;
    if (f === "confirmed") btn.textContent = `✅ Confirmed (${confirmedCount})`;
  });
};

const updateGreeting = (sessionUser) => {
  if (!doctorGreetingEl) return;
  const greeting = getTimeGreeting();
  const doctorName = formatDoctorName(currentDoctorData?.doctorName || sessionUser?.name || "Doctor");
  doctorGreetingEl.textContent = `${greeting}, ${doctorName}`;
};

const loadDashboard = async () => {
  if (scheduleTbody) {
    scheduleTbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:var(--text-500);padding:24px">Loading consultation schedule & financial metrics...</td>
      </tr>`;
  }

  const data = await apiRequest("/api/doctors/dashboard");
  const summary = data.summary || {};
  currentDoctorData = summary;

  if (doctorSubtitleEl) {
    doctorSubtitleEl.textContent = `You have ${summary.todaysVisits || 0} consultations scheduled today. OPD: ${summary.clinicAddress || "General OPD"}`;
  }

  if (doctorSpecialtyLabel) {
    doctorSpecialtyLabel.textContent = summary.specialization || "Clinical Specialist";
  }

  // Update Availability indicator
  updateAvailabilityUI(summary.isAvailable !== false);

  // Update primary stats
  if (statTodayVisits) statTodayVisits.textContent = String(summary.todaysVisits || 0);
  if (statCompletedConsults) statCompletedConsults.textContent = String(summary.completedConsults || 0);
  if (statUrgentReviews) statUrgentReviews.textContent = String(summary.urgentReviews || 0);
  if (statRating) statRating.textContent = `${summary.rating || 4.9} ★ (${summary.reviewCount || 18})`;

  // Update Earnings Overview
  if (earningTotal) earningTotal.textContent = formatCurrencyINR(summary.totalEarned || 0);
  if (earningTotalSub) earningTotalSub.textContent = `Across ${summary.completedConsults || 0} completed consultations`;
  if (earningPending) earningPending.textContent = formatCurrencyINR(summary.pendingPayout || 0);
  if (earningToday) earningToday.textContent = formatCurrencyINR(summary.todaysEarnings || 0);
  if (earningFee) earningFee.textContent = formatCurrencyINR(summary.consultationFee || 500);

  if (consultationFeeInput) {
    consultationFeeInput.value = String(summary.consultationFee || 500);
  }

  currentSchedule = Array.isArray(data.upcomingSchedule) ? data.upcomingSchedule : [];
  updateFilterTabCounters();
  renderScheduleRows();
};

const onScheduleActionClick = async (event) => {
  const button = event.target.closest("button[data-id]");
  if (!button) return;

  const appointmentId = button.getAttribute("data-id");
  const action = button.getAttribute("data-action");
  const nextStatus = button.getAttribute("data-action-status");
  if (!appointmentId) return;

  const appointment = findAppointmentRecord(appointmentId);

  if (action === "start-video-call") {
    if (!appointment) {
      toast("Appointment details not found", "error");
      return;
    }
    openDoctorVideoPanel(appointment);
    return;
  }

  if (action === "view-details") {
    if (!appointment) {
      toast("Appointment details not found", "error");
      return;
    }
    openConsultationDetailsModal(appointment);
    return;
  }

  if (!nextStatus) return;

  try {
    button.disabled = true;
    await apiRequest(`/api/appointments/${appointmentId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus })
    });
    toast(`Appointment marked as ${nextStatus}`, "success");
    await loadDashboard();
  } catch (error) {
    toast(error.message, "error");
    button.disabled = false;
  }
};

// Availability toggle handler
if (toggleAvailabilityBtn) {
  toggleAvailabilityBtn.addEventListener("click", async () => {
    try {
      toggleAvailabilityBtn.disabled = true;
      const res = await apiRequest("/api/doctors/availability", { method: "PATCH" });
      updateAvailabilityUI(res.isAvailable);
      toast(res.message || "Status updated", "success");
    } catch (err) {
      toast(err.message || "Failed to update status", "error");
    } finally {
      toggleAvailabilityBtn.disabled = false;
    }
  });
}

// Fee Modal handlers
if (openFeeModalBtn) {
  openFeeModalBtn.addEventListener("click", () => {
    if (feeModal) feeModal.classList.remove("hidden");
  });
}

const closeFeeModal = () => {
  if (feeModal) feeModal.classList.add("hidden");
};

if (closeFeeModalBtn) closeFeeModalBtn.addEventListener("click", closeFeeModal);
if (cancelFeeModalBtn) cancelFeeModalBtn.addEventListener("click", closeFeeModal);

if (feeModal) {
  feeModal.addEventListener("click", (e) => {
    if (e.target === feeModal) closeFeeModal();
  });
}

if (closeConsultModalBtn) closeConsultModalBtn.addEventListener("click", window.closeConsultModal);
if (consultModal) {
  consultModal.addEventListener("click", (e) => {
    if (e.target === consultModal) window.closeConsultModal();
  });
}

if (feeForm) {
  feeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fee = Number(consultationFeeInput?.value || 500);
    if (fee < 50 || fee > 20000) {
      toast("Fee must be between ₹50 and ₹20,000", "error");
      return;
    }

    try {
      if (saveFeeSubmitBtn) {
        saveFeeSubmitBtn.disabled = true;
        saveFeeSubmitBtn.textContent = "Saving...";
      }

      await apiRequest("/api/doctors/fee", {
        method: "PATCH",
        body: JSON.stringify({ consultationFee: fee })
      });

      toast("Consultation fee updated successfully", "success");
      closeFeeModal();
      await loadDashboard();
    } catch (err) {
      toast(err.message || "Failed to update fee", "error");
    } finally {
      if (saveFeeSubmitBtn) {
        saveFeeSubmitBtn.disabled = false;
        saveFeeSubmitBtn.textContent = "Save Fee";
      }
    }
  });
}

// Filter button handlers
filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = btn.getAttribute("data-filter") || "all";
    renderScheduleRows();
  });
});

// Search input handler
if (scheduleSearchInput) {
  scheduleSearchInput.addEventListener("input", (e) => {
    searchTerm = e.target.value || "";
    renderScheduleRows();
  });
}

const init = async () => {
  const session = ensureSession({
    allowedRoles: ["doctor"],
    onDenied: () => toast("Please login as doctor", "error")
  });
  if (!session.allowed) return;

  updateGreeting(session.user);
  setInterval(() => updateGreeting(session.user), 60 * 1000);

  if (scheduleTbody) {
    scheduleTbody.addEventListener("click", onScheduleActionClick);
  }

  try {
    await loadDashboard();
  } catch (error) {
    toast(error.message, "error");
    renderScheduleRows();
  }
};

init();
