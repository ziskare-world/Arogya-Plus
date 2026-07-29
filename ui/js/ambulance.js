/**
 * 🚑 Live Ambulance Tracking Module for ArogyaPlus
 * Listens to Socket.IO real-time location events and smoothly animates ambulance map markers.
 */

window.ArogyaAmbulance = (function () {
  let ambulanceMarkers = new Map();

  async function getAmbulanceFleet() {
    try {
      const response = await fetch('/api/map/ambulances');
      const data = await response.json();
      return data.success ? data.data : [];
    } catch (err) {
      console.error('Failed to fetch ambulance fleet:', err);
      return [];
    }
  }

  function initLiveTracking(map, socket, onAmbulanceMovedCallback) {
    if (!map || !socket) return;

    // Listen for live location broadcasts from ambulance drivers
    socket.on('ambulance:location_changed', (data) => {
      const { vehicleNumber, ambulanceId, latitude, longitude, speed, status } = data;
      const key = vehicleNumber || ambulanceId || data.id;

      if (!key || !latitude || !longitude) return;

      // Update existing marker smoothly or create new one
      if (ambulanceMarkers.has(key)) {
        const marker = ambulanceMarkers.get(key);
        // Smooth position transition without reloading map
        marker.setLatLng([latitude, longitude]);

        // Update popup content dynamically
        marker.setPopupContent(`
          <div style="font-family: inherit; padding: 4px;">
            <h4 style="margin: 0 0 4px; color: #0f172a; font-size: 14px; font-weight: 700;">🚑 Ambulance ${key}</h4>
            <p style="margin: 2px 0; font-size: 12px; color: #475569;"><strong>Status:</strong> <span style="color: ${status === 'dispatched' ? '#f59e0b' : '#059669'}; font-weight: 600;">${status.toUpperCase()}</span></p>
            <p style="margin: 2px 0; font-size: 12px; color: #475569;"><strong>Speed:</strong> ${speed || 0} km/h</p>
            <p style="margin: 2px 0; font-size: 11px; color: #94a3b8;">Live GPS Active</p>
          </div>
        `);
      } else {
        const newMarker = window.ArogyaMap.addMarker(
          map,
          latitude,
          longitude,
          'ambulance',
          `
          <div style="font-family: inherit; padding: 4px;">
            <h4 style="margin: 0 0 4px; color: #0f172a; font-size: 14px; font-weight: 700;">🚑 Ambulance ${key}</h4>
            <p style="margin: 2px 0; font-size: 12px; color: #475569;"><strong>Status:</strong> <span style="color: ${status === 'dispatched' ? '#f59e0b' : '#059669'}; font-weight: 600;">${(status || 'available').toUpperCase()}</span></p>
            <p style="margin: 2px 0; font-size: 12px; color: #475569;"><strong>Speed:</strong> ${speed || 0} km/h</p>
          </div>
          `,
          { status: status || 'available' }
        );

        if (newMarker) {
          ambulanceMarkers.set(key, newMarker);
        }
      }

      if (typeof onAmbulanceMovedCallback === 'function') {
        onAmbulanceMovedCallback(data);
      }
    });
  }

  function emitLocationUpdate(socket, vehicleNumber, latitude, longitude, speed = 0, status = 'dispatched') {
    if (!socket) return;
    socket.emit('ambulance:location_update', {
      vehicleNumber,
      latitude,
      longitude,
      speed,
      status,
      timestamp: new Date()
    });
  }

  function clearAmbulanceMarkers(map) {
    if (!map) return;
    ambulanceMarkers.forEach(marker => map.removeLayer(marker));
    ambulanceMarkers.clear();
  }

  return {
    getAmbulanceFleet,
    initLiveTracking,
    emitLocationUpdate,
    clearAmbulanceMarkers,
    ambulanceMarkers
  };
})();
