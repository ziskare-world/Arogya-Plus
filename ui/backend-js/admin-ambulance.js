import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession, formatDateTime } from "../js/api-client.js";

window.toast = toast;
injectSidebar("ambulance.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Ambulance Desk");

const ACTIVE_BOOKING_STATUSES = ["requested", "dispatched", "arrived"];

const requestsBodyEl = document.getElementById("ambulance-requests-body");
const fleetBodyEl = document.getElementById("ambulance-fleet-body");
const refreshBtnEl = document.getElementById("refresh-ambulance-dashboard-btn");
const fleetFormEl = document.getElementById("fleet-form");
const fleetSubmitBtnEl = document.getElementById("fleet-submit-btn");
const fleetPermissionNoteEl = document.getElementById("fleet-permission-note");

const statTotalBookingsEl = document.getElementById("stat-total-bookings");
const statActiveBookingsEl = document.getElementById("stat-active-bookings");
const statAvailableFleetEl = document.getElementById("stat-available-fleet");
const statUnavailableFleetEl = document.getElementById("stat-unavailable-fleet");

let bookings = [];
let fleet = [];
let canManageFleet = false;

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const bookingStatusBadge = (status = "") => {
  const normalized = String(status).toLowerCase();
  if (normalized === "completed") return '<span class="badge badge-green">Completed</span>';
  if (normalized === "cancelled") return '<span class="badge badge-red">Cancelled</span>';
  if (normalized === "arrived") return '<span class="badge badge-blue">Arrived</span>';
  if (normalized === "dispatched") return '<span class="badge badge-cyan">Dispatched</span>';
  return '<span class="badge badge-yellow">Requested</span>';
};

const fleetStatusBadge = (status = "") => {
  const normalized = String(status).toLowerCase();
  if (normalized === "available") return '<span class="badge badge-green">Available</span>';
  if (normalized === "dispatched") return '<span class="badge badge-cyan">Dispatched</span>';
  if (normalized === "maintenance") return '<span class="badge badge-yellow">Maintenance</span>';
  return '<span class="badge badge-red">Inactive</span>';
};

const doctorAvailabilityTag = (value = "") => {
  const normalized = String(value).toLowerCase();
  if (normalized === "free") {
    return '<span class="tag-free">Free</span>';
  }
  if (normalized === "busy") {
    return '<span class="tag-busy">Busy</span>';
  }
  return '<span class="muted">Unknown</span>';
};

const renderStats = () => {
  const activeBookings = bookings.filter((booking) =>
    ACTIVE_BOOKING_STATUSES.includes(String(booking.status || "").toLowerCase())
  ).length;
  const availableFleet = fleet.filter((item) => String(item.status || "").toLowerCase() === "available").length;
  const unavailableFleet = fleet.length - availableFleet;

  if (statTotalBookingsEl) statTotalBookingsEl.textContent = String(bookings.length);
  if (statActiveBookingsEl) statActiveBookingsEl.textContent = String(activeBookings);
  if (statAvailableFleetEl) statAvailableFleetEl.textContent = String(availableFleet);
  if (statUnavailableFleetEl) statUnavailableFleetEl.textContent = String(unavailableFleet);
};

const buildRequestStatusOptions = (currentStatus = "") =>
  ["requested", "dispatched", "arrived", "completed", "cancelled"]
    .map((status) => {
      const selected = status === String(currentStatus || "").toLowerCase() ? "selected" : "";
      return `<option value="${status}" ${selected}>${status}</option>`;
    })
    .join("");

const buildFleetStatusOptions = (currentStatus = "") =>
  ["available", "dispatched", "maintenance", "inactive"]
    .map((status) => {
      const selected = status === String(currentStatus || "").toLowerCase() ? "selected" : "";
      return `<option value="${status}" ${selected}>${status}</option>`;
    })
    .join("");

