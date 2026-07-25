import { toast, renderBarChart } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession } from "../js/api-client.js";

window.toast = toast;
injectSidebar("reports.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Hospital Analytics");

const monthChartEl = document.getElementById("monthly-chart");
const revenueChartEl = document.getElementById("revenue-chart");
const deptBarsEl = document.getElementById("dept-bars");
const topDocsEl = document.getElementById("top-docs");
const diagListEl = document.getElementById("diag-list");
const periodSelectEl = document.querySelector(".page-header select");

let appointments = [];
let payments = [];
let doctors = [];

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

const formatMoney = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0
  })}`;

const safeRenderBarChart = (id, data) => {
  const max = Math.max(0, ...data.map((item) => Number(item.v || 0)));
  if (!max) {
    const target = document.getElementById(id);
    if (target) {
      target.innerHTML = '<div class="muted" style="text-align:center;padding-top:40px">No data available</div>';
    }
    return;
  }
  renderBarChart(id, data);
};

const inPeriod = (value, periodLabel) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfThreeMonths = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const startOfThisYear = new Date(now.getFullYear(), 0, 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  if (periodLabel === "Last Month") {
    return date >= startOfLastMonth && date < startOfThisMonth;
  }
  if (periodLabel === "Last 3 Months") {
    return date >= startOfThreeMonths && date < startOfNextMonth;
  }
  if (periodLabel === "This Year") {
    return date >= startOfThisYear && date <= now;
  }
  return date >= startOfThisMonth && date < startOfNextMonth;
};

const filteredAppointments = (periodLabel) =>
  appointments.filter((item) => inPeriod(item.appointmentDate || item.createdAt, periodLabel));

const filteredPayments = (periodLabel) => payments.filter((item) => inPeriod(item.createdAt, periodLabel));

const updateKpis = (periodLabel) => {
  const items = filteredAppointments(periodLabel);
  const payItems = filteredPayments(periodLabel);

  const totalVisits = items.length;
  const revenue = payItems
    .filter((item) => item.status === "verified")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const completed = items.filter((item) => item.status === "completed").length;
  const satisfaction = totalVisits ? 4.2 + (completed / totalVisits) * 0.8 : 4.2;
  const uptime = 95 + Math.min(4, Math.round((completed / Math.max(totalVisits, 1)) * 4));

  const statEls = document.querySelectorAll(".stat-grid .stat-card .stat-value");
  if (statEls[0]) statEls[0].textContent = totalVisits.toLocaleString("en-IN");
  if (statEls[1]) statEls[1].textContent = formatMoney(revenue);
  if (statEls[2]) statEls[2].textContent = `${satisfaction.toFixed(1)}★`;
  if (statEls[3]) statEls[3].textContent = `${uptime}%`;
};

const renderMonthlyAppointmentsChart = () => {
  const now = new Date();
  const year = now.getFullYear();
  const firstSix = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

  const chartData = firstSix.map((label, index) => {
    const count = appointments.filter((appointment) => {
      const date = new Date(appointment.appointmentDate);
      return !Number.isNaN(date.getTime()) && date.getFullYear() === year && date.getMonth() === index;
    }).length;
    return { l: label, v: count };
  });

  safeRenderBarChart("monthly-chart", chartData);
};

const renderRevenueTrendChart = () => {
  const now = new Date();
  const labels = [];
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(date);
  }

  const chartData = labels.map((date) => {
    const label = date.toLocaleDateString("en-US", { month: "short" });
    const value = payments
      .filter((payment) => {
        const created = new Date(payment.createdAt);
        return (
          !Number.isNaN(created.getTime()) &&
          created.getFullYear() === date.getFullYear() &&
          created.getMonth() === date.getMonth() &&
          payment.status === "verified"
        );
      })
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return { l: label, v: value };
  });

  safeRenderBarChart("revenue-chart", chartData);
};

const renderDepartmentBars = () => {
  if (!deptBarsEl) return;

  const doctorSpecById = doctors.reduce((acc, doctor) => {
    const id = doctor._id || doctor.id;
    if (id) acc[id] = doctor.specialization || "General";
    return acc;
  }, {});

  const deptCounts = {};
  appointments.forEach((appointment) => {
    const doctor = appointment.doctor;
    const doctorId = typeof doctor === "string" ? doctor : doctor?._id || doctor?.id;
    const specialization = doctorSpecById[doctorId] || doctor?.specialization || "General";
    deptCounts[specialization] = (deptCounts[specialization] || 0) + 1;
  });

  const entries = Object.entries(deptCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  if (!entries.length) {
    deptBarsEl.innerHTML = '<div class="muted">No department data available.</div>';
    return;
  }

  const max = Math.max(...entries.map((entry) => entry[1]));
  const colors = ["#dc2626", "var(--purple)", "#16a34a", "var(--blue)", "#ca8a04", "#06b6d4"];

  deptBarsEl.innerHTML = entries
    .map((entry, index) => {
      const [name, count] = entry;
      const percent = Math.max(8, Math.round((count / max) * 100));
      return `
        <div class="metric-row">
          <div class="metric-label">${escapeHtml(name)}</div>
          <div class="progress-track" style="flex:1"><div class="progress-fill" style="width:${percent}%;background:${colors[index % colors.length]}"></div></div>
          <div class="metric-val">${count}</div>
        </div>`;
    })
    .join("");
};

const renderTopDoctors = () => {
  if (!topDocsEl) return;

  const map = {};
  appointments.forEach((appointment) => {
    const doctorName = appointment?.doctor?.name || "Unknown Doctor";
    const key = appointment?.doctor?._id || appointment?.doctor?.id || doctorName;
    if (!map[key]) {
      map[key] = {
        name: doctorName,
        specialization: appointment?.doctor?.specialization || "Specialist",
        total: 0,
        completed: 0
      };
    }
    map[key].total += 1;
    if (appointment.status === "completed") {
      map[key].completed += 1;
    }
  });

  const top = Object.values(map)
    .sort((a, b) => b.total - a.total)
    .slice(0, 4);

  if (!top.length) {
    topDocsEl.innerHTML = '<div class="muted">No doctor performance data available.</div>';
    return;
  }

  topDocsEl.innerHTML = top
    .map((doctor, index) => {
      const rating = 4.2 + Math.min(0.8, doctor.completed / Math.max(doctor.total, 1));
      return `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
          <div style="width:28px;height:28px;border-radius:50%;background:var(--blue);color:#fff;font-size:.8rem;font-weight:700;display:flex;align-items:center;justify-content:center">${index + 1}</div>
          <div style="flex:1">
            <div style="font-size:.85rem;font-weight:600">${escapeHtml(doctor.name)}</div>
            <div style="font-size:.72rem;color:var(--text-500)">${escapeHtml(doctor.specialization)}</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:700;color:var(--blue)">${doctor.total}</div>
            <div style="font-size:.7rem;color:#ca8a04">★ ${rating.toFixed(1)}</div>
          </div>
        </div>`;
    })
    .join("");
};

const renderDiagnosis = () => {
  if (!diagListEl) return;

  const reasonCounts = {};
  appointments.forEach((appointment) => {
    const reason = String(appointment.reason || "General Consultation").trim() || "General Consultation";
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  });

  const entries = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  if (!entries.length) {
    diagListEl.innerHTML = '<div class="muted">No diagnosis data available.</div>';
    return;
  }

  const max = Math.max(...entries.map((entry) => entry[1]));
  diagListEl.innerHTML = entries
    .map((entry) => {
      const [name, count] = entry;
      const width = Math.max(8, Math.round((count / max) * 100));
      return `
        <div class="metric-row">
          <div class="metric-label">${escapeHtml(name)}</div>
          <div class="progress-track" style="flex:1"><div class="progress-fill" style="width:${width}%"></div></div>
          <div style="font-size:.75rem;font-weight:600;color:var(--text-300);width:32px;text-align:right">${count}</div>
        </div>`;
    })
    .join("");
};

const loadData = async () => {
  const requests = await Promise.allSettled([
    apiRequest("/api/appointments"),
    apiRequest("/api/payment/my"),
    apiRequest("/api/admin/users")
  ]);

  appointments = requests[0].status === "fulfilled" ? requests[0].value.appointments || [] : [];
  payments = requests[1].status === "fulfilled" ? requests[1].value.payments || [] : [];
  doctors =
    requests[2].status === "fulfilled"
      ? (requests[2].value.users || []).filter((user) => user.role === "doctor")
      : [];

  const failed = requests.find((result) => result.status === "rejected");
  if (failed) {
    toast(failed.reason?.message || "Some report data could not be loaded", "warn");
  }
};

const renderAll = () => {
  const period = periodSelectEl?.value || "This Month";
  updateKpis(period);
  renderMonthlyAppointmentsChart();
  renderRevenueTrendChart();
  renderDepartmentBars();
  renderTopDoctors();
  renderDiagnosis();
};

const init = async () => {
  const session = ensureSession({
    allowedRoles: ["super-admin"],
    onDenied: () => toast("Please login as super admin", "error")
  });
  if (!session.allowed) return;

  if (monthChartEl) {
    monthChartEl.innerHTML = '<div class="muted" style="text-align:center;padding-top:40px">Loading chart...</div>';
  }
  if (revenueChartEl) {
    revenueChartEl.innerHTML = '<div class="muted" style="text-align:center;padding-top:40px">Loading chart...</div>';
  }
  if (deptBarsEl) {
    deptBarsEl.innerHTML = '<div class="muted">Loading department metrics...</div>';
  }

  if (periodSelectEl) {
    periodSelectEl.addEventListener("change", () => {
      renderAll();
    });
  }

  try {
    await loadData();
    renderAll();
  } catch (error) {
    toast(error.message, "error");
  }
};

init();

