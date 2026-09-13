const { triageAgent } = require("../../../agents/triageAgent");
const { appointmentAgent } = require("../../../agents/appointmentAgent");

const tools = [
  {
    name: "healthcare-support.triage_symptoms",
    description: "Evaluates patient symptoms, detects emergency red flags, and escalates to 108 Ambulance if critical",
    inputSchema: {
      type: "object",
      properties: {
        symptoms: { type: "array" },
        age: { type: "number" }
      },
      required: ["symptoms"]
    },
    permissionLevel: "READ_ONLY",
    keywords: ["fever", "chest pain", "headache", "cough", "symptom triage", "unconscious", "emergency"],
    execute: async (args) => {
      const assessment = await triageAgent.evaluateSymptoms({
        symptoms: args.symptoms,
        age: args.age || 30
      });
      return {
        triageLevel: assessment.triageLevel,
        priorityScore: assessment.priorityScore,
        requiresAmbulance: assessment.requiresAmbulance,
        recommendedDepartment: assessment.recommendedDepartment,
        recommendation: assessment.recommendation,
        disclaimer: "Arogya AI is an informational clinical guide and does not replace a certified physician. In critical distress, dial 108 immediately."
      };
    }
  },
  {
    name: "healthcare-support.book_appointment",
    description: "Matches available specialist doctors from the database and suggests scheduling slots",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string" }
      },
      required: ["prompt"]
    },
    permissionLevel: "READ_ONLY",
    keywords: ["book doctor", "consult specialist", "schedule appointment"],
    execute: async (args) => {
      const rec = await appointmentAgent.recommendAppointment(args.prompt);
      return {
        department: rec.department,
        suggestedDate: rec.suggestedDate,
        suggestedSlot: rec.suggestedSlot,
        recommendedDoctor: rec.recommendedDoctor,
        summary: rec.summary,
        actionUrl: rec.actionUrl
      };
    }
  },
  {
    name: "healthcare-support.navigate_records",
    description: "Provides guidance on locating EHR visit notes and active prescriptions",
    inputSchema: { type: "object", properties: {} },
    permissionLevel: "READ_ONLY",
    keywords: ["my records", "ehr", "view prescriptions", "past visits"],
    execute: async () => {
      return {
        portalSections: [
          { name: "Medical Records", url: "medical-records.html", desc: "Past visits, diagnoses, and lab attachments" },
          { name: "Prescriptions", url: "prescriptions.html", desc: "Active medications and dosage schedules" },
          { name: "Insurance", url: "insurance.html", desc: "Active policy numbers and claim reimbursement status" }
        ]
      };
    }
  }
];

module.exports = { tools };
