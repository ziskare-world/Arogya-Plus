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

module.exports = router;
