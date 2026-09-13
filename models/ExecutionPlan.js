const mongoose = require("mongoose");

const executionPlanSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AgentTask",
      required: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    goal: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ["draft", "active", "completed", "failed", "cancelled"],
      default: "draft"
    },
    steps: [
      {
        stepId: String,
        skill: String,
        tool: String,
        description: String,
        arguments: mongoose.Schema.Types.Mixed,
        dependsOn: [String],
        requiresApproval: {
          type: Boolean,
          default: false
        },
        permissionLevel: {
          type: String,
          enum: [
            "READ_ONLY",
            "DRAFT_ONLY",
            "USER_APPROVAL_REQUIRED",
            "ADMIN_APPROVAL_REQUIRED",
            "FULLY_AUTOMATED_APPROVED_TASK"
          ],
          default: "READ_ONLY"
        },
        status: {
          type: String,
          enum: ["pending", "waiting_approval", "in_progress", "completed", "failed", "skipped"],
          default: "pending"
        },
        retryCount: {
          type: Number,
          default: 0
        },
        maxRetries: {
          type: Number,
          default: 2
        },
        output: mongoose.Schema.Types.Mixed,
        error: String
      }
    ],
    currentStepIndex: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("ExecutionPlan", executionPlanSchema);
