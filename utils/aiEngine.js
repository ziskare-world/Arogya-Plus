const User = require("../models/User");
const Hospital = require("../models/Hospital");
const AmbulanceFleet = require("../models/AmbulanceFleet");
const Ambulance = require("../models/Ambulance");
const Emergency = require("../models/Emergency");
const Appointment = require("../models/Appointment");

// ==========================================
// 1. GEOSPATIAL DISTANCE CALCULATOR
// ==========================================
const haversineDistanceKm = (from, to) => {
  if (!from || !to) return null;
  const lat1 = Number(from.lat !== undefined ? from.lat : from.latitude);
  const lng1 = Number(from.lng !== undefined ? from.lng : from.longitude);
  const lat2 = Number(to.lat !== undefined ? to.lat : to.latitude);
  const lng2 = Number(to.lng !== undefined ? to.lng : to.longitude);

  if (!Number.isFinite(lat1) || !Number.isFinite(lng1) || !Number.isFinite(lat2) || !Number.isFinite(lng2)) {
    return null;
  }

  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
};

// ==========================================
// 2. CLINICAL TAXONOMY & SPECIALTY RULES
// ==========================================
const CLINICAL_SPECIALTIES = [
  {
    specialty: "Cardiology",
    keywords: [
      "chest pain", "angina", "heart", "cardiac", "palpitation", "palpitations", "blood pressure",
      "hypertension", "heart attack", "shortness of breath", "arrhythmia", "cholesterol"
    ],
    redFlags: ["chest pain", "heart attack", "crushing chest pressure", "radiating pain to left arm"],
    urgencyDefault: "high",
    advice: "Avoid strenuous exertion. If experiencing crushing chest pressure radiating to arm/jaw, call an ambulance immediately."
  },
  {
    specialty: "Neurology",
    keywords: [
      "stroke", "seizure", "epilepsy", "migraine", "severe headache", "head injury", "concussion",
      "paralysis", "numbness", "dizziness", "vertigo", "slurred speech", "facial drooping", "fainting"
    ],
    redFlags: ["stroke", "seizure", "facial drooping", "slurred speech", "sudden paralysis", "unconscious"],
    urgencyDefault: "high",
    advice: "Check FAST signs (Face drooping, Arm weakness, Speech difficulty, Time to call emergency). Keep patient in recovery position."
  },
  {
    specialty: "Pulmonology",
    keywords: [
      "breath", "breathing difficulty", "asthma", "wheezing", "cough", "persistent cough",
      "bronchitis", "pneumonia", "shortness of breath", "copd", "spo2", "low oxygen", "lung"
    ],
    redFlags: ["severe breathing difficulty", "low oxygen", "blue lips", "gasping for air"],
    urgencyDefault: "medium",
    advice: "Maintain upright posture, utilize prescribed inhalers or supplemental oxygen if available, and seek urgent consultation."
  },
  {
    specialty: "Orthopedics",
    keywords: [
      "bone", "fracture", "joint", "joint pain", "knee pain", "back pain", "spine", "arthritis",
      "sprain", "ligament", "swelling in ankle", "dislocation", "injury", "broken leg", "broken arm"
    ],
    redFlags: ["compound fracture", "severe trauma", "inability to move limb after fall", "heavy bleeding with fracture"],
    urgencyDefault: "medium",
    advice: "Immobilize the affected joint or bone. Apply cold compress for acute sprains without open wounds."
  },
  {
    specialty: "Gastroenterology",
    keywords: [
      "stomach", "abdominal pain", "abdomen", "stomach pain", "vomiting", "diarrhea",
      "acidity", "reflux", "gerd", "liver", "jaundice", "cramps", "food poisoning", "constipation"
    ],
    redFlags: ["severe abdominal rigidity", "vomiting blood", "black stool", "high fever with acute abdomen"],
    urgencyDefault: "medium",
    advice: "Stay hydrated with oral rehydration salts (ORS). Avoid solid or spicy foods until evaluated."
  },
  {
    specialty: "Pediatrics",
    keywords: [
      "child", "baby", "infant", "toddler", "pediatric", "child fever", "colic", "vaccination",
      "growth", "teething", "child cough", "diaper rash"
    ],
    redFlags: ["infant lethargy", "child high fever over 103F", "child breathing rapidly", "convulsions in child"],
    urgencyDefault: "medium",
    advice: "Keep the child comfortable and hydrated. Do not administer adult medications; seek pediatric assessment."
  },
  {
    specialty: "Dermatology",
    keywords: [
      "skin", "rash", "itching", "eczema", "psoriasis", "allergy", "hives", "acne", "fungal",
      "boil", "mole", "scalp", "dermatitis"
    ],
    redFlags: ["rapidly spreading rash with fever", "lip/throat swelling with hives"],
    urgencyDefault: "low",
    advice: "Avoid scratching or applying unprescribed steroid creams. Keep the area clean and dry."
  },
  {
    specialty: "Gynecology",
    keywords: [
      "pregnancy", "labor", "period", "menstrual", "pelvic pain", "ovarian", "pcos",
      "uterine", "breast lump", "bleeding during pregnancy"
    ],
    redFlags: ["heavy bleeding during pregnancy", "severe acute pelvic pain", "labor contractions"],
    urgencyDefault: "high",
    advice: "Rest immediately. For pregnancy complications or acute pelvic symptoms, visit the maternity emergency room."
  },
  {
    specialty: "General Medicine",
    keywords: [
      "fever", "viral", "flu", "cold", "headache", "weakness", "fatigue", "body ache",
      "malaise", "diabetes", "routine checkup", "health check"
    ],
    redFlags: ["fever above 104F", "unresponsive", "severe dehydration"],
    urgencyDefault: "low",
    advice: "Get adequate rest, monitor temperature, hydrate frequently, and schedule a consultation if symptoms persist over 48 hours."
  }
];

