/**
 * 🏥 Hospital & Healthcare Facility Discovery Module for ArogyaPlus
 * Integrates MongoDB hospital records and Overpass API (Hospitals, Clinics, Pharmacies, Blood Banks).
 */

window.ArogyaHospital = (function () {
  async function getHospitals() {
    try {
      const response = await fetch('/api/map/hospitals');
      const data = await response.json();
      return data.success ? data.data : [];
    } catch (err) {
      console.error('Failed to fetch hospital list:', err);
    alert('Failed to fetch hospital list');
    return [];
    }
  }

  async function getNearbyFacilities(lat, lng, radius = 5000, type = 'hospital') {
    try {
      const url = `/api/map/nearby?lat=${lat}&lng=${lng}&radius=${radius}&type=${type}`;
      const response = await fetch(url);
      const data = await response.json();
      return data.success ? data.data : [];
    } catch (err) {
      console.error('Failed to fetch nearby facilities via Overpass:', err);
      return [];
    }
  }

  function findNearestHospital(patientLat, patientLng, hospitalList = []) {
    if (!hospitalList || hospitalList.length === 0) return null;

    let nearest = null;
    let minDistance = Infinity;

    hospitalList.forEach(h => {
      const hLat = h.latitude || h.lat;
      const hLng = h.longitude || h.lng;
      if (hLat && hLng) {
        const dist = calculateHaversineDistance(patientLat, patientLng, hLat, hLng);
        if (dist < minDistance) {
          minDistance = dist;
          nearest = { ...h, distanceKm: parseFloat(dist.toFixed(2)) };
        }
      }
    });

    return nearest;
  }

  function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
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

  return {
    getHospitals,
    getNearbyFacilities,
    findNearestHospital,
    calculateHaversineDistance
  };
})();
