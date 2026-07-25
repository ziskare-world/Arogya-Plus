import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession } from "../js/api-client.js";

window.toast = toast;
injectSidebar("patients.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Patient Management");

const tableBodyEl = document.getElementById("pat-tbody");

let allPatients = [];
let allAppointments = [];
let activeEmergencies = [];

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatPatientCode = (id = "") => `PAT-${String(id).replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase()}`;

const toBadge = (status = "") => {
  const normalized = String(status).toLowerCase();
  if (normalized === "critical") return '<span class="badge badge-red">Critical</span>';
  if (normalized === "discharged" || normalized === "inactive") return '<span class="badge badge-blue">Discharged</span>';
  return '<span class="badge badge-green">Active</span>';
};

const avatar = (name = "Patient") =>
  String(name)
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "PT";

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
};

const getPatientAppointments = (patientId) =>
  allAppointments
    .filter((appointment) => {
      const patient = appointment.patient;
      if (!patient) return false;
      if (typeof patient === "string") return patient === patientId;
      return patient._id === patientId || patient.id === patientId;
    })
    .sort((a, b) => new Date(b.appointmentDate) - new Date(a.appointmentDate));

const computePatientStatus = (patient) => {
  const inEmergency = activeEmergencies.some(
    (emergency) =>
      String(emergency.patientName || "").trim().toLowerCase() === String(patient.name || "").trim().toLowerCase()
  );
  if (inEmergency) return "critical";
  if (patient.isActive === false) return "discharged";
  return "active";
};

const renderStats = () => {
  const statusList = allPatients.map((patient) => computePatientStatus(patient));
  const total = allPatients.length;
  const active = statusList.filter((status) => status === "active").length;
  const critical = statusList.filter((status) => status === "critical").length;
  const discharged = statusList.filter((status) => status === "discharged").length;

  const statEls = document.querySelectorAll(".stat-grid .stat-card .stat-value");
  if (statEls[0]) statEls[0].textContent = total.toLocaleString("en-IN");
  if (statEls[1]) statEls[1].textContent = active.toLocaleString("en-IN");
  if (statEls[2]) statEls[2].textContent = critical.toLocaleString("en-IN");
  if (statEls[3]) statEls[3].textContent = discharged.toLocaleString("en-IN");

  const subtitleEl = document.querySelector(".page-header p");
  if (subtitleEl) {
    subtitleEl.textContent = `${total.toLocaleString("en-IN")} registered patients`;
  }
};

const renderPatients = (patients) => {
  if (!tableBodyEl) return;

  if (!patients.length) {
    tableBodyEl.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;color:var(--text-500)">No patients found.</td>
      </tr>`;
    return;
  }

  tableBodyEl.innerHTML = patients
    .map((patient) => {
      const status = computePatientStatus(patient);
      const visits = getPatientAppointments(patient._id || patient.id);
      const lastVisit = visits[0]?.appointmentDate || patient.createdAt;

      return `
        <tr>
          <td><code style="color:var(--blue);font-size:.78rem">${escapeHtml(formatPatientCode(patient._id || patient.id || ""))}</code></td>
          <td>
            <div style="display:flex;align-items:center;gap:8px">
              <div class="avatar avatar-sm" style="background:var(--blue);color:#fff">${escapeHtml(avatar(patient.name))}</div>
              <span style="font-weight:500">${escapeHtml(patient.name || "Unknown Patient")}</span>
            </div>
          </td>
          <td>${escapeHtml(String(patient.age || "-"))}</td>
          <td><span class="badge badge-red">${escapeHtml(patient.blood || "--")}</span></td>
          <td style="color:var(--text-400)">${escapeHtml(patient.phone || "-")}</td>
          <td style="color:var(--text-400)">${escapeHtml(formatDate(lastVisit))}</td>
          <td>${toBadge(status)}</td>
          <td>
            <div style="display:flex;gap:6px">
              <button class="btn btn-ghost btn-sm" onclick="toast('View patient details from records','info')">View</button>
              <button class="btn btn-ghost btn-sm" onclick="toast('Edit patient profile from profile page','info')">Edit</button>
            </div>
          </td>
        </tr>`;
    })
    .join("");
};

const loadData = async () => {
  const requests = await Promise.allSettled([
    apiRequest("/api/admin/users?role=patient"),
    apiRequest("/api/appointments"),
    apiRequest("/api/emergency/queue")
  ]);

  allPatients = requests[0].status === "fulfilled" ? requests[0].value.users || [] : [];
  allAppointments = requests[1].status === "fulfilled" ? requests[1].value.appointments || [] : [];
  activeEmergencies = requests[2].status === "fulfilled" ? requests[2].value.queue || [] : [];

  const failed = requests.find((result) => result.status === "rejected");
  if (failed) {
    toast(failed.reason?.message || "Some patient data could not be loaded", "warn");
  }
};

window.searchPat = function searchPat(value) {
  const query = String(value || "").trim().toLowerCase();
  if (!query) {
    renderPatients(allPatients);
    return;
  }

  const filtered = allPatients.filter((patient) => {
    const code = formatPatientCode(patient._id || patient.id || "");
    const blob = `${patient.name || ""} ${patient.phone || ""} ${code}`.toLowerCase();
    return blob.includes(query);
  });
  renderPatients(filtered);
};

const init = async () => {
  const session = ensureSession({
    allowedRoles: ["super-admin"],
    onDenied: () => toast("Please login as super admin", "error")
  });
  if (!session.allowed) return;

  if (tableBodyEl) {
    tableBodyEl.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;color:var(--text-500)">Loading patients...</td>
      </tr>`;
  }

  try {
    await loadData();
    renderStats();
    renderPatients(allPatients);
  } catch (error) {
    toast(error.message, "error");
    renderPatients([]);
  }
};

init();

