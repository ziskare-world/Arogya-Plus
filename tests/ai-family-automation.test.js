const request = require("supertest");
const { app } = require("../index");
const User = require("../models/User");
const Hospital = require("../models/Hospital");
const AmbulanceFleet = require("../models/AmbulanceFleet");
const Ambulance = require("../models/Ambulance");
const Appointment = require("../models/Appointment");
const { registerAndLogin, createAdminAndLogin } = require("./testUtils");

describe("AI Healthcare Architecture & Family Profile Automation", () => {
  let patient;
  let doctor;
  let hospital;
  let fleetUnit;

  beforeEach(async () => {
    // 1. Setup Patient
    patient = await registerAndLogin({
      name: "Ayush Sharma",
      email: "ayush.patient@test.com",
      password: "password123",
      role: "patient",
      phone: "+91 9876543210"
    });

    // 2. Setup Doctor
    doctor = await User.create({
      name: "Dr. Ananya Sen",
      email: "ananya.doctor@test.com",
      password: "doctorpassword",
      role: "doctor",
      specialization: "Cardiology",
      consultationFee: 700,
      rating: 4.9,
      reviewCount: 45,
      clinicAddress: "Apex Heart Clinic, Connaught Place",
      clinicCoordinates: { lat: 28.6315, lng: 77.2167 },
      hospitalName: "Apex Superspecialty Hospital",
      isActive: true,
      isAvailable: true
    });

    // 3. Setup Hospital
    hospital = await Hospital.create({
      name: "Apex Superspecialty Hospital",
      latitude: 28.6315,
      longitude: 77.2167,
      address: "Barakhamba Road, Connaught Place, New Delhi",
      city: "Delhi NCR",
      totalBeds: 120,
      availableBeds: 40,
      icuBeds: { total: 25, occupied: 15, available: 10 },
      oxygenBeds: { total: 30, occupied: 10, available: 20 },
      emergencyServices: true,
      ambulanceContact: "108",
      location: {
        type: "Point",
        coordinates: [77.2167, 28.6315]
      }
    });

    // 4. Setup Ambulance Fleet
    fleetUnit = await AmbulanceFleet.create({
      hospital: hospital._id,
      hospitalName: hospital.name,
      vehicleNumber: "DL-01-EMS-9999",
      driverName: "Rajendra Kumar",
      driverPhone: "9811122233",
      equipmentLevel: "ICU Ambulance",
      status: "available",
      currentCoordinates: { lat: 28.6280, lng: 77.2100 }
    });
  });

  // ========================================================
  // 1. AI CLINICAL SYMPTOM TRIAGE & DIAGNOSIS ENGINE
  // ========================================================
  describe("AI Triage Engine", () => {
    test("detects emergency red flags, predicts Cardiology, and sets critical urgency", async () => {
      const res = await request(app)
        .post("/api/ai/triage")
        .set("Authorization", `Bearer ${patient.token}`)
        .send({
          symptoms: ["chest pain", "shortness of breath", "radiating pain to left arm"],
          age: 55
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.triage.predictedSpecialty).toBe("Cardiology");
      expect(res.body.triage.urgencyLevel).toBe("critical");
      expect(res.body.triage.isEmergency).toBe(true);
      expect(res.body.triage.matchedRedFlags).toContain("chest pain");
    });

    test("accurately routes musculoskeletal conditions to Orthopedics", async () => {
      const res = await request(app)
        .post("/api/ai/triage")
        .set("Authorization", `Bearer ${patient.token}`)
        .send({
          symptoms: ["knee pain", "joint swelling", "ligament sprain"],
          age: 35
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.triage.predictedSpecialty).toBe("Orthopedics");
      expect(res.body.triage.isEmergency).toBe(false);
    });

    test("accurately routes skin conditions to Dermatology with low urgency", async () => {
      const res = await request(app)
        .post("/api/ai/triage")
        .set("Authorization", `Bearer ${patient.token}`)
        .send({
          symptoms: ["skin rash", "itching", "eczema"],
          age: 28
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.triage.predictedSpecialty).toBe("Dermatology");
      expect(res.body.triage.urgencyLevel).toBe("low");
    });
  });

  // ========================================================
  // 2. FAMILY MEMBER PROFILE MANAGEMENT (MAX 5 PROFILES)
  // ========================================================
  describe("Family Member Profile Management (Max 5 Limit)", () => {
    test("allows user to add family members with remote place details and personal data", async () => {
      const res = await request(app)
        .post("/api/user/family-members")
        .set("Authorization", `Bearer ${patient.token}`)
        .send({
          name: "Ramesh Sharma",
          relationship: "Father",
          age: 62,
          gender: "male",
          bloodGroup: "O+",
          phone: "+91 9415000000",
          address: "Flat 202, Gomti Nagar",
          city: "Lucknow",
          coordinates: { lat: 26.8467, lng: 80.9462 },
          medicalHistory: ["Hypertension", "Diabetes Type 2"],
          allergies: ["Penicillin"],
          isEmergencyContact: true
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
      expect(res.body.remainingSlots).toBe(4);
      expect(res.body.familyMember.name).toBe("Ramesh Sharma");
      expect(res.body.familyMember.relationship).toBe("Father");
      expect(res.body.familyMember.city).toBe("Lucknow");
    });

    test("enforces strict maximum limit of 5 family members and rejects the 6th", async () => {
      const relationships = ["Father", "Mother", "Spouse", "Son", "Daughter"];

      // Add 5 family members
      for (let i = 0; i < 5; i++) {
        const addRes = await request(app)
          .post("/api/user/family-members")
          .set("Authorization", `Bearer ${patient.token}`)
          .send({
            name: `Family Member ${i + 1}`,
            relationship: relationships[i],
            age: 30 + i * 5,
            gender: i % 2 === 0 ? "male" : "female",
            bloodGroup: "B+",
            city: "Remote City"
          });
        expect(addRes.statusCode).toBe(201);
      }

      // Check count is 5 and remaining is 0
      const listRes = await request(app)
        .get("/api/user/family-members")
        .set("Authorization", `Bearer ${patient.token}`);
      expect(listRes.body.count).toBe(5);
      expect(listRes.body.remainingSlots).toBe(0);

      // Attempting to add 6th family member must be rejected with 400
      const overflowRes = await request(app)
        .post("/api/user/family-members")
        .set("Authorization", `Bearer ${patient.token}`)
        .send({
          name: "Sixth Member",
          relationship: "Brother",
          age: 25,
          gender: "male"
        });

      expect(overflowRes.statusCode).toBe(400);
      expect(overflowRes.body.success).toBe(false);
      expect(overflowRes.body.message).toContain("Maximum limit reached");
    });

    test("updates and deletes family members properly", async () => {
      const addRes = await request(app)
        .post("/api/user/family-members")
        .set("Authorization", `Bearer ${patient.token}`)
        .send({
          name: "Sunita Sharma",
          relationship: "Mother",
          age: 58,
          bloodGroup: "A+"
        });

      const memberId = addRes.body.familyMember._id;

      // Update
      const updateRes = await request(app)
        .put(`/api/user/family-members/${memberId}`)
        .set("Authorization", `Bearer ${patient.token}`)
        .send({
          city: "Jaipur",
          address: "C-Scheme, Jaipur"
        });

      expect(updateRes.statusCode).toBe(200);
      expect(updateRes.body.familyMember.city).toBe("Jaipur");

      // Delete
      const deleteRes = await request(app)
        .delete(`/api/user/family-members/${memberId}`)
        .set("Authorization", `Bearer ${patient.token}`);

      expect(deleteRes.statusCode).toBe(200);
      expect(deleteRes.body.count).toBe(0);
      expect(deleteRes.body.remainingSlots).toBe(5);
    });

    test("computes profile completion percentage correctly", async () => {
      // Initially, with only basic name and phone
      const initialStatus = await request(app)
        .get("/api/user/profile-status")
        .set("Authorization", `Bearer ${patient.token}`);

      expect(initialStatus.statusCode).toBe(200);
      expect(initialStatus.body.isProfileComplete).toBe(false);

      // Update personal details
      await request(app)
        .patch("/api/user/profile")
        .set("Authorization", `Bearer ${patient.token}`)
        .send({
          age: 26,
          gender: "male",
          bloodGroup: "B+",
          address: "Sector 62, Noida",
          city: "Noida"
        });

      // Add a family member
      await request(app)
        .post("/api/user/family-members")
        .set("Authorization", `Bearer ${patient.token}`)
        .send({
          name: "Ramesh Sharma",
          relationship: "Father",
          age: 62
        });

      const updatedStatus = await request(app)
        .get("/api/user/profile-status")
        .set("Authorization", `Bearer ${patient.token}`);

      expect(updatedStatus.body.completionPercentage).toBeGreaterThanOrEqual(80);
      expect(updatedStatus.body.isProfileComplete).toBe(true);
      expect(updatedStatus.body.familyMemberCount).toBe(1);
    });
  });

  // ========================================================
  // 3. AUTONOMOUS DOCTOR AUTO-ASSIGNMENT & REMOTE BOOKING
  // ========================================================
  describe("Autonomous Doctor Auto-Assign & Remote Booking", () => {
    test("matches optimal doctor based on disease, rating, and distance", async () => {
      const matchRes = await request(app)
        .post("/api/ai/auto-assign-doctor")
        .set("Authorization", `Bearer ${patient.token}`)
        .send({
          disease: "High blood pressure and palpitations",
          symptoms: ["heart racing", "chest tightness"],
          coordinates: { lat: 28.6300, lng: 77.2150 }, // Near Connaught Place
          age: 45
        });

      expect(matchRes.statusCode).toBe(200);
      expect(matchRes.body.success).toBe(true);
      expect(matchRes.body.matchedDoctor.name).toBe("Dr. Ananya Sen");
      expect(matchRes.body.targetSpecialty).toBe("Cardiology");
      expect(matchRes.body.matchScore).toBeGreaterThanOrEqual(80);
    });

    test("auto-books appointment with full remote family details and AI triage metadata", async () => {
      // 1. Add family member
      const famRes = await request(app)
        .post("/api/user/family-members")
        .set("Authorization", `Bearer ${patient.token}`)
        .send({
          name: "Ramesh Sharma",
          relationship: "Father",
          age: 62,
          phone: "+91 9415000000",
          city: "Lucknow",
          address: "Gomti Nagar, Lucknow"
        });
      const familyMemberId = famRes.body.familyMember._id;

      // 2. Auto-book for family member from remote place
      const bookRes = await request(app)
        .post("/api/ai/auto-assign-doctor")
        .set("Authorization", `Bearer ${patient.token}`)
        .send({
          symptoms: ["chest pain", "angina"],
          autoBook: true,
          bookedFor: "family",
          familyMemberId,
          patientDetails: {
            name: "Ramesh Sharma",
            relationship: "Father",
            age: 62,
            phone: "+91 9415000000"
          },
          locationType: "remote_saved",
          patientLocation: {
            address: "Gomti Nagar",
            city: "Lucknow",
            coordinates: { lat: 26.8467, lng: 80.9462 }
          }
        });

      expect(bookRes.statusCode).toBe(201);
      expect(bookRes.body.success).toBe(true);
      expect(bookRes.body.appointment.bookedFor).toBe("family");
      expect(bookRes.body.appointment.patientDetails.name).toBe("Ramesh Sharma");
      expect(bookRes.body.appointment.patientDetails.relationship).toBe("Father");
      expect(bookRes.body.appointment.locationType).toBe("remote_saved");
      expect(bookRes.body.appointment.patientLocation.city).toBe("Lucknow");
      expect(bookRes.body.appointment.aiTriage.predictedSpecialty).toBe("Cardiology");
      expect(bookRes.body.appointment.aiTriage.autoAssigned).toBe(true);
      expect(bookRes.body.appointment.tokenNumber).toMatch(/^AI-APT-/);
    });
  });

  // ========================================================
  // 4. AUTONOMOUS AMBULANCE DISPATCH & REMOTE EMERGENCY
  // ========================================================
  describe("Autonomous Ambulance Dispatch & Facility Allocation", () => {
    test("autonomously finds nearest vehicle, reserves fleet, assigns hospital, and calculates ETA", async () => {
      const dispatchRes = await request(app)
        .post("/api/ai/auto-dispatch-ambulance")
        .set("Authorization", `Bearer ${patient.token}`)
        .send({
          pickupLocation: "Barakhamba Road, Connaught Place",
          pickupCoordinates: { lat: 28.6310, lng: 77.2155 },
          priority: "critical",
          problemDescription: "Acute cardiac arrest symptoms",
          bookedFor: "family",
          patientDetails: {
            name: "Ramesh Sharma",
            relationship: "Father",
            phone: "+91 9415000000"
          },
          locationType: "remote_saved"
        });

      expect(dispatchRes.statusCode).toBe(201);
      expect(dispatchRes.body.success).toBe(true);
      expect(dispatchRes.body.dispatchedVehicle.vehicleNumber).toBe("DL-01-EMS-9999");
      expect(dispatchRes.body.dispatchedVehicle.driverName).toBe("Rajendra Kumar");
      expect(dispatchRes.body.allocatedHospital.name).toBe("Apex Superspecialty Hospital");
      expect(dispatchRes.body.etaMinutes).toBeGreaterThan(0);

      // Verify the fleet vehicle status was transitioned to dispatched
      const updatedFleet = await AmbulanceFleet.findById(fleetUnit._id);
      expect(updatedFleet.status).toBe("dispatched");

      // Verify Ambulance booking record was created in database
      const booking = await Ambulance.findById(dispatchRes.body.ambulanceBooking._id);
      expect(booking).not.toBeNull();
      expect(booking.bookedFor).toBe("family");
      expect(booking.patientDetails.name).toBe("Ramesh Sharma");
      expect(booking.status).toBe("dispatched");
      expect(booking.aiDispatch.autoDispatched).toBe(true);
    });

    test("handles full unified all-in-one emergency response autonomously", async () => {
      const emergencyRes = await request(app)
        .post("/api/ai/emergency-auto-respond")
        .set("Authorization", `Bearer ${patient.token}`)
        .send({
          patientName: "Sunita Sharma",
          contact: "+91 9876543210",
          symptoms: ["severe breathlessness", "unconscious", "blue lips"],
          location: "Janpath, New Delhi",
          coordinates: { lat: 28.6250, lng: 77.2180 },
          bookedFor: "family",
          relationship: "Mother"
        });

      expect(emergencyRes.statusCode).toBe(201);
      expect(emergencyRes.body.success).toBe(true);
      expect(emergencyRes.body.triage.urgencyLevel).toBe("critical");
      expect(emergencyRes.body.allocatedHospital.name).toBe("Apex Superspecialty Hospital");
      expect(emergencyRes.body.assignedDoctor.name).toBe("Dr. Ananya Sen");
      expect(emergencyRes.body.emergencyId).toBeDefined();
    });
  });
});
