const mongoose = require("mongoose");
const ensureSuperAdmin = require("../utils/ensureSuperAdmin");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
    try {
      await ensureSuperAdmin();
    } catch (error) {
      console.error(`Super admin bootstrap failed: ${error.message}`);
    }
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
