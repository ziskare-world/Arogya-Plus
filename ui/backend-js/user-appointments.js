import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession, formatDateTime } from "../js/api-client.js";

window.toast = toast;
injectSidebar("appointments.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("My Appointments");

const modal = document.getElementById("book-modal");
const bookForm = document.getElementById("book-form");
const submitBtn = document.getElementById("book-submit-btn");
const doctorSelect = document.getElementById("doctor-id");
const consultationTypeSelect = document.getElementById("appointment-consultation-type");
const listEl = document.getElementById("appt-list");
const ratingModalEl = document.getElementById("rating-modal");
const ratingDoctorLabelEl = document.getElementById("rating-modal-doctor");
const ratingReviewInputEl = document.getElementById("rating-review-input");
const ratingSubmitBtnEl = document.getElementById("rating-submit-btn");
const ratingStarsEl = document.getElementById("rating-stars");
const ratingValueLabelEl = document.getElementById("rating-value-label");

let doctors = [];
let appointments = [];
let ratingModalAppointmentId = "";
let ratingModalSelectedValue = 5;
let ratingModalSubmitting = false;

const statusBadge = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "confirmed") return '<span class="badge badge-green">Confirmed</span>';
  if (normalized === "completed") return '<span class="badge badge-blue">Completed</span>';
  if (normalized === "cancelled") return '<span class="badge badge-red">Cancelled</span>';
  return '<span class="badge badge-yellow">Pending</span>';
};

const consultationTypeDetails = (appointment) => {
  const normalized = String(appointment?.consultationType || "").toLowerCase();
  if (normalized === "video") {
    return { value: "video", label: "Video Consultancy" };
  }
  if (normalized === "in_person") {
    return { value: "in_person", label: "In-Person" };
  }

  const text = `${appointment?.reason || ""} ${appointment?.notes || ""}`.toLowerCase();
  if (text.includes("video") || text.includes("tele")) {
    return { value: "video", label: "Video Consultancy" };
  }

  return { value: "in_person", label: "In-Person" };
};

const findAppointmentRecord = (appointmentId = "") =>
  appointments.find((item) => String(item?._id || item?.id || "") === String(appointmentId)) || null;

const normalizeId = (value = "") => String(value || "").trim();

const renderRatingStars = () => {
  if (!ratingStarsEl) return;
  const starButtons = Array.from(ratingStarsEl.querySelectorAll("button[data-value]"));
  starButtons.forEach((button) => {
    const value = Number(button.getAttribute("data-value") || 0);
    button.classList.toggle("active", value <= ratingModalSelectedValue);
    button.setAttribute("aria-checked", value === ratingModalSelectedValue ? "true" : "false");
  });
  if (ratingValueLabelEl) {
    ratingValueLabelEl.textContent = `${ratingModalSelectedValue}/5`;
  }
};

const closeRatingModal = () => {
  if (ratingModalSubmitting) return;
  ratingModalAppointmentId = "";
  ratingModalSelectedValue = 5;
  if (ratingReviewInputEl) ratingReviewInputEl.value = "";
  renderRatingStars();
  if (ratingModalEl) ratingModalEl.classList.add("hidden");
};

const openRatingModal = (appointment) => {
  const appointmentId = normalizeId(appointment?._id || appointment?.id);
  if (!appointmentId) {
    toast("Appointment ID is missing", "error");
    return;
  }

  ratingModalAppointmentId = appointmentId;
  const doctorName = String(appointment?.doctor?.name || "Doctor").trim();
  if (ratingDoctorLabelEl) {
    ratingDoctorLabelEl.textContent = `Rate your consultation with ${doctorName}`;
  }
  ratingModalSelectedValue = 5;
  if (ratingReviewInputEl) ratingReviewInputEl.value = "";
  renderRatingStars();
  if (ratingModalEl) ratingModalEl.classList.remove("hidden");
};

const submitRatingFromModal = async () => {
  const appointmentId = normalizeId(ratingModalAppointmentId);
  if (!appointmentId) return;
  if (!Number.isInteger(ratingModalSelectedValue) || ratingModalSelectedValue < 1 || ratingModalSelectedValue > 5) {
    toast("Please select a rating from 1 to 5", "error");
    return;
  }

  const review = String(ratingReviewInputEl?.value || "").trim();

  try {
    ratingModalSubmitting = true;
    if (ratingSubmitBtnEl) {
      ratingSubmitBtnEl.disabled = true;
      ratingSubmitBtnEl.textContent = "Submitting...";
    }

    await apiRequest(`/api/appointments/${appointmentId}/rating`, {
      method: "PATCH",
      body: JSON.stringify({
        rating: ratingModalSelectedValue,
        review
      })
    });

    toast("Doctor rating submitted", "success");
    closeRatingModal();
    window.setTimeout(() => {
      window.location.reload();
    }, 600);
    return;
  } catch (error) {
    toast(error.message || "Failed to submit rating", "error");
  } finally {
    ratingModalSubmitting = false;
    if (ratingSubmitBtnEl) {
      ratingSubmitBtnEl.disabled = false;
      ratingSubmitBtnEl.textContent = "Submit Rating";
    }
  }
};

