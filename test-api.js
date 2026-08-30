const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testAPI() {
    try {
        console.log('🧪 Testing API endpoints...\n');

        // 1. Test Login
        console.log('1️⃣ Testing login...');
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            username: 'admin',
            password: 'adminpass'
        });
        
        const token = loginResponse.data.token;
        console.log('✅ Login successful!');
        console.log(`   Token: ${token.substring(0, 30)}...\n`);

        // 2. Test Get Profile
        console.log('2️⃣ Testing get profile...');
        const profileResponse = await axios.get(`${BASE_URL}/auth/profile`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✅ Profile retrieved!');
        console.log(`   Username: ${profileResponse.data.username}`);
        console.log(`   Score: ${profileResponse.data.score}\n`);

        // 3. Test Get Places
        console.log('3️⃣ Testing get places...');
        const placesResponse = await axios.get(`${BASE_URL}/map/places`, {
            params: { lat: 40.7128, lng: -74.0060 },
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`✅ Places retrieved! Found ${placesResponse.data.length} places\n`);

        // 4. Test Update Position
        console.log('4️⃣ Testing update position...');
        const positionResponse = await axios.post(`${BASE_URL}/map/position`, {
            lat: 40.7128,
            lng: -74.0060
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✅ Position updated!\n');

        console.log('🎉 All tests passed!');
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

testAPI();
