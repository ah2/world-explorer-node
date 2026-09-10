/* =============================================================================
   World Explorer — map.js (v3)
   Streaming place loader + player character + category chips + distance.
   ============================================================================= */

// ---------- Category → emoji + color ----------
const CAT = {
  restaurant:  ['🍽️', '#e53e3e'], cafe:        ['☕', '#d69e2e'], bakery:     ['🥐', '#d69e2e'],
  bar:         ['🍺', '#dd6b20'], brewery:     ['🍻', '#dd6b20'], fast_food:  ['🍔', '#e53e3e'],
  ice_cream:   ['🍦', '#ed64a6'], park:        ['🌳', '#48bb78'], museum:     ['🏛️', '#805ad5'],
  art_gallery: ['🎨', '#805ad5'], landmark:    ['🗿', '#718096'], viewpoint:  ['🔭', '#718096'],
  zoo:         ['🦁', '#38a169'], aquarium:    ['🐟', '#38a169'], shop:       ['🛍️', '#4299e1'],
  supermarket: ['🛒', '#4299e1'], pharmacy:    ['💊', '#38b2ac'], bank:       ['🏦', '#38b2ac'],
  hotel:       ['🏨', '#ed64a6'], cinema:      ['🎬', '#667eea'], theatre:    ['🎭', '#667eea'],
  library:     ['📚', '#667eea'], school:      ['🎓', '#3182ce'], hospital:   ['🏥', '#e53e3e'],
  default:     ['📍', '#718096']
};
const catOf = c => CAT[(c || '').toLowerCase()] || CAT.default;

function makeMarkerIcon(category, collected) {
  const [emoji, color] = catOf(category);
  return L.divIcon({
    className: 'custom-marker',
    html: `<div class="pin" style="background:${color};opacity:${collected ? 0.4 : 1}">
             <span>${collected ? '✓' : emoji}</span>
           </div>`,
    iconSize: [36, 36], iconAnchor: [18, 36], popupAnchor: [0, -36]
  });
}

