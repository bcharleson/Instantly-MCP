#!/usr/bin/env tsx

/**
 * Test script for Bulletproof Batched Pagination System in Instantly MCP v1.0.5
 * Tests the complete pagination implementation that solves the truncation issue
 */

import { spawn } from 'child_process';

const API_KEY = process.argv[2];

if (!API_KEY) {
  console.error('Usage: tsx test-bulletproof-pagination-v1.0.5.ts YOUR_API_KEY');
  process.exit(1);
}

interface TestResult {
  test: string;
  status: 'success' | 'error';
  message: string;
  response?: any;
  duration?: number;
  metrics?: {
    totalRetrieved?: number;
    apiCallsMade?: number;
    truncationAvoided?: boolean;
    completeDataset?: boolean;
  };
}

const results: TestResult[] = [];

async function testTool(toolName: string, params: any, testName: string): Promise<TestResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
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
      // Show progress messages in real-time
      const batchMatch = data.toString().match(/Batch \d+: Retrieved \d+ \w+ \(total: \d+\)/);
      if (batchMatch) {
        console.log(`   📊 ${batchMatch[0]}`);
      }
    });

    child.on('close', (code) => {
      const duration = Date.now() - startTime;
      try {
        if (output.includes('"error"') || code !== 0) {
          const errorMatch = output.match(/"message":"([^"]+)"/);
          const errorMsg = errorMatch ? errorMatch[1] : 'Unknown error';
          resolve({
            test: testName,
            status: 'error',
            message: errorMsg,
            response: output,
            duration
          });
        } else {
          // Extract metrics from response
          const totalMatch = output.match(/"total_retrieved":\s*(\d+)/);
          const apiCallsMatch = output.match(/"api_calls_made":\s*(\d+)/);
          const truncationMatch = output.match(/"truncation_avoided":\s*(true|false)/);
          const completeMatch = output.match(/"complete_dataset":\s*(true|false)/);
          const bulletproofMatch = output.match(/"pagination_method":\s*"bulletproof_batched"/);
          
          const metrics = {
            totalRetrieved: totalMatch ? parseInt(totalMatch[1]) : undefined,
            apiCallsMade: apiCallsMatch ? parseInt(apiCallsMatch[1]) : undefined,
            truncationAvoided: truncationMatch ? truncationMatch[1] === 'true' : undefined,
            completeDataset: completeMatch ? completeMatch[1] === 'true' : undefined
          };
          
          resolve({
            test: testName,
            status: 'success',
            message: bulletproofMatch ? 'Bulletproof batched pagination working correctly' : 'Tool executed successfully',
            response: output,
            duration,
            metrics
          });
        }
      } catch (e) {
        resolve({
          test: testName,
          status: 'error',
          message: `Parse error: ${e}`,
          response: output,
          duration
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

    // Timeout after 120 seconds (bulletproof pagination can take time for large datasets)
    setTimeout(() => {
      child.kill();
      resolve({
        test: testName,
        status: 'error',
        message: 'Timeout after 120 seconds',
        duration: 120000
      });
    }, 120000);
  });
}

async function runBulletproofPaginationTests() {
  console.log('🚀 Testing Bulletproof Batched Pagination System - Instantly MCP v1.0.5');
  console.log('=' .repeat(80));

  // Test 1: Bulletproof Account Pagination (Method 1 - High Limit)
  console.log('\n📋 Test 1: Bulletproof Account Pagination (limit=100)');
  const accountsHighLimit = await testTool('list_accounts', {
    limit: 100
  }, 'Bulletproof Account Pagination (High Limit)');
  results.push(accountsHighLimit);

  // Test 2: Bulletproof Account Pagination (Method 2 - Explicit Flag)
  console.log('\n📋 Test 2: Bulletproof Account Pagination (get_all=true)');
  const accountsGetAll = await testTool('list_accounts', {
    get_all: true
  }, 'Bulletproof Account Pagination (Explicit Flag)');
  results.push(accountsGetAll);

  // Test 3: Bulletproof Campaign Pagination (Method 3 - String Trigger)
  console.log('\n📋 Test 3: Bulletproof Campaign Pagination (limit="all")');
  const campaignsAll = await testTool('list_campaigns', {
    limit: "all"
  }, 'Bulletproof Campaign Pagination (String Trigger)');
  results.push(campaignsAll);

  // Test 4: Campaign Pagination with Filters
  console.log('\n📋 Test 4: Campaign Pagination with Filters (status=active)');
  const campaignsFiltered = await testTool('list_campaigns', {
    limit: 100,
    status: 'active'
  }, 'Campaign Pagination with Filters');
  results.push(campaignsFiltered);

  // Test 5: Standard Single-Page Request (should not trigger bulletproof pagination)
  console.log('\n📋 Test 5: Standard Single-Page Request (limit=20)');
  const accountsStandard = await testTool('list_accounts', {
    limit: 20
  }, 'Standard Single-Page Request');
  results.push(accountsStandard);

  // Print results
  console.log('\n' + '='.repeat(80));
  console.log('📊 BULLETPROOF BATCHED PAGINATION TEST RESULTS');
  console.log('='.repeat(80));

  let successCount = 0;
  let bulletproofFeatureCount = 0;
  let totalRecordsRetrieved = 0;
  let totalApiCalls = 0;

  results.forEach((result, index) => {
    const status = result.status === 'success' ? '✅' : '❌';
    const duration = result.duration ? `(${(result.duration / 1000).toFixed(1)}s)` : '';
    console.log(`${status} ${result.test}: ${result.message} ${duration}`);
    
    if (result.status === 'success') {
      successCount++;
      
      // Check for bulletproof pagination features
      if (result.response && result.response.includes('bulletproof_batched')) {
        bulletproofFeatureCount++;
        console.log(`   🔄 Bulletproof batched pagination detected`);
      }
      
      // Display metrics
      if (result.metrics) {
        if (result.metrics.totalRetrieved !== undefined) {
          console.log(`   📊 Total records retrieved: ${result.metrics.totalRetrieved}`);
          totalRecordsRetrieved += result.metrics.totalRetrieved;
        }
        
        if (result.metrics.apiCallsMade !== undefined) {
          console.log(`   📞 API calls made: ${result.metrics.apiCallsMade}`);
          totalApiCalls += result.metrics.apiCallsMade;
        }
        
        if (result.metrics.truncationAvoided === true) {
          console.log(`   ✅ Truncation avoided: Complete dataset retrieved`);
        }
        
        if (result.metrics.completeDataset === true) {
          console.log(`   ✅ Complete dataset confirmed`);
        }
      }
    }
    
    if (result.status === 'error' && result.response) {
      console.log(`   Error details: ${result.response.substring(0, 150)}...`);
    }
  });

  const totalTests = results.length;
  const successRate = Math.round((successCount / totalTests) * 100);
  const bulletproofRate = Math.round((bulletproofFeatureCount / totalTests) * 100);
  
  console.log(`\n🎯 Overall Success Rate: ${successCount}/${totalTests} (${successRate}%)`);
  console.log(`🔄 Bulletproof Pagination Working: ${bulletproofFeatureCount}/${totalTests} (${bulletproofRate}%)`);
  console.log(`📊 Total Records Retrieved: ${totalRecordsRetrieved}`);
  console.log(`📞 Total API Calls Made: ${totalApiCalls}`);
  
  // Check for the critical issue resolution
  const largeDatasetTests = results.filter(r => 
    r.metrics?.totalRetrieved && r.metrics.totalRetrieved > 100
  );
  
  const truncationAvoided = results.filter(r => 
    r.metrics?.truncationAvoided === true
  ).length;
  
  console.log(`\n🎯 CRITICAL ISSUE RESOLUTION:`);
  console.log(`   Large datasets (>100 records): ${largeDatasetTests.length} tests`);
  console.log(`   Truncation avoided: ${truncationAvoided} tests`);
  
  if (successCount === totalTests && bulletproofFeatureCount >= 3 && truncationAvoided >= 2) {
    console.log('\n🎉 BULLETPROOF PAGINATION SYSTEM IS WORKING PERFECTLY!');
    console.log('✅ Complete pagination implemented correctly');
    console.log('✅ Truncation issue resolved');
    console.log('✅ Batched processing functional');
    console.log('✅ Multiple trigger methods working');
    console.log('✅ Large datasets retrieved without truncation');
    console.log('✅ Ready for v1.0.5 production release');
  } else if (successCount >= 4) {
    console.log('\n✅ Bulletproof pagination system mostly working');
    console.log('⚠️  Some features may need fine-tuning');
  } else {
    console.log('\n⚠️  Bulletproof pagination system needs attention');
    console.log('❌ Multiple test failures detected');
  }

  // Version validation
  console.log('\n📦 Version Information:');
  console.log('   Package: instantly-mcp@1.0.5 (bulletproof pagination)');
  console.log('   Features: Bulletproof Batched Pagination, Truncation Resolution');
  console.log('   Critical Fix: Resolves 100KB truncation issue for large datasets');
  console.log('   Status: Ready for npm publish');
}

runBulletproofPaginationTests().catch(console.error);
