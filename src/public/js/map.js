let map, userMarker, currentLat = 0, currentLng = 0;
let markers = [];
let token = null;
let userId = null;
let collectedPlaceIds = new Set();

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const gameScreen = document.getElementById('game-screen');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const usernameDisplay = document.getElementById('username-display');
const scoreDisplay = document.getElementById('score-display');
const collectedList = document.getElementById('collected-list');

// Initialize Map
function initMap(lat, lng) {
    if (map) {
        map.remove();
    }

    map = L.map('map').setView([lat, lng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // User marker
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
      .bindPopup('📍 You are here');

    // Load places and collected places
    loadPlaces(lat, lng);
    loadCollectedPlaces();

    // Map click to move
    map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        movePlayer(lat, lng);
    });

    // Keyboard controls
    document.addEventListener('keydown', handleKeyPress);
}

// Move player
async function movePlayer(lat, lng) {
    currentLat = lat;
    currentLng = lng;
    userMarker.setLatLng([lat, lng]);
    map.setView([lat, lng], 15);

    // Update position on server
    try {
        await fetch('/api/map/position', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ lat, lng })
        });
    } catch (error) {
        console.error('Failed to update position:', error);
    }

    // Load new places
    loadPlaces(lat, lng);
}

// Load places from server
async function loadPlaces(lat, lng) {
    try {
        const response = await fetch(`/api/map/places?lat=${lat}&lng=${lng}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to load places');

        const places = await response.json();
        displayPlaces(places);
    } catch (error) {
        console.error('Error loading places:', error);
    }
}

// Display places on map
function displayPlaces(places) {
    // Remove old markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    places.forEach(place => {
        // Check if already collected
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
                <p>📍 ${place.category}</p>
                <p>⭐ ${place.points} points</p>
                ${!isCollected ? `
                    <button onclick="collectPlace('${place.id}', '${place.name}', ${place.lat}, ${place.lng}, ${place.points})" 
                            class="collect-btn">
                        Collect!
                    </button>
                ` : '<p style="color:green;">✅ Already collected</p>'}
            </div>
        `;

        marker.bindPopup(popupContent);
        markers.push(marker);
    });
}

// Collect a place
async function collectPlace(id, name, lat, lng, points) {
    if (collectedPlaceIds.has(id)) {
        alert('You already collected this place!');
        return;
    }

    try {
        const response = await fetch('/api/map/collect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, lat, lng, points })
        });

        if (!response.ok) {
            const error = await response.json();
            alert(error.error || 'Failed to collect place');
            return;
        }

        const data = await response.json();
        
        // Update UI
        collectedPlaceIds.add(id);
        alert(`🎉 Collected ${name}! +${data.points} points!`);
        scoreDisplay.textContent = data.totalScore;
        
        // Refresh markers
        loadPlaces(currentLat, currentLng);
        loadCollectedPlaces();
    } catch (error) {
        console.error('Error collecting place:', error);
        alert('Failed to collect place');
    }
}

// Load collected places
async function loadCollectedPlaces() {
    try {
        const response = await fetch('/api/map/locations', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to load collected places');

        const data = await response.json();
        
        // Update collected IDs
        collectedPlaceIds = new Set(data.locations.map(loc => loc.id));
        
        // Update list
        collectedList.innerHTML = data.locations.map(loc => 
            `<li>${loc.name} <span class="points">+${loc.points}pts</span></li>`
        ).join('');

        // Update stats if available
        if (data.stats) {
            document.getElementById('total-collected').textContent = data.stats.count || 0;
        }
    } catch (error) {
        console.error('Error loading collected places:', error);
    }
}

// Handle keyboard movement
function handleKeyPress(e) {
    const step = 0.001; // Approximately 100 meters

    // Prevent scrolling with arrow keys
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

// Login handler
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
        alert('Please enter username and password');
        return;
    }

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
            const error = await response.json();
            alert(error.error || 'Login failed');
            return;
        }

        const data = await response.json();
        token = data.token;
        userId = data.user.id;

        // Show game
        loginScreen.style.display = 'none';
        gameScreen.style.display = 'flex';

        usernameDisplay.textContent = data.user.username;
        scoreDisplay.textContent = data.user.score || 0;

        const { lat = 40.7128, lng = -74.0060 } = data.user.position || {};
        currentLat = lat;
        currentLng = lng;
        
        // Initialize map after a small delay to ensure container is visible
        setTimeout(() => initMap(lat, lng), 100);

    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please try again.');
    }
});

// Logout handler
logoutBtn.addEventListener('click', () => {
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
    
    // Remove keyboard listener
    document.removeEventListener('keydown', handleKeyPress);
});

// Auto-login with test accounts (for development)
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const testUser = urlParams.get('user');
    
    if (testUser && ['admin', 'alice', 'bob'].includes(testUser)) {
        document.getElementById('username').value = testUser;
        document.getElementById('password').value = testUser + 'pass';
        loginForm.dispatchEvent(new Event('submit'));
    }
});
