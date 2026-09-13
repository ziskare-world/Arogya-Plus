const SUBAGENTS = [
  { id: "chat_agent", name: "Chat Agent", skill: "general-chatbot", role: "Conversational interactions" },
  { id: "helpdesk_agent", name: "Help-Desk Agent", skill: "helpdesk-support", role: "Support tickets and FAQ" },
  { id: "automation_agent", name: "Automation Agent", skill: "automation-engine", role: "Workflow execution" },
  { id: "knowledge_agent", name: "Knowledge Agent", skill: "document-knowledge", role: "RAG search & chunking" },
  { id: "coding_agent", name: "Coding Agent", skill: "coding-assistant", role: "Architecture & test generation" },
  { id: "project_agent", name: "Project Agent", skill: "project-management", role: "Tasks and milestones" },
  { id: "reporting_agent", name: "Reporting Agent", skill: "notification-reporting", role: "Executive daily reports" },
  { id: "security_agent", name: "Security Agent", skill: "healthcare-support", role: "Permission and emergency guard" }
];

const tools = [
  {
    name: "multi-agent-coordination.list_active_subagents",
    description: "Returns the roster of specialized sub-agents and their operational boundaries",
    inputSchema: { type: "object", properties: {} },
    permissionLevel: "READ_ONLY",
    keywords: ["subagents", "agent roster", "agent team"],
    execute: async () => {
      return {
        totalAgents: SUBAGENTS.length,
        maxDepth: 4,
        loopPreventionActive: true,
        agents: SUBAGENTS
      };
    }
  },
  {
    name: "multi-agent-coordination.delegate_to_subagent",
    description: "Delegates a specific sub-task to a specialized agent with contract validation",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string" },
        task: { type: "string" }
      },
      required: ["agentId", "task"]
    },
    permissionLevel: "READ_ONLY",
    keywords: ["delegate task", "assign agent", "subagent run"],
    execute: async (args) => {
      const target = SUBAGENTS.find(a => a.id === args.agentId);
      if (!target) {
        throw new Error(`Subagent '${args.agentId}' not found. Available: ${SUBAGENTS.map(a => a.id).join(", ")}`);
      }

      return {
        delegationId: `del_${Date.now()}`,
        assignedAgent: target.name,
        targetSkill: target.skill,
        status: "delegated",
        summary: `Task '${args.task}' delegated to ${target.name}.`
      };
    }
  }
];

module.exports = { tools };
