const express = require("express");
const asyncHandler = require("express-async-handler");
const { body, param, query } = require("express-validator");
const QRCode = require("qrcode");
const Appointment = require("../models/Appointment");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateMiddleware");
const { notifyUser } = require("../utils/pushService");

const router = express.Router();

const generateAppointmentToken = () => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 900 + 100).toString();
  return `APT-${timestamp}-${random}`;
};

const normalizeConsultationType = (value, { reason = "", notes = "" } = {}) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");

  if (normalized === "video") return "video";
  if (normalized === "in_person") return "in_person";

  const legacyText = `${reason} ${notes}`.toLowerCase();
  if (legacyText.includes("video") || legacyText.includes("tele")) {
    return "video";
  }

  return "in_person";
};

const sanitizePatientLocation = (loc, fallbackUser = null) => {
  const address = loc && typeof loc === "object" && typeof loc.address === "string" ? loc.address.trim() : (fallbackUser?.address || "");
  const city = loc && typeof loc === "object" && typeof loc.city === "string" ? loc.city.trim() : (fallbackUser?.city || "");

  const rawCoords = loc && typeof loc === "object" ? loc.coordinates : fallbackUser?.coordinates;
  let cleanCoords = undefined;
  if (rawCoords && typeof rawCoords === "object") {
    const lat = Number(rawCoords.lat !== undefined ? rawCoords.lat : rawCoords.latitude);
    const lng = Number(rawCoords.lng !== undefined ? rawCoords.lng : rawCoords.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      cleanCoords = { lat, lng };
    }
  }

  const result = { address, city };
  if (cleanCoords) {
    result.coordinates = cleanCoords;
  }
  return result;
};

const sanitizePatientDetails = (details, fallbackUser = null) => {
  const name = (details && typeof details === "object" && details.name) || fallbackUser?.name || "Patient";
  const relationship = (details && typeof details === "object" && details.relationship) || "Self";
  const phone = (details && typeof details === "object" && details.phone) || fallbackUser?.phone || "";
  const bloodGroup = (details && typeof details === "object" && details.bloodGroup) || fallbackUser?.bloodGroup || "Unknown";

  const rawAge = details && typeof details === "object" && details.age !== undefined ? details.age : fallbackUser?.age;
  const ageNum = Number(rawAge);
  const age = Number.isFinite(ageNum) && ageNum >= 0 && ageNum <= 130 ? ageNum : undefined;

  const rawGender = String((details && typeof details === "object" && details.gender) || fallbackUser?.gender || "other").trim().toLowerCase();
  const gender = ["male", "female", "other"].includes(rawGender) ? rawGender : "other";

  const result = { name, relationship, phone, bloodGroup, gender };
  if (age !== undefined) result.age = age;
  return result;
};

router.post(
  "/",
  protect,
  authorize("patient", "admin", "super-admin"),
  [
    body("doctorId").isMongoId().withMessage("Valid doctorId is required"),
    body("appointmentDate").isISO8601().withMessage("Valid appointment date is required"),
    body("reason").trim().notEmpty().withMessage("Reason is required"),
    body("consultationType")
      .optional({ nullable: true })
      .isIn(["in_person", "video"])
      .withMessage("consultationType must be in_person or video"),
    body("locationType")
      .optional({ nullable: true })
      .isIn(["current", "remote_saved", "custom_remote", "hospital"])
      .withMessage("Invalid locationType"),
    body("patientLocation").optional({ nullable: true }),
    body("patientDetails").optional({ nullable: true })
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const {
      doctorId,
      appointmentDate,
      reason,
      notes,
      consultationType,
      bookedFor = "self",
      familyMemberId = null,
      patientDetails = null,
      locationType = "current",
      patientLocation = null,
      aiTriage = null
    } = req.body;

    const doctor = await User.findOne({ _id: doctorId, role: "doctor", isActive: true });
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    const cleanLocation = sanitizePatientLocation(patientLocation, req.user);
    const cleanDetails = sanitizePatientDetails(patientDetails, req.user);
    const cleanLocType = ["current", "remote_saved", "custom_remote", "hospital"].includes(locationType) ? locationType : "current";

    const appointment = await Appointment.create({
      patient: req.user._id,
      doctor: doctor._id,
      hospital: doctor.hospital || null,
      hospitalName: doctor.hospitalName || "",
      appointmentDate,
      reason,
      consultationType: normalizeConsultationType(consultationType, { reason, notes }),
      notes,
      bookedFor: bookedFor === "family" ? "family" : "self",
      familyMemberId: familyMemberId || null,
      patientDetails: cleanDetails,
      locationType: cleanLocType,
      patientLocation: cleanLocation,
      aiTriage: aiTriage || undefined,
      tokenNumber: generateAppointmentToken()
    });

    const populated = await Appointment.findById(appointment._id)
      .populate("patient", "name email phone")
      .populate("doctor", "name email phone specialization consultationFee clinicAddress hospitalName");

    return res.status(201).json({
      success: true,
      message: "Appointment booked successfully",
      appointment: populated
    });
  })
);

