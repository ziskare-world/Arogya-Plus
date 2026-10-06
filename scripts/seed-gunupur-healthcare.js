const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const Hospital = require("../models/Hospital");
const User = require("../models/User");
const AmbulanceFleet = require("../models/AmbulanceFleet");

const GUNUPUR_HOSPITALS = [
  {
    name: "Arogya Life Multispeciality Hospital",
    latitude: 19.08250,
    longitude: 83.81550,
    address: "Main Hospital Road, Near Town Hall, Gunupur, Rayagada, Odisha 765022",
    city: "Gunupur",
    specialty: "Multispeciality & 24x7 Critical Trauma Care",
    phone: "+91-6857-220101",
    totalBeds: 150,
    occupiedBeds: 42,
    availableBeds: 108,
    icuBeds: { total: 24, occupied: 7, available: 17 },
    oxygenBeds: { total: 45, occupied: 12, available: 33 },
    rating: 4.9,
    reviewCount: 310,
    ambulanceContact: "108",
    emergencyServices: true,
    adminEmail: "admin.arogyalife@gunupurhealth.in",
    adminPassword: "Hospital@Gunupur1",
    adminName: "Arogya Life Hospital Admin"
  },
  {
    name: "Sub-Divisional Hospital (SDH) Gunupur",
    latitude: 19.08050,
    longitude: 83.81240,
    address: "Govt. Hospital Campus, Old Town Road, Gunupur, Rayagada, Odisha 765022",
    city: "Gunupur",
    specialty: "Government Sub-Divisional General & Emergency Hospital",
    phone: "+91-6857-220102",
    totalBeds: 100,
    occupiedBeds: 65,
    availableBeds: 35,
    icuBeds: { total: 12, occupied: 8, available: 4 },
    oxygenBeds: { total: 30, occupied: 18, available: 12 },
    rating: 4.7,
    reviewCount: 420,
    ambulanceContact: "108",
    emergencyServices: true,
    adminEmail: "admin.sdh@gunupurhealth.in",
    adminPassword: "Hospital@Gunupur2",
    adminName: "SDH Gunupur Medical Superintendent"
  },
  {
    name: "GIET University Health & Wellness Hospital",
    latitude: 19.07820,
    longitude: 83.82680,
    address: "GIET University Campus Road, Goboriguda, Gunupur, Rayagada, Odisha 765022",
    city: "Gunupur",
    specialty: "Academic Medical Center & Sports Medicine",
    phone: "+91-6857-220103",
    totalBeds: 80,
    occupiedBeds: 22,
    availableBeds: 58,
    icuBeds: { total: 10, occupied: 3, available: 7 },
    oxygenBeds: { total: 25, occupied: 6, available: 19 },
    rating: 4.8,
    reviewCount: 190,
    ambulanceContact: "108",
    emergencyServices: true,
    adminEmail: "admin.giet@gunupurhealth.in",
    adminPassword: "Hospital@Gunupur3",
    adminName: "GIET Health Center Admin"
  },
  {
    name: "Maa Majhigouri Emergency & Trauma Hospital",
    latitude: 19.08480,
    longitude: 83.81820,
    address: "Station Road, Near Railway Overbridge, Gunupur, Rayagada, Odisha 765022",
    city: "Gunupur",
    specialty: "Accident & Emergency Trauma Care Center",
    phone: "+91-6857-220104",
    totalBeds: 75,
    occupiedBeds: 31,
    availableBeds: 44,
    icuBeds: { total: 14, occupied: 6, available: 8 },
    oxygenBeds: { total: 28, occupied: 11, available: 17 },
    rating: 4.6,
    reviewCount: 145,
    ambulanceContact: "108",
    emergencyServices: true,
    adminEmail: "admin.majhigouri@gunupurhealth.in",
    adminPassword: "Hospital@Gunupur4",
    adminName: "Maa Majhigouri Hospital Admin"
  },
  {
    name: "Care & Cure Community Hospital",
    latitude: 19.08650,
    longitude: 83.81400,
    address: "College Road, Near Govt Autonomous Degree College, Gunupur, Odisha 765022",
    city: "Gunupur",
    specialty: "Community Healthcare & General Surgery",
    phone: "+91-6857-220105",
    totalBeds: 60,
    occupiedBeds: 25,
    availableBeds: 35,
    icuBeds: { total: 8, occupied: 2, available: 6 },
    oxygenBeds: { total: 18, occupied: 7, available: 11 },
    rating: 4.5,
    reviewCount: 98,
    ambulanceContact: "108",
    emergencyServices: true,
    adminEmail: "admin.carecure@gunupurhealth.in",
    adminPassword: "Hospital@Gunupur5",
    adminName: "Care & Cure Clinic Director"
  },
  {
    name: "Sanjeevani Maternal & Child Care Hospital",
    latitude: 19.07920,
    longitude: 83.81050,
    address: "Jagannath Temple Road, Market Chowk, Gunupur, Rayagada, Odisha 765022",
    city: "Gunupur",
    specialty: "Obstetrics, Gynecology & Neonatal Care",
    phone: "+91-6857-220106",
    totalBeds: 50,
    occupiedBeds: 20,
    availableBeds: 30,
    icuBeds: { total: 8, occupied: 3, available: 5 },
    oxygenBeds: { total: 16, occupied: 5, available: 11 },
    rating: 4.8,
    reviewCount: 160,
    ambulanceContact: "108",
    emergencyServices: true,
    adminEmail: "admin.sanjeevani@gunupurhealth.in",
    adminPassword: "Hospital@Gunupur6",
    adminName: "Sanjeevani Hospital Admin"
  },
  {
    name: "Shanti Nursing Home & Diagnostic Center",
    latitude: 19.08150,
    longitude: 83.81700,
    address: "Cinema Hall Road, Gunupur, Rayagada, Odisha 765022",
    city: "Gunupur",
    specialty: "Internal Medicine & Advanced Radiology Diagnostics",
    phone: "+91-6857-220107",
    totalBeds: 45,
    occupiedBeds: 16,
    availableBeds: 29,
    icuBeds: { total: 6, occupied: 2, available: 4 },
    oxygenBeds: { total: 15, occupied: 4, available: 11 },
    rating: 4.6,
    reviewCount: 112,
    ambulanceContact: "108",
    emergencyServices: true,
    adminEmail: "admin.shanti@gunupurhealth.in",
    adminPassword: "Hospital@Gunupur7",
    adminName: "Shanti Diagnostic Admin"
  },
  {
    name: "Sai Krupa Super Specialty Healthcare",
    latitude: 19.07580,
    longitude: 83.82150,
    address: "Marathiguda Bypass, Gunupur, Rayagada, Odisha 765022",
    city: "Gunupur",
    specialty: "Cardiology, Nephrology & Dialysis Care",
    phone: "+91-6857-220108",
    totalBeds: 65,
    occupiedBeds: 28,
    availableBeds: 37,
    icuBeds: { total: 12, occupied: 4, available: 8 },
    oxygenBeds: { total: 22, occupied: 9, available: 13 },
    rating: 4.7,
    reviewCount: 135,
    ambulanceContact: "108",
    emergencyServices: true,
    adminEmail: "admin.saikrupa@gunupurhealth.in",
    adminPassword: "Hospital@Gunupur8",
    adminName: "Sai Krupa Healthcare Admin"
  },
  {
    name: "Lifeline 24x7 Trauma & Critical Care Hospital",
    latitude: 19.08850,
    longitude: 83.82200,
    address: "NH-326 Highway Junction, Gunupur, Rayagada, Odisha 765022",
    city: "Gunupur",
    specialty: "Highway Emergency & Intensive Care",
    phone: "+91-6857-220109",
    totalBeds: 90,
    occupiedBeds: 40,
    availableBeds: 50,
    icuBeds: { total: 18, occupied: 9, available: 9 },
    oxygenBeds: { total: 35, occupied: 16, available: 19 },
    rating: 4.9,
    reviewCount: 225,
    ambulanceContact: "108",
    emergencyServices: true,
    adminEmail: "admin.lifeline@gunupurhealth.in",
    adminPassword: "Hospital@Gunupur9",
    adminName: "Lifeline Trauma Center Admin"
  },
  {
    name: "Apex Modern Hospital & Research Center",
    latitude: 19.08380,
    longitude: 83.81180,
    address: "Bansadhara Riverbank Road, Gunupur, Rayagada, Odisha 765022",
    city: "Gunupur",
    specialty: "Orthopedics, Neuro-Spine & Rehabilitation",
    phone: "+91-6857-220110",
    totalBeds: 70,
    occupiedBeds: 30,
    availableBeds: 40,
    icuBeds: { total: 10, occupied: 3, available: 7 },
    oxygenBeds: { total: 24, occupied: 8, available: 16 },
    rating: 4.7,
    reviewCount: 175,
    ambulanceContact: "108",
    emergencyServices: true,
    adminEmail: "admin.apex@gunupurhealth.in",
    adminPassword: "Hospital@Gunupur10",
    adminName: "Apex Modern Hospital Admin"
  }
];

