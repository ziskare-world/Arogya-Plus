const mongoose = require("mongoose");
const { hospitalOperationsAgent } = require("../../../agents/hospitalOperationsAgent");

const tools = [
  {
    name: "system-monitoring.check_health",
    description: "Inspects API services, database connection, and system uptime",
    inputSchema: { type: "object", properties: {} },
    permissionLevel: "READ_ONLY",
    keywords: ["system health", "service status", "check uptime", "is system running"],
    execute: async () => {
      const dbState = mongoose.connection.readyState === 1 ? "connected" : "connecting/disconnected";
      return {
        status: "operational",
        api: "healthy",
        database: dbState,
        uptimeSeconds: Math.round(process.uptime()),
        memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        timestamp: new Date().toISOString()
      };
    }
  },
  {
    name: "system-monitoring.get_telemetry_metrics",
    description: "Gathers live hospital bed occupancy, emergency queue, and fleet telemetry",
    inputSchema: { type: "object", properties: {} },
    permissionLevel: "READ_ONLY",
    keywords: ["telemetry metrics", "hospital load", "system load"],
    execute: async () => {
      return await hospitalOperationsAgent.getOperationalInsights();
    }
  }
];

module.exports = { tools };
