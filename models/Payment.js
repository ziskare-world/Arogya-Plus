const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment"
    },
    amount: {
      type: Number,
      required: [true, "Payment amount is required"],
      min: 1
    },
    currency: {
      type: String,
      default: "INR"
    },
    razorpayOrderId: {
      type: String,
      required: true
    },
    razorpayPaymentId: {
      type: String
    },
    razorpaySignature: {
      type: String
    },
    status: {
      type: String,
      enum: ["created", "verified", "failed"],
      default: "created"
    },
    method: {
      type: String,
      trim: true
    },
    invoiceNumber: {
      type: String,
      trim: true
    },
    serviceDescription: {
      type: String,
      trim: true,
      default: "Clinical Consultation & Care"
    },
    taxAmount: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
