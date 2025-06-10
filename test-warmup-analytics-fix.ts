#!/usr/bin/env tsx

/**
 * Test script for the fixed get_warmup_analytics tool in Instantly MCP v1.0.2
 * Tests the corrected parameter structure: emails (array) instead of email (string)
 */

import { spawn } from 'child_process';

const API_KEY = process.argv[2];

if (!API_KEY) {
  console.error('Usage: tsx test-warmup-analytics-fix.ts YOUR_API_KEY');
  process.exit(1);
}

interface TestResult {
  test: string;
  status: 'success' | 'error';
  message: string;
  response?: any;
}

const results: TestResult[] = [];

async function testTool(toolName: string, params: any, testName: string): Promise<TestResult> {
  return new Promise((resolve) => {
    console.log(`\n🧪 Testing ${testName}...`);
    
    const child = spawn('node', ['dist/index.js', '--api-key', API_KEY], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      try {
        if (output.includes('"error"') || code !== 0) {
          const errorMatch = output.match(/"message":"([^"]+)"/);
          const errorMsg = errorMatch ? errorMatch[1] : 'Unknown error';
          resolve({
            test: testName,
            status: 'error',
            message: errorMsg,
            response: output
          });
        } else {
          resolve({
            test: testName,
            status: 'success',
            message: 'Tool executed successfully',
            response: output
          });
        }
      } catch (e) {
        resolve({
          test: testName,
          status: 'error',
          message: `Parse error: ${e}`,
          response: output
        });
      }
    });

    // Send the tool call
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: params
      }
    };

    child.stdin.write(JSON.stringify(request) + '\n');
    child.stdin.end();

    // Timeout after 15 seconds
    setTimeout(() => {
      child.kill();
      resolve({
        test: testName,
        status: 'error',
        message: 'Timeout after 15 seconds'
      });
    }, 15000);
  });
}

async function runTests() {
  console.log('🚀 Testing Fixed get_warmup_analytics Tool');
  console.log('=' .repeat(50));

  // First, get valid email addresses from list_accounts
  console.log('\n📋 Step 1: Getting valid account emails...');
  const accountsResult = await testTool('list_accounts', { limit: 3 }, 'Get Account Emails');
  
  let testEmails = ['test@example.com']; // fallback
  if (accountsResult.status === 'success' && accountsResult.response) {
    try {
      const emailMatches = accountsResult.response.match(/"email":"([^"]+)"/g);
      if (emailMatches && emailMatches.length > 0) {
        testEmails = emailMatches.slice(0, 2).map((match: string) => match.match(/"email":"([^"]+)"/)?.[1]).filter(Boolean);
        console.log(`✅ Found test emails: ${testEmails.join(', ')}`);
      }
    } catch (e) {
      console.log('⚠️  Could not extract emails, using fallback');
    }
  }

  // Test 1: Single email in array (correct format)
  console.log('\n🔧 Step 2: Testing get_warmup_analytics with single email in array...');
  const singleEmailResult = await testTool('get_warmup_analytics', {
    emails: [testEmails[0]]
  }, 'Single Email Array');
  results.push(singleEmailResult);

  // Test 2: Multiple emails in array
  if (testEmails.length > 1) {
    console.log('\n🔧 Step 3: Testing get_warmup_analytics with multiple emails...');
    const multiEmailResult = await testTool('get_warmup_analytics', {
      emails: testEmails
    }, 'Multiple Emails Array');
    results.push(multiEmailResult);
  }

  // Test 3: With date range
  console.log('\n🔧 Step 4: Testing get_warmup_analytics with date range...');
  const dateRangeResult = await testTool('get_warmup_analytics', {
    emails: [testEmails[0]],
    start_date: '2025-06-01',
    end_date: '2025-06-10'
  }, 'With Date Range');
  results.push(dateRangeResult);

  // Test 4: Error case - empty array (should fail)
  console.log('\n❌ Step 5: Testing error case - empty emails array...');
  const emptyArrayResult = await testTool('get_warmup_analytics', {
    emails: []
  }, 'Empty Array (Should Fail)');
  results.push(emptyArrayResult);

  // Test 5: Error case - missing emails parameter (should fail)
  console.log('\n❌ Step 6: Testing error case - missing emails parameter...');
  const missingEmailsResult = await testTool('get_warmup_analytics', {
    start_date: '2025-06-01'
  }, 'Missing Emails (Should Fail)');
  results.push(missingEmailsResult);

  // Print results
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(50));

  results.forEach((result, index) => {
    const status = result.status === 'success' ? '✅' : '❌';
    console.log(`${status} ${result.test}: ${result.message}`);
    
    if (result.status === 'error' && result.response) {
      const shortResponse = result.response.substring(0, 150);
      console.log(`   Details: ${shortResponse}...`);
    }
  });

  const successCount = results.filter(r => r.status === 'success').length;
  const expectedSuccesses = 3; // First 3 tests should succeed, last 2 should fail
  const actualSuccesses = results.slice(0, 3).filter(r => r.status === 'success').length;
  const expectedFailures = results.slice(3).filter(r => r.status === 'error').length;
  
  console.log(`\n🎯 Success Rate: ${actualSuccesses}/${expectedSuccesses} valid tests passed`);
  console.log(`🎯 Error Handling: ${expectedFailures}/2 error cases handled correctly`);
  
  if (actualSuccesses === expectedSuccesses && expectedFailures === 2) {
    console.log('🎉 get_warmup_analytics tool is now working correctly!');
    console.log('✅ API parameter fix successful');
    console.log('✅ Error handling working properly');
    console.log('✅ Ready for v1.0.3 release');
  } else {
    console.log('⚠️  Some issues still need attention');
    if (actualSuccesses < expectedSuccesses) {
      console.log('   - Valid API calls still failing');
    }
    if (expectedFailures < 2) {
      console.log('   - Error handling needs improvement');
    }
  }
}

runTests().catch(console.error);
