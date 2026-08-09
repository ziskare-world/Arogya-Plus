import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession } from "../js/api-client.js";

window.toast = toast;
injectSidebar("doctors.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Medical Staff");

const modalEl = document.getElementById("doctor-modal");
const doctorFormEl = document.getElementById("doctor-form");
const doctorGridEl = document.getElementById("doc-grid");
const searchInputEl = document.getElementById("doctor-search");
const specFiltersEl = document.getElementById("spec-filters");
const subtitleEl = document.getElementById("doc-subtitle");
const reviewListEl = document.getElementById("doctor-review-list");
const reviewCountEl = document.getElementById("review-count");

const modalTitleEl = document.getElementById("doctor-modal-title");
const submitBtnEl = document.getElementById("create-doctor-btn");
const passwordInputEl = document.getElementById("doctor-password");
const passwordHintEl = document.getElementById("password-hint");
const statusGroupEl = document.getElementById("doctor-status-group");
const statusInputEl = document.getElementById("doctor-active");

const doctorNameEl = document.getElementById("doctor-name");
const doctorEmailEl = document.getElementById("doctor-email");
const doctorSpecializationEl = document.getElementById("doctor-specialization");
const doctorPhoneEl = document.getElementById("doctor-phone");
const doctorExperienceEl = document.getElementById("doctor-experience");

let doctors = [];
let doctorReviews = [];
let searchText = "";
let specFilter = "";
let editingDoctorId = null;

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const getDoctorId = (doctor) => doctor?._id || doctor?.id || "";

const initials = (name = "") =>
  String(name)
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "DR";

const isCreatedToday = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return (
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate()
  );
};

const formatDateTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

const renderStars = (value) => {
  const raw = Number(value || 0);
  const rating = Number.isFinite(raw) ? Math.max(0, Math.min(5, Math.round(raw))) : 0;
  const filled = "★".repeat(rating);
  const empty = "☆".repeat(5 - rating);
  return `${filled}${empty}`;
};

const setStats = (list) => {
  const total = list.length;
  const active = list.filter((doctor) => doctor.isActive).length;
  const createdToday = list.filter((doctor) => isCreatedToday(doctor.createdAt)).length;
  const specializations = new Set(
    list
      .map((doctor) => String(doctor.specialization || "").trim())
      .filter(Boolean)
  ).size;

  const statTotal = document.getElementById("stat-total-doctors");
  const statActive = document.getElementById("stat-active-doctors");
  const statSpec = document.getElementById("stat-specializations");
  const statCreated = document.getElementById("stat-created-today");

  if (statTotal) statTotal.textContent = String(total);
  if (statActive) statActive.textContent = String(active);
  if (statSpec) statSpec.textContent = String(specializations);
  if (statCreated) statCreated.textContent = String(createdToday);
  if (subtitleEl) subtitleEl.textContent = `${total} doctor account(s) created by you.`;
};

const renderSpecFilters = (list) => {
  if (!specFiltersEl) return;

  const specializations = [...new Set(list.map((doctor) => String(doctor.specialization || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  const chips = ["All", ...specializations];
  specFiltersEl.innerHTML = chips
    .map((chip) => {
      const active = (!specFilter && chip === "All") || specFilter === chip;
      return `<button class="btn btn-outline btn-sm ${active ? "active" : ""}" type="button" data-spec="${escapeHtml(chip)}">${escapeHtml(chip)}</button>`;
    })
    .join("");

  specFiltersEl.querySelectorAll("button[data-spec]").forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.getAttribute("data-spec") || "";
      specFilter = value === "All" ? "" : value;
      renderDoctors();
      renderSpecFilters(doctors);
    });
  });
};

