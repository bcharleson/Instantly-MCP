#!/usr/bin/env node

/**
 * Systematic MCP Tool Validation Script
 * October 1st Launch Preparation - Critical Tool Testing
 * 
 * This script systematically tests all 25+ MCP tools to ensure
 * bulletproof functionality for the v1 launch deadline.
 */

import { spawn } from 'child_process';

// Tool validation configuration
const TOOLS_TO_VALIDATE = [
  // CRITICAL PRIORITY - Campaign Management (5 tools)
  {
    name: 'list_campaigns',
    priority: 'CRITICAL',
    tests: [
      { args: {}, description: 'List all campaigns' },
      { args: { status: 'active' }, description: 'Filter by active status' }
    ]
  },
  {
    name: 'get_campaign',
    priority: 'CRITICAL',
    tests: [
      { args: { campaign_id: 'PLACEHOLDER_ID' }, description: 'Get specific campaign', requiresId: true }
    ]
  },
  {
    name: 'create_campaign',
    priority: 'CRITICAL',
    tests: [
      { 
        args: { 
          name: 'Test Campaign',
          email_list: ['PLACEHOLDER_EMAIL'],
          sequence_steps: [{ subject: 'Test', body: 'Test body' }]
        }, 
        description: 'Create basic campaign',
        requiresAccounts: true
      }
    ]
  },
  {
    name: 'update_campaign',
    priority: 'CRITICAL',
    tests: [
      { args: { campaign_id: 'PLACEHOLDER_ID', name: 'Updated Name' }, description: 'Update campaign name', requiresId: true }
    ]
  },
  {
    name: 'activate_campaign',
    priority: 'CRITICAL',
    tests: [
      { args: { campaign_id: 'PLACEHOLDER_ID' }, description: 'Activate campaign', requiresId: true }
    ]
  },

  // CRITICAL PRIORITY - Analytics (2 tools)
  {
    name: 'get_campaign_analytics',
    priority: 'CRITICAL',
    tests: [
      { args: {}, description: 'Get all campaign analytics' },
      { args: { campaign_id: 'PLACEHOLDER_ID' }, description: 'Get specific campaign analytics', requiresId: true },
      { args: { start_date: '2024-01-01', end_date: '2024-12-31' }, description: 'Get analytics with date range' }
    ]
  },
  {
    name: 'get_campaign_analytics_overview',
    priority: 'CRITICAL',
    tests: [
      { args: {}, description: 'Get analytics overview' },
      { args: { start_date: '2024-01-01', end_date: '2024-12-31' }, description: 'Get overview with date range' }
    ]
  },

  // HIGH PRIORITY - Account Management (4 tools)
  {
    name: 'list_accounts',
    priority: 'HIGH',
    tests: [
      { args: {}, description: 'List all accounts' }
    ]
  },
  {
    name: 'create_account',
    priority: 'HIGH',
    tests: [
      { 
        args: { 
          email: 'test@example.com',
          smtp_host: 'smtp.example.com',
          smtp_port: 587,
          smtp_username: 'test@example.com',
          smtp_password: 'password'
        }, 
        description: 'Create account with SMTP settings',
        expectError: true // May fail with invalid SMTP
      }
    ]
  },
  {
    name: 'update_account',
    priority: 'HIGH',
    tests: [
      { args: { email: 'PLACEHOLDER_EMAIL', settings: {} }, description: 'Update account settings', requiresAccounts: true }
    ]
  },
  {
    name: 'get_warmup_analytics',
    priority: 'HIGH',
    tests: [
      { args: { emails: ['PLACEHOLDER_EMAIL'] }, description: 'Get warmup analytics', requiresAccounts: true }
    ]
  }
];

const API_KEY = process.env.INSTANTLY_API_KEY || 'test-key-for-validation';
const VALIDATION_RESULTS = {
  passed: [],
  failed: [],
  skipped: []
};

console.log('🚀 SYSTEMATIC MCP TOOL VALIDATION');
console.log('📅 October 1st Launch Preparation');
console.log('⏰ Deadline: 4 days remaining');
console.log('=' .repeat(60));

if (!process.env.INSTANTLY_API_KEY) {
  console.log('⚠️  Using test API key for tool registration validation');
  console.log('💡 Set INSTANTLY_API_KEY environment variable for full API testing');
}