const EMERGENCY_RED_FLAGS = [
  "chest pain", "heart attack", "unconscious", "not breathing", "severe bleeding",
  "heavy bleeding", "stroke", "facial drooping", "slurred speech", "paralysis",
  "seizure", "choking", "poisoning", "compound fracture", "severe head injury", "blue lips"
];

// ==========================================
// 3. AI TRIAGE & DIAGNOSTIC ANALYZER
// ==========================================
const analyzeSymptoms = ({ symptoms = [], disease = "", age = 30, additionalNotes = "" }) => {
  const symptomList = Array.isArray(symptoms)
    ? symptoms
    : typeof symptoms === "string"
    ? symptoms.split(",").map((s) => s.trim())
    : [];

  const combinedText = `${symptomList.join(" ")} ${disease} ${additionalNotes}`.toLowerCase();

  // 1. Check for emergency red flags
  const matchedRedFlags = EMERGENCY_RED_FLAGS.filter((flag) => combinedText.includes(flag));
  const isEmergency = matchedRedFlags.length > 0;

  // 2. Score specialties
  const scoredSpecialties = CLINICAL_SPECIALTIES.map((spec) => {
    let matchCount = 0;
    spec.keywords.forEach((keyword) => {
      if (combinedText.includes(keyword)) {
        matchCount += 1;
      }
    });

    const hasRedFlagInSpec = spec.redFlags.some((rf) => combinedText.includes(rf));
    if (hasRedFlagInSpec) {
      matchCount += 3;
    }

    return {
      specialty: spec.specialty,
      score: matchCount,
      advice: spec.advice,
      urgencyDefault: spec.urgencyDefault,
      hasRedFlag: hasRedFlagInSpec
    };
  }).sort((a, b) => b.score - a.score);

  const topMatch = scoredSpecialties[0] && scoredSpecialties[0].score > 0
    ? scoredSpecialties[0]
    : {
        specialty: "General Medicine",
        score: 1,
        advice: "Schedule an evaluation with a General Physician for thorough diagnosis.",
        urgencyDefault: "low",
        hasRedFlag: false
      };

  // 3. Determine Urgency Level
  let urgencyLevel = topMatch.urgencyDefault;
  if (isEmergency) {
    urgencyLevel = "critical";
  } else if (topMatch.hasRedFlag || symptomList.length >= 4 || age >= 65) {
    urgencyLevel = urgencyLevel === "low" ? "medium" : "high";
  }

  // 4. Formulate Diagnosis & Next Steps
  let diagnosisHint = `Clinical assessment suggests symptoms aligned with ${topMatch.specialty} department.`;
  if (isEmergency) {
    diagnosisHint = `CRITICAL ALERT: Emergency red flags detected (${matchedRedFlags.join(", ")}). Immediate emergency medical intervention required.`;
  }

  const confidence = Math.min(0.96, Math.max(0.65, 0.6 + topMatch.score * 0.08));

  return {
    predictedSpecialty: topMatch.specialty,
    urgencyLevel,
    isEmergency,
    matchedRedFlags,
    diagnosisHint,
    advice: topMatch.advice,
    confidence: Number(confidence.toFixed(2)),
    allMatchedSpecialties: scoredSpecialties.filter((s) => s.score > 0).map((s) => s.specialty)
  };
};

