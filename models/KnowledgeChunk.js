const mongoose = require("mongoose");

const knowledgeChunkSchema = new mongoose.Schema(
  {
    document: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KnowledgeDocument",
      required: true,
      index: true
    },
    chunkIndex: {
      type: Number,
      required: true
    },
    content: {
      type: String,
      required: true
    },
    tokenCount: Number,
    embedding: [Number], // Stored vector embedding
    category: {
      type: String,
      default: "general",
      index: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

knowledgeChunkSchema.index({ document: 1, chunkIndex: 1 });

module.exports = mongoose.model("KnowledgeChunk", knowledgeChunkSchema);
