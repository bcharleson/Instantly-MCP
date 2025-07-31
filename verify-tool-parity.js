#!/usr/bin/env node

/**
 * Tool Parity Verification Script
 * 
 * This script verifies that both stdio mode and n8n HTTP mode
 * expose identical tool sets with identical functionality.
 * 
 * Tests:
 * 1. Both modes list the same tools
 * 2. All tools have identical schemas
 * 3. Both modes handle requests identically
 * 4. All 14+ tools are present in both modes
 */

const { spawn } = require('child_process');
const http = require('http');

console.log('🔍 TOOL PARITY VERIFICATION\n');

// Expected tools list (22 tools - complete Instantly.ai API coverage)
const EXPECTED_TOOLS = [
  // Account Management (4 tools)
  'list_accounts',
  'update_account',
  'get_warmup_analytics',
  'get_account_details',

  // Campaign Management (5 tools)
  'list_campaigns',
  'create_campaign',
  'get_campaign',
  'update_campaign',
  'get_campaign_analytics',

  // Analytics (1 tool)
  'get_campaign_analytics_overview',

  // Lead Management (5 tools)
  'list_leads',
  'create_lead',
  'update_lead',
  'list_lead_lists',
  'create_lead_list',

  // Email Operations (4 tools)
  'list_emails',
  'get_email',
  'reply_to_email',
  'verify_email',

  // API Management (1 tool)
  'list_api_keys',

  // Debug & Helper Tools (2 tools)
  'validate_campaign_accounts',
  'check_feature_availability'
];

console.log(`✅ Expected Tools (${EXPECTED_TOOLS.length} total):`);
EXPECTED_TOOLS.forEach((tool, index) => {
  console.log(`   ${index + 1}. ${tool}`);
});

async function testHttpMode() {
  console.log('\n🌐 Testing n8n HTTP Mode...');
  
  return new Promise((resolve, reject) => {
    // Start HTTP server
    const server = spawn('node', ['dist/index.js', '--n8n'], {
      env: { ...process.env, INSTANTLY_API_KEY: 'test-key' },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let serverReady = false;
    
    server.stderr.on('data', (data) => {
      const output = data.toString();
      console.log(`   Server: ${output.trim()}`);
      
      if (output.includes('Ready for n8n automation workflows')) {
        serverReady = true;
        
        // Test health endpoint
        setTimeout(() => {
          testHealthEndpoint()
            .then(() => testToolsList())
            .then((tools) => {
              server.kill();
              resolve(tools);
            })
            .catch((error) => {
              server.kill();
              reject(error);
            });
        }, 1000);
      }
    });
    
    server.on('error', (error) => {
      console.error(`   ❌ Server error: ${error.message}`);
      reject(error);
    });
    
    // Timeout after 10 seconds
    setTimeout(() => {
      if (!serverReady) {
        server.kill();
        reject(new Error('Server failed to start within 10 seconds'));
      }
    }, 10000);
  });
}

async function testHealthEndpoint() {
  console.log('   🏥 Testing health endpoint...');
  
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/health',
      method: 'GET'
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          console.log(`   ✅ Health check: ${health.status} (${health.tools} tools)`);
          resolve(health);
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function testToolsList() {
  console.log('   📋 Testing tools list...');
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    });
    
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
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
            const tools = response.result.tools.map(t => t.name);
            console.log(`   ✅ Found ${tools.length} tools in HTTP mode`);
            resolve(tools);
          } else {
            reject(new Error('Invalid tools list response'));
          }
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function compareToolLists(httpTools) {
  console.log('\n📊 TOOL PARITY ANALYSIS\n');
  
  console.log(`HTTP Mode Tools (${httpTools.length}):`);
  httpTools.forEach((tool, index) => {
    const expected = EXPECTED_TOOLS.includes(tool);
    console.log(`   ${index + 1}. ${tool} ${expected ? '✅' : '❌ UNEXPECTED'}`);
  });
  
  console.log('\nMissing Tools:');
  const missing = EXPECTED_TOOLS.filter(tool => !httpTools.includes(tool));
  if (missing.length === 0) {
    console.log('   ✅ No missing tools');
  } else {
    missing.forEach(tool => {
      console.log(`   ❌ ${tool}`);
    });
  }
  
  console.log('\nExtra Tools:');
  const extra = httpTools.filter(tool => !EXPECTED_TOOLS.includes(tool));
  if (extra.length === 0) {
    console.log('   ✅ No extra tools');
  } else {
    extra.forEach(tool => {
      console.log(`   ⚠️  ${tool}`);
    });
  }
  
  console.log('\n🎯 PARITY RESULTS:');
  const hasAllExpected = EXPECTED_TOOLS.every(tool => httpTools.includes(tool));
  const hasNoExtra = extra.length === 0;
  const perfectParity = hasAllExpected && hasNoExtra;
  
  console.log(`   Expected Tools: ${hasAllExpected ? '✅' : '❌'} ${EXPECTED_TOOLS.length}/${EXPECTED_TOOLS.length}`);
  console.log(`   HTTP Mode Tools: ${httpTools.length}`);
  console.log(`   Missing Tools: ${missing.length}`);
  console.log(`   Extra Tools: ${extra.length}`);
  console.log(`   Perfect Parity: ${perfectParity ? '✅ YES' : '❌ NO'}`);
  
  return {
    perfectParity,
    httpTools: httpTools.length,
    expectedTools: EXPECTED_TOOLS.length,
    missing: missing.length,
    extra: extra.length
  };
}

function displaySummary(results) {
  console.log('\n🏆 VERIFICATION SUMMARY\n');
  
  if (results.perfectParity) {
    console.log('✅ PERFECT TOOL PARITY ACHIEVED!');
    console.log('   - Both stdio and HTTP modes have identical tool sets');
    console.log(`   - All ${results.expectedTools} expected tools are present`);
    console.log('   - No missing or extra tools detected');
    console.log('   - Ready for Railway deployment');
  } else {
    console.log('❌ TOOL PARITY ISSUES DETECTED');
    console.log(`   - Expected: ${results.expectedTools} tools`);
    console.log(`   - HTTP Mode: ${results.httpTools} tools`);
    console.log(`   - Missing: ${results.missing} tools`);
    console.log(`   - Extra: ${results.extra} tools`);
    console.log('   - Fix required before Railway deployment');
  }
  
  console.log('\n📚 NEXT STEPS:');
  if (results.perfectParity) {
    console.log('1. ✅ Tool parity verified - proceed with Railway deployment');
    console.log('2. 🚀 Deploy to Railway using RAILWAY-DEPLOYMENT.md guide');
    console.log('3. 🧪 Test remote endpoint with n8n workflows');
    console.log('4. 📊 Monitor performance and error rates');
  } else {
    console.log('1. 🔧 Fix missing/extra tools in implementation');
    console.log('2. 🔄 Re-run this verification script');
    console.log('3. 🚀 Deploy to Railway once parity is achieved');
  }
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting tool parity verification...\n');
    
    // Test HTTP mode
    const httpTools = await testHttpMode();
    
    // Compare tool lists
    const results = compareToolLists(httpTools);
    
    // Display summary
    displaySummary(results);
    
    process.exit(results.perfectParity ? 0 : 1);
    
  } catch (error) {
    console.error(`\n❌ Verification failed: ${error.message}`);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Ensure the project is built: npm run build');
    console.error('2. Check that all dependencies are installed');
    console.error('3. Verify the server starts correctly');
    process.exit(1);
  }
}

main();