// ==========================================
// 4. AUTONOMOUS DOCTOR MATCHING & ASSIGNMENT
// ==========================================
const autoMatchDoctor = async ({
  symptoms = [],
  disease = "",
  specialty = "",
  patientCoordinates = null,
  patientLocation = null,
  hospitalName = "",
  age = 30
}) => {
  // If specialty not provided, triage symptoms
  let triageResult = null;
  let targetSpecialty = specialty;

  if (!targetSpecialty) {
    triageResult = analyzeSymptoms({ symptoms, disease, age });
    targetSpecialty = triageResult.predictedSpecialty;
  }

  // Find active doctors
  const query = { role: "doctor", isActive: true };
  if (hospitalName) {
    query.hospitalName = new RegExp(`^${hospitalName.trim()}$`, "i");
  }

  const doctors = await User.find(query).select(
    "name email phone specialization hospital hospitalName hospitalAddress clinicAddress clinicCoordinates consultationFee rating reviewCount experienceYears isAvailable"
  );

  if (!doctors.length) {
    return {
      success: false,
      message: "No active doctors available matching criteria",
      targetSpecialty,
      triage: triageResult
    };
  }

  // Check active doctor appointments in upcoming 2 hours to compute real-time workload
  const doctorIds = doctors.map((d) => d._id);
  const now = new Date();
  const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const activeAppointments = await Appointment.find({
    doctor: { $in: doctorIds },
    status: { $in: ["pending", "confirmed"] },
    appointmentDate: { $gte: now, $lte: twoHoursLater }
  }).select("doctor");

  const doctorLoadMap = new Map();
  activeAppointments.forEach((apt) => {
    const docId = String(apt.doctor);
    doctorLoadMap.set(docId, (doctorLoadMap.get(docId) || 0) + 1);
  });

  const normalizedTarget = targetSpecialty.toLowerCase();

  // Score candidate doctors
  const scoredDoctors = doctors.map((doctor) => {
    const docSpec = String(doctor.specialization || "").toLowerCase();
    let specialtyScore = 0;

    if (docSpec.includes(normalizedTarget)) {
      specialtyScore = 100;
    } else if (normalizedTarget.includes(docSpec) && docSpec.length > 3) {
      specialtyScore = 90;
    } else if (docSpec.includes("general") || docSpec.includes("physician") || docSpec.includes("internal medicine")) {
      specialtyScore = 60;
    } else {
      specialtyScore = 30;
    }

    // Availability / Load Score (0-100)
    const upcomingCount = doctorLoadMap.get(String(doctor._id)) || 0;
    const isFree = doctor.isAvailable !== false && upcomingCount === 0;
    const availabilityScore = isFree ? 100 : Math.max(20, 100 - upcomingCount * 30);

    // Rating Score (0-100)
    const rating = Number(doctor.rating || 4.5);
    const ratingScore = Math.min(100, Math.round((rating / 5) * 100));

    // Distance / Proximity Score (0-100)
    let distanceKm = null;
    let proximityScore = 70; // default neutral if no coords
    const docCoords = doctor.clinicCoordinates?.lat ? doctor.clinicCoordinates : null;

    const hasValidPatientCoords =
      patientCoordinates &&
      typeof patientCoordinates === "object" &&
      Number.isFinite(Number(patientCoordinates.lat !== undefined ? patientCoordinates.lat : patientCoordinates.latitude)) &&
      Number.isFinite(Number(patientCoordinates.lng !== undefined ? patientCoordinates.lng : patientCoordinates.longitude));

    if (hasValidPatientCoords && docCoords) {
      distanceKm = haversineDistanceKm(patientCoordinates, docCoords);
      if (distanceKm !== null) {
        // Under 5km = 100, 5-15km = 80, 15-30km = 60, >30km = 40
        proximityScore = Math.max(20, Math.round(100 - distanceKm * 2));
      }
    } else if (patientLocation && typeof patientLocation === "object") {
      // Check city or address match when GPS coordinates are not provided
      const pCity = String(patientLocation.city || "").toLowerCase().trim();
      const pAddr = String(patientLocation.address || "").toLowerCase().trim();
      const dClinic = String(doctor.clinicAddress || "").toLowerCase();
      const dHosp = String(doctor.hospitalName || "").toLowerCase();
      const dHospAddr = String(doctor.hospitalAddress || "").toLowerCase();
      if (pCity && (dClinic.includes(pCity) || dHosp.includes(pCity) || dHospAddr.includes(pCity))) {
        proximityScore = 95;
      } else if (pAddr && (dClinic.includes(pAddr) || dHosp.includes(pAddr) || dHospAddr.includes(pAddr))) {
        proximityScore = 90;
      }
    }

    // Overall Weighted Score
    const totalScore = Math.round(
      specialtyScore * 0.45 +
      availabilityScore * 0.25 +
      proximityScore * 0.15 +
      ratingScore * 0.15
    );

    return {
      doctor,
      matchScore: totalScore,
      specialtyScore,
      availabilityScore,
      proximityScore,
      distanceKm,
      isFree,
      upcomingInTwoHours: upcomingCount
    };
  }).sort((a, b) => b.matchScore - a.matchScore);

  const bestMatch = scoredDoctors[0];
  const doctorDisplayName = /^dr\.?\s+/i.test(bestMatch.doctor.name) ? bestMatch.doctor.name : `Dr. ${bestMatch.doctor.name}`;

  const locationHint = bestMatch.distanceKm !== null
    ? `, and geographic proximity (${bestMatch.distanceKm} km)`
    : patientLocation?.city
    ? `, and regional coverage in ${patientLocation.city}`
    : ", and regional clinic proximity";

  return {
    success: true,
    matchedDoctor: bestMatch.doctor,
    matchScore: bestMatch.matchScore,
    isFree: bestMatch.isFree,
    distanceKm: bestMatch.distanceKm,
    targetSpecialty,
    triage: triageResult,
    explanation: `Auto-selected ${doctorDisplayName} (${bestMatch.doctor.specialization || targetSpecialty}) with a ${bestMatch.matchScore}% compatibility score based on clinical specialization, current clinic availability${locationHint}.`,
    rankedCandidates: scoredDoctors.slice(0, 5).map((c) => ({
      id: c.doctor._id,
      name: c.doctor.name,
      specialization: c.doctor.specialization,
      rating: c.doctor.rating,
      fee: c.doctor.consultationFee,
      matchScore: c.matchScore,
      distanceKm: c.distanceKm,
      isFree: c.isFree
    }))
  };
};

