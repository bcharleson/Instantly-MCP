#!/usr/bin/env tsx

/**
 * Test script for the two fixed tools in Instantly MCP v1.0.2
 * Tests: update_account and get_warmup_analytics with email parameters
 */

import { spawn } from 'child_process';

const API_KEY = process.argv[2];

if (!API_KEY) {
  console.error('Usage: tsx test-fixed-tools.ts YOUR_API_KEY');
  process.exit(1);
}

interface TestResult {
  tool: string;
  status: 'success' | 'error';
  message: string;
  response?: any;
}

const results: TestResult[] = [];

async function testTool(toolName: string, params: any): Promise<TestResult> {
  return new Promise((resolve) => {
    console.log(`\n🧪 Testing ${toolName}...`);
    
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
            tool: toolName,
            status: 'error',
            message: errorMsg,
            response: output
          });
        } else {
          resolve({
            tool: toolName,
            status: 'success',
            message: 'Tool executed successfully',
            response: output
          });
        }
      } catch (e) {
        resolve({
          tool: toolName,
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

    // Timeout after 10 seconds
    setTimeout(() => {
      child.kill();
      resolve({
        tool: toolName,
        status: 'error',
        message: 'Timeout after 10 seconds'
      });
    }, 10000);
  });
}

async function runTests() {
  console.log('🚀 Testing Fixed Tools in Instantly MCP v1.0.2');
  console.log('=' .repeat(50));

  // First, get a valid email address from list_accounts
  console.log('\n📋 Step 1: Getting valid account email...');
  const accountsResult = await testTool('list_accounts', { limit: 1 });
  
  let testEmail = 'test@example.com'; // fallback
  if (accountsResult.status === 'success' && accountsResult.response) {
    try {
      const responseMatch = accountsResult.response.match(/"email":"([^"]+)"/);
      if (responseMatch) {
        testEmail = responseMatch[1];
        console.log(`✅ Found test email: ${testEmail}`);
      }
    } catch (e) {
      console.log('⚠️  Could not extract email, using fallback');
    }
  }

  // Test 1: update_account with email parameter
  console.log('\n🔧 Step 2: Testing update_account with email parameter...');
  const updateResult = await testTool('update_account', {
    email: testEmail,
    daily_limit: 45
  });
  results.push(updateResult);

  // Test 2: get_warmup_analytics with email parameter  
  console.log('\n📊 Step 3: Testing get_warmup_analytics with email parameter...');
  const analyticsResult = await testTool('get_warmup_analytics', {
    email: testEmail,
    start_date: '2025-06-01',
    end_date: '2025-06-10'
  });
  results.push(analyticsResult);

  // Print results
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(50));

  results.forEach((result, index) => {
    const status = result.status === 'success' ? '✅' : '❌';
    console.log(`${status} ${result.tool}: ${result.message}`);
    
    if (result.status === 'error' && result.response) {
      console.log(`   Error details: ${result.response.substring(0, 200)}...`);
    }
  });

  const successCount = results.filter(r => r.status === 'success').length;
  const totalCount = results.length;
  
  console.log(`\n🎯 Success Rate: ${successCount}/${totalCount} (${Math.round(successCount/totalCount*100)}%)`);
  
  if (successCount === totalCount) {
    console.log('🎉 All fixed tools are working correctly!');
    console.log('✅ Ready for v1.0.2 release');
  } else {
    console.log('⚠️  Some tools still need fixes');
  }
}

runTests().catch(console.error);