const FIVE_DOCTORS = [
  {
    name: "Dr. Manoj Kumar Mishra",
    email: "dr.manoj.mishra@arogyaplus.com",
    password: "Doctor@Manoj123",
    specialization: "Cardiology",
    qualification: "MBBS, MD, DM (Cardiology)",
    experienceYears: 14,
    experience: 14,
    phone: "+91-9437123001",
    clinicAddress: "Chamber 101, OPD Block A, Arogya Life Multispeciality Hospital, Gunupur, Odisha 765022",
    consultationFee: 600,
    rating: 4.9,
    reviewCount: 148,
    gender: "male",
    age: 44,
    bloodGroup: "B+"
  },
  {
    name: "Dr. Sunita Pattnaik",
    email: "dr.sunita.pattnaik@arogyaplus.com",
    password: "Doctor@Sunita123",
    specialization: "Gynecology & Obstetrics",
    qualification: "MBBS, MS (OBG), FICOG",
    experienceYears: 11,
    experience: 11,
    phone: "+91-9437123002",
    clinicAddress: "Chamber 102, OPD Block B, Arogya Life Multispeciality Hospital, Gunupur, Odisha 765022",
    consultationFee: 500,
    rating: 4.8,
    reviewCount: 124,
    gender: "female",
    age: 39,
    bloodGroup: "O+"
  },
  {
    name: "Dr. Rajesh Mohapatra",
    email: "dr.rajesh.mohapatra@arogyaplus.com",
    password: "Doctor@Rajesh123",
    specialization: "General Medicine & Diabetology",
    qualification: "MBBS, MD (General Medicine)",
    experienceYears: 16,
    experience: 16,
    phone: "+91-9437123003",
    clinicAddress: "Chamber 103, OPD Block A, Arogya Life Multispeciality Hospital, Gunupur, Odisha 765022",
    consultationFee: 450,
    rating: 4.9,
    reviewCount: 210,
    gender: "male",
    age: 48,
    bloodGroup: "A+"
  },
  {
    name: "Dr. Alok Ranjan Sahu",
    email: "dr.alok.sahu@arogyaplus.com",
    password: "Doctor@Alok123",
    specialization: "Orthopedics & Joint Replacement",
    qualification: "MBBS, MS (Orthopedics)",
    experienceYears: 9,
    experience: 9,
    phone: "+91-9437123004",
    clinicAddress: "Chamber 104, OPD Block C, Arogya Life Multispeciality Hospital, Gunupur, Odisha 765022",
    consultationFee: 550,
    rating: 4.7,
    reviewCount: 92,
    gender: "male",
    age: 37,
    bloodGroup: "O+"
  },
  {
    name: "Dr. Priyanka Behera",
    email: "dr.priyanka.behera@arogyaplus.com",
    password: "Doctor@Priyanka123",
    specialization: "Pediatrics & Neonatal Care",
    qualification: "MBBS, MD (Pediatrics), DNB",
    experienceYears: 8,
    experience: 8,
    phone: "+91-9437123005",
    clinicAddress: "Chamber 105, OPD Block B, Arogya Life Multispeciality Hospital, Gunupur, Odisha 765022",
    consultationFee: 400,
    rating: 4.8,
    reviewCount: 86,
    gender: "female",
    age: 35,
    bloodGroup: "AB+"
  }
];

