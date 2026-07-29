import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession } from "../js/api-client.js";

window.toast = toast;
injectSidebar("appointments.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("My Appointments");

const filterGroup = document.querySelector(".page-header div[style*='display:flex']");
const scheduleTbody = document.querySelector(".table-wrap tbody");

let allScheduleItems = [];
let activeFilter = "today";
let filterButtons = [];

const PRIORITY_WEIGHT = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const badgeClassByStatus = (status = "") => {
  const normalized = String(status).toLowerCase();
  if (normalized === "confirmed") return "badge badge-green";
  if (normalized === "completed") return "badge badge-blue";
  if (normalized === "cancelled") return "badge badge-red";
  if (normalized === "in_progress") return "badge badge-cyan";
  if (normalized === "resolved") return "badge badge-green";
  return "badge badge-yellow";
};

const formatSlotTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const consultationTypeDetails = (appointment) => {
  const normalized = String(appointment?.consultationType || "").toLowerCase();
  if (normalized === "video") {
    return { value: "video", label: "Video Consultancy", badgeClass: "badge badge-purple" };
  }
  if (normalized === "in_person") {
    return { value: "in_person", label: "In-Person", badgeClass: "badge badge-cyan" };
  }

  const text = `${appointment?.reason || ""} ${appointment?.notes || ""}`.toLowerCase();
  if (text.includes("video") || text.includes("tele")) {
    return { value: "video", label: "Video Consultancy", badgeClass: "badge badge-purple" };
  }

  return { value: "in_person", label: "In-Person", badgeClass: "badge badge-cyan" };
};

const findAppointmentRecord = (appointmentId = "") =>
  allScheduleItems.find(
    (item) => item.kind === "appointment" && String(item.id || item._id || "") === String(appointmentId)
  ) || null;

const openDoctorVideoPanel = (appointment) => {
  const appointmentId = String(appointment?.id || appointment?._id || "").trim();
  if (!appointmentId) {
    toast("Appointment ID is missing", "error");
    return;
  }

  const params = new URLSearchParams({ role: "doctor", appointmentId });
  const patientName = String(appointment?.patient?.name || appointment?.patientName || "").trim();
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

const appointmentActionMarkup = (item, status, isVideoConsult) => {
  if (status === "pending") {
    return `
      <button
        class="btn btn-primary btn-sm"
        data-kind="appointment"
        data-id="${item.id}"
        data-next-status="confirmed"
      >
        ${isVideoConsult ? "Confirm Video" : "Confirm"}
      </button>`;
  }

  if (status === "confirmed" && isVideoConsult) {
    return `
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button
          class="btn btn-primary btn-sm"
          data-kind="appointment"
          data-id="${item.id}"
          data-action="start-video-call"
        >
          Start Calling
        </button>
        <button
          class="btn btn-success btn-sm"
          data-kind="appointment"
          data-id="${item.id}"
          data-next-status="completed"
        >
          Complete
        </button>
      </div>`;
  }

  if (status === "confirmed") {
    return `
      <button
        class="btn btn-success btn-sm"
        data-kind="appointment"
        data-id="${item.id}"
        data-next-status="completed"
      >
        Complete
      </button>`;
  }

  return `
    <button
      class="btn btn-outline btn-sm"
      data-kind="appointment"
      data-id="${item.id}"
      disabled
    >
      Closed
    </button>`;
};

const appointmentDateOf = (item) => {
  const value = item.kind === "emergency" ? item.createdAt : item.appointmentDate;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const priorityLabel = (value = "medium") => {
  const text = String(value || "medium");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const sortSchedule = (items) =>
  [...items].sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === "emergency" ? -1 : 1;
    }

    if (a.kind === "emergency" && b.kind === "emergency") {
      const pa = PRIORITY_WEIGHT[String(a.priority || "").toLowerCase()] || 0;
      const pb = PRIORITY_WEIGHT[String(b.priority || "").toLowerCase()] || 0;
      if (pa !== pb) return pb - pa;

      const at = new Date(a.createdAt).getTime();
      const bt = new Date(b.createdAt).getTime();
      return at - bt;
    }

    const at = new Date(a.appointmentDate).getTime();
    const bt = new Date(b.appointmentDate).getTime();
    if (activeFilter === "completed") return bt - at;
    return at - bt;
  });

const filterAppointments = () => {
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + 7);

  const filtered = allScheduleItems.filter((item) => {
    const status = String(item.status || "").toLowerCase();
    const date = appointmentDateOf(item);
    if (!date) return false;

    if (activeFilter === "completed") {
      return item.kind === "appointment" && status === "completed";
    }

    if (item.kind === "emergency") {
      return ["waiting", "in_progress"].includes(status);
    }

    if (activeFilter === "today") return isSameDay(date, now);
    if (activeFilter === "weekly") return date >= now && date <= weekEnd;
    return true;
  });

  return sortSchedule(filtered);
};