const openUserVideoPanel = (appointment) => {
  const appointmentId = String(appointment?._id || appointment?.id || "").trim();
  if (!appointmentId) {
    toast("Appointment ID is missing", "error");
    return;
  }

  const params = new URLSearchParams({ role: "user", appointmentId });
  const doctorName = String(appointment?.doctor?.name || "").trim();
  if (doctorName) {
    params.set("doctor", doctorName);
  }

  const popup = window.open(
    `/user/video-consultation?${params.toString()}`,
    "_blank",
    "noopener,noreferrer,width=1280,height=840"
  );

  if (!popup) {
    toast("Popup blocked. Please allow popups and retry.", "error");
  }
};

const renderDoctorOptions = () => {
  if (!doctorSelect) return;

  if (!doctors.length) {
    doctorSelect.innerHTML = '<option value="">No doctors available</option>';
    return;
  }

  doctorSelect.innerHTML = doctors
    .map((doctor) => {
      const spec = doctor.specialization ? ` - ${doctor.specialization}` : "";
      return `<option value="${doctor._id}">${doctor.name}${spec}</option>`;
    })
    .join("");
};

const qrModalEl = document.getElementById("qr-modal");
const qrTokenLabelEl = document.getElementById("qr-token-label");
const qrDoctorLabelEl = document.getElementById("qr-doctor-label");
const qrCodeImgEl = document.getElementById("qr-code-img");

const closeQrModal = () => {
  if (qrModalEl) qrModalEl.classList.add("hidden");
};

const openQrModal = async (appointmentId) => {
  const appointment = findAppointmentRecord(appointmentId);
  if (!appointment) {
    toast("Appointment details not found", "error");
    return;
  }

  try {
    const data = await apiRequest(`/api/appointments/${appointmentId}/token-qr`);
    if (qrTokenLabelEl) qrTokenLabelEl.textContent = data.tokenNumber || appointment.tokenNumber || "APT-PASS";
    if (qrDoctorLabelEl) qrDoctorLabelEl.textContent = `Check-in Token for Dr. ${appointment.doctor?.name || "Assigned Doctor"}`;
    if (qrCodeImgEl) qrCodeImgEl.src = data.qrDataUrl || "";
    if (qrModalEl) qrModalEl.classList.remove("hidden");
  } catch (error) {
    toast(error.message || "Failed to load check-in QR pass", "error");
  }
};

window.closeQrModal = closeQrModal;

if (qrModalEl) {
  qrModalEl.addEventListener("click", (event) => {
    if (event.target === qrModalEl) closeQrModal();
  });
}

const renderAppointments = () => {
  if (!listEl) return;

  if (!appointments.length) {
    listEl.innerHTML =
      '<div class="muted" style="padding:8px 0">No appointments found. Book your first appointment.</div>';
    return;
  }

  listEl.innerHTML = appointments
    .map((appointment) => {
      const doctorName = appointment.doctor?.name || "Doctor";
      const status = String(appointment.status || "pending").toLowerCase();
      const consultation = consultationTypeDetails(appointment);
      const subtitleParts = [formatDateTime(appointment.appointmentDate), consultation.label];
      if (appointment.tokenNumber) subtitleParts.push(`Token: ${appointment.tokenNumber}`);
      if (appointment.reason) subtitleParts.push(appointment.reason);
      const existingRating = Number(appointment.doctorRating || 0);
      if (existingRating >= 1 && existingRating <= 5) {
        subtitleParts.push(`Your Rating: ${existingRating}/5`);
      }

      const canJoinVideoCall = consultation.value === "video" && status === "confirmed";
      const canModify = !["completed", "cancelled"].includes(status);
      const canRateDoctor = status === "completed" && !(existingRating >= 1 && existingRating <= 5);
      const canViewQr = status !== "cancelled";

      const actions = [];
      if (canJoinVideoCall) {
        actions.push(
          `<button class="btn btn-primary btn-sm" type="button" data-action="join-video" data-id="${appointment._id}">Join Video Call</button>`
        );
      }
      if (canViewQr) {
        actions.push(
          `<button class="btn btn-outline btn-sm" type="button" data-action="view-qr" data-id="${appointment._id}">View QR Pass</button>`
        );
      }
      if (canRateDoctor) {
        actions.push(
          `<button class="btn btn-success btn-sm" type="button" data-action="rate-doctor" data-id="${appointment._id}">Rate Doctor</button>`
        );
      }
      if (canModify) {
        actions.push(
          `<button class="btn btn-ghost btn-sm" type="button" data-action="reschedule" data-id="${appointment._id}">Reschedule</button>`
        );
        actions.push(
          `<button class="btn btn-outline btn-sm" type="button" data-action="cancel" data-id="${appointment._id}">Cancel</button>`
        );
      }

      return `
        <div style="padding:16px;border:1px solid var(--border);border-radius:12px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <div>
            <div style="font-weight:700">${doctorName}</div>
            <div class="muted">${subtitleParts.join(" - ")}</div>
            <div style="margin-top:8px">${statusBadge(appointment.status)}</div>
          </div>
          <div class="actions-row">
            ${actions.length ? actions.join("") : '<span class="muted">No actions</span>'}
          </div>
        </div>`;
    })
    .join("");
};

