const mongoose = require("mongoose");

const workflowExecutionSchema = new mongoose.Schema(
  {
    workflow: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workflow",
      required: true,
      index: true
    },
    triggeredBy: {
      type: String,
      enum: ["schedule", "event", "webhook", "manual"],
      default: "manual"
    },
    status: {
      type: String,
      enum: ["running", "completed", "failed", "cancelled"],
      default: "running",
      index: true
    },
    stepResults: [
      {
        stepId: String,
        skill: String,
        action: String,
        status: String,
        output: mongoose.Schema.Types.Mixed,
        error: String,
        durationMs: Number
      }
    ],
    durationMs: {
      type: Number,
      default: 0
    },
    error: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("WorkflowExecution", workflowExecutionSchema);
