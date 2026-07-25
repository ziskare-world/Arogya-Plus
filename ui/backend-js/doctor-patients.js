import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession, formatDateTime } from "../js/api-client.js";

window.toast = toast;
injectSidebar("patients.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Patient Roster");

const searchInput = document.querySelector(".page-header .form-input");
const patientGrid = document.querySelector(".grid-auto");

let allPatients = [];
let historyModalEl = null;
let historyModalBodyEl = null;
let historyModalTitleEl = null;
let historyModalCloseEl = null;

const initials = (name = "Patient") =>
  String(name)
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "PT";

const statusBadge = (status = "") => {
  const normalized = String(status).toLowerCase();
  if (normalized === "confirmed") return "badge badge-green";
  if (normalized === "completed") return "badge badge-blue";
  if (normalized === "cancelled") return "badge badge-red";
  return "badge badge-yellow";
};

const formatPatientId = (id = "") => `PAT-${String(id).replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase()}`;

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const normalizeStatusLabel = (status = "") => {
  const normalized = String(status || "pending").toLowerCase();
  if (normalized === "in_progress") return "In Progress";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const ensureHistoryModal = () => {
  if (historyModalEl) return;

  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(2,6,23,.56);z-index:1200;display:none;align-items:center;justify-content:center;padding:24px;";

  overlay.innerHTML = `
    <div style="background:#fff;border:1px solid var(--border);border-radius:14px;width:min(900px,96vw);max-height:86vh;overflow:auto;box-shadow:0 24px 48px rgba(2,6,23,.32);">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--border);position:sticky;top:0;background:#fff;z-index:1;">
        <div style="font-size:1rem;font-weight:700;color:var(--text-100);" id="patient-history-title">Visit History</div>
        <button type="button" id="patient-history-close" class="btn btn-ghost btn-sm" style="font-size:1.1rem;line-height:1;padding:6px 10px;">x</button>
      </div>
      <div id="patient-history-body" style="padding:16px 18px;"></div>
    </div>`;

  document.body.appendChild(overlay);
  historyModalEl = overlay;
  historyModalBodyEl = overlay.querySelector("#patient-history-body");
  historyModalTitleEl = overlay.querySelector("#patient-history-title");
  historyModalCloseEl = overlay.querySelector("#patient-history-close");

  const closeModal = () => {
    if (historyModalEl) historyModalEl.style.display = "none";
  };

  historyModalCloseEl?.addEventListener("click", closeModal);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && historyModalEl?.style.display === "flex") {
      closeModal();
    }
  });
};

const openHistoryModal = (patientName, appointments = []) => {
  ensureHistoryModal();
  if (!historyModalEl || !historyModalBodyEl || !historyModalTitleEl) return;

  historyModalTitleEl.textContent = `Visit History - ${patientName || "Patient"}`;

  if (!appointments.length) {
    historyModalBodyEl.innerHTML = `<div class="muted">No visit history found for this patient.</div>`;
    historyModalEl.style.display = "flex";
    return;
  }

  historyModalBodyEl.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Date & Time</th>
            <th>Reason</th>
            <th>Notes</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${appointments
            .map((appointment, index) => {
              const statusRaw = String(appointment.status || "pending").toLowerCase();
              return `
                <tr>
                  <td>${index + 1}</td>
                  <td>${escapeHtml(formatDateTime(appointment.appointmentDate))}</td>
                  <td>${escapeHtml(appointment.reason || "-")}</td>
                  <td>${escapeHtml(appointment.notes || "-")}</td>
                  <td><span class="${statusBadge(statusRaw)}">${escapeHtml(normalizeStatusLabel(statusRaw))}</span></td>
                </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>`;

  historyModalEl.style.display = "flex";
};

const renderPatients = (patients = []) => {
  if (!patientGrid) return;

  if (!patients.length) {
    patientGrid.innerHTML = `
      <div class="card">
        <div class="muted">No patients found for your roster.</div>
      </div>`;
    return;
  }

  patientGrid.innerHTML = patients
    .map((patient) => {
      const reasons = (patient.recentReasons || []).slice(0, 2);
      const lastVisitText = patient.lastAppointmentAt
        ? `Last visit: ${formatDateTime(patient.lastAppointmentAt)}`
        : "No visit recorded";

      return `
        <div class="card">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:40px;height:40px;border-radius:50%;background:var(--blue);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700">
              ${initials(patient.name)}
            </div>
            <div>
              <div style="font-weight:700">${patient.name || "Unknown Patient"}</div>
              <div class="muted">Patient ID: ${formatPatientId(patient.id)}</div>
            </div>
          </div>
          <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">
            ${reasons.length
              ? reasons
                  .map((reason, index) => {
                    const klass = index % 2 === 0 ? "badge badge-blue" : "badge badge-cyan";
                    return `<span class="${klass}">${reason}</span>`;
                  })
                  .join("")
              : '<span class="badge badge-blue">General Consultation</span>'}
            <span class="${statusBadge(patient.lastStatus)}">${patient.lastStatus || "pending"}</span>
          </div>
          <div class="muted" style="margin-top:10px;font-size:.78rem">${lastVisitText}</div>
          <button class="btn btn-outline btn-full btn-sm" style="margin-top:14px" data-patient-id="${patient.id}">
            View History (${patient.totalVisits || 0})
          </button>
        </div>`;
    })
    .join("");
};

const applySearch = () => {
  const query = String(searchInput?.value || "").trim().toLowerCase();
  if (!query) {
    renderPatients(allPatients);
    return;
  }

  const filtered = allPatients.filter((patient) =>
    [patient.name, patient.email, patient.id]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query)
  );
  renderPatients(filtered);
};

const loadPatients = async () => {
  if (patientGrid) {
    patientGrid.innerHTML = `
      <div class="card">
        <div class="muted">Loading patient roster...</div>
      </div>`;
  }

  const data = await apiRequest("/api/doctors/patients");
  allPatients = data.patients || [];
  renderPatients(allPatients);
};

const onPatientActionClick = async (event) => {
  const button = event.target.closest("button[data-patient-id]");
  if (!button) return;

  const patientId = button.getAttribute("data-patient-id");
  if (!patientId) return;
  const originalLabel = button.textContent;

  try {
    button.disabled = true;
    button.textContent = "Loading...";

    const data = await apiRequest(`/api/doctors/patients/${patientId}/history`);
    const appointments = data.appointments || [];
    const patientName = appointments[0]?.patient?.name || allPatients.find((item) => item.id === patientId)?.name || "Patient";
    openHistoryModal(patientName, appointments);

    button.textContent = originalLabel;
    button.disabled = false;
  } catch (error) {
    toast(error.message, "error");
    button.textContent = originalLabel;
    button.disabled = false;
  }
};

const init = async () => {
  const session = ensureSession({
    allowedRoles: ["doctor"],
    onDenied: () => toast("Please login as doctor", "error")
  });
  if (!session.allowed) return;

  if (searchInput) {
    searchInput.placeholder = "Search patients...";
    searchInput.addEventListener("input", applySearch);
  }
  if (patientGrid) {
    patientGrid.addEventListener("click", onPatientActionClick);
  }

  try {
    await loadPatients();
  } catch (error) {
    toast(error.message, "error");
    allPatients = [];
    renderPatients([]);
  }
};

init();
