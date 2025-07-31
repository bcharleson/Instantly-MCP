#!/usr/bin/env node

/**
 * Comprehensive Testing Suite for 7 New Production-Verified Tools
 * 
 * Tests all new tools to ensure 100% functionality before production deployment
 * 
 * Usage:
 *   INSTANTLY_API_KEY=your_key node test-new-tools.js
 */

const { spawn } = require('child_process');
const fs = require('fs');

// Test configuration
const INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY;
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const TEST_CAMPAIGN_ID = process.env.TEST_CAMPAIGN_ID;

if (!INSTANTLY_API_KEY) {
  console.error('❌ INSTANTLY_API_KEY environment variable is required');
  process.exit(1);
}

console.log('🧪 COMPREHENSIVE TESTING SUITE - 7 NEW PRODUCTION TOOLS');
console.log('='.repeat(60));

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

// Helper function to run MCP tool
async function runMCPTool(toolName, args = {}) {
  return new Promise((resolve, reject) => {
    const input = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    });

    const child = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, INSTANTLY_API_KEY }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      try {
        // Find the JSON response in stdout
        const lines = stdout.split('\n');
        let jsonResponse = null;
        
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.jsonrpc && parsed.result) {
              jsonResponse = parsed;
              break;
            }
          } catch (e) {
            // Continue looking for valid JSON
          }
        }

        if (jsonResponse) {
          resolve({
            success: true,
            data: jsonResponse.result,
            stderr: stderr
          });
        } else {
          resolve({
            success: false,
            error: 'No valid JSON response found',
            stdout: stdout,
            stderr: stderr,
            code: code
          });
        }
      } catch (error) {
        resolve({
          success: false,
          error: error.message,
          stdout: stdout,
          stderr: stderr,
          code: code
        });
      }
    });

    child.stdin.write(input);
    child.stdin.end();

    // Timeout after 30 seconds
    setTimeout(() => {
      child.kill();
      reject(new Error('Test timeout after 30 seconds'));
    }, 30000);
  });
}

// Test function
async function runTest(testName, toolName, args, validator) {
  console.log(`\n🔍 Testing: ${testName}`);
  console.log(`   Tool: ${toolName}`);
  console.log(`   Args: ${JSON.stringify(args)}`);
  
  try {
    const result = await runMCPTool(toolName, args);
    
    if (result.success && result.data) {
      const isValid = validator ? validator(result.data) : true;
      
      if (isValid) {
        console.log(`   ✅ PASSED`);
        testResults.passed++;
        testResults.tests.push({ name: testName, status: 'PASSED', tool: toolName });
        return true;
      } else {
        console.log(`   ❌ FAILED - Validation failed`);
        console.log(`   Response: ${JSON.stringify(result.data, null, 2)}`);
        testResults.failed++;
        testResults.tests.push({ name: testName, status: 'FAILED', tool: toolName, error: 'Validation failed' });
        return false;
      }
    } else {
      console.log(`   ❌ FAILED - ${result.error || 'Unknown error'}`);
      if (result.stderr) {
        console.log(`   Error details: ${result.stderr.slice(-200)}`);
      }
      testResults.failed++;
      testResults.tests.push({ name: testName, status: 'FAILED', tool: toolName, error: result.error });
      return false;
    }
  } catch (error) {
    console.log(`   ❌ FAILED - ${error.message}`);
    testResults.failed++;
    testResults.tests.push({ name: testName, status: 'FAILED', tool: toolName, error: error.message });
    return false;
  }
}

// Validation functions
function validateUnreadCount(data) {
  const content = data.content?.[0]?.text;
  if (!content) return false;
  
  try {
    const parsed = JSON.parse(content);
    return parsed.success === true && 
           typeof parsed.unread_count === 'number' &&
           parsed.unread_count >= 0;
  } catch (e) {
    return false;
  }
}

function validateDailyAnalytics(data) {
  const content = data.content?.[0]?.text;
  if (!content) return false;
  
  try {
    const parsed = JSON.parse(content);
    return parsed.success === true && 
           parsed.analytics !== undefined &&
           typeof parsed.total_days === 'number';
  } catch (e) {
    return false;
  }
}

