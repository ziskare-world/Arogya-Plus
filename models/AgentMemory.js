const mongoose = require("mongoose");

const agentMemorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ["preference", "fact", "task_history", "conversation_context", "workflow_state"],
      default: "fact",
      index: true
    },
    key: {
      type: String,
      required: true,
      trim: true
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    category: {
      type: String,
      default: "general",
      index: true
    },
    confidence: {
      type: Number,
      default: 1.0
    },
    tags: [String],
    source: {
      type: String,
      default: "conversation"
    },
    expiresAt: {
      type: Date
    }
  },
  { timestamps: true }
);

agentMemorySchema.index({ user: 1, key: 1 });

module.exports = mongoose.model("AgentMemory", agentMemorySchema);
