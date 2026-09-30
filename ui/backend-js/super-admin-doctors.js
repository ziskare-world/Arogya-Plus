import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession } from "../js/api-client.js";

window.toast = toast;
injectSidebar("doctors.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Medical Staff");

const gridEl = document.getElementById("doc-grid");

let allDoctors = [];
let registeredHospitals = [];
let specFilter = "";
let searchFilter = "";

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const initials = (name = "Doctor") =>
  String(name)
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "DR";

const statValueEl = (index, value) => {
  const els = document.querySelectorAll(".stat-grid .stat-card .stat-value");
  if (els[index]) els[index].textContent = String(value);
};

const renderStats = (list) => {
  const onlineCount = list.filter((doctor) => doctor.isActive).length;
  const specs = new Set(list.map((doctor) => String(doctor.specialization || "General").trim()).filter(Boolean));
  const avgRating = list.length
    ? (
        list.reduce((sum, doctor) => {
          const completed = Number(doctor.completedConsults || 0);
          const total = Number(doctor.totalConsults || completed || 1);
          return sum + (4.2 + Math.min(0.8, completed / Math.max(total, 1)));
        }, 0) / list.length
      ).toFixed(1)
    : "0.0";

  statValueEl(0, list.length);
  statValueEl(1, onlineCount);
  statValueEl(2, avgRating);
  statValueEl(3, specs.size);

  const subtitle = document.querySelector(".page-header p");
  if (subtitle) {
    subtitle.textContent = `${list.length} doctors registered · ${onlineCount} currently online`;
  }
};

const renderDoctors = () => {
  if (!gridEl) return;

  const data = allDoctors.filter((doctor) => {
    const specialization = String(doctor.specialization || "General");
    const matchesSpec = !specFilter || specialization.toLowerCase().includes(specFilter.toLowerCase());
    const blob = `${doctor.name || ""} ${doctor.email || ""} ${specialization} ${doctor.hospitalName || ""}`.toLowerCase();
    const matchesSearch = !searchFilter || blob.includes(searchFilter);
    return matchesSpec && matchesSearch;
  });

  if (!data.length) {
    gridEl.innerHTML = '<div class="card" style="padding:24px;text-align:center"><div class="muted">No doctors found for current filters.</div></div>';
    return;
  }

  gridEl.innerHTML = data
    .map((doctor) => {
      const specialization = doctor.specialization || "General";
      const hospital = doctor.hospitalName || "General Healthcare";
      const expYears = Math.max(1, new Date().getFullYear() - new Date(doctor.createdAt || Date.now()).getFullYear());
      const patientCount = Number(doctor.totalPatients || 0) || Math.floor(Math.random() * 70 + 40);
      const rating = 4.2 + Math.min(0.8, patientCount / 150);

      const docId = String(doctor._id || doctor.id || "");
      const isBlocked = doctor.isActive === false;

      return `
        <div class="doctor-card" data-doctor-id="${escapeHtml(docId)}">
          <div class="doc-avatar" style="background:${!isBlocked ? "rgba(37,99,235,0.15)" : "rgba(239,68,68,0.15)"};border-color:${!isBlocked ? "var(--green)" : "var(--red)"}">${escapeHtml(initials(doctor.name))}</div>
          <div style="font-weight:700;font-size:.95rem;color:var(--text-100)">${escapeHtml(doctor.name || "Unknown Doctor")}</div>
          <div style="font-size:.8rem;color:var(--cyan);font-weight:600;margin-top:2px">${escapeHtml(specialization)}</div>
          <div style="font-size:.76rem;color:var(--text-400);margin-top:2px">🏥 ${escapeHtml(hospital)}</div>
          <div style="font-size:.68rem;color:var(--text-500);font-family:monospace;margin-top:3px">ID: ${escapeHtml(docId)}</div>
          <div style="margin-top:6px">
            ${!isBlocked ? '<span class="badge badge-green">🟢 Active</span>' : '<span class="badge badge-red">🚫 Access Blocked</span>'}
          </div>
          <div class="doc-stat">
            <div><div class="ds-val">${expYears} yrs</div><div class="ds-lbl">Experience</div></div>
            <div><div class="ds-val">${patientCount}</div><div class="ds-lbl">Patients</div></div>
          </div>
          <div style="display:flex;gap:6px;margin-top:14px">
            <button class="btn btn-outline btn-sm" style="flex:1;font-size:.75rem;color:${!isBlocked ? 'var(--yellow)' : 'var(--green)'};border-color:${!isBlocked ? 'var(--yellow)' : 'var(--green)'}" onclick="window.toggleDoctorAccess('${docId}', ${!isBlocked}, '${escapeHtml(doctor.name)}')">
              ${!isBlocked ? '🚫 Block Access' : '✅ Unblock Access'}
            </button>
            <button class="btn btn-outline btn-sm" style="font-size:.75rem;color:var(--red);border-color:var(--red)" onclick="window.openDeleteDoctorModal('${docId}', '${escapeHtml(doctor.name)}')">
              🗑️ Delete
            </button>
          </div>
          <button class="btn btn-ghost btn-full btn-sm" style="margin-top:6px;font-size:.74rem" onclick="window.openDoctorDetailsModal('${docId}')">View Details</button>
        </div>`;
    })
    .join("");
};

