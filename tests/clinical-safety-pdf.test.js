const request = require("supertest");
const mongoose = require("mongoose");
const { app } = require("../index");
const User = require("../models/User");
const Prescription = require("../models/Prescription");
const { checkClinicalSafety } = require("../utils/clinicalSafetyEngine");

describe("Clinical Safety & CDSS Engine Tests", () => {
  describe("checkClinicalSafety Unit Tests", () => {
    test("detects Penicillin-Amoxicillin cross-allergy", () => {
      const result = checkClinicalSafety({
        patientAllergies: ["Penicillin", "Dust"],
        activeMedications: [],
        newMedicineName: "Amoxicillin 500mg"
      });

      expect(result.safe).toBe(false);
      expect(result.hasAllergyWarning).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].severity).toBe("CRITICAL");
    });

    test("detects Sulfa cross-allergy with Bactrim", () => {
      const result = checkClinicalSafety({
        patientAllergies: ["Sulfa drugs"],
        activeMedications: [],
        newMedicineName: "Bactrim DS"
      });

      expect(result.safe).toBe(false);
      expect(result.hasAllergyWarning).toBe(true);
    });

    test("detects NSAID allergy with Combiflam / Ibuprofen", () => {
      const result = checkClinicalSafety({
        patientAllergies: ["Aspirin", "NSAID"],
        activeMedications: [],
        newMedicineName: "Ibuprofen 400mg"
      });

      expect(result.safe).toBe(false);
      expect(result.hasAllergyWarning).toBe(true);
    });

    test("detects dangerous Drug-Drug Interaction: Warfarin + Aspirin", () => {
      const result = checkClinicalSafety({
        patientAllergies: [],
        activeMedications: ["Warfarin 5mg daily"],
        newMedicineName: "Aspirin 75mg"
      });

      expect(result.safe).toBe(false);
      expect(result.hasInteractionWarning).toBe(true);
      expect(result.warnings.some((w) => w.type === "DRUG_INTERACTION")).toBe(true);
    });

    test("detects duplicate Paracetamol hepatotoxicity risk", () => {
      const result = checkClinicalSafety({
        patientAllergies: [],
        activeMedications: ["Dolo 650mg"],
        newMedicineName: "Calpol 500mg"
      });

      expect(result.safe).toBe(false);
      expect(result.hasInteractionWarning).toBe(true);
    });

    test("returns safe: true when there are no allergies or drug conflicts", () => {
      const result = checkClinicalSafety({
        patientAllergies: ["Dust", "Pollen"],
        activeMedications: ["Cetirizine 10mg"],
        newMedicineName: "Pantoprazole 40mg"
      });

      expect(result.safe).toBe(true);
      expect(result.warnings.length).toBe(0);
    });
  });

  describe("Doctor Prescriptions CDSS API Tests", () => {
    let doctorToken;
    let patientId;

    beforeEach(async () => {
      // Create Doctor
      const doctor = await User.create({
        name: "Dr. CDSS Specialist",
        email: `dr.cdss.${Date.now()}@test.com`,
        password: "Password123!",
        role: "doctor",
        specialization: "General Medicine",
        isEmailVerified: true,
        isActive: true
      });

      // Create Patient with Penicillin allergy
      const patient = await User.create({
        name: "Allergic Patient",
        email: `allergic.${Date.now()}@test.com`,
        password: "Password123!",
        role: "patient",
        allergies: ["Penicillin"],
        isEmailVerified: true,
        isActive: true
      });

      patientId = patient._id;

      // Doctor Login
      const loginRes = await request(app).post("/api/auth/login").send({
        email: doctor.email,
        password: "Password123!"
      });

      doctorToken = loginRes.body.token;
    });

    test("POST /api/doctors/prescriptions/check-safety returns allergy alert for Amoxicillin", async () => {
      const res = await request(app)
        .post("/api/doctors/prescriptions/check-safety")
        .set("Authorization", `Bearer ${doctorToken}`)
        .send({
          patientId,
          medicineName: "Amoxicillin 500mg"
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.safe).toBe(false);
      expect(res.body.hasAllergyWarning).toBe(true);
    });

    test("POST /api/doctors/prescriptions blocks contraindicated prescription without override", async () => {
      const res = await request(app)
        .post("/api/doctors/prescriptions")
        .set("Authorization", `Bearer ${doctorToken}`)
        .send({
          patientId,
          medicineName: "Amoxicillin 500mg",
          dosage: "500mg 1-0-1",
          frequency: "Twice daily"
        });

      expect(res.status).toBe(409);
      expect(res.body.safetyBlocked).toBe(true);
    });

    test("POST /api/doctors/prescriptions allows contraindicated prescription with overrideWarning: true", async () => {
      const res = await request(app)
        .post("/api/doctors/prescriptions")
        .set("Authorization", `Bearer ${doctorToken}`)
        .send({
          patientId,
          medicineName: "Amoxicillin 500mg",
          dosage: "500mg 1-0-1",
          frequency: "Twice daily",
          overrideWarning: true
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.prescription).toBeDefined();
    });
  });
});
