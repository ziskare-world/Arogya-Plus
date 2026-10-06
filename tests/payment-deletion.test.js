const request = require("supertest");
const { app } = require("../index");
const User = require("../models/User");
const Payment = require("../models/Payment");

describe("Super Admin Payment Transaction Deletion Tests", () => {
  let superAdminToken;
  let patientToken;
  let testPaymentId;

  beforeEach(async () => {
    // Create Super Admin
    const superAdmin = await User.create({
      name: "Super Administrator",
      email: `superadmin.${Date.now()}.${Math.random()}@test.com`,
      password: "Password123!",
      role: "super-admin",
      isEmailVerified: true,
      isActive: true
    });

    // Create Patient
    const patient = await User.create({
      name: "Test Patient",
      email: `patient.${Date.now()}.${Math.random()}@test.com`,
      password: "Password123!",
      role: "patient",
      isEmailVerified: true,
      isActive: true
    });

    // Create a Payment
    const payment = await Payment.create({
      user: patient._id,
      amount: 1500,
      currency: "INR",
      razorpayOrderId: `order_${Date.now()}`,
      razorpayPaymentId: `pay_${Date.now()}`,
      status: "verified",
      method: "UPI",
      invoiceNumber: `INV-2026-${Date.now().toString().slice(-4)}`
    });

    testPaymentId = payment._id.toString();

    // Login Super Admin
    const superAdminLogin = await request(app).post("/api/auth/login").send({
      email: superAdmin.email,
      password: "Password123!"
    });
    superAdminToken = superAdminLogin.body.token;

    // Login Patient
    const patientLogin = await request(app).post("/api/auth/login").send({
      email: patient.email,
      password: "Password123!"
    });
    patientToken = patientLogin.body.token;
  });

  test("Patient CANNOT delete payment transaction (forbidden 403)", async () => {
    const res = await request(app)
      .delete(`/api/payments/${testPaymentId}`)
      .set("Authorization", `Bearer ${patientToken}`);

    expect(res.status).toBe(403);

    // Verify payment still exists
    const stillExists = await Payment.findById(testPaymentId);
    expect(stillExists).not.toBeNull();
  });

  test("Patient CANNOT clear payment transaction history (forbidden 403)", async () => {
    const res = await request(app)
      .delete("/api/payments/history/clear")
      .set("Authorization", `Bearer ${patientToken}`);

    expect(res.status).toBe(403);
  });

  test("Super Admin CAN delete an individual payment transaction", async () => {
    const res = await request(app)
      .delete(`/api/payments/${testPaymentId}`)
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("deleted successfully");

    // Verify payment is removed from DB
    const deleted = await Payment.findById(testPaymentId);
    expect(deleted).toBeNull();
  });

  test("Super Admin deleting non-existent payment returns 404", async () => {
    const fakeId = "60c72b2f9b1d8b2bad000000";
    const res = await request(app)
      .delete(`/api/payments/${fakeId}`)
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test("Super Admin CAN clear all transaction history", async () => {
    const res = await request(app)
      .delete("/api/payments/history/clear")
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.deletedCount).toBeGreaterThanOrEqual(1);

    // Verify no payments remain
    const remaining = await Payment.countDocuments();
    expect(remaining).toBe(0);
  });
});