const renderDoctors = () => {
  if (!doctorGridEl) return;

  const filtered = doctors.filter((doctor) => {
    const specialization = String(doctor.specialization || "");
    const matchesSpec = !specFilter || specFilter === specialization;
    const blob = `${doctor.name || ""} ${doctor.email || ""} ${specialization}`.toLowerCase();
    const matchesSearch = !searchText || blob.includes(searchText);
    return matchesSpec && matchesSearch;
  });

  if (!filtered.length) {
    doctorGridEl.innerHTML = '<div class="card"><div class="muted">No doctors found for current filters.</div></div>';
    return;
  }

  doctorGridEl.innerHTML = filtered
    .map((doctor) => {
      const id = getDoctorId(doctor);
      const createdAt = new Date(doctor.createdAt);
      const createdText = Number.isNaN(createdAt.getTime()) ? "-" : createdAt.toLocaleString();
      const ratingVal = Number(doctor.rating || 0).toFixed(1);
      const reviewsCount = Number(doctor.reviewCount || 0);
      const expYears = Number(doctor.experienceYears || 0);
      const isTerminated = !!doctor.isTerminated;
      const avatarText = initials(doctor.name);

      let statusBadgeHtml = '<span class="badge badge-green">Active</span>';
      if (isTerminated) {
        statusBadgeHtml = '<span class="badge badge-red">Terminated</span>';
      } else if (!doctor.isActive) {
        statusBadgeHtml = '<span class="badge badge-yellow">Inactive</span>';
      }

      return `
        <div class="doctor-card">
          <div class="doc-avatar">${escapeHtml(avatarText)}</div>
          <div style="font-weight:700;font-size:1rem;color:var(--text-100)">${escapeHtml(doctor.name)}</div>
          <div style="font-size:.82rem;color:var(--blue);font-weight:600;margin-top:2px;">⭐ ${ratingVal} / 5.0 <span style="color:var(--text-500);font-weight:400;">(${reviewsCount} reviews)</span></div>
          <div style="font-size:.8rem;color:var(--text-400);margin-top:4px">${escapeHtml(doctor.specialization || "General Healthcare")} | ${expYears} yrs exp</div>
          <div style="font-size:.78rem;color:var(--text-500);margin-top:6px">📧 ${escapeHtml(doctor.email || "-")}</div>
          <div style="font-size:.76rem;color:var(--text-500);margin-top:2px">📞 ${escapeHtml(doctor.phone || "-")}</div>
          <div style="margin-top:10px">${statusBadgeHtml}</div>
          <div style="margin-top:12px;font-size:.72rem;color:var(--text-500)">Joined: ${escapeHtml(createdText)}</div>
          <div style="margin-top:12px;display:flex;gap:6px;justify-content:flex-end">
            <button class="btn btn-outline btn-sm" type="button" data-action="edit" data-id="${escapeHtml(id)}">Edit</button>
            ${!isTerminated ? `<button class="btn btn-danger btn-sm" type="button" onclick="terminateDoctor('${escapeHtml(id)}', '${escapeHtml(doctor.name)}')">Terminate</button>` : ''}
          </div>
        </div>`;
    })
    .join("");
};

const renderDoctorReviews = () => {
  if (!reviewListEl) return;

  const scopedDoctorIds = new Set(doctors.map((doctor) => String(getDoctorId(doctor))));
  const filteredReviews = doctorReviews
    .filter((review) => {
      const doctorId = String(review?.doctor?._id || review?.doctor?.id || review?.doctor || "");
      return doctorId && (scopedDoctorIds.size ? scopedDoctorIds.has(doctorId) : true);
    })
    .sort((a, b) => {
      const aTime = new Date(a.ratedAt || a.updatedAt || a.createdAt).getTime() || 0;
      const bTime = new Date(b.ratedAt || b.updatedAt || b.createdAt).getTime() || 0;
      return bTime - aTime;
    });

  if (reviewCountEl) {
    reviewCountEl.textContent = String(filteredReviews.length);
  }

  if (!filteredReviews.length) {
    reviewListEl.innerHTML = '<div class="muted">No doctor reviews yet.</div>';
    return;
  }

  reviewListEl.innerHTML = filteredReviews
    .slice(0, 30)
    .map((review) => {
      const doctorName = review?.doctor?.name || "Doctor";
      const patientName = review?.patient?.name || "Patient";
      const rating = Number(review?.doctorRating || 0);
      const stars = renderStars(rating);
      const note = String(review?.doctorReview || "").trim();
      const consultationType =
        String(review?.consultationType || "").toLowerCase() === "video"
          ? "Video Consultation"
          : "In-person";
      const reviewedAt = formatDateTime(review?.ratedAt || review?.updatedAt || review?.createdAt);

      return `
        <div class="review-item">
          <div class="review-item-head">
            <div>
              <div style="font-size:.82rem;font-weight:700;color:var(--text-100)">${escapeHtml(doctorName)}</div>
              <div class="review-meta">${escapeHtml(consultationType)}</div>
            </div>
            <span class="badge badge-yellow">${escapeHtml(`${rating}/5`)}</span>
          </div>
          <div class="review-stars">${escapeHtml(stars)}</div>
          <div class="review-note">${escapeHtml(note || "No written review")}</div>
          <div class="review-meta">Patient: ${escapeHtml(patientName)} | ${escapeHtml(reviewedAt)}</div>
        </div>`;
    })
    .join("");
};

