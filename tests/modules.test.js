const request = require("supertest");
const { app } = require("../index");
const { registerAndLogin, createAdminAndLogin } = require("./testUtils");

describe("Additional Modules API", () => {
  test("ambulance booking flow works", async () => {
    const patient = await registerAndLogin({
      name: "Amb Patient",
      email: "amb.patient@test.com",
      password: "patient123",
      role: "patient"
    });

    const doctor = await registerAndLogin({
      name: "Amb Doctor",
      email: "amb.doctor@test.com",
      password: "doctor123",
      role: "doctor"
    });

    const createResponse = await request(app)
      .post("/api/ambulance/book")
      .set("Authorization", `Bearer ${patient.token}`)
      .send({
        pickupLocation: "Sector 12",
        hospitalLocation: "City Hospital"
      });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.body.booking.status).toBe("requested");

    const updateResponse = await request(app)
      .patch(`/api/ambulance/${createResponse.body.booking._id}/status`)
      .set("Authorization", `Bearer ${doctor.token}`)
      .send({
        status: "dispatched",
        driverName: "Ravi",
        vehicleNumber: "MH-01-AB-1234",
        etaMinutes: 12
      });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.body.booking.status).toBe("dispatched");
  });

  test("insurance claim module works for patient and admin", async () => {
    const patient = await registerAndLogin({
      name: "Claim Patient",
      email: "claim.patient@test.com",
      password: "patient123",
      role: "patient"
    });
    const admin = await createAdminAndLogin();

    const claimResponse = await request(app)
      .post("/api/insurance/claims")
      .set("Authorization", `Bearer ${patient.token}`)
      .send({
        providerName: "Secure Health Insurance",
        policyNumber: "POL-2026-001",
        claimAmount: 15000,
        claimReason: "Hospitalization for dengue",
        documents: ["invoice.pdf", "discharge-summary.pdf"]
      });

    expect(claimResponse.statusCode).toBe(201);
    expect(claimResponse.body.claim.status).toBe("submitted");

    const reviewResponse = await request(app)
      .patch(`/api/insurance/${claimResponse.body.claim._id}/review`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        status: "approved",
        adminRemark: "Claim approved after verification"
      });

    expect(reviewResponse.statusCode).toBe(200);
    expect(reviewResponse.body.claim.status).toBe("approved");
  });

  test("AI symptom checker returns triage", async () => {
    const response = await request(app).post("/api/ai/symptom-checker").send({
      symptoms: ["chest pain", "shortness of breath"],
      age: 52
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.assessment.triageLevel).toBe("critical");
  });

  test("AI chat assistant endpoint handles queries and emergency alerts", async () => {
    const normalRes = await request(app).post("/api/ai/chat").send({
      message: "How do I book an appointment with a doctor?"
    });

    expect(normalRes.statusCode).toBe(200);
    expect(normalRes.body.success).toBe(true);
    expect(normalRes.body.action.href).toBe("appointments.html");

    const criticalRes = await request(app).post("/api/ai/chat").send({
      message: "I am having severe chest pain and shortness of breath"
    });

    expect(criticalRes.statusCode).toBe(200);
    expect(criticalRes.body.triageLevel).toBe("critical");
    expect(criticalRes.body.action.href).toBe("ambulance-booking.html");
  });

  test("payment API works in mock mode", async () => {
    const patient = await registerAndLogin({
      name: "Pay Patient",
      email: "pay.patient@test.com",
      password: "patient123",
      role: "patient"
    });

    const orderResponse = await request(app)
      .post("/api/payment/create-order")
      .set("Authorization", `Bearer ${patient.token}`)
      .send({ amount: 500 });

    expect(orderResponse.statusCode).toBe(201);
    expect(orderResponse.body.order.id).toContain("mock_order_");

    const verifyResponse = await request(app)
      .post("/api/payment/verify")
      .set("Authorization", `Bearer ${patient.token}`)
      .send({
        razorpay_order_id: orderResponse.body.order.id,
        razorpay_payment_id: "pay_mock_123",
        razorpay_signature: "mock_signature"
      });

    expect(verifyResponse.statusCode).toBe(200);
    expect(verifyResponse.body.payment.status).toBe("verified");
  });

  test("admin dashboard and doctor panel APIs return data", async () => {
    const doctor = await registerAndLogin({
      name: "Panel Doctor",
      email: "panel.doctor@test.com",
      password: "doctor123",
      role: "doctor"
    });
    const patient = await registerAndLogin({
      name: "Panel Patient",
      email: "panel.patient@test.com",
      password: "patient123",
      role: "patient"
    });

    await request(app)
      .post("/api/appointments")
      .set("Authorization", `Bearer ${patient.token}`)
      .send({
        doctorId: doctor.user.id,
        appointmentDate: "2026-12-22T11:30:00.000Z",
        reason: "Panel verification appointment"
      });

    const doctorAppointments = await request(app)
      .get("/api/doctors/appointments/me")
      .set("Authorization", `Bearer ${doctor.token}`);

    expect(doctorAppointments.statusCode).toBe(200);
    expect(doctorAppointments.body.appointments.length).toBe(1);

    const admin = await createAdminAndLogin();
    const adminDashboard = await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(adminDashboard.statusCode).toBe(200);
    expect(adminDashboard.body.stats.users).toBeGreaterThanOrEqual(3);
  });

  test("storage API list, upload, folder creation and delete work", async () => {
    const admin = await createAdminAndLogin();
    const testFolderName = `Test_Folder_${Date.now()}`;

    const listRes = await request(app)
      .get("/api/admin/storage")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(Array.isArray(listRes.body.items)).toBe(true);

    const folderRes = await request(app)
      .post("/api/admin/storage/folder")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ folderName: testFolderName });
    expect(folderRes.statusCode).toBe(201);

    const uploadRes = await request(app)
      .post("/api/admin/storage/upload")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        folder: testFolderName,
        filename: "test_doc.txt",
        contentBase64: Buffer.from("Test Storage Content").toString("base64")
      });
    if (uploadRes.statusCode !== 201) {
      console.log("UPLOAD RES FAILED:", uploadRes.statusCode, uploadRes.body);
    }
    expect(uploadRes.statusCode).toBe(201);

    const deleteFileRes = await request(app)
      .delete("/api/admin/storage/item")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ relativePath: `${testFolderName}/test_doc.txt` });
    expect(deleteFileRes.statusCode).toBe(200);

    const deleteFolderRes = await request(app)
      .delete("/api/admin/storage/item")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ relativePath: testFolderName });
    expect(deleteFolderRes.statusCode).toBe(200);
  });

  test("hospital bed occupancy database storage and nearest hospital API work", async () => {
    // 1. Create a custom hospital with bed counts in MongoDB
    const createHospRes = await request(app)
      .post("/api/map/hospitals")
      .send({
        name: "Connaught Trauma Care",
        latitude: 28.6300,
        longitude: 77.2150,
        address: "Inner Circle, Connaught Place",
        city: "New Delhi",
        totalBeds: 150,
        occupiedBeds: 90,
        icuBeds: { total: 30, occupied: 20, available: 10 },
        oxygenBeds: { total: 50, occupied: 30, available: 20 }
      });

    expect(createHospRes.statusCode).toBe(201);
    expect(createHospRes.body.success).toBe(true);
    expect(createHospRes.body.data.availableBeds).toBe(60);
    const hospId = createHospRes.body.data._id;

    // 2. Update bed occupancy for the hospital
    const patchBedRes = await request(app)
      .patch(`/api/map/hospitals/${hospId}/beds`)
      .send({
        occupiedBeds: 100,
        icuBeds: { occupied: 22, available: 8 }
      });

    expect(patchBedRes.statusCode).toBe(200);
    expect(patchBedRes.body.data.occupiedBeds).toBe(100);
    expect(patchBedRes.body.data.availableBeds).toBe(50);
    expect(patchBedRes.body.data.icuBeds.available).toBe(8);

    // 3. Find the nearest hospital from a specific user coordinate
    const nearestRes = await request(app)
      .get("/api/map/nearest-hospital")
      .query({ lat: 28.6310, lng: 77.2160 });

    expect(nearestRes.statusCode).toBe(200);
    expect(nearestRes.body.success).toBe(true);
    expect(nearestRes.body.nearestHospital).toBeDefined();
    expect(nearestRes.body.nearestHospital.name).toBe("Connaught Trauma Care");
    expect(nearestRes.body.nearestHospital.distanceKm).toBeLessThan(1.0);
    expect(nearestRes.body.nearestHospital.beds.total).toBe(150);
    expect(nearestRes.body.nearestHospital.beds.available).toBe(50);
  });

  test("live ambulance tracking simulation and location update work", async () => {
    // 1. Simulate automated movement step for the ambulance fleet
    const simRes = await request(app).post("/api/map/ambulances/simulate-step");
    expect(simRes.statusCode).toBe(200);
    expect(simRes.body.success).toBe(true);
    expect(simRes.body.count).toBeGreaterThan(0);
    expect(simRes.body.data[0].latitude).toBeDefined();
    expect(simRes.body.data[0].longitude).toBeDefined();

    // 2. Update specific vehicle coordinates
    const updateLocRes = await request(app)
      .post("/api/map/ambulances/update-location")
      .send({
        vehicleNumber: "DL-01-AMB-101",
        latitude: 28.6200,
        longitude: 77.2100,
        speed: 45,
        status: "dispatched"
      });

    expect(updateLocRes.statusCode).toBe(200);
    expect(updateLocRes.body.success).toBe(true);
    expect(updateLocRes.body.data.speed).toBe(45);

    // 3. Fetch fleet and verify the updated vehicle coordinates
    const fleetRes = await request(app).get("/api/map/ambulances");
    expect(fleetRes.statusCode).toBe(200);
    const updatedVeh = fleetRes.body.data.find(v => v.vehicleNumber === "DL-01-AMB-101");
    expect(updatedVeh).toBeDefined();
    expect(updatedVeh.latitude).toBe(28.6200);
    expect(updatedVeh.longitude).toBe(77.2100);
  });

  test("AI sync-history migrates guest local storage conversations into user account", async () => {
    const patient = await registerAndLogin({
      name: "Guest Sync Patient",
      email: "guest.sync@test.com",
      password: "patient123",
      role: "patient"
    });

    const guestHistory = [
      { role: "user", content: "I have a mild fever since yesterday", intent: "general_chat" },
      { role: "assistant", content: "Stay hydrated and monitor your temperature.", intent: "clinical_qa" }
    ];

    const syncRes = await request(app)
      .post("/api/ai/sync-history")
      .set("Authorization", `Bearer ${patient.token}`)
      .send({ history: guestHistory });

    expect(syncRes.statusCode).toBe(200);
    expect(syncRes.body.success).toBe(true);
    expect(syncRes.body.syncedCount).toBe(2);

    // Retrieve history and verify synced messages are present
    const getHistRes = await request(app)
      .get("/api/ai/history")
      .set("Authorization", `Bearer ${patient.token}`);

    expect(getHistRes.statusCode).toBe(200);
    expect(getHistRes.body.history.length).toBeGreaterThanOrEqual(2);
    expect(getHistRes.body.history[0].content).toBe("I have a mild fever since yesterday");
  });
});

