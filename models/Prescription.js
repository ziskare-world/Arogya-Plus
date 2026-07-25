const mongoose = require("mongoose");

const prescriptionSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    medicineName: {
      type: String,
      required: [true, "Medicine name is required"],
      trim: true
    },
    dosage: {
      type: String,
      trim: true,
      default: ""
    },
    frequency: {
      type: String,
      trim: true,
      default: ""
    },
    instructions: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ["active", "completed", "discontinued"],
      default: "active"
    },
    nextRefillDate: {
      type: Date
    },
    lastRefillRequestedAt: {
      type: Date
    },
    refillRequestCount: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Prescription", prescriptionSchema);
