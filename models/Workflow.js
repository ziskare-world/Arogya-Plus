const mongoose = require("mongoose");

const workflowSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Workflow name is required"],
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
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    isPaused: {
      type: Boolean,
      default: false
    },
    trigger: {
      type: {
        type: String,
        enum: ["schedule", "event", "webhook", "manual"],
        default: "manual"
      },
      expression: String, // Cron expression for schedule
      eventPattern: String, // Event name for event-driven
      webhookSecret: String
    },
    steps: [
      {
        stepId: String,
        skill: {
          type: String,
          required: true
        },
        action: {
          type: String,
          required: true
        },
        arguments: mongoose.Schema.Types.Mixed,
        continueOnError: {
          type: Boolean,
          default: false
        }
      }
    ],
    lastExecutedAt: Date,
    executionCount: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Workflow", workflowSchema);
