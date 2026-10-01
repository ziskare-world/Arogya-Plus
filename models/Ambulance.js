const mongoose = require("mongoose");

const ambulanceSchema = new mongoose.Schema(
  {
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
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
      phone: { type: String, trim: true },
      age: { type: Number, min: 0, max: 130 },
      gender: { type: String, enum: ["male", "female", "other"] }
    },
    locationType: {
      type: String,
      enum: ["current", "remote_saved", "custom_remote"],
      default: "current"
    },
    pickupLocation: {
      type: String,
      required: [true, "Pickup location is required"],
      trim: true
    },
    problemDescription: {
      type: String,
      trim: true
    },
    pickupCoordinates: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 }
    },
    aiDispatch: {
      autoDispatched: { type: Boolean, default: false },
      dispatchReason: { type: String, trim: true },
      severityScore: { type: Number, min: 0, max: 10 },
      priority: { type: String, enum: ["low", "medium", "high", "critical"], default: "high" }
    },
    hospitalLocation: {
      type: String,
      required: [true, "Hospital location is required"],
      trim: true
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
    hospitalCoordinates: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 }
    },
    assignedDoctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    assignedDoctorName: {
      type: String,
      trim: true
    },
    assignedDoctorSpecialization: {
      type: String,
      trim: true
    },
    doctorAvailabilityStatus: {
      type: String,
      enum: ["free", "busy", "unassigned"],
      default: "unassigned"
    },
    assignedAmbulance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AmbulanceFleet"
    },
    assignedAmbulanceVehicleNumber: {
      type: String,
      trim: true
    },
    ambulanceCoordinates: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 }
    },
    status: {
      type: String,
      enum: ["requested", "dispatched", "arrived", "completed", "cancelled"],
      default: "requested"
    },
    driverName: {
      type: String,
      trim: true
    },
    vehicleNumber: {
      type: String,
      trim: true
    },
    etaMinutes: {
      type: Number,
      min: 0
    },
    lastLocationUpdatedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ambulance", ambulanceSchema);
