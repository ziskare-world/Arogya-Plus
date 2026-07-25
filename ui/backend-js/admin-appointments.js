import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession } from "../js/api-client.js";

window.toast = toast;
injectSidebar("appointments.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Admin Appointments");

const tableBodyEl = document.getElementById("appt-tbody");
const dateFilterEl = document.getElementById("date-filter");
const modalEl = document.getElementById("appt-modal");
const patientInputEl = document.getElementById("m-patient");
const doctorSelectEl = document.getElementById("m-doctor");
const dateInputEl = document.getElementById("m-date");
const timeInputEl = document.getElementById("m-time");
const reasonInputEl = document.getElementById("m-reason");
const consultationTypeInputEl = document.getElementById("m-consultation-type");

let allAppointments = [];
let allDoctors = [];
let statusFilter = "all";

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const toTitle = (value = "") => {
  const text = String(value || "").replace(/_/g, " ").trim();
  if (!text) return "-";
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const statusBadge = (status = "") => {
  const normalized = String(status || "pending").toLowerCase();
  if (normalized === "confirmed") return '<span class="badge badge-green">Confirmed</span>';
  if (normalized === "completed") return '<span class="badge badge-blue">Completed</span>';
  if (normalized === "cancelled") return '<span class="badge badge-red">Cancelled</span>';
  return '<span class="badge badge-yellow">Pending</span>';
};

const consultationTypeBadge = (appointment) => {
  const normalized = String(appointment?.consultationType || "").toLowerCase();
  if (normalized === "video") {
    return '<span class="badge badge-purple">Video Consultancy</span>';
  }
  if (normalized === "in_person") {
    return '<span class="badge badge-cyan">In-Person</span>';
  }

  const text = `${appointment?.reason || ""} ${appointment?.notes || ""}`.toLowerCase();
  if (text.includes("video") || text.includes("tele")) {
    return '<span class="badge badge-purple">Video Consultancy</span>';
  }

  return '<span class="badge badge-cyan">In-Person</span>';
};

const dateToInputValue = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const dateToDisplay = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
};

const timeToDisplay = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const parsePatientFromNotes = (notes = "") => {
  const text = String(notes || "").trim();
  if (!text.toLowerCase().startsWith("patient:")) return "";
  return text.slice(8).trim();
};

const getPatientName = (appointment) =>
  appointment?.patient?.name || parsePatientFromNotes(appointment?.notes) || "Unknown Patient";

const filteredAppointments = () =>
  allAppointments.filter((appointment) => {
    const appointmentStatus = String(appointment.status || "pending").toLowerCase();
    if (statusFilter !== "all" && appointmentStatus !== statusFilter) return false;

    const dateFilter = dateFilterEl?.value || "";
    if (!dateFilter) return true;

    return dateToInputValue(appointment.appointmentDate) === dateFilter;
  });

const renderStats = () => {
  const statEls = document.querySelectorAll(".grid-4 .stat-card .stat-value");
  const total = allAppointments.length;
  const confirmed = allAppointments.filter((item) => item.status === "confirmed").length;
  const pending = allAppointments.filter((item) => item.status === "pending").length;
  const cancelled = allAppointments.filter((item) => item.status === "cancelled").length;

  if (statEls[0]) statEls[0].textContent = String(total);
  if (statEls[1]) statEls[1].textContent = String(confirmed);
  if (statEls[2]) statEls[2].textContent = String(pending);
  if (statEls[3]) statEls[3].textContent = String(cancelled);
};

const actionButtons = (appointment) => {
  const status = String(appointment.status || "pending").toLowerCase();
  if (status === "pending") {
    return `
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" data-action="confirm" data-id="${appointment._id}">Confirm</button>
        <button class="btn btn-ghost btn-sm" data-action="cancel" data-id="${appointment._id}">Cancel</button>
      </div>`;
  }
  if (status === "confirmed") {
    return `
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" data-action="complete" data-id="${appointment._id}">Complete</button>
        <button class="btn btn-ghost btn-sm" data-action="cancel" data-id="${appointment._id}">Cancel</button>
      </div>`;
  }
  if (status === "completed") {
    return '<button class="btn btn-outline btn-sm" disabled>Completed</button>';
  }
  return '<button class="btn btn-outline btn-sm" disabled>Cancelled</button>';
};

