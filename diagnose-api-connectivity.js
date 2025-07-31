#!/usr/bin/env node

/**
 * Instantly.ai API Connectivity Diagnostic Tool
 * 
 * Tests API connectivity, authentication, and endpoint availability
 * to diagnose production API call failures.
 */

const INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY;
const INSTANTLY_API_URL = 'https://api.instantly.ai/api/v2';

if (!INSTANTLY_API_KEY) {
  console.error('❌ Error: INSTANTLY_API_KEY environment variable is required');
  console.error('   Set it with: export INSTANTLY_API_KEY=your_api_key');
  process.exit(1);
}

console.log('🔍 INSTANTLY.AI API CONNECTIVITY DIAGNOSTIC');
console.log('='.repeat(50));
console.log(`🔑 API Key: ${INSTANTLY_API_KEY.slice(0, 8)}...${INSTANTLY_API_KEY.slice(-4)}`);
console.log(`🌐 Base URL: ${INSTANTLY_API_URL}`);
console.log(`🕐 Timestamp: ${new Date().toISOString()}`);
console.log('');

// Test endpoints in order of importance
const testEndpoints = [
  {
    name: 'API Keys List',
    endpoint: '/api-keys',
    method: 'GET',
    description: 'Basic authentication test'
  },
  {
    name: 'Accounts List',
    endpoint: '/accounts',
    method: 'GET', 
    description: 'Core functionality test'
  },
  {
    name: 'Campaigns List',
    endpoint: '/campaigns',
    method: 'GET',
    description: 'Campaign access test'
  },
  {
    name: 'Unread Emails Count',
    endpoint: '/emails/unread/count',
    method: 'GET',
    description: 'New tool functionality test'
  }
];

async function testEndpoint(test) {
  console.log(`\n🧪 Testing: ${test.name}`);
  console.log(`   Endpoint: ${test.method} ${INSTANTLY_API_URL}${test.endpoint}`);
  console.log(`   Purpose: ${test.description}`);
  
  try {
    const startTime = Date.now();
    
    const response = await fetch(`${INSTANTLY_API_URL}${test.endpoint}`, {
      method: test.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INSTANTLY_API_KEY}`,
      },
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`   ⏱️  Response Time: ${responseTime}ms`);
    console.log(`   📊 Status Code: ${response.status} ${response.statusText}`);
    
    // Check response headers
    const contentType = response.headers.get('content-type');
    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
    const rateLimitLimit = response.headers.get('x-ratelimit-limit');
    
    console.log(`   📋 Content-Type: ${contentType || 'Not specified'}`);
    if (rateLimitRemaining && rateLimitLimit) {
      console.log(`   🚦 Rate Limit: ${rateLimitRemaining}/${rateLimitLimit} remaining`);
    }
    
    // Try to parse response
    let responseData;
    try {
      const responseText = await response.text();
      if (responseText) {
        responseData = JSON.parse(responseText);
      }
    } catch (parseError) {
      console.log(`   ⚠️  Response parsing failed: ${parseError.message}`);
      return { success: false, status: response.status, error: 'Parse error' };
    }
    
    if (response.ok) {
      console.log(`   ✅ SUCCESS`);
      if (responseData) {
        if (Array.isArray(responseData)) {
          console.log(`   📊 Data: Array with ${responseData.length} items`);
        } else if (typeof responseData === 'object') {
          const keys = Object.keys(responseData);
          console.log(`   📊 Data: Object with keys: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}`);
        } else {
          console.log(`   📊 Data: ${typeof responseData}`);
        }
      }
      return { success: true, status: response.status, data: responseData };
    } else {
      console.log(`   ❌ FAILED`);
      if (responseData) {
        console.log(`   💬 Error Message: ${responseData.message || responseData.error || 'Unknown error'}`);
        if (responseData.statusCode) {
          console.log(`   🔢 Error Code: ${responseData.statusCode}`);
        }
      }
      return { success: false, status: response.status, error: responseData };
    }
    
  } catch (error) {
    console.log(`   ❌ NETWORK ERROR: ${error.message}`);
    console.log(`   🔍 Error Type: ${error.constructor.name}`);
    if (error.code) {
      console.log(`   🔢 Error Code: ${error.code}`);
    }
    return { success: false, error: error.message, networkError: true };
  }
}

async function runDiagnostics() {
  console.log('🚀 Starting API connectivity tests...\n');
  
  const results = [];
  
  for (const test of testEndpoints) {
    const result = await testEndpoint(test);
    results.push({ ...test, result });
    
    // Add delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📋 DIAGNOSTIC SUMMARY');
  console.log('='.repeat(50));
  
  const successful = results.filter(r => r.result.success);
  const failed = results.filter(r => !r.result.success);
  
  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);
  
  if (successful.length > 0) {
    console.log('\n🎉 WORKING ENDPOINTS:');
    successful.forEach(test => {
      console.log(`   ✅ ${test.name} (${test.result.status})`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n🚨 FAILED ENDPOINTS:');
    failed.forEach(test => {
      const error = test.result.error;
      const status = test.result.status;
      console.log(`   ❌ ${test.name} (${status || 'Network Error'})`);
      if (error && typeof error === 'object' && error.message) {
        console.log(`      💬 ${error.message}`);
      } else if (typeof error === 'string') {
        console.log(`      💬 ${error}`);
      }
    });
  }
  
  // Recommendations
  console.log('\n🔧 RECOMMENDATIONS:');
  
  if (failed.length === 0) {
    console.log('   🎯 All endpoints working correctly!');
    console.log('   🔍 Check MCP server configuration and Claude Desktop setup.');
  } else if (failed.every(f => f.result.status === 401)) {
    console.log('   🔑 Authentication issue detected:');
    console.log('      - Verify API key is correct and active');
    console.log('      - Check if API key has required permissions');
    console.log('      - Ensure API key is not expired');
  } else if (failed.every(f => f.result.status === 403)) {
    console.log('   🚫 Permission issue detected:');
    console.log('      - API key may lack required permissions');
    console.log('      - Check Instantly.ai plan limitations');
    console.log('      - Verify account status');
  } else if (failed.some(f => f.result.networkError)) {
    console.log('   🌐 Network connectivity issue detected:');
    console.log('      - Check internet connection');
    console.log('      - Verify firewall/proxy settings');
    console.log('      - Check if Instantly.ai API is experiencing downtime');
  } else if (failed.every(f => f.result.status >= 500)) {
    console.log('   🔧 Server-side issue detected:');
    console.log('      - Instantly.ai API may be experiencing issues');
    console.log('      - Try again in a few minutes');
    console.log('      - Check Instantly.ai status page');
  } else {
    console.log('   🔍 Mixed issues detected:');
    console.log('      - Some endpoints working, others failing');
    console.log('      - May indicate API changes or partial outage');
    console.log('      - Review individual endpoint errors above');
  }
  
  console.log('\n📞 SUPPORT INFORMATION:');
  console.log('   📧 Instantly.ai Support: support@instantly.ai');
  console.log('   📚 API Documentation: https://developer.instantly.ai/');
  console.log('   🔗 Status Page: https://status.instantly.ai/');
  
  process.exit(failed.length > 0 ? 1 : 0);
}

// Run diagnostics
runDiagnostics().catch(error => {
  console.error('\n💥 Diagnostic script failed:', error);
  process.exit(1);
});
