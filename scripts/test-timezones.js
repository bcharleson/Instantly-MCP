#!/usr/bin/env node

/**
 * Timezone Validation Testing Script for Instantly.ai API
 * 
 * This script systematically tests each timezone from the API documentation
 * against the actual Instantly.ai API to identify which ones truly work.
 * 
 * Usage: node scripts/test-timezones.js
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// API Configuration
const API_BASE_URL = 'https://api.instantly.ai/api/v2';
const API_KEY = process.env.INSTANTLY_API_KEY || 'ODkxZWUzNjEtOWE5MC00ZGM5LWExOWQtNWZhYWUxZDk4ZDNlOnBQdHdjUnh4ZFhNSw==';

// All timezones from Instantly.ai API documentation
const ALL_TIMEZONES = [
  "Etc/GMT+12", "Etc/GMT+11", "Etc/GMT+10", "America/Anchorage", "America/Dawson",
  "America/Creston", "America/Chihuahua", "America/Boise", "America/Belize", "America/Chicago",
  "America/Bahia_Banderas", "America/Regina", "America/Bogota", "America/Detroit",
  "America/Indiana/Marengo", "America/Caracas", "America/Asuncion", "America/Glace_Bay",
  "America/Campo_Grande", "America/Anguilla", "America/Santiago", "America/St_Johns",
  "America/Sao_Paulo", "America/Argentina/La_Rioja", "America/Araguaina", "America/Godthab",
  "America/Montevideo", "America/Bahia", "America/Noronha", "America/Scoresbysund",
  "Atlantic/Cape_Verde", "Africa/Casablanca", "America/Danmarkshavn", "Europe/Isle_of_Man",
  "Atlantic/Canary", "Africa/Abidjan", "Arctic/Longyearbyen", "Europe/Belgrade",
  "Africa/Ceuta", "Europe/Sarajevo", "Africa/Algiers", "Africa/Windhoek",
  "Asia/Nicosia", "Asia/Beirut", "Africa/Cairo", "Asia/Damascus",
  "Europe/Bucharest", "Africa/Blantyre", "Europe/Helsinki", "Europe/Istanbul",
  "Asia/Jerusalem", "Africa/Tripoli", "Asia/Amman", "Asia/Baghdad",
  "Europe/Kaliningrad", "Asia/Aden", "Africa/Addis_Ababa", "Europe/Kirov",
  "Europe/Astrakhan", "Asia/Tehran", "Asia/Dubai", "Asia/Baku",
  "Indian/Mahe", "Asia/Tbilisi", "Asia/Yerevan", "Asia/Kabul",
  "Antarctica/Mawson", "Asia/Yekaterinburg", "Asia/Karachi", "Asia/Kolkata",
  "Asia/Colombo", "Asia/Kathmandu", "Antarctica/Vostok", "Asia/Dhaka",
  "Asia/Rangoon", "Antarctica/Davis", "Asia/Novokuznetsk", "Asia/Hong_Kong",
  "Asia/Krasnoyarsk", "Asia/Brunei", "Australia/Perth", "Asia/Taipei",
  "Asia/Choibalsan", "Asia/Irkutsk", "Asia/Dili", "Asia/Pyongyang",
  "Australia/Adelaide", "Australia/Darwin", "Australia/Brisbane", "Australia/Melbourne",
  "Antarctica/DumontDUrville", "Australia/Currie", "Asia/Chita", "Antarctica/Macquarie",
  "Asia/Sakhalin", "Pacific/Auckland", "Etc/GMT-12", "Pacific/Fiji",
  "Asia/Anadyr", "Asia/Kamchatka", "Etc/GMT-13", "Pacific/Apia"
];

// Priority timezones for business use (will test these first)
const PRIORITY_TIMEZONES = [
  "America/Chicago",      // Central Time (US)
  "America/Detroit",      // Eastern Time (US)
  "America/Boise",        // Mountain Time (US)
  "America/Anchorage",    // Alaska Time (US)
  "Europe/Belgrade",      // Central European Time
  "Europe/Helsinki",      // Eastern European Time
  "Asia/Dubai",           // Gulf Standard Time
  "Asia/Hong_Kong",       // Hong Kong Time
  "Asia/Tokyo",           // Japan Standard Time (if available)
  "Australia/Melbourne",  // Australian Eastern Time
  "Pacific/Auckland",     // New Zealand Time
  "Africa/Cairo",         // Egypt Time
  "America/Sao_Paulo",    // Brazil Time
];

// Additional strategic timezones to test
const STRATEGIC_TIMEZONES = [
  "Europe/Bucharest",     // Eastern European Time
  "Europe/Istanbul",      // Turkey Time
  "Europe/Kaliningrad",   // Kaliningrad Time
  "Asia/Kolkata",         // India Standard Time
  "Asia/Karachi",         // Pakistan Standard Time
  "Asia/Tehran",          // Iran Standard Time
  "Asia/Baghdad",         // Arabia Standard Time
  "Asia/Yekaterinburg",   // Yekaterinburg Time
  "Australia/Perth",      // Australian Western Time
  "Australia/Darwin",     // Australian Central Time
  "America/Bogota",       // Colombia Time
  "America/Caracas",      // Venezuela Time
  "Atlantic/Cape_Verde",  // Cape Verde Time
  "Africa/Casablanca",    // Morocco Time
];

// Test results storage
const testResults = {
  working: [],
  failed: [],
  errors: [],
  summary: {}
};

/**
 * Test a single timezone by creating a minimal campaign
 */
