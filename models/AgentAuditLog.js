const mongoose = require("mongoose");

const agentAuditLogSchema = new mongoose.Schema(
  {
    executionId: {
      type: String,
      required: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    skill: String,
    tool: String,
    action: String,
    permissionLevel: {
      type: String,
      enum: [
        "READ_ONLY",
        "DRAFT_ONLY",
        "USER_APPROVAL_REQUIRED",
        "ADMIN_APPROVAL_REQUIRED",
        "FULLY_AUTOMATED_APPROVED_TASK"
      ]
    },
    status: {
      type: String,
      enum: ["success", "failed", "blocked_by_security", "approval_requested"],
      default: "success",
      index: true
    },
    inputSummary: mongoose.Schema.Types.Mixed,
    outputSummary: mongoose.Schema.Types.Mixed,
    errorMessage: String,
    durationMs: Number,
    ipAddress: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("AgentAuditLog", agentAuditLogSchema);
