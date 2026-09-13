const request = require("supertest");
const { app } = require("../index");
const { registerAndLogin } = require("./testUtils");
const Hospital = require("../models/Hospital");
const Emergency = require("../models/Emergency");
const AmbulanceFleet = require("../models/AmbulanceFleet");
const User = require("../models/User");
const {
  huggingFaceClient,
  queryQwenAgent,
  talkingAgent,
  triageAgent,
  appointmentAgent,
  clinicalNotesAgent,
  hospitalOperationsAgent,
  agentOrchestrator
} = require("../ai");

describe("AI Subsystem & Multi-Agent Tests", () => {
  describe("Qwen AI Bridge & Node.js Function", () => {
    test("queryQwenAgent executes and responds to user message", async () => {
      const res = await queryQwenAgent({
        messages: [{ role: "user", content: "Who are you?" }],
        maxNewTokens: 40
      });
      expect(res.success).toBe(true);
      expect(res.reply).toBeDefined();
      expect(res.model).toContain("Qwen");
    });
  });

  describe("HuggingFaceClient & Fallback Engine", () => {
    test("client handles fallback when unconfigured", async () => {
      const text = await huggingFaceClient.generateText({
        prompt: "I have a mild fever and temperature"
      });
      expect(typeof text).toBe("string");
      expect(text.toLowerCase()).toContain("fever");
    });
  });

  describe("TalkingAgent", () => {
    test("provides empathetic guidance for general health queries", async () => {
      const res = await talkingAgent.chat("Can you give me advice on a healthy balanced diet?");
      expect(res).toHaveProperty("reply");
      expect(res.reply.length).toBeGreaterThan(15);
      expect(res).toHaveProperty("provider");
    });

    test("maintains conversational context with history", async () => {
      const history = [
        { role: "user", content: "I have trouble sleeping" },
        { role: "assistant", content: "Ensure your bedroom is dark and quiet." }
      ];
      const res = await talkingAgent.chat("What else can help with anxiety?", history);
      expect(res.reply).toBeDefined();
    });
  });

  describe("TriageAgent", () => {
    test("detects critical red-flag emergency symptoms and triggers ambulance requirement", async () => {
      const assessment = await triageAgent.evaluateSymptoms({
        symptoms: ["severe chest pain", "shortness of breath"]
      });
      expect(assessment.triageLevel).toBe("critical");
      expect(assessment.requiresAmbulance).toBe(true);
      expect(assessment.priorityScore).toBe(5);
      expect(assessment.recommendedDepartment).toBe("Cardiology");
      expect(assessment.matchedRedFlags).toContain("chest pain");
    });

    test("assesses moderate non-emergency symptoms appropriately", async () => {
      const assessment = await triageAgent.evaluateSymptoms({
        symptoms: ["mild headache", "stomach acidity"],
        age: 28
      });
      expect(["low", "medium"]).toContain(assessment.triageLevel);
      expect(assessment.requiresAmbulance).toBe(false);
    });
  });

  describe("AppointmentAgent with Real MongoDB Data", () => {
    test("parses natural language appointment requests and detects specialty and slot", async () => {
      const parsed = appointmentAgent.parseIntent("I need to see a dermatologist tomorrow morning for a skin rash");
      expect(parsed.department).toBe("Dermatology");
      expect(parsed.timeSlot).toBeDefined();
      expect(parsed.date).toBeDefined();
    });

    test("matches real MongoDB doctor and books real appointment", async () => {
      const doctor = await registerAndLogin({
        name: "Dr. Elena Rostova",
        email: "elena.cardio@test.com",
        password: "password123",
        role: "doctor"
      });
      await User.findByIdAndUpdate(doctor.user.id, { department: "Cardiology", isAvailable: true });

      const patient = await registerAndLogin({
        name: "John Patient",
        email: "john.pt@test.com",
        password: "password123",
        role: "patient"
      });

      const rec = await appointmentAgent.recommendAppointment("Book appointment with cardiologist next week");
      expect(rec.success).toBe(true);
      expect(rec.department).toBe("Cardiology");
      expect(rec.recommendedDoctor).toBeDefined();
      expect(rec.recommendedDoctor.name).toBe("Dr. Elena Rostova");

      // Confirm real appointment booking via endpoint
      const confirmRes = await request(app)
        .post("/api/ai/appointments/confirm")
        .set("Authorization", `Bearer ${patient.token}`)
        .send({
          doctorId: doctor.user.id,
          date: "2026-10-15T09:00:00.000Z",
          timeSlot: "10:00 AM",
          symptoms: "Cardiovascular routine checkup"
        });

      expect(confirmRes.statusCode).toBe(201);
      expect(confirmRes.body.success).toBe(true);
      expect(confirmRes.body.appointment.status).toBe("pending");
      expect(confirmRes.body.appointment.doctor.toString()).toBe(doctor.user.id);
    });
  });

  describe("ClinicalNotesAgent with Real Prescriptions", () => {
    test("extracts SOAP structure, medications, and flags drug interactions", async () => {
      const rawNotes = `
        Chief complaint: 58-year-old male with persistent chest tightness and hypertension.
        Exam: BP 155/95 mmHg, HR 82 bpm, regular rhythm.
        Assessment: Essential hypertension with risk of cardiovascular events.
        Plan: Prescribe Aspirin 100mg once daily for 30 days and Warfarin 5mg once daily for 30 days.
      `;

      const result = await clinicalNotesAgent.processNotes(rawNotes);
      expect(result.success).toBe(true);
      expect(result.soap).toHaveProperty("subjective");
      expect(result.soap).toHaveProperty("objective");
      expect(result.soap).toHaveProperty("assessment");
      expect(result.soap).toHaveProperty("plan");
      expect(result.medications.length).toBeGreaterThan(0);
      expect(result.safetyWarnings.length).toBeGreaterThan(0);
    });

    test("persists real prescription to database", async () => {
      const doctor = await registerAndLogin({
        name: "Dr. Marcus Vance",
        email: "marcus.vance@test.com",
        password: "password123",
        role: "doctor"
      });
      const patient = await registerAndLogin({
        name: "Alice Smith",
        email: "alice.smith@test.com",
        password: "password123",
        role: "patient"
      });

      const rxRes = await request(app)
        .post("/api/ai/clinical-notes/prescribe")
        .set("Authorization", `Bearer ${doctor.token}`)
        .send({
          patientId: patient.user.id,
          notes: "Patient reports fever and cough. Prescribe Amoxicillin 500mg twice daily for 7 days."
        });

      expect(rxRes.statusCode).toBe(201);
      expect(rxRes.body.success).toBe(true);
      expect(rxRes.body.result.prescription).toBeDefined();
    });
  });

  describe("HospitalOperationsAgent with Real Database Models", () => {
    test("computes live hospital load and returns real telemetry metrics", async () => {
      await Hospital.create({
        name: "City Apollo Hospital",
        address: "74 Medical Enclave",
        latitude: 19.0760,
        longitude: 72.8777,
        totalBeds: 200,
        availableBeds: 50,
        specialty: "Multi-Specialty"
      });

      const emPatient = await registerAndLogin({
        name: "Emergency Patient",
        email: "em.pat@test.com",
        password: "password123",
        role: "patient"
      });

      await Emergency.create({
        patientName: "Emergency Test Patient",
        contact: "9876543210",
        location: "Highway Intersection",
        priority: "critical",
        status: "waiting",
        createdBy: emPatient.user.id
      });

      await AmbulanceFleet.create({
        hospitalName: "City Apollo Hospital",
        vehicleNumber: "MH-02-AM-9999",
        driverName: "Vikram",
        driverPhone: "9876543211",
        status: "available",
        speed: 0
      });

      const insights = await hospitalOperationsAgent.getOperationalInsights();
      expect(insights.success).toBe(true);
      expect(insights.metrics).toHaveProperty("occupancyRate");
      expect(insights.metrics.hospitalCount).toBeGreaterThanOrEqual(1);
      expect(insights.metrics.activeEmergencies).toBeGreaterThanOrEqual(1);
      expect(insights.recommendations).toBeInstanceOf(Array);
    });
  });

  describe("AgentOrchestrator", () => {
    test("routes red flag emergency to TriageAgent", async () => {
      const res = await agentOrchestrator.handleUserMessage({
        message: "Help! The patient is unconscious and having chest pain!"
      });
      expect(res.agent).toBe("TriageAgent");
      expect(res.intent).toBe("emergency_triage");
      expect(res.triageLevel).toBe("critical");
      expect(res.action.variant).toBe("danger");
    });

    test("routes appointment booking intent to AppointmentAgent", async () => {
      const res = await agentOrchestrator.handleUserMessage({
        message: "I want to schedule an appointment with a cardiologist tomorrow"
      });
      expect(res.agent).toBe("AppointmentAgent");
      expect(res.intent).toBe("appointment_booking");
      expect(res.action.label).toContain("Confirm");
    });

    test("routes general medical discussion to TalkingAgent", async () => {
      const res = await agentOrchestrator.handleUserMessage({
        message: "What are some tips for managing daily work stress?"
      });
      expect(res.agent).toBe("TalkingAgent");
      expect(res.intent).toBe("conversational_talking");
      expect(res.reply).toBeDefined();
    });
  });

  describe("AI REST API Endpoints", () => {
    test("GET /api/ai/status returns active subsystem health and Qwen model", async () => {
      const res = await request(app).get("/api/ai/status");
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe("online");
      expect(res.body.model).toContain("Qwen");
      expect(res.body.agents.length).toBe(6);
    });

    test("POST /api/ai/qwen/chat executes Qwen model endpoint", async () => {
      const res = await request(app)
        .post("/api/ai/qwen/chat")
        .send({
          messages: [{ role: "user", content: "Who are you?" }],
          maxNewTokens: 40
        });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.reply).toBeDefined();
    });

    test("POST /api/ai/symptom-checker performs triage", async () => {
      const res = await request(app)
        .post("/api/ai/symptom-checker")
        .send({
          symptoms: ["high fever", "severe headache"],
          age: 35
        });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.assessment).toHaveProperty("triageLevel");
    });

    test("POST /api/ai/chat handles conversational message and returns agent details", async () => {
      const res = await request(app)
        .post("/api/ai/chat")
        .send({
          message: "I need to book a doctor for joint pain"
        });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.reply).toBeDefined();
      expect(res.body.agent).toBe("AppointmentAgent");
    });

    test("POST /api/ai/appointments/smart-book extracts booking recommendation", async () => {
      const res = await request(app)
        .post("/api/ai/appointments/smart-book")
        .send({
          prompt: "Book pediatric checkup tomorrow morning"
        });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.recommendation.department).toBe("Pediatrics");
    });

    test("POST /api/ai/clinical-notes/analyze structures clinical note", async () => {
      const res = await request(app)
        .post("/api/ai/clinical-notes/analyze")
        .send({
          notes: "Patient presents with dry cough and mild fever. Prescribe Amoxicillin 500mg BID for 7 days."
        });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.medications.length).toBeGreaterThan(0);
    });

    test("POST /api/ai/operations/insights returns hospital operational metrics", async () => {
      const res = await request(app).post("/api/ai/operations/insights");
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.metrics).toBeDefined();
    });

    test("POST /api/ai/chat returns live doctor list for explore doctor query and stores past user data", async () => {
      const patient = await registerAndLogin({
        name: "History Patient",
        email: "history.patient@test.com",
        password: "password123",
        role: "patient"
      });

      const res = await request(app)
        .post("/api/ai/chat")
        .set("Authorization", `Bearer ${patient.token}`)
        .send({
          message: "I want to explore doctors for my consultation"
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.doctors).toBeDefined();
      expect(res.body.doctors.length).toBeGreaterThan(0);
      expect(res.body.action.type).toBe("explore_doctors");

      // Verify past history is stored in user
      const histRes = await request(app)
        .get("/api/ai/history")
        .set("Authorization", `Bearer ${patient.token}`);

      expect(histRes.statusCode).toBe(200);
      expect(histRes.body.history.length).toBeGreaterThanOrEqual(2);
      expect(histRes.body.history[0].role).toBe("user");

      // Test DELETE /api/ai/history
      const delRes = await request(app)
        .delete("/api/ai/history")
        .set("Authorization", `Bearer ${patient.token}`);
      expect(delRes.statusCode).toBe(200);
      expect(delRes.body.success).toBe(true);

      const afterDel = await request(app)
        .get("/api/ai/history")
        .set("Authorization", `Bearer ${patient.token}`);
      expect(afterDel.body.history.length).toBe(0);
    });
  });
});
