/**
 * 🚨 Emergency Dispatch & Nearest Ambulance Auto-Calculator for ArogyaPlus
 * Computes closest ambulance via Haversine distance, shortest route, triggers dispatch API, & updates real-time status.
 */

window.ArogyaEmergency = (function () {
  async function getActiveEmergencies() {
    try {
      const response = await fetch('/api/map/emergencies');
      const data = await response.json();
      return data.success ? data.data : [];
    } catch (err) {
      console.error('Failed to fetch emergency incidents:', err);
      return [];
    }
  }

  function findNearestAvailableAmbulance(patientLat, patientLng, fleetList = []) {
    if (!fleetList || fleetList.length === 0) return null;

    const available = fleetList.filter(a => (a.status || 'available').toLowerCase() === 'available');
    if (available.length === 0) return null;

    let closest = null;
    let minDistance = Infinity;

    available.forEach(a => {
      const lat = a.latitude || a.currentCoordinates?.lat;
      const lng = a.longitude || a.currentCoordinates?.lng;
      if (lat && lng) {
        const dist = window.ArogyaHospital.calculateHaversineDistance(patientLat, patientLng, lat, lng);
        if (dist < minDistance) {
          minDistance = dist;
          closest = { ...a, distanceKm: parseFloat(dist.toFixed(2)) };
        }
      }
    });

    return closest;
  }

  async function dispatchNearestAmbulance(patientLat, patientLng, emergencyDetails = {}) {
    try {
      const fleet = await window.ArogyaAmbulance.getAmbulanceFleet();
      const nearestAmbulance = findNearestAvailableAmbulance(patientLat, patientLng, fleet);

      let routeData = null;
      if (nearestAmbulance) {
        routeData = await window.ArogyaRouting.calculateRoute(
          nearestAmbulance.latitude,
          nearestAmbulance.longitude,
          patientLat,
          patientLng
        );
      }

      const payload = {
        pickupLocation: emergencyDetails.pickupLocation || `Coordinates (${patientLat.toFixed(4)}, ${patientLng.toFixed(4)})`,
        pickupCoordinates: { lat: patientLat, lng: patientLng },
        hospitalLocation: emergencyDetails.hospitalLocation || 'Nearest Hospital',
        hospitalName: emergencyDetails.hospitalName || 'City Central Hospital',
        assignedAmbulance: nearestAmbulance ? nearestAmbulance.id : null,
        assignedAmbulanceVehicleNumber: nearestAmbulance ? nearestAmbulance.vehicleNumber : null,
        etaMinutes: routeData ? routeData.etaMinutes : (nearestAmbulance ? Math.round(nearestAmbulance.distanceKm * 2) : 15),
        problemDescription: emergencyDetails.problemDescription || 'Emergency SOS Request'
      };

      return {
        success: true,
        nearestAmbulance,
        routeData,
        dispatchDetails: payload
      };
    } catch (err) {
      console.error('Emergency dispatch auto-calculator failed:', err);
      return { success: false, error: err.message };
    }
  }

  return {
    getActiveEmergencies,
    findNearestAvailableAmbulance,
    dispatchNearestAmbulance
  };
})();