const renderRequests = () => {
  if (!requestsBodyEl) return;

  if (!bookings.length) {
    requestsBodyEl.innerHTML = `
      <tr>
        <td colspan="9" class="muted" style="text-align:center">No ambulance requests found for this hospital.</td>
      </tr>`;
    return;
  }

  requestsBodyEl.innerHTML = bookings
    .map((booking) => {
      const bookingId = `AMB-${String(booking._id || "").slice(-6).toUpperCase()}`;
      const doctorName = booking.assignedDoctor?.name || booking.assignedDoctorName || "-";
      const doctorSpec =
        booking.assignedDoctor?.specialization ||
        booking.assignedDoctorSpecialization ||
        "General";
      const ambulanceNumber =
        booking.assignedAmbulance?.vehicleNumber ||
        booking.assignedAmbulanceVehicleNumber ||
        booking.vehicleNumber ||
        "-";
      const etaValue = Number.isFinite(Number(booking.etaMinutes)) ? Number(booking.etaMinutes) : "";
      return `
        <tr>
          <td>
            <div><code style="color:var(--blue)">${escapeHtml(bookingId)}</code></div>
            <div class="mini-note">${escapeHtml(formatDateTime(booking.createdAt))}</div>
          </td>
          <td>${escapeHtml(booking.requestedBy?.name || "-")}</td>
          <td>${escapeHtml(booking.pickupLocation || "-")}</td>
          <td>${escapeHtml(booking.problemDescription || "Emergency request")}</td>
          <td>
            <div>${escapeHtml(doctorName)}</div>
            <div class="mini-note">${escapeHtml(doctorSpec)} | ${doctorAvailabilityTag(
        booking.doctorAvailabilityStatus
      )}</div>
          </td>
          <td>${escapeHtml(ambulanceNumber)}</td>
          <td>${bookingStatusBadge(booking.status)}</td>
          <td>
            <input class="form-input" style="width:80px" type="number" min="0" value="${etaValue}"
              data-role="booking-eta" data-id="${booking._id}" />
          </td>
          <td>
            <div class="inline-actions">
              <select class="form-input" style="min-width:130px" data-role="booking-status" data-id="${booking._id}">
                ${buildRequestStatusOptions(booking.status)}
              </select>
              <button class="btn btn-primary btn-sm" type="button" data-action="update-booking" data-id="${booking._id}">
                Update
              </button>
            </div>
          </td>
        </tr>`;
    })
    .join("");
};

const renderFleet = () => {
  if (!fleetBodyEl) return;

  if (!fleet.length) {
    fleetBodyEl.innerHTML = `
      <tr>
        <td colspan="4" class="muted" style="text-align:center">No ambulance inventory found.</td>
      </tr>`;
    return;
  }

  fleetBodyEl.innerHTML = fleet
    .map((item) => {
      const isDisabled = canManageFleet ? "" : "disabled";
      return `
        <tr>
          <td><code style="color:var(--blue)">${escapeHtml(item.vehicleNumber || "-")}</code></td>
          <td>${escapeHtml(item.driverName || "-")}</td>
          <td>${fleetStatusBadge(item.status)}</td>
          <td>
            <div class="inline-actions">
              <select class="form-input" style="min-width:130px" data-role="fleet-status" data-id="${item._id}" ${isDisabled}>
                ${buildFleetStatusOptions(item.status)}
              </select>
              <button class="btn btn-outline btn-sm" type="button" data-action="update-fleet" data-id="${item._id}" ${isDisabled}>
                Save
              </button>
            </div>
          </td>
        </tr>`;
    })
    .join("");
};

const renderPermissionNote = () => {
  if (!fleetPermissionNoteEl) return;
  if (canManageFleet) {
    fleetPermissionNoteEl.textContent =
      "You can add and update ambulance inventory for your hospital.";
  } else {
    fleetPermissionNoteEl.textContent =
      "Inventory can be entered by operations/full admin only. You can still monitor requests.";
  }

  if (fleetSubmitBtnEl) {
    fleetSubmitBtnEl.disabled = !canManageFleet;
  }
  if (fleetFormEl) {
    const inputs = Array.from(fleetFormEl.querySelectorAll("input, select, textarea"));
    inputs.forEach((input) => {
      if (input.id === "fleet-submit-btn") return;
      input.disabled = !canManageFleet;
    });
  }
};

const loadDashboard = async () => {
  const [bookingsResponse, fleetResponse] = await Promise.all([
    apiRequest("/api/ambulance/my"),
    apiRequest("/api/ambulance/fleet")
  ]);

  bookings = bookingsResponse.bookings || [];
  fleet = fleetResponse.fleet || [];
  canManageFleet = Boolean(fleetResponse.canManageFleet);

  renderStats();
  renderRequests();
  renderFleet();
  renderPermissionNote();
};