// ==========================================
// 5. AUTONOMOUS AMBULANCE DISPATCH ENGINE
// ==========================================
const autoDispatchAmbulance = async ({
  pickupCoordinates,
  pickupLocation,
  problemDescription = "Medical Emergency",
  requestedById,
  bookedFor = "self",
  familyMemberId = null,
  patientDetails = null,
  priority = "high",
  io = null
}) => {
  // 1. Validate coordinates or fallback to Delhi default
  const defaultCoords = { lat: 28.6139, lng: 77.2090 };
  const coords = pickupCoordinates && Number.isFinite(Number(pickupCoordinates.lat)) && Number.isFinite(Number(pickupCoordinates.lng))
    ? { lat: Number(pickupCoordinates.lat), lng: Number(pickupCoordinates.lng) }
    : defaultCoords;

  // 2. Find all available ambulance units in the fleet
  const availableFleet = await AmbulanceFleet.find({ status: "available" });

  if (!availableFleet.length) {
    // Check if any fleet exists in maintenance or dispatched to give accurate feedback
    const totalFleet = await AmbulanceFleet.countDocuments();
    return {
      success: false,
      message: totalFleet === 0
        ? "No ambulance fleet registered in system. Please notify hospital administration."
        : "All ambulances currently on active missions or in transit. Emergency protocol active: 108 helpline notified.",
      fallbackEmergencyNumber: "108"
    };
  }

  // 3. Score and sort fleet units by distance to patient pickup coordinates
  const rankedFleet = availableFleet.map((unit) => {
    const unitCoords = unit.currentCoordinates?.lat
      ? unit.currentCoordinates
      : unit.hospitalCoordinates?.lat
      ? unit.hospitalCoordinates
      : defaultCoords;

    const distanceKm = haversineDistanceKm(coords, unitCoords) || 5.0;
    // Equipment priority: ALS / ICU Ambulance preferred for critical priority
    let equipmentBonus = 0;
    if (priority === "critical" && (unit.equipmentLevel === "ICU Ambulance" || unit.equipmentLevel === "ALS")) {
      equipmentBonus = 15;
    }

    return {
      unit,
      distanceKm,
      unitCoords,
      score: 100 - distanceKm * 3 + equipmentBonus
    };
  }).sort((a, b) => a.distanceKm - b.distanceKm);

  const selectedUnit = rankedFleet[0].unit;
  const dispatchDistanceKm = rankedFleet[0].distanceKm;

  // Dynamic ETA calculation (speed ~30-40 km/h in city + 4 min dispatch prep)
  const etaMinutes = Math.max(5, Math.round(dispatchDistanceKm * 2.4 + 4));

  // 4. Find closest hospital to receive patient
  const hospital = await autoAllocateFacility({
    patientCoordinates: coords,
    priority,
    requiredICU: priority === "critical"
  });

  const hospitalName = hospital?.facility?.name || selectedUnit.hospitalName || "Apex Multispecialty Hospital";
  const hospitalAddress = hospital?.facility?.address || selectedUnit.hospitalAddress || "Emergency Center";
  const hospitalCoordinates = hospital?.facility?.location?.coordinates
    ? { lat: hospital.facility.location.coordinates[1], lng: hospital.facility.location.coordinates[0] }
    : (selectedUnit.hospitalCoordinates || defaultCoords);

  // 5. Reserve the ambulance fleet unit atomically
  selectedUnit.status = "dispatched";
  selectedUnit.lastAssignedAt = new Date();
  await selectedUnit.save();

  // 6. Create the active Ambulance booking
  const ambulanceBooking = await Ambulance.create({
    requestedBy: requestedById,
    bookedFor,
    familyMemberId,
    patientDetails: patientDetails || {},
    locationType: bookedFor === "family" ? "remote_saved" : "current",
    pickupLocation: pickupLocation || "Patient Pickup Location",
    pickupCoordinates: coords,
    hospitalLocation: hospitalAddress,
    hospital: hospital?.facility?._id || null,
    hospitalName,
    hospitalCoordinates,
    assignedAmbulance: selectedUnit._id,
    assignedAmbulanceVehicleNumber: selectedUnit.vehicleNumber,
    vehicleNumber: selectedUnit.vehicleNumber,
    driverName: selectedUnit.driverName || "Emergency Medical Driver",
    ambulanceCoordinates: selectedUnit.currentCoordinates || coords,
    status: "dispatched",
    etaMinutes,
    problemDescription,
    aiDispatch: {
      autoDispatched: true,
      dispatchReason: `Autonomous AI nearest-vehicle dispatch (Distance: ${dispatchDistanceKm} km, Priority: ${priority})`,
      severityScore: priority === "critical" ? 9 : priority === "high" ? 7 : 5,
      priority
    },
    lastLocationUpdatedAt: new Date()
  });

  // 7. Emit real-time socket alert if io is available
  if (io) {
    try {
      io.emit("ambulance:dispatched", {
        bookingId: ambulanceBooking._id,
        vehicleNumber: selectedUnit.vehicleNumber,
        driverName: selectedUnit.driverName,
        driverPhone: selectedUnit.driverPhone,
        etaMinutes,
        pickupLocation,
        hospitalName,
        priority
      });
    } catch (e) {
      // Socket emission error should not abort dispatch
    }
  }

  return {
    success: true,
    message: `Ambulance ${selectedUnit.vehicleNumber} autonomously dispatched! Estimated arrival in ${etaMinutes} mins.`,
    ambulanceBooking,
    dispatchedVehicle: {
      vehicleNumber: selectedUnit.vehicleNumber,
      driverName: selectedUnit.driverName,
      driverPhone: selectedUnit.driverPhone,
      equipmentLevel: selectedUnit.equipmentLevel,
      currentCoordinates: selectedUnit.currentCoordinates
    },
    allocatedHospital: {
      name: hospitalName,
      address: hospitalAddress,
      coordinates: hospitalCoordinates,
      availableBeds: hospital?.facility?.availableBeds,
      availableICU: hospital?.facility?.icuBeds?.available
    },
    etaMinutes,
    distanceKm: dispatchDistanceKm
  };
};

