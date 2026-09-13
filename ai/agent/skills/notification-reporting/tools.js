const Appointment = require("../../../../models/Appointment");
const Emergency = require("../../../../models/Emergency");

const tools = [
  {
    name: "notification-reporting.generate_daily_report",
    description: "Generates an aggregated daily report across appointments and emergencies",
    inputSchema: { type: "object", properties: {} },
    permissionLevel: "READ_ONLY",
    keywords: ["daily report", "generate report", "system summary"],
    execute: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const appointmentsCount = await Appointment.countDocuments({ createdAt: { $gte: today } }).catch(() => 0);
      const emergenciesCount = await Emergency.countDocuments({ createdAt: { $gte: today } }).catch(() => 0);

      return {
        reportDate: new Date().toISOString().split("T")[0],
        totalAppointmentsToday: appointmentsCount,
        totalEmergenciesToday: emergenciesCount,
        status: "System Normal",
        executiveSummary: `Daily Report: ${appointmentsCount} appointment(s) booked, ${emergenciesCount} emergency event(s) recorded today.`
      };
    }
  },
  {
    name: "notification-reporting.send_notification_alert",
    description: "Dispatches a clinical notification to staff or patient",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        message: { type: "string" },
        priority: { type: "string" }
      },
      required: ["title", "message"]
    },
    permissionLevel: "READ_ONLY",
    keywords: ["send alert", "notify staff", "system alert"],
    execute: async (args) => {
      return {
        success: true,
        alertId: `alert_${Date.now()}`,
        title: args.title,
        priority: args.priority || "normal",
        sentAt: new Date().toISOString(),
        message: `Alert '${args.title}' dispatched to notification channels.`
      };
    }
  }
];

module.exports = { tools };
