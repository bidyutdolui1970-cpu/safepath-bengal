/* SafePath Bengal: local demo by default; configure SAFEPATH_CONFIG.apiBaseUrl for an API. */
const WEST_BENGAL_CENTER = [22.9868, 87.855];
const STORAGE_KEY = "safepath-bengal-reports-v2";
const API_BASE_VALUE = String(window.SAFEPATH_CONFIG?.apiBaseUrl || new URLSearchParams(window.location.search).get("api") || "").trim();
const API_MODE = Boolean(API_BASE_VALUE);
const API_BASE = API_BASE_VALUE === "same-origin" ? "" : API_BASE_VALUE.replace(/\/+$/, "");
const MAX_IMAGE_BYTES = 120 * 1024;
const CATEGORIES = {
  flood: { label: "Flooding & waterlogging", color: "flood" },
  "road-blockage": { label: "Road blockage", color: "blockage" },
  "damaged-road": { label: "Damaged road", color: "damaged" },
  "service-disruption": { label: "Service disruption", color: "service" },
  "public-facility": { label: "Public facility", color: "facility" },
  "community-location": { label: "Community location", color: "community" }
};

let map;
let reportLayer;
let sampleReports = [];
let userReports = [];
let selectedPoint = null;
let pickingLocation = false;
let reportImage = "";
let searchMarker = null;
let lastPlaceSearchAt = 0;
let toastTimer;

const byId = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]));
const reports = () => [...sampleReports, ...userReports];
const categoryLabel = (category) => CATEGORIES[category]?.label || "Community report";
const categoryColor = (category) => CATEGORIES[category]?.color || "community";

function safeLocalReports() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.id === "string" && CATEGORIES[item.category]
      && Number.isFinite(item.lat) && Number.isFinite(item.lng) && typeof item.title === "string");
  } catch {
    return [];
  }
}

function saveLocalReports(nextReports) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextReports));
    userReports = nextReports;
    return true;
  } catch {
    showToast("Could not save this report. Browser storage may be full or disabled.");
    return false;
  }
}

function normalizeSample(feature) {
  const [lng, lat] = feature.geometry.coordinates;
  const properties = feature.properties || {};
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !CATEGORIES[properties.category]) return null;
  return {
    id: String(properties.id || "sample"), category: properties.category,
    title: String(properties.title || "Illustrative sample report"),
    locationName: String(properties.locationName || "West Bengal"),
    description: String(properties.description || "Illustrative sample data; not a verified live incident."),
    lat, lng, reportedAt: String(properties.reportedAt || new Date().toISOString()),
    status: "unverified", sample: true
  };
}

async function loadReports() {
  userReports = safeLocalReports();
  if (API_MODE) {
    byId("modeLabel").textContent = "CONNECTED API";
    try {
      const response = await fetch(`${API_BASE}/reports`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("API request failed");
      const payload = await response.json();
      userReports = Array.isArray(payload) ? payload : payload.reports || [];
    } catch {
      showToast("API unavailable. Showing local reports and sample data.");
      byId("modeLabel").textContent = "LOCAL FALLBACK";
    }
  }
  try {
    const response = await fetch("data/sample-reports.geojson", { cache: "no-store" });
    if (!response.ok) throw new Error("Sample data request failed");
    const collection = await response.json();
    sampleReports = (collection.features || []).map(normalizeSample).filter(Boolean);
  } catch {
    sampleReports = [];
    showToast("Sample data could not load. Check that the project is served over HTTP.");
  }
  render();
}

function markerIcon(category) {
  const color = categoryColor(category);
  return L.divIcon({
    className: "",
    html: `<span class="map-marker marker-${color}" aria-hidden="true"></span>`,
    iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -11]
  });
}

function popupHtml(item) {
  const reportedAt = item.reportedAt ? new Date(item.reportedAt).toLocaleString() : "Time not provided";
  const image = typeof item.imageDataUrl === "string" && item.imageDataUrl.length <= 170000
    && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(item.imageDataUrl)
    ? `<img class="popup-image" src="${escapeHtml(item.imageDataUrl)}" alt="Optional report photo">` : "";
  return `<div class="popup-content"><span class="report-category category-${categoryColor(item.category)}">${escapeHtml(categoryLabel(item.category))}</span><div class="popup-title">${escapeHtml(item.title)}</div><div class="popup-place">${escapeHtml(item.locationName)}</div><div class="popup-meta">${escapeHtml(reportedAt)} · ${item.sample ? "Illustrative sample" : "Community report"}</div><div class="popup-description">${escapeHtml(item.description)}</div>${image}<span class="status-badge status-${escapeHtml(item.status || "unverified")}">${escapeHtml(item.status || "unverified")}</span></div>`;
}

