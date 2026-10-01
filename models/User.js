const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const familyMemberSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Family member name is required"],
      trim: true
    },
    relationship: {
      type: String,
      enum: ["Father", "Mother", "Spouse", "Child", "Son", "Daughter", "Brother", "Sister", "Grandparent", "Other"],
      required: [true, "Relationship is required"],
      default: "Other"
    },
    age: {
      type: Number,
      min: 0,
      max: 130
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: "other"
    },
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"],
      default: "Unknown"
    },
    phone: {
      type: String,
      trim: true
    },
    address: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    coordinates: {
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
    medicalHistory: [
      {
        type: String,
        trim: true
      }
    ],
    allergies: [
      {
        type: String,
        trim: true
      }
    ],
    isEmergencyContact: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

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
    age: {
      type: Number,
      min: 0,
      max: 130
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"]
    },
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"],
      default: "Unknown"
    },
    address: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    coordinates: {
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
    medicalHistory: [
      {
        type: String,
        trim: true
      }
    ],
    allergies: [
      {
        type: String,
        trim: true
      }
    ],
    isProfileComplete: {
      type: Boolean,
      default: false
    },
    familyMembers: {
      type: [familyMemberSchema],
      validate: [
        function(val) {
          return !val || val.length <= 5;
        },
        "A profile can contain a maximum of 5 family members"
      ],
      default: []
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      default: null
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
    },
    isAvailable: {
      type: Boolean,
      default: true
    },
    consultationFee: {
      type: Number,
      default: 500,
      min: 0
    },
    isTerminated: {
      type: Boolean,
      default: false
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5.0
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0
    },
    qualification: {
      type: String,
      default: "MBBS, MD",
      trim: true
    },
    experienceYears: {
      type: Number,
      default: 0,
      min: 0
    },
    experience: {
      type: Number,
      default: 0,
      min: 0
    },
    mfaEnabled: {
      type: Boolean,
      default: false
    },
    totpVerified: {
      type: Boolean,
      default: false
    },
    totpSecret: {
      type: String,
      default: null
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
