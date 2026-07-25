import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession } from "../js/api-client.js";

window.toast = toast;
injectSidebar("dashboard.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Doctor Dashboard");

const doctorGreetingEl = document.getElementById("doctor-greeting");
const doctorSubtitleEl = document.querySelector(".page-header p");
const statValueEls = document.querySelectorAll(".stat-grid .stat-card .stat-value");
const scheduleTbody = document.querySelector(".table-wrap tbody");
let currentSchedule = [];

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

const appointmentActionMarkup = (appointment) => {
  const normalized = String(appointment?.status || "").toLowerCase();
  const consultation = consultationTypeDetails(appointment);
  const isVideoConsult = consultation.value === "video";
  const appointmentId = String(appointment?._id || appointment?.id || "");

  if (normalized === "pending") {
    return `
      <button
        class="btn btn-primary btn-sm"
        data-action-status="confirmed"
        data-id="${appointmentId}"
      >
        ${isVideoConsult ? "Confirm Video" : "Confirm"}
      </button>`;
  }

  if (normalized === "confirmed" && isVideoConsult) {
    return `
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button
          class="btn btn-primary btn-sm"
          data-action="start-video-call"
          data-id="${appointmentId}"
        >
          Start Calling
        </button>
        <button
          class="btn btn-success btn-sm"
          data-action-status="completed"
          data-id="${appointmentId}"
        >
          Complete
        </button>
      </div>`;
  }

  if (normalized === "confirmed") {
    return `
      <button
        class="btn btn-success btn-sm"
        data-action-status="completed"
        data-id="${appointmentId}"
      >
        Complete
      </button>`;
  }

  if (normalized === "completed") {
    return `
      <button class="btn btn-outline btn-sm" data-id="${appointmentId}" disabled>
        Completed
      </button>`;
  }

  if (normalized === "cancelled") {
    return `
      <button class="btn btn-outline btn-sm" data-id="${appointmentId}" disabled>
        Cancelled
      </button>`;
  }

  return `
    <button class="btn btn-outline btn-sm" data-id="${appointmentId}" disabled>
      N/A
    </button>`;
};

const renderScheduleRows = (appointments = []) => {
  if (!scheduleTbody) return;
  currentSchedule = Array.isArray(appointments) ? appointments : [];

  if (!currentSchedule.length) {
    scheduleTbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;color:var(--text-500)">No upcoming schedule found.</td>
      </tr>`;
    return;
  }

  scheduleTbody.innerHTML = currentSchedule
    .map((appointment) => {
      const statusClass = badgeClassByStatus(appointment.status);
      const consultation = consultationTypeDetails(appointment);
      const patientName = appointment.patient?.name || "Unknown Patient";
      return `
        <tr>
          <td>${formatSlotTime(appointment.appointmentDate)}</td>
          <td>${patientName}</td>
          <td><span class="${consultation.badgeClass}">${consultation.label}</span></td>
          <td><span class="${statusClass}">${appointment.status || "pending"}</span></td>
          <td>
            ${appointmentActionMarkup(appointment)}
          </td>
        </tr>`;
    })
    .join("");
};

const updateGreeting = (sessionUser) => {
  if (!doctorGreetingEl) return;
  const greeting = getTimeGreeting();
  const doctorName = formatDoctorName(sessionUser?.name || "Doctor");
  doctorGreetingEl.textContent = `${greeting}, ${doctorName}`;
};

const loadDashboard = async () => {
  if (scheduleTbody) {
    scheduleTbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;color:var(--text-500)">Loading schedule...</td>
      </tr>`;
  }

  const data = await apiRequest("/api/doctors/dashboard");
  const summary = data.summary || {};

  if (doctorSubtitleEl) {
    doctorSubtitleEl.textContent = `You have ${summary.todaysVisits || 0} consultations scheduled for today.`;
  }

  if (statValueEls[0]) statValueEls[0].textContent = String(summary.todaysVisits || 0);
  if (statValueEls[1]) statValueEls[1].textContent = String(summary.completedConsults || 0);
  if (statValueEls[2]) statValueEls[2].textContent = String(summary.urgentReviews || 0);

  renderScheduleRows(data.upcomingSchedule || []);
};

const onScheduleActionClick = async (event) => {
  const button = event.target.closest("button[data-id]");
  if (!button) return;

  const appointmentId = button.getAttribute("data-id");
  const action = button.getAttribute("data-action");
  const nextStatus = button.getAttribute("data-action-status");
  if (!appointmentId) return;

  if (action === "start-video-call") {
    const appointment = findAppointmentRecord(appointmentId);
    if (!appointment) {
      toast("Appointment details not found", "error");
      return;
    }
    openDoctorVideoPanel(appointment);
    return;
  }

  if (!nextStatus) return;

  try {
    button.disabled = true;
    await apiRequest(`/api/appointments/${appointmentId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus })
    });
    toast("Appointment status updated", "success");
    await loadDashboard();
  } catch (error) {
    toast(error.message, "error");
    button.disabled = false;
  }
};

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
    renderScheduleRows([]);
  }
};

init();
