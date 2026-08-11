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
});