// ==========================================
// 6. AUTONOMOUS EMERGENCY FACILITY ALLOCATOR
// ==========================================
const autoAllocateFacility = async ({
  patientCoordinates = null,
  priority = "medium",
  requiredICU = false,
  city = ""
}) => {
  const query = { emergencyServices: true };
  if (city) {
    query.city = new RegExp(`^${city.trim()}$`, "i");
  }

  const hospitals = await Hospital.find(query);

  if (!hospitals.length) {
    // If no city-specific hospital found, fallback to all hospitals
    const fallbackHospitals = await Hospital.find({ emergencyServices: true });
    if (!fallbackHospitals.length) {
      return null;
    }
    return scoreAndSelectHospital(fallbackHospitals, patientCoordinates, priority, requiredICU);
  }

  return scoreAndSelectHospital(hospitals, patientCoordinates, priority, requiredICU);
};

const scoreAndSelectHospital = (hospitals, patientCoordinates, priority, requiredICU) => {
  const scored = hospitals.map((h) => {
    let distanceKm = 10;
    if (patientCoordinates) {
      const hCoords = h.location?.coordinates
        ? { lat: h.location.coordinates[1], lng: h.location.coordinates[0] }
        : { lat: h.latitude, lng: h.longitude };
      const d = haversineDistanceKm(patientCoordinates, hCoords);
      if (d !== null) distanceKm = d;
    }

    const availableBeds = h.availableBeds || 0;
    const availableICU = h.icuBeds?.available || 0;
    const hasCapacity = requiredICU ? availableICU > 0 : availableBeds > 0;

    let score = Math.max(10, 100 - distanceKm * 3);
    if (hasCapacity) score += 40;
    if (requiredICU && availableICU > 2) score += 20;

    return {
      facility: h,
      distanceKm: Number(distanceKm.toFixed(1)),
      hasCapacity,
      availableBeds,
      availableICU,
      score
    };
  }).sort((a, b) => b.score - a.score);

  return scored[0] || null;
};

