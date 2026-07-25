import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession } from "../js/api-client.js";

window.toast = toast;
injectSidebar("doctors.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Find Doctors");

const searchInput = document.getElementById("search");
const grid = document.getElementById("doc-grid");
const nearestDoctorLabelEl = document.getElementById("nearest-doctor-label");
const modal = document.getElementById("book-modal");
const form = document.getElementById("doctor-book-form");
const submitBtn = document.getElementById("doctor-book-submit-btn");
const selectedDoctorField = document.getElementById("selected-doctor");
const consultationTypeInput = document.getElementById("doctor-consultation-type");

let allDoctors = [];
let filteredDoctors = [];
let selectedDoctorId = "";
let nearestDoctorId = "";
let distanceByDoctorId = {};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const getDoctorId = (doctor) =>
  String(doctor?._id || doctor?.id || doctor?.email || doctor?.name || "");

const normalizeDoctorCoords = (doctor) => {
  const parseCoords = (latRaw, lngRaw) => {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  };

  const direct = [
    doctor?.clinicCoordinates,
    doctor?.hospitalCoordinates,
    doctor?.resolvedCoordinates,
    doctor?.createdByAdmin?.hospitalCoordinates,
    doctor?.coordinates,
    doctor?.location
  ];
  for (const candidate of direct) {
    const coords = parseCoords(candidate?.lat, candidate?.lng);
    if (coords) return coords;
  }

  if (Array.isArray(doctor?.location?.coordinates) && doctor.location.coordinates.length >= 2) {
    const coords = parseCoords(doctor.location.coordinates[1], doctor.location.coordinates[0]);
    if (coords) return coords;
  }

  return parseCoords(doctor?.lat, doctor?.lng);
};

const getCurrentCoordinates = () =>
  new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
    );
  });

const haversineDistanceKm = (from, to) => {
  const earthRadiusKm = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const fromLat = (from.lat * Math.PI) / 180;
  const toLat = (to.lat * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const sortDoctorsWithNearestFirst = (doctors) => {
  doctors.sort((a, b) => {
    const aId = getDoctorId(a);
    const bId = getDoctorId(b);
    if (nearestDoctorId && aId === nearestDoctorId) return -1;
    if (nearestDoctorId && bId === nearestDoctorId) return 1;
    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });
};

const renderDoctors = () => {
  if (!filteredDoctors.length) {
    grid.innerHTML = '<div class="muted">No doctors found.</div>';
    return;
  }

  grid.innerHTML = filteredDoctors
    .map((doctor) => {
      const id = getDoctorId(doctor);
      const specialization = doctor.specialization || "General Physician";
      const phone = doctor.phone || "-";
      const hospital = doctor.hospitalName || doctor.clinicAddress || "";
      const distance = distanceByDoctorId[id];
      const distanceLabel = Number.isFinite(distance)
        ? `${distance.toFixed(1)} km away`
        : hospital || "Distance unavailable";
      const nearestBadge =
        id === nearestDoctorId
          ? '<div><span class="badge badge-green">Nearest Doctor</span></div>'
          : "";

      return `
        <div class="card" style="text-align:center">
          <div style="font-size:2rem;margin-bottom:10px">DR</div>
          <div style="font-weight:700">${escapeHtml(doctor.name || "Doctor")}</div>
          <div class="muted">${escapeHtml(specialization)}</div>
          <div style="margin-top:6px;font-size:.8rem;color:var(--text-400)">${escapeHtml(
            doctor.email || "-"
          )} | ${escapeHtml(phone)}</div>
          <div style="margin-top:6px;font-size:.78rem;color:var(--text-500)">${escapeHtml(
            distanceLabel
          )}</div>
          <div style="margin-top:8px">${nearestBadge}</div>
          <button class="btn btn-outline btn-full btn-sm" style="margin-top:12px" type="button" data-action="book" data-id="${escapeHtml(
            id
          )}">Book Appointment</button>
        </div>`;
    })
    .join("");
};

const applySearch = () => {
  const term = searchInput.value.trim().toLowerCase();
  filteredDoctors = allDoctors.filter((doctor) =>
    [doctor.name, doctor.email, doctor.specialization, doctor.hospitalName, doctor.clinicAddress]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term))
  );
  sortDoctorsWithNearestFirst(filteredDoctors);
  renderDoctors();
};