const renderScheduleRows = () => {
  if (!scheduleTbody) return;
  const appointments = filterAppointments();

  if (!appointments.length) {
    scheduleTbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;color:var(--text-500)">No appointments found for this view.</td>
      </tr>`;
    return;
  }

  scheduleTbody.innerHTML = appointments
    .map((item) => {
      if (item.kind === "emergency") {
        const status = String(item.status || "waiting").toLowerCase();
        const priority = String(item.priority || "medium").toLowerCase();
        let actionLabel = "Take Case";
        let action = "take";
        let actionClass = "btn btn-danger btn-sm";
        let disabled = "";

        if (status === "in_progress") {
          actionLabel = "Resolve";
          action = "resolve";
          actionClass = "btn btn-success btn-sm";
        } else if (status === "resolved") {
          actionLabel = "Resolved";
          action = "";
          actionClass = "btn btn-outline btn-sm";
          disabled = "disabled";
        }

        return `
          <tr style="background:rgba(239,68,68,.06)">
            <td>${formatSlotTime(item.createdAt)}</td>
            <td>${item.patientName || "Emergency Patient"}</td>
            <td>${(item.symptoms || []).length ? item.symptoms.join(", ") : "Emergency intake"}</td>
            <td><span class="${badgeClassByStatus(status)}">Emergency - ${priorityLabel(priority)}</span></td>
            <td>
              <button
                class="${actionClass}"
                data-kind="emergency"
                data-id="${item.id}"
                data-action="${action}"
                ${disabled}
              >
                ${actionLabel}
              </button>
            </td>
          </tr>`;
      }

      const status = String(item.status || "pending").toLowerCase();
      const consultation = consultationTypeDetails(item);
      const isVideoConsult = consultation.value === "video";

      return `
        <tr>
          <td>${formatSlotTime(item.appointmentDate)}</td>
          <td>${item.patient?.name || "Unknown Patient"}</td>
          <td>${item.reason || "-"}</td>
          <td><span class="${consultation.badgeClass}">${consultation.label}</span></td>
          <td>
            ${appointmentActionMarkup(item, status, isVideoConsult)}
          </td>
        </tr>`;
    })
    .join("");
};

const setActiveFilter = (mode) => {
  activeFilter = mode;
  filterButtons.forEach((button) => {
    const isActive = button.getAttribute("data-filter") === mode;
    button.classList.toggle("btn-primary", isActive);
    button.classList.toggle("btn-outline", !isActive);
  });
  renderScheduleRows();
};

const ensureCompletedFilterButton = () => {
  if (!filterGroup) return;
  const existing = filterGroup.querySelector('button[data-filter="completed"]');
  if (existing) return;

  const button = document.createElement("button");
  button.className = "btn btn-outline btn-sm";
  button.textContent = "Completed";
  button.setAttribute("data-filter", "completed");
  filterGroup.appendChild(button);
};

const loadAppointments = async () => {
  if (scheduleTbody) {
    scheduleTbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;color:var(--text-500)">Loading appointments...</td>
      </tr>`;
  }

  const data = await apiRequest("/api/doctors/appointments/priority");
  allScheduleItems = data.schedule || [];
  renderScheduleRows();
};

