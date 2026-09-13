/**
 * 🧠 AgentOrchestrator - Central Multi-Agent Router & Intent Dispatcher
 * Coordinates TalkingAgent, TriageAgent, AppointmentAgent, ClinicalNotesAgent, and HospitalOperationsAgent.
 */

const { talkingAgent } = require("./talkingAgent");
const { triageAgent } = require("./triageAgent");
const { appointmentAgent } = require("./appointmentAgent");
const { clinicalNotesAgent } = require("./clinicalNotesAgent");
const { hospitalOperationsAgent } = require("./hospitalOperationsAgent");
const { selfLearningEngine } = require("../selfLearningEngine");

class AgentOrchestrator {
  constructor() {
    this.talkingAgent = talkingAgent;
    this.triageAgent = triageAgent;
    this.appointmentAgent = appointmentAgent;
    this.clinicalNotesAgent = clinicalNotesAgent;
    this.hospitalOperationsAgent = hospitalOperationsAgent;
    this.selfLearningEngine = selfLearningEngine;
  }

  /**
   * Classifies user intent based on input message
   * @param {string} message
   * @returns {string} Intent key
   */
  classifyIntent(message) {
    const raw = String(message || "").trim();
    const text = raw.toLowerCase();

    // 1. Help Commands (help, help <feature>, /help, etc.)
    if (
      text === "help" ||
      text === "help me" ||
      text === "options" ||
      text === "all options" ||
      text === "categories" ||
      text === "features" ||
      text.startsWith("help ") ||
      text.startsWith("help:") ||
      text.startsWith("/help")
    ) {
      return "platform_help";
    }

    // 2. Greeting & Platform Introduction Inquiries
    const greetingRegex = /^(hi|hello|hey|namaste|good\s*(morning|afternoon|evening)|hola|greeting|greetings)\b/i;
    const introKeywords = [
      "who are you",
      "what is arogya",
      "what is this",
      "tell me about yourself",
      "introduce yourself",
      "about you",
      "what can you do",
      "what services",
      "services you provide",
      "services we provide",
      "platform services",
      "what do you do",
      "how does this work"
    ];

    if (
      greetingRegex.test(raw) ||
      introKeywords.some((ik) => text.includes(ik)) ||
      text === "arogya" ||
      text === "arogya plus"
    ) {
      return "platform_introduction";
    }

    // 3. Critical emergency & SOS red flags
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
    if (redFlags.some((rf) => text.includes(rf))) {
      return "emergency_triage";
    }

    // 4. Appointment and scheduling
    const appointmentKeywords = [
      "appointment",
      "schedule",
      "book",
      "consult",
      "doctor",
      "available slot",
      "reschedule"
    ];
    if (appointmentKeywords.some((kw) => text.includes(kw))) {
      return "appointment_booking";
    }

    // 5. Clinical notes & prescription structuring
    const clinicalKeywords = [
      "clinical note",
      "soap note",
      "prescribe",
      "prescription summary",
      "extract medicine",
      "rx draft"
    ];
    if (clinicalKeywords.some((kw) => text.includes(kw))) {
      return "clinical_documentation";
    }

    // 6. Hospital operational analytics
    const opKeywords = [
      "hospital capacity",
      "bed occupancy",
      "system load",
      "operational telemetry",
      "hospital metrics",
      "nearest hospital",
      "find hospital",
      "hospital bed"
    ];
    if (opKeywords.some((kw) => text.includes(kw))) {
      return "hospital_operations";
    }

    // 7. Symptom query that warrants triage check
    const symptomKeywords = ["fever", "cough", "headache", "pain", "vomit", "stomach", "symptom"];
    if (symptomKeywords.some((kw) => text.includes(kw))) {
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
    const userId = user?._id || user?.id || null;

    // Retrieve learned profile insights for user personalization
    let learnedProfile = null;
    if (userId) {
      learnedProfile = await this.selfLearningEngine.getLearnedProfile(userId);
    }

    let responseResult = null;

    switch (intent) {
      case "platform_introduction": {
        const uName = user?.name ? `, ${user.name}` : "";
        const introReply = `👋 **Welcome to Arogya Plus${uName}!**\n\nI am **Arogya AI**, your 24/7 intelligent healthcare assistant and clinical triage copilot.\n\n🏥 **About Our Platform:**\n**Arogya Plus** is a next-generation unified digital health operations platform connecting patients, certified doctors, hospital networks, and emergency services into one seamless ecosystem.\n\n🩺 **Core Services We Provide:**\n• 📅 **Doctor Consultations & Appointments**: Search verified doctors across departments, check live schedules, and confirm appointments with instant token generation.\n• 🏥 **Nearest Hospital & Live Bed Telemetry**: Real-time tracking of verified hospitals in your area with live ICU, Oxygen, and ward bed occupancy.\n• 🚑 **108 Emergency Ambulance Dispatch**: One-tap rapid SOS dispatch with real-time GPS fleet tracking and critical response teams.\n• 🔍 **AI Symptom Checker & Clinical Triage**: Natural language diagnostic triage to assess medical urgency and recommend appropriate clinical specialists.\n• 💊 **Digital Prescriptions & Health Records (EHR)**: Secure storage and instant access to your active prescriptions, dosage schedules, and health records.\n• 👨‍⚕️ **Doctor Clinical Copilot**: Automated SOAP note generation, patient queue prioritization, and prescription drafting for physicians.\n\n💡 *Type **help** anytime to view all service categories, or type **help <feature>** (e.g. \`help doctor\` or \`help bed\`) for instant walkthroughs!*`;

        responseResult = {
          agent: "TalkingAgent",
          intent,
          reply: introReply,
          triageLevel: "normal",
          action: null,
          suggestions: [
            { label: "📅 Book a Doctor", prompt: "I want to book an appointment with a doctor" },
            { label: "🏥 Check Hospital Beds", prompt: "Show nearest hospital and bed availability" },
            { label: "🚑 Emergency SOS", action: "in-chat-sos" },
            { label: "❓ View All Help Options", prompt: "help" }
          ]
        };
        break;
      }

      case "platform_help": {
        let rawParam = String(message)
          .replace(/^(\/)?help(:|\s+)?/i, "")
          .trim()
          .toLowerCase();

        // Strip conversational filler words such as "me in", "me with", "me", "please"
        rawParam = rawParam
          .replace(/^(me\s+in\s+|me\s+with\s+|me\s+about\s+|with\s+|about\s+|please\s+)/i, "")
          .trim();

        // 1. All Categories Help Overview
        if (!rawParam || rawParam === "me" || rawParam === "options" || rawParam === "all" || rawParam === "categories") {
          const helpMenu = `ℹ️ **Arogya Plus Help Center & Categories**\n\nWhich healthcare service or feature do you need assistance with? Type **help <feature>** or select a category below:\n\n1. 📅 **Doctor Appointments & Booking**: Type \`help appointment\`\n   *Find verified doctors, select time slots, and schedule consultations.*\n\n2. 🏥 **Hospitals & Live Bed Telemetry**: Type \`help hospital\` or \`help bed\`\n   *Locate verified facilities and monitor real-time ICU, Oxygen, and ward beds.*\n\n3. 🚑 **108 Emergency Ambulance Dispatch**: Type \`help ambulance\` or \`help sos\`\n   *Request emergency ambulance rescue with real-time GPS tracking.*\n\n4. 🔍 **AI Symptom Checker & Clinical Triage**: Type \`help symptoms\`\n   *Evaluate health symptoms, check severity level, and get specialist referrals.*\n\n5. 💊 **Prescriptions & Medical Records**: Type \`help prescriptions\`\n   *View active medications, dosage schedules, and clinical notes.*\n\n6. 👨‍⚕️ **Doctor Clinical Copilot**: Type \`help doctor\`\n   *Automate SOAP note generation, patient queues, and clinical workflows.*\n\n7. 🔐 **Account & Security**: Type \`help account\`\n   *Manage login, biometric passkeys, 2FA, and consultation syncing.*`;

          responseResult = {
            agent: "TalkingAgent",
            intent,
            reply: helpMenu,
            triageLevel: "normal",
            action: null,
            suggestions: [
              { label: "📅 Help: Appointments", prompt: "help appointment" },
              { label: "🏥 Help: Hospital & Beds", prompt: "help hospital" },
              { label: "🚑 Help: 108 Ambulance", prompt: "help ambulance" },
              { label: "🔍 Help: Symptom Checker", prompt: "help symptoms" },
              { label: "💊 Help: Prescriptions", prompt: "help prescriptions" },
              { label: "👨‍⚕️ Help: Doctor Copilot", prompt: "help doctor" },
              { label: "🔐 Help: Account & Login", prompt: "help account" }
            ]
          };
          break;
        }

        // 2. Specific Feature Help
        if (
          rawParam.includes("appointment") ||
          rawParam.includes("book") ||
          rawParam.includes("doctor") ||
          rawParam.includes("consult")
        ) {
          responseResult = {
            agent: "TalkingAgent",
            intent,
            reply: `📅 **Help: Booking Doctor Appointments**\n\n1. You can browse all verified specialists or search by department (Neurology, Cardiology, Pediatrics, General Medicine, etc.).\n2. Select your preferred date and available time slot.\n3. Click confirm to generate your confirmed consultation token.\n\n*Note: To confirm a booking, you will need to sign in or create a patient account. Your conversation will continue seamlessly after login!*`,
            triageLevel: "normal",
            action: {
              type: "explore_doctors",
              label: "🩺 Explore Doctors",
              href: "doctors.html",
              variant: "primary"
            },
            suggestions: [
              { label: "🩺 Explore All Doctors", prompt: "explore doctors" },
              { label: "📅 Book an Appointment", prompt: "I want to schedule an appointment with a doctor" }
            ]
          };
          break;
        }

        if (
          rawParam.includes("hospital") ||
          rawParam.includes("bed") ||
          rawParam.includes("capacity") ||
          rawParam.includes("occupancy")
        ) {
          responseResult = {
            agent: "TalkingAgent",
            intent,
            reply: `🏥 **Help: Hospital & Live Bed Occupancy**\n\n1. Arogya Plus uses GPS geolocation to connect you with our database-verified hospitals in your vicinity.\n2. You can view live bed capacity: Total Beds, Available Beds, ICU Beds, and Oxygen-Supported Beds.\n3. You can also view specialist doctors assigned under each hospital and book consultations directly!`,
            triageLevel: "normal",
            action: null,
            suggestions: [
              { label: "🏥 View Nearest Hospital & Beds", action: "nearest-hospital" },
              { label: "📊 Hospital Operations Status", prompt: "What is the hospital operations status and bed availability?" }
            ]
          };
          break;
        }

        if (
          rawParam.includes("ambulance") ||
          rawParam.includes("sos") ||
          rawParam.includes("emergency") ||
          rawParam.includes("108")
        ) {
          responseResult = {
            agent: "TalkingAgent",
            intent,
            reply: `🚨 **Help: 108 Emergency Ambulance Dispatch**\n\n1. In acute medical distress, you can request emergency ambulance dispatch directly through this chat.\n2. Confirm your pickup address and contact phone number.\n3. A 108 emergency vehicle is immediately assigned with real-time GPS tracking and estimated arrival time.\n\n*In life-threatening situations, always dial 108 immediately.*`,
            triageLevel: "critical",
            action: null,
            suggestions: [{ label: "🚨 Request 108 Ambulance", action: "in-chat-sos" }]
          };
          break;
        }

        if (
          rawParam.includes("symptom") ||
          rawParam.includes("triage") ||
          rawParam.includes("checker") ||
          rawParam.includes("diagnosis")
        ) {
          responseResult = {
            agent: "TalkingAgent",
            intent,
            reply: `🔍 **Help: AI Symptom Checker & Clinical Triage**\n\n1. Simply describe what you are feeling in your own words (e.g. *"I've had a fever and sore throat for 3 days"*).\n2. Our multi-agent triage system evaluates severity score (Normal vs Critical Alert).\n3. You receive recommended medical departments and direct links to certified physicians.`,
            triageLevel: "normal",
            action: null,
            suggestions: [{ label: "🔍 Check Symptoms", prompt: "I want to check my symptoms" }]
          };
          break;
        }

        if (
          rawParam.includes("prescription") ||
          rawParam.includes("rx") ||
          rawParam.includes("medicine") ||
          rawParam.includes("record")
        ) {
          responseResult = {
            agent: "TalkingAgent",
            intent,
            reply: `💊 **Help: Digital Prescriptions & Health Records (EHR)**\n\n1. All prescriptions issued by doctors are automatically logged into your digital health profile.\n2. You can check medication names, exact dosages, and frequency (BID, TID, OD).\n3. Access full EHR records anytime under your patient dashboard.`,
            triageLevel: "normal",
            action: null,
            suggestions: [{ label: "💊 Show My Prescriptions", prompt: "Show my active prescriptions" }]
          };
          break;
        }

        if (rawParam.includes("doctor") || rawParam.includes("portal") || rawParam.includes("soap")) {
          responseResult = {
            agent: "TalkingAgent",
            intent,
            reply: `👨‍⚕️ **Help: Doctor Clinical Copilot & Automation**\n\nFor verified medical practitioners:\n• **Patient Queue**: Live view of today's appointments and patient tokens.\n• **AI SOAP Notes**: Enter shorthand notes to auto-synthesize structured Subjective, Objective, Assessment, and Plan documentation.\n• **Rx Assistant**: Check drug dosages, interactions, and contraindications.`,
            triageLevel: "normal",
            action: null,
            suggestions: [
              { label: "📋 Today's Patient Queue", action: "doctor-queue" },
              { label: "📝 Auto SOAP Note", action: "doctor-soap" }
            ]
          };
          break;
        }

        if (
          rawParam.includes("account") ||
          rawParam.includes("login") ||
          rawParam.includes("signin") ||
          rawParam.includes("sign in") ||
          rawParam.includes("register") ||
          rawParam.includes("signup") ||
          rawParam.includes("sign up") ||
          rawParam.includes("password") ||
          rawParam.includes("auth")
        ) {
          responseResult = {
            agent: "TalkingAgent",
            intent,
            reply: `🔐 **Help: Account, Sign In & Security**\n\n1. You can sign in using Email/Password, Biometric Passkeys (fingerprint/face recognition), or 2FA TOTP.\n2. Guest chat consultations are automatically linked to your account upon login.\n3. Role-based portals are available for Patients, Doctors, and Administrators.`,
            triageLevel: "normal",
            action: null,
            suggestions: [{ label: "🔑 Sign In / Register", action: "in-chat-signin" }]
          };
          break;
        }

        responseResult = {
          agent: "TalkingAgent",
          intent,
          reply: `ℹ️ I couldn't find a specific feature named "${rawParam}". Type **help** to see all available service categories.`,
          triageLevel: "normal",
          action: null,
          suggestions: [{ label: "❓ View All Help Options", prompt: "help" }]
        };
        break;
      }

      case "emergency_triage": {
        const triageResult = await this.triageAgent.evaluateSymptoms({ symptoms: [message] });
        const isCritical = triageResult.triageLevel === "critical";

        responseResult = {
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
          details: triageResult,
          suggestions: [{ label: "🚨 Request 108 Ambulance", action: "in-chat-sos" }]
        };
        break;
      }

      case "appointment_booking": {
        const appointmentResult = await this.appointmentAgent.recommendAppointment(message);
        responseResult = {
          agent: "AppointmentAgent",
          intent,
          reply: `📅 **Smart Appointment Match**: I have found an optimal slot for you in **${appointmentResult.department}** with **${appointmentResult.recommendedDoctor.name}** on **${appointmentResult.suggestedDate}** at **${appointmentResult.suggestedSlot}**. Click below to confirm!`,
          triageLevel: "normal",
          action: {
            label: `📅 Confirm with ${appointmentResult.recommendedDoctor.name}`,
            href: appointmentResult.actionUrl,
            variant: "primary"
          },
          details: appointmentResult,
          suggestions: [
            { label: "🩺 View All Doctors", prompt: "explore doctors" },
            { label: "🏥 Check Nearest Hospital", action: "nearest-hospital" }
          ]
        };
        break;
      }

      case "clinical_documentation": {
        const clinicalResult = await this.clinicalNotesAgent.processNotes(message);
        responseResult = {
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
        break;
      }

      case "hospital_operations": {
        const ops = await this.hospitalOperationsAgent.getOperationalInsights();
        responseResult = {
          agent: "HospitalOperationsAgent",
          intent,
          reply: `📊 **Hospital Operations Status**: Current load is **${ops.systemLoad}**. Bed occupancy is at **${ops.metrics.occupancyRate}** with **${ops.metrics.availableAmbulances}** ambulances available.`,
          triageLevel: ops.systemLoad === "Critical Surge" ? "critical" : "normal",
          action: {
            label: "🏥 Admin Overview",
            href: "dashboard.html",
            variant: "primary"
          },
          details: ops,
          suggestions: [
            { label: "🏥 View Nearest Hospital & Beds", action: "nearest-hospital" },
            { label: "🩺 View Specialists", prompt: "explore doctors" }
          ]
        };
        break;
      }

      case "symptom_triage": {
        const triageResult = await this.triageAgent.evaluateSymptoms({ symptoms: [message] });
        const { reply } = await this.talkingAgent.chat(message, history);

        responseResult = {
          agent: "TalkingAgent+TriageAgent",
          intent,
          reply: `${reply}\n\n*Clinical Triage Level: **${triageResult.triageLevel.toUpperCase()}** (${triageResult.recommendedDepartment})*`,
          triageLevel: triageResult.triageLevel,
          action: {
            label: `🩺 Consult ${triageResult.recommendedDepartment}`,
            href: "doctors.html",
            variant: "primary"
          },
          details: triageResult,
          suggestions: [
            { label: `🩺 Consult ${triageResult.recommendedDepartment}`, prompt: `Find ${triageResult.recommendedDepartment} doctor` },
            { label: "🏥 Nearest Hospital & Beds", action: "nearest-hospital" }
          ]
        };
        break;
      }

      case "conversational_talking":
      default: {
        const { reply, provider } = await this.talkingAgent.chat(message, history);
        responseResult = {
          agent: "TalkingAgent",
          intent,
          reply,
          triageLevel: "normal",
          provider,
          action: {
            label: "🩺 Explore Doctors",
            href: "doctors.html",
            variant: "primary"
          },
          suggestions: [
            { label: "❓ Help & Services", prompt: "help" },
            { label: "🩺 Explore Doctors", prompt: "explore doctors" }
          ]
        };
        break;
      }
    }

    // 8. Self-Learning Memory Synthesis: learn from this turn in background
    if (userId) {
      this.selfLearningEngine
        .learnFromTurn({
          userId,
          userMessage: message,
          botReply: responseResult.reply,
          intent: responseResult.intent
        })
        .catch((err) => console.warn("[SelfLearning] Learn turn warning:", err.message));

      // Inject personalized learning context if applicable
      const personalizationNote = this.selfLearningEngine.getPersonalizedContext(
        learnedProfile,
        responseResult.intent
      );
      if (personalizationNote && !responseResult.reply.includes("Based on your consultation")) {
        responseResult.reply += `\n\n${personalizationNote}`;
      }

      responseResult.learningProfile = learnedProfile;
    }

    return responseResult;
  }
}

module.exports = {
  AgentOrchestrator,
  agentOrchestrator: new AgentOrchestrator()
};

