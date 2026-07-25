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
});
