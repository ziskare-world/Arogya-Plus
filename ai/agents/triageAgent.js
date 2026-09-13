/**
 * 🚨 TriageAgent - Emergency & Clinical Symptom Triage Automation Agent
 * Evaluates symptoms, detects life-threatening red flags, and determines clinical priority.
 */

const { huggingFaceClient } = require("../huggingfaceClient");

const RED_FLAG_SYMPTOMS = [
  "chest pain",
  "shortness of breath",
  "unconscious",
  "seizure",
  "heavy bleeding",
  "stroke",
  "heart attack",
  "cyanosis",
  "anaphylaxis",
  "can't breathe",
  "cannot breathe",
  "sudden paralysis",
  "choking"
];

const HIGH_RISK_SYMPTOMS = [
  "high fever",
  "vomiting",
  "severe headache",
  "persistent cough",
  "abdominal pain",
  "stiff neck",
  "dizziness",
  "blurred vision",
  "blood in urine",
  "blood in stool"
];

const SPECIALTY_MAP = {
  cardiology: ["chest pain", "heart", "palpitations", "angina", "shortness of breath", "hypertension"],
  neurology: ["stroke", "seizure", "paralysis", "numbness", "severe headache", "migraine", "dizziness"],
  pulmonology: ["cough", "breathing", "wheezing", "asthma", "pneumonia", "lungs"],
  gastroenterology: ["stomach", "abdominal", "vomiting", "nausea", "diarrhea", "acidity"],
  orthopedics: ["fracture", "joint pain", "back pain", "sprain", "bone", "knee pain"],
  dermatology: ["rash", "itching", "skin", "eczema", "allergy", "hives"],
  pediatrics: ["infant", "toddler", "child fever", "colic"],
  general_medicine: ["fever", "fatigue", "body ache", "cold", "flu", "weakness"]
};

class TriageAgent {
  constructor(client = huggingFaceClient) {
    this.client = client;
  }

  /**
   * Evaluates symptoms, detects emergency status, and generates triage assessment
   * @param {Object} input
   * @param {string[]|string} input.symptoms
   * @param {number} [input.age=30]
   * @param {string} [input.vitalSigns]
   * @returns {Promise<Object>}
   */
  async evaluateSymptoms({ symptoms, age = 30, vitalSigns = null }) {
    const rawList = Array.isArray(symptoms)
      ? symptoms
      : String(symptoms || "").split(",").map(s => s.trim()).filter(Boolean);

    const normalized = rawList.map(s => s.toLowerCase());
    const matchedRedFlags = [];
    const matchedHighRisk = [];

    // Scan for red flags
    for (const rf of RED_FLAG_SYMPTOMS) {
      if (normalized.some(s => s.includes(rf))) {
        matchedRedFlags.push(rf);
      }
    }

    // Scan for high risk
    for (const hr of HIGH_RISK_SYMPTOMS) {
      if (normalized.some(s => s.includes(hr))) {
        matchedHighRisk.push(hr);
      }
    }

    let triageLevel = "low";
    let priorityScore = 1;
    let recommendation = "Monitor symptoms, stay hydrated, and arrange a routine clinic consultation if symptoms persist.";
    let requiresAmbulance = false;

    if (matchedRedFlags.length > 0) {
      triageLevel = "critical";
      priorityScore = 5;
      requiresAmbulance = true;
      recommendation = "EMERGENCY: Immediate emergency response required. Life-threatening indicators detected. Dispatching 108 Ambulance SOS and notifying hospital emergency room.";
    } else if (matchedHighRisk.length >= 2 || (matchedHighRisk.length >= 1 && (age >= 65 || age <= 2))) {
      triageLevel = "high";
      priorityScore = 4;
      recommendation = "URGENT CARE: Significant acute symptoms detected. Consult an emergency department or on-duty physician within 2 to 4 hours.";
    } else if (matchedHighRisk.length === 1 || normalized.length >= 3) {
      triageLevel = "medium";
      priorityScore = 3;
      recommendation = "MODERATE: Clinical evaluation recommended within 24 hours to prevent symptom escalation.";
    }

    // Determine recommended specialty
    let recommendedDepartment = "General Medicine";
    for (const [dept, keywords] of Object.entries(SPECIALTY_MAP)) {
      if (keywords.some(k => normalized.some(s => s.includes(k)))) {
        recommendedDepartment = dept.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        break;
      }
    }

    return {
      triageLevel,
      priorityScore,
      requiresAmbulance,
      recommendedDepartment,
      matchedRedFlags,
      matchedHighRisk,
      symptomCount: normalized.length,
      recommendation,
      evaluatedAt: new Date().toISOString()
    };
  }
}

module.exports = {
  TriageAgent,
  triageAgent: new TriageAgent()
};