const updateBooking = async (bookingId) => {
  const statusSelect = document.querySelector(
    `select[data-role="booking-status"][data-id="${bookingId}"]`
  );
  const etaInput = document.querySelector(`input[data-role="booking-eta"][data-id="${bookingId}"]`);
  const status = String(statusSelect?.value || "").trim().toLowerCase();
  const etaRaw = String(etaInput?.value || "").trim();

  const payload = { status };
  if (etaRaw) {
    payload.etaMinutes = Number(etaRaw);
  }

  await apiRequest(`/api/ambulance/${bookingId}/status`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
};

const updateFleetStatus = async (fleetId) => {
  const statusSelect = document.querySelector(`select[data-role="fleet-status"][data-id="${fleetId}"]`);
  const status = String(statusSelect?.value || "").trim().toLowerCase();
  await apiRequest(`/api/ambulance/fleet/${fleetId}`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
};

const onFleetSubmit = async (event) => {
  event.preventDefault();
  if (!canManageFleet) {
    toast("Only operations/full admin can add ambulance inventory", "error");
    return;
  }

  const vehicleNumber = String(document.getElementById("fleet-vehicle-number")?.value || "").trim();
  const driverName = String(document.getElementById("fleet-driver-name")?.value || "").trim();
  const driverPhone = String(document.getElementById("fleet-driver-phone")?.value || "").trim();
  const status = String(document.getElementById("fleet-status")?.value || "available").trim();

  if (!vehicleNumber) {
    toast("Vehicle number is required", "error");
    return;
  }

  if (fleetSubmitBtnEl) {
    fleetSubmitBtnEl.disabled = true;
    fleetSubmitBtnEl.textContent = "Adding...";
  }

  try {
    await apiRequest("/api/ambulance/fleet", {
      method: "POST",
      body: JSON.stringify({ vehicleNumber, driverName, driverPhone, status })
    });
    toast("Ambulance inventory added", "success");
    fleetFormEl?.reset();
    await loadDashboard();
  } catch (error) {
    toast(error.message, "error");
  } finally {
    if (fleetSubmitBtnEl) {
      fleetSubmitBtnEl.disabled = !canManageFleet;
      fleetSubmitBtnEl.textContent = "Add Ambulance";
    }
  }
};

const initListeners = () => {
  if (refreshBtnEl) {
    refreshBtnEl.addEventListener("click", async () => {
      try {
        await loadDashboard();
        toast("Ambulance desk refreshed", "success");
      } catch (error) {
        toast(error.message, "error");
      }
    });
  }

  if (fleetFormEl) {
    fleetFormEl.addEventListener("submit", onFleetSubmit);
  }

  if (requestsBodyEl) {
    requestsBodyEl.addEventListener("click", async (event) => {
      const button = event.target.closest('button[data-action="update-booking"]');
      if (!button) return;
      const bookingId = button.getAttribute("data-id");
      if (!bookingId) return;

      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = "Saving...";
      try {
        await updateBooking(bookingId);
        toast("Ambulance booking updated", "success");
        await loadDashboard();
      } catch (error) {
        toast(error.message, "error");
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });
  }

  if (fleetBodyEl) {
    fleetBodyEl.addEventListener("click", async (event) => {
      const button = event.target.closest('button[data-action="update-fleet"]');
      if (!button) return;
      if (!canManageFleet) {
        toast("Only operations/full admin can update inventory", "error");
        return;
      }

      const fleetId = button.getAttribute("data-id");
      if (!fleetId) return;
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = "Saving...";
      try {
        await updateFleetStatus(fleetId);
        toast("Ambulance inventory updated", "success");
        await loadDashboard();
      } catch (error) {
        toast(error.message, "error");
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });
  }
};

const init = async () => {
  const session = ensureSession({
    allowedRoles: ["admin", "super-admin"],
    onDenied: () => toast("Please login as admin", "error")
  });
  if (!session.allowed) return;

  initListeners();

  try {
    await loadDashboard();
  } catch (error) {
    toast(error.message, "error");
  }
};

init();