window.filterDocs = function filterDocs(value) {
  searchFilter = String(value || "").trim().toLowerCase();
  renderDoctors();
};

window.filterSpec = function filterSpec(spec, button) {
  specFilter = String(spec || "").trim();
  document.querySelectorAll("#spec-filters .btn").forEach((btn) => btn.classList.remove("active"));
  if (button) button.classList.add("active");
  renderDoctors();
};

const loadHospitals = async () => {
  try {
    const res = await apiRequest("/api/admin/admins");
    const admins = res.admins || [];
    const hospitalSet = new Map();

    admins.forEach((admin) => {
      const name = String(admin.hospitalName || "").trim();
      if (name && !hospitalSet.has(name.toLowerCase())) {
        hospitalSet.set(name.toLowerCase(), name);
      }
    });

    registeredHospitals = Array.from(hospitalSet.values());

    const selectEl = document.getElementById("doc-hospital");
    if (selectEl) {
      if (registeredHospitals.length > 0) {
        selectEl.innerHTML = registeredHospitals
          .map((h) => `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`)
          .join("");
      } else {
        selectEl.innerHTML = `<option value="Arogya Plus General Hospital">Arogya Plus General Hospital</option>`;
      }
    }
  } catch (err) {
    console.warn("Failed to load hospitals for dropdown:", err);
  }
};

const loadDoctors = async () => {
  const data = await apiRequest("/api/admin/users");
  allDoctors = (data.users || []).filter((user) => user.role === "doctor");
  renderStats(allDoctors);
  renderDoctors();
};

window.openAddDoctorModal = function openAddDoctorModal() {
  const modal = document.getElementById("add-doctor-modal");
  if (modal) {
    loadHospitals();
    modal.style.display = "flex";
  }
};

window.closeAddDoctorModal = function closeAddDoctorModal() {
  const modal = document.getElementById("add-doctor-modal");
  if (modal) modal.style.display = "none";
};