async function seed() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/smart-health-management";
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB:", mongoUri);

  // 1. Remove sample/dummy doctors (including Dr. Test Specialist)
  const delDocRes = await User.deleteMany({
    $or: [
      { name: "Dr. Test Specialist" },
      { email: { $regex: /^testdoc_/i } },
      { hospitalName: "Apollo Hospital" }
    ]
  });
  console.log(`Removed sample doctor records: ${delDocRes.deletedCount}`);

  // 2. Remove any previously created Gunupur doctors/admins to ensure fresh, clean seeding
  await User.deleteMany({
    email: {
      $in: [
        ...FIVE_DOCTORS.map(d => d.email),
        ...GUNUPUR_HOSPITALS.map(h => h.adminEmail)
      ]
    }
  });

  // 3. Clear old hospitals and re-insert 10 Gunupur hospitals
  await Hospital.deleteMany({});
  console.log("Cleared old hospital collection.");

  const createdHospitals = [];
  for (const hData of GUNUPUR_HOSPITALS) {
    const hosp = await Hospital.create({
      name: hData.name,
      latitude: hData.latitude,
      longitude: hData.longitude,
      address: hData.address,
      city: hData.city,
      specialty: hData.specialty,
      phone: hData.phone,
      totalBeds: hData.totalBeds,
      occupiedBeds: hData.occupiedBeds,
      availableBeds: hData.availableBeds,
      icuBeds: hData.icuBeds,
      oxygenBeds: hData.oxygenBeds,
      rating: hData.rating,
      reviewCount: hData.reviewCount,
      ambulanceContact: hData.ambulanceContact,
      emergencyServices: hData.emergencyServices,
      location: {
        type: "Point",
        coordinates: [hData.longitude, hData.latitude]
      }
    });

    // Create corresponding Hospital Admin user account
    await User.create({
      name: hData.adminName,
      email: hData.adminEmail,
      password: hData.adminPassword,
      role: "admin",
      hospital: hosp._id,
      hospitalName: hosp.name,
      hospitalAddress: hosp.address,
      hospitalCoordinates: { lat: hosp.latitude, lng: hosp.longitude },
      phone: hosp.phone,
      department: hosp.specialty,
      isActive: true,
      isProfileComplete: true,
      accessLevel: "full"
    });

    createdHospitals.push(hosp);
    console.log(`Created Hospital & Admin: ${hosp.name}`);
  }

  // 4. Add the 5 doctors into the primary hospital: Arogya Life Multispeciality Hospital
  const primaryHospital = createdHospitals.find(h => h.name === "Arogya Life Multispeciality Hospital");
  const primaryAdmin = await User.findOne({ email: "admin.arogyalife@gunupurhealth.in" });

  for (const docData of FIVE_DOCTORS) {
    await User.create({
      name: docData.name,
      email: docData.email,
      password: docData.password,
      role: "doctor",
      hospital: primaryHospital._id,
      hospitalName: primaryHospital.name,
      hospitalAddress: primaryHospital.address,
      hospitalCoordinates: { lat: primaryHospital.latitude, lng: primaryHospital.longitude },
      clinicAddress: docData.clinicAddress,
      clinicCoordinates: { lat: primaryHospital.latitude, lng: primaryHospital.longitude },
      specialization: docData.specialization,
      qualification: docData.qualification,
      experienceYears: docData.experienceYears,
      experience: docData.experience,
      consultationFee: docData.consultationFee,
      phone: docData.phone,
      gender: docData.gender,
      age: docData.age,
      bloodGroup: docData.bloodGroup,
      rating: docData.rating,
      reviewCount: docData.reviewCount,
      isActive: true,
      isAvailable: true,
      isProfileComplete: true,
      createdByAdmin: primaryAdmin ? primaryAdmin._id : null
    });
    console.log(`Created Doctor: ${docData.name} (${docData.specialization}) under ${primaryHospital.name}`);
  }

  // 5. Update AmbulanceFleet to use Gunupur locations
  await AmbulanceFleet.deleteMany({});
  await AmbulanceFleet.insertMany([
    {
      hospitalName: "Arogya Life Multispeciality Hospital",
      hospitalAddress: "Main Hospital Road, Near Town Hall, Gunupur, Rayagada, Odisha 765022",
      hospitalCoordinates: { lat: 19.08250, lng: 83.81550 },
      vehicleNumber: "OD-18-AMB-1081",
      driverName: "Santosh Kumar Nayak",
      driverPhone: "+91-9437554401",
      equipmentLevel: "ALS",
      status: "available",
      speed: 0,
      currentCoordinates: { lat: 19.08250, lng: 83.81550 }
    },
    {
      hospitalName: "Sub-Divisional Hospital (SDH) Gunupur",
      hospitalAddress: "Govt. Hospital Campus, Old Town Road, Gunupur, Rayagada, Odisha 765022",
      hospitalCoordinates: { lat: 19.08050, lng: 83.81240 },
      vehicleNumber: "OD-18-AMB-1082",
      driverName: "Bikram Keshari Rout",
      driverPhone: "+91-9437554402",
      equipmentLevel: "BLS",
      status: "available",
      speed: 0,
      currentCoordinates: { lat: 19.08050, lng: 83.81240 }
    },
    {
      hospitalName: "Lifeline 24x7 Trauma & Critical Care Hospital",
      hospitalAddress: "NH-326 Highway Junction, Gunupur, Rayagada, Odisha 765022",
      hospitalCoordinates: { lat: 19.08850, lng: 83.82200 },
      vehicleNumber: "OD-18-AMB-1083",
      driverName: "Deepak Sahu",
      driverPhone: "+91-9437554403",
      equipmentLevel: "ICU Ambulance",
      status: "available",
      speed: 0,
      currentCoordinates: { lat: 19.08850, lng: 83.82200 }
    }
  ]);
  console.log("Seeded Gunupur Ambulance Fleet.");

  console.log("\n==============================================");
  console.log("✅ Gunupur Healthcare Database Seeding Completed!");
  console.log(`Total Hospitals: ${createdHospitals.length}`);
  console.log(`Total Doctors: ${FIVE_DOCTORS.length} (inside Arogya Life Multispeciality Hospital)`);
  console.log("==============================================\n");

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
