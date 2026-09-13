/**
 * 🗺️ Reusable OpenStreetMap / Leaflet Component for ArogyaPlus
 * Supports custom markers for Patients, Hospitals, Ambulances, Doctors, and Emergency SOS.
 */

window.ArogyaMap = (function () {
  // SVG Custom Icons for Leaflet
  function createCustomIcon(type, status = 'available') {
    let color = '#2563eb'; // default blue
    let iconSvg = '';

    if (type === 'patient') {
      color = '#10b981'; // emerald green
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
    } else if (type === 'hospital') {
      color = '#0284c7'; // sky blue
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M12 6v12m-6-6h12"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
    } else if (type === 'ambulance') {
      color = status === 'dispatched' ? '#f59e0b' : '#059669'; // amber if dispatched, green if available
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1 .4-1 1v9c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M9 11h4M11 9v4"/></svg>`;
    } else if (type === 'doctor') {
      color = '#7c3aed'; // violet
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="8"/><line x1="20.5" y1="5.5" x2="20.5" y2="10.5"/></svg>`;
    } else if (type === 'emergency') {
      color = '#dc2626'; // crimson red
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    }

    const html = `<div style="background-color: ${color}; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 2px solid white; cursor: pointer; transition: transform 0.2s ease;">
      ${iconSvg}
    </div>`;

    return L.divIcon({
      html: html,
      className: 'custom-map-marker',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18]
    });
  }

  function initMap(containerId, options = {}) {
    const lat = options.lat || 28.6139;
    const lng = options.lng || 77.2090;
    const zoom = options.zoom || 13;

    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`Map container #${containerId} not found.`);
      return null;
    }

    // Ensure Leaflet instance resets cleanly if re-initialized
    if (container._leaflet_id) {
      container._leaflet_id = null;
      container.innerHTML = '';
    }

    const map = L.map(containerId, {
      zoomControl: true,
      attributionControl: true
    }).setView([lat, lng], zoom);

    // High-performance, unblocked CartoDB Voyager tiles (powered by OpenStreetMap data)
    // Avoids OSM volunteer-server strict rate-limiting / 403 blocked tile policy
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a> | ArogyaPlus Clinical GIS'
    }).addTo(map);

    setTimeout(() => {
      try { map.invalidateSize(); } catch (e) {}
    }, 250);

    return map;
  }

  function addMarker(map, lat, lng, type = 'patient', popupHtml = '', options = {}) {
    if (!map || !lat || !lng) return null;

    const icon = createCustomIcon(type, options.status);
    const marker = L.marker([lat, lng], { icon, draggable: !!options.draggable }).addTo(map);

    if (popupHtml) {
      marker.bindPopup(popupHtml, { maxWidth: 300 });
    }

    return marker;
  }

  function fitBounds(map, markers = []) {
    if (!map || markers.length === 0) return;
    const group = L.featureGroup(markers);
    map.fitBounds(group.getBounds().pad(0.2));
  }

  return {
    initMap,
    addMarker,
    fitBounds,
    createCustomIcon
  };
})();
