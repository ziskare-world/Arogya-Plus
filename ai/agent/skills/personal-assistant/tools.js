const { memoryManager } = require("../../core/memoryManager");

const tools = [
  {
    name: "personal-assistant.create_reminder",
    description: "Creates an intelligent scheduled reminder for the user",
    inputSchema: {
      type: "object",
      properties: {
        reminder: { type: "string" },
        datetime: { type: "string" }
      },
      required: ["reminder"]
    },
    permissionLevel: "READ_ONLY",
    keywords: ["remind me", "set reminder", "create reminder"],
    execute: async (args, context = {}) => {
      const userId = context.user?._id || context.user?.id;
      if (userId) {
        await memoryManager.setMemory({
          userId,
          type: "task_history",
          key: `reminder_${Date.now()}`,
          value: { text: args.reminder, due: args.datetime || "Today", status: "pending" },
          category: "reminders",
          tags: ["reminder", "personal"]
        });
      }
      return {
        success: true,
        reminder: args.reminder,
        due: args.datetime || "Pending schedule",
        message: `Reminder scheduled: "${args.reminder}".`
      };
    }
  },
  {
    name: "personal-assistant.add_note",
    description: "Saves a quick note to long-term memory",
    inputSchema: {
      type: "object",
      properties: {
        note: { type: "string" },
        category: { type: "string" }
      },
      required: ["note"]
    },
    permissionLevel: "READ_ONLY",
    keywords: ["note down", "take note", "save note", "remember that"],
    execute: async (args, context = {}) => {
      const userId = context.user?._id || context.user?.id;
      if (userId) {
        await memoryManager.setMemory({
          userId,
          type: "fact",
          key: `note_${Date.now()}`,
          value: args.note,
          category: args.category || "notes",
          tags: ["note"]
        });
      }
      return {
        success: true,
        note: args.note,
        message: "Note saved successfully to your memory."
      };
    }
  },
  {
    name: "personal-assistant.get_daily_summary",
    description: "Produces an executive daily summary of tasks and appointments",
    inputSchema: { type: "object", properties: {} },
    permissionLevel: "READ_ONLY",
    keywords: ["daily summary", "what is my schedule", "daily agenda"],
    execute: async (args, context = {}) => {
      const userId = context.user?._id || context.user?.id;
      let memories = [];
      if (userId) {
        memories = await memoryManager.getMemories(userId);
      }
      return {
        summary: `You have ${memories.length} item(s) logged in your personal vault. Remember to stay hydrated and check pending appointments.`,
        activeItemsCount: memories.length
      };
    }
  }
];

module.exports = { tools };
