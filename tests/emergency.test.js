const request = require("supertest");
const { app } = require("../index");
const { registerAndLogin, createAdminAndLogin } = require("./testUtils");

describe("Emergency API", () => {
  test("patient creates emergency and queue is returned", async () => {
    const patient = await registerAndLogin({
      name: "Emergency Patient",
      email: "emergency.patient@test.com",
      password: "patient123",
      role: "patient"
    });

    const createResponse = await request(app)
      .post("/api/emergency")
      .set("Authorization", `Bearer ${patient.token}`)
      .send({
        patientName: "Emergency Patient",
        contact: "9999999999",
        location: "Ward 4",
        priority: "high",
        symptoms: ["high fever", "vomiting"]
      });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.body.emergency.priority).toBe("high");

    const queueResponse = await request(app)
      .get("/api/emergency/queue")
      .set("Authorization", `Bearer ${patient.token}`);

    expect(queueResponse.statusCode).toBe(200);
    expect(queueResponse.body.queue.length).toBe(1);
  });

  test("admin updates emergency status", async () => {
    const patient = await registerAndLogin({
      name: "Patient X",
      email: "patientx@test.com",
      password: "patient123",
      role: "patient"
    });

    const admin = await createAdminAndLogin();

    const emergency = await request(app)
      .post("/api/emergency")
      .set("Authorization", `Bearer ${patient.token}`)
      .send({
        patientName: "Patient X",
        contact: "9898989898",
        location: "Main Gate",
        priority: "critical",
        symptoms: ["chest pain"]
      });

    const updateResponse = await request(app)
      .patch(`/api/emergency/${emergency.body.emergency._id}/status`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ status: "in_progress" });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.body.emergency.status).toBe("in_progress");
  });
});
