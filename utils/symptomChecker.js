const RED_FLAG_SYMPTOMS = [
  "chest pain",
  "shortness of breath",
  "unconscious",
  "seizure",
  "heavy bleeding",
  "stroke signs"
];

const HIGH_RISK_SYMPTOMS = [
  "high fever",
  "vomiting",
  "severe headache",
  "persistent cough",
  "abdominal pain"
];

const buildSymptomAssessment = ({ symptoms, age = 30 }) => {
  const normalized = symptoms.map((item) => item.toLowerCase().trim());
  const hasRedFlag = normalized.some((item) => RED_FLAG_SYMPTOMS.includes(item));
  const highRiskCount = normalized.filter((item) => HIGH_RISK_SYMPTOMS.includes(item)).length;

  let triageLevel = "low";
  let advice = "Monitor symptoms, hydrate, and schedule a routine consultation.";

  if (hasRedFlag) {
    triageLevel = "critical";
    advice = "Seek immediate emergency care or call an ambulance.";
  } else if (highRiskCount >= 2 || age >= 65) {
    triageLevel = "high";
    advice = "Consult a doctor within 24 hours and monitor symptom progression.";
  } else if (highRiskCount === 1 || normalized.length >= 3) {
    triageLevel = "medium";
    advice = "Book a doctor appointment soon for medical guidance.";
  }

  return {
    triageLevel,
    matchedRedFlags: normalized.filter((item) => RED_FLAG_SYMPTOMS.includes(item)),
    symptomCount: normalized.length,
    recommendation: advice
  };
};

module.exports = { buildSymptomAssessment };
