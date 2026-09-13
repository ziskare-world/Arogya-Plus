/**
 * 🧠 AgentOrchestrator - Central Multi-Agent Router & Intent Dispatcher
 * Coordinates TalkingAgent, TriageAgent, AppointmentAgent, ClinicalNotesAgent, and HospitalOperationsAgent.
 */

const { talkingAgent } = require("./talkingAgent");
const { triageAgent } = require("./triageAgent");
const { appointmentAgent } = require("./appointmentAgent");
const { clinicalNotesAgent } = require("./clinicalNotesAgent");
const { hospitalOperationsAgent } = require("./hospitalOperationsAgent");

class AgentOrchestrator {
  constructor() {
    this.talkingAgent = talkingAgent;
    this.triageAgent = triageAgent;
    this.appointmentAgent = appointmentAgent;
    this.clinicalNotesAgent = clinicalNotesAgent;
    this.hospitalOperationsAgent = hospitalOperationsAgent;
  }

  /**
   * Classifies user intent based on input message
   * @param {string} message
   * @returns {string} Intent key
   */
  classifyIntent(message) {
    const text = String(message || "").toLowerCase();

    // Critical emergency & SOS red flags
    const redFlags = [
      "chest pain",
      "shortness of breath",
      "unconscious",
      "seizure",
      "heavy bleeding",
      "stroke",
      "heart attack",
      "can't breathe",
      "cannot breathe",
      "ambulance",
      "sos",
      "emergency"
    ];
    if (redFlags.some(rf => text.includes(rf))) {
      return "emergency_triage";
    }

    // Appointment and scheduling
    const appointmentKeywords = [
      "appointment",
      "schedule",
      "book",
      "consult",
      "doctor",
      "available slot",
      "reschedule"
    ];
    if (appointmentKeywords.some(kw => text.includes(kw))) {
      return "appointment_booking";
    }

    // Clinical notes & prescription structuring
    const clinicalKeywords = [
      "clinical note",
      "soap note",
      "prescribe",
      "prescription summary",
      "extract medicine",
      "rx draft"
    ];
    if (clinicalKeywords.some(kw => text.includes(kw))) {
      return "clinical_documentation";
    }

    // Hospital operational analytics
    const opKeywords = [
      "hospital capacity",
      "bed occupancy",
      "system load",
      "operational telemetry",
      "hospital metrics"
    ];
    if (opKeywords.some(kw => text.includes(kw))) {
      return "hospital_operations";
    }

    // Symptom query that warrants triage check
    const symptomKeywords = ["fever", "cough", "headache", "pain", "vomit", "stomach", "symptom"];
    if (symptomKeywords.some(kw => text.includes(kw))) {
      return "symptom_triage";
    }

    return "conversational_talking";
  }

  /**
   * Main dispatch entry point for chat and user queries
   * @param {Object} params
   * @param {string} params.message
   * @param {Array} [params.history=[]]
   * @param {Object} [params.user={}]
   * @returns {Promise<Object>}
   */
  async handleUserMessage({ message, history = [], user = {} }) {
    const intent = this.classifyIntent(message);

    switch (intent) {
      case "emergency_triage": {
        const triageResult = await this.triageAgent.evaluateSymptoms({ symptoms: [message] });
        const isCritical = triageResult.triageLevel === "critical";

        return {
          agent: "TriageAgent",
          intent,
          reply: isCritical
            ? `⚠️ **CRITICAL MEDICAL ALERT**: ${triageResult.recommendation}`
            : `🚨 **Triage Notice**: Based on your symptoms, we recommend ${triageResult.recommendation}`,
          triageLevel: triageResult.triageLevel,
          priorityScore: triageResult.priorityScore,
          action: {
            label: isCritical ? "🚑 Dispatch Ambulance Now" : "🩺 View Emergency Care",
            href: "ambulance-booking.html",
            variant: isCritical ? "danger" : "primary"
          },
          details: triageResult
        };
      }

      case "appointment_booking": {
        const appointmentResult = await this.appointmentAgent.recommendAppointment(message);
        return {
          agent: "AppointmentAgent",
          intent,
          reply: `📅 **Smart Appointment Match**: I have found an optimal slot for you in **${appointmentResult.department}** with **${appointmentResult.recommendedDoctor.name}** on **${appointmentResult.suggestedDate}** at **${appointmentResult.suggestedSlot}**. Click below to confirm!`,
          triageLevel: "normal",
          action: {
            label: `📅 Confirm with ${appointmentResult.recommendedDoctor.name}`,
            href: appointmentResult.actionUrl,
            variant: "primary"
          },
          details: appointmentResult
        };
      }

      case "clinical_documentation": {
        const clinicalResult = await this.clinicalNotesAgent.processNotes(message);
        return {
          agent: "ClinicalNotesAgent",
          intent,
          reply: `📝 **Clinical Note Structured**: Assessment: **${clinicalResult.diagnosis}**. Extracted ${clinicalResult.medications.length} prescription medication(s).`,
          triageLevel: "normal",
          action: {
            label: "💊 View Prescriptions",
            href: "prescriptions.html",
            variant: "primary"
          },
          details: clinicalResult
        };
      }

      case "hospital_operations": {
        const ops = await this.hospitalOperationsAgent.getOperationalInsights();
        return {
          agent: "HospitalOperationsAgent",
          intent,
          reply: `📊 **Hospital Operations Status**: Current load is **${ops.systemLoad}**. Bed occupancy is at **${ops.metrics.occupancyRate}** with **${ops.metrics.availableAmbulances}** ambulances available.`,
          triageLevel: ops.systemLoad === "Critical Surge" ? "critical" : "normal",
          action: {
            label: "🏥 Admin Overview",
            href: "dashboard.html",
            variant: "primary"
          },
          details: ops
        };
      }

      case "symptom_triage": {
        const triageResult = await this.triageAgent.evaluateSymptoms({ symptoms: [message] });
        const { reply } = await this.talkingAgent.chat(message, history);

        return {
          agent: "TalkingAgent+TriageAgent",
          intent,
          reply: `${reply}\n\n*Clinical Triage Level: **${triageResult.triageLevel.toUpperCase()}** (${triageResult.recommendedDepartment})*`,
          triageLevel: triageResult.triageLevel,
          action: {
            label: `🩺 Consult ${triageResult.recommendedDepartment}`,
            href: "doctors.html",
            variant: "primary"
          },
          details: triageResult
        };
      }

      case "conversational_talking":
      default: {
        const { reply, provider } = await this.talkingAgent.chat(message, history);
        return {
          agent: "TalkingAgent",
          intent,
          reply,
          triageLevel: "normal",
          provider,
          action: {
            label: "🩺 Explore Doctors",
            href: "doctors.html",
            variant: "primary"
          }
        };
      }
    }
  }
}

module.exports = {
  AgentOrchestrator,
  agentOrchestrator: new AgentOrchestrator()
};
