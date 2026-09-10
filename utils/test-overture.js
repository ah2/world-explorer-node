// test-overture.js
const API_KEY = process.env.OVERTURE_API_KEY || 'DEMO-API-KEY';

async function testOverture() {
  console.log('🔍 Testing Overture API...\n');
  
  const tests = [
    { lat: 40.7128, lng: -74.0060, radius: 2000, category: '' },
    { lat: 40.7128, lng: -74.0060, radius: 2000, category: 'restaurant' },
    { lat: -33.8910, lng: 151.2769, radius: 2000, category: 'cafes' },
  ];

  for (const test of tests) {
    const params = new URLSearchParams({
      lat: test.lat.toString(),
      lng: test.lng.toString(),
      radius: test.radius.toString(),
      limit: '10'
    });
    if (test.category) params.append('categories', test.category);
    
    const url = `https://api.overturemapsapi.com/places?${params.toString()}`;
    console.log(`📡 Testing: ${url}`);
    
    try {
      const response = await fetch(url, {
        headers: { 'x-api-key': API_KEY }
      });
      const data = await response.json();
      
      console.log(`   Status: ${response.status}`);
      console.log(`   Results: ${data.features?.length || 0}`);
      if (data.features && data.features.length > 0) {
        console.log(`   Sample: ${data.features[0]?.properties?.name || 'N/A'}`);
      }
      console.log('');
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}\n`);
    }
  }
}

testOverture();