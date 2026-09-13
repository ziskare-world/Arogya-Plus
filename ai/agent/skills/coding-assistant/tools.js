const { queryQwenAgent } = require("../../../qwenBridge");

const tools = [
  {
    name: "coding-assistant.explain_code",
    description: "Explains code snippets and architecture patterns clearly",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string" },
        language: { type: "string" }
      },
      required: ["code"]
    },
    permissionLevel: "READ_ONLY",
    keywords: ["explain code", "what does this code do", "code review"],
    execute: async (args) => {
      const qwenRes = await queryQwenAgent({
        messages: [
          { role: "system", content: "You are a senior software architect. Explain this code cleanly with time complexity and design patterns." },
          { role: "user", content: args.code }
        ],
        maxNewTokens: 200
      });
      return { explanation: qwenRes.reply };
    }
  },
  {
    name: "coding-assistant.generate_tests",
    description: "Generates Jest or unit test templates for a given function",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string" }
      },
      required: ["code"]
    },
    permissionLevel: "READ_ONLY",
    keywords: ["write tests", "generate unit test", "jest test"],
    execute: async (args) => {
      const qwenRes = await queryQwenAgent({
        messages: [
          { role: "system", content: "Generate clean Jest unit tests covering happy paths, edge cases, and error states." },
          { role: "user", content: args.code }
        ],
        maxNewTokens: 200
      });
      return { testSuite: qwenRes.reply };
    }
  }
];

module.exports = { tools };