router.get(
  "/my",
  protect,
  asyncHandler(async (req, res) => {
    let filter = {};
    if (req.user.role === "patient") {
      filter = { patient: req.user._id };
    } else if (req.user.role === "doctor") {
      filter = { doctor: req.user._id };
    }

    const appointments = await Appointment.find(filter)
      .populate("patient", "name email")
      .populate("doctor", "name email")
      .sort({ appointmentDate: 1 });

    return res.status(200).json({ success: true, appointments });
  })
);

router.get(
  "/doctor/:doctorId",
  protect,
  authorize("doctor", "admin"),
  [param("doctorId").isMongoId().withMessage("Valid doctorId is required")],
  validateRequest,
  asyncHandler(async (req, res) => {
    if (req.user.role === "doctor" && req.user._id.toString() !== req.params.doctorId) {
      return res.status(403).json({ success: false, message: "Access denied for this doctor" });
    }

    const appointments = await Appointment.find({ doctor: req.params.doctorId })
      .populate("patient", "name email")
      .populate("doctor", "name email")
      .sort({ appointmentDate: 1 });

    return res.status(200).json({ success: true, appointments });
  })
);

router.get(
  "/",
  protect,
  authorize("admin", "super-admin"),
  [query("status").optional({ nullable: true }).isIn(["pending", "confirmed", "completed", "cancelled"]).withMessage("Invalid status filter")],
  validateRequest,
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const appointments = await Appointment.find(filter)
      .populate("patient", "name email")
      .populate("doctor", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, appointments });
  })
);

router.patch(
  "/:id/reschedule",
  protect,
  authorize("patient", "admin", "super-admin"),
  [
    param("id").isMongoId().withMessage("Valid appointment id is required"),
    body("appointmentDate").isISO8601().withMessage("Valid appointment date is required"),
    body("reason").optional().trim().notEmpty().withMessage("Reason cannot be empty"),
    body("notes").optional().isString().withMessage("notes must be a string"),
    body("consultationType")
      .optional()
      .isIn(["in_person", "video"])
      .withMessage("consultationType must be in_person or video")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    const isOwner = appointment.patient.toString() === req.user._id.toString();
    if (req.user.role === "patient" && !isOwner) {
      return res.status(403).json({ success: false, message: "You can only reschedule your appointments" });
    }

    if (["completed", "cancelled"].includes(appointment.status)) {
      return res
        .status(400)
        .json({ success: false, message: "Completed or cancelled appointments cannot be rescheduled" });
    }

    appointment.appointmentDate = req.body.appointmentDate;
    if (req.body.reason !== undefined) {
      appointment.reason = req.body.reason;
    }
    if (req.body.notes !== undefined) {
      appointment.notes = req.body.notes;
    }
    if (req.body.consultationType !== undefined) {
      appointment.consultationType = normalizeConsultationType(req.body.consultationType, {
        reason: req.body.reason !== undefined ? req.body.reason : appointment.reason,
        notes: req.body.notes !== undefined ? req.body.notes : appointment.notes
      });
    }
    appointment.status = "pending";
    await appointment.save();

    const populated = await Appointment.findById(appointment._id)
      .populate("patient", "name email")
      .populate("doctor", "name email");

    return res.status(200).json({
      success: true,
      message: "Appointment rescheduled successfully",
      appointment: populated
    });
  })
);

