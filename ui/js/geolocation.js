/**
 * 🌐 Browser Geolocation & Nominatim Geocoding Module for ArogyaPlus
 * Detects patient current location, tracks location changes, and reverse-geocodes addresses.
 */

window.ArogyaGeo = (function () {
  const DEFAULT_LOCATION = {
    latitude: 28.6139,
    longitude: 77.2090,
    address: 'Connaught Place, New Delhi, India'
  };

  async function getCurrentLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.warn('Geolocation not supported by browser. Falling back to default Delhi location.');
        return resolve({ ...DEFAULT_LOCATION, isFallback: true });
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          // Attempt reverse geocoding via Nominatim backend endpoint
          const address = await reverseGeocode(lat, lng);

          resolve({
            latitude: lat,
            longitude: lng,
            address: address,
            accuracy: position.coords.accuracy,
            isFallback: false
          });
        },
        (error) => {
          console.warn('Geolocation access denied or failed:', error.message);
          resolve({ ...DEFAULT_LOCATION, isFallback: true, error: error.message });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    });
  }

  function watchUserPosition(onLocationUpdate) {
    if (!navigator.geolocation) return null;

    return navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const address = await reverseGeocode(lat, lng);

        onLocationUpdate({
          latitude: lat,
          longitude: lng,
          address: address,
          speed: pos.coords.speed || 0,
          heading: pos.coords.heading || 0
        });
      },
      (err) => console.warn('Watch position error:', err.message),
      { enableHighAccuracy: true }
    );
  }

  async function geocodeAddress(query) {
    try {
      const response = await fetch('/api/map/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      const data = await response.json();
      return data.success ? data.data : [];
    } catch (err) {
      console.error('Geocode search failed:', err);
      return [];
    }
  }

  async function reverseGeocode(lat, lng) {
    try {
      const response = await fetch('/api/map/reverse-geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lng })
      });
      const data = await response.json();
      return data.success ? data.displayName : `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
    } catch (err) {
      return `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
    }
  }

  return {
    getCurrentLocation,
    watchUserPosition,
    geocodeAddress,
    reverseGeocode
  };
})();
