const API_KEY = process.env.OVERTURE_API_KEY || 'DEMO-API-KEY';
const BASE = 'https://api.overturemapsapi.com';

// ---------- helpers ----------
function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Extract array of raw features regardless of wrapper shape
function extractArray(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  for (const k of ['features', 'places', 'results', 'data', 'items']) {
    if (Array.isArray(data[k])) return data[k];
  }
  return [];
}

// Categories: docs show { primary, alternate } but be permissive
function extractCategory(props) {
  if (props.categories) {
    if (typeof props.categories === 'string') return props.categories;
    if (props.categories.primary) return props.categories.primary;
    if (Array.isArray(props.categories) && props.categories[0]) return props.categories[0];
  }
  return props.basic_category
      || (props.taxonomy && props.taxonomy.primary)
      || props.category
      || 'unknown';
}

// Names: primary name lives under properties.names.primary
function extractName(props, raw) {
  if (props.names && props.names.primary) return props.names.primary;
  if (props.ext_name && props.ext_name.primary) return props.ext_name.primary;
  if (props.name) return props.name;
  if (raw.name) return raw.name;
  return 'Unnamed Place';
}

// Coordinates: detect [lat,lng] vs [lng,lat] using the search center
function parseCoordinates(geom, raw, fallbackLat, fallbackLng) {
  const coords = geom && Array.isArray(geom.coordinates) ? geom.coordinates : null;

  if (coords && coords.length >= 2) {
    const a = toNum(coords[0]);
    const b = toNum(coords[1]);
    if (a != null && b != null) {
      // If we have a search center, choose the order that lands closer to it
      if (fallbackLat != null && fallbackLng != null) {
        const d1 = Math.abs(a - fallbackLat) + Math.abs(b - fallbackLng); // [lat, lng]
        const d2 = Math.abs(b - fallbackLat) + Math.abs(a - fallbackLng); // [lng, lat]
        return d1 <= d2 ? { lat: a, lng: b } : { lat: b, lng: a };
      }
      // No center → trust standard GeoJSON [lng, lat]
      if (Math.abs(a) > 90) return { lat: b, lng: a };
      if (Math.abs(b) > 90) return { lat: a, lng: b };
      return { lat: b, lng: a };
    }
  }

  // Flat fields as fallback
  const lat = toNum(raw.lat ?? raw.latitude ?? raw.properties?.lat ?? fallbackLat);
  const lng = toNum(raw.lng ?? raw.lon ?? raw.longitude ?? raw.properties?.lng ?? fallbackLng);
  return { lat, lng };
}

// Normalize one raw feature
function normalizePlace(raw, fallbackLat, fallbackLng) {
  const props = raw.properties || {};
  const { lat, lng } = parseCoordinates(raw.geometry || {}, raw, fallbackLat, fallbackLng);

  return {
    id: String(raw.id || props.id || `${lat}_${lng}`),
    name: extractName(props, raw),
    lat, lng,
    category: String(extractCategory(props)).toLowerCase(),
    taxonomy: props.taxonomy || null,
    address: (props.addresses && props.addresses[0] && props.addresses[0].freeform) || props.address || '',
    description: props.description || '',
    websites: props.websites || [],
    phones: props.phones || [],
    socials: props.socials || [],
    brand: props.ext_brand || (props.brand && props.brand.names ? { label: props.brand.names.primary } : null) || null,
    operatingStatus: props.operating_status || null,
    points_value: 5 + Math.floor(Math.random() * 15)
  };
}

// ---------- public API ----------

async function fetchPage({ lat, lng, radius = 2000, limit = 50, page = 0,
                          category = '', taxonomy = '',
                          operatingStatus = '', hasContact = '',
                          enrichBrand = false, debug = false }) {
  const params = new URLSearchParams({
    lat: String(lat), lng: String(lng),
    radius: String(radius), limit: String(limit), page: String(page)
  });
  if (category)        params.append('categories', category);
  if (taxonomy)        params.append('taxonomy', taxonomy);
  if (operatingStatus) params.append('operating_status', operatingStatus);
  if (hasContact)      params.append('has_contact', hasContact);
  if (enrichBrand)     params.append('enrichment_fields', 'brand');

  const url = `${BASE}/places?${params.toString()}`;
  const res = await fetch(url, { headers: { 'x-api-key': API_KEY } });
  if (!res.ok) throw new Error(`Overture ${res.status}: ${res.statusText}`);

  const data = await res.json();
  if (debug) {
    return {
      url,
      status: res.status,
      headers: Object.fromEntries(res.headers),
      isArray: Array.isArray(data),
      topLevelKeys: data && typeof data === 'object' && !Array.isArray(data) ? Object.keys(data) : null,
      sample: Array.isArray(data) ? data[0] : data,
      rawPreview: JSON.stringify(data, null, 2).substring(0, 4000)
    };
  }

  const arr = extractArray(data);
  const totalHeader = res.headers.get('Pagination-Count');
  const total = totalHeader ? parseInt(totalHeader, 10) : (arr.length || 0);

  const places = arr
    .map(r => normalizePlace(r, lat, lng))
    .filter(p => p.lat != null && p.lng != null);

  return {
    places,
    total,
    page,
    limit,
    hasMore: places.length > 0 && page * limit + places.length < total
  };
}

async function fetchAllPages(opts, maxPages = 10) {
  const all = [];
  let page = 0, total = Infinity, lastLen = -1;
  while (page < maxPages) {
    const r = await fetchPage({ ...opts, page });
    all.push(...r.places);
    total = r.total;
    if (!r.hasMore || r.places.length === 0 || r.places.length === lastLen) break;
    lastLen = r.places.length;
    page++;
  }
  return { places: all, total, pages: page + 1 };
}

async function getPlaceById(id) {
  try {
    const res = await fetch(`${BASE}/places/${id}`, { headers: { 'x-api-key': API_KEY } });
    if (!res.ok) return null;
    return normalizePlace(await res.json());
  } catch { return null; }
}

// NEW: pull the real category list from the API
async function fetchCategories(country) {
  const url = `${BASE}/places/categories?country=${country || 'US'}`;
  const res = await fetch(url, { headers: { 'x-api-key': API_KEY } });
  if (!res.ok) throw new Error(`Overture categories ${res.status}`);
  const data = await res.json();
  // Response: [{ primary: "beauty_salon", counts: { places, brands } }]
  return (Array.isArray(data) ? data : [])
    .map(x => x.primary)
    .filter(Boolean);
}

module.exports = { fetchPage, fetchAllPages, getPlaceById, fetchCategories };