const express = require("express");
const asyncHandler = require("express-async-handler");
const { body, param } = require("express-validator");
const User = require("../models/User");
const Appointment = require("../models/Appointment");
const Payment = require("../models/Payment");
const MedicalRecord = require("../models/MedicalRecord");
const Prescription = require("../models/Prescription");
const { protect, authorize } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateMiddleware");

const router = express.Router();

const APPOINTMENT_ACTIVE_STATUSES = ["pending", "confirmed"];

const formatCurrency = (amount = 0) => Number(amount.toFixed(2));

router.get(
  "/dashboard",
  protect,
  authorize("patient"),
  asyncHandler(async (req, res) => {
    const now = new Date();
    const upcomingFilter = {
      patient: req.user._id,
      status: { $in: APPOINTMENT_ACTIVE_STATUSES },
      appointmentDate: { $gte: now }
    };

    const [
      upcomingAppointmentsCount,
      nextAppointment,
      refillsDue,
      recentRecordsCount,
      payments,
      appointmentActivity,
      paymentActivity,
      recordActivity
    ] = await Promise.all([
      Appointment.countDocuments(upcomingFilter),
      Appointment.findOne(upcomingFilter)
        .populate("doctor", "name email specialization")
        .sort({ appointmentDate: 1 }),
      Prescription.countDocuments({
        patient: req.user._id,
        status: "active",
        nextRefillDate: { $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) }
      }),
      MedicalRecord.countDocuments({
        patient: req.user._id,
        createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }
      }),
      Payment.find({ user: req.user._id }),
      Appointment.find({ patient: req.user._id })
        .populate("doctor", "name")
        .sort({ updatedAt: -1 })
        .limit(3),
      Payment.find({ user: req.user._id }).sort({ updatedAt: -1 }).limit(3),
      MedicalRecord.find({ patient: req.user._id }).sort({ updatedAt: -1 }).limit(3)
    ]);

    const outstandingBalance = formatCurrency(
      payments
        .filter((payment) => payment.status !== "verified")
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    );

    const activities = [
      ...appointmentActivity.map((appointment) => ({
        type: "appointment",
        title: `Appointment ${appointment.status}`,
        subtitle: appointment.doctor?.name
          ? `With ${appointment.doctor.name}`
          : "Appointment updated",
        createdAt: appointment.updatedAt
      })),
      ...paymentActivity.map((payment) => ({
        type: "payment",
        title:
          payment.status === "verified"
            ? "Payment successful"
            : payment.status === "created"
              ? "Payment pending"
              : "Payment update",
        subtitle: `INR ${Number(payment.amount || 0).toFixed(2)}`,
        createdAt: payment.updatedAt
      })),
      ...recordActivity.map((record) => ({
        type: "record",
        title: "Medical record updated",
        subtitle: record.title,
        createdAt: record.updatedAt
      }))
    ]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 6);

    return res.status(200).json({
      success: true,
      summary: {
        upcomingAppointments: upcomingAppointmentsCount,
        refillsDue,
        recentRecords: recentRecordsCount,
        outstandingBalance
      },
      nextAppointment,
      recentActivity: activities
    });
  })
);

const calculateProfileCompletion = (user) => {
  let score = 0;
  const missing = [];

  if (user.name) score += 15; else missing.push("Full Name");
  if (user.phone) score += 15; else missing.push("Phone Number");

  if (user.age && user.gender) score += 15; else missing.push("Age and Gender");
  if (user.bloodGroup && user.bloodGroup !== "Unknown") score += 15; else missing.push("Blood Group");

  if (user.address || user.city) score += 20; else missing.push("Home / Current Address");

  const familyCount = (user.familyMembers || []).length;
  if (familyCount > 0) {
    score += 20;
  } else {
    missing.push("Add Family Members for remote care");
  }

  return {
    completionPercentage: Math.min(100, score),
    isProfileComplete: score >= 80,
    missingFields: missing,
    familyMemberCount: familyCount,
    maxFamilyMembers: 5
  };
};

router.get(
  "/profile-status",
  protect,
  authorize("patient"),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const status = calculateProfileCompletion(user);

    // Auto-update isProfileComplete if changed
    if (user.isProfileComplete !== status.isProfileComplete) {
      user.isProfileComplete = status.isProfileComplete;
      await user.save();
    }

    return res.status(200).json({
      success: true,
      ...status,
      familyMembers: user.familyMembers || []
    });
  })
);

router.get(
  "/profile",
  protect,
  authorize("patient"),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    const completion = calculateProfileCompletion(user);
    return res.status(200).json({
      success: true,
      profile: user,
      completion
    });
  })
);

