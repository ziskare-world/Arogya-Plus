const express = require("express");
const router = express.Router();
const Hospital = require("../models/Hospital");
const AmbulanceFleet = require("../models/AmbulanceFleet");
const Emergency = require("../models/Emergency");

// Initial sample hospital data to ensure maps load rich clinical markers out of the box
const DEFAULT_HOSPITALS = [
  {
    name: "Arogya Central Multi-Specialty Hospital",
    latitude: 28.6139,
    longitude: 77.2090,
    address: "Block A, Connaught Place, New Delhi",
    specialty: "Cardiology, Trauma & Emergency",
    phone: "+91-11-23456789",
    availableBeds: 45,
    emergencyServices: true
  },
  {
    name: "City Care Trauma & Emergency Center",
    latitude: 28.6250,
    longitude: 77.2180,
    address: "Sector 4, RK Puram, New Delhi",
    specialty: "Critical Care, Orthopedics",
    phone: "+91-11-23456790",
    availableBeds: 28,
    emergencyServices: true
  },
  {
    name: "Metro Health Super Specialty Clinic",
    latitude: 28.6010,
    longitude: 77.1950,
    address: "Green Park Extension, New Delhi",
    specialty: "Neurology, Pediatrics",
    phone: "+91-11-23456791",
    availableBeds: 18,
    emergencyServices: true
  },
  {
    name: "Apex Blood Bank & Urgent Care",
    latitude: 28.6320,
    longitude: 77.2250,
    address: "Barakhamba Road, New Delhi",
    specialty: "Blood Bank, General Medicine",
    phone: "+91-11-23456792",
    availableBeds: 12,
    emergencyServices: true
  }
];

const DEFAULT_FLEET = [
  {
    hospitalName: "Arogya Central Multi-Specialty Hospital",
    hospitalAddress: "Block A, Connaught Place, New Delhi",
    hospitalCoordinates: { lat: 28.6139, lng: 77.2090 },
    vehicleNumber: "DL-01-AMB-101",
    driverName: "Rajesh Kumar",
    driverPhone: "+91-9876543210",
    equipmentLevel: "ALS",
    status: "available",
    speed: 0,
    currentCoordinates: { lat: 28.6139, lng: 77.2090 }
  },
  {
    hospitalName: "City Care Trauma & Emergency Center",
    hospitalAddress: "Sector 4, RK Puram, New Delhi",
    hospitalCoordinates: { lat: 28.6250, lng: 77.2180 },
    vehicleNumber: "DL-02-AMB-202",
    driverName: "Vikram Singh",
    driverPhone: "+91-9876543211",
    equipmentLevel: "ICU Ambulance",
    status: "available",
    speed: 0,
    currentCoordinates: { lat: 28.6250, lng: 77.2180 }
  },
  {
    hospitalName: "Metro Health Super Specialty Clinic",
    hospitalAddress: "Green Park Extension, New Delhi",
    hospitalCoordinates: { lat: 28.6010, lng: 77.1950 },
    vehicleNumber: "DL-03-AMB-303",
    driverName: "Amit Sharma",
    driverPhone: "+91-9876543212",
    equipmentLevel: "BLS",
    status: "available",
    speed: 0,
    currentCoordinates: { lat: 28.6010, lng: 77.1950 }
  }
];

/**
 * Bootstraps and pre-populates location map GIS markers when server starts
 */
const initializeMapData = async () => {
  try {
    let hospitals = await Hospital.find();
    if (!hospitals || hospitals.length === 0) {
      hospitals = await Hospital.insertMany(DEFAULT_HOSPITALS);
      console.log(`[Map GIS] Seeded ${hospitals.length} default hospital locations.`);
    }

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
 * @desc Get all hospital locations stored in MongoDB
 */
router.get("/hospitals", async (req, res) => {
  try {
    let hospitals = await Hospital.find();
    if (!hospitals || hospitals.length === 0) {
      hospitals = await Hospital.insertMany(DEFAULT_HOSPITALS);
    }
    res.json({ success: true, count: hospitals.length, data: hospitals });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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