const onScheduleActionClick = async (event) => {
  const button = event.target.closest("button[data-id]");
  if (!button) return;

  const recordId = button.getAttribute("data-id");
  const kind = button.getAttribute("data-kind");
  const nextStatus = button.getAttribute("data-next-status");
  const action = button.getAttribute("data-action");
  if (!recordId || !kind) return;

  if (kind === "appointment" && action === "start-video-call") {
    const appointment = findAppointmentRecord(recordId);
    if (!appointment) {
      toast("Appointment details not found", "error");
      return;
    }
    openDoctorVideoPanel(appointment);
    return;
  }

  try {
    button.disabled = true;

    if (kind === "emergency") {
      if (action === "take") {
        await apiRequest(`/api/doctors/emergencies/${recordId}/take`, { method: "PATCH" });
        toast("Emergency moved to your active queue", "success");
      } else if (action === "resolve") {
        await apiRequest(`/api/doctors/emergencies/${recordId}/resolve`, { method: "PATCH" });
        toast("Emergency resolved", "success");
      }
    } else {
      if (!nextStatus) return;
      await apiRequest(`/api/appointments/${recordId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus })
      });
      toast("Appointment updated", "success");
    }

    await loadAppointments();
  } catch (error) {
    toast(error.message, "error");
    button.disabled = false;
  }
};

// Doctor Patient Navigation & Fleet Map
let doctorMap = null;

async function initDoctorPatientMap() {
  if (!window.ArogyaMap || !document.getElementById("doctor-patient-map")) return;

  doctorMap = window.ArogyaMap.initMap("doctor-patient-map", { lat: 28.6139, lng: 77.2090, zoom: 13 });

  // Add Doctor's current location marker
  const doctorLoc = await window.ArogyaGeo.getCurrentLocation();
  window.ArogyaMap.addMarker(
    doctorMap,
    doctorLoc.latitude,
    doctorLoc.longitude,
    "doctor",
    "<b>👨‍⚕️ My Location</b>"
  );

  // Add assigned patient location markers
  const hospitals = await window.ArogyaHospital.getHospitals();
  if (hospitals.length > 0) {
    const h = hospitals[0];
    window.ArogyaMap.addMarker(
      doctorMap,
      h.latitude,
      h.longitude,
      "hospital",
      `<b>🏥 ${h.name}</b>`
    );
  }

  // Socket.IO tracking for assigned ambulance
  if (window.io && doctorMap) {
    const socket = window.io();
    window.ArogyaAmbulance.initLiveTracking(doctorMap, socket);
  }
}

const init = async () => {
  initDoctorPatientMap();
  const session = ensureSession({
    allowedRoles: ["doctor"],
    onDenied: () => toast("Please login as doctor", "error")
  });
  if (!session.allowed) return;

  ensureCompletedFilterButton();
  filterButtons = Array.from(filterGroup?.querySelectorAll("button.btn.btn-sm") || []);

  filterButtons.forEach((button) => {
    const label = button.textContent.trim().toLowerCase();
    if (label.includes("today")) button.setAttribute("data-filter", "today");
    if (label.includes("week")) button.setAttribute("data-filter", "weekly");
    if (label.includes("complete")) button.setAttribute("data-filter", "completed");
    button.addEventListener("click", () => {
      const mode = button.getAttribute("data-filter");
      if (mode) setActiveFilter(mode);
    });
  });

  if (scheduleTbody) {
    scheduleTbody.addEventListener("click", onScheduleActionClick);
  }

  setActiveFilter("today");

  try {
    await loadAppointments();
  } catch (error) {
    toast(error.message, "error");
    allScheduleItems = [];
    renderScheduleRows();
  }
};

init();