const resetForm = () => {
  editingDoctorId = null;
  if (doctorFormEl) doctorFormEl.reset();
  if (doctorExperienceEl) doctorExperienceEl.value = "0";
  if (modalTitleEl) modalTitleEl.textContent = "Create Doctor Account";
  if (submitBtnEl) submitBtnEl.textContent = "Create Doctor";
  if (passwordInputEl) {
    passwordInputEl.required = true;
    passwordInputEl.value = "";
  }
  if (passwordHintEl) passwordHintEl.textContent = "Minimum 6 characters";
  if (statusGroupEl) statusGroupEl.style.display = "none";
  if (statusInputEl) statusInputEl.value = "true";
};

const setEditForm = (doctor) => {
  editingDoctorId = getDoctorId(doctor);
  if (modalTitleEl) modalTitleEl.textContent = "Edit Doctor Account";
  if (submitBtnEl) submitBtnEl.textContent = "Save Changes";
  if (passwordInputEl) {
    passwordInputEl.required = false;
    passwordInputEl.value = "";
  }
  if (passwordHintEl) passwordHintEl.textContent = "Leave blank to keep the current password";
  if (statusGroupEl) statusGroupEl.style.display = "block";
  if (statusInputEl) statusInputEl.value = doctor.isActive ? "true" : "false";

  if (doctorNameEl) doctorNameEl.value = doctor.name || "";
  if (doctorEmailEl) doctorEmailEl.value = doctor.email || "";
  if (doctorSpecializationEl) {
    const spec = doctor.specialization || "";
    if (spec) {
      const exists = Array.from(doctorSpecializationEl.options).some((opt) => opt.value.toLowerCase() === spec.toLowerCase());
      if (!exists) {
        const opt = document.createElement("option");
        opt.value = spec;
        opt.textContent = spec;
        doctorSpecializationEl.appendChild(opt);
      }
    }
    doctorSpecializationEl.value = spec;
  }
  if (doctorPhoneEl) doctorPhoneEl.value = doctor.phone || "";
  if (doctorExperienceEl) doctorExperienceEl.value = String(doctor.experienceYears ?? 0);
};

window.openDoctorModal = function openDoctorModal() {
  resetForm();
  if (modalEl) modalEl.classList.remove("hidden");
};

window.closeDoctorModal = function closeDoctorModal() {
  if (modalEl) modalEl.classList.add("hidden");
  resetForm();
};

window.openEditDoctorModal = function openEditDoctorModal(doctorId) {
  const doctor = doctors.find((item) => getDoctorId(item) === doctorId);
  if (!doctor) {
    toast("Doctor details not found", "error");
    return;
  }
  setEditForm(doctor);
  if (modalEl) modalEl.classList.remove("hidden");
};

