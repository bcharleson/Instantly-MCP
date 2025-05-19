#!/usr/bin/env tsx
/**
 * Test Instantly API directly with provided API key
 */

const API_KEY = 'NTc3NDExNTYtYTA1My00NDVkLTlmZmUtYjUwN2UxYzJlYjY4Ok50SUViU0FKWVFvTw==';

async function test() {
  const urls = [
    'https://api.instantly.ai/api/v2/campaigns',
    'https://api.instantly.ai/api/v2/api_keys',
    'https://api.instantly.ai/api/v1/campaigns', // test v1 for comparison
  ];

  for (const url of urls) {
    console.log(`\nTesting: ${url}`);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`Status: ${response.status} ${response.statusText}`);
      
      if (response.status === 401) {
        const text = await response.text();
        console.log('Response:', text);
      } else if (response.ok) {
        const data = await response.json();
        console.log('Success! Data:', JSON.stringify(data, null, 2).substring(0, 200) + '...');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }

  // Also test without Bearer prefix
  console.log('\n\nTesting without Bearer prefix:');
  const response = await fetch('https://api.instantly.ai/api/v2/campaigns', {
    headers: {
      'Authorization': API_KEY,
      'Content-Type': 'application/json'
    }
  });
  console.log(`Status: ${response.status} ${response.statusText}`);
}

test();