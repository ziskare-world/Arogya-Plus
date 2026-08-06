import { toast, renderBarChart, renderDonut } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession } from "../js/api-client.js";

window.toast = toast;
injectSidebar("dashboard.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Admin Dashboard");

const welcomeNameEl = document.getElementById("welcome-name");
const todayDateEl = document.getElementById("today-date");
const apptStatEl = document.getElementById("s-appt");
const doctorStatEl = document.getElementById("s-docs");
const patientStatEl = document.getElementById("s-patients");
const emergencyStatEl = document.getElementById("s-emr");
const revenueStatEl = document.getElementById("s-rev");
const appointmentsBodyEl = document.getElementById("today-appts");
const activityFeedEl = document.getElementById("activity-feed");
const weeklyChartEl = document.getElementById("weekly-chart");
const doctorReviewsEl = document.getElementById("dashboard-doctor-reviews");

const state = {
  appointments: [],
  doctors: [],
  patients: [],
  queue: [],
  payments: [],
  doctorReviews: []
};

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

const initials = (name = "User") =>
  String(name)
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

const formatMoney = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0
  })}`;

const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const formatRelative = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60 * 1000) return "just now";
  const mins = Math.floor(diffMs / (60 * 1000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const statusBadgeClass = (status = "") => {
  const normalized = String(status).toLowerCase();
  if (normalized === "confirmed" || normalized === "verified") return "badge badge-green";
  if (normalized === "completed") return "badge badge-blue";
  if (normalized === "cancelled" || normalized === "failed") return "badge badge-red";
  return "badge badge-yellow";
};

const isSameDay = (dateA, dateB) =>
  dateA.getFullYear() === dateB.getFullYear() &&
  dateA.getMonth() === dateB.getMonth() &&
  dateA.getDate() === dateB.getDate();

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const getWeekStart = (baseDate) => {
  const date = new Date(baseDate);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const parseAppointmentDate = (appointment) => {
  const date = new Date(appointment?.appointmentDate);
  return Number.isNaN(date.getTime()) ? null : date;
};

const renderSafeBarChart = (containerId, data) => {
  const values = data.map((item) => Number(item.v || 0));
  const max = Math.max(0, ...values);
  if (!max) {
    const target = document.getElementById(containerId);
    if (target) {
      target.innerHTML = '<div class="muted" style="text-align:center;padding-top:54px">No chart data available</div>';
    }
    return;
  }
  renderBarChart(containerId, data);
};

const renderTodayAppointments = () => {
  if (!appointmentsBodyEl) return;
  const today = new Date();

  let todayAppointments = state.appointments
    .filter((appointment) => {
      const date = parseAppointmentDate(appointment);
      return date ? isSameDay(date, today) : false;
    })
    .sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate))
    .slice(0, 8);

  // Fallback to recent appointments if none scheduled specifically for today
  if (!todayAppointments.length && state.appointments.length > 0) {
    todayAppointments = [...state.appointments]
      .sort((a, b) => new Date(b.createdAt || b.appointmentDate) - new Date(a.createdAt || a.appointmentDate))
      .slice(0, 6);
  }

  if (!todayAppointments.length) {
    appointmentsBodyEl.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;color:var(--text-500)">No appointments scheduled for today.</td>
      </tr>`;
    return;
  }

  appointmentsBodyEl.innerHTML = todayAppointments
    .map((appointment) => {
      const patientName = appointment?.patient?.name || "Unknown Patient";
      const doctorName = appointment?.doctor?.name || "Unassigned Doctor";
      const reason = appointment?.reason || "-";
      const status = String(appointment?.status || "pending").toLowerCase();

      return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:8px">
              <div class="avatar avatar-sm" style="background:var(--blue);color:#fff">${escapeHtml(initials(patientName))}</div>
              <span>${escapeHtml(patientName)}</span>
            </div>
          </td>
          <td>${escapeHtml(doctorName)}</td>
          <td>${escapeHtml(formatDateTime(appointment.appointmentDate))}</td>
          <td style="color:var(--text-400)">${escapeHtml(reason)}</td>
          <td><span class="${statusBadgeClass(status)}">${escapeHtml(toTitle(status))}</span></td>
        </tr>`;
    })
    .join("");
};

const renderWeeklyAppointments = () => {
  if (!weeklyChartEl) return;
  const weekStart = getWeekStart(new Date());
  const weekCounts = weekDays.map((label, index) => {
    const dayStart = new Date(weekStart);
    dayStart.setDate(weekStart.getDate() + index);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);

    const value = state.appointments.filter((appointment) => {
      const date = parseAppointmentDate(appointment);
      if (!date) return false;
      return date >= dayStart && date < dayEnd;
    }).length;

    return { l: label, v: value };
  });

  renderSafeBarChart("weekly-chart", weekCounts);
};

const renderOccupancy = () => {
  const totalBeds = Number(state.settings?.totalBeds || 0);
  const occupiedBeds = Number(state.settings?.occupiedBeds || 0);
  const icuBedsTotal = Number(state.settings?.icuBedsTotal || 0);
  const icuBedsOccupied = Number(state.settings?.icuBedsOccupied || 0);

  const pct = totalBeds > 0 ? Math.min(100, Math.max(0, Math.round((occupiedBeds / totalBeds) * 100))) : 0;
  const availableBeds = Math.max(0, totalBeds - occupiedBeds);

  renderDonut("donut-svg", pct, pct > 85 ? "#ef4444" : "#06b6d4");

  const centerPctEl = document.getElementById("bed-occupancy-pct") || document.querySelector(".donut-center div");
  if (centerPctEl) {
    centerPctEl.textContent = `${pct}%`;
  }

  const welcomePctEl = document.getElementById("welcome-occupancy-pct");
  if (welcomePctEl) {
    welcomePctEl.textContent = `${pct}%`;
  }

  const bedTotalEl = document.getElementById("bed-total");
  const bedOccupiedEl = document.getElementById("bed-occupied");
  const bedAvailableEl = document.getElementById("bed-available");
  const bedIcuEl = document.getElementById("bed-icu");

  if (bedTotalEl) bedTotalEl.textContent = String(totalBeds);
  if (bedOccupiedEl) bedOccupiedEl.textContent = String(occupiedBeds);
  if (bedAvailableEl) bedAvailableEl.textContent = String(availableBeds);
  if (bedIcuEl) bedIcuEl.textContent = `${icuBedsOccupied}/${icuBedsTotal}`;
};

const buildActivityItems = () => {
  const items = [];

  state.queue.slice(0, 4).forEach((emergency) => {
    items.push({
      color: "#dc2626",
      text: `${emergency.patientName || "Patient"} added to emergency queue`,
      sub: `Priority: ${toTitle(emergency.priority || "medium")}`,
      time: formatRelative(emergency.createdAt)
    });
  });

  state.appointments.slice(0, 6).forEach((appointment) => {
    const patient = appointment?.patient?.name || "Patient";
    const doctor = appointment?.doctor?.name || "Doctor";
    items.push({
      color: "#2563eb",
      text: `${patient} appointment ${toTitle(appointment.status || "pending").toLowerCase()}`,
      sub: doctor,
      time: formatRelative(appointment.updatedAt || appointment.createdAt || appointment.appointmentDate)
    });
  });

  state.payments.slice(0, 4).forEach((payment) => {
    items.push({
      color: payment.status === "failed" ? "#dc2626" : "#16a34a",
      text: `Payment ${toTitle(payment.status || "created").toLowerCase()} (${formatMoney(payment.amount)})`,
      sub: payment.razorpayOrderId || "Payment record",
      time: formatRelative(payment.createdAt)
    });
  });

  return items
    .filter((item) => item.time !== "-")
    .sort((a, b) => {
      const rankA = /just now|m ago/.test(a.time) ? 2 : /h ago/.test(a.time) ? 1 : 0;
      const rankB = /just now|m ago/.test(b.time) ? 2 : /h ago/.test(b.time) ? 1 : 0;
      return rankB - rankA;
    })
    .slice(0, 7);
};

const renderActivity = () => {
  if (!activityFeedEl) return;
  const items = buildActivityItems();
  if (!items.length) {
    activityFeedEl.innerHTML = '<div class="muted" style="padding:8px 0">No recent activity</div>';
    return;
  }

  activityFeedEl.innerHTML = items
    .map(
      (item) => `
        <div class="activity-item">
          <div class="activity-dot" style="background:${item.color}"></div>
          <div style="flex:1">
            <div style="font-size:.84rem;color:var(--text-200)">${escapeHtml(item.text)}</div>
            <div style="font-size:.72rem;color:var(--text-500)">${escapeHtml(item.sub)}</div>
          </div>
          <div class="activity-time">${escapeHtml(item.time)}</div>
        </div>`
    )
    .join("");
};

const renderDoctorReviews = () => {
  if (!doctorReviewsEl) return;

  if (!state.doctorReviews.length) {
    doctorReviewsEl.innerHTML = '<div class="muted" style="font-size:.78rem">No doctor reviews yet.</div>';
    return;
  }

  doctorReviewsEl.innerHTML = state.doctorReviews
    .slice(0, 5)
    .map((review) => {
      const doctorName = review?.doctor?.name || "Doctor";
      const patientName = review?.patient?.name || "Patient";
      const rating = Math.max(1, Math.min(5, Number(review?.doctorRating || 0)));
      const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
      const note = String(review?.doctorReview || "").trim() || "No written review";
      return `
        <div style="padding:8px 0;border-bottom:1px dashed var(--border)">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
            <div style="font-size:.8rem;color:var(--text-200);font-weight:600">${escapeHtml(doctorName)}</div>
            <span class="badge badge-yellow">${escapeHtml(`${rating}/5`)}</span>
          </div>
          <div style="font-size:.74rem;color:#f59e0b;margin-top:2px">${escapeHtml(stars)}</div>
          <div style="font-size:.74rem;color:var(--text-400);margin-top:4px">${escapeHtml(note)}</div>
          <div style="font-size:.7rem;color:var(--text-500);margin-top:4px">Patient: ${escapeHtml(
            patientName
          )}</div>
        </div>`;
    })
    .join("");
};

const renderSummary = () => {
  if (apptStatEl) apptStatEl.textContent = String(state.appointments.length);
  if (doctorStatEl) doctorStatEl.textContent = String(state.doctors.filter((item) => item.isActive).length);
  if (patientStatEl) patientStatEl.textContent = String(state.patients.length);
  if (emergencyStatEl) emergencyStatEl.textContent = String(state.queue.length);

  const revenue = state.payments
    .filter((payment) => payment.status !== "failed")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  if (revenueStatEl) revenueStatEl.textContent = formatMoney(revenue);

  const welcomeSummaryStrongEl = document.querySelector(".welcome-card p strong");
  if (welcomeSummaryStrongEl) {
    const todayCount = state.appointments.filter((appointment) => {
      const date = parseAppointmentDate(appointment);
      return date ? isSameDay(date, new Date()) : false;
    }).length;
    welcomeSummaryStrongEl.textContent = `${todayCount} appointments`;
  }
};

const loadDashboardData = async () => {
  const requests = await Promise.allSettled([
    apiRequest("/api/appointments"),
    apiRequest("/api/admin/doctors"),
    apiRequest("/api/admin/users?role=patient"),
    apiRequest("/api/emergency/queue"),
    apiRequest("/api/payment/my"),
    apiRequest("/api/admin/doctor-reviews?limit=20"),
    apiRequest("/api/admin/settings")
  ]);

  state.appointments = requests[0].status === "fulfilled" ? requests[0].value.appointments || [] : [];
  state.doctors = requests[1].status === "fulfilled" ? requests[1].value.doctors || [] : [];
  state.patients = requests[2].status === "fulfilled" ? requests[2].value.users || [] : [];
  state.queue = requests[3].status === "fulfilled" ? requests[3].value.queue || [] : [];
  state.payments = requests[4].status === "fulfilled" ? requests[4].value.payments || [] : [];
  state.doctorReviews = requests[5].status === "fulfilled" ? requests[5].value.reviews || [] : [];
  state.settings = requests[6].status === "fulfilled" ? requests[6].value.settings || {} : {};

  const firstError = requests.find((result) => result.status === "rejected");
  if (firstError) {
    toast(firstError.reason?.message || "Some dashboard data could not be loaded", "warn");
  }
};

window.refreshActivity = function refreshActivity() {
  renderActivity();
  toast("Activity feed refreshed", "success");
};

const loadLiveMetrics = async () => {
  try {
    const res = await apiRequest("/api/admin/live-metrics");
    if (!res.success) return;

    const liveSockets = document.getElementById("live-sockets");
    const liveRooms = document.getElementById("live-rooms");
    const liveMemory = document.getElementById("live-memory");
    const liveUptime = document.getElementById("live-uptime");

    if (liveSockets) liveSockets.textContent = String(res.server.connectedSockets || 0);
    if (liveRooms) liveRooms.textContent = String(res.server.activeVideoRooms || 0);
    if (liveMemory) liveMemory.textContent = `${res.server.memoryRssMb || 0} MB`;
    if (liveUptime) {
      const up = Number(res.server.uptimeSeconds || 0);
      const mins = Math.floor(up / 60);
      liveUptime.textContent = mins > 0 ? `${mins}m ${up % 60}s` : `${up}s`;
    }
  } catch {
    // Live polling quiet fallback
  }
};

const setupBroadcastAlertForm = () => {
  const form = document.getElementById("broadcast-alert-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("broadcast-title")?.value.trim();
    const message = document.getElementById("broadcast-message")?.value.trim();
    const level = document.getElementById("broadcast-level")?.value || "info";

    if (!title || !message) {
      toast("Please enter both title and message for broadcast alert", "warn");
      return;
    }

    try {
      const res = await apiRequest("/api/admin/broadcast-alert", {
        method: "POST",
        body: JSON.stringify({ title, message, level })
      });

      if (res.success) {
        toast(`System alert broadcasted to all connected users (${level})`, "success");
        form.reset();
      }
    } catch (err) {
      toast(err.message || "Failed to send broadcast alert", "error");
    }
  });
};

const init = async () => {
  const session = ensureSession({
    allowedRoles: ["admin"],
    onDenied: () => toast("Please login as admin", "error")
  });
  if (!session.allowed) return;

  if (welcomeNameEl) {
    const firstName = String(session.user?.name || "Admin").split(" ")[0];
    welcomeNameEl.textContent = firstName || "Admin";
  }
  if (todayDateEl) {
    todayDateEl.textContent = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric"
    });
  }

  if (appointmentsBodyEl) {
    appointmentsBodyEl.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;color:var(--text-500)">Loading dashboard data...</td>
      </tr>`;
  }
  if (activityFeedEl) {
    activityFeedEl.innerHTML = '<div class="muted" style="padding:8px 0">Loading activity...</div>';
  }

  setupBroadcastAlertForm();

  try {
    await loadDashboardData();
    renderSummary();
    renderWeeklyAppointments();
    renderTodayAppointments();
    renderActivity();
    renderDoctorReviews();
    renderOccupancy();
    await loadLiveMetrics();

    // Poll live server metrics every 10 seconds
    setInterval(loadLiveMetrics, 10000);
  } catch (error) {
    toast(error.message, "error");
  }
};

init();

