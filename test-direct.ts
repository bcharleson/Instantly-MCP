#!/usr/bin/env tsx
/**
 * Direct test of Instantly API
 */

const API_KEY = process.argv[2];

if (!API_KEY) {
  console.error('Usage: tsx test-direct.ts YOUR_API_KEY');
  process.exit(1);
}

async function test() {
  // Let's test the exact same request that would be made by the MCP server
  const baseUrl = 'https://api.instantly.ai/api/v2';
  const endpoint = '/campaigns';
  const url = baseUrl + endpoint;

  console.log('Testing URL:', url);
  console.log('Using API key:', API_KEY.substring(0, 15) + '...');

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));

    const text = await response.text();
    console.log('Response:', text);

    if (response.status === 401) {
      console.log('\nAuthentication failed. Possible issues:');
      console.log('1. API key might be for v1 instead of v2');
      console.log('2. API key might be invalid or expired');
      console.log('3. Authentication format might be incorrect');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

test();