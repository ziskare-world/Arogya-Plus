import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession, formatDateTime } from "../js/api-client.js";

window.toast = toast;
injectSidebar("ambulance-booking.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Ambulance Booking");

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 };
const ACTIVE_BOOKING_STATUSES = ["requested", "dispatched", "arrived"];
const LIVE_REFRESH_INTERVAL_MS = 5000;

const mapEl = document.getElementById("ambulance-map");
const mapStatusEl = document.getElementById("map-status");
const lastLiveUpdateEl = document.getElementById("last-live-update");
const routeSummaryEl = document.getElementById("route-summary");
const ambulanceDistanceEl = document.getElementById("ambulance-distance");
const refreshIntervalInfoEl = document.getElementById("refresh-interval-info");
const mapKeyHelpEl = document.getElementById("google-map-key-help");
const activeBookingPanelEl = document.getElementById("active-booking-panel");
const historyBodyEl = document.getElementById("ambulance-history-body");

const formEl = document.getElementById("ambulance-booking-form");
const problemDescriptionInputEl = document.getElementById("problem-description-input");
const pickupInputEl = document.getElementById("pickup-location-input");
const hospitalInputEl = document.getElementById("hospital-location-input");
const pickupCoordsLabelEl = document.getElementById("pickup-coords-label");
const hospitalCoordsLabelEl = document.getElementById("hospital-coords-label");
const bookBtnEl = document.getElementById("book-ambulance-btn");

const pickupModeBtnEl = document.getElementById("mode-pickup-btn");
const hospitalModeBtnEl = document.getElementById("mode-hospital-btn");
const useCurrentBtnEl = document.getElementById("use-current-btn");

let map = null;
let geocoder = null;
let placesService = null;
let pickupMarker = null;
let hospitalMarker = null;
let ambulanceMarker = null;
let directionsService = null;
let directionsRenderer = null;
let routeRenderToken = 0;
let googleMapsLoaderPromise = null;
let isGoogleMapReady = false;
let cachedPublicGoogleMapsApiKey;
let googleMapsAuthFailed = false;
let nearestHospitalLookupToken = 0;
let selectionMode = "pickup";
let pickupCoords = null;
let hospitalCoords = null;
let bookings = [];
let activeBooking = null;
let liveRefreshTimer = null;
let liveRefreshInFlight = false;
let lastRenderedRouteSignature = "";

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const statusBadge = (status = "") => {
  const normalized = String(status).toLowerCase();
  if (normalized === "completed") return '<span class="badge badge-green">Completed</span>';
  if (normalized === "cancelled") return '<span class="badge badge-red">Cancelled</span>';
  if (normalized === "arrived") return '<span class="badge badge-blue">Arrived</span>';
  if (normalized === "dispatched") return '<span class="badge badge-cyan">Dispatched</span>';
  return '<span class="badge badge-yellow">Requested</span>';
};

const formatCoordinates = (coords) => {
  if (!coords) return "-";
  return `${Number(coords.lat).toFixed(6)}, ${Number(coords.lng).toFixed(6)}`;
};

const formatDistance = (meters) => {
  const value = Number(meters);
  if (!Number.isFinite(value) || value < 0) return "-";
  if (value >= 1000) return `${(value / 1000).toFixed(1)} km`;
  return `${Math.round(value)} m`;
};

