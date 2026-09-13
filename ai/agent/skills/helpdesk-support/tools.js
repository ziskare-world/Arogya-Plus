const SupportTicket = require("../../../../models/SupportTicket");

const FAQS = [
  {
    question: "How do I book an appointment with a doctor?",
    answer: "Go to the Appointments page, pick your preferred specialist, select a date and time slot, and confirm."
  },
  {
    question: "How do I request an emergency ambulance?",
    answer: "Click the Emergency SOS button on your dashboard or call 108 immediately. GPS dispatch is available 24/7."
  },
  {
    question: "Where can I view my prescriptions?",
    answer: "Your active prescriptions are available under 'Medical Records' > 'Prescriptions' tab in your patient portal."
  },
  {
    question: "How does payment and billing work?",
    answer: "You can pay your clinic or consultation bills securely via Razorpay UPI, cards, net banking, or instant QR."
  }
];

const tools = [
  {
    name: "helpdesk-support.search_faq",
    description: "Searches knowledge base FAQs for customer assistance",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"]
    },
    permissionLevel: "READ_ONLY",
    keywords: ["faq", "frequently asked", "how do i", "help me with"],
    execute: async (args) => {
      const q = (args.query || "").toLowerCase();
      const matched = FAQS.filter(f => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q));
      if (matched.length > 0) {
        return { matchedFaqs: matched };
      }
      return {
        matchedFaqs: FAQS.slice(0, 2),
        note: "No exact match found. Displaying general healthcare FAQs."
      };
    }
  },
  {
    name: "helpdesk-support.create_ticket",
    description: "Creates a new customer support ticket in the database",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        category: { type: "string" },
        priority: { type: "string" }
      },
      required: ["title", "description"]
    },
    permissionLevel: "READ_ONLY",
    keywords: ["create ticket", "support ticket", "raise ticket", "report issue"],
    execute: async (args, context = {}) => {
      const userId = context.user?._id || context.user?.id;
      if (!userId) {
        return {
          success: false,
          error: "User must be authenticated to create a support ticket."
        };
      }

      const ticketNumber = `TCK-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
      const slaDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours SLA

      const ticket = await SupportTicket.create({
        ticketNumber,
        user: userId,
        title: args.title,
        description: args.description,
        category: args.category || "general",
        priority: args.priority || "medium",
        status: "open",
        slaDeadline,
        conversationHistory: [
          {
            sender: "user",
            message: args.description,
            timestamp: new Date()
          }
        ]
      });

      return {
        success: true,
        ticketNumber: ticket.ticketNumber,
        ticketId: ticket._id,
        status: ticket.status,
        slaDeadline: ticket.slaDeadline,
        message: `Support ticket ${ticket.ticketNumber} created successfully. Our team will review within 24 hours.`
      };
    }
  },
  {
    name: "helpdesk-support.list_tickets",
    description: "Lists support tickets for the current user",
    inputSchema: { type: "object", properties: {} },
    permissionLevel: "READ_ONLY",
    keywords: ["my tickets", "ticket status", "view tickets"],
    execute: async (args, context = {}) => {
      const userId = context.user?._id || context.user?.id;
      if (!userId) return { tickets: [] };

      const tickets = await SupportTicket.find({ user: userId }).sort({ createdAt: -1 }).limit(10).lean();
      return { tickets };
    }
  }
];

module.exports = { tools };