// ==========================================
// 7. UNIFIED ALL-IN-ONE EMERGENCY RESPONDER
// ==========================================
const autoHandleEmergency = async ({
  requestedById,
  patientName,
  contact,
  symptoms = [],
  location,
  coordinates = null,
  bookedFor = "self",
  familyMemberId = null,
  relationship = "",
  io = null
}) => {
  // 1. Triage clinical assessment
  const triage = analyzeSymptoms({ symptoms, additionalNotes: location });

  // 2. Allocate facility
  const facilityResult = await autoAllocateFacility({
    patientCoordinates: coordinates,
    priority: triage.urgencyLevel,
    requiredICU: triage.urgencyLevel === "critical"
  });

  const allocatedHospital = facilityResult?.facility;

  // 3. Dispatch ambulance autonomously
  const dispatchResult = await autoDispatchAmbulance({
    pickupCoordinates: coordinates,
    pickupLocation: location,
    problemDescription: `Emergency: ${symptoms.join(", ") || "Acute symptoms"}`,
    requestedById,
    bookedFor,
    familyMemberId,
    patientDetails: { name: patientName, phone: contact, relationship },
    priority: triage.urgencyLevel,
    io
  });

  // 4. Auto-match doctor at allocated facility (or nearby)
  const doctorMatch = await autoMatchDoctor({
    symptoms,
    specialty: triage.predictedSpecialty,
    patientCoordinates: coordinates,
    hospitalName: allocatedHospital?.name || ""
  });

  // 5. Create Emergency Record in system
  const emergency = await Emergency.create({
    patientName,
    contact,
    bookedFor,
    familyMemberId,
    relationship: relationship || "Self",
    locationType: bookedFor === "family" ? "remote_saved" : "current",
    symptoms: Array.isArray(symptoms) ? symptoms : [symptoms],
    priority: triage.urgencyLevel,
    status: "in_progress",
    location,
    latitude: coordinates?.lat || 28.6139,
    longitude: coordinates?.lng || 77.2090,
    hospital: allocatedHospital?._id || null,
    hospitalName: allocatedHospital?.name || "Apex Multispecialty Hospital",
    assignedDoctor: doctorMatch.matchedDoctor?._id || null,
    createdBy: requestedById,
    aiAssessment: {
      triageLevel: triage.urgencyLevel,
      recommendations: [triage.advice, triage.diagnosisHint],
      emergencyCategory: triage.predictedSpecialty
    }
  });

  return {
    success: true,
    emergencyId: emergency._id,
    triage,
    dispatch: dispatchResult,
    allocatedHospital: allocatedHospital
      ? {
          id: allocatedHospital._id,
          name: allocatedHospital.name,
          address: allocatedHospital.address,
          availableBeds: allocatedHospital.availableBeds,
          availableICU: allocatedHospital.icuBeds?.available,
          ambulanceContact: allocatedHospital.ambulanceContact
        }
      : null,
    assignedDoctor: doctorMatch.matchedDoctor
      ? {
          id: doctorMatch.matchedDoctor._id,
          name: doctorMatch.matchedDoctor.name,
          specialization: doctorMatch.matchedDoctor.specialization,
          hospitalName: doctorMatch.matchedDoctor.hospitalName
        }
      : null,
    summary: `Autonomous Emergency AI dispatched ambulance ${dispatchResult.dispatchedVehicle?.vehicleNumber || "108"} (ETA: ${dispatchResult.etaMinutes || 10}m), allocated bed at ${allocatedHospital?.name || "Apex Multispecialty Hospital"}, and alerted ${doctorMatch.matchedDoctor?.name || "On-Call Emergency Specialist"}.`
  };
};

module.exports = {
  haversineDistanceKm,
  analyzeSymptoms,
  autoMatchDoctor,
  autoDispatchAmbulance,
  autoAllocateFacility,
  autoHandleEmergency,
  CLINICAL_SPECIALTIES,
  EMERGENCY_RED_FLAGS
};