router.patch(
  "/profile",
  protect,
  authorize("patient"),
  [
    body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
    body("email").optional().isEmail().withMessage("Valid email is required").normalizeEmail(),
    body("phone").optional().isString(),
    body("age").optional().isNumeric().withMessage("Age must be a number"),
    body("gender").optional().isIn(["male", "female", "other"]).withMessage("Invalid gender"),
    body("bloodGroup").optional().isString(),
    body("address").optional().isString(),
    body("city").optional().isString(),
    body("coordinates").optional().isObject(),
    body("allergies").optional().isArray(),
    body("medicalHistory").optional().isArray()
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (req.body.email && req.body.email !== user.email) {
      const existing = await User.findOne({ email: req.body.email, _id: { $ne: user._id } });
      if (existing) {
        return res.status(409).json({ success: false, message: "Email already in use" });
      }
      user.email = req.body.email;
    }

    if (req.body.name !== undefined) user.name = req.body.name;
    if (req.body.phone !== undefined) user.phone = req.body.phone;
    if (req.body.age !== undefined) user.age = Number(req.body.age);
    if (req.body.gender !== undefined) user.gender = req.body.gender;
    if (req.body.bloodGroup !== undefined) user.bloodGroup = req.body.bloodGroup;
    if (req.body.address !== undefined) user.address = req.body.address;
    if (req.body.city !== undefined) user.city = req.body.city;
    if (req.body.coordinates !== undefined) user.coordinates = req.body.coordinates;
    if (req.body.allergies !== undefined) user.allergies = req.body.allergies;
    if (req.body.medicalHistory !== undefined) user.medicalHistory = req.body.medicalHistory;

    const completion = calculateProfileCompletion(user);
    user.isProfileComplete = completion.isProfileComplete;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      profile: user,
      completion
    });
  })
);

// ==========================================
// FAMILY MEMBER CRUD (UP TO 5 FAMILY MEMBERS)
// ==========================================
router.get(
  "/family-members",
  protect,
  authorize("patient"),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select("familyMembers");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      count: (user.familyMembers || []).length,
      maxAllowed: 5,
      remainingSlots: Math.max(0, 5 - (user.familyMembers || []).length),
      familyMembers: user.familyMembers || []
    });
  })
);

router.post(
  "/family-members",
  protect,
  authorize("patient"),
  [
    body("name").trim().notEmpty().withMessage("Family member name is required"),
    body("relationship")
      .isIn(["Father", "Mother", "Spouse", "Child", "Son", "Daughter", "Brother", "Sister", "Grandparent", "Other"])
      .withMessage("Valid relationship is required"),
    body("age").optional().isNumeric().withMessage("Age must be a number"),
    body("gender").optional().isIn(["male", "female", "other"]).withMessage("Invalid gender"),
    body("bloodGroup").optional().isString(),
    body("phone").optional().isString(),
    body("address").optional().isString(),
    body("city").optional().isString(),
    body("coordinates").optional().isObject(),
    body("medicalHistory").optional().isArray(),
    body("allergies").optional().isArray()
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.familyMembers) {
      user.familyMembers = [];
    }

    if (user.familyMembers.length >= 5) {
      return res.status(400).json({
        success: false,
        message: "Maximum limit reached. You can add up to 5 family members to your profile."
      });
    }

    const {
      name,
      relationship,
      age,
      gender,
      bloodGroup,
      phone,
      address,
      city,
      coordinates,
      medicalHistory,
      allergies,
      isEmergencyContact
    } = req.body;

    user.familyMembers.push({
      name,
      relationship,
      age: age ? Number(age) : undefined,
      gender: gender || "other",
      bloodGroup: bloodGroup || "Unknown",
      phone: phone || "",
      address: address || "",
      city: city || "",
      coordinates: coordinates || undefined,
      medicalHistory: Array.isArray(medicalHistory) ? medicalHistory : [],
      allergies: Array.isArray(allergies) ? allergies : [],
      isEmergencyContact: Boolean(isEmergencyContact)
    });

    const completion = calculateProfileCompletion(user);
    user.isProfileComplete = completion.isProfileComplete;

    await user.save();

    const addedMember = user.familyMembers[user.familyMembers.length - 1];

    return res.status(201).json({
      success: true,
      message: `${name} (${relationship}) added to your family profiles`,
      familyMember: addedMember,
      count: user.familyMembers.length,
      maxAllowed: 5,
      remainingSlots: 5 - user.familyMembers.length,
      completion
    });
  })
);

router.put(
  "/family-members/:memberId",
  protect,
  authorize("patient"),
  [
    param("memberId").isMongoId().withMessage("Valid family member id required"),
    body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
    body("relationship")
      .optional()
      .isIn(["Father", "Mother", "Spouse", "Child", "Son", "Daughter", "Brother", "Sister", "Grandparent", "Other"])
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const member = user.familyMembers.id(req.params.memberId);
    if (!member) {
      return res.status(404).json({ success: false, message: "Family member not found" });
    }

    const fields = [
      "name", "relationship", "age", "gender", "bloodGroup", "phone",
      "address", "city", "coordinates", "medicalHistory", "allergies", "isEmergencyContact"
    ];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        member[field] = req.body[field];
      }
    });

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Family member updated successfully",
      familyMember: member
    });
  })
);

router.delete(
  "/family-members/:memberId",
  protect,
  authorize("patient"),
  [param("memberId").isMongoId().withMessage("Valid family member id required")],
  validateRequest,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const member = user.familyMembers.id(req.params.memberId);
    if (!member) {
      return res.status(404).json({ success: false, message: "Family member not found" });
    }

    user.familyMembers.pull(req.params.memberId);
    const completion = calculateProfileCompletion(user);
    user.isProfileComplete = completion.isProfileComplete;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Family member removed successfully",
      count: user.familyMembers.length,
      remainingSlots: 5 - user.familyMembers.length,
      completion
    });
  })
);

