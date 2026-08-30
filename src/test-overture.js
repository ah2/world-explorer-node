const axios = require('axios');
require('dotenv').config();

async function testOverture() {
    console.log('🧪 Testing Overture API connection...');
    console.log('API Key:', process.env.OVERTURE_API_KEY ? '✅ Present' : '❌ Missing');

    if (!process.env.OVERTURE_API_KEY) {
        console.log('❌ No API key found');
        return;
    }

    // Test 1: Basic connectivity
    console.log('\n📡 Test 1: API reachability...');
    try {
        await axios.get('https://api.overturemapsapi.com');
        console.log('✅ API is reachable');
    } catch (error) {
        console.log('❌ Cannot reach API:', error.code || error.message);
    }

    // Test 2: Actual API call
    console.log('\n📡 Test 2: API call with key...');
    try {
        const response = await axios.get('https://api.overturemapsapi.com/places', {
            params: {
                lat: 40.7128,
                lng: -74.0060,
                radius: 1000,
                limit: 5
            },
            headers: {
                'x-api-key': process.env.OVERTURE_API_KEY
            },
            timeout: 10000
        });
        console.log('✅ API call successful!');
        console.log('Response status:', response.status);
        console.log('Number of results:', response.data?.features?.length || 0);
    } catch (error) {
        console.log('❌ API call failed:');
        console.log('  Code:', error.code);
        console.log('  Message:', error.message);
        if (error.response) {
            console.log('  Status:', error.response.status);
            console.log('  Data:', error.response.data);
        }
    }
}

testOverture();