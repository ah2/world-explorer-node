// ==================== CONFIGURATION ====================
// This should match your Nginx location and app.js BASE_PATH
const BASE_PATH = window.location.pathname.startsWith('/world-explorer') 
    ? '/world-explorer' 
    : '';

console.log(`📍 Base path: ${BASE_PATH || 'root'}`);

// ==================== GLOBAL STATE ====================
let map, userMarker, currentLat = 0, currentLng = 0;
let markers = [];
let token = null;
let userId = null;
let collectedPlaceIds = new Set();
let allLoadedPlaces = [];
let currentPage = 1;
const PAGE_SIZE = 20;

// ==================== DOM ELEMENTS ====================
const loginScreen = document.getElementById('login-screen');
const gameScreen = document.getElementById('game-screen');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const usernameDisplay = document.getElementById('username-display');
const scoreDisplay = document.getElementById('score-display');
const collectedList = document.getElementById('collected-list');

console.log('✅ DOM elements loaded');

// ==================== API HELPER ====================
async function apiRequest(endpoint, options = {}) {
    const url = `${BASE_PATH}${endpoint}`;
    console.log(`📡 API Request: ${options.method || 'GET'} ${url}`);
    
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...(options.headers || {})
        }
    });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Request failed (${response.status})`);
    }
    
    return response.json();
}

// ==================== LOGIN HANDLER ====================
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('🔐 Login form submitted');
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
        alert('Please enter username and password');
        return;
    }

    console.log(`📝 Attempting login for: ${username}`);

    try {
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Logging in...';
        submitBtn.disabled = true;

        const data = await apiRequest('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        console.log('✅ Login successful!', data);

        if (!data.token || !data.user) {
            throw new Error('Invalid response from server');
        }

        token = data.token;
        userId = data.user.id;

        loginScreen.style.display = 'none';
        gameScreen.style.display = 'flex';

        usernameDisplay.textContent = data.user.username || username;
        scoreDisplay.textContent = data.user.score || 0;

        const { lat = 40.7128, lng = -74.0060 } = data.user.position || {};
        currentLat = lat;
        currentLng = lng;

        console.log(`📍 Initial position: ${lat}, ${lng}`);

        setTimeout(() => {
            initMap(lat, lng);
        }, 200);

    } catch (error) {
        console.error('❌ Login error:', error);
        alert(`Login failed: ${error.message || 'Please try again'}`);
        
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Login';
        submitBtn.disabled = false;
    }
});

// ==================== LOGOUT HANDLER ====================
logoutBtn.addEventListener('click', () => {
    console.log('👋 Logging out');
    token = null;
    userId = null;
    collectedPlaceIds = new Set();
    
    if (map) {
        map.remove();
        map = null;
    }
    
    gameScreen.style.display = 'none';
    loginScreen.style.display = 'flex';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    
    document.removeEventListener('keydown', handleKeyPress);
});

// ==================== MAP INITIALIZATION ====================
function initMap(lat, lng) {
    console.log(`🗺️ Initializing map at ${lat}, ${lng}`);
    
    try {
        if (map) {
            map.remove();
        }

        map = L.map('map', {
            center: [lat, lng],
            zoom: 15,
            zoomControl: true
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        L.control.scale().addTo(map);

        const userIcon = L.divIcon({
            className: 'custom-marker user-marker',
            html: '🧑',
            iconSize: [35, 35],
            iconAnchor: [17, 17]
        });

        userMarker = L.marker([lat, lng], { 
            icon: userIcon,
            zIndexOffset: 1000
        }).addTo(map)
          .bindPopup('📍 You are here')
          .openPopup();

        map.on('click', (e) => {
            const { lat, lng } = e.latlng;
            movePlayer(lat, lng);
        });

        document.addEventListener('keydown', handleKeyPress);

        loadPlaces(lat, lng);
        loadCollectedPlaces();

        console.log('✅ Map initialized successfully');
        
        setTimeout(() => {
            map.invalidateSize();
        }, 500);

    } catch (error) {
        console.error('❌ Failed to initialize map:', error);
        alert('Failed to load map. Please refresh the page.');
    }
}

// ==================== LOAD PLACES ====================
async function loadPlaces(lat, lng, page = 1) {
    console.log(`📡 Loading places at ${lat}, ${lng}, page ${page}`);
    
    try {
        const data = await apiRequest(
            `/api/map/places?lat=${lat}&lng=${lng}&page=${page}&limit=${PAGE_SIZE}`
        );
        
        console.log(`✅ Loaded ${data.places?.length || 0} places`);
        
        displayPlaces(data.places || [], data.pagination || {});
        return data;
    } catch (error) {
        console.error('❌ Error loading places:', error);
        return null;
    }
}

// ==================== DISPLAY PLACES ====================
function displayPlaces(places, pagination) {
    console.log(`🎯 Displaying ${places.length} places on map`);
    
    markers.forEach(marker => {
        if (map) map.removeLayer(marker);
    });
    markers = [];

    places.forEach(place => {
        const isCollected = collectedPlaceIds.has(place.id);
        
        const markerIcon = L.divIcon({
            className: `custom-marker ${isCollected ? 'collected' : ''}`,
            html: isCollected ? '✅' : '⭐',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        const marker = L.marker([place.lat, place.lng], { 
            icon: markerIcon,
            opacity: isCollected ? 0.5 : 1
        }).addTo(map);

        const popupContent = `
            <div class="place-popup">
                <h4>${place.name}</h4>
                <p>📍 ${place.categories || place.category || 'Unknown'}</p>
                <p>⭐ ${place.points || 10} points</p>
                ${place.address ? `<p>🏠 ${place.address}</p>` : ''}
                ${!isCollected ? `
                    <button onclick="collectPlace('${place.id}', '${place.name}', ${place.lat}, ${place.lng}, ${place.points || 10})" 
                            class="collect-btn">
                        Collect!
                    </button>
                ` : '<p style="color:green;">✅ Already collected</p>'}
            </div>
        `;

        marker.bindPopup(popupContent);
        markers.push(marker);
    });

    if (pagination) {
        const pageInfo = document.getElementById('page-info');
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        
        if (pageInfo) pageInfo.textContent = `Page ${pagination.page || 1}`;
        if (prevBtn) prevBtn.disabled = !pagination.hasPrevious;
        if (nextBtn) nextBtn.disabled = !pagination.hasNext;
    }
}

// ==================== COLLECT PLACE ====================
async function collectPlace(id, name, lat, lng, points) {
    console.log(`🎯 Collecting place: ${name}`);
    
    if (collectedPlaceIds.has(id)) {
        alert('You already collected this place!');
        return;
    }

    try {
        const data = await apiRequest('/api/map/collect', {
            method: 'POST',
            body: JSON.stringify({ name, lat, lng, points: points || 10 })
        });
        
        collectedPlaceIds.add(id);
        alert(`🎉 Collected ${name}! +${data.points || points || 10} points!`);
        scoreDisplay.textContent = data.totalScore || parseInt(scoreDisplay.textContent) + (points || 10);
        
        loadPlaces(currentLat, currentLng);
        loadCollectedPlaces();
    } catch (error) {
        console.error('❌ Error collecting place:', error);
        alert('Failed to collect place: ' + error.message);
    }
}

// ==================== LOAD COLLECTED PLACES ====================
async function loadCollectedPlaces() {
    console.log('📡 Loading collected places');
    
    try {
        const data = await apiRequest('/api/map/locations');
        console.log(`✅ Loaded ${data.locations?.length || 0} collected places`);
        
        collectedPlaceIds = new Set(data.locations.map(loc => loc.id));
        
        if (collectedList) {
            collectedList.innerHTML = data.locations.map(loc => 
                `<li>${loc.name} <span class="points">+${loc.points}pts</span></li>`
            ).join('') || '<li style="color: #888;">No places collected yet</li>';
        }

        if (data.stats) {
            const totalCollected = document.getElementById('total-collected');
            if (totalCollected) {
                totalCollected.textContent = data.stats.count || 0;
            }
        }
    } catch (error) {
        console.error('❌ Error loading collected places:', error);
    }
}

// ==================== MOVE PLAYER ====================
async function movePlayer(lat, lng) {
    console.log(`🚶 Moving to ${lat}, ${lng}`);
    
    currentLat = lat;
    currentLng = lng;
    
    if (userMarker) {
        userMarker.setLatLng([lat, lng]);
    }
    if (map) {
        map.setView([lat, lng], 15);
    }

    try {
        await apiRequest('/api/map/position', {
            method: 'POST',
            body: JSON.stringify({ lat, lng })
        });
    } catch (error) {
        console.error('Failed to update position:', error);
    }

    currentPage = 1;
    await loadPlaces(lat, lng, currentPage);
}

// ==================== KEYBOARD CONTROLS ====================
function handleKeyPress(e) {
    const step = 0.001;

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
    }

    switch(e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
            movePlayer(currentLat + step, currentLng);
            break;
        case 's':
        case 'arrowdown':
            movePlayer(currentLat - step, currentLng);
            break;
        case 'a':
        case 'arrowleft':
            movePlayer(currentLat, currentLng - step);
            break;
        case 'd':
        case 'arrowright':
            movePlayer(currentLat, currentLng + step);
            break;
    }
}

// ==================== PAGINATION CONTROLS ====================
async function loadNextPage() {
    currentPage++;
    await loadPlaces(currentLat, currentLng, currentPage);
}

async function loadPreviousPage() {
    if (currentPage > 1) {
        currentPage--;
        await loadPlaces(currentLat, currentLng, currentPage);
    }
}

// ==================== LOAD ALL PLACES ====================
async function loadAllPlaces(lat, lng) {
    console.log(`📡 Loading all places near ${lat}, ${lng}`);
    
    try {
        showLoadingIndicator('Discovering places in this area...');
        
        const data = await apiRequest(
            `/api/map/load-all?lat=${lat}&lng=${lng}&maxPlaces=100`
        );
        
        console.log('✅ Load all places response:', data);
        
        if (data.success) {
            displayPlaces(data.places || [], {
                page: 1,
                total: data.places?.length || 0,
                totalPages: 1,
                hasNext: false,
                hasPrevious: false
            });
            
            if (data.categories) {
                displayCategoryFilters(data.categories);
            }
        }
        
        hideLoadingIndicator();
    } catch (error) {
        console.error('❌ Error loading all places:', error);
        hideLoadingIndicator();
        alert('Failed to load all places: ' + error.message);
    }
}

// ==================== CATEGORY FILTERS ====================
function displayCategoryFilters(categories) {
    const filterContainer = document.getElementById('category-filters');
    if (!filterContainer) return;
    
    filterContainer.innerHTML = `
        <h4>Filter by Category</h4>
        <div class="filter-buttons">
            <button onclick="filterPlacesByCategory('all')" class="filter-btn active">All</button>
            ${categories.slice(0, 12).map(cat => 
                `<button onclick="filterPlacesByCategory('${cat}')" class="filter-btn">${cat}</button>`
            ).join('')}
            ${categories.length > 12 ? `<button onclick="alert('More categories coming soon!')" class="filter-btn">+${categories.length - 12} more</button>` : ''}
        </div>
    `;
}

function filterPlacesByCategory(category) {
    console.log(`🔍 Filtering by category: ${category}`);
    loadPlaces(currentLat, currentLng, 1);
}

// ==================== UTILITY FUNCTIONS ====================
function showLoadingIndicator(message) {
    const indicator = document.getElementById('loading-indicator');
    if (indicator) {
        indicator.textContent = message || 'Loading...';
        indicator.style.display = 'block';
    }
}

function hideLoadingIndicator() {
    const indicator = document.getElementById('loading-indicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

// ==================== AUTO-LOGIN ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM fully loaded');
    console.log(`📍 Base path from URL: ${BASE_PATH}`);
    
    const urlParams = new URLSearchParams(window.location.search);
    const testUser = urlParams.get('user');
    
    if (testUser && ['admin', 'alice', 'bob'].includes(testUser)) {
        console.log(`🔑 Auto-login with test user: ${testUser}`);
        document.getElementById('username').value = testUser;
        document.getElementById('password').value = testUser + 'pass';
        setTimeout(() => {
            loginForm.dispatchEvent(new Event('submit'));
        }, 500);
    }
});

console.log('✅ map.js loaded successfully');