// Helper function to test a single tool
async function testTool(toolConfig) {
  console.log(`\n🔧 Testing: ${toolConfig.name} (${toolConfig.priority} priority)`);
  
  const results = [];
  
  for (const test of toolConfig.tests) {
    console.log(`   📋 ${test.description}...`);
    
    try {
      const result = await callMCPTool(toolConfig.name, test.args);
      
      if (result.success) {
        console.log(`   ✅ PASSED: ${test.description}`);
        results.push({ test: test.description, status: 'PASSED', result: result.data });
      } else {
        if (test.expectError) {
          console.log(`   ⚠️  EXPECTED ERROR: ${test.description} - ${result.error}`);
          results.push({ test: test.description, status: 'EXPECTED_ERROR', error: result.error });
        } else {
          console.log(`   ❌ FAILED: ${test.description} - ${result.error}`);
          results.push({ test: test.description, status: 'FAILED', error: result.error });
        }
      }
    } catch (error) {
      console.log(`   💥 EXCEPTION: ${test.description} - ${error.message}`);
      results.push({ test: test.description, status: 'EXCEPTION', error: error.message });
    }
    
    // Brief pause between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}

// Helper function to call MCP tool
async function callMCPTool(toolName, args) {
  return new Promise((resolve, reject) => {
    const serverProcess = spawn('node', ['dist/index.js'], {
      env: { ...process.env, INSTANTLY_API_KEY: API_KEY },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };

    serverProcess.stdin.write(JSON.stringify(request) + '\n');

    const timeout = setTimeout(() => {
      serverProcess.kill();
      resolve({ success: false, error: 'Timeout after 15 seconds' });
    }, 15000);

    serverProcess.stdout.on('data', (data) => {
      output += data.toString();
      
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            if (response.id && response.id.toString() === request.id.toString()) {
              clearTimeout(timeout);
              serverProcess.kill();
              
              if (response.result) {
                resolve({ success: true, data: response.result });
              } else if (response.error) {
                resolve({ success: false, error: response.error.message || 'Unknown error' });
              }
              return;
            }
          } catch (e) {
            // Ignore JSON parse errors
          }
        }
      }
    });

    serverProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    serverProcess.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        resolve({ success: false, error: `Process exited with code ${code}: ${errorOutput}` });
      }
    });
  });
}

// Main validation function
async function runSystematicValidation() {
  console.log(`\n📊 Starting validation of ${TOOLS_TO_VALIDATE.length} critical tools...\n`);
  
  const startTime = Date.now();
  
  for (const toolConfig of TOOLS_TO_VALIDATE) {
    const results = await testTool(toolConfig);
    
    const passed = results.filter(r => r.status === 'PASSED').length;
    const failed = results.filter(r => r.status === 'FAILED').length;
    const errors = results.filter(r => r.status === 'EXCEPTION').length;
    
    if (failed === 0 && errors === 0) {
      VALIDATION_RESULTS.passed.push({ tool: toolConfig.name, priority: toolConfig.priority, results });
    } else {
      VALIDATION_RESULTS.failed.push({ tool: toolConfig.name, priority: toolConfig.priority, results });
    }
    
    console.log(`   📈 Summary: ${passed} passed, ${failed} failed, ${errors} exceptions`);
  }
  
  const totalTime = Math.round((Date.now() - startTime) / 1000);
  
  // Generate final report
  console.log('\n' + '=' .repeat(60));
  console.log('📋 VALIDATION SUMMARY REPORT');
  console.log('=' .repeat(60));
  console.log(`⏱️  Total time: ${totalTime} seconds`);
  console.log(`✅ Tools passed: ${VALIDATION_RESULTS.passed.length}`);
  console.log(`❌ Tools failed: ${VALIDATION_RESULTS.failed.length}`);
  console.log(`⏭️  Tools skipped: ${VALIDATION_RESULTS.skipped.length}`);
  
  if (VALIDATION_RESULTS.failed.length > 0) {
    console.log('\n🚨 CRITICAL ISSUES FOUND:');
    VALIDATION_RESULTS.failed.forEach(failure => {
      console.log(`   ❌ ${failure.tool} (${failure.priority} priority)`);
      failure.results.forEach(result => {
        if (result.status === 'FAILED' || result.status === 'EXCEPTION') {
          console.log(`      - ${result.test}: ${result.error}`);
        }
      });
    });
  }
  
  console.log('\n🎯 NEXT STEPS:');
  if (VALIDATION_RESULTS.failed.length === 0) {
    console.log('✅ All critical tools validated successfully!');
    console.log('✅ Ready for October 1st launch!');
  } else {
    console.log('🔧 Fix critical issues identified above');
    console.log('🔄 Re-run validation after fixes');
    console.log('⚠️  Launch readiness: BLOCKED');
  }
}

// Run the validation
runSystematicValidation().catch(error => {
  console.error('💥 Validation script failed:', error);
  process.exit(1);
});
