const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      index: true
    },
    category: {
      type: String,
      enum: ["AUTH", "PATIENT", "APPOINTMENT", "EMERGENCY", "PAYMENT", "SYSTEM", "LAB", "DOCTOR"],
      default: "SYSTEM",
      index: true
    },
    severity: {
      type: String,
      enum: ["info", "warning", "critical", "error"],
      default: "info",
      index: true
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: ""
    },
    actor: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, default: "System" },
      role: { type: String, default: "system" },
      email: { type: String, default: "" }
    },
    targetId: {
      type: String,
      default: null
    },
    ipAddress: {
      type: String,
      default: "127.0.0.1"
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      default: null
    },
    hospitalName: {
      type: String,
      default: ""
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
