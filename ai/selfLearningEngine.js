/**
 * 🧠 selfLearningEngine.js - Autonomous Healthcare Learning & Memory Synthesis
 * Continuously learns user preferences, recurring clinical symptoms, doctor affinities,
 * and feature usage patterns from conversation turns and hospital platform data.
 */

const AgentMemory = require("../models/AgentMemory");

// Known medical specialties supported by the platform
const KNOWN_SPECIALTIES = [
  "Neurology",
  "Cardiology",
  "Pediatrics",
  "General Medicine",
  "Orthopedics",
  "Dermatology",
  "Gynecology",
  "Pulmonology",
  "Emergency Medicine",
  "Psychiatry",
  "Oncology",
  "Endocrinology"
];

// Symptom to Specialty associations for automated clinical learning
const SYMPTOM_SPECIALTY_MAP = {
  headache: "Neurology",
  seizure: "Neurology",
  migraine: "Neurology",
  numbness: "Neurology",
  dizziness: "Neurology",
  chest: "Cardiology",
  heart: "Cardiology",
  palpitation: "Cardiology",
  bp: "Cardiology",
  hypertension: "Cardiology",
  cough: "Pulmonology",
  breath: "Pulmonology",
  asthma: "Pulmonology",
  fever: "General Medicine",
  cold: "General Medicine",
  fatigue: "General Medicine",
  rash: "Dermatology",
  skin: "Dermatology",
  acne: "Dermatology",
  bone: "Orthopedics",
  joint: "Orthopedics",
  fracture: "Orthopedics",
  backache: "Orthopedics",
  child: "Pediatrics",
  baby: "Pediatrics",
  infant: "Pediatrics",
  pediatric: "Pediatrics",
  pregnancy: "Gynecology",
  period: "Gynecology"
};

class SelfLearningEngine {
  /**
   * Extract entities, clinical topics, and user preferences from message turn
   * @param {string} userMessage
   * @param {string} botReply
   * @param {string} intent
   * @returns {Object} Extracted entities
   */
  extractLearningSignals(userMessage = "", botReply = "", intent = "") {
    const text = String(userMessage).toLowerCase();
    const replyText = String(botReply).toLowerCase();

    const detectedSpecialties = new Set();
    const detectedSymptoms = new Set();
    const detectedDoctors = new Set();
    const detectedFeatures = new Set();

    // 1. Detect Specialties
    KNOWN_SPECIALTIES.forEach((spec) => {
      if (text.includes(spec.toLowerCase()) || replyText.includes(spec.toLowerCase())) {
        detectedSpecialties.add(spec);
      }
    });

    // 2. Detect Symptoms & inferred specialties
    Object.keys(SYMPTOM_SPECIALTY_MAP).forEach((symp) => {
      if (text.includes(symp)) {
        detectedSymptoms.add(symp);
        detectedSpecialties.add(SYMPTOM_SPECIALTY_MAP[symp]);
      }
    });

    // 3. Detect Doctors mentioned (e.g. Dr. Chinmay, Dr. Priya, Dr. Rajesh)
    const doctorMatches = userMessage.match(/\b(?:dr\.?|doctor)\s+([a-zA-Z]+)\b/gi) || [];
    doctorMatches.forEach((d) => {
      detectedDoctors.add(d.replace(/^(dr\.?|doctor)\s+/i, "").trim());
    });
    if (text.includes("chinmay")) detectedDoctors.add("chinmay");
    if (text.includes("priya")) detectedDoctors.add("Priya Sharma");

    // 4. Detect Feature affinity
    if (intent === "appointment_booking" || text.includes("book") || text.includes("appointment")) {
      detectedFeatures.add("appointment_booking");
    }
    if (intent === "hospital_operations" || text.includes("bed") || text.includes("hospital")) {
      detectedFeatures.add("hospital_beds");
    }
    if (intent === "emergency_triage" || text.includes("ambulance") || text.includes("sos") || text.includes("emergency")) {
      detectedFeatures.add("emergency_108");
    }
    if (text.includes("prescription") || text.includes("rx") || text.includes("medicine")) {
      detectedFeatures.add("prescriptions_ehr");
    }
    if (text.includes("soap") || text.includes("clinical note") || text.includes("queue")) {
      detectedFeatures.add("doctor_clinical_copilot");
    }

    return {
      specialties: Array.from(detectedSpecialties),
      symptoms: Array.from(detectedSymptoms),
      doctors: Array.from(detectedDoctors),
      features: Array.from(detectedFeatures)
    };
  }

