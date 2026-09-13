const AgentTask = require("../../../../models/AgentTask");

const tools = [
  {
    name: "project-management.manage_task",
    description: "Creates or tracks project tasks with priority and deadlines",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        priority: { type: "string" },
        deadline: { type: "string" }
      },
      required: ["title"]
    },
    permissionLevel: "READ_ONLY",
    keywords: ["create project task", "add task", "project task"],
    execute: async (args, context = {}) => {
      const userId = context.user?._id || context.user?.id;
      let taskDoc = null;
      if (userId) {
        taskDoc = await AgentTask.create({
          title: args.title,
          description: `Deadline: ${args.deadline || "TBD"} | Priority: ${args.priority || "Medium"}`,
          user: userId,
          status: "pending",
          skillId: "project-management"
        });
      }
      return {
        success: true,
        taskId: taskDoc?._id,
        title: args.title,
        status: "pending",
        message: `Project task '${args.title}' created successfully.`
      };
    }
  },
  {
    name: "project-management.get_project_status",
    description: "Summarizes active milestones and pending tasks",
    inputSchema: { type: "object", properties: {} },
    permissionLevel: "READ_ONLY",
    keywords: ["project status", "project progress", "milestones"],
    execute: async (args, context = {}) => {
      const userId = context.user?._id || context.user?.id;
      let count = 0;
      if (userId) {
        count = await AgentTask.countDocuments({ user: userId, skillId: "project-management" });
      }
      return {
        project: "ArogyaPlus Clinical Platform",
        activeTasksCount: count,
        currentPhase: "Production Scaling",
        milestones: [
          { name: "Multi-Agent System", status: "In-Progress" },
          { name: "Emergency Dispatch & GIS", status: "Completed" }
        ]
      };
    }
  }
];

module.exports = { tools };
