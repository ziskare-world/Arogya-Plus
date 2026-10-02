/**
 * clinicalSafetyEngine.js - ArogyaPlus Clinical Decision Support System (CDSS)
 * Real-time Drug-Allergy & Drug-Drug Interaction Safety Checker
 * 100% Offline Rule Engine - Zero External API Billing or Dependencies.
 */

const ALLERGY_CLASSES = [
  {
    category: "PENICILLINS_BETA_LACTAMS",
    label: "Penicillins & Beta-Lactam Antibiotics",
    triggers: ["penicillin", "amoxicillin", "ampicillin", "augmentin", "piperacillin", "cloxacillin", "methicillin", "beta-lactam", "beta lactam"],
    drugs: ["penicillin", "amoxicillin", "ampicillin", "augmentin", "piperacillin", "cloxacillin", "co-amoxiclav", "ticarcillin", "cephalexin", "ceftriaxone", "cefuroxime", "cefixime"],
    severity: "CRITICAL",
    message: "Patient has documented Penicillin / Beta-lactam allergy. Cross-reactivity presents high risk of anaphylactic shock, bronchospasm, or severe angioedema."
  },
  {
    category: "SULFONAMIDES",
    label: "Sulfonamides (Sulfa Drugs)",
    triggers: ["sulfa", "sulfonamide", "sulfamethoxazole", "bactrim", "septra", "cotrimoxazole"],
    drugs: ["sulfamethoxazole", "bactrim", "septra", "cotrimoxazole", "sulfasalazine", "dapsone", "furosemide", "hydrochlorothiazide"],
    severity: "CRITICAL",
    message: "Patient has documented Sulfa allergy. Prescribing sulfonamide agents poses severe risk of Stevens-Johnson Syndrome (SJS) or Toxic Epidermal Necrolysis (TEN)."
  },
  {
    category: "NSAIDS_ASPIRIN",
    label: "NSAIDs & Salicylates",
    triggers: ["nsaid", "aspirin", "ibuprofen", "diclofenac", "naproxen", "combiflam"],
    drugs: ["aspirin", "ibuprofen", "diclofenac", "naproxen", "ketorolac", "mefenamic acid", "piroxicam", "meloxicam", "indomethacin", "combiflam"],
    severity: "CRITICAL",
    message: "Patient has documented NSAID / Aspirin hypersensitivity. High risk of aspirin-exacerbated respiratory disease (AERD), severe bronchospasm, or anaphylaxis."
  },
  {
    category: "OPIOIDS",
    label: "Opioids & Narcotics",
    triggers: ["opioid", "codeine", "morphine", "tramadol", "fentanyl", "oxycodone"],
    drugs: ["codeine", "morphine", "tramadol", "fentanyl", "oxycodone", "pethidine", "buprenorphine"],
    severity: "CRITICAL",
    message: "Patient has documented Opioid allergy. Risk of excessive histamine release, profound respiratory depression, or severe anaphylactoid reaction."
  },
  {
    category: "STATINS",
    label: "HMG-CoA Reductase Inhibitors (Statins)",
    triggers: ["statin", "atorvastatin", "rosuvastatin", "simvastatin"],
    drugs: ["atorvastatin", "rosuvastatin", "simvastatin", "pravastatin", "pitavastatin"],
    severity: "HIGH",
    message: "Patient has documented Statin intolerance/allergy. Increased risk of severe myopathy or life-threatening rhabdomyolysis."
  },
  {
    category: "ACE_INHIBITORS",
    label: "ACE Inhibitors",
    triggers: ["ace inhibitor", "lisinopril", "enalapril", "ramipril"],
    drugs: ["lisinopril", "enalapril", "ramipril", "captopril", "perindopril", "fosinopril"],
    severity: "HIGH",
    message: "Patient has documented ACE Inhibitor allergy. High risk of bradykinin-mediated airway angioedema."
  }
];

const DRUG_INTERACTIONS = [
  {
    pair: [
      ["aspirin", "ecosprin", "disprin"],
      ["ibuprofen", "combiflam", "diclofenac", "naproxen", "voveran", "ketorolac"]
    ],
    severity: "CRITICAL",
    title: "Severe Dual-NSAID Ulceration & Hemorrhage Risk",
    message: "Concurrent use of Aspirin with other NSAIDs significantly enhances gastric mucosal damage, resulting in severe gastrointestinal bleeding and platelet dysfunction."
  },
  {
    pair: [
      ["warfarin", "heparin", "apixaban", "rivaroxaban", "dabigatran"],
      ["aspirin", "ibuprofen", "diclofenac", "naproxen", "ketorolac", "combiflam"]
    ],
    severity: "CRITICAL",
    title: "Life-Threatening Anticoagulant Hemorrhage Hazard",
    message: "Synergistic impairment of hemostasis. Co-administration of anticoagulants with antiplatelet NSAIDs drastically elevates risk of major or fatal bleeding."
  },
  {
    pair: [
      ["lisinopril", "ramipril", "enalapril", "losartan", "telmisartan"],
      ["spironolactone", "potassium", "k-cl", "potklor"]
    ],
    severity: "HIGH",
    title: "Potassium Toxicity & Severe Hyperkalemia",
    message: "RAAS blockade combined with potassium supplementation / aldosterone antagonism risks acute hyperkalemia, potentially triggering fatal cardiac arrhythmias."
  },
  {
    pair: [
      ["ciprofloxacin", "levofloxacin", "ofloxacin"],
      ["antacid", "gelusil", "digene", "calcium", "iron", "sucralfate"]
    ],
    severity: "MODERATE",
    title: "Polyvalent Cation Chelation & Reduced Efficacy",
    message: "Polyvalent metal ions bind fluoroquinolones in the GI tract, reducing antibacterial absorption by up to 90%. Administer at least 2 hours apart."
  },
  {
    pair: [
      ["sildenafil", "tadalafil", "viagra"],
      ["nitroglycerin", "sorbitrate", "isosorbide", "nitrate", "nitrocontin"]
    ],
    severity: "CONTRAINDICATED",
    title: "Absolute Contraindication: Precipitous Fatal Hypotension",
    message: "PDE5 inhibitors potentiate the hypotensive effect of organic nitrates, precipitating severe, life-threatening circulatory collapse and myocardial infarction."
  },
  {
    pair: [
      ["sertraline", "fluoxetine", "escitalopram", "paroxetine"],
      ["tramadol", "linezolid", "selegiline"]
    ],
    severity: "CRITICAL",
    title: "Serotonin Syndrome (Serotonergic Toxicity)",
    message: "Excessive synaptic serotonin accumulation can trigger Serotonin Syndrome, marked by hyperthermia, neuromuscular clonus, and autonomic instability."
  },
  {
    pair: [
      ["paracetamol", "acetaminophen", "dolo", "calpol", "crocin"],
      ["paracetamol", "acetaminophen", "dolo", "calpol", "crocin", "combiflam"]
    ],
    severity: "HIGH",
    title: "Duplicate Acetaminophen Dose / Hepatotoxicity Hazard",
    message: "Duplicate paracetamol prescriptions exceed recommended 4000mg/24h ceiling, risking acute liver necrosis."
  }
];