function selectedCategories() {
  return new Set([...document.querySelectorAll("[data-category-filter]:checked")].map((input) => input.dataset.categoryFilter));
}

function visibleReports() {
  const query = byId("reportSearch").value.trim().toLowerCase();
  const categories = selectedCategories();
  return reports().filter((item) => categories.has(item.category)
    && (!query || `${item.title} ${item.locationName} ${item.description}`.toLowerCase().includes(query)));
}

function makeReportRow(item) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "report-item";
  button.setAttribute("aria-label", `Show ${item.title} on map, ${item.status || "unverified"}`);
  const dot = document.createElement("i");
  dot.className = `category-dot dot-${categoryColor(item.category)}`;
  const detail = document.createElement("span");
  detail.className = "report-item-copy";
  const title = document.createElement("strong");
  title.textContent = item.title;
  const meta = document.createElement("small");
  meta.textContent = `${item.locationName} · ${item.sample ? "Sample" : (item.status || "unverified")}`;
  detail.append(title, meta);
  button.append(dot, detail);
  button.addEventListener("click", () => focusReport(item));
  return button;
}

function focusReport(item) {
  map.setView([item.lat, item.lng], 14);
  reportLayer.eachLayer((marker) => {
    const point = marker.getLatLng();
    if (Math.abs(point.lat - item.lat) < 0.00001 && Math.abs(point.lng - item.lng) < 0.00001) marker.openPopup();
  });
  byId("mapSection").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderCategoryChart(all) {
  const container = byId("categoryChart");
  container.replaceChildren();
  const counts = Object.keys(CATEGORIES).map((category) => ({
    category, label: categoryLabel(category), count: all.filter((item) => item.category === category).length
  }));
  const max = Math.max(1, ...counts.map((item) => item.count));
  counts.forEach((item) => {
    const row = document.createElement("div");
    row.className = "chart-row";
    const heading = document.createElement("div");
    heading.className = "chart-row-heading";
    const label = document.createElement("span");
    label.textContent = item.label;
    const count = document.createElement("strong");
    count.textContent = String(item.count);
    heading.append(label, count);
    const track = document.createElement("div");
    track.className = "chart-track";
    track.setAttribute("role", "img");
    track.setAttribute("aria-label", `${item.count} ${item.label} reports`);
    const bar = document.createElement("span");
    bar.className = `chart-bar bar-${categoryColor(item.category)}`;
    bar.style.width = `${item.count ? Math.max(4, item.count / max * 100) : 0}%`;
    track.append(bar);
    row.append(heading, track);
    container.append(row);
  });
}

function renderStatusChart(all) {
  const container = byId("statusChart");
  container.replaceChildren();
  const states = [
    { key: "unverified", label: "Unverified", color: "pending" },
    { key: "verified", label: "Verified", color: "verified" },
    { key: "closed", label: "Closed", color: "closed" }
  ];
  states.forEach((state) => {
    const count = all.filter((item) => (item.status || "unverified") === state.key).length;
    const row = document.createElement("div");
    row.className = "status-row";
    const dot = document.createElement("i");
    dot.className = `status-dot ${state.color}`;
    const label = document.createElement("span");
    label.textContent = state.label;
    const value = document.createElement("strong");
    value.textContent = String(count);
    row.append(dot, label, value);
    container.append(row);
  });
}

function render() {
  if (!reportLayer) return;
  const all = reports();
  const visible = visibleReports();
  reportLayer.clearLayers();
  visible.forEach((item) => {
    const marker = L.marker([item.lat, item.lng], { icon: markerIcon(item.category) })
      .bindPopup(popupHtml(item), { maxWidth: 280 });
    marker.on("popupopen", async () => {
      if (!API_MODE || !item.hasImage || item.imageDataUrl || item.imageLoading) return;
      item.imageLoading = true;
      try {
        const id = item.reportId || item.id;
        const response = await fetch(`${API_BASE}/reports/${encodeURIComponent(id)}`, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error("Photo could not be loaded.");
        const payload = await response.json();
        if (payload.report?.imageDataUrl) {
          item.imageDataUrl = payload.report.imageDataUrl;
          marker.setPopupContent(popupHtml(item));
        }
      } catch {
        showToast("The report photo could not be loaded.");
      } finally {
        item.imageLoading = false;
      }
    });
    marker.addTo(reportLayer);
  });

  byId("totalReports").textContent = String(all.length);
  byId("pendingReports").textContent = String(all.filter((item) => (item.status || "unverified") === "unverified").length);
  byId("verifiedReports").textContent = String(all.filter((item) => item.status === "verified").length);
  byId("closedReports").textContent = String(all.filter((item) => item.status === "closed").length);
  const list = byId("reportList");
  list.replaceChildren();
  const recent = visible.slice().sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt)).slice(0, 8);
  if (!recent.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No reports match these filters.";
    list.append(empty);
  } else {
    recent.forEach((item) => list.append(makeReportRow(item)));
  }
  renderCategoryChart(all);
  renderStatusChart(all);
}

