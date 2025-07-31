#!/usr/bin/env node

/**
 * Comprehensive Staging Environment Test Suite
 * Tests the deployed Instantly MCP Server before instantly.ai integration
 */

const https = require('https');
const http = require('http');

// Configuration
const STAGING_URL = process.env.STAGING_URL || 'https://your-app.railway.app';
const API_KEY = process.env.INSTANTLY_API_KEY || 'test-key';
const TIMEOUT = 30000; // 30 seconds

console.log('🧪 STAGING ENVIRONMENT TEST SUITE');
console.log('=====================================\n');

console.log(`🌐 Testing URL: ${STAGING_URL}`);
console.log(`🔑 API Key: ${API_KEY ? '✅ Provided' : '❌ Missing'}\n`);

if (!API_KEY || API_KEY === 'test-key') {
  console.log('⚠️  Warning: Set INSTANTLY_API_KEY environment variable for real testing\n');
}

// Test results tracking
const testResults = {
  healthCheck: false,
  serverInfo: false,
  toolsList: false,
  toolExecution: false,
  authentication: false,
  cors: false,
  performance: false,
  errorHandling: false
};

async function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(STAGING_URL + path);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Instantly-MCP-Test-Suite/1.0',
        ...headers
      },
      timeout: TIMEOUT
    };

    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const response = body ? JSON.parse(body) : {};
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: response
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body,
            parseError: error.message
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function testHealthCheck() {
  console.log('🏥 Testing Health Check...');
  
  try {
    const response = await makeRequest('GET', '/health');
    
    if (response.statusCode === 200 && response.body.status === 'healthy') {
      console.log('   ✅ Health check passed');
      console.log(`   📊 Service: ${response.body.service}`);
      console.log(`   📊 Version: ${response.body.version}`);
      console.log(`   📊 Transport: ${response.body.transport}`);
      testResults.healthCheck = true;
    } else {
      console.log('   ❌ Health check failed');
      console.log(`   📊 Status: ${response.statusCode}`);
      console.log(`   📊 Response: ${JSON.stringify(response.body, null, 2)}`);
    }
  } catch (error) {
    console.log('   ❌ Health check error:', error.message);
  }
}

async function testServerInfo() {
  console.log('\n📋 Testing Server Info...');
  
  try {
    const response = await makeRequest('GET', '/info');
    
    if (response.statusCode === 200 && response.body.name === 'Instantly MCP Server') {
      console.log('   ✅ Server info retrieved');
      console.log(`   📊 Tools: ${response.body.tools}`);
      console.log(`   📊 Transport: ${response.body.transport}`);
      console.log(`   📊 Endpoint: ${response.body.endpoint}`);
      testResults.serverInfo = true;
    } else {
      console.log('   ❌ Server info failed');
      console.log(`   📊 Status: ${response.statusCode}`);
    }
  } catch (error) {
    console.log('   ❌ Server info error:', error.message);
  }
}

async function testToolsList() {
  console.log('\n🔧 Testing Tools List...');
  
  try {
    const response = await makeRequest('POST', '/mcp', {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    }, {
      'x-api-key': API_KEY
    });
    
    if (response.statusCode === 200 && response.body.result && response.body.result.tools) {
      const toolCount = response.body.result.tools.length;
      console.log(`   ✅ Tools list retrieved - ${toolCount} tools available`);
      
      // Check for key tools
      const toolNames = response.body.result.tools.map(t => t.name);
      const keyTools = ['list_campaigns', 'list_accounts', 'list_leads'];
      const hasKeyTools = keyTools.every(tool => toolNames.includes(tool));
      
      if (hasKeyTools) {
        console.log('   ✅ Key tools present');
        testResults.toolsList = true;
      } else {
        console.log('   ⚠️  Some key tools missing');
      }
    } else {
      console.log('   ❌ Tools list failed');
      console.log(`   📊 Status: ${response.statusCode}`);
      console.log(`   📊 Response: ${JSON.stringify(response.body, null, 2)}`);
    }
  } catch (error) {
    console.log('   ❌ Tools list error:', error.message);
  }
}

async function testToolExecution() {
  console.log('\n⚙️ Testing Tool Execution...');
  
  try {
    const response = await makeRequest('POST', '/mcp', {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'list_accounts',
        arguments: { get_all: true }
      }
    }, {
      'x-api-key': API_KEY
    });
    
    if (response.statusCode === 200 && response.body.result) {
      console.log('   ✅ Tool execution successful');
      console.log('   📊 Response received and formatted correctly');
      testResults.toolExecution = true;
    } else {
      console.log('   ❌ Tool execution failed');
      console.log(`   📊 Status: ${response.statusCode}`);
      console.log(`   📊 Response: ${JSON.stringify(response.body, null, 2)}`);
    }
  } catch (error) {
    console.log('   ❌ Tool execution error:', error.message);
  }
}

