const express = require("express");
const asyncHandler = require("express-async-handler");
const { body, param, query } = require("express-validator");
const Appointment = require("../models/Appointment");
const Emergency = require("../models/Emergency");
const Prescription = require("../models/Prescription");
const Payment = require("../models/Payment");
const User = require("../models/User");
const { emitEmergencyQueueUpdate } = require("../utils/emergencyQueue");
const { protect, authorize } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateMiddleware");

const router = express.Router();
const ACTIVE_APPOINTMENT_STATUSES = ["pending", "confirmed"];
const EMERGENCY_PRIORITY_WEIGHT = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

router.get(
  "/dashboard",
  protect,
  authorize("doctor"),
  asyncHandler(async (req, res) => {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const [appointments, urgentReviews, doctorUser] = await Promise.all([
      Appointment.find({ doctor: req.user._id })
        .populate("patient", "name email phone")
        .sort({ appointmentDate: 1 }),
      Emergency.countDocuments({
        assignedDoctor: req.user._id,
        status: { $in: ["waiting", "in_progress"] },
        priority: { $in: ["high", "critical"] }
      }),
      User.findById(req.user._id).select("name email phone specialization isAvailable consultationFee rating reviewCount clinicAddress")
    ]);

    const todaysVisits = appointments.filter(
      (appointment) =>
        appointment.appointmentDate >= startOfDay &&
        appointment.appointmentDate <= endOfDay &&
        appointment.status !== "cancelled"
    ).length;

    const completedConsults = appointments.filter(
      (appointment) => appointment.status === "completed"
    ).length;

    const upcomingSchedule = appointments
      .filter(
        (appointment) =>
          appointment.appointmentDate >= now &&
          ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status)
      )
      .slice(0, 10);

    const feePerConsult = doctorUser?.consultationFee || 500;

    // Calculate real payments or consultations earnings
    const appointmentIds = appointments.map((a) => a._id);
    const payments = await Payment.find({
      appointment: { $in: appointmentIds },
      status: "verified"
    });

    const paymentSum = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const totalEarned = paymentSum > 0 ? paymentSum : completedConsults * feePerConsult;

    // Pending payout: confirmed/pending consultations
    const pendingConsults = appointments.filter((a) => a.status === "confirmed").length;
    const pendingPayout = pendingConsults * feePerConsult;

    // Today's earnings
    const todaysCompleted = appointments.filter(
      (a) =>
        a.appointmentDate >= startOfDay &&
        a.appointmentDate <= endOfDay &&
        a.status === "completed"
    ).length;
    const todaysEarnings = todaysCompleted * feePerConsult;

    // Monthly earnings
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthCompleted = appointments.filter(
      (a) => a.appointmentDate >= startOfMonth && a.status === "completed"
    ).length;
    const thisMonthEarnings = thisMonthCompleted * feePerConsult;

    return res.status(200).json({
      success: true,
      summary: {
        todaysVisits,
        completedConsults,
        urgentReviews,
        totalEarned,
        pendingPayout,
        todaysEarnings,
        thisMonthEarnings,
        consultationFee: feePerConsult,
        isAvailable: doctorUser?.isAvailable !== false,
        doctorName: doctorUser?.name || req.user.name,
        specialization: doctorUser?.specialization || "Clinical Specialist",
        rating: doctorUser?.rating || 4.9,
        reviewCount: doctorUser?.reviewCount || 18,
        clinicAddress: doctorUser?.clinicAddress || "Hospital OPD Wing 2"
      },
      upcomingSchedule
    });
  })
);

router.get(
  "/appointments/me",
  protect,
  authorize("doctor"),
  asyncHandler(async (req, res) => {
    const appointments = await Appointment.find({ doctor: req.user._id })
      .populate("patient", "name email")
      .sort({ appointmentDate: 1 });

    return res.status(200).json({ success: true, appointments });
  })
);

