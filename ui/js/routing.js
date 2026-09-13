/**
 * 🛣️ OpenRouteService / OSRM Driving Route Engine for ArogyaPlus
 * Computes driving route, distance, travel ETA, and alternative routes.
 */

window.ArogyaRouting = (function () {
  let activePolyline = null;
  let activeAlternativePolylines = [];

  async function calculateRoute(startLat, startLng, endLat, endLng) {
    try {
      // Retrieve API key from public config (cached)
      const configResp = await fetch('/api/public-config');
      const configData = await configResp.json();
      const apiKey = configData.openRouteServiceApiKey?.trim() || '';
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) {
        headers['Authorization'] = apiKey;
      }
      const response = await fetch('/api/map/route', {
        method: 'POST',
        headers,
        body: JSON.stringify({ startLat, startLng, endLat, endLng })
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to calculate driving route');
      }

      return data;
    } catch (err) {
      console.warn('Routing API fallback to straight-line estimation:', err.message);
      // Straight-line fallback distance calculation
      const distKm = calculateStraightLineKm(startLat, startLng, endLat, endLng);
      const etaMin = Math.max(2, Math.round((distKm / 35) * 60));

      return {
        success: true,
        distanceKm: parseFloat(distKm.toFixed(2)),
        etaMinutes: etaMin,
        geometry: {
          type: 'LineString',
          coordinates: [[startLng, startLat], [endLng, endLat]]
        },
        alternatives: []
      };
    }
  }

  function calculateStraightLineKm(lat1, lon1, lat2, lon2) {
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

  function renderRouteOnMap(map, routeData, options = {}) {
    if (!map || !routeData || !routeData.geometry) return;

    clearRoute(map);

    const strokeColor = options.color || '#2563eb';
    const coordinates = routeData.geometry.coordinates.map(coord => [coord[1], coord[0]]); // Swap to [lat, lng]

    // Render Primary Driving Route
    activePolyline = L.polyline(coordinates, {
      color: strokeColor,
      weight: 5,
      opacity: 0.8,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    // Render Alternative Routes if available
    if (routeData.alternatives && routeData.alternatives.length > 0) {
      routeData.alternatives.forEach(alt => {
        if (alt.geometry && alt.geometry.coordinates) {
          const altCoords = alt.geometry.coordinates.map(c => [c[1], c[0]]);
          const altLine = L.polyline(altCoords, {
            color: '#94a3b8', // slate gray for alternative routes
            weight: 4,
            dashArray: '6, 8',
            opacity: 0.6
          }).addTo(map);
          activeAlternativePolylines.push(altLine);
        }
      });
    }

    // Fit map bounds to encompass route
    map.fitBounds(activePolyline.getBounds().pad(0.15));
  }

  function clearRoute(map) {
    if (activePolyline && map) {
      map.removeLayer(activePolyline);
      activePolyline = null;
    }
    if (activeAlternativePolylines.length > 0 && map) {
      activeAlternativePolylines.forEach(line => map.removeLayer(line));
      activeAlternativePolylines = [];
    }
  }

  return {
    calculateRoute,
    renderRouteOnMap,
    clearRoute
  };
})();
