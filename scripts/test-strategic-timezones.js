#!/usr/bin/env node

/**
 * Strategic Timezone Testing Script
 * Tests additional strategic timezones to expand our verified list
 */

import { testTimezone, STRATEGIC_TIMEZONES } from './test-timezones.js';
import fs from 'fs';

const API_KEY = process.env.INSTANTLY_API_KEY || 'ODkxZWUzNjEtOWE5MC00ZGM5LWExOWQtNWZhYWUxZDk4ZDNlOnBQdHdjUnh4ZFhNSw==';

// Test results storage
const strategicResults = {
  working: [],
  failed: [],
  errors: [],
  summary: {}
};

/**
 * Add delay between requests to avoid rate limiting
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Test strategic timezones
 */
async function testStrategicTimezones() {
  console.log('🎯 Testing Strategic Timezones for Instantly.ai API');
  console.log(`📊 Testing ${STRATEGIC_TIMEZONES.length} strategic timezones\n`);

  const startTime = Date.now();
  
  for (const timezone of STRATEGIC_TIMEZONES) {
    const result = await testTimezone(timezone);
    
    if (result.success) {
      strategicResults.working.push({
        timezone: result.timezone,
        campaignId: result.campaignId,
        status: 'success'
      });
    } else if (result.status) {
      strategicResults.failed.push({
        timezone: result.timezone,
        status: result.status,
        error: result.error,
        reason: 'API rejection'
      });
    } else {
      strategicResults.errors.push({
        timezone: result.timezone,
        error: result.error,
        reason: 'Network/parsing error'
      });
    }
    
    await delay(3000); // 3 second delay between requests
  }

  // Generate summary
  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);
  
  strategicResults.summary = {
    totalTested: STRATEGIC_TIMEZONES.length,
    working: strategicResults.working.length,
    failed: strategicResults.failed.length,
    errors: strategicResults.errors.length,
    successRate: Math.round((strategicResults.working.length / STRATEGIC_TIMEZONES.length) * 100),
    durationSeconds: duration,
    timestamp: new Date().toISOString()
  };

  // Load existing results and merge
  let existingResults = { working: [], failed: [], errors: [] };
  try {
    const existingData = fs.readFileSync('timezone-test-results.json', 'utf8');
    existingResults = JSON.parse(existingData);
  } catch (error) {
    console.log('No existing results found, starting fresh');
  }

  // Merge results
  const mergedResults = {
    working: [...existingResults.working, ...strategicResults.working],
    failed: [...existingResults.failed, ...strategicResults.failed],
    errors: [...existingResults.errors, ...strategicResults.errors],
    summary: {
      totalTested: existingResults.working?.length + existingResults.failed?.length + existingResults.errors?.length + strategicResults.summary.totalTested,
      working: existingResults.working?.length + strategicResults.working.length,
      failed: existingResults.failed?.length + strategicResults.failed.length,
      errors: existingResults.errors?.length + strategicResults.errors.length,
      successRate: Math.round(((existingResults.working?.length + strategicResults.working.length) / (existingResults.working?.length + existingResults.failed?.length + existingResults.errors?.length + strategicResults.summary.totalTested)) * 100),
      lastUpdate: new Date().toISOString(),
      strategicTestDuration: duration
    }
  };

  // Save merged results
  fs.writeFileSync('timezone-test-results.json', JSON.stringify(mergedResults, null, 2));
  
  console.log('\n=== STRATEGIC TEST RESULTS SUMMARY ===');
  console.log(`✅ Working timezones: ${strategicResults.working.length}`);
  console.log(`❌ Failed timezones: ${strategicResults.failed.length}`);
  console.log(`💥 Error timezones: ${strategicResults.errors.length}`);
  console.log(`📈 Success rate: ${strategicResults.summary.successRate}%`);
  console.log(`⏱️  Duration: ${duration} seconds`);
  
  console.log('\n=== NEWLY VERIFIED WORKING TIMEZONES ===');
  strategicResults.working.forEach(result => {
    console.log(`✅ ${result.timezone}`);
  });
  
  console.log('\n=== FAILED TIMEZONES ===');
  strategicResults.failed.forEach(result => {
    console.log(`❌ ${result.timezone} - ${result.status}`);
  });
  
  return strategicResults;
}

// Run the tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testStrategicTimezones()
    .then(() => {
      console.log('\n🎉 Strategic timezone testing completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Testing failed:', error);
      process.exit(1);
    });
}

export { testStrategicTimezones };