router.get(
  "/appointments/priority",
  protect,
  authorize("doctor"),
  asyncHandler(async (req, res) => {
    const doctorId = req.user._id.toString();

    const [appointments, emergencies] = await Promise.all([
      Appointment.find({ doctor: req.user._id })
        .populate("patient", "name email")
        .sort({ appointmentDate: 1 }),
      Emergency.find({
        status: { $in: ["waiting", "in_progress"] },
        $or: [{ assignedDoctor: req.user._id }, { assignedDoctor: null }]
      })
        .populate("assignedDoctor", "name email")
        .sort({ createdAt: 1 })
    ]);

    const prioritizedEmergencies = [...emergencies].sort((a, b) => {
      const weightA = EMERGENCY_PRIORITY_WEIGHT[a.priority] || 0;
      const weightB = EMERGENCY_PRIORITY_WEIGHT[b.priority] || 0;
      if (weightA !== weightB) {
        return weightB - weightA;
      }
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    const schedule = [
      ...prioritizedEmergencies.map((emergency) => ({
        id: emergency._id,
        kind: "emergency",
        patientName: emergency.patientName || "Emergency Patient",
        symptoms: Array.isArray(emergency.symptoms) ? emergency.symptoms : [],
        priority: emergency.priority || "medium",
        status: emergency.status || "waiting",
        createdAt: emergency.createdAt,
        assignedDoctor: emergency.assignedDoctor
          ? {
              id: emergency.assignedDoctor._id,
              name: emergency.assignedDoctor.name || ""
            }
          : null,
        assignedToMe: emergency.assignedDoctor
          ? emergency.assignedDoctor._id.toString() === doctorId
          : false
      })),
      ...appointments.map((appointment) => ({
        id: appointment._id,
        kind: "appointment",
        appointmentDate: appointment.appointmentDate,
        status: appointment.status,
        consultationType: appointment.consultationType || "in_person",
        reason: appointment.reason || "",
        notes: appointment.notes || "",
        patient: appointment.patient
          ? {
              id: appointment.patient._id,
              name: appointment.patient.name || "Unknown Patient",
              email: appointment.patient.email || ""
            }
          : null
      }))
    ];

    return res.status(200).json({
      success: true,
      schedule,
      emergencies: prioritizedEmergencies,
      appointments
    });
  })
);

router.patch(
  "/emergencies/:id/take",
  protect,
  authorize("doctor"),
  [param("id").isMongoId().withMessage("Valid emergency id is required")],
  validateRequest,
  asyncHandler(async (req, res) => {
    const emergency = await Emergency.findOne({
      _id: req.params.id,
      status: { $in: ["waiting", "in_progress"] }
    });

    if (!emergency) {
      return res.status(404).json({ success: false, message: "Emergency case not found" });
    }

    if (
      emergency.assignedDoctor &&
      emergency.assignedDoctor.toString() !== req.user._id.toString()
    ) {
      return res
        .status(409)
        .json({ success: false, message: "Emergency case already assigned to another doctor" });
    }

    emergency.assignedDoctor = req.user._id;
    if (emergency.status === "waiting") {
      emergency.status = "in_progress";
    }

    await emergency.save();
    await emitEmergencyQueueUpdate(req.io);

    const updated = await Emergency.findById(emergency._id).populate(
      "assignedDoctor",
      "name email"
    );

    return res.status(200).json({
      success: true,
      message: "Emergency case assigned to you",
      emergency: updated
    });
  })
);

router.patch(
  "/emergencies/:id/resolve",
  protect,
  authorize("doctor"),
  [param("id").isMongoId().withMessage("Valid emergency id is required")],
  validateRequest,
  asyncHandler(async (req, res) => {
    const emergency = await Emergency.findById(req.params.id);
    if (!emergency) {
      return res.status(404).json({ success: false, message: "Emergency case not found" });
    }

    if (
      emergency.assignedDoctor &&
      emergency.assignedDoctor.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Emergency case is assigned to another doctor" });
    }

    emergency.assignedDoctor = req.user._id;
    emergency.status = "resolved";
    await emergency.save();
    await emitEmergencyQueueUpdate(req.io);

    const updated = await Emergency.findById(emergency._id).populate(
      "assignedDoctor",
      "name email"
    );

    return res.status(200).json({
      success: true,
      message: "Emergency case resolved",
      emergency: updated
    });
  })
);

router.get(
  "/patients",
  protect,
  authorize("doctor"),
  [query("q").optional().isString().withMessage("q must be a string")],
  validateRequest,
  asyncHandler(async (req, res) => {
    const search = String(req.query.q || "").trim().toLowerCase();
    const now = new Date();

    const appointments = await Appointment.find({ doctor: req.user._id })
      .populate("patient", "name email phone")
      .sort({ appointmentDate: -1 });

    const patientMap = new Map();
    appointments.forEach((appointment) => {
      const patient = appointment.patient;
      if (!patient?._id) return;

      const patientId = patient._id.toString();
      const existing = patientMap.get(patientId) || {
        id: patientId,
        name: patient.name || "Unknown Patient",
        email: patient.email || "",
        phone: patient.phone || "",
        totalVisits: 0,
        upcomingVisits: 0,
        lastAppointmentAt: null,
        lastStatus: "",
        recentReasons: []
      };

      existing.totalVisits += 1;
      if (
        appointment.appointmentDate >= now &&
        ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status)
      ) {
        existing.upcomingVisits += 1;
      }

      if (
        !existing.lastAppointmentAt ||
        new Date(appointment.appointmentDate) > new Date(existing.lastAppointmentAt)
      ) {
        existing.lastAppointmentAt = appointment.appointmentDate;
        existing.lastStatus = appointment.status;
      }

      const reason = String(appointment.reason || "").trim();
      if (reason && !existing.recentReasons.includes(reason)) {
        existing.recentReasons.push(reason);
      }
      if (existing.recentReasons.length > 3) {
        existing.recentReasons = existing.recentReasons.slice(0, 3);
      }

      patientMap.set(patientId, existing);
    });

    let patients = [...patientMap.values()];
    if (search) {
      patients = patients.filter((patient) =>
        [patient.name, patient.email, patient.id]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search)
      );
    }

    patients.sort((a, b) => {
      const aTime = a.lastAppointmentAt ? new Date(a.lastAppointmentAt).getTime() : 0;
      const bTime = b.lastAppointmentAt ? new Date(b.lastAppointmentAt).getTime() : 0;
      return bTime - aTime;
    });

    return res.status(200).json({ success: true, patients });
  })
);

