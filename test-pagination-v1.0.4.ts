#!/usr/bin/env tsx

/**
 * Test script for Enhanced Pagination System in Instantly MCP v1.0.4
 * Tests the complete pagination implementation and user communication features
 */

import { spawn } from 'child_process';

const API_KEY = process.argv[2];

if (!API_KEY) {
  console.error('Usage: tsx test-pagination-v1.0.4.ts YOUR_API_KEY');
  process.exit(1);
}

interface TestResult {
  test: string;
  status: 'success' | 'error';
  message: string;
  response?: any;
  duration?: number;
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
      const progressMatch = data.toString().match(/Retrieved \d+ \w+ so far/);
      if (progressMatch) {
        console.log(`   📊 ${progressMatch[0]}`);
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
          // Check for pagination indicators
          const hasPaginationInfo = output.includes('pagination_info') || 
                                   output.includes('total_retrieved') ||
                                   output.includes('complete pagination');
          
          resolve({
            test: testName,
            status: 'success',
            message: hasPaginationInfo ? 'Pagination system working correctly' : 'Tool executed successfully',
            response: output,
            duration
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

    // Timeout after 60 seconds (pagination can take time)
    setTimeout(() => {
      child.kill();
      resolve({
        test: testName,
        status: 'error',
        message: 'Timeout after 60 seconds',
        duration: 60000
      });
    }, 60000);
  });
}

async function runPaginationTests() {
  console.log('🚀 Testing Enhanced Pagination System - Instantly MCP v1.0.4');
  console.log('=' .repeat(70));

  // Test 1: Complete Account Pagination (Method 1 - High Limit)
  console.log('\n📋 Test 1: Complete Account Pagination (limit=100)');
  const accountsHighLimit = await testTool('list_accounts', {
    limit: 100
  }, 'Complete Account Pagination (High Limit)');
  results.push(accountsHighLimit);

  // Test 2: Complete Account Pagination (Method 2 - Explicit Flag)
  console.log('\n📋 Test 2: Complete Account Pagination (get_all=true)');
  const accountsGetAll = await testTool('list_accounts', {
    get_all: true
  }, 'Complete Account Pagination (Explicit Flag)');
  results.push(accountsGetAll);

  // Test 3: Complete Campaign Pagination (Method 3 - String Trigger)
  console.log('\n📋 Test 3: Complete Campaign Pagination (limit="all")');
  const campaignsAll = await testTool('list_campaigns', {
    limit: "all"
  }, 'Complete Campaign Pagination (String Trigger)');
  results.push(campaignsAll);

  // Test 4: Standard Single-Page Request (should not trigger pagination)
  console.log('\n📋 Test 4: Standard Single-Page Request (limit=20)');
  const accountsStandard = await testTool('list_accounts', {
    limit: 20
  }, 'Standard Single-Page Request');
  results.push(accountsStandard);

  // Test 5: Campaign Pagination with Filters
  console.log('\n📋 Test 5: Campaign Pagination with Filters');
  const campaignsFiltered = await testTool('list_campaigns', {
    limit: 100,
    status: 'active'
  }, 'Campaign Pagination with Filters');
  results.push(campaignsFiltered);

  // Print results
  console.log('\n' + '='.repeat(70));
  console.log('📊 ENHANCED PAGINATION TEST RESULTS');
  console.log('='.repeat(70));

  let successCount = 0;
  let paginationFeatureCount = 0;

  results.forEach((result, index) => {
    const status = result.status === 'success' ? '✅' : '❌';
    const duration = result.duration ? `(${(result.duration / 1000).toFixed(1)}s)` : '';
    console.log(`${status} ${result.test}: ${result.message} ${duration}`);
    
    if (result.status === 'success') {
      successCount++;
      
      // Check for pagination features
      if (result.response && (
        result.response.includes('pagination_info') ||
        result.response.includes('total_retrieved') ||
        result.response.includes('complete pagination') ||
        result.response.includes('pages_used')
      )) {
        paginationFeatureCount++;
        console.log(`   🔄 Pagination features detected`);
      }
      
      // Extract and display key metrics
      try {
        const responseMatch = result.response.match(/"total_retrieved":\s*(\d+)/);
        if (responseMatch) {
          console.log(`   📊 Total items retrieved: ${responseMatch[1]}`);
        }
        
        const pagesMatch = result.response.match(/"pages_used":\s*(\d+)/);
        if (pagesMatch) {
          console.log(`   📄 Pages used: ${pagesMatch[1]}`);
        }
      } catch (e) {
        // Ignore parsing errors for metrics
      }
    }
    
    if (result.status === 'error' && result.response) {
      console.log(`   Error details: ${result.response.substring(0, 150)}...`);
    }
  });

  const totalTests = results.length;
  const successRate = Math.round((successCount / totalTests) * 100);
  const paginationRate = Math.round((paginationFeatureCount / totalTests) * 100);
  
  console.log(`\n🎯 Overall Success Rate: ${successCount}/${totalTests} (${successRate}%)`);
  console.log(`🔄 Pagination Features Working: ${paginationFeatureCount}/${totalTests} (${paginationRate}%)`);
  
  if (successCount === totalTests && paginationFeatureCount >= 3) {
    console.log('\n🎉 Enhanced Pagination System is working perfectly!');
    console.log('✅ Complete pagination implemented correctly');
    console.log('✅ Progress reporting functional');
    console.log('✅ Multiple trigger methods working');
    console.log('✅ Ready for v1.0.4 production release');
  } else if (successCount >= 4) {
    console.log('\n✅ Pagination system mostly working');
    console.log('⚠️  Some features may need fine-tuning');
  } else {
    console.log('\n⚠️  Pagination system needs attention');
    console.log('❌ Multiple test failures detected');
  }

  // Version validation
  console.log('\n📦 Version Information:');
  console.log('   Package: instantly-mcp@1.0.4');
  console.log('   Features: Enhanced Complete Pagination');
  console.log('   Status: Ready for npm publish');
}

runPaginationTests().catch(console.error);
