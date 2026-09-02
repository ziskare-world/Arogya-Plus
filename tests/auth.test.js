const request = require("supertest");
const { app } = require("../index");

describe("Auth API", () => {
  test("registers a patient user", async () => {
    const payload = {
      name: "Patient One",
      email: "patient1@test.com",
      password: "patient123",
      role: "patient",
      phone: "9876543210"
    };

    const response = await request(app).post("/api/auth/register").send(payload);

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.token).toBeDefined();
    expect(response.body.user.email).toBe(payload.email);
  });

  test("does not allow duplicate email registration", async () => {
    const payload = {
      name: "Patient One",
      email: "duplicate@test.com",
      password: "patient123",
      role: "patient"
    };

    await request(app).post("/api/auth/register").send(payload);
    const duplicateResponse = await request(app).post("/api/auth/register").send(payload);

    expect(duplicateResponse.statusCode).toBe(409);
    expect(duplicateResponse.body.success).toBe(false);
  });

  test("logs in and fetches profile with JWT", async () => {
    const registerPayload = {
      name: "Patient Two",
      email: "doctor1@test.com",
      password: "doctor123",
      role: "patient"
    };

    await request(app).post("/api/auth/register").send(registerPayload);

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: registerPayload.email,
      password: registerPayload.password
    });

    expect(loginResponse.statusCode).toBe(200);
    expect(loginResponse.body.token).toBeDefined();

    const meResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loginResponse.body.token}`);

    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.body.user.email).toBe(registerPayload.email);
  });

  test("handles POST /api/auth/logout successfully", async () => {
    const response = await request(app).post("/api/auth/logout").send({});
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toMatch(/logged out/i);
  });

  test("serves login.html properly for /login and /login.html", async () => {
    const res1 = await request(app).get("/login");
    expect(res1.statusCode).toBe(200);
    expect(res1.text).toContain("loginForm");

    const res2 = await request(app).get("/login.html");
    expect(res2.statusCode).toBe(200);
    expect(res2.text).toContain("loginForm");
  });
});