router.get(
  "/patients/:patientId/history",
  protect,
  authorize("doctor"),
  [param("patientId").isMongoId().withMessage("Valid patientId is required")],
  validateRequest,
  asyncHandler(async (req, res) => {
    const appointments = await Appointment.find({
      doctor: req.user._id,
      patient: req.params.patientId
    })
      .populate("patient", "name email")
      .sort({ appointmentDate: -1 });

    return res.status(200).json({ success: true, appointments });
  })
);

router.get(
  "/prescriptions",
  protect,
  authorize("doctor"),
  asyncHandler(async (req, res) => {
    const prescriptions = await Prescription.find({ doctor: req.user._id })
      .populate("patient", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, prescriptions });
  })
);

router.post(
  "/prescriptions",
  protect,
  authorize("doctor"),
  [
    body("patientId").isMongoId().withMessage("Valid patientId is required"),
    body("medicineName").trim().notEmpty().withMessage("Medicine name is required"),
    body("dosage").optional().isString(),
    body("frequency").optional().isString(),
    body("instructions").optional().isString(),
    body("nextRefillDate").optional().isISO8601().withMessage("Valid nextRefillDate is required")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const patient = await User.findOne({
      _id: req.body.patientId,
      role: "patient",
      isActive: true
    });

    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    const prescription = await Prescription.create({
      patient: patient._id,
      doctor: req.user._id,
      medicineName: req.body.medicineName,
      dosage: req.body.dosage || "",
      frequency: req.body.frequency || "",
      instructions: req.body.instructions || "",
      nextRefillDate: req.body.nextRefillDate || null
    });

    const populated = await Prescription.findById(prescription._id)
      .populate("patient", "name email")
      .populate("doctor", "name email");

    return res.status(201).json({
      success: true,
      message: "Prescription issued successfully",
      prescription: populated
    });
  })
);

router.get(
  "/emergencies/active",
  protect,
  authorize("doctor"),
  asyncHandler(async (req, res) => {
    const emergencies = await Emergency.find({
      status: { $in: ["waiting", "in_progress"] }
    })
      .populate("assignedDoctor", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, emergencies });
  })
);

router.patch(
  "/availability",
  protect,
  authorize("doctor"),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Doctor profile not found" });
    }

    if (typeof req.body.isAvailable === "boolean") {
      user.isAvailable = req.body.isAvailable;
    } else {
      user.isAvailable = !user.isAvailable;
    }

    await user.save();
    return res.status(200).json({
      success: true,
      message: `Doctor status updated to ${user.isAvailable ? "Online & Taking Patients" : "Away / In Consultation"}`,
      isAvailable: user.isAvailable
    });
  })
);

router.patch(
  "/fee",
  protect,
  authorize("doctor"),
  [body("consultationFee").isFloat({ min: 50, max: 20000 }).withMessage("Consultation fee must be between ₹50 and ₹20,000")],
  validateRequest,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Doctor profile not found" });
    }

    user.consultationFee = Number(req.body.consultationFee);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Consultation fee updated successfully",
      consultationFee: user.consultationFee
    });
  })
);

module.exports = router;