function showToast(message) {
  const toast = byId("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 3200);
}

function showFormError(message) {
  const error = byId("formError");
  error.textContent = message;
  error.hidden = false;
}

function openDialog() {
  byId("formError").hidden = true;
  byId("reportDialog").showModal();
}

function closeDialog() {
  byId("reportDialog").close();
}

function setSelectedPoint(point) {
  selectedPoint = { lat: Number(point.lat.toFixed(3)), lng: Number(point.lng.toFixed(3)) };
  byId("locationStatus").textContent = `Approximate map point selected (${selectedPoint.lat}, ${selectedPoint.lng})`;
}

function isWithinWestBengal(lat, lng) {
  return lat >= 21.4 && lat <= 27.3 && lng >= 85.7 && lng <= 89.9;
}

function findDuplicate(candidate) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const normalizedTitle = candidate.title.toLowerCase().replace(/\s+/g, " ");
  return userReports.some((item) => item.category === candidate.category
    && (item.title.toLowerCase().replace(/\s+/g, " ") === normalizedTitle
      || (Math.abs(item.lat - candidate.lat) <= 0.001 && Math.abs(item.lng - candidate.lng) <= 0.001))
    && new Date(item.reportedAt).getTime() >= cutoff);
}

async function submitReport(event) {
  event.preventDefault();
  byId("formError").hidden = true;
  const title = byId("reportTitle").value.trim();
  const description = byId("reportDescription").value.trim();
  const locationName = byId("reportLocation").value.trim();
  const category = byId("reportCategory").value;
  const observedAt = new Date(byId("reportTime").value).toISOString();
  if (!selectedPoint) return showFormError("Choose a point on the map before submitting.");
  if (!CATEGORIES[category] || title.length < 5 || description.length < 10 || locationName.length < 3) {
    return showFormError("Complete each field with a valid title, category, public location, and description.");
  }
  if (!isWithinWestBengal(selectedPoint.lat, selectedPoint.lng)) {
    return showFormError("Select a point within West Bengal.");
  }
  if (!Number.isFinite(Date.parse(observedAt)) || Date.parse(observedAt) > Date.now() || Date.now() - Date.parse(observedAt) > 30 * 24 * 60 * 60 * 1000) {
    return showFormError("Choose an observation time within the past 30 days.");
  }
  const candidate = {
    id: `local-${crypto.randomUUID()}`, category, title, locationName, description,
    lat: selectedPoint.lat, lng: selectedPoint.lng, reportedAt: observedAt,
    status: "unverified", sample: false, ...(reportImage ? { imageDataUrl: reportImage } : {})
  };
  if (findDuplicate(candidate)) return showFormError("A similar report already exists from this approximate location in the past 24 hours.");

  if (API_MODE) {
    try {
      const response = await fetch(`${API_BASE}/reports`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(candidate)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "The API could not save this report.");
      userReports.unshift(result.report || candidate);
    } catch (error) {
      return showFormError(error.message || "Could not reach the reports API.");
    }
  } else if (!saveLocalReports([candidate, ...userReports])) {
    return;
  }

  byId("reportForm").reset();
  reportImage = "";
  selectedPoint = null;
  byId("locationStatus").textContent = "No map point selected";
  setDefaultReportTime();
  closeDialog();
  render();
  map.setView([candidate.lat, candidate.lng], 14);
  showToast("Report submitted as unverified. It is not an emergency alert.");
}

function setDefaultReportTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  byId("reportTime").value = now.toISOString().slice(0, 16);
  byId("reportTime").max = now.toISOString().slice(0, 16);
}

function chooseOnMap() {
  pickingLocation = true;
  closeDialog();
  byId("mapSection").scrollIntoView({ behavior: "smooth", block: "start" });
  showToast("Select an approximate public point on the map.");
}

