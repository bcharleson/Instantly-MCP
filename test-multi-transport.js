#!/usr/bin/env node

/**
 * Test Script for Multi-Transport Instantly MCP Server
 * Tests both stdio and HTTP transport modes
 */

const { spawn } = require('child_process');
const http = require('http');

console.log('🧪 MULTI-TRANSPORT TEST SUITE\n');

// Test configuration
const TEST_API_KEY = process.env.INSTANTLY_API_KEY || 'test-key';
const HTTP_PORT = 3001; // Use different port for testing

async function testStdioTransport() {
  console.log('📡 Testing Stdio Transport...');
  
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['dist/index.js'], {
      env: { 
        ...process.env, 
        TRANSPORT_MODE: 'stdio',
        INSTANTLY_API_KEY: TEST_API_KEY 
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    // Send tools/list request
    const request = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    });

    child.stdin.write(request + '\n');
    child.stdin.end();

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      try {
        if (output.trim()) {
          const response = JSON.parse(output.trim());
          if (response.result && response.result.tools) {
            console.log(`   ✅ Stdio transport working - ${response.result.tools.length} tools available`);
            resolve(true);
          } else {
            console.log('   ❌ Stdio transport - Invalid response format');
            resolve(false);
          }
        } else {
          console.log('   ❌ Stdio transport - No output received');
          console.log('   Error output:', errorOutput);
          resolve(false);
        }
      } catch (error) {
        console.log('   ❌ Stdio transport - JSON parse error:', error.message);
        console.log('   Raw output:', output);
        resolve(false);
      }
    });

    child.on('error', (error) => {
      console.log('   ❌ Stdio transport - Process error:', error.message);
      reject(error);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      child.kill();
      console.log('   ⏰ Stdio transport - Test timeout');
      resolve(false);
    }, 10000);
  });
}

async function testHttpTransport() {
  console.log('🌐 Testing HTTP Transport...');
  
  return new Promise((resolve, reject) => {
    // Start HTTP server
    const child = spawn('node', ['dist/index.js'], {
      env: { 
        ...process.env, 
        TRANSPORT_MODE: 'http',
        PORT: HTTP_PORT,
        INSTANTLY_API_KEY: TEST_API_KEY 
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let serverReady = false;
    let errorOutput = '';

    child.stderr.on('data', (data) => {
      const output = data.toString();
      errorOutput += output;
      
      if (output.includes('HTTP transport ready')) {
        serverReady = true;
        setTimeout(() => testHttpEndpoints(resolve, child), 1000);
      }
    });

    child.on('close', (code) => {
      if (!serverReady) {
        console.log('   ❌ HTTP transport - Server failed to start');
        console.log('   Error output:', errorOutput);
        resolve(false);
      }
    });

    child.on('error', (error) => {
      console.log('   ❌ HTTP transport - Process error:', error.message);
      reject(error);
    });

    // Timeout after 15 seconds
    setTimeout(() => {
      if (!serverReady) {
        child.kill();
        console.log('   ⏰ HTTP transport - Server startup timeout');
        resolve(false);
      }
    }, 15000);
  });
}

async function testHttpEndpoints(resolve, serverProcess) {
  try {
    // Test health endpoint
    const healthResponse = await makeHttpRequest('GET', '/health');
    if (healthResponse.status === 'healthy') {
      console.log('   ✅ Health endpoint working');
    } else {
      console.log('   ❌ Health endpoint failed');
      serverProcess.kill();
      return resolve(false);
    }

    // Test info endpoint
    const infoResponse = await makeHttpRequest('GET', '/info');
    if (infoResponse.name === 'Instantly MCP Server') {
      console.log('   ✅ Info endpoint working');
    } else {
      console.log('   ❌ Info endpoint failed');
      serverProcess.kill();
      return resolve(false);
    }

    // Test MCP endpoint
    const mcpRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    };

    const mcpResponse = await makeHttpRequest('POST', '/mcp', mcpRequest, {
      'x-api-key': TEST_API_KEY
    });

    if (mcpResponse.result && mcpResponse.result.tools) {
      console.log(`   ✅ MCP endpoint working - ${mcpResponse.result.tools.length} tools available`);
    } else {
      console.log('   ❌ MCP endpoint failed');
      console.log('   Response:', mcpResponse);
      serverProcess.kill();
      return resolve(false);
    }

    console.log('   ✅ HTTP transport fully functional');
    serverProcess.kill();
    resolve(true);

  } catch (error) {
    console.log('   ❌ HTTP transport - Request error:', error.message);
    serverProcess.kill();
    resolve(false);
  }
}

function makeHttpRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: HTTP_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve(response);
        } catch (error) {
          reject(new Error(`JSON parse error: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function runTests() {
  console.log('🔧 Prerequisites:');
  console.log(`   API Key: ${TEST_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Test Port: ${HTTP_PORT}`);
  console.log('');

  if (!TEST_API_KEY || TEST_API_KEY === 'test-key') {
    console.log('⚠️  Warning: Using test API key. Set INSTANTLY_API_KEY for real testing.\n');
  }

  try {
    // Test stdio transport
    const stdioResult = await testStdioTransport();
    
    // Test HTTP transport
    const httpResult = await testHttpTransport();

    console.log('\n📊 TEST RESULTS:');
    console.log(`   Stdio Transport: ${stdioResult ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   HTTP Transport: ${httpResult ? '✅ PASS' : '❌ FAIL'}`);
    
    if (stdioResult && httpResult) {
      console.log('\n🎉 ALL TESTS PASSED - Multi-transport implementation working!');
      console.log('\n🚀 Ready for deployment:');
      console.log('   • Local usage: node dist/index.js');
      console.log('   • HTTP mode: TRANSPORT_MODE=http node dist/index.js');
      console.log('   • Production: npm run start:production');
    } else {
      console.log('\n❌ SOME TESTS FAILED - Check implementation');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 TEST SUITE ERROR:', error);
    process.exit(1);
  }
}

// Run tests
runTests();
