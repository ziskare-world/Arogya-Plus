const mongoose = require("mongoose");
const User = require("../../../../models/User");
const Appointment = require("../../../../models/Appointment");
const Hospital = require("../../../../models/Hospital");

const tools = [
  {
    name: "database-assistant.describe_schema",
    description: "Returns schema structure for authorized collections",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string" }
      },
      required: ["collection"]
    },
    permissionLevel: "READ_ONLY",
    keywords: ["describe schema", "collection structure", "database schema"],
    execute: async (args) => {
      const col = (args.collection || "").toLowerCase();
      if (col.includes("user")) {
        return {
          collection: "User",
          fields: ["name", "email", "phone", "role", "department", "isAvailable", "isActive", "createdAt"]
        };
      }
      if (col.includes("appointment")) {
        return {
          collection: "Appointment",
          fields: ["patient", "doctor", "appointmentDate", "reason", "status", "tokenNumber", "consultationType"]
        };
      }
      if (col.includes("hospital")) {
        return {
          collection: "Hospital",
          fields: ["name", "address", "latitude", "longitude", "totalBeds", "availableBeds", "specialty"]
        };
      }
      return {
        collection: col,
        availableCollections: ["User", "Appointment", "Hospital", "Emergency", "Prescription", "Payment"]
      };
    }
  },
  {
    name: "database-assistant.query_collection_stats",
    description: "Retrieves count and health metrics for authorized collections safely",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string" }
      }
    },
    permissionLevel: "READ_ONLY",
    keywords: ["database stats", "collection count", "record count"],
    execute: async (args) => {
      const userCount = await User.countDocuments().catch(() => 0);
      const apptCount = await Appointment.countDocuments().catch(() => 0);
      const hospCount = await Hospital.countDocuments().catch(() => 0);

      return {
        databaseState: "connected",
        totalUsers: userCount,
        totalAppointments: apptCount,
        totalHospitals: hospCount,
        queryTimestamp: new Date().toISOString()
      };
    }
  }
];

module.exports = { tools };