const setupModalEvents = () => {
  const openBtn = document.getElementById("open-add-doctor-modal-btn");
  const modal = document.getElementById("add-doctor-modal");
  const closeBtn = document.getElementById("close-doctor-modal-btn");
  const cancelBtn = document.getElementById("cancel-doctor-modal-btn");
  const form = document.getElementById("add-doctor-form");

  if (openBtn) {
    openBtn.addEventListener("click", window.openAddDoctorModal);
  }

  if (closeBtn) closeBtn.addEventListener("click", window.closeAddDoctorModal);
  if (cancelBtn) cancelBtn.addEventListener("click", window.closeAddDoctorModal);

  const docHospitalSelect = document.getElementById("doc-hospital");
  const docPhoneInput = document.getElementById("doc-phone");

  if (docHospitalSelect) {
    docHospitalSelect.addEventListener("change", async () => {
      const selectedHospital = docHospitalSelect.value.trim();
      if (!selectedHospital) return;

      try {
        const results = await window.ArogyaGeo.geocodeAddress(selectedHospital);
        if (results && results.length > 0 && results[0].phone && docPhoneInput) {
          docPhoneInput.value = results[0].phone;
        } else if (docPhoneInput) {
          docPhoneInput.value = ""; // Leave blank if not available on the internet
        }
      } catch (err) {
        if (docPhoneInput) docPhoneInput.value = "";
      }
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const submitBtn = document.getElementById("submit-doctor-btn");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Creating...";
      }

      const payload = {
        name: document.getElementById("doc-name").value.trim(),
        email: document.getElementById("doc-email").value.trim(),
        password: document.getElementById("doc-password").value,
        specialization: document.getElementById("doc-spec").value,
        hospitalName: document.getElementById("doc-hospital").value,
        phone: document.getElementById("doc-phone").value.trim(),
        clinicAddress: document.getElementById("doc-clinic").value.trim()
      };

      try {
        await apiRequest("/api/admin/doctors", {
          method: "POST",
          body: JSON.stringify(payload)
        });

        toast("Doctor account created successfully and assigned to hospital", "success");
        window.closeAddDoctorModal();
        form.reset();
        await loadDoctors();
      } catch (err) {
        toast(err.message || "Failed to create doctor account", "error");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Create Doctor Account";
        }
      }
    });
  }
};

let doctorToDelete = null;

window.toggleDoctorAccess = async (doctorId, currentActive, doctorName) => {
  const nextActive = !currentActive;
  const actionText = nextActive ? "restore access for" : "BLOCK access for";
  if (!confirm(`Are you sure you want to ${actionText} Dr. ${doctorName}?`)) {
    return;
  }

  try {
    const res = await apiRequest(`/api/admin/users/${doctorId}/toggle-active`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: nextActive })
    });
    toast(res.message || "Doctor access updated", "success");
    await loadDoctors();
  } catch (err) {
    toast(err.message || "Failed to update doctor access", "error");
  }
};

window.openDeleteDoctorModal = (doctorId, doctorName) => {
  doctorToDelete = { id: doctorId, name: doctorName };
  const modal = document.getElementById("delete-doctor-modal");
  const nameText = document.getElementById("delete-doc-name-text");
  const idText = document.getElementById("delete-doc-id-text");
  if (nameText) nameText.textContent = doctorName;
  if (idText) idText.textContent = doctorId;
  if (modal) modal.style.display = "flex";
};

window.closeDeleteDoctorModal = () => {
  doctorToDelete = null;
  const modal = document.getElementById("delete-doctor-modal");
  if (modal) modal.style.display = "none";
};

const setupDeleteDoctorEvents = () => {
  const confirmBtn = document.getElementById("confirm-delete-doctor-btn");
  if (confirmBtn) {
    confirmBtn.addEventListener("click", async () => {
      if (!doctorToDelete) return;
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Deleting...";

      try {
        const res = await apiRequest(`/api/admin/doctors/${doctorToDelete.id}`, {
          method: "DELETE"
        });
        toast(res.message || "Doctor deleted successfully", "success");
        window.closeDeleteDoctorModal();
        await loadDoctors();
      } catch (err) {
        toast(err.message || "Failed to delete doctor", "error");
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Delete Doctor";
      }
    });
  }
};