const loadDoctors = async () => {
  const data = await apiRequest("/api/auth/doctors");
  doctors = data.doctors || [];
  renderDoctorOptions();
};

const loadAppointments = async () => {
  const data = await apiRequest("/api/appointments/my");
  appointments = data.appointments || [];
  renderAppointments();
};

const openBookModal = () => {
  if (modal) modal.classList.remove("hidden");
};

const closeBookModal = () => {
  if (modal) modal.classList.add("hidden");
  if (bookForm) bookForm.reset();
};

window.openBookModal = openBookModal;
window.closeBookModal = closeBookModal;
window.closeRatingModal = closeRatingModal;

if (modal) {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeBookModal();
    }
  });
}

if (ratingModalEl) {
  ratingModalEl.addEventListener("click", (event) => {
    if (event.target === ratingModalEl) {
      closeRatingModal();
    }
  });
}

if (ratingStarsEl) {
  ratingStarsEl.addEventListener("click", (event) => {
    const starButton = event.target.closest("button[data-value]");
    if (!starButton) return;
    const nextValue = Number(starButton.getAttribute("data-value") || 0);
    if (!Number.isInteger(nextValue) || nextValue < 1 || nextValue > 5) return;
    ratingModalSelectedValue = nextValue;
    renderRatingStars();
  });
}

if (ratingSubmitBtnEl) {
  ratingSubmitBtnEl.addEventListener("click", () => {
    submitRatingFromModal();
  });
}

if (bookForm) {
  bookForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Booking...";
    }

    const parsedDate = new Date(document.getElementById("appointment-date")?.value || "");
    if (Number.isNaN(parsedDate.getTime())) {
      toast("Please select a valid date/time", "error");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Book Appointment";
      }
      return;
    }

    const payload = {
      doctorId: doctorSelect?.value || "",
      appointmentDate: parsedDate.toISOString(),
      consultationType: consultationTypeSelect?.value || "in_person",
      reason: String(document.getElementById("appointment-reason")?.value || "").trim(),
      notes: String(document.getElementById("appointment-notes")?.value || "").trim()
    };

    try {
      await apiRequest("/api/appointments", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      toast("Appointment booked successfully", "success");
      closeBookModal();
      await loadAppointments();
    } catch (error) {
      toast(error.message, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Book Appointment";
      }
    }
  });
}

if (listEl) {
  listEl.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const action = button.getAttribute("data-action");
    const appointmentId = button.getAttribute("data-id");
    if (!appointmentId) return;

    try {
      if (action === "join-video") {
        const appointment = findAppointmentRecord(appointmentId);
        if (!appointment) {
          toast("Appointment details not found", "error");
          return;
        }
        openUserVideoPanel(appointment);
        return;
      }

      if (action === "view-qr") {
        await openQrModal(appointmentId);
        return;
      }

      if (action === "rate-doctor") {
        const appointment = findAppointmentRecord(appointmentId);
        if (!appointment) {
          toast("Appointment details not found", "error");
          return;
        }
        if (String(appointment.status || "").toLowerCase() !== "completed") {
          toast("You can rate only completed consultations", "info");
          return;
        }
        openRatingModal(appointment);
        return;
      }

      if (action === "cancel") {
        const confirmed = window.confirm("Cancel this appointment?");
        if (!confirmed) return;
        await apiRequest(`/api/appointments/${appointmentId}/cancel`, { method: "PATCH" });
        toast("Appointment cancelled", "success");
        await loadAppointments();
        return;
      }

      if (action === "reschedule") {
        const appointment = findAppointmentRecord(appointmentId);
        const defaultDate = appointment?.appointmentDate
          ? new Date(appointment.appointmentDate).toISOString().slice(0, 16)
          : "";
        const newDateInput = window.prompt("Enter new date/time (YYYY-MM-DDTHH:mm)", defaultDate);
        if (!newDateInput) return;

        const parsedDate = new Date(newDateInput);
        if (Number.isNaN(parsedDate.getTime())) {
          toast("Invalid date format. Use YYYY-MM-DDTHH:mm", "error");
          return;
        }

        const reasonInput =
          window.prompt("Update reason (optional)", appointment?.reason || "") || appointment?.reason;

        await apiRequest(`/api/appointments/${appointmentId}/reschedule`, {
          method: "PATCH",
          body: JSON.stringify({
            appointmentDate: parsedDate.toISOString(),
            reason: reasonInput
          })
        });
        toast("Appointment rescheduled", "success");
        await loadAppointments();
      }
    } catch (error) {
      toast(error.message, "error");
    }
  });
}

const init = async () => {
  const session = ensureSession({
    allowedRoles: ["patient"],
    onDenied: () => toast("Please login as user", "error")
  });
  if (!session.allowed) return;

  renderRatingStars();

  try {
    await loadDoctors();
    await loadAppointments();
  } catch (error) {
    toast(error.message, "error");
  }
};

init();
