const request = require("supertest");
const { app } = require("../index");
const { registerAndLogin } = require("./testUtils");

describe("Appointments API", () => {
  test("patient can book appointment and fetch QR token", async () => {
    const patient = await registerAndLogin({
      name: "Patient A",
      email: "patientA@test.com",
      password: "patient123",
      role: "patient"
    });

    const doctor = await registerAndLogin({
      name: "Doctor A",
      email: "doctorA@test.com",
      password: "doctor123",
      role: "doctor"
    });

    const bookResponse = await request(app)
      .post("/api/appointments")
      .set("Authorization", `Bearer ${patient.token}`)
      .send({
        doctorId: doctor.user.id,
        appointmentDate: "2026-12-20T10:00:00.000Z",
        reason: "Routine health checkup"
      });

    expect(bookResponse.statusCode).toBe(201);
    expect(bookResponse.body.appointment.tokenNumber).toContain("APT-");

    const qrResponse = await request(app)
      .get(`/api/appointments/${bookResponse.body.appointment._id}/token-qr`)
      .set("Authorization", `Bearer ${patient.token}`);

    expect(qrResponse.statusCode).toBe(200);
    expect(qrResponse.body.qrDataUrl).toContain("data:image/png;base64");
  });

  test("doctor can update appointment status", async () => {
    const patient = await registerAndLogin({
      name: "Patient B",
      email: "patientB@test.com",
      password: "patient123",
      role: "patient"
    });
    const doctor = await registerAndLogin({
      name: "Doctor B",
      email: "doctorB@test.com",
      password: "doctor123",
      role: "doctor"
    });

    const appointment = await request(app)
      .post("/api/appointments")
      .set("Authorization", `Bearer ${patient.token}`)
      .send({
        doctorId: doctor.user.id,
        appointmentDate: "2026-12-21T11:00:00.000Z",
        reason: "Headache"
      });

    const updateResponse = await request(app)
      .patch(`/api/appointments/${appointment.body.appointment._id}/status`)
      .set("Authorization", `Bearer ${doctor.token}`)
      .send({ status: "confirmed" });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.body.appointment.status).toBe("confirmed");
  });
});