router.patch(
  "/:id/cancel",
  protect,
  authorize("patient", "admin", "super-admin"),
  [param("id").isMongoId().withMessage("Valid appointment id is required")],
  validateRequest,
  asyncHandler(async (req, res) => {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    const isOwner = appointment.patient.toString() === req.user._id.toString();
    if (req.user.role === "patient" && !isOwner) {
      return res.status(403).json({ success: false, message: "You can only cancel your appointments" });
    }

    if (appointment.status === "completed") {
      return res.status(400).json({ success: false, message: "Completed appointments cannot be cancelled" });
    }

    appointment.status = "cancelled";
    await appointment.save();

    return res.status(200).json({
      success: true,
      message: "Appointment cancelled successfully",
      appointment
    });
  })
);

router.patch(
  "/:id/status",
  protect,
  authorize("doctor", "admin", "super-admin"),
  [
    param("id").isMongoId().withMessage("Valid appointment id is required"),
    body("status")
      .isIn(["pending", "confirmed", "completed", "cancelled"])
      .withMessage("Invalid appointment status")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    if (req.user.role === "doctor" && appointment.doctor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "You can only update your appointments" });
    }

    appointment.status = req.body.status;
    await appointment.save();

    const statusToLabel = {
      pending: "pending",
      confirmed: "confirmed",
      completed: "completed",
      cancelled: "cancelled"
    };

    try {
      await notifyUser(appointment.patient, {
        title: "Appointment Update",
        body: `Your appointment is now ${statusToLabel[appointment.status] || appointment.status}.`,
        url: "/user/appointments",
        tag: "appointment-status"
      });
    } catch {
      // Push config/subscription may be missing; status update should still succeed.
    }

    return res.status(200).json({
      success: true,
      message: "Appointment status updated",
      appointment
    });
  })
);

router.patch(
  "/:id/rating",
  protect,
  authorize("patient", "admin", "super-admin"),
  [
    param("id").isMongoId().withMessage("Valid appointment id is required"),
    body("rating").isInt({ min: 1, max: 5 }).withMessage("rating must be between 1 and 5"),
    body("review")
      .optional({ nullable: true })
      .isString()
      .isLength({ max: 1000 })
      .withMessage("review must be a string up to 1000 characters")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    const isOwner = appointment.patient.toString() === req.user._id.toString();
    if (req.user.role === "patient" && !isOwner) {
      return res.status(403).json({ success: false, message: "You can only rate your own appointment" });
    }

    if (appointment.status !== "completed") {
      return res
        .status(400)
        .json({ success: false, message: "Doctor rating is available only after consultation completion" });
    }

    appointment.doctorRating = Number(req.body.rating);
    if (req.body.review !== undefined) {
      appointment.doctorReview = String(req.body.review || "").trim();
    }
    appointment.ratedAt = new Date();
    await appointment.save();

    const populated = await Appointment.findById(appointment._id)
      .populate("patient", "name email")
      .populate("doctor", "name email");

    return res.status(200).json({
      success: true,
      message: "Doctor rating saved successfully",
      appointment: populated
    });
  })
);

router.get(
  "/:id/token-qr",
  protect,
  [param("id").isMongoId().withMessage("Valid appointment id is required")],
  validateRequest,
  asyncHandler(async (req, res) => {
    const appointment = await Appointment.findById(req.params.id)
      .populate("patient", "name email")
      .populate("doctor", "name email");

    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    const isOwner = appointment.patient._id.toString() === req.user._id.toString();
    const isAssignedDoctor = appointment.doctor._id.toString() === req.user._id.toString();
    const isAdmin = ["admin", "super-admin"].includes(req.user.role);

    if (!isOwner && !isAssignedDoctor && !isAdmin) {
      return res.status(403).json({ success: false, message: "Access denied for QR token" });
    }

    const qrPayload = {
      appointmentId: appointment._id,
      tokenNumber: appointment.tokenNumber,
      patient: appointment.patient.name,
      doctor: appointment.doctor.name,
      appointmentDate: appointment.appointmentDate
    };

    const qrDataUrl = await QRCode.toDataURL(JSON.stringify(qrPayload));
    return res.status(200).json({
      success: true,
      tokenNumber: appointment.tokenNumber,
      qrDataUrl
    });
  })
);

module.exports = router;
