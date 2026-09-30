const mongoose = require("mongoose");

const labBookingSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    patientName: {
      type: String,
      required: true
    },
    patientPhone: {
      type: String,
      default: ""
    },
    patientEmail: {
      type: String,
      default: ""
    },
    test: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LabTest",
      required: true
    },
    testName: {
      type: String,
      required: true
    },
    category: {
      type: String,
      default: "General"
    },
    price: {
      type: Number,
      required: true
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital"
    },
    hospitalName: {
      type: String,
      default: "Central Diagnostic Lab"
    },
    bookingDate: {
      type: Date,
      required: true
    },
    slotTime: {
      type: String,
      default: "09:00 AM - 10:00 AM"
    },
    collectionType: {
      type: String,
      enum: ["lab_visit", "home_collection"],
      default: "lab_visit"
    },
    sampleAddress: {
      type: String,
      default: ""
    },
    status: {
      type: String,
      enum: ["scheduled", "sample_collected", "processing", "completed", "cancelled"],
      default: "scheduled"
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "refunded"],
      default: "paid"
    },
    notes: {
      type: String,
      default: ""
    },
    results: [
      {
        parameter: { type: String, required: true },
        value: { type: String, required: true },
        unit: { type: String, default: "" },
        referenceRange: { type: String, default: "" },
        flag: { type: String, enum: ["normal", "high", "low", "abnormal"], default: "normal" }
      }
    ],
    doctorImpression: {
      type: String,
      default: ""
    },
    verifiedBy: {
      type: String,
      default: "Chief Pathologist, MD"
    },
    completedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("LabBooking", labBookingSchema);
