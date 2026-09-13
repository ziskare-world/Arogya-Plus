const express = require("express");
const router = express.Router();
const Hospital = require("../models/Hospital");
const AmbulanceFleet = require("../models/AmbulanceFleet");
const Emergency = require("../models/Emergency");

// Initial sample hospital data to ensure maps load rich clinical markers out of the box
const User = require("../models/User");

// Legacy dummy sample hospital names that should NEVER be shown if user didn't add them
const DUMMY_HOSPITAL_NAMES = [
  "Arogya Central Multi-Specialty Hospital",
  "City Care Trauma & Emergency Center",
  "Metro Health Super Specialty Clinic",
  "Apex Blood Bank & Urgent Care"
];

// Helper to ensure hospitals in MongoDB match the actual hospitals added by administrators
const syncHospitalsFromDatabase = async () => {
  try {
    // Purge fake dummy hospitals so only user-added hospitals exist
    await Hospital.deleteMany({ name: { $in: DUMMY_HOSPITAL_NAMES } });

    // Sync any registered hospital admin users who have a hospitalName
    const admins = await User.find({
      role: "admin",
      hospitalName: { $exists: true, $ne: "" }
    }).lean();

    for (const admin of admins) {
      const coords = admin.hospitalCoordinates || {};
      const lat = Number(coords.lat || 19.0715764);
      const lng = Number(coords.lng || 83.8095657);

      await Hospital.findOneAndUpdate(
        { name: admin.hospitalName },
        {
          $setOnInsert: {
            name: admin.hospitalName,
            address: admin.hospitalAddress || "hospital road, Gunupur Town, Ketalugurha, Gunupur, Rayagada, Odisha, 765022, India",
            latitude: lat,
            longitude: lng,
            phone: admin.phone || "+91-11-23456789",
            specialty: admin.department || "Neurology & Multi-Specialty",
            totalBeds: 100,
            occupiedBeds: 14,
            availableBeds: 86,
            emergencyServices: true
          }
        },
        { upsert: true, new: true }
      );
    }
  } catch (err) {
    console.warn("[Map GIS] syncHospitalsFromDatabase warning:", err.message);
  }
};

const DEFAULT_FLEET = [
  {
    hospitalName: "Pawan_Multinational_Hospital",
    hospitalAddress: "hospital road, Gunupur Town, Ketalugurha, Gunupur, Rayagada, Odisha, 765022, India",
    hospitalCoordinates: { lat: 19.0715764, lng: 83.8095657 },
    vehicleNumber: "OD17C8056",
    driverName: "Om Meher",
    driverPhone: "+91-8658067196",
    equipmentLevel: "ALS",
    status: "available",
    speed: 0,
    currentCoordinates: { lat: 19.0715764, lng: 83.8095657 }
  },
  {
    hospitalName: "Pawan_Multinational_Hospital",
    hospitalAddress: "hospital road, Gunupur Town, Ketalugurha, Gunupur, Rayagada, Odisha, 765022, India",
    hospitalCoordinates: { lat: 19.0715764, lng: 83.8095657 },
    vehicleNumber: "DL-01-AMB-101",
    driverName: "Rajesh Kumar",
    driverPhone: "+91-9876543210",
    equipmentLevel: "ALS",
    status: "available",
    speed: 0,
    currentCoordinates: { lat: 19.0715764, lng: 83.8095657 }
  }
];

/**
 * Bootstraps and pre-populates location map GIS markers when server starts
 */
const initializeMapData = async () => {
  try {
    await syncHospitalsFromDatabase();
    const hospitals = await Hospital.find();

    let fleet = await AmbulanceFleet.find();
    if (!fleet || fleet.length === 0) {
      fleet = await AmbulanceFleet.insertMany(DEFAULT_FLEET);
      console.log(`[Map GIS] Seeded ${fleet.length} default ambulance fleet markers.`);
    }

    console.log(`[Map GIS] Location map initialized at server startup (${hospitals.length} Hospitals, ${fleet.length} Fleet Vehicles active).`);
    return { success: true, hospitalsCount: hospitals.length, fleetCount: fleet.length };
  } catch (err) {
    console.error(`[Map GIS] Location map initialization error: ${err.message}`);
    return { success: false, error: err.message };
  }
};

