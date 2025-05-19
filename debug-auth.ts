#!/usr/bin/env tsx
/**
 * Debug authentication with Instantly API
 * Usage: tsx debug-auth.ts --api-key YOUR_API_KEY
 */

const args = process.argv.slice(2);
const apiKeyIndex = args.findIndex(arg => arg === '--api-key');
const API_KEY = apiKeyIndex !== -1 && args[apiKeyIndex + 1] ? args[apiKeyIndex + 1] : null;

if (!API_KEY) {
  console.error('Error: Please provide API key using --api-key argument');
  process.exit(1);
}

async function testAuth() {
  console.log('Testing authentication with Instantly API v2...');
  console.log('API Key:', API_KEY.substring(0, 10) + '...' + API_KEY.substring(API_KEY.length - 4));
  
  const url = 'https://api.instantly.ai/api/v2/api-keys';
  
  try {
    console.log('\nMaking request to:', url);
    console.log('Headers:', {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    });
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('\nResponse status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('\nResponse body:', text);
    
    try {
      const json = JSON.parse(text);
      console.log('\nParsed JSON:', JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('Could not parse as JSON');
    }
    
  } catch (error) {
    console.error('\nError:', error);
  }
}

testAuth();