function validateAccountInfo(data) {
  const content = data.content?.[0]?.text;
  if (!content) return false;
  
  try {
    const parsed = JSON.parse(content);
    return parsed.success === true && 
           parsed.account !== undefined;
  } catch (e) {
    return false;
  }
}

function validateCampaignAction(data) {
  const content = data.content?.[0]?.text;
  if (!content) return false;
  
  try {
    const parsed = JSON.parse(content);
    return parsed.success === true && 
           parsed.campaign !== undefined;
  } catch (e) {
    return false;
  }
}

function validateAccountAction(data) {
  const content = data.content?.[0]?.text;
  if (!content) return false;
  
  try {
    const parsed = JSON.parse(content);
    return parsed.success === true && 
           parsed.account !== undefined;
  } catch (e) {
    return false;
  }
}

// Main test execution
async function runAllTests() {
  console.log(`🔑 Using API Key: ${INSTANTLY_API_KEY.slice(0, 8)}...`);
  console.log(`📧 Test Email: ${TEST_EMAIL}`);
  
  // TIER 1 TESTS - Safe Read-Only Tools
  console.log('\n📊 TIER 1 TESTS - Safe Read-Only Tools');
  console.log('-'.repeat(40));
  
  await runTest(
    'Count Unread Emails',
    'count_unread_emails',
    {},
    validateUnreadCount
  );
  
  await runTest(
    'Get Daily Campaign Analytics (All Campaigns)',
    'get_daily_campaign_analytics',
    {},
    validateDailyAnalytics
  );
  
  await runTest(
    'Get Daily Campaign Analytics (Date Range)',
    'get_daily_campaign_analytics',
    {
      start_date: '2024-01-01',
      end_date: '2024-01-31'
    },
    validateDailyAnalytics
  );
  
  await runTest(
    'Get Account Info',
    'get_account_info',
    { email: TEST_EMAIL },
    validateAccountInfo
  );
  
  // TIER 2 TESTS - Testable State-Change Tools
  console.log('\n⚙️ TIER 2 TESTS - Testable State-Change Tools');
  console.log('-'.repeat(40));
  console.log('⚠️ Note: These tests require valid campaign/account IDs');
  
  if (TEST_CAMPAIGN_ID) {
    await runTest(
      'Activate Campaign',
      'activate_campaign',
      { campaign_id: TEST_CAMPAIGN_ID },
      validateCampaignAction
    );
    
    await runTest(
      'Pause Campaign',
      'pause_campaign',
      { campaign_id: TEST_CAMPAIGN_ID },
      validateCampaignAction
    );
  } else {
    console.log('\n⚠️ Skipping campaign tests - TEST_CAMPAIGN_ID not provided');
    testResults.tests.push({ name: 'Campaign Tests', status: 'SKIPPED', tool: 'N/A', error: 'TEST_CAMPAIGN_ID not provided' });
  }
  
  await runTest(
    'Pause Account',
    'pause_account',
    { email: TEST_EMAIL },
    validateAccountAction
  );
  
  await runTest(
    'Resume Account',
    'resume_account',
    { email: TEST_EMAIL },
    validateAccountAction
  );
  
  // Test Summary
  console.log('\n📋 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📊 Total: ${testResults.tests.length}`);
  
  if (testResults.failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Ready for production deployment.');
  } else {
    console.log('\n⚠️ Some tests failed. Review before production deployment.');
  }
  
  // Detailed results
  console.log('\n📝 DETAILED RESULTS:');
  testResults.tests.forEach(test => {
    const status = test.status === 'PASSED' ? '✅' : test.status === 'SKIPPED' ? '⏭️' : '❌';
    console.log(`   ${status} ${test.name} (${test.tool})`);
    if (test.error) {
      console.log(`      Error: ${test.error}`);
    }
  });
  
  // Save results to file
  const reportFile = 'test-results-new-tools.json';
  fs.writeFileSync(reportFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      passed: testResults.passed,
      failed: testResults.failed,
      total: testResults.tests.length
    },
    tests: testResults.tests
  }, null, 2));
  
  console.log(`\n📄 Test results saved to: ${reportFile}`);
  
  process.exit(testResults.failed === 0 ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