// Helper to calculate Haversine Distance in Kilometers
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of Earth in KM
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * @route GET /api/map/hospitals
 * @desc Get all hospital locations stored in MongoDB with assigned doctors
 */
router.get("/hospitals", async (req, res) => {
  try {
    await syncHospitalsFromDatabase();
    const hospitals = await Hospital.find();

    // Query active doctors to attach to their respective hospitals
    const allDoctors = await User.find({ role: "doctor", isActive: true })
      .select("name email specialization experienceYears rating reviewCount phone clinicAddress hospitalName")
      .lean();

    const dataWithDoctors = hospitals.map(h => {
      const normHospName = (h.name || "").toLowerCase().replace(/[\s_-]+/g, "");
      const assignedDoctors = allDoctors.filter(doc => {
        const docHosp = (doc.hospitalName || "").toLowerCase().replace(/[\s_-]+/g, "");
        return docHosp && (docHosp === normHospName || docHosp.includes(normHospName) || normHospName.includes(docHosp));
      });

      return {
        ...h.toObject(),
        doctors: assignedDoctors
      };
    });

    res.json({ success: true, count: dataWithDoctors.length, data: dataWithDoctors });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route GET /api/map/nearest-hospital
 * @desc Find the nearest hospital added in the database from user location coordinates with live bed occupancy, ETA, & assigned doctors
 */
router.get("/nearest-hospital", async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        success: false,
        error: "Valid latitude and longitude query parameters are required"
      });
    }

    await syncHospitalsFromDatabase();
    const hospitals = await Hospital.find();

    if (!hospitals || hospitals.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No hospitals currently registered in database"
      });
    }

    // Query active doctors to attach to their assigned hospital
    const allDoctors = await User.find({ role: "doctor", isActive: true })
      .select("name email specialization experienceYears rating reviewCount phone clinicAddress hospitalName")
      .lean();

    const ranked = hospitals.map(h => {
      const hLat = h.latitude;
      const hLng = h.longitude;
      const distance = calculateHaversineDistance(lat, lng, hLat, hLng);
      const etaMinutes = Math.max(3, Math.round(distance * 1.5 + 3));

      // Match doctors assigned under this hospital
      const normHospName = (h.name || "").toLowerCase().replace(/[\s_-]+/g, "");
      const assignedDoctors = allDoctors.filter(doc => {
        const docHosp = (doc.hospitalName || "").toLowerCase().replace(/[\s_-]+/g, "");
        return docHosp && (docHosp === normHospName || docHosp.includes(normHospName) || normHospName.includes(docHosp));
      });

      return {
        id: h._id,
        name: h.name,
        address: h.address,
        city: h.city || "Healthcare Facility",
        latitude: hLat,
        longitude: hLng,
        phone: h.phone || "+91-11-23456789",
        specialty: h.specialty || "Multi-Specialty Care",
        distanceKm: parseFloat(distance.toFixed(2)),
        etaMinutes,
        beds: {
          total: h.totalBeds || 100,
          occupied: h.occupiedBeds || 14,
          available: h.availableBeds !== undefined ? h.availableBeds : 86,
          icu: h.icuBeds || { total: 20, occupied: 6, available: 14 },
          oxygen: h.oxygenBeds || { total: 35, occupied: 10, available: 25 }
        },
        emergencyServices: h.emergencyServices !== false,
        rating: h.rating || 4.8,
        doctors: assignedDoctors
      };
    });

    ranked.sort((a, b) => a.distanceKm - b.distanceKm);
    const nearestHospital = ranked[0] || null;

    return res.status(200).json({
      success: true,
      nearestHospital,
      allHospitalsRanked: ranked
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/map/hospitals
 * @desc Add a new hospital with bed occupancy and geolocation to MongoDB
 */
router.post("/hospitals", async (req, res) => {
  try {
    const {
      name,
      latitude,
      longitude,
      address,
      city,
      specialty,
      phone,
      totalBeds = 100,
      occupiedBeds = 40,
      icuBeds,
      oxygenBeds,
      emergencyServices = true
    } = req.body;

    if (!name || latitude === undefined || longitude === undefined || !address) {
      return res.status(400).json({
        success: false,
        error: "Hospital name, latitude, longitude, and address are required"
      });
    }

    const availableBeds = Math.max(0, totalBeds - occupiedBeds);
    const hospital = await Hospital.create({
      name,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      address,
      city: city || "Delhi NCR",
      specialty: specialty || "Multi-Specialty Healthcare",
      phone: phone || "+91-11-23456789",
      totalBeds,
      occupiedBeds,
      availableBeds,
      icuBeds: icuBeds || { total: 20, occupied: 12, available: 8 },
      oxygenBeds: oxygenBeds || { total: 30, occupied: 18, available: 12 },
      emergencyServices
    });

    return res.status(201).json({
      success: true,
      message: "Hospital created successfully in database",
      data: hospital
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route PATCH /api/map/hospitals/:id/beds
 * @desc Update live bed occupancy for a hospital in MongoDB
 */
router.patch("/hospitals/:id/beds", async (req, res) => {
  try {
    const { occupiedBeds, totalBeds, icuBeds, oxygenBeds } = req.body;
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) {
      return res.status(404).json({ success: false, error: "Hospital not found" });
    }

    if (totalBeds !== undefined) hospital.totalBeds = totalBeds;
    if (occupiedBeds !== undefined) hospital.occupiedBeds = occupiedBeds;
    hospital.availableBeds = Math.max(0, hospital.totalBeds - hospital.occupiedBeds);

    if (icuBeds) hospital.icuBeds = { ...hospital.icuBeds, ...icuBeds };
    if (oxygenBeds) hospital.oxygenBeds = { ...hospital.oxygenBeds, ...oxygenBeds };

    await hospital.save();
    return res.status(200).json({
      success: true,
      message: "Hospital bed occupancy updated successfully",
      data: hospital
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route GET /api/map/ambulances
 * @desc Get all live ambulance fleet locations
 */
router.get("/ambulances", async (req, res) => {
  try {
    let fleet = await AmbulanceFleet.find();

    // Map response fields to meet item 10 spec: ambulanceId, latitude, longitude, driver, status, speed
    const formatted = fleet.map(item => ({
      id: item._id,
      ambulanceId: item.vehicleNumber,
      vehicleNumber: item.vehicleNumber,
      hospitalName: item.hospitalName,
      driver: item.driverName || "On Duty Driver",
      driverPhone: item.driverPhone || "+91-9876543210",
      status: item.status || "available",
      speed: item.speed || 0,
      latitude: item.currentCoordinates?.lat || 28.6139,
      longitude: item.currentCoordinates?.lng || 77.2090,
      updatedAt: item.updatedAt
    }));

    res.json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/map/ambulances/update-location
 * @desc Update single ambulance position and broadcast live event to all connected clients
 */
router.post("/ambulances/update-location", async (req, res) => {
  try {
    const { vehicleNumber, latitude, longitude, speed = 35, status = "dispatched" } = req.body;
    if (!vehicleNumber || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, error: "vehicleNumber, latitude, and longitude are required" });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const spd = parseFloat(speed) || 0;

    const fleetVehicle = await AmbulanceFleet.findOneAndUpdate(
      { vehicleNumber },
      {
        $set: {
          "currentCoordinates.lat": lat,
          "currentCoordinates.lng": lng,
          speed: spd,
          status
        }
      },
      { new: true }
    );

    const payload = {
      vehicleNumber,
      ambulanceId: vehicleNumber,
      latitude: lat,
      longitude: lng,
      speed: spd,
      status,
      timestamp: new Date()
    };

    if (req.io) {
      req.io.emit("ambulance:location_changed", payload);
    }

    return res.status(200).json({
      success: true,
      message: "Ambulance location updated and broadcasted",
      data: payload,
      vehicle: fleetVehicle
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/map/ambulances/simulate-step
 * @desc Automate live GPS tracking: smoothly advances ambulance fleet coordinates along realistic paths
 */
router.post("/ambulances/simulate-step", async (req, res) => {
  try {
    let fleet = await AmbulanceFleet.find();
    if (!fleet || fleet.length === 0) {
      fleet = await AmbulanceFleet.insertMany(DEFAULT_FLEET);
    }

    const updated = [];
    for (const vehicle of fleet) {
      const currentLat = vehicle.currentCoordinates?.lat || 28.6139;
      const currentLng = vehicle.currentCoordinates?.lng || 77.2090;

      // Realistic micro-step simulation: ~0.001 deg (~100m) delta with jitter
      const deltaLat = (Math.random() - 0.48) * 0.0015;
      const deltaLng = (Math.random() - 0.48) * 0.0015;
      const newLat = parseFloat((currentLat + deltaLat).toFixed(6));
      const newLng = parseFloat((currentLng + deltaLng).toFixed(6));
      const speed = Math.floor(Math.random() * 25) + 30; // 30-55 km/h

      vehicle.currentCoordinates = { lat: newLat, lng: newLng };
      vehicle.speed = speed;
      if (vehicle.status === "available" && Math.random() > 0.7) {
        vehicle.status = "dispatched";
      }
      await vehicle.save();

      const eventPayload = {
        vehicleNumber: vehicle.vehicleNumber,
        ambulanceId: vehicle.vehicleNumber,
        latitude: newLat,
        longitude: newLng,
        speed,
        status: vehicle.status,
        timestamp: new Date()
      };

      if (req.io) {
        req.io.emit("ambulance:location_changed", eventPayload);
      }
      updated.push(eventPayload);
    }

    return res.status(200).json({
      success: true,
      message: "Live ambulance tracking simulation step executed successfully",
      count: updated.length,
      data: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route GET /api/map/emergencies
 * @desc Get active emergency incidents
 */
router.get("/emergencies", async (req, res) => {
  try {
    const emergencies = await Emergency.find({ status: { $ne: "resolved" } });
    const formatted = emergencies.map(e => ({
      id: e._id,
      patientId: e.createdBy,
      patientName: e.patientName,
      contact: e.contact,
      location: e.location,
      latitude: e.latitude || 28.6139,
      longitude: e.longitude || 77.2090,
      priority: e.priority || "medium",
      status: e.status || "waiting",
      timestamp: e.createdAt
    }));

    res.json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route GET /api/map/nearby
 * @desc Fetch nearby healthcare facilities (Hospitals, Clinics, Pharmacies, Blood Banks, Ambulance Stations) via Overpass API
 */
router.get("/nearby", async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat) || 28.6139;
    const lng = parseFloat(req.query.lng) || 77.2090;
    const radius = parseInt(req.query.radius) || 5000; // in meters
    const type = req.query.type || "hospital"; // hospital, clinic, pharmacy, blood_bank

    // Overpass API Query
    let amenityType = "hospital";
    if (type === "pharmacy") amenityType = "pharmacy";
    if (type === "clinic") amenityType = "clinic";
    if (type === "blood_bank") amenityType = "blood_bank";

    const overpassQuery = `[out:json][timeout:15];
      (
        node["amenity"="${amenityType}"](around:${radius},${lat},${lng});
        way["amenity"="${amenityType}"](around:${radius},${lat},${lng});
        node["healthcare"="${type}"](around:${radius},${lat},${lng});
      );
      out body center 20;`;

    const overpassUrl = "https://overpass-api.de/api/interpreter";
    const response = await fetch(overpassUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(overpassQuery)
    });

    if (!response.ok) {
      // Return local fallback hospitals if Overpass API rate limited
      const localHospitals = await Hospital.find();
      return res.json({ success: true, source: "database_fallback", data: localHospitals });
    }

    const data = await response.json();
    const elements = data.elements || [];

    const results = elements.map(el => {
      const elLat = el.lat || (el.center ? el.center.lat : lat);
      const elLng = el.lon || (el.center ? el.center.lon : lng);
      const dist = calculateHaversineDistance(lat, lng, elLat, elLng);

      return {
        id: el.id,
        name: el.tags?.name || `${type.toUpperCase()} Facility`,
        amenity: el.tags?.amenity || type,
        latitude: elLat,
        longitude: elLng,
        address: el.tags?.["addr:street"] ? `${el.tags["addr:street"]}, ${el.tags["addr:city"] || ""}` : "Near requested location",
        phone: el.tags?.phone || el.tags?.["contact:phone"] || "N/A",
        distanceKm: parseFloat(dist.toFixed(2))
      };
    });

    // Sort by nearest distance
    results.sort((a, b) => a.distanceKm - b.distanceKm);

    res.json({ success: true, count: results.length, data: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/map/route
 * @desc Calculate driving route, distance, ETA, and alternative routes via OSRM / OpenRouteService
 */
router.post("/route", async (req, res) => {
  try {
    const { startLat, startLng, endLat, endLng } = req.body;

    if (!startLat || !startLng || !endLat || !endLng) {
      return res.status(400).json({ success: false, error: "startLat, startLng, endLat, endLng are required" });
    }

    const orsApiKey = String(process.env.OPENROUTESERVICE_API_KEY || "").trim();

    // Try OpenRouteService API first if key available
    if (orsApiKey) {
      try {
        const orsUrl = "https://api.openrouteservice.org/v2/directions/driving-car/geojson";
        const orsResponse = await fetch(orsUrl, {
          method: "POST",
          headers: {
            "Authorization": orsApiKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            coordinates: [[parseFloat(startLng), parseFloat(startLat)], [parseFloat(endLng), parseFloat(endLat)]]
          })
        });

        if (orsResponse.ok) {
          const orsData = await orsResponse.json();
          if (orsData.features && orsData.features.length > 0) {
            const feat = orsData.features[0];
            const summary = feat.properties.summary || {};
            const distMeters = summary.distance || 0;
            const durSec = summary.duration || 0;
            const distKm = parseFloat((distMeters / 1000).toFixed(2));
            const etaMins = Math.max(1, Math.round(durSec / 60));

            return res.json({
              success: true,
              provider: "OpenRouteService",
              distanceKm: distKm,
              distanceMeters: distMeters,
              etaMinutes: etaMins,
              etaSeconds: durSec,
              geometry: feat.geometry,
              alternatives: []
            });
          }
        }
      } catch (orsErr) {
        console.warn("OpenRouteService API fallback to OSRM:", orsErr.message);
      }
    }

    // Free OSRM Public Router API Fallback
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true&alternatives=true`;

    const response = await fetch(osrmUrl);
    if (!response.ok) {
      // Calculate straight-line fallback route if OSRM is unreachable
      const distanceKm = calculateHaversineDistance(startLat, startLng, endLat, endLng);
      const etaMinutes = Math.max(2, Math.round((distanceKm / 35) * 60)); // assume 35 km/h avg speed

      return res.json({
        success: true,
        fallback: true,
        distanceKm: parseFloat(distanceKm.toFixed(2)),
        distanceMeters: Math.round(distanceKm * 1000),
        etaMinutes: etaMinutes,
        etaSeconds: etaMinutes * 60,
        geometry: {
          type: "LineString",
          coordinates: [[startLng, startLat], [endLng, endLat]]
        },
        alternatives: []
      });
    }

    const data = await response.json();
    if (!data.routes || data.routes.length === 0) {
      return res.status(404).json({ success: false, error: "No driving route found" });
    }

    const primaryRoute = data.routes[0];
    const distanceMeters = primaryRoute.distance;
    const durationSeconds = primaryRoute.duration;
    const distanceKm = parseFloat((distanceMeters / 1000).toFixed(2));
    const etaMinutes = Math.max(1, Math.round(durationSeconds / 60));

    const alternatives = data.routes.slice(1).map((r, index) => ({
      id: index + 1,
      distanceKm: parseFloat((r.distance / 1000).toFixed(2)),
      etaMinutes: Math.max(1, Math.round(r.duration / 60)),
      geometry: r.geometry
    }));

    res.json({
      success: true,
      distanceKm,
      distanceMeters,
      etaMinutes,
      etaSeconds: durationSeconds,
      geometry: primaryRoute.geometry,
      steps: primaryRoute.legs[0]?.steps || [],
      alternatives
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


/**
 * @route GET /api/map/tiles/:z/:x/:y.png
 * @desc Reliable GIS Map Tile Proxy - eliminates 403 blocks and caches map tiles locally
 */
router.get("/tiles/:z/:x/:y.png", async (req, res) => {
  try {
    const { z, x, y } = req.params;
    const cleanY = String(y).replace(/\.(png|jpg|jpeg)$/i, "");

    const subdomains = ["a", "b", "c", "d"];
    const sub = subdomains[Math.floor(Math.random() * subdomains.length)];

    // Primary: CartoDB Voyager
    const primaryUrl = `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${cleanY}.png`;

    let response = await fetch(primaryUrl, {
      headers: {
        "User-Agent": "ArogyaPlus-Healthcare-System/1.0",
        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8"
      }
    });

    // Fallback: Esri World Street Map if CartoDB fails
    if (!response.ok) {
      const fallbackUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${cleanY}/${x}`;
      response = await fetch(fallbackUrl, {
        headers: { "User-Agent": "ArogyaPlus-Healthcare-System/1.0" }
      });
    }

    if (!response.ok) {
      return res.status(response.status).send("Tile fetch failed");
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const buffer = Buffer.from(await response.arrayBuffer());

    res.set({
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=604800, immutable",
      "Access-Control-Allow-Origin": "*"
    });

    res.send(buffer);
  } catch (err) {
    res.status(500).send("Tile proxy error");
  }
});


/**
 * @route POST /api/map/geocode
 * @desc Address Search / Forward Geocoding via Nominatim API
 */
router.post("/geocode", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ success: false, error: "Address query is required" });
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&extratags=1&addressdetails=1&q=${encodeURIComponent(query)}&limit=5`;
    const response = await fetch(url, {
      headers: { "User-Agent": "ArogyaPlus-Healthcare-System/1.0" }
    });

    if (!response.ok) {
      return res.status(502).json({ success: false, error: "Geocoding service unavailable" });
    }

    const data = await response.json();
    const results = data.map(item => {
      const phone = item.extratags?.phone || item.extratags?.["contact:phone"] || item.extratags?.["phone:mobile"] || item.extratags?.mobile || "";
      const name = item.extratags?.name || item.name || item.address?.hospital || item.address?.clinic || item.address?.amenity || "";
      return {
        placeId: item.place_id,
        displayName: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        type: item.type,
        hospitalName: name,
        phone: phone ? String(phone).trim() : ""
      };
    });

    res.json({ success: true, count: results.length, data: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/map/reverse-geocode
 * @desc Latitude/Longitude to Address & Details Conversion via Nominatim API
 */
router.post("/reverse-geocode", async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, error: "latitude and longitude are required" });
    }

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&extratags=1&addressdetails=1&lat=${latitude}&lon=${longitude}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "ArogyaPlus-Healthcare-System/1.0" }
    });

    if (!response.ok) {
      return res.status(502).json({ success: false, error: "Reverse geocoding service unavailable" });
    }

    const data = await response.json();
    const phone = data.extratags?.phone || data.extratags?.["contact:phone"] || data.extratags?.["phone:mobile"] || data.extratags?.mobile || "";
    const name = data.extratags?.name || data.name || data.address?.hospital || data.address?.clinic || data.address?.amenity || "";

    res.json({
      success: true,
      displayName: data.display_name || `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
      addressDetails: data.address || {},
      hospitalName: name ? String(name).trim() : "",
      phone: phone ? String(phone).trim() : ""
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
module.exports.initializeMapData = initializeMapData;
