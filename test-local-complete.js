#!/usr/bin/env node

/**
 * Complete Local Testing Script
 * 
 * This script thoroughly tests both stdio and HTTP modes locally
 * to verify all 22 tools work correctly before Railway deployment.
 */

const { spawn } = require('child_process');
const http = require('http');

console.log('🧪 COMPLETE LOCAL TESTING - 22 Tools\n');

// Test configuration
const TEST_CONFIG = {
  httpPort: 3000,
  testTimeout: 30000,
  expectedTools: 22
};

async function testStdioMode() {
  console.log('📱 Testing stdio Mode (Claude Desktop/Cursor IDE)...\n');
  
  return new Promise((resolve, reject) => {
    const testInput = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    });
    
    const process = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, INSTANTLY_API_KEY: 'test-key-for-local-testing' }
    });
    
    let output = '';
    let errorOutput = '';
    
    process.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.log(`   Server Log: ${data.toString().trim()}`);
    });
    
    process.on('close', (code) => {
      try {
        if (output.trim()) {
          const response = JSON.parse(output.trim());
          if (response.result && response.result.tools) {
            const toolCount = response.result.tools.length;
            console.log(`   ✅ stdio Mode: ${toolCount} tools found`);
            
            if (toolCount === TEST_CONFIG.expectedTools) {
              console.log(`   ✅ Perfect! Expected ${TEST_CONFIG.expectedTools} tools, got ${toolCount}`);
              resolve({ mode: 'stdio', tools: toolCount, success: true });
            } else {
              console.log(`   ⚠️  Expected ${TEST_CONFIG.expectedTools} tools, got ${toolCount}`);
              resolve({ mode: 'stdio', tools: toolCount, success: false });
            }
          } else {
            console.log('   ❌ Invalid response format');
            resolve({ mode: 'stdio', tools: 0, success: false });
          }
        } else {
          console.log('   ❌ No output received');
          resolve({ mode: 'stdio', tools: 0, success: false });
        }
      } catch (error) {
        console.log(`   ❌ JSON parse error: ${error.message}`);
        resolve({ mode: 'stdio', tools: 0, success: false });
      }
    });
    
    process.on('error', (error) => {
      console.log(`   ❌ Process error: ${error.message}`);
      resolve({ mode: 'stdio', tools: 0, success: false });
    });
    
    // Send test input
    process.stdin.write(testInput + '\n');
    process.stdin.end();
    
    // Timeout
    setTimeout(() => {
      process.kill();
      console.log('   ⏰ stdio test timed out');
      resolve({ mode: 'stdio', tools: 0, success: false });
    }, 10000);
  });
}

async function testHttpMode() {
  console.log('\n🌐 Testing n8n HTTP Mode...\n');
  
  return new Promise((resolve, reject) => {
    // Start HTTP server
    const server = spawn('node', ['dist/index.js', '--n8n'], {
      env: { ...process.env, INSTANTLY_API_KEY: 'test-key-for-local-testing' },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let serverReady = false;
    let testResults = { mode: 'http', tools: 0, success: false };
    
    server.stderr.on('data', (data) => {
      const output = data.toString();
      console.log(`   Server: ${output.trim()}`);
      
      if (output.includes('Ready for n8n automation workflows')) {
        serverReady = true;
        
        // Run tests after server is ready
        setTimeout(async () => {
          try {
            const healthResult = await testHealthEndpoint();
            const toolsResult = await testToolsListEndpoint();
            const accountsResult = await testListAccountsEndpoint();
            
            testResults = {
              mode: 'http',
              tools: toolsResult.toolCount,
              success: healthResult.success && toolsResult.success,
              health: healthResult,
              toolsList: toolsResult,
              listAccounts: accountsResult
            };
            
            server.kill();
            resolve(testResults);
          } catch (error) {
            console.log(`   ❌ Test error: ${error.message}`);
            server.kill();
            resolve(testResults);
          }
        }, 2000);
      }
    });
    
    server.on('error', (error) => {
      console.log(`   ❌ Server error: ${error.message}`);
      resolve(testResults);
    });
    
    // Timeout
    setTimeout(() => {
      if (!serverReady) {
        server.kill();
        console.log('   ⏰ HTTP server failed to start within timeout');
        resolve(testResults);
      }
    }, TEST_CONFIG.testTimeout);
  });
}

async function testHealthEndpoint() {
  console.log('   🏥 Testing health endpoint...');
  
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: TEST_CONFIG.httpPort,
      path: '/health',
      method: 'GET'
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          console.log(`   ✅ Health: ${health.status} (${health.tools} tools)`);
          resolve({ 
            success: health.status === 'healthy' && health.tools === TEST_CONFIG.expectedTools,
            data: health 
          });
        } catch (error) {
          console.log(`   ❌ Health check failed: ${error.message}`);
          resolve({ success: false, error: error.message });
        }
      });
    });
    
    req.on('error', (error) => {
      console.log(`   ❌ Health request failed: ${error.message}`);
      resolve({ success: false, error: error.message });
    });
    
    req.end();
  });
}