async function testAuthentication() {
  console.log('\n🔐 Testing Authentication...');
  
  try {
    // Test without API key (should fail)
    const response = await makeRequest('POST', '/mcp', {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/list',
      params: {}
    });
    
    if (response.statusCode === 401) {
      console.log('   ✅ Authentication required (correctly rejected request without API key)');
      testResults.authentication = true;
    } else {
      console.log('   ❌ Authentication not enforced');
      console.log(`   📊 Status: ${response.statusCode}`);
    }
  } catch (error) {
    console.log('   ❌ Authentication test error:', error.message);
  }
}

async function testCORS() {
  console.log('\n🌐 Testing CORS Configuration...');
  
  try {
    const response = await makeRequest('OPTIONS', '/mcp', null, {
      'Origin': 'https://claude.ai',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'x-api-key'
    });
    
    if (response.statusCode === 200 || response.statusCode === 204) {
      const corsHeaders = response.headers['access-control-allow-origin'];
      if (corsHeaders) {
        console.log('   ✅ CORS configured');
        console.log(`   📊 Allowed origins: ${corsHeaders}`);
        testResults.cors = true;
      } else {
        console.log('   ⚠️  CORS headers not found');
      }
    } else {
      console.log('   ❌ CORS preflight failed');
      console.log(`   📊 Status: ${response.statusCode}`);
    }
  } catch (error) {
    console.log('   ❌ CORS test error:', error.message);
  }
}

async function testPerformance() {
  console.log('\n⚡ Testing Performance...');
  
  try {
    const startTime = Date.now();
    
    const response = await makeRequest('GET', '/health');
    
    const responseTime = Date.now() - startTime;
    
    if (response.statusCode === 200 && responseTime < 5000) {
      console.log(`   ✅ Response time acceptable: ${responseTime}ms`);
      testResults.performance = true;
    } else {
      console.log(`   ⚠️  Slow response time: ${responseTime}ms`);
    }
  } catch (error) {
    console.log('   ❌ Performance test error:', error.message);
  }
}

async function testErrorHandling() {
  console.log('\n🚨 Testing Error Handling...');
  
  try {
    // Test invalid JSON-RPC request
    const response = await makeRequest('POST', '/mcp', {
      invalid: 'request'
    }, {
      'x-api-key': API_KEY
    });
    
    if (response.statusCode >= 400 && response.body.error) {
      console.log('   ✅ Error handling working (invalid request properly rejected)');
      testResults.errorHandling = true;
    } else {
      console.log('   ❌ Error handling not working');
      console.log(`   📊 Status: ${response.statusCode}`);
    }
  } catch (error) {
    console.log('   ❌ Error handling test error:', error.message);
  }
}

async function generateReport() {
  console.log('\n📊 TEST RESULTS SUMMARY');
  console.log('========================\n');
  
  const passed = Object.values(testResults).filter(Boolean).length;
  const total = Object.keys(testResults).length;
  
  Object.entries(testResults).forEach(([test, result]) => {
    const status = result ? '✅ PASS' : '❌ FAIL';
    const testName = test.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    console.log(`${status} ${testName}`);
  });
  
  console.log(`\n📈 Overall Score: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('✅ Ready for instantly.ai integration');
    console.log('\n📋 Handoff Information:');
    console.log(`   🌐 Staging URL: ${STAGING_URL}`);
    console.log(`   🔧 Health Check: ${STAGING_URL}/health`);
    console.log(`   📋 Server Info: ${STAGING_URL}/info`);
    console.log(`   🔗 MCP Endpoint: ${STAGING_URL}/mcp`);
    console.log('\n🚀 Ready to share with Instantly.ai team!');
  } else {
    console.log('\n⚠️  SOME TESTS FAILED');
    console.log('❌ Fix issues before instantly.ai integration');
    process.exit(1);
  }
}

async function runAllTests() {
  try {
    await testHealthCheck();
    await testServerInfo();
    await testToolsList();
    await testToolExecution();
    await testAuthentication();
    await testCORS();
    await testPerformance();
    await testErrorHandling();
    await generateReport();
  } catch (error) {
    console.error('\n💥 Test suite error:', error);
    process.exit(1);
  }
}

// Run the test suite
runAllTests();