async function searchPlace(event) {
  event.preventDefault();
  const query = byId("placeSearch").value.trim();
  if (query.length < 2) return showToast("Enter at least two characters to search.");
  if (Date.now() - lastPlaceSearchAt < 1100) return showToast("Please wait before searching again.");
  lastPlaceSearchAt = Date.now();
  const params = new URLSearchParams({
    q: query, format: "jsonv2", limit: "1", countrycodes: "in", bounded: "1",
    viewbox: "85.7,27.3,89.9,21.4"
  });
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Place search is unavailable.");
    const results = await response.json();
    if (!results.length) return showToast("No place found in the West Bengal search area.");
    const result = results[0];
    const point = [Number(result.lat), Number(result.lon)];
    if (searchMarker) map.removeLayer(searchMarker);
    map.setView(point, 13);
    searchMarker = L.marker(point, { title: result.display_name }).addTo(map)
      .bindPopup(`<strong>${escapeHtml(result.name || result.display_name)}</strong><br><small>Place result · OpenStreetMap Nominatim</small>`).openPopup();
  } catch (error) {
    showToast(error.message || "Could not search for that place.");
  }
}

function locateUser() {
  if (!navigator.geolocation) return showToast("Location permission is not available in this browser.");
  showToast("Waiting for your location permission…");
  navigator.geolocation.getCurrentPosition((position) => {
    const { latitude, longitude } = position.coords;
    if (!isWithinWestBengal(latitude, longitude)) return showToast("Your current location is outside the West Bengal map area.");
    map.setView([latitude, longitude], 13);
  }, () => showToast("Location was not shared. Check your browser permission."), { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
}

function handleImageChange(event) {
  const file = event.target.files?.[0];
  reportImage = "";
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > MAX_IMAGE_BYTES) {
    event.target.value = "";
    return showFormError("Choose a JPEG, PNG, or WebP image smaller than 120 KB.");
  }
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      let scale = Math.min(1, 1200 / Math.max(image.width, image.height));
      while (scale >= 0.25) {
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext("2d");
        if (!context) break;
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const encoded = canvas.toDataURL("image/jpeg", 0.76);
        if (Math.floor((encoded.length - encoded.indexOf(",") - 1) * 0.75) <= MAX_IMAGE_BYTES) {
          reportImage = encoded;
          return;
        }
        scale *= 0.75;
      }
      event.target.value = "";
      showFormError("This image could not be reduced below 120 KB. Choose a smaller image.");
    };
    image.onerror = () => showFormError("The selected image could not be read.");
    image.src = typeof reader.result === "string" ? reader.result : "";
  };
  reader.onerror = () => showFormError("The selected image could not be read.");
  reader.readAsDataURL(file);
}

function initMap() {
  map = L.map("map", { zoomControl: false, minZoom: 6, maxZoom: 18 }).setView(WEST_BENGAL_CENTER, 7);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
  }).addTo(map);
  L.control.zoom({ position: "bottomright" }).addTo(map);
  reportLayer = L.layerGroup().addTo(map);
  map.on("click", (event) => {
    if (!isWithinWestBengal(event.latlng.lat, event.latlng.lng)) return showToast("Choose a point within West Bengal.");
    setSelectedPoint(event.latlng);
    if (pickingLocation) {
      pickingLocation = false;
      openDialog();
      byId("reportLocation").focus();
    } else {
      showToast("Approximate public point selected for your next report.");
    }
  });
  window.setTimeout(() => map.invalidateSize(), 100);
}

function init() {
  initMap();
  setDefaultReportTime();
  byId("photoHint").textContent = API_MODE
    ? "JPEG, PNG or WebP up to 120 KB. Images are re-encoded and sent with your public report."
    : "JPEG, PNG or WebP up to 120 KB. Images are re-encoded and stored only in this browser.";
  byId("addReportTop").addEventListener("click", openDialog);
  byId("closeDialog").addEventListener("click", closeDialog);
  byId("cancelDialog").addEventListener("click", closeDialog);
  byId("pickLocationBtn").addEventListener("click", chooseOnMap);
  byId("reportForm").addEventListener("submit", submitReport);
  byId("reportImage").addEventListener("change", handleImageChange);
  byId("reportSearch").addEventListener("input", render);
  document.querySelectorAll("[data-category-filter]").forEach((input) => input.addEventListener("change", render));
  byId("placeSearchForm").addEventListener("submit", searchPlace);
  byId("locateBtn").addEventListener("click", locateUser);
  byId("legendBtn").addEventListener("click", () => {
    const card = byId("legendCard");
    card.hidden = !card.hidden;
    byId("legendBtn").setAttribute("aria-expanded", String(!card.hidden));
  });
  byId("clearReports").addEventListener("click", () => {
    if (API_MODE) return showToast("Reports on the shared API cannot be cleared from this public view.");
    if (!userReports.length) return showToast("There are no locally submitted reports to clear.");
    if (!window.confirm("Remove all reports saved by this browser? Sample data will remain.")) return;
    if (saveLocalReports([])) { render(); showToast("Your local reports were cleared."); }
  });
  loadReports();
}

document.addEventListener("DOMContentLoaded", init);