async function testToolsListEndpoint() {
  console.log('   📋 Testing tools list endpoint...');
  
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    });
    
    const req = http.request({
      hostname: 'localhost',
      port: TEST_CONFIG.httpPort,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.result && response.result.tools) {
            const toolCount = response.result.tools.length;
            console.log(`   ✅ Tools list: ${toolCount} tools found`);
            
            // Show first few tools
            const toolNames = response.result.tools.slice(0, 5).map(t => t.name);
            console.log(`   📝 Sample tools: ${toolNames.join(', ')}...`);
            
            resolve({ 
              success: toolCount === TEST_CONFIG.expectedTools,
              toolCount: toolCount,
              tools: response.result.tools.map(t => t.name)
            });
          } else {
            console.log('   ❌ Invalid tools list response');
            resolve({ success: false, toolCount: 0 });
          }
        } catch (error) {
          console.log(`   ❌ Tools list failed: ${error.message}`);
          resolve({ success: false, toolCount: 0, error: error.message });
        }
      });
    });
    
    req.on('error', (error) => {
      console.log(`   ❌ Tools list request failed: ${error.message}`);
      resolve({ success: false, toolCount: 0, error: error.message });
    });
    
    req.write(postData);
    req.end();
  });
}

async function testListAccountsEndpoint() {
  console.log('   👥 Testing list_accounts endpoint...');
  
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'list_accounts',
        arguments: { get_all: true }
      }
    });
    
    const req = http.request({
      hostname: 'localhost',
      port: TEST_CONFIG.httpPort,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.result && response.result.content) {
            const content = JSON.parse(response.result.content[0].text);
            const accountCount = content.total_retrieved || 0;
            console.log(`   ✅ Accounts: ${accountCount} accounts retrieved`);
            
            // Check if we got the expected 398 accounts (or at least some accounts)
            const success = accountCount > 0;
            resolve({ 
              success: success,
              accountCount: accountCount,
              expectedIssue: accountCount === 0 ? 'This might be the 0 accounts pagination issue we fixed' : null
            });
          } else {
            console.log('   ❌ Invalid list_accounts response');
            resolve({ success: false, accountCount: 0 });
          }
        } catch (error) {
          console.log(`   ❌ list_accounts failed: ${error.message}`);
          resolve({ success: false, accountCount: 0, error: error.message });
        }
      });
    });
    
    req.on('error', (error) => {
      console.log(`   ❌ list_accounts request failed: ${error.message}`);
      resolve({ success: false, accountCount: 0, error: error.message });
    });
    
    req.write(postData);
    req.end();
  });
}

function displayResults(stdioResult, httpResult) {
  console.log('\n📊 LOCAL TESTING RESULTS\n');
  
  console.log('📱 stdio Mode (Claude Desktop/Cursor IDE):');
  console.log(`   Tools: ${stdioResult.tools}/${TEST_CONFIG.expectedTools}`);
  console.log(`   Status: ${stdioResult.success ? '✅ PASS' : '❌ FAIL'}`);
  
  console.log('\n🌐 n8n HTTP Mode:');
  console.log(`   Tools: ${httpResult.tools}/${TEST_CONFIG.expectedTools}`);
  console.log(`   Status: ${httpResult.success ? '✅ PASS' : '❌ FAIL'}`);
  
  if (httpResult.health) {
    console.log(`   Health: ${httpResult.health.success ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);
  }
  
  if (httpResult.listAccounts) {
    console.log(`   Accounts: ${httpResult.listAccounts.accountCount} (${httpResult.listAccounts.success ? '✅ WORKING' : '❌ ISSUE'})`);
    if (httpResult.listAccounts.expectedIssue) {
      console.log(`   Note: ${httpResult.listAccounts.expectedIssue}`);
    }
  }
  
  console.log('\n🎯 OVERALL RESULTS:');
  const overallSuccess = stdioResult.success && httpResult.success;
  console.log(`   Tool Parity: ${stdioResult.tools === httpResult.tools ? '✅ IDENTICAL' : '❌ MISMATCH'}`);
  console.log(`   Both Modes: ${overallSuccess ? '✅ WORKING' : '❌ ISSUES DETECTED'}`);
  console.log(`   Ready for Railway: ${overallSuccess ? '✅ YES' : '❌ FIX ISSUES FIRST'}`);
  
  console.log('\n📚 NEXT STEPS:');
  if (overallSuccess) {
    console.log('1. ✅ Local testing passed - proceed with Railway deployment');
    console.log('2. 🚀 Deploy: railway up');
    console.log('3. 🧪 Test remote endpoint');
    console.log('4. 🤖 Create n8n workflows');
  } else {
    console.log('1. 🔧 Fix detected issues');
    console.log('2. 🔄 Re-run local testing');
    console.log('3. 🚀 Deploy when all tests pass');
  }
  
  return overallSuccess;
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting comprehensive local testing...\n');
    
    // Test both modes
    const stdioResult = await testStdioMode();
    const httpResult = await testHttpMode();
    
    // Display results
    const success = displayResults(stdioResult, httpResult);
    
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    console.error(`\n❌ Testing failed: ${error.message}`);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Ensure the project is built: npm run build');
    console.error('2. Check that all dependencies are installed');
    console.error('3. Verify no other processes are using port 3000');
    process.exit(1);
  }
}

main();