  /**
   * Continuously learns and updates user profile memory in MongoDB
   * @param {Object} params
   * @param {string|ObjectId} params.userId
   * @param {string} params.userMessage
   * @param {string} params.botReply
   * @param {string} params.intent
   */
  async learnFromTurn({ userId, userMessage, botReply, intent }) {
    if (!userId) return null;

    try {
      const signals = this.extractLearningSignals(userMessage, botReply, intent);

      // Fetch or initialize user's aggregate learning profile
      let profileMemory = await AgentMemory.findOne({
        user: userId,
        category: "learned_profile"
      });

      const existingData = profileMemory?.value || {
        interactionCount: 0,
        specialtyFrequency: {},
        preferredDoctors: [],
        recentSymptoms: [],
        featureUsage: {},
        preferredFacility: "Pawan_Multinational_Hospital",
        lastUpdated: new Date()
      };

      existingData.interactionCount = (existingData.interactionCount || 0) + 1;

      // Update Specialty Frequency
      signals.specialties.forEach((spec) => {
        existingData.specialtyFrequency[spec] = (existingData.specialtyFrequency[spec] || 0) + 1;
      });

      // Update Preferred Doctors
      signals.doctors.forEach((doc) => {
        if (!existingData.preferredDoctors.includes(doc)) {
          existingData.preferredDoctors.push(doc);
        }
      });

      // Update Symptoms
      signals.symptoms.forEach((symp) => {
        if (!existingData.recentSymptoms.includes(symp)) {
          existingData.recentSymptoms.push(symp);
        }
      });
      if (existingData.recentSymptoms.length > 8) {
        existingData.recentSymptoms = existingData.recentSymptoms.slice(-8);
      }

      // Update Feature Usage
      signals.features.forEach((feat) => {
        existingData.featureUsage[feat] = (existingData.featureUsage[feat] || 0) + 1;
      });

      existingData.lastUpdated = new Date();

      // Determine top specialty affinity
      let topSpecialty = null;
      let highestCount = 0;
      Object.entries(existingData.specialtyFrequency).forEach(([spec, count]) => {
        if (count > highestCount) {
          highestCount = count;
          topSpecialty = spec;
        }
      });
      existingData.topSpecialty = topSpecialty;

      await AgentMemory.findOneAndUpdate(
        { user: userId, category: "learned_profile" },
        {
          user: userId,
          type: "preference",
          key: "user_learning_profile",
          value: existingData,
          category: "learned_profile",
          source: "self_learning_engine",
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );

      return existingData;
    } catch (err) {
      console.warn("[SelfLearningEngine] Error learning from turn:", err.message);
      return null;
    }
  }

  /**
   * Retrieve learned user insights for personalization
   * @param {string|ObjectId} userId
   * @returns {Promise<Object|null>}
   */
  async getLearnedProfile(userId) {
    if (!userId) return null;
    try {
      const memory = await AgentMemory.findOne({
        user: userId,
        category: "learned_profile"
      }).lean();
      return memory?.value || null;
    } catch (err) {
      return null;
    }
  }

  /**
   * Generate adaptive personalization context snippet to inject into response
   * @param {Object} learnedProfile
   * @param {string} currentIntent
   * @returns {string|null}
   */
  getPersonalizedContext(learnedProfile, currentIntent) {
    if (!learnedProfile) return null;

    if (currentIntent === "appointment_booking" && learnedProfile.topSpecialty) {
      return `💡 *Based on your consultations in **${learnedProfile.topSpecialty}**, I've prioritized relevant specialists for you.*`;
    }

    if (currentIntent === "hospital_operations" && learnedProfile.preferredFacility) {
      return `💡 *Showing telemetry for your primary facility: **${learnedProfile.preferredFacility.replace(/_/g, " ")}**.*`;
    }

    if (currentIntent === "conversational_talking" && learnedProfile.topSpecialty && (learnedProfile.interactionCount || 0) > 3) {
      return `💡 *I also have your past healthcare records in **${learnedProfile.topSpecialty}** ready if you'd like a follow-up consultation.*`;
    }

    return null;
  }
}

const selfLearningEngine = new SelfLearningEngine();

module.exports = {
  SelfLearningEngine,
  selfLearningEngine,
  KNOWN_SPECIALTIES,
  SYMPTOM_SPECIALTY_MAP
};