// ---------- Player character ----------
function makePlayerIcon(heading = 0) {
  return L.divIcon({
    className: 'player-marker',
    html: `
      <div class="player-wrap">
        <div class="player-ring"></div>
        <div class="player-face">🧑</div>
        <div class="player-arrow" style="transform:rotate(${heading}deg)">▲</div>
      </div>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24]
  });
}

// ---------- DOM ----------
const els = {
  map:         document.getElementById('map'),
  list:        document.getElementById('place-list'),
  count:       document.getElementById('place-count'),
  popup:       document.getElementById('popup'),
  popupText:   document.getElementById('popup-text'),
  catChips:    document.getElementById('category-chips'),
  cityLabel:   document.getElementById('city-label'),
  cityModal:   document.getElementById('city-modal'),
  citySearch:  document.getElementById('city-search'),
  cityResults: document.getElementById('city-results'),
  cityPopular: document.getElementById('city-popular'),
  info:        document.getElementById('map-info')
};

// ---------- State ----------
let map, markerLayer, playerMarker;

const placesById = new Map();
let currentPlaces = [];
const renderedMarkers = new Map();
let collectedIds = new Set();

let currentCategory = '';
let isLoadingPlaces = false;
let lastFetch = { lat: 0, lng: 0 };
let lastFetchCategory = null;
let lastFetchTime = 0;

let categoryPoints = { default: 10 };

const player = { lat: 40.7128, lng: -74.0060, heading: 0 };

// Tunables
const SPEED_M_PER_SEC    = 35;
const COLLECT_RADIUS_M   = 30;
const FETCH_RADIUS_M     = 2500;
const FETCH_TRIGGER_M    = 700;
const FETCH_MIN_INTERVAL = 1000;
const KEEP_RADIUS_M      = 5000;

// ---------- Geometry ----------
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const dφ = (lat2 - lat1) * Math.PI / 180;
  const dλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(m) {
  if (m < 10)   return m.toFixed(1) + ' m';
  if (m < 1000) return Math.round(m) + ' m';
  if (m < 10000) return (m / 1000).toFixed(1) + ' km';
  return Math.round(m / 1000) + ' km';
}

function pointsFor(category) {
  return categoryPoints[(category || '').toLowerCase()]
      ?? categoryPoints.default
      ?? 10;
}

// ---------- Map init ----------
function initMap(center) {
  if (map) {
    map.setView([center.lat, center.lng], map.getZoom());
    return;
  }
  map = L.map(els.map, { zoomControl: true, keyboard: false })
         .setView([center.lat, center.lng], 16);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap', maxZoom: 19
  }).addTo(map);

  markerLayer = L.layerGroup().addTo(map);

  playerMarker = L.marker([center.lat, center.lng], {
    icon: makePlayerIcon(0),
    zIndexOffset: 1000
  }).addTo(map);
}

function updatePlayerMarker() {
  if (!playerMarker) return;
  playerMarker.setLatLng([player.lat, player.lng]);
  playerMarker.setIcon(makePlayerIcon(player.heading));

  const c = map.getCenter();
  if (Math.abs(c.lat - player.lat) > 0.0005 || Math.abs(c.lng - player.lng) > 0.0005) {
    map.panTo([player.lat, player.lng], { animate: true, duration: 0.25 });
  }
}

// ---------- Streaming loader ----------
function shouldFetch() {
  if (isLoadingPlaces) return false;
  if (Date.now() - lastFetchTime < FETCH_MIN_INTERVAL) return false;
  if (currentCategory !== lastFetchCategory) return true;
  if (lastFetch.lat === 0 && lastFetch.lng === 0) return true;
  return distanceMeters(player.lat, player.lng, lastFetch.lat, lastFetch.lng) > FETCH_TRIGGER_M;
}

async function fetchMorePlaces() {
  if (isLoadingPlaces) return;
  isLoadingPlaces = true;
  lastFetchTime = Date.now();

  const center = { lat: player.lat, lng: player.lng };
  const category = currentCategory;
  if (els.info) els.info.textContent = '🔍 Loading…';

  try {
    const data = await API.places({ lat: center.lat, lng: center.lng, radius: FETCH_RADIUS_M, category });
    for (const p of (data.places || [])) placesById.set(p.id, p);

    for (const [id, p] of placesById) {
      if (distanceMeters(player.lat, player.lng, p.lat, p.lng) > KEEP_RADIUS_M) placesById.delete(id);
    }

    lastFetch = center;
    lastFetchCategory = category;

    rebuildSnapshot();
    syncMarkers();
    renderSidebar();
    renderChips();

    if (els.info) els.info.textContent = `📍 ${currentPlaces.length} places`;
  } catch (err) {
    console.error('fetchMorePlaces:', err);
    if (els.info) els.info.textContent = '⚠️ ' + err.message;
  } finally {
    isLoadingPlaces = false;
  }
}

function rebuildSnapshot() {
  const cat = currentCategory;
  currentPlaces = Array.from(placesById.values())
    .filter(p => !cat || p.category === cat)
    .sort((a, b) => {
      const da = distanceMeters(player.lat, player.lng, a.lat, a.lng);
      const db = distanceMeters(player.lat, player.lng, b.lat, b.lng);
      return da - db;
    });
}

function onCategoryChange(newCategory) {
  currentCategory = newCategory;
  placesById.clear();
  for (const m of renderedMarkers.values()) markerLayer.removeLayer(m);
  renderedMarkers.clear();
  currentPlaces = [];
  lastFetch = { lat: 0, lng: 0 };
  lastFetchCategory = null;
  renderSidebar();
  renderChips();
  fetchMorePlaces();
}

// ---------- Markers ----------
function popupContentFor(p) {
  const collected = collectedIds.has(p.id);
  const dist = distanceMeters(player.lat, player.lng, p.lat, p.lng);
  const pts = pointsFor(p.category);
  return `<div class="place-popup">
    <strong>${esc(p.name)}</strong>
    <div class="muted">${esc(p.category)}</div>
    ${p.brand ? `<div class="muted">🏷️ ${esc(p.brand.label)}</div>` : ''}
    <div class="dist">📏 ${formatDistance(dist)} away</div>
    <div class="pts">⭐ ${pts} pts</div>
    ${collected ? '<div class="ok">✅ Collected</div>'
                : '<div class="hint">Walk into it to collect</div>'}
  </div>`;
}

function syncMarkers() {
  if (!markerLayer) return;
  const wanted = new Set(currentPlaces.map(p => p.id));

  for (const [id, m] of renderedMarkers) {
    if (!wanted.has(id)) { markerLayer.removeLayer(m); renderedMarkers.delete(id); }
  }

  for (const p of currentPlaces) {
    const collected = collectedIds.has(p.id);
    let m = renderedMarkers.get(p.id);
    if (!m) {
      m = L.marker([p.lat, p.lng], { icon: makeMarkerIcon(p.category, collected) });
      m.bindPopup(popupContentFor(p));
      m._collected = collected;
      m._place = p;
      m.on('popupopen', () => m.setPopupContent(popupContentFor(m._place)));
      markerLayer.addLayer(m);
      renderedMarkers.set(p.id, m);
    } else if (collected !== m._collected) {
      m.setIcon(makeMarkerIcon(p.category, collected));
      m.setPopupContent(popupContentFor(p));
      m._collected = collected;
    }
  }
}

// ---------- Category chips ----------
function renderChips() {
  if (!els.catChips) return;
  const counts = {};
  for (const p of placesById.values()) {
    const c = p.category || 'unknown';
    counts[c] = (counts[c] || 0) + 1;
  }
  const total = placesById.size;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  const allActive = currentCategory === '';
  let html = `<button class="chip ${allActive ? 'active' : ''}" data-cat="">
                <span>All</span><span class="chip-count">${total}</span>
              </button>`;

  for (const [c, n] of sorted) {
    const [emoji] = catOf(c);
    const active = currentCategory === c;
    html += `<button class="chip ${active ? 'active' : ''}" data-cat="${esc(c)}">
               <span>${emoji} ${esc(c)}</span><span class="chip-count">${n}</span>
             </button>`;
  }
  els.catChips.innerHTML = html;

  els.catChips.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => onCategoryChange(chip.dataset.cat || ''));
  });
}

// ---------- Sidebar ----------
function renderSidebar() {
  if (!els.list) return;
  if (els.count) els.count.textContent = currentPlaces.length;

  if (currentPlaces.length === 0) {
    els.list.innerHTML = '<p class="empty">No places nearby. Move to explore.</p>';
    return;
  }

  els.list.innerHTML = currentPlaces.slice(0, 60).map(p => {
    const [emoji, color] = catOf(p.category);
    const done = collectedIds.has(p.id);
    const dist = distanceMeters(player.lat, player.lng, p.lat, p.lng);
    return `
      <div class="place-card" data-id="${esc(p.id)}" style="opacity:${done ? 0.5 : 1}">
        <div class="pc-icon" style="background:${color}">${done ? '✓' : emoji}</div>
        <div class="pc-body">
          <div class="pc-name">${esc(p.name)}</div>
          <div class="pc-meta">${esc(p.category)} · ⭐ ${pointsFor(p.category)}</div>
        </div>
        <div class="pc-dist">${formatDistance(dist)}</div>
      </div>`;
  }).join('');

  els.list.querySelectorAll('.place-card').forEach(el => {
    el.addEventListener('click', () => {
      const p = placesById.get(el.dataset.id);
      if (p) map.setView([p.lat, p.lng], 17);
    });
  });
}

// ---------- Collection ----------
const collectLock = new Set();

async function tryCollect(p) {
  if (collectedIds.has(p.id) || collectLock.has(p.id)) return;
  collectLock.add(p.id);
  try {
    const r = await API.collect({
      placeId: p.id, placeName: p.name, placeCategory: p.category,
      placeLat: p.lat, placeLng: p.lng
    });
    collectedIds.add(p.id);
    const m = renderedMarkers.get(p.id);
    if (m) {
      m.setIcon(makeMarkerIcon(p.category, true));
      m.setPopupContent(popupContentFor(p));
      m._collected = true;
    }
    renderSidebar();
    showPopup(`✅ ${p.name} +${r.points} pts (${r.totalPoints} total)`);
  } catch (err) {
    if (!/Already collected/i.test(err.message)) showPopup('❌ ' + err.message, true);
    collectedIds.add(p.id);
  } finally {
    collectLock.delete(p.id);
  }
}

function checkProximity() {
  if (!currentPlaces.length) return;
  for (const p of currentPlaces) {
    if (collectedIds.has(p.id)) continue;
    if (distanceMeters(player.lat, player.lng, p.lat, p.lng) <= COLLECT_RADIUS_M) tryCollect(p);
  }
}

// ---------- Input ----------
const keys = Object.create(null);
const CAPTURED = new Set(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift']);

function isTypingInField(el) {
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
}

document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') { document.activeElement?.blur(); return; }
  if (isTypingInField(document.activeElement)) return;
  if (!CAPTURED.has(k)) return;
  keys[k] = true;
  e.preventDefault(); e.stopPropagation();
}, true);

document.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (!CAPTURED.has(k)) return;
  keys[k] = false;
  e.preventDefault(); e.stopPropagation();
}, true);

document.addEventListener('mousedown', e => {
  if (e.target.closest('.leaflet-container')) document.activeElement?.blur();
});
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// ---------- Game loop ----------
let lastFrame = performance.now();

const badge = document.createElement('div');
badge.id = 'game-badge';
badge.style.cssText = `
  position:absolute; top:12px; right:12px; z-index:500;
  background:rgba(0,0,0,.75); color:#fff;
  font:12px/1.4 monospace; padding:6px 10px; border-radius:8px;
  pointer-events:none; white-space:pre;
`;
if (els.map && els.map.parentElement) els.map.parentElement.appendChild(badge);

function tick(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;

  let dx = 0, dy = 0;
  if (keys['w'] || keys['arrowup'])    dy += 1;
  if (keys['s'] || keys['arrowdown'])  dy -= 1;
  if (keys['a'] || keys['arrowleft'])  dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;

  if (dx || dy) {
    const speed = keys['shift'] ? SPEED_M_PER_SEC * 3 : SPEED_M_PER_SEC;
    const len = Math.hypot(dx, dy);
    const mPerDegLat = 111320;
    const mPerDegLng = 111320 * Math.cos(player.lat * Math.PI / 180) || 1;

    player.lat += (dy / len) * speed * dt / mPerDegLat;
    player.lng += (dx / len) * speed * dt / mPerDegLng;

    // Heading: 0 = up/north, 90 = right/east
    player.heading = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;

    updatePlayerMarker();
    checkProximity();

    // Refresh sidebar distances ~2×/s while moving
    if (!tick._lastSidebar || now - tick._lastSidebar > 500) {
      tick._lastSidebar = now;
      rebuildSnapshot();
      renderSidebar();
    }
  }

  if (shouldFetch()) fetchMorePlaces();

  if (badge) {
    const active = Object.keys(keys).filter(k => keys[k]).join('+') || '—';
    badge.textContent =
      `pos   ${player.lat.toFixed(5)}, ${player.lng.toFixed(5)}\n` +
      `head  ${player.heading.toFixed(0)}°\n` +
      `keys  ${active}\n` +
      `cache ${placesById.size}  shown ${currentPlaces.length}\n` +
      `zoom  ${map ? map.getZoom() : '-'}`;
  }

  requestAnimationFrame(tick);
}

// ---------- Popup ----------
let popupTimer;
function showPopup(text, isError = false) {
  if (!els.popup || !els.popupText) return;
  els.popupText.textContent = text;
  els.popup.className = 'popup visible' + (isError ? ' error' : '');
  clearTimeout(popupTimer);
  popupTimer = setTimeout(() => { els.popup.className = 'popup hidden'; }, 3200);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- City picker ----------
async function openCityModal() {
  els.cityModal.classList.remove('hidden');
  if (!els.cityPopular.dataset.loaded) {
    try {
      const { cities } = await API.cities();
      els.cityPopular.innerHTML = cities.map(c =>
        `<button class="city-item" data-lat="${c.lat}" data-lng="${c.lng}" data-name="${esc(c.name)}">
          🌆 ${esc(c.name)} <span class="muted">${c.country}</span>
        </button>`).join('');
      els.cityPopular.querySelectorAll('.city-item').forEach(bindCity);
      els.cityPopular.dataset.loaded = '1';
    } catch (err) { console.error('cities', err); }
  }
}

function bindCity(btn) {
  btn.addEventListener('click', () => {
    placePlayer(parseFloat(btn.dataset.lat), parseFloat(btn.dataset.lng), btn.dataset.name);
  });
}

async function placePlayer(lat, lng, name) {
  try { await API.setCity({ city: name, lat, lng }); } catch {}
  if (els.cityLabel) els.cityLabel.textContent = '📍 ' + name;
  els.cityModal.classList.add('hidden');

  player.lat = lat; player.lng = lng;

  initMap({ lat, lng });
  updatePlayerMarker();

  placesById.clear();
  for (const m of renderedMarkers.values()) markerLayer.removeLayer(m);
  renderedMarkers.clear();
  currentPlaces = [];
  lastFetch = { lat: 0, lng: 0 };
  lastFetchCategory = null;
  renderSidebar();
  renderChips();

  fetchMorePlaces();
}

let citySearchTimer;
els.citySearch?.addEventListener('input', e => {
  clearTimeout(citySearchTimer);
  const q = e.target.value.trim();
  if (q.length < 2) { els.cityResults.innerHTML = ''; return; }
  citySearchTimer = setTimeout(async () => {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6`);
      const data = await r.json();
      els.cityResults.innerHTML = data.map(d => {
        const name = d.display_name.split(',')[0];
        return `<button class="city-item" data-lat="${d.lat}" data-lng="${d.lon}" data-name="${esc(name)}">
          📍 ${esc(name)} <span class="muted">${esc(d.display_name.split(',').slice(-1)[0])}</span>
        </button>`;
      }).join('');
      els.cityResults.querySelectorAll('.city-item').forEach(bindCity);
    } catch {}
  }, 350);
});