const resolveNearestDoctor = async (doctors) => {
  nearestDoctorId = doctors.length ? getDoctorId(doctors[0]) : "";
  distanceByDoctorId = {};

  if (!nearestDoctorLabelEl) return;
  if (!doctors.length) {
    nearestDoctorLabelEl.textContent = "No doctors available right now.";
    return;
  }

  const userCoords = await getCurrentCoordinates();
  let nearestDistance = Number.POSITIVE_INFINITY;
  let hasDistanceData = false;

  if (userCoords) {
    doctors.forEach((doctor) => {
      const coords = normalizeDoctorCoords(doctor);
      if (!coords) return;
      const distance = haversineDistanceKm(userCoords, coords);
      if (!Number.isFinite(distance)) return;
      const id = getDoctorId(doctor);
      distanceByDoctorId[id] = distance;
      hasDistanceData = true;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestDoctorId = id;
      }
    });
  }

  const nearestDoctor =
    doctors.find((doctor) => getDoctorId(doctor) === nearestDoctorId) || doctors[0];
  const nearestDoctorName = nearestDoctor?.name || "Doctor";

  if (userCoords && hasDistanceData && Number.isFinite(nearestDistance)) {
    nearestDoctorLabelEl.textContent = `Nearest doctor: ${nearestDoctorName} (${nearestDistance.toFixed(
      1
    )} km from your current location).`;
  } else if (!userCoords) {
    nearestDoctorLabelEl.textContent = `Nearest doctor: ${nearestDoctorName}. Allow location to calculate exact distance.`;
  } else {
    nearestDoctorLabelEl.textContent = `Nearest doctor: ${nearestDoctorName}. Exact distance is currently unavailable.`;
  }
};

const loadDoctors = async () => {
  const data = await apiRequest("/api/auth/doctors");
  allDoctors = data.doctors || [];
  await resolveNearestDoctor(allDoctors);
  sortDoctorsWithNearestFirst(allDoctors);
  filteredDoctors = [...allDoctors];
  renderDoctors();
};

const openDoctorBookingModal = (doctorId) => {
  const doctor = allDoctors.find((item) => getDoctorId(item) === doctorId);
  if (!doctor) {
    toast("Doctor not found", "error");
    return;
  }
  selectedDoctorId = doctorId;
  selectedDoctorField.value = `${doctor.name}${doctor.specialization ? ` (${doctor.specialization})` : ""}`;
  modal.classList.remove("hidden");
};

const closeDoctorBookingModal = () => {
  modal.classList.add("hidden");
  form.reset();
  selectedDoctorId = "";
  selectedDoctorField.value = "";
};

window.closeDoctorBookingModal = closeDoctorBookingModal;

modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    closeDoctorBookingModal();
  }
});

grid.addEventListener("click", (event) => {
  const button = event.target.closest('button[data-action="book"]');
  if (!button) return;
  openDoctorBookingModal(button.getAttribute("data-id"));
});

searchInput.addEventListener("input", applySearch);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedDoctorId) {
    toast("Please select a doctor", "error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Booking...";

  const parsedDate = new Date(document.getElementById("doctor-appointment-date").value);
  if (Number.isNaN(parsedDate.getTime())) {
    toast("Please select a valid date/time", "error");
    submitBtn.disabled = false;
    submitBtn.textContent = "Book";
    return;
  }

  const payload = {
    doctorId: selectedDoctorId,
    appointmentDate: parsedDate.toISOString(),
    consultationType: consultationTypeInput?.value || "in_person",
    reason: document.getElementById("doctor-appointment-reason").value.trim(),
    notes: document.getElementById("doctor-appointment-notes").value.trim()
  };

  try {
    await apiRequest("/api/appointments", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    toast("Appointment booked successfully", "success");
    closeDoctorBookingModal();
  } catch (error) {
    toast(error.message, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Book";
  }
});

const init = async () => {
  const session = ensureSession({
    allowedRoles: ["patient"],
    onDenied: () => toast("Please login as user", "error")
  });
  if (!session.allowed) return;

  try {
    await loadDoctors();
  } catch (error) {
    toast(error.message, "error");
  }
};

init();
