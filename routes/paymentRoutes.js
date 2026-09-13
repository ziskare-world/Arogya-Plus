const express = require("express");
const asyncHandler = require("express-async-handler");
const { body } = require("express-validator");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const Payment = require("../models/Payment");
const Appointment = require("../models/Appointment");
const { protect, authorize } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateMiddleware");

const router = express.Router();

const hasRazorpayKeys = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

const razorpay = hasRazorpayKeys
  ? new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    })
  : null;

router.get(
  "/my",
  protect,
  asyncHandler(async (req, res) => {
    const isAdminUser = ["admin", "super-admin"].includes(req.user.role);
    const filter = isAdminUser ? {} : { user: req.user._id };

    const payments = await Payment.find(filter)
      .populate({
        path: "appointment",
        populate: {
          path: "doctor",
          select: "name email specialization"
        }
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, payments });
  })
);

router.get(
  "/config",
  protect,
  asyncHandler(async (req, res) => {
    return res.status(200).json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID || null,
      mockMode: !hasRazorpayKeys
    });
  })
);

router.post(
  "/create-order",
  protect,
  authorize("patient", "admin", "super-admin"),
  [
    body("amount").isFloat({ gt: 0 }).withMessage("Amount must be greater than zero"),
    body("appointmentId").optional().isMongoId().withMessage("appointmentId must be valid")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const amount = Number(req.body.amount);

    let serviceDescription = req.body.description || "Clinical Medical Care & Diagnostic Services";
    if (req.body.appointmentId) {
      const appointment = await Appointment.findById(req.body.appointmentId).populate("doctor", "name specialization");
      if (!appointment) {
        return res.status(404).json({ success: false, message: "Appointment not found" });
      }
      if (appointment.doctor) {
        serviceDescription = `Consultation with Dr. ${appointment.doctor.name} (${appointment.doctor.specialization || "Clinical Specialist"})`;
      }
    }

    const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}${Math.floor(10 + Math.random() * 90)}`;
    const baseAmount = Math.round((amount / 1.18) * 100) / 100;
    const taxAmount = Math.round((amount - baseAmount) * 100) / 100;

    // For local/test environments without keys, return a mock order.
    if (!hasRazorpayKeys) {
      const mockOrderId = `mock_order_${Date.now()}`;
      const payment = await Payment.create({
        user: req.user._id,
        appointment: req.body.appointmentId,
        amount,
        taxAmount,
        currency: "INR",
        razorpayOrderId: mockOrderId,
        invoiceNumber,
        serviceDescription,
        status: "created"
      });

      return res.status(201).json({
        success: true,
        message: "Mock payment order created (Razorpay keys missing)",
        order: {
          id: mockOrderId,
          amount: amount * 100,
          currency: "INR"
        },
        payment
      });
    }

    const options = {
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `rcpt_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);

    const payment = await Payment.create({
      user: req.user._id,
      appointment: req.body.appointmentId,
      amount,
      taxAmount,
      currency: order.currency,
      razorpayOrderId: order.id,
      invoiceNumber,
      serviceDescription,
      status: "created"
    });

    return res.status(201).json({
      success: true,
      message: "Payment order created",
      order,
      payment
    });
  })
);

router.post(
  "/verify",
  protect,
  authorize("patient", "admin", "super-admin"),
  [
    body("razorpay_order_id").notEmpty().withMessage("razorpay_order_id is required"),
    body("razorpay_payment_id").notEmpty().withMessage("razorpay_payment_id is required"),
    body("razorpay_signature").notEmpty().withMessage("razorpay_signature is required")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, method } = req.body;

    let isSignatureValid = false;
    if (!hasRazorpayKeys) {
      // In mock mode, allow placeholder signature only for development/testing.
      isSignatureValid = razorpay_signature === "mock_signature";
    } else {
      const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      isSignatureValid = generatedSignature === razorpay_signature;
    }

    if (!isSignatureValid) {
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }

    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment record not found" });
    }

    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.status = "verified";
    if (method) {
      payment.method = method;
    } else if (!payment.method) {
      payment.method = "Razorpay / Unified Payments";
    }
    await payment.save();

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      payment
    });
  })
);

router.get(
  "/invoice/:id",
  protect,
  asyncHandler(async (req, res) => {
    const payment = await Payment.findById(req.params.id)
      .populate("user", "name email phone")
      .populate({
        path: "appointment",
        populate: {
          path: "doctor",
          select: "name email specialization clinicAddress phone"
        }
      });

    if (!payment) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    const isAdmin = ["admin", "super-admin"].includes(req.user.role);
    if (!isAdmin && String(payment.user?._id || payment.user) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "Unauthorized access to invoice" });
    }

    const netAmount = Number(payment.amount || 0);
    const baseAmount = Math.round((netAmount / 1.18) * 100) / 100;
    const gstAmount = Math.round((netAmount - baseAmount) * 100) / 100;

    const verificationHash = crypto
      .createHash("sha256")
      .update(`${payment._id}-${payment.razorpayOrderId || "ORD"}-${payment.amount}`)
      .digest("hex")
      .slice(0, 24)
      .toUpperCase();

    return res.status(200).json({
      success: true,
      invoice: {
        id: payment._id,
        invoiceNumber: payment.invoiceNumber || `INV-${payment._id.toString().slice(-8).toUpperCase()}`,
        date: payment.createdAt,
        verifiedAt: payment.updatedAt,
        status: payment.status,
        method: payment.method || "Razorpay / Unified Gateway",
        currency: payment.currency || "INR",
        amount: netAmount,
        baseAmount,
        gstAmount,
        serviceDescription: payment.serviceDescription || "Clinical Consultation & Care",
        razorpayOrderId: payment.razorpayOrderId,
        razorpayPaymentId: payment.razorpayPaymentId,
        razorpaySignature: payment.razorpaySignature,
        verificationHash,
        patient: payment.user,
        appointment: payment.appointment
      }
    });
  })
);

module.exports = router;
