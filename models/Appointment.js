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