router.patch(
  "/change-password",
  protect,
  authorize("patient"),
  [
    body("currentPassword").notEmpty().withMessage("Current password is required"),
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("New password must be at least 6 characters")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Current password is incorrect" });
    }

    if (currentPassword === newPassword) {
      return res
        .status(400)
        .json({ success: false, message: "New password must be different from current password" });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password updated successfully"
    });
  })
);

router.delete(
  "/account",
  protect,
  authorize("patient"),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.isActive = false;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Account deactivated successfully"
    });
  })
);

router.get(
  "/medical-records",
  protect,
  authorize("patient"),
  asyncHandler(async (req, res) => {
    const records = await MedicalRecord.find({ patient: req.user._id }).sort({ recordDate: -1, createdAt: -1 });
    return res.status(200).json({ success: true, records });
  })
);

router.post(
  "/medical-records",
  protect,
  authorize("patient"),
  [
    body("title").trim().notEmpty().withMessage("Record title is required"),
    body("recordType").optional().isString(),
    body("recordDate").optional().isISO8601().withMessage("Valid recordDate is required"),
    body("notes").optional().isString(),
    body("documentUrl").optional().isString()
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const record = await MedicalRecord.create({
      patient: req.user._id,
      title: req.body.title,
      recordType: req.body.recordType || "General",
      recordDate: req.body.recordDate || new Date(),
      notes: req.body.notes,
      documentUrl: req.body.documentUrl
    });

    return res.status(201).json({
      success: true,
      message: "Medical record added successfully",
      record
    });
  })
);

router.get(
  "/medical-records/:id/download",
  protect,
  authorize("patient"),
  [param("id").isMongoId().withMessage("Valid record id is required")],
  validateRequest,
  asyncHandler(async (req, res) => {
    const record = await MedicalRecord.findOne({ _id: req.params.id, patient: req.user._id });
    if (!record) {
      return res.status(404).json({ success: false, message: "Medical record not found" });
    }

    const fileName = `${record.title.replace(/[^a-z0-9_-]/gi, "_").toLowerCase() || "record"}.txt`;
    const content = [
      `Title: ${record.title}`,
      `Type: ${record.recordType || "General"}`,
      `Date: ${record.recordDate ? new Date(record.recordDate).toISOString() : ""}`,
      `Document URL: ${record.documentUrl || "N/A"}`,
      `Notes: ${record.notes || "N/A"}`
    ].join("\n");

    return res.status(200).json({
      success: true,
      fileName,
      content
    });
  })
);

router.get(
  "/prescriptions",
  protect,
  authorize("patient"),
  asyncHandler(async (req, res) => {
    const prescriptions = await Prescription.find({ patient: req.user._id })
      .populate("doctor", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, prescriptions });
  })
);

router.post(
  "/prescriptions/:id/refill-request",
  protect,
  authorize("patient"),
  [param("id").isMongoId().withMessage("Valid prescription id is required")],
  validateRequest,
  asyncHandler(async (req, res) => {
    const prescription = await Prescription.findOne({
      _id: req.params.id,
      patient: req.user._id
    });

    if (!prescription) {
      return res.status(404).json({ success: false, message: "Prescription not found" });
    }

    if (prescription.status !== "active") {
      return res.status(400).json({ success: false, message: "Refill allowed only for active prescriptions" });
    }

    const now = new Date();
    if (
      prescription.lastRefillRequestedAt &&
      now.getTime() - new Date(prescription.lastRefillRequestedAt).getTime() < 24 * 60 * 60 * 1000
    ) {
      return res.status(429).json({
        success: false,
        message: "Refill request already submitted in the last 24 hours"
      });
    }

    prescription.lastRefillRequestedAt = now;
    prescription.refillRequestCount += 1;
    await prescription.save();

    return res.status(200).json({
      success: true,
      message: "Refill request submitted successfully",
      prescription
    });
  })
);

router.get(
  "/billing",
  protect,
  authorize("patient"),
  asyncHandler(async (req, res) => {
    const payments = await Payment.find({ user: req.user._id })
      .populate({
        path: "appointment",
        populate: {
          path: "doctor",
          select: "name specialization clinicAddress phone email"
        }
      })
      .sort({ createdAt: -1 });

    const totalPaid = formatCurrency(
      payments
        .filter((payment) => payment.status === "verified")
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    );

    const balanceDue = formatCurrency(
      payments
        .filter((payment) => payment.status !== "verified")
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    );

    const verifiedCount = payments.filter((p) => p.status === "verified").length;
    const pendingCount = payments.filter((p) => p.status !== "verified").length;

    return res.status(200).json({
      success: true,
      summary: {
        totalPaid,
        balanceDue,
        verifiedCount,
        pendingCount,
        totalInvoices: payments.length
      },
      payments
    });
  })
);

module.exports = router;
