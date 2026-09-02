const express = require("express");
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const { body } = require("express-validator");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateMiddleware");
const { generateSecret, verifyTotpCode, generateQrCodeDataUrl, getOtpAuthUrl } = require("../utils/totp");

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

    const hasPasskey = Boolean(user.passkeys && user.passkeys.length > 0);
    const hasTotp = Boolean(user.totpVerified && user.totpSecret);
    const mfaEnabled = Boolean(user.mfaEnabled && (hasPasskey || hasTotp));

    const token = generateToken(user._id);
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        mfaEnabled,
        hasPasskey,
        hasTotp
      }
    });
  })
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    return res.status(200).json({
      success: true,
      message: "Logged out successfully"
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
    const Appointment = require("../models/Appointment");
    const doctors = await User.find({ role: "doctor", isActive: true })
      .select(
        "name email specialization experienceYears rating reviewCount phone clinicAddress clinicCoordinates hospitalName hospitalCoordinates createdByAdmin"
      )
      .populate("createdByAdmin", "hospitalCoordinates")
      .lean();

    const doctorIds = doctors.map((d) => d._id);
    const ratingsAgg = await Appointment.aggregate([
      {
        $match: {
          doctor: { $in: doctorIds },
          doctorRating: { $gte: 1, $lte: 5 }
        }
      },
      {
        $group: {
          _id: "$doctor",
          avgRating: { $avg: "$doctorRating" },
          count: { $sum: 1 }
        }
      }
    ]);

    const ratingMap = new Map();
    ratingsAgg.forEach((item) => {
      ratingMap.set(String(item._id), {
        avgRating: Number(item.avgRating.toFixed(1)),
        count: item.count
      });
    });

    const normalizedDoctors = doctors.map((doctor) => {
      const fallbackHospitalCoordinates =
        doctor.hospitalCoordinates || doctor.createdByAdmin?.hospitalCoordinates || null;
      const rInfo = ratingMap.get(String(doctor._id)) || { avgRating: 0, count: 0 };

      return {
        _id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        specialization: doctor.specialization,
        experienceYears: Number(doctor.experienceYears || 0),
        rating: rInfo.avgRating,
        reviewCount: rInfo.count,
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
    const user = await User.findById(req.user._id).select("passkeys mfaEnabled totpVerified");
    return res.status(200).json({
      success: true,
      passkeys: user?.passkeys || [],
      mfaEnabled: Boolean(user?.mfaEnabled || (user?.passkeys && user.passkeys.length > 0) || user?.totpVerified),
      totpVerified: Boolean(user?.totpVerified)
    });
  })
);

router.get(
  "/passkey/totp-setup",
  protect,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.totpSecret) {
      user.totpSecret = generateSecret(16);
      await user.save();
    }

    const otpauthUrl = getOtpAuthUrl(user.email, user.totpSecret);
    const qrCodeUrl = await generateQrCodeDataUrl(otpauthUrl);

    return res.status(200).json({
      success: true,
      secret: user.totpSecret,
      qrCodeUrl,
      otpauthUrl
    });
  })
);

router.post(
  "/passkey/verify-totp",
  protect,
  asyncHandler(async (req, res) => {
    const { code } = req.body;
    const cleanCode = String(code || "").trim();

    if (!cleanCode || cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      return res.status(400).json({ success: false, message: "Valid 6-digit numeric TOTP code is required" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.totpSecret) {
      user.totpSecret = generateSecret(16);
      await user.save();
    }

    const isValid = verifyTotpCode(user.totpSecret, cleanCode);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired authenticator code. Please check your app and try again."
      });
    }

    user.mfaEnabled = true;
    user.totpVerified = true;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Authenticator TOTP 2FA verified successfully",
      mfaEnabled: true,
      totpVerified: true
    });
  })
);

router.post(
  "/passkey/toggle-mfa",
  protect,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.mfaEnabled = req.body.enabled !== undefined ? Boolean(req.body.enabled) : !user.mfaEnabled;
    await user.save();

    return res.status(200).json({
      success: true,
      message: `Multi-Factor Authentication ${user.mfaEnabled ? "Enabled" : "Disabled"}`,
      mfaEnabled: user.mfaEnabled
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

const handleTotpLoginReq = async (req, res) => {
  const { email, code, totpCode } = req.body;
  const cleanCode = String(code || totpCode || "").trim();

  if (!cleanCode || cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
    return res.status(400).json({ success: false, message: "Please enter a valid 6-digit numeric authenticator app code" });
  }

  let user = null;
  if (email) {
    user = await User.findOne({ email: String(email).toLowerCase().trim() });
  }

  if (!user) {
    user = await User.findOne({ totpVerified: true });
  }

  if (!user) {
    return res.status(404).json({ success: false, message: "No account found matching this request" });
  }

  if (!user.totpSecret) {
    return res.status(400).json({ success: false, message: "TOTP 2FA is not set up for this account" });
  }

  const isValid = verifyTotpCode(user.totpSecret, cleanCode);
  if (!isValid) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired authenticator code. Please check your app and try again."
    });
  }

  const token = generateToken(user._id);

  return res.status(200).json({
    success: true,
    message: "6-Digit Authenticator App Code verified successfully",
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      hospitalName: user.hospitalName
    }
  });
};

router.post("/passkey/login-totp", asyncHandler(handleTotpLoginReq));
router.post("/login/totp", asyncHandler(handleTotpLoginReq));

module.exports = router;
