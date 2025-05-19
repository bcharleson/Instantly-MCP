#!/usr/bin/env tsx
/**
 * Simple test of Instantly API authentication
 * Usage: tsx debug-simple.ts YOUR_API_KEY
 */

const API_KEY = process.argv[2];

if (!API_KEY) {
  console.error('Usage: tsx debug-simple.ts YOUR_API_KEY');
  process.exit(1);
}

console.log('Testing with API key:', API_KEY.substring(0, 10) + '...');

async function test() {
  // Test different endpoints and see what works
  const endpoints = [
    'https://api.instantly.ai/api/v1/campaigns',  // v1 endpoint
    'https://api.instantly.ai/api/v2/campaigns',  // v2 endpoint
    'https://api.instantly.ai/api/v2/api_keys',   // v2 with underscore
    'https://api.instantly.ai/api/v2/api-keys',   // v2 with hyphen
  ];

  for (const url of endpoints) {
    console.log(`\nTesting ${url}`);
    
    // Try with Bearer
    try {
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      console.log(`  Bearer: ${res.status} ${res.statusText}`);
      if (res.status === 401) {
        const text = await res.text();
        console.log(`  Error: ${text.substring(0, 100)}...`);
      }
    } catch (e) {
      console.log(`  Bearer Error:`, e.message);
    }

    // Try without Bearer (just the key)
    try {
      const res = await fetch(url, {
        headers: {
          'Authorization': API_KEY,
          'Content-Type': 'application/json'
        }
      });
      console.log(`  No Bearer: ${res.status} ${res.statusText}`);
    } catch (e) {
      console.log(`  No Bearer Error:`, e.message);
    }

    // Try as API-Key header
    try {
      const res = await fetch(url, {
        headers: {
          'API-Key': API_KEY,
          'Content-Type': 'application/json'
        }
      });
      console.log(`  API-Key header: ${res.status} ${res.statusText}`);
    } catch (e) {
      console.log(`  API-Key Error:`, e.message);
    }

    // Try as query parameter
    try {
      const res = await fetch(`${url}?api_key=${API_KEY}`);
      console.log(`  Query param: ${res.status} ${res.statusText}`);
    } catch (e) {
      console.log(`  Query param Error:`, e.message);
    }
  }
}

test();