const loadDoctors = async () => {
  const [doctorsResult, reviewsResult] = await Promise.allSettled([
    apiRequest("/api/admin/doctors"),
    apiRequest("/api/admin/doctor-reviews?limit=80")
  ]);

  doctors = doctorsResult.status === "fulfilled" ? doctorsResult.value.doctors || [] : [];
  doctorReviews = reviewsResult.status === "fulfilled" ? reviewsResult.value.reviews || [] : [];

  if (doctorsResult.status === "rejected") {
    throw doctorsResult.reason;
  }
  if (reviewsResult.status === "rejected") {
    toast(reviewsResult.reason?.message || "Doctor reviews could not be loaded", "warn");
  }

  setStats(doctors);
  renderSpecFilters(doctors);
  renderDoctors();
  renderDoctorReviews();
};

window.reloadDoctors = async function reloadDoctors() {
  try {
    await loadDoctors();
    toast("Doctor list refreshed", "success");
  } catch (error) {
    toast(error.message, "error");
  }
};

const onGridClick = (event) => {
  const button = event.target.closest("button[data-action='edit'][data-id]");
  if (!button) return;
  window.openEditDoctorModal(button.getAttribute("data-id"));
};

const onSubmitDoctor = async (event) => {
  event.preventDefault();
  const isEdit = Boolean(editingDoctorId);

  const name = String(doctorNameEl?.value || "").trim();
  const email = String(doctorEmailEl?.value || "").trim();
  const specialization = String(doctorSpecializationEl?.value || "").trim();
  const phone = String(doctorPhoneEl?.value || "").trim();
  const experienceYears = Number(doctorExperienceEl?.value || 0);
  const password = String(passwordInputEl?.value || "").trim();

  if (!name || !email || !specialization) {
    toast("Name, email and specialization are required", "error");
    return;
  }
  if (!isEdit && password.length < 6) {
    toast("Password must be at least 6 characters", "error");
    return;
  }

  if (submitBtnEl) {
    submitBtnEl.disabled = true;
    submitBtnEl.textContent = isEdit ? "Saving..." : "Creating...";
  }

  try {
    if (isEdit) {
      const payload = {
        name,
        email,
        specialization,
        phone,
        experienceYears,
        isActive: statusInputEl?.value === "true"
      };
      if (password) payload.password = password;

      await apiRequest(`/api/admin/doctors/${editingDoctorId}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      toast("Doctor details updated successfully", "success");
    } else {
      await apiRequest("/api/admin/doctors", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          specialization,
          phone,
          experienceYears,
          password
        })
      });
      toast("Doctor account created successfully", "success");
    }

    window.closeDoctorModal();
    await loadDoctors();
  } catch (error) {
    toast(error.message, "error");
  } finally {
    if (submitBtnEl) {
      submitBtnEl.disabled = false;
      submitBtnEl.textContent = isEdit ? "Save Changes" : "Create Doctor";
    }
  }
};

const init = async () => {
  const session = ensureSession({
    allowedRoles: ["admin"],
    onDenied: () => toast("Admin login required", "error")
  });
  if (!session.allowed) return;

  if (searchInputEl) {
    searchInputEl.addEventListener("input", (event) => {
      searchText = String(event.target.value || "").trim().toLowerCase();
      renderDoctors();
    });
  }
  if (doctorGridEl) {
    doctorGridEl.addEventListener("click", onGridClick);
  }
  if (modalEl) {
    modalEl.addEventListener("click", (event) => {
      if (event.target === modalEl) {
        window.closeDoctorModal();
      }
    });
  }
  if (doctorFormEl) {
    doctorFormEl.addEventListener("submit", onSubmitDoctor);
  }

  resetForm();
  try {
    await loadDoctors();
  } catch (error) {
    toast(error.message, "error");
  }
};

window.terminateDoctor = async function (doctorId, doctorName) {
  if (!confirm(`Are you sure you want to terminate & deactivate Dr. ${doctorName}?`)) return;

  try {
    const res = await apiRequest(`/api/admin/doctors/${doctorId}/terminate`, "PATCH");
    if (res.success) {
      toast(`Dr. ${doctorName} terminated successfully`, "success");
      await loadDoctors();
    }
  } catch (err) {
    toast(err.message || "Failed to terminate doctor", "error");
  }
};

init();

