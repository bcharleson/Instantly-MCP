#!/usr/bin/env node

const API_KEY = 'ODkxZWUzNjEtOWE5MC00ZGM5LWExOWQtNWZhYWUxZDk4ZDNlOkZoTmdZWnJSSHRyeg==';
const INSTANTLY_API_URL = 'https://api.instantly.ai/api/v2';

async function testCampaignsAPI() {
  console.log('🔍 Debug: Testing Instantly campaigns API directly...\n');
  
  try {
    // Test basic campaigns endpoint
    console.log('1. Testing GET /campaigns');
    const response1 = await fetch(`${INSTANTLY_API_URL}/campaigns`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Status: ${response1.status} ${response1.statusText}`);
    const data1 = await response1.json();
    console.log('Response:', JSON.stringify(data1, null, 2));
    console.log(`Type: ${typeof data1}, Array: ${Array.isArray(data1)}`);
    
    // Test with limit parameter
    console.log('\n2. Testing GET /campaigns?limit=50');
    const response2 = await fetch(`${INSTANTLY_API_URL}/campaigns?limit=50`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Status: ${response2.status} ${response2.statusText}`);
    const data2 = await response2.json();
    console.log('Response:', JSON.stringify(data2, null, 2));
    console.log(`Type: ${typeof data2}, Array: ${Array.isArray(data2)}`);
    
    // Test campaigns list endpoint (different endpoint)
    console.log('\n3. Testing POST /campaigns/list (alternative endpoint)');
    const response3 = await fetch(`${INSTANTLY_API_URL}/campaigns/list`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ limit: 50 })
    });
    
    if (response3.ok) {
      console.log(`Status: ${response3.status} ${response3.statusText}`);
      const data3 = await response3.json();
      console.log('Response:', JSON.stringify(data3, null, 2));
      console.log(`Type: ${typeof data3}, Array: ${Array.isArray(data3)}`);
    } else {
      console.log(`Status: ${response3.status} ${response3.statusText}`);
      const error3 = await response3.text();
      console.log('Error:', error3);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testCampaignsAPI();