const formatDuration = (seconds) => {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) return "-";
  if (value < 60) return `${Math.round(value)} sec`;
  const mins = Math.round(value / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hrs}h ${rem}m` : `${hrs}h`;
};

const normalizeCoords = (coords) => {
  if (!coords || typeof coords !== "object") return null;
  const lat = Number(coords.lat);
  const lng = Number(coords.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

const parseCoordinatesFromText = (text) => {
  const value = String(text || "").trim();
  const match = value.match(
    /(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/
  );
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
};

const getCurrentCoordinates = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported on this browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        }),
      () => reject(new Error("Unable to fetch current location")),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  });

const computeDistanceMeters = (from, to) => {
  const earthRadius = 6371000;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const fromLatRad = (from.lat * Math.PI) / 180;
  const toLatRad = (to.lat * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(fromLatRad) *
      Math.cos(toLatRad) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

const placeLabel = (place) =>
  [place?.name, place?.vicinity || place?.formatted_address].filter(Boolean).join(", ");

const normalizeApiKey = (key) => String(key || "").trim();

const fetchPublicGoogleMapsApiKey = async () => {
  if (cachedPublicGoogleMapsApiKey !== undefined) return cachedPublicGoogleMapsApiKey;

  try {
    const response = await fetch("/api/public-config", {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin"
    });
    if (!response.ok) {
      cachedPublicGoogleMapsApiKey = "";
      return "";
    }

    const data = await response.json();
    const key = normalizeApiKey(data?.googleMapsApiKey);
    cachedPublicGoogleMapsApiKey = key;
    return key;
  } catch {
    cachedPublicGoogleMapsApiKey = "";
    return "";
  }
};

const getGoogleMapsApiKey = async () => {
  const runtimeKey = normalizeApiKey(window.GOOGLE_MAPS_API_KEY);
  if (runtimeKey) return runtimeKey;

  const publicKey = await fetchPublicGoogleMapsApiKey();
  if (publicKey) return publicKey;

  const temporaryKey = normalizeApiKey(localStorage.getItem("google_maps_api_key"));
  return temporaryKey;
};

const setMapStatus = (label, badgeClass = "badge-blue") => {
  if (!mapStatusEl) return;
  mapStatusEl.className = `badge ${badgeClass}`;
  mapStatusEl.textContent = label;
};

const updateModeButtons = () => {
  selectionMode = "pickup";
  pickupModeBtnEl?.classList.add("active");
  hospitalModeBtnEl?.classList.remove("active");
};

const setCoordsLabels = () => {
  if (pickupCoordsLabelEl) {
    pickupCoordsLabelEl.textContent = pickupCoords
      ? `Coordinates: ${formatCoordinates(pickupCoords)}`
      : "Coordinates: -";
  }
  if (hospitalCoordsLabelEl) {
    hospitalCoordsLabelEl.textContent = hospitalCoords
      ? `Coordinates: ${formatCoordinates(hospitalCoords)}`
      : "Coordinates: -";
  }
};

const clearLiveRefreshTimer = () => {
  if (!liveRefreshTimer) return;
  clearInterval(liveRefreshTimer);
  liveRefreshTimer = null;
};

const setLastLiveUpdate = (timestamp) => {
  if (!lastLiveUpdateEl) return;
  const parsed = timestamp ? new Date(timestamp) : new Date();
  const validTime = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  lastLiveUpdateEl.textContent = `Last live update: ${validTime.toLocaleTimeString()}`;
};

const setRouteSummary = ({ distanceMeters, durationSeconds } = {}) => {
  if (!routeSummaryEl) return;
  const distanceText = formatDistance(distanceMeters);
  if (distanceText === "-") {
    routeSummaryEl.textContent = "Shortest route: -";
    return;
  }
  const durationText = formatDuration(durationSeconds);
  routeSummaryEl.textContent = `Shortest road route: ${distanceText}${
    durationText !== "-" ? ` | ${durationText}` : ""
  }`;
};

const setAmbulanceDistanceText = (text) => {
  if (!ambulanceDistanceEl) return;
  ambulanceDistanceEl.textContent = text;
};

const routeSignature = (source, destination) =>
  `${Number(source?.lat || 0).toFixed(5)},${Number(source?.lng || 0).toFixed(5)}->${Number(
    destination?.lat || 0
  ).toFixed(5)},${Number(destination?.lng || 0).toFixed(5)}`;

const setMarker = (type, coords, title) => {
  if (!map || !coords || !window.google?.maps) return null;
  const position = new window.google.maps.LatLng(coords.lat, coords.lng);

  if (type === "pickup") {
    if (!pickupMarker) {
      pickupMarker = new window.google.maps.Marker({
        map,
        position,
        title: title || "Pickup",
        label: "P"
      });
    } else {
      pickupMarker.setPosition(position);
      pickupMarker.setTitle(title || "Pickup");
    }
    return pickupMarker;
  }

  if (type === "hospital") {
    if (!hospitalMarker) {
      hospitalMarker = new window.google.maps.Marker({
        map,
        position,
        title: title || "Hospital",
        label: "H"
      });
    } else {
      hospitalMarker.setPosition(position);
      hospitalMarker.setTitle(title || "Hospital");
    }
    return hospitalMarker;
  }

  if (!ambulanceMarker) {
    ambulanceMarker = new window.google.maps.Marker({
      map,
      position,
      title: title || "Ambulance",
      label: "A"
    });
  } else {
    ambulanceMarker.setPosition(position);
    ambulanceMarker.setTitle(title || "Ambulance");
  }
  return ambulanceMarker;
};

const clearRoadRoute = () => {
  routeRenderToken += 1;
  lastRenderedRouteSignature = "";
  if (!directionsRenderer) return;
  directionsRenderer.setMap(null);
  directionsRenderer = null;
  setRouteSummary();
};

const ensureDirectionsTools = () => {
  if (!map || !window.google?.maps) return false;

  if (!directionsService) {
    directionsService = new window.google.maps.DirectionsService();
  }

  if (!directionsRenderer) {
    directionsRenderer = new window.google.maps.DirectionsRenderer({
      map,
      suppressMarkers: true,
      preserveViewport: true,
      polylineOptions: {
        strokeColor: "#2563eb",
        strokeOpacity: 0.9,
        strokeWeight: 5
      }
    });
  } else if (!directionsRenderer.getMap()) {
    directionsRenderer.setMap(map);
  }

  return true;
};

const routeDistanceMeters = (route = {}) =>
  (route.legs || []).reduce((sum, leg) => sum + Number(leg?.distance?.value || 0), 0);
const routeDurationSeconds = (route = {}) =>
  (route.legs || []).reduce((sum, leg) => sum + Number(leg?.duration?.value || 0), 0);

const renderDrivingRoute = async (sourceCoords, destinationCoords) => {
  const source = normalizeCoords(sourceCoords);
  const destination = normalizeCoords(destinationCoords);
  if (!source || !destination || !isGoogleMapReady || !map || !window.google?.maps) {
    clearRoadRoute();
    return null;
  }
  if (!ensureDirectionsTools()) {
    clearRoadRoute();
    return null;
  }

  const signature = routeSignature(source, destination);
  if (signature === lastRenderedRouteSignature && directionsRenderer?.getMap()) {
    return { reused: true };
  }

  const requestToken = ++routeRenderToken;
  const origin = new window.google.maps.LatLng(source.lat, source.lng);
  const destinationPoint = new window.google.maps.LatLng(destination.lat, destination.lng);

  return new Promise((resolve) => {
    directionsService.route(
      {
        origin,
        destination: destinationPoint,
        travelMode: window.google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: true
      },
      (result, status) => {
        if (requestToken !== routeRenderToken) {
          resolve(null);
          return;
        }

        if (status !== "OK" || !result?.routes?.length) {
          clearRoadRoute();
          resolve(null);
          return;
        }

        let shortestRouteIndex = 0;
        let shortestDistance = Number.POSITIVE_INFINITY;
        result.routes.forEach((route, index) => {
          const distanceMeters = routeDistanceMeters(route);
          if (distanceMeters < shortestDistance) {
            shortestDistance = distanceMeters;
            shortestRouteIndex = index;
          }
        });

        ensureDirectionsTools();
        directionsRenderer.setDirections(result);
        if (typeof directionsRenderer.setRouteIndex === "function") {
          directionsRenderer.setRouteIndex(shortestRouteIndex);
        } else {
          directionsRenderer.setOptions({ routeIndex: shortestRouteIndex });
        }
        const selectedRoute = result.routes[shortestRouteIndex];
        const metrics = {
          distanceMeters: routeDistanceMeters(selectedRoute),
          durationSeconds: routeDurationSeconds(selectedRoute)
        };
        lastRenderedRouteSignature = signature;
        setRouteSummary(metrics);
        resolve(metrics);
      }
    );
  });
};

const fitMapToPoints = (points) => {
  if (!map || !window.google?.maps || !points.length) return;
  const bounds = new window.google.maps.LatLngBounds();
  points.forEach((point) => bounds.extend(new window.google.maps.LatLng(point.lat, point.lng)));
  map.fitBounds(bounds, 70);
};

const reverseGeocode = async (coords) => {
  if (!geocoder || !window.google?.maps) return formatCoordinates(coords);
  return new Promise((resolve) => {
    geocoder.geocode(
      { location: new window.google.maps.LatLng(coords.lat, coords.lng) },
      (results, status) => {
        if (status === "OK" && results?.[0]?.formatted_address) {
          resolve(results[0].formatted_address);
          return;
        }
        resolve(formatCoordinates(coords));
      }
    );
  });
};

const findNearestHospital = async (originCoords) => {
  if (!map || !window.google?.maps?.places) return null;
  if (!placesService) {
    placesService = new window.google.maps.places.PlacesService(map);
  }

  const location = new window.google.maps.LatLng(originCoords.lat, originCoords.lng);
  return new Promise((resolve) => {
    placesService.nearbySearch(
      {
        location,
        radius: 15000,
        type: ["hospital"]
      },
      (results, status) => {
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !results?.length) {
          resolve(null);
          return;
        }

        const nearest = results
          .map((place) => {
            const lat = place?.geometry?.location?.lat?.();
            const lng = place?.geometry?.location?.lng?.();
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
            const coords = { lat, lng };
            return {
              coords,
              label: placeLabel(place),
              distance: computeDistanceMeters(originCoords, coords)
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.distance - b.distance)[0];

        resolve(nearest || null);
      }
    );
  });
};

const autoSelectNearestHospital = async (originCoords, { silent = false } = {}) => {
  const normalized = normalizeCoords(originCoords);
  if (!normalized || !isGoogleMapReady) return false;

  const token = ++nearestHospitalLookupToken;
  if (!silent) setMapStatus("Finding Hospital", "badge-cyan");

  const nearest = await findNearestHospital(normalized);
  if (token !== nearestHospitalLookupToken) return false;

  if (!nearest) {
    if (!silent) toast("No nearby hospital found for this pickup location", "error");
    setMapStatus("Ready", "badge-green");
    return false;
  }

  await applySelection("hospital", nearest.coords, nearest.label || "");
  if (!silent) toast("Nearest hospital selected automatically", "success");
  setMapStatus("Ready", "badge-green");
  return true;
};

const applySelection = async (type, coords, label = "") => {
  const normalized = normalizeCoords(coords);
  if (!normalized) return;

  const address = label || (await reverseGeocode(normalized));
  if (type === "pickup") {
    pickupCoords = normalized;
    if (pickupInputEl && !pickupInputEl.value) pickupInputEl.value = address;
    if (pickupInputEl && label) pickupInputEl.value = label;
    setMarker("pickup", normalized, "Pickup Location");
  } else {
    hospitalCoords = normalized;
    if (hospitalInputEl && !hospitalInputEl.value) hospitalInputEl.value = address;
    if (hospitalInputEl && label) hospitalInputEl.value = label;
    setMarker("hospital", normalized, "Hospital Location");
  }

  setCoordsLabels();
  await renderRouteForCurrentContext();
  const points = [pickupCoords, hospitalCoords].filter(Boolean);
  if (points.length > 1) {
    fitMapToPoints(points);
  } else if (map) {
    map.setCenter(normalized);
    map.setZoom(15);
  }
};

const setupAutocomplete = () => {
  if (!window.google?.maps?.places) return;

  const pickupAutocomplete = new window.google.maps.places.Autocomplete(pickupInputEl, {
    fields: ["formatted_address", "geometry"]
  });
  pickupAutocomplete.addListener("place_changed", async () => {
    const place = pickupAutocomplete.getPlace();
    if (!place?.geometry?.location) return;
    const coords = {
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng()
    };
    await applySelection("pickup", coords, place.formatted_address || pickupInputEl.value);
  });
};

const loadGoogleMapsApi = async () => {
  if (window.google?.maps) return true;
  if (googleMapsLoaderPromise) return googleMapsLoaderPromise;

  const key = await getGoogleMapsApiKey();
  if (!key) return false;

  googleMapsAuthFailed = false;
  window.gm_authFailure = () => {
    googleMapsAuthFailed = true;
    setMapStatus("Map Auth Failed", "badge-red");
    if (mapEl) {
      mapEl.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-500);padding:20px;text-align:center">Google Maps rejected this API key. Enable billing, Maps JavaScript API, and correct HTTP referrer.</div>';
    }
    showGoogleMapKeyHelp(
      "Google Maps authorization failed. Update your key and allowed referrer."
    );
  };

  const settleLoad = (resolve, reject) => {
    window.setTimeout(() => {
      if (googleMapsAuthFailed) {
        reject(new Error("Google Maps authorization failed"));
        return;
      }
      if (window.google?.maps) {
        resolve(true);
        return;
      }
      reject(new Error("Google Maps failed to load"));
    }, 300);
  };

  googleMapsLoaderPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById("google-maps-script");
    if (existingScript) {
      if (window.google?.maps) {
        resolve(true);
        return;
      }
      existingScript.addEventListener(
        "load",
        () => settleLoad(resolve, reject),
        { once: true }
      );
      existingScript.addEventListener("error", () => reject(new Error("Google Maps failed to load")), {
        once: true
      });
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      key
    )}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => settleLoad(resolve, reject);
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });

  return googleMapsLoaderPromise;
};

const showGoogleMapKeyHelp = (reason = "") => {
  if (!mapKeyHelpEl) return;
  const referrer = `${window.location.origin}/*`;
  const reasonHtml = reason
    ? `<div style="color:#dc2626;margin-bottom:6px">${escapeHtml(reason)}</div>`
    : "";
  mapKeyHelpEl.innerHTML = `
    ${reasonHtml}
    <div>Set <code>GOOGLE_MAPS_API_KEY</code> in <code>.env</code> (fallback: <code>.env.example</code>) and restart the server.</div>
    <div style="margin-top:4px">Google Cloud setup required: enable <strong>Maps JavaScript API</strong>, attach billing, and allow referrer <code>${escapeHtml(
      referrer
    )}</code>.</div>
    <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-ghost btn-sm" type="button" id="set-gmap-key-btn">Set Temporary Key</button>
      <button class="btn btn-outline btn-sm" type="button" id="clear-gmap-key-btn">Clear Temporary Key</button>
    </div>
  `;
  const setBtn = document.getElementById("set-gmap-key-btn");
  const clearBtn = document.getElementById("clear-gmap-key-btn");
  if (setBtn) {
    setBtn.addEventListener("click", () => {
      const key = window.prompt("Enter Google Maps JavaScript API key");
      if (!key) return;
      localStorage.setItem("google_maps_api_key", key.trim());
      window.location.reload();
    });
  }

  if (!clearBtn) return;
  clearBtn.addEventListener("click", () => {
    localStorage.removeItem("google_maps_api_key");
    window.location.reload();
  });
};

const initializeMap = async () => {
  try {
    const loaded = await loadGoogleMapsApi();
    if (!loaded || !window.google?.maps) {
      setMapStatus("Key Required", "badge-yellow");
      if (mapEl) {
        mapEl.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-500);padding:20px;text-align:center">Google Map is unavailable until API key is configured.</div>';
      }
      showGoogleMapKeyHelp("Google Maps API key is missing.");
      return;
    }
  } catch (error) {
    setMapStatus("Map Error", "badge-red");
    if (mapEl) {
      mapEl.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-500);padding:20px;text-align:center">Unable to load Google Map.</div>';
    }
    showGoogleMapKeyHelp(error.message || "Google Maps failed to initialize.");
    toast(error.message, "error");
    return;
  }

  map = new window.google.maps.Map(mapEl, {
    center: DEFAULT_CENTER,
    zoom: 5,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false
  });
  geocoder = new window.google.maps.Geocoder();
  map.addListener("click", async (event) => {
    const coords = event.latLng?.toJSON?.();
    if (!coords) return;
    await applySelection(selectionMode, coords);
  });

  setupAutocomplete();
  isGoogleMapReady = true;
  setMapStatus("Ready", "badge-green");
};

const parseBookingCoords = (booking, key) => {
  const raw = normalizeCoords(booking?.[key]);
  if (raw) return raw;

  const text = key === "pickupCoordinates" ? booking?.pickupLocation : booking?.hospitalLocation;
  return parseCoordinatesFromText(text);
};

const setActiveBooking = (booking) => {
  activeBooking = booking || null;
};

const renderActiveBookingPanel = () => {
  if (!activeBookingPanelEl) return;
  if (!activeBooking) {
    activeBookingPanelEl.innerHTML = '<div class="muted">No active ambulance booking.</div>';
    return;
  }

  activeBookingPanelEl.innerHTML = `
    <div class="tracking-row"><span class="muted">Booking ID</span><strong>${escapeHtml(
      `AMB-${String(activeBooking._id || "").slice(-6).toUpperCase()}`
    )}</strong></div>
    <div class="tracking-row"><span class="muted">Problem</span><span>${escapeHtml(
      activeBooking.problemDescription || "Emergency request"
    )}</span></div>
    <div class="tracking-row"><span class="muted">Hospital</span><span>${escapeHtml(
      activeBooking.hospitalLocation || "-"
    )}</span></div>
    <div class="tracking-row"><span class="muted">Assigned Doctor</span><span>${escapeHtml(
      activeBooking.assignedDoctor?.name || activeBooking.assignedDoctorName || "Awaiting doctor assignment"
    )}</span></div>
    <div class="tracking-row"><span class="muted">Ambulance</span><span>${escapeHtml(
      activeBooking.assignedAmbulance?.vehicleNumber ||
        activeBooking.assignedAmbulanceVehicleNumber ||
        activeBooking.vehicleNumber ||
        "Awaiting ambulance assignment"
    )}</span></div>
    <div class="tracking-row"><span class="muted">Status</span>${statusBadge(activeBooking.status)}</div>
    <div class="tracking-row"><span class="muted">Driver</span><span>${escapeHtml(
      activeBooking.driverName || "Awaiting assignment"
    )}</span></div>
    <div class="tracking-row"><span class="muted">Vehicle</span><span>${escapeHtml(
      activeBooking.vehicleNumber || "-"
    )}</span></div>
    <div class="tracking-row"><span class="muted">ETA</span><span>${escapeHtml(
      activeBooking.etaMinutes != null ? `${activeBooking.etaMinutes} min` : "Updating"
    )}</span></div>
    <div class="tracking-row"><span class="muted">Requested</span><span>${escapeHtml(
      formatDateTime(activeBooking.createdAt)
    )}</span></div>
  `;
};

const renderHistory = () => {
  if (!historyBodyEl) return;

  if (!bookings.length) {
    historyBodyEl.innerHTML = `
      <tr>
        <td colspan="8" class="muted" style="text-align:center">No ambulance bookings found.</td>
      </tr>`;
    return;
  }

  historyBodyEl.innerHTML = bookings
    .map((booking) => {
      const id = `AMB-${String(booking._id || "").slice(-6).toUpperCase()}`;
      return `
        <tr>
          <td><code style="color:var(--blue)">${escapeHtml(id)}</code></td>
          <td>${escapeHtml(booking.pickupLocation || "-")}</td>
          <td>${escapeHtml(booking.hospitalLocation || "-")}</td>
          <td>${escapeHtml(
            booking.assignedDoctor?.name || booking.assignedDoctorName || "Awaiting assignment"
          )}</td>
          <td>${escapeHtml(
            booking.assignedAmbulance?.vehicleNumber ||
              booking.assignedAmbulanceVehicleNumber ||
              booking.vehicleNumber ||
              "-"
          )}</td>
          <td>${statusBadge(booking.status)}</td>
          <td>${escapeHtml(
            booking.etaMinutes != null ? `${booking.etaMinutes} min` : "-"
          )}</td>
          <td>${escapeHtml(formatDateTime(booking.createdAt))}</td>
        </tr>`;
    })
    .join("");
};

const resolveActiveBookingRoute = (booking) => {
  if (!booking) return null;
  const status = String(booking.status || "requested").toLowerCase();
  const pickup = parseBookingCoords(booking, "pickupCoordinates");
  const hospital = parseBookingCoords(booking, "hospitalCoordinates");
  const ambulance = normalizeCoords(booking.ambulanceCoordinates);
  if (!pickup || !hospital) return null;

  if (status === "arrived") {
    return { source: ambulance || pickup, destination: hospital };
  }

  if (status === "requested" || status === "dispatched") {
    return { source: ambulance || hospital, destination: pickup };
  }

  return { source: pickup, destination: hospital };
};

const resolveRouteForCurrentContext = () => {
  const activeRoute = resolveActiveBookingRoute(activeBooking);
  if (activeRoute) return activeRoute;
  if (pickupCoords && hospitalCoords) {
    return { source: pickupCoords, destination: hospitalCoords };
  }
  return null;
};

const renderRouteForCurrentContext = async () => {
  const route = resolveRouteForCurrentContext();
  if (!route) {
    clearRoadRoute();
    return false;
  }
  const rendered = await renderDrivingRoute(route.source, route.destination);
  return Boolean(rendered);
};

const updateAmbulanceDistanceInfo = (booking) => {
  if (!booking) {
    setAmbulanceDistanceText("Ambulance distance: -");
    return;
  }

  const route = resolveActiveBookingRoute(booking);
  const target = normalizeCoords(route?.destination);
  const ambulance = normalizeCoords(booking.ambulanceCoordinates);
  const status = String(booking.status || "requested").toLowerCase();
  const destinationLabel = status === "arrived" ? "hospital" : "pickup";

  if (!target) {
    setAmbulanceDistanceText("Ambulance distance: -");
    return;
  }

  if (!ambulance) {
    setAmbulanceDistanceText(`Ambulance to ${destinationLabel}: waiting for live location`);
    return;
  }

  const directMeters = computeDistanceMeters(ambulance, target);
  setAmbulanceDistanceText(
    `Ambulance to ${destinationLabel}: ${formatDistance(directMeters)} (approx)`
  );
};

const renderMapForActiveBooking = async () => {
  if (!isGoogleMapReady || !map) return;

  const booking = activeBooking;
  if (!booking) {
    if (ambulanceMarker) ambulanceMarker.setMap(null);
    ambulanceMarker = null;
    clearRoadRoute();
    setMapStatus("Ready", "badge-green");
    updateAmbulanceDistanceInfo(null);
    setLastLiveUpdate();
    return;
  }

  const pickup = parseBookingCoords(booking, "pickupCoordinates");
  const hospital = parseBookingCoords(booking, "hospitalCoordinates");
  const ambulance = normalizeCoords(booking.ambulanceCoordinates);

  pickupCoords = pickup;
  hospitalCoords = hospital;
  if (pickup && pickupInputEl) pickupInputEl.value = booking.pickupLocation || formatCoordinates(pickup);
  if (hospital && hospitalInputEl) hospitalInputEl.value = booking.hospitalLocation || formatCoordinates(hospital);
  setCoordsLabels();

  if (pickup) setMarker("pickup", pickup, "Pickup Location");
  if (hospital) setMarker("hospital", hospital, "Hospital Location");
  const routeRendered = await renderRouteForCurrentContext();
  if (!routeRendered) {
    setMapStatus("Route Pending", "badge-yellow");
  } else {
    setMapStatus("Live", "badge-green");
  }

  if (ambulance) {
    setMarker("ambulance", ambulance, "Ambulance Live Location");
  } else if (pickup) {
    setMarker("ambulance", pickup, "Ambulance Live Location");
  }
  updateAmbulanceDistanceInfo(booking);

  const points = [pickup, hospital, ambulance].filter(Boolean);
  fitMapToPoints(points);
  setLastLiveUpdate(booking.lastLocationUpdatedAt || booking.updatedAt || booking.createdAt);
};

const startLiveRefresh = () => {
  clearLiveRefreshTimer();
  liveRefreshTimer = setInterval(async () => {
    if (liveRefreshInFlight) return;
    if (document.hidden) return;

    liveRefreshInFlight = true;
    try {
      await loadBookings({ silent: true });
    } catch {
      // Ignore transient poll errors; manual refresh and next interval can recover.
    } finally {
      liveRefreshInFlight = false;
    }
  }, LIVE_REFRESH_INTERVAL_MS);
};

const loadBookings = async ({ silent = false } = {}) => {
  const data = await apiRequest("/api/ambulance/my");
  bookings = data.bookings || [];
  if (!silent) renderHistory();

  const active = bookings.find((booking) =>
    ACTIVE_BOOKING_STATUSES.includes(String(booking.status || "").toLowerCase())
  );
  setActiveBooking(active || null);
  renderActiveBookingPanel();
  await renderMapForActiveBooking();
};

const onBookSubmit = async (event) => {
  event.preventDefault();

  const problemDescription = String(problemDescriptionInputEl?.value || "").trim();
  const pickupLocation = String(pickupInputEl?.value || "").trim();
  if (!pickupCoords) {
    pickupCoords = parseCoordinatesFromText(pickupLocation);
  }

  if (!problemDescription) {
    toast("Please enter emergency problem/symptoms", "error");
    return;
  }

  if (!pickupLocation) {
    toast("Pickup location is required", "error");
    return;
  }

  if (!pickupCoords) {
    toast("Please select pickup location on the map", "error");
    return;
  }

  try {
    if (bookBtnEl) {
      bookBtnEl.disabled = true;
      bookBtnEl.textContent = "Booking...";
    }

    await apiRequest("/api/ambulance/book", {
      method: "POST",
      body: JSON.stringify({
        pickupLocation,
        problemDescription,
        pickupCoordinates: pickupCoords
      })
    });

    toast("Ambulance booking created. Hospital and doctor assigned.", "success");
    await loadBookings();
    if (problemDescriptionInputEl) {
      problemDescriptionInputEl.value = "";
    }
  } catch (error) {
    toast(error.message, "error");
  } finally {
    if (bookBtnEl) {
      bookBtnEl.disabled = false;
      bookBtnEl.textContent = "Book Ambulance";
    }
  }
};

const useCurrentLocationForPickup = () => {
  setPickupFromCurrentLocation({ force: true }).catch(() => {});
};

const setPickupFromCurrentLocation = async ({ force = false, silent = false } = {}) => {
  const hasPickup =
    Boolean(pickupCoords) || Boolean(String(pickupInputEl?.value || "").trim());
  if (hasPickup && !force) return false;

  try {
    const coords = await getCurrentCoordinates();
    await applySelection("pickup", coords);
    if (!silent) toast("Pickup location updated from current position", "success");
    return true;
  } catch (error) {
    if (!silent) toast(error.message || "Unable to fetch current location", "error");
    return false;
  }
};

const initManualInputHelpers = () => {
  pickupInputEl?.addEventListener("change", async () => {
    const coords = parseCoordinatesFromText(pickupInputEl.value);
    if (!coords) return;
    await applySelection("pickup", coords, pickupInputEl.value.trim());
  });
};

window.refreshAmbulanceBookings = async function refreshAmbulanceBookings() {
  try {
    await loadBookings();
    toast("Ambulance bookings refreshed", "success");
  } catch (error) {
    toast(error.message, "error");
  }
};

const init = async () => {
  const session = ensureSession({
    allowedRoles: ["patient"],
    onDenied: () => toast("Please login as user", "error")
  });
  if (!session.allowed) return;

  if (hospitalInputEl) {
    hospitalInputEl.readOnly = true;
    hospitalInputEl.placeholder = "Assigned automatically after booking";
  }
  if (hospitalModeBtnEl) {
    hospitalModeBtnEl.style.display = "none";
  }

  updateModeButtons();
  setCoordsLabels();
  if (refreshIntervalInfoEl) {
    refreshIntervalInfoEl.textContent = `Live refresh every ${Math.round(
      LIVE_REFRESH_INTERVAL_MS / 1000
    )} seconds`;
  }
  setRouteSummary();
  setAmbulanceDistanceText("Ambulance distance: -");

  pickupModeBtnEl?.addEventListener("click", () => {
    selectionMode = "pickup";
    updateModeButtons();
  });
  useCurrentBtnEl?.addEventListener("click", useCurrentLocationForPickup);
  formEl?.addEventListener("submit", onBookSubmit);

  initManualInputHelpers();
  await initializeMap();

  try {
    await loadBookings();
    if (!activeBooking) {
      await setPickupFromCurrentLocation({ silent: true });
    }
  } catch (error) {
    toast(error.message, "error");
    renderHistory();
    renderActiveBookingPanel();
    await setPickupFromCurrentLocation({ silent: true });
  }

  startLiveRefresh();
  window.addEventListener("beforeunload", clearLiveRefreshTimer, { once: true });
};

init();