// ---------- Search ----------
document.getElementById('search-btn')?.addEventListener('click', () => {
  const q = document.getElementById('search-input').value.trim();
  if (q.length < 2) return;
  fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`)
    .then(r => r.json())
    .then(d => { if (d[0]) placePlayer(parseFloat(d[0].lat), parseFloat(d[0].lon), d[0].display_name.split(',')[0]); });
});

// ---------- Boot ----------
(async () => {
  try {
    const { points } = await API.get('/category-points');
    if (points) categoryPoints = points;
  } catch {}

  try {
    const c = await API.collections();
    collectedIds = new Set(c.places.map(p => p.id));
  } catch {}

  const user = window.currentUser;
  if (user && user.city_lat != null && user.city_lng != null) {
    player.lat = user.city_lat;
    player.lng = user.city_lng;
    if (els.cityLabel) els.cityLabel.textContent = '📍 ' + (user.city || 'Selected city');
    initMap({ lat: player.lat, lng: player.lng });
    updatePlayerMarker();
    fetchMorePlaces();
  } else {
    initMap({ lat: player.lat, lng: player.lng });
    updatePlayerMarker();
    openCityModal();
  }

  document.getElementById('change-city-btn')?.addEventListener('click', openCityModal);

  requestAnimationFrame(tick);
})();