window.openDoctorDetailsModal = async (doctorId) => {
  const modal = document.getElementById("view-doctor-modal");
  const bodyEl = document.getElementById("doctor-details-body");
  const actionsEl = document.getElementById("doctor-modal-actions");
  const titleEl = document.getElementById("vdoc-title");

  if (modal) modal.style.display = "flex";
  if (bodyEl) {
    bodyEl.innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:var(--text-400)">
        <div style="font-size:2rem;margin-bottom:8px">⏳</div>
        <div>Loading doctor clinical record & profile...</div>
      </div>`;
  }
  if (actionsEl) actionsEl.innerHTML = "";

  try {
    const res = await apiRequest(`/api/admin/doctors/${doctorId}`);
    if (!res.success || !res.doctor) {
      throw new Error(res.message || "Failed to load doctor profile");
    }

    const doc = res.doctor;
    const isBlocked = doc.isActive === false;
    const stats = doc.stats || {};
    const recent = doc.recentAppointments || [];
    const rating = Number(doc.rating || 4.9).toFixed(1);
    const reviews = Number(doc.reviewCount || 18);

    if (titleEl) titleEl.textContent = `Dr. ${doc.name} - Profile Details`;

    if (bodyEl) {
      bodyEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:18px;background:var(--bg-800);border:1px solid var(--border);border-radius:var(--r-md);padding:18px;margin-bottom:18px">
          <div class="doc-avatar" style="width:68px;height:68px;font-size:28px;margin:0;background:${!isBlocked ? "rgba(37,99,235,0.15)" : "rgba(239,68,68,0.15)"};border-color:${!isBlocked ? "var(--green)" : "var(--red)"}">
            ${escapeHtml(initials(doc.name))}
          </div>
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <h3 style="margin:0;font-size:1.2rem;color:var(--text-100)">${escapeHtml(doc.name)}</h3>
              ${!isBlocked ? '<span class="badge badge-green">🟢 Active & Online</span>' : '<span class="badge badge-red">🚫 Access Blocked</span>'}
              ${doc.isAvailable !== false ? '<span class="badge badge-blue">Available</span>' : '<span class="badge badge-yellow">Offline</span>'}
            </div>
            <div style="font-size:.85rem;color:var(--cyan);font-weight:600;margin-top:2px">
              ${escapeHtml(doc.specialization || "Clinical Specialist")} · <span style="color:var(--text-400);font-weight:400">${escapeHtml(doc.qualification || "MBBS, MD")}</span>
            </div>
            <div style="font-size:.76rem;color:var(--text-400);margin-top:4px;display:flex;gap:16px;flex-wrap:wrap">
              <span>🏥 ${escapeHtml(doc.hospitalName || "General Healthcare")}</span>
              <span>⭐ ${rating} / 5.0 (${reviews} reviews)</span>
              <span>🆔 <code style="color:var(--cyan)">${escapeHtml(doc._id)}</code></span>
            </div>
          </div>
        </div>

        <!-- Metrics Grid -->
        <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:12px;margin-bottom:18px">
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px;text-align:center">
            <div style="font-size:1.25rem;font-weight:700;color:var(--blue)">${stats.totalAppointments ?? 0}</div>
            <div style="font-size:.68rem;color:var(--text-500);text-transform:uppercase;margin-top:2px">Total Consults</div>
          </div>
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px;text-align:center">
            <div style="font-size:1.25rem;font-weight:700;color:var(--green)">${stats.completedAppointments ?? 0}</div>
            <div style="font-size:.68rem;color:var(--text-500);text-transform:uppercase;margin-top:2px">Completed</div>
          </div>
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px;text-align:center">
            <div style="font-size:1.25rem;font-weight:700;color:var(--cyan)">${stats.totalPatients ?? 0}</div>
            <div style="font-size:.68rem;color:var(--text-500);text-transform:uppercase;margin-top:2px">Patients</div>
          </div>
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px;text-align:center">
            <div style="font-size:1.25rem;font-weight:700;color:var(--yellow)">₹${doc.consultationFee ?? 500}</div>
            <div style="font-size:.68rem;color:var(--text-500);text-transform:uppercase;margin-top:2px">Consult Fee</div>
          </div>
        </div>

        <!-- Information Columns -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:16px;margin-bottom:18px">
          <div>
            <div style="font-size:.72rem;color:var(--text-500);text-transform:uppercase;font-weight:600">Contact & Location</div>
            <div style="font-size:.84rem;color:var(--text-200);margin-top:6px">📧 <strong>Email:</strong> ${escapeHtml(doc.email || "-")}</div>
            <div style="font-size:.84rem;color:var(--text-200);margin-top:4px">📞 <strong>Phone:</strong> ${escapeHtml(doc.phone || "-")}</div>
            <div style="font-size:.84rem;color:var(--text-200);margin-top:4px">🏢 <strong>Clinic/OPD:</strong> ${escapeHtml(doc.clinicAddress || "Main OPD")}</div>
          </div>
          <div>
            <div style="font-size:.72rem;color:var(--text-500);text-transform:uppercase;font-weight:600">Practice & Credentials</div>
            <div style="font-size:.84rem;color:var(--text-200);margin-top:6px">🎓 <strong>Qualification:</strong> ${escapeHtml(doc.qualification || "MBBS, MD")}</div>
            <div style="font-size:.84rem;color:var(--text-200);margin-top:4px">⏳ <strong>Experience:</strong> ${doc.experienceYears || doc.experience || 0} Years</div>
            <div style="font-size:.84rem;color:var(--text-200);margin-top:4px">📅 <strong>Joined Platform:</strong> ${new Date(doc.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}</div>
          </div>
        </div>

        <!-- Recent Appointments Table -->
        <div>
          <div style="font-size:.82rem;font-weight:700;color:var(--text-200);margin-bottom:8px">📋 Recent Consultations</div>
          ${
            recent.length
              ? `
            <div class="table-wrap" style="border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden">
              <table style="width:100%;font-size:.8rem;border-collapse:collapse">
                <thead>
                  <tr style="background:var(--bg-800);border-bottom:1px solid var(--border)">
                    <th style="padding:8px 12px;text-align:left">Patient</th>
                    <th style="padding:8px 12px;text-align:left">Date & Time</th>
                    <th style="padding:8px 12px;text-align:left">Reason</th>
                    <th style="padding:8px 12px;text-align:left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${recent
                    .map(
                      (apt) => `
                    <tr style="border-bottom:1px solid var(--border)">
                      <td style="padding:8px 12px">
                        <strong>${escapeHtml(apt.patient?.name || "Patient")}</strong>
                        <div style="font-size:.72rem;color:var(--text-500)">${escapeHtml(apt.patient?.phone || "")}</div>
                      </td>
                      <td style="padding:8px 12px">${new Date(apt.appointmentDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</td>
                      <td style="padding:8px 12px;color:var(--text-400)">${escapeHtml(apt.reason || "General Consultation")}</td>
                      <td style="padding:8px 12px">
                        <span class="badge ${apt.status === "completed" ? "badge-green" : apt.status === "cancelled" ? "badge-red" : "badge-blue"}">
                          ${escapeHtml(apt.status)}
                        </span>
                      </td>
                    </tr>`
                    )
                    .join("")}
                </tbody>
              </table>
            </div>`
              : `<div style="font-size:.8rem;color:var(--text-500);padding:14px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);text-align:center">No consultation records recorded yet for this doctor.</div>`
          }
        </div>
      `;
    }

    if (actionsEl) {
      actionsEl.innerHTML = `
        <button class="btn btn-outline btn-sm" style="color:${!isBlocked ? 'var(--yellow)' : 'var(--green)'};border-color:${!isBlocked ? 'var(--yellow)' : 'var(--green)'}" onclick="window.toggleDoctorAccess('${doc._id}', ${!isBlocked}, '${escapeHtml(doc.name)}');window.closeDoctorDetailsModal();">
          ${!isBlocked ? '🚫 Block Access' : '✅ Unblock Access'}
        </button>
        <button class="btn btn-outline btn-sm" style="color:var(--red);border-color:var(--red)" onclick="window.closeDoctorDetailsModal();window.openDeleteDoctorModal('${doc._id}', '${escapeHtml(doc.name)}');">
          🗑️ Delete Doctor
        </button>
      `;
    }
  } catch (err) {
    if (bodyEl) {
      bodyEl.innerHTML = `
        <div style="text-align:center;padding:30px;color:var(--red)">
          <div>⚠️ Failed to load doctor details: ${escapeHtml(err.message)}</div>
        </div>`;
    }
  }
};

window.closeDoctorDetailsModal = () => {
  const modal = document.getElementById("view-doctor-modal");
  if (modal) modal.style.display = "none";
};

const init = async () => {
  const session = ensureSession({
    allowedRoles: ["super-admin"],
    onDenied: () => toast("Please login as super admin", "error")
  });
  if (!session.allowed) return;

  setupModalEvents();
  setupDeleteDoctorEvents();

  try {
    await loadDoctors();
    await loadHospitals();
  } catch (error) {
    toast(error.message, "error");
    allDoctors = [];
    renderStats([]);
    renderDoctors();
  }
};

init();