function normalizeText(str = "") {
  return String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsWordOrPrefix(normalizedTarget, word) {
  const normWord = normalizeText(word);
  if (!normWord) return false;
  const targetWords = normalizedTarget.split(" ");
  return targetWords.some((tw) => tw === normWord || (normWord.length >= 4 && tw.startsWith(normWord)));
}

/**
 * Checks safety of a proposed prescription against patient's allergies and existing active medicines.
 *
 * @param {Object} options
 * @param {Array<string>} options.patientAllergies - e.g. ["Penicillin", "Dust"]
 * @param {Array<string>} options.activeMedications - e.g. ["Aspirin 75mg"]
 * @param {string} options.newMedicineName - e.g. "Amoxicillin 500mg"
 * @returns {Object} { safe: boolean, warnings: Array }
 */
function checkClinicalSafety({
  patientAllergies = [],
  activeMedications = [],
  newMedicineName = ""
}) {
  const normNewMed = normalizeText(newMedicineName);
  if (!normNewMed) {
    return {
      safe: true,
      hasAllergyWarning: false,
      hasInteractionWarning: false,
      warnings: []
    };
  }

  const warnings = [];

  // 1. ALLERGY SCREENING
  for (const allergy of patientAllergies) {
    const normAllergy = normalizeText(allergy);
    if (!normAllergy) continue;

    for (const cls of ALLERGY_CLASSES) {
      const allergyMatchesClass = cls.triggers.some((trig) => containsWordOrPrefix(normAllergy, trig));
      if (!allergyMatchesClass) continue;

      const newMedMatchesClass = cls.drugs.some((drug) => containsWordOrPrefix(normNewMed, drug));
      if (newMedMatchesClass) {
        warnings.push({
          type: "ALLERGY_CONTRAINDICATION",
          severity: cls.severity,
          title: `Allergy Alert: ${cls.label} Cross-Reactivity`,
          matchedAllergy: allergy,
          message: `${cls.message} (Prescribed: "${newMedicineName}", Known Allergy: "${allergy}")`
        });
      }
    }

    // Direct name match fallback (e.g. Allergy: "Amoxicillin")
    if (containsWordOrPrefix(normNewMed, normAllergy)) {
      const alreadyAdded = warnings.some((w) => w.type === "ALLERGY_CONTRAINDICATION");
      if (!alreadyAdded) {
        warnings.push({
          type: "ALLERGY_CONTRAINDICATION",
          severity: "CRITICAL",
          title: `Direct Allergy Match: ${allergy}`,
          matchedAllergy: allergy,
          message: `Patient has an explicit allergy to "${allergy}". Prescribing "${newMedicineName}" is directly contraindicated.`
        });
      }
    }
  }

  // 2. DRUG-DRUG INTERACTION SCREENING
  for (const activeMed of activeMedications) {
    const normActiveMed = normalizeText(activeMed);
    if (!normActiveMed) continue;

    for (const rule of DRUG_INTERACTIONS) {
      const [groupA, groupB] = rule.pair;

      const newInA = groupA.some((drug) => containsWordOrPrefix(normNewMed, drug));
      const activeInB = groupB.some((drug) => containsWordOrPrefix(normActiveMed, drug));

      const newInB = groupB.some((drug) => containsWordOrPrefix(normNewMed, drug));
      const activeInA = groupA.some((drug) => containsWordOrPrefix(normActiveMed, drug));

      if ((newInA && activeInB) || (newInB && activeInA)) {
        // Special case: if groupA and groupB are the same (duplicate therapy), check if it's the exact same prescription ID or name
        warnings.push({
          type: "DRUG_INTERACTION",
          severity: rule.severity,
          title: rule.title,
          conflictingMedicine: activeMed,
          message: `${rule.message} (Prescribed: "${newMedicineName}", Current Active Rx: "${activeMed}")`
        });
      }
    }
  }

  const hasAllergyWarning = warnings.some((w) => w.type === "ALLERGY_CONTRAINDICATION");
  const hasInteractionWarning = warnings.some((w) => w.type === "DRUG_INTERACTION");

  return {
    safe: warnings.length === 0,
    hasAllergyWarning,
    hasInteractionWarning,
    warnings
  };
}

module.exports = {
  checkClinicalSafety,
  ALLERGY_CLASSES,
  DRUG_INTERACTIONS
};
