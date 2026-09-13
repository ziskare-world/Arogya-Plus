const mongoose = require("mongoose");

const approvalRequestSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AgentTask"
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExecutionPlan"
    },
    stepId: {
      type: String
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    actionName: {
      type: String,
      required: true
    },
    skillName: {
      type: String,
      required: true
    },
    permissionLevel: {
      type: String,
      enum: ["USER_APPROVAL_REQUIRED", "ADMIN_APPROVAL_REQUIRED"],
      default: "USER_APPROVAL_REQUIRED"
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "expired"],
      default: "pending",
      index: true
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    reviewedAt: {
      type: Date
    },
    reason: {
      type: String
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("ApprovalRequest", approvalRequestSchema);
