const request = require("supertest");
const { app } = require("../index");
const User = require("../models/User");

const registerAndLogin = async ({ name, email, password, role = "patient", phone = "9999999999" }) => {
  const registerResponse = await request(app).post("/api/auth/register").send({
    name,
    email,
    password,
    role,
    phone
  });

  return {
    token: registerResponse.body.token,
    user: registerResponse.body.user,
    response: registerResponse
  };
};

const createAdminAndLogin = async () => {
  const adminEmail = "admin@test.com";
  const adminPassword = "admin123";

  await User.create({
    name: "System Admin",
    email: adminEmail,
    password: adminPassword,
    role: "admin",
    phone: "8888888888"
  });

  const loginResponse = await request(app).post("/api/auth/login").send({
    email: adminEmail,
    password: adminPassword
  });

  return {
    token: loginResponse.body.token,
    user: loginResponse.body.user,
    response: loginResponse
  };
};

module.exports = { registerAndLogin, createAdminAndLogin };
