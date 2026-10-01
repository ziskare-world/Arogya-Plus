const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      default: null
    },
    hospitalName: {
      type: String,
      trim: true
    },
    appointmentDate: {
      type: Date,
      required: [true, "Appointment date is required"]
    },
    reason: {
      type: String,
      required: [true, "Appointment reason is required"],
      trim: true
    },
    consultationType: {
      type: String,
      enum: ["in_person", "video"],
      default: "in_person"
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled"],
      default: "pending"
    },
    bookedFor: {
      type: String,
      enum: ["self", "family"],
      default: "self"
    },
    familyMemberId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    patientDetails: {
      name: { type: String, trim: true },
      relationship: { type: String, trim: true },
      age: { type: Number, min: 0, max: 130 },
      gender: { type: String, enum: ["male", "female", "other"] },
      bloodGroup: { type: String, trim: true },
      phone: { type: String, trim: true }
    },
    locationType: {
      type: String,
      enum: ["current", "remote_saved", "custom_remote", "hospital"],
      default: "current"
    },
    patientLocation: {
      address: { type: String, trim: true },
      city: { type: String, trim: true },
      coordinates: {
        lat: { type: Number, min: -90, max: 90 },
        lng: { type: Number, min: -180, max: 180 }
      }
    },
    aiTriage: {
      symptoms: [{ type: String, trim: true }],
      predictedSpecialty: { type: String, trim: true },
      urgencyLevel: {
        type: String,
        enum: ["low", "medium", "high", "critical"]
      },
      diagnosisHint: { type: String, trim: true },
      autoAssigned: { type: Boolean, default: false },
      confidence: { type: Number, min: 0, max: 1 }
    },
    tokenNumber: {
      type: String,
      required: true,
      unique: true
    },
    notes: {
      type: String,
      trim: true
    },
    doctorRating: {
      type: Number,
      min: 1,
      max: 5
    },
    doctorReview: {
      type: String,
      trim: true
    },
    ratedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Appointment", appointmentSchema);
