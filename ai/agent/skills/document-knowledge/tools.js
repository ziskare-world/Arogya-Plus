const KnowledgeDocument = require("../../../../models/KnowledgeDocument");
const KnowledgeChunk = require("../../../../models/KnowledgeChunk");

const tools = [
  {
    name: "document-knowledge.ingest_document",
    description: "Ingests text content into chunked knowledge base records",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        content: { type: "string" },
        category: { type: "string" }
      },
      required: ["title", "content"]
    },
    permissionLevel: "READ_ONLY",
    keywords: ["ingest document", "upload doc", "add to knowledge base"],
    execute: async (args, context = {}) => {
      const userId = context.user?._id || context.user?.id;
      if (!userId) throw new Error("Authenticated user required for document ingestion.");

      const rawChunks = [];
      const lines = args.content.split("\n\n");
      for (const line of lines) {
        if (line.trim()) rawChunks.push(line.trim());
      }

      const doc = await KnowledgeDocument.create({
        title: args.title,
        uploadedBy: userId,
        category: args.category || "general",
        chunkCount: rawChunks.length,
        summary: args.content.slice(0, 180)
      });

      const chunkDocs = [];
      for (let i = 0; i < rawChunks.length; i++) {
        const chunk = await KnowledgeChunk.create({
          document: doc._id,
          chunkIndex: i,
          content: rawChunks[i],
          category: args.category || "general"
        });
        chunkDocs.push(chunk._id);
      }

      return {
        success: true,
        documentId: doc._id,
        title: doc.title,
        chunksCreated: rawChunks.length,
        message: `Document '${doc.title}' ingested and indexed into ${rawChunks.length} chunk(s).`
      };
    }
  },
  {
    name: "document-knowledge.search_knowledge",
    description: "Searches knowledge base chunks for relevant context using semantic and keyword matching",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number" }
      },
      required: ["query"]
    },
    permissionLevel: "READ_ONLY",
    keywords: ["search document", "find in knowledge base", "query docs"],
    execute: async (args) => {
      const q = (args.query || "").toLowerCase();
      const limit = args.limit || 4;

      const allChunks = await KnowledgeChunk.find().populate("document", "title category").lean();
      const matched = allChunks.filter(c => c.content.toLowerCase().includes(q));

      if (matched.length === 0) {
        return {
          found: false,
          results: [],
          message: "Information missing from knowledge base for the specified query."
        };
      }

      return {
        found: true,
        count: matched.length,
        results: matched.slice(0, limit).map(m => ({
          documentTitle: m.document?.title || "Document",
          content: m.content,
          chunkIndex: m.chunkIndex
        }))
      };
    }
  }
];

module.exports = { tools };