const renderAppointments = () => {
  if (!tableBodyEl) return;
  const rows = filteredAppointments().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!rows.length) {
    tableBodyEl.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center;color:var(--text-500)">No appointments found for current filters.</td>
      </tr>`;
    return;
  }

  tableBodyEl.innerHTML = rows
    .map((appointment) => {
      const patientName = getPatientName(appointment);
      const doctorName = appointment?.doctor?.name || "Unassigned Doctor";
      return `
        <tr>
          <td><code style="color:var(--blue);font-size:.78rem">${escapeHtml(appointment.tokenNumber || appointment._id?.slice(-6) || "-")}</code></td>
          <td>
            <div style="display:flex;align-items:center;gap:8px">
              <div class="avatar avatar-sm" style="background:var(--blue);color:#fff">
                ${escapeHtml(
                  patientName
                    .split(" ")
                    .filter(Boolean)
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase() || "PT"
                )}
              </div>
              <span>${escapeHtml(patientName)}</span>
            </div>
          </td>
          <td>${escapeHtml(doctorName)}</td>
          <td>${escapeHtml(dateToDisplay(appointment.appointmentDate))}</td>
          <td>${escapeHtml(timeToDisplay(appointment.appointmentDate))}</td>
          <td style="color:var(--text-400)">${escapeHtml(appointment.reason || "-")}</td>
          <td>${consultationTypeBadge(appointment)}</td>
          <td>${statusBadge(appointment.status)}</td>
          <td>${actionButtons(appointment)}</td>
        </tr>`;
    })
    .join("");
};

const syncTabButtons = (clickedButton) => {
  document.querySelectorAll(".tab-pill").forEach((button) => button.classList.remove("active"));
  if (clickedButton) clickedButton.classList.add("active");
};

const loadDoctorsForModal = async () => {
  const data = await apiRequest("/api/admin/doctors");
  allDoctors = data.doctors || [];
  if (!doctorSelectEl) return;

  if (!allDoctors.length) {
    doctorSelectEl.innerHTML = '<option value="">No doctors available</option>';
    return;
  }

  doctorSelectEl.innerHTML = allDoctors
    .map((doctor) => `<option value="${doctor._id || doctor.id}">${escapeHtml(doctor.name || "Doctor")}</option>`)
    .join("");
};

const loadAppointments = async () => {
  if (tableBodyEl) {
    tableBodyEl.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center;color:var(--text-500)">Loading appointments...</td>
      </tr>`;
  }

  const data = await apiRequest("/api/appointments");
  allAppointments = data.appointments || [];
  renderStats();
  renderAppointments();
};

window.filterAppts = function filterAppts(status, button) {
  const normalized = String(status || "all").toLowerCase();
  statusFilter = normalized === "all" ? "all" : normalized;
  syncTabButtons(button);
  renderAppointments();
};

window.bookAppt = async function bookAppt() {
  const patientName = String(patientInputEl?.value || "").trim();
  const doctorId = String(doctorSelectEl?.value || "").trim();
  const date = String(dateInputEl?.value || "").trim();
  const time = String(timeInputEl?.value || "").trim();
  const reason = String(reasonInputEl?.value || "").trim() || "General Checkup";

  if (!patientName || !doctorId || !date || !time) {
    toast("Fill all fields", "error");
    return;
  }

  const appointmentDate = new Date(`${date}T${time}`);
  if (Number.isNaN(appointmentDate.getTime())) {
    toast("Invalid date or time", "error");
    return;
  }

  try {
    await apiRequest("/api/appointments", {
      method: "POST",
      body: JSON.stringify({
        doctorId,
        appointmentDate: appointmentDate.toISOString(),
        consultationType: String(consultationTypeInputEl?.value || "in_person").toLowerCase(),
        reason,
        notes: `Patient: ${patientName}`
      })
    });

    if (modalEl) modalEl.classList.remove("open");
    if (patientInputEl) patientInputEl.value = "";
    if (dateInputEl) dateInputEl.value = "";
    if (timeInputEl) timeInputEl.value = "";
    if (reasonInputEl) reasonInputEl.selectedIndex = 0;
    if (consultationTypeInputEl) consultationTypeInputEl.selectedIndex = 0;

    toast(`Appointment booked for ${patientName}`, "success");
    await loadAppointments();
  } catch (error) {
    toast(error.message, "error");
  }
};

const updateAppointmentStatus = async (appointmentId, nextStatus) => {
  await apiRequest(`/api/appointments/${appointmentId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: nextStatus })
  });
};

const cancelAppointment = async (appointmentId) => {
  await apiRequest(`/api/appointments/${appointmentId}/cancel`, {
    method: "PATCH"
  });
};

const onTableAction = async (event) => {
  const button = event.target.closest("button[data-action][data-id]");
  if (!button) return;

  const action = button.getAttribute("data-action");
  const appointmentId = button.getAttribute("data-id");
  if (!action || !appointmentId) return;

  try {
    button.disabled = true;
    if (action === "confirm") {
      await updateAppointmentStatus(appointmentId, "confirmed");
      toast("Appointment confirmed", "success");
    } else if (action === "complete") {
      await updateAppointmentStatus(appointmentId, "completed");
      toast("Appointment marked completed", "success");
    } else if (action === "cancel") {
      await cancelAppointment(appointmentId);
      toast("Appointment cancelled", "success");
    }
    await loadAppointments();
  } catch (error) {
    toast(error.message, "error");
    button.disabled = false;
  }
};

const init = async () => {
  const session = ensureSession({
    allowedRoles: ["admin"],
    onDenied: () => toast("Please login as admin", "error")
  });
  if (!session.allowed) return;

  if (dateFilterEl) {
    dateFilterEl.addEventListener("change", renderAppointments);
  }
  if (tableBodyEl) {
    tableBodyEl.addEventListener("click", onTableAction);
  }

  try {
    await Promise.all([loadDoctorsForModal(), loadAppointments()]);
  } catch (error) {
    toast(error.message, "error");
  }
};

init();

