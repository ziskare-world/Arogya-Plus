const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6
    },
    phone: {
      type: String,
      trim: true
    },
    hospitalName: {
      type: String,
      trim: true
    },
    hospitalAddress: {
      type: String,
      trim: true
    },
    hospitalCoordinates: {
      lat: {
        type: Number,
        min: -90,
        max: 90
      },
      lng: {
        type: Number,
        min: -180,
        max: 180
      }
    },
    department: {
      type: String,
      trim: true
    },
    accessLevel: {
      type: String,
      enum: ["full", "operations", "limited", "receptionist"],
      default: "limited"
    },
    specialization: {
      type: String,
      trim: true
    },
    clinicAddress: {
      type: String,
      trim: true
    },
    clinicCoordinates: {
      lat: {
        type: Number,
        min: -90,
        max: 90
      },
      lng: {
        type: Number,
        min: -180,
        max: 180
      }
    },
    role: {
      type: String,
      enum: ["patient", "doctor", "admin", "super-admin"],
      default: "patient"
    },
    createdByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

// Hash password only when it is newly set or changed.
userSchema.pre("save", async function userPreSave(next) {
  if (!this.isModified("password")) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  return next();
});

userSchema.methods.matchPassword = async function matchPassword(enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
