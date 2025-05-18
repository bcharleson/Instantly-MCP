#!/usr/bin/env tsx
/**
 * Test script for Instantly v2 API endpoints
 * Usage: tsx test-endpoints.ts --api-key YOUR_API_KEY
 */

const args = process.argv.slice(2);
const apiKeyIndex = args.findIndex(arg => arg === '--api-key');
const API_KEY = apiKeyIndex !== -1 && args[apiKeyIndex + 1] ? args[apiKeyIndex + 1] : null;

if (!API_KEY) {
  console.error('Error: Please provide API key using --api-key argument');
  process.exit(1);
}

const BASE_URL = 'https://api.instantly.ai/api/v2';

async function testEndpoint(
  method: string,
  endpoint: string,
  data?: any,
  description?: string
) {
  const url = `${BASE_URL}${endpoint}`;
  console.log(`\n🔍 Testing: ${description || endpoint}`);
  console.log(`   ${method} ${url}`);

  try {
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url);
    const responseData = await response.json();

    if (response.ok) {
      console.log(`✅ Success (${response.status})`);
      console.log('   Response:', JSON.stringify(responseData, null, 2).substring(0, 200) + '...');
    } else {
      console.error(`❌ Error (${response.status})`);
      console.error('   Response:', responseData);
    }

    return { success: response.ok, data: responseData, status: response.status };
  } catch (error) {
    console.error(`❌ Request failed:`, error);
    return { success: false, error };
  }
}

async function runTests() {
  console.log('🚀 Starting Instantly v2 API endpoint tests...');
  console.log('================================');

  // Test API Key endpoints
  await testEndpoint('GET', '/api-keys', null, 'List API Keys');

  // Test Accounts endpoints
  await testEndpoint('GET', '/accounts', null, 'List Accounts');
  await testEndpoint('POST', '/accounts/warmup-analytics', {
    account_id: '',  // Would need actual account ID
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  }, 'Get Warmup Analytics (will fail without valid account_id)');

  // Test Campaign endpoints
  await testEndpoint('GET', '/campaigns', null, 'List Campaigns');
  await testEndpoint('GET', '/campaigns/analytics/overview', null, 'Get Campaign Analytics Overview');

  // Test Lead Management
  await testEndpoint('POST', '/leads/list', {
    limit: 10,
    skip: 0
  }, 'List Leads');

  // Test Lead Lists
  await testEndpoint('GET', '/lead-lists', null, 'List Lead Lists');

  // Test Email endpoints
  await testEndpoint('GET', '/emails', null, 'List Emails');

  // Test Email Verification
  await testEndpoint('POST', '/email-verification', {
    email: 'test@example.com'
  }, 'Verify Email Address');

  console.log('\n================================');
  console.log('✨ Tests completed!');
  console.log('\nNote: Some endpoints may fail if they require valid IDs or specific data.');
  console.log('Check the Instantly dashboard for valid resource IDs to test with.');
}

// Run the tests
runTests().catch(console.error);