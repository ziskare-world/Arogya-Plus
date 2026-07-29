const mongoose = require("mongoose");

const emergencySchema = new mongoose.Schema(
  {
    patientName: {
      type: String,
      required: [true, "Patient name is required"],
      trim: true
    },
    contact: {
      type: String,
      required: [true, "Contact number is required"],
      trim: true
    },
    symptoms: [
      {
        type: String,
        trim: true
      }
    ],
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium"
    },
    status: {
      type: String,
      enum: ["waiting", "in_progress", "resolved"],
      default: "waiting"
    },
    location: {
      type: String,
      required: [true, "Location is required"],
      trim: true
    },
    latitude: {
      type: Number,
      default: 28.6139
    },
    longitude: {
      type: Number,
      default: 77.2090
    },
    assignedDoctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Emergency", emergencySchema);
