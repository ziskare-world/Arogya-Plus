const mongoose = require("mongoose");

const agentTaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    status: {
      type: String,
      enum: [
        "pending",
        "planning",
        "in_progress",
        "awaiting_approval",
        "completed",
        "failed",
        "cancelled"
      ],
      default: "pending",
      index: true
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExecutionPlan"
    },
    skillId: {
      type: String,
      trim: true
    },
    steps: [
      {
        stepNumber: Number,
        name: String,
        tool: String,
        status: {
          type: String,
          enum: ["pending", "in_progress", "completed", "failed", "skipped"],
          default: "pending"
        },
        input: mongoose.Schema.Types.Mixed,
        output: mongoose.Schema.Types.Mixed,
        error: String,
        startedAt: Date,
        completedAt: Date
      }
    ],
    executionDurationMs: {
      type: Number,
      default: 0
    },
    error: {
      type: String
    },
    result: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  { timestamps: true }
);

agentTaskSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("AgentTask", agentTaskSchema);
