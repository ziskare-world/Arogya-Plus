const mongoose = require("mongoose");

const agentMemorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    tier: {
      type: String,
      enum: ["working", "episodic", "semantic", "procedural"],
      default: "semantic",
      index: true
    },
    type: {
      type: String,
      enum: ["preference", "fact", "task_history", "conversation_context", "workflow_state", "clinical_entity", "reflection"],
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
      default: 1.0,
      min: 0,
      max: 1.0
    },
    importance: {
      type: Number,
      default: 3,
      min: 1,
      max: 5,
      index: true
    },
    pinned: {
      type: Boolean,
      default: false,
      index: true
    },
    accessCount: {
      type: Number,
      default: 0
    },
    lastAccessedAt: {
      type: Date,
      default: Date.now
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
agentMemorySchema.index({ user: 1, tier: 1, importance: -1 });
agentMemorySchema.index({ user: 1, category: 1 });
agentMemorySchema.index({ user: 1, pinned: -1, updatedAt: -1 });

module.exports = mongoose.model("AgentMemory", agentMemorySchema);
