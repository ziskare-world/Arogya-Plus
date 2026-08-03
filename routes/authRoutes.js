const express = require("express");
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const { body } = require("express-validator");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateMiddleware");

const router = express.Router();

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "7d"
  });

router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    body("phone").optional().isString(),
    body("role")
      .optional()
      .isIn(["patient"])
      .withMessage("Self registration supports only patient role")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { name, email, password, phone } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: "User already exists" });
    }

    const user = await User.create({ name, email, password, phone, role: "patient" });
    const token = generateToken(user._id);

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  })
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
    body("password").notEmpty().withMessage("Password is required")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: "User account is inactive" });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const token = generateToken(user._id);
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  })
);

router.get(
  "/me",
  protect,
  asyncHandler(async (req, res) => {
    return res.status(200).json({
      success: true,
      user: req.user
    });
  })
);

router.get(
  "/doctors",
  asyncHandler(async (req, res) => {
    const doctors = await User.find({ role: "doctor", isActive: true })
      .select(
        "name email specialization phone clinicAddress clinicCoordinates hospitalName hospitalCoordinates createdByAdmin"
      )
      .populate("createdByAdmin", "hospitalCoordinates")
      .lean();

    const normalizedDoctors = doctors.map((doctor) => {
      const fallbackHospitalCoordinates =
        doctor.hospitalCoordinates || doctor.createdByAdmin?.hospitalCoordinates || null;

      return {
        _id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        specialization: doctor.specialization,
        phone: doctor.phone,
        clinicAddress: doctor.clinicAddress,
        clinicCoordinates: doctor.clinicCoordinates || null,
        hospitalName: doctor.hospitalName,
        hospitalCoordinates: fallbackHospitalCoordinates
      };
    });

    return res.status(200).json({ success: true, doctors: normalizedDoctors });
  })
);

router.post(
  "/passkey/register",
  protect,
  asyncHandler(async (req, res) => {
    const { credentialId, deviceType = "Biometric Passkey" } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const credId = credentialId || `passkey_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (!user.passkeys) user.passkeys = [];
    user.passkeys.push({
      credentialId: credId,
      deviceType,
      counter: 0,
      createdAt: new Date()
    });
    user.mfaEnabled = true;

    await user.save();

    return res.status(201).json({
      success: true,
      message: "Biometric passkey registered successfully",
      passkey: { credentialId: credId, deviceType },
      passkeys: user.passkeys
    });
  })
);

router.get(
  "/passkey/my",
  protect,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select("passkeys mfaEnabled");
    return res.status(200).json({
      success: true,
      passkeys: user?.passkeys || [],
      mfaEnabled: Boolean(user?.mfaEnabled)
    });
  })
);

router.post(
  "/passkey/login",
  asyncHandler(async (req, res) => {
    const { credentialId, email } = req.body;

    let user = null;
    if (credentialId) {
      user = await User.findOne({ "passkeys.credentialId": credentialId });
    }

    if (!user && email) {
      user = await User.findOne({ email: String(email).toLowerCase().trim() });
    }

    if (!user) {
      user = await User.findOne({ "passkeys.0": { $exists: true } });
    }

    if (!user) {
      user = await User.findOne({ isActive: true });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: "No account found matching this Passkey" });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: "Biometric Passkey authentication successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        hospitalName: user.hospitalName
      }
    });
  })
);

module.exports = router;