async function testTimezone(timezone, testEmail = 'brandon@topoffunnel.co') {
  const testPayload = {
    name: `Timezone Test - ${timezone} - ${Date.now()}`,
    campaign_schedule: {
      schedules: [{
        name: 'Test Schedule',
        timing: {
          from: '09:00',
          to: '17:00'
        },
        days: {
          "0": false, // Sunday
          "1": true,  // Monday
          "2": true,  // Tuesday
          "3": true,  // Wednesday
          "4": true,  // Thursday
          "5": true,  // Friday
          "6": false  // Saturday
        },
        timezone: timezone
      }]
    },
    email_list: [testEmail],
    daily_limit: 30,
    open_tracking: false,
    link_tracking: false,
    stop_on_reply: true,
    email_gap: 10,
    sequences: [{
      steps: [{
        type: 'email',
        delay: 0,
        variants: [{
          subject: 'Timezone Test',
          body: '<p>This is a timezone validation test.</p>'
        }]
      }]
    }]
  };

  try {
    console.log(`Testing timezone: ${timezone}`);
    
    const response = await fetch(`${API_BASE_URL}/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(testPayload)
    });

    const responseText = await response.text();
    
    if (response.ok) {
      const result = JSON.parse(responseText);
      console.log(`✅ ${timezone} - SUCCESS (Campaign ID: ${result.id})`);
      
      testResults.working.push({
        timezone,
        campaignId: result.id,
        status: 'success'
      });
      
      // Clean up - delete the test campaign
      try {
        await fetch(`${API_BASE_URL}/campaigns/${result.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${API_KEY}`
          }
        });
        console.log(`🗑️  Cleaned up test campaign ${result.id}`);
      } catch (cleanupError) {
        console.log(`⚠️  Could not clean up campaign ${result.id}: ${cleanupError.message}`);
      }
      
      return { success: true, timezone, campaignId: result.id };
    } else {
      console.log(`❌ ${timezone} - FAILED (${response.status}): ${responseText}`);
      
      testResults.failed.push({
        timezone,
        status: response.status,
        error: responseText,
        reason: 'API rejection'
      });
      
      return { success: false, timezone, status: response.status, error: responseText };
    }
  } catch (error) {
    console.log(`💥 ${timezone} - ERROR: ${error.message}`);
    
    testResults.errors.push({
      timezone,
      error: error.message,
      reason: 'Network/parsing error'
    });
    
    return { success: false, timezone, error: error.message };
  }
}

/**
 * Add delay between requests to avoid rate limiting
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main testing function
 */
async function runTimezoneTests(priorityOnly = false) {
  console.log('🚀 Starting Timezone Validation Tests for Instantly.ai API');

  if (priorityOnly) {
    console.log(`⭐ Testing ${PRIORITY_TIMEZONES.length} priority business-critical timezones only\n`);
  } else {
    console.log(`📊 Testing ${ALL_TIMEZONES.length} timezones total`);
    console.log(`⭐ Priority testing ${PRIORITY_TIMEZONES.length} business-critical timezones first\n`);
  }

  const startTime = Date.now();

  // Test priority timezones first
  console.log('=== PRIORITY TIMEZONE TESTING ===');
  for (const timezone of PRIORITY_TIMEZONES) {
    await testTimezone(timezone);
    await delay(3000); // 3 second delay between requests to be safe
  }

  if (!priorityOnly) {
    console.log('\n=== COMPREHENSIVE TIMEZONE TESTING ===');
    // Test remaining timezones
    const remainingTimezones = ALL_TIMEZONES.filter(tz => !PRIORITY_TIMEZONES.includes(tz));

    for (const timezone of remainingTimezones) {
      await testTimezone(timezone);
      await delay(3000); // 3 second delay between requests to be safe
    }
  }

  // Generate summary
  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);
  const totalTested = priorityOnly ? PRIORITY_TIMEZONES.length : ALL_TIMEZONES.length;

  testResults.summary = {
    totalTested: totalTested,
    working: testResults.working.length,
    failed: testResults.failed.length,
    errors: testResults.errors.length,
    successRate: Math.round((testResults.working.length / totalTested) * 100),
    durationSeconds: duration,
    timestamp: new Date().toISOString(),
    priorityOnly: priorityOnly
  };

  // Save results to file
  const resultsPath = path.join(process.cwd(), 'timezone-test-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
  
  console.log('\n=== TEST RESULTS SUMMARY ===');
  console.log(`✅ Working timezones: ${testResults.working.length}`);
  console.log(`❌ Failed timezones: ${testResults.failed.length}`);
  console.log(`💥 Error timezones: ${testResults.errors.length}`);
  console.log(`📈 Success rate: ${testResults.summary.successRate}%`);
  console.log(`⏱️  Total duration: ${duration} seconds`);
  console.log(`💾 Results saved to: ${resultsPath}`);
  
  // Display working timezones
  if (testResults.working.length > 0) {
    console.log('\n=== VERIFIED WORKING TIMEZONES ===');
    testResults.working.forEach(result => {
      console.log(`✅ ${result.timezone}`);
    });
  }
  
  return testResults;
}

// Run the tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Check if --priority-only flag is passed
  const priorityOnly = process.argv.includes('--priority-only');

  runTimezoneTests(priorityOnly)
    .then(() => {
      console.log('\n🎉 Timezone validation testing completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Testing failed:', error);
      process.exit(1);
    });
}

export { runTimezoneTests, testTimezone, ALL_TIMEZONES, PRIORITY_TIMEZONES, STRATEGIC_TIMEZONES };
