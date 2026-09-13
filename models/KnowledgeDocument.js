const mongoose = require("mongoose");

const knowledgeDocumentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    originalFilename: String,
    mimeType: String,
    category: {
      type: String,
      default: "general",
      index: true
    },
    project: {
      type: String,
      default: "default",
      index: true
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    chunkCount: {
      type: Number,
      default: 0
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    summary: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("KnowledgeDocument", knowledgeDocumentSchema);
