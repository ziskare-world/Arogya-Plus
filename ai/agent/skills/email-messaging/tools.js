const tools = [
  {
    name: "email-messaging.draft_email",
    description: "Prepares a structured email draft without sending",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string" },
        subject: { type: "string" },
        topic: { type: "string" }
      },
      required: ["to", "subject"]
    },
    permissionLevel: "DRAFT_ONLY",
    keywords: ["draft email", "compose email", "write email"],
    execute: async (args) => {
      const body = `Dear Patient/Colleague,\n\nRegarding ${args.topic || args.subject}: Please find the clinical and appointment information requested.\n\nWarm regards,\nArogyaPlus Team`;
      return {
        draftId: `draft_${Date.now()}`,
        to: args.to,
        subject: args.subject,
        body,
        status: "drafted",
        message: "Draft created successfully. Awaiting approval to send."
      };
    }
  },
  {
    name: "email-messaging.send_email",
    description: "Sends an approved email to an external address (Requires explicit human approval)",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" }
      },
      required: ["to", "subject", "body"]
    },
    permissionLevel: "USER_APPROVAL_REQUIRED",
    keywords: ["send email", "dispatch email"],
    execute: async (args) => {
      return {
        success: true,
        to: args.to,
        subject: args.subject,
        sentAt: new Date().toISOString(),
        deliveryStatus: "dispatched",
        message: `Email dispatched successfully to ${args.to}.`
      };
    }
  }
];

module.exports = { tools };
