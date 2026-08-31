// test-login.js
const axios = require('axios');

async function testLogin() {
    console.log('🧪 Testing login...');
    
    try {
        const response = await axios.post('http://localhost:5000/world-explorer/api/auth/login', {
            username: 'admin',
            password: 'adminpass'
        });
        
        console.log('✅ Login successful!');
        console.log('Token:', response.data.token.substring(0, 50) + '...');
        console.log('User:', response.data.user);
    } catch (error) {
        console.error('❌ Login failed:', error.response?.data || error.message);
    }
}

testLogin();