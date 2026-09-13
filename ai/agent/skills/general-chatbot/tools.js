const { queryQwenAgent } = require("../../../qwenBridge");

const tools = [
  {
    name: "general-chatbot.chat",
    description: "Engages in conversational question answering and empathetic dialogue",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string" }
      },
      required: ["message"]
    },
    permissionLevel: "READ_ONLY",
    keywords: ["hello", "hi", "help", "chat", "explain", "who are you"],
    execute: async (args) => {
      const qwenRes = await queryQwenAgent({
        messages: [{ role: "user", content: args.message }],
        maxNewTokens: 120
      });
      return {
        reply: qwenRes.reply,
        model: qwenRes.model,
        provider: qwenRes.provider
      };
    }
  },
  {
    name: "general-chatbot.summarize",
    description: "Summarizes text into concise bullet points",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" }
      },
      required: ["text"]
    },
    permissionLevel: "READ_ONLY",
    keywords: ["summarize", "tldr", "brief"],
    execute: async (args) => {
      const qwenRes = await queryQwenAgent({
        messages: [
          { role: "system", content: "Summarize the text clearly into key bullet points." },
          { role: "user", content: args.text }
        ],
        maxNewTokens: 150
      });
      return { summary: qwenRes.reply };
    }
  }
];

module.exports = { tools };
