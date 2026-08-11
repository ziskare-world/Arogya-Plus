const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

jest.setTimeout(30000);

let mongoServer;

beforeAll(async () => {
  process.env.JWT_SECRET = "test_jwt_secret";
  process.env.RAZORPAY_KEY_ID = "";
  process.env.RAZORPAY_KEY_SECRET = "";

  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri();
  await mongoose.connect(process.env.MONGO_URI);
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  const cleanups = Object.keys(collections).map((key) => collections[key].deleteMany({}));
  await Promise.all(cleanups);
});

afterAll(async () => {
  await mongoose.connection.close();
  if (mongoServer) {
    await mongoServer.stop();
  }
});
