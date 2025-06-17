#!/usr/bin/env node

/**
 * Simple test script for create_campaign functionality
 * Usage: node test-campaign.js YOUR_API_KEY
 */

const INSTANTLY_API_URL = 'https://api.instantly.ai/api/v2';

async function testCampaignCreation(apiKey) {
  console.log('🧪 Testing Campaign Creation...');
  
  // Test payload - exactly what you were trying
  const testPayload = {
    name: "Test Campaign Tool",
    subject: "Test Subject", 
    body: "This is a test email body.\n\nBest regards,\n{{firstName}}",
    email_list: ["brandon@onlinetopoffunnel.org"]
  };
  
  console.log('📝 Input payload:', JSON.stringify(testPayload, null, 2));
  
  // Simulate the MCP server's campaign construction logic
  const timezone = 'America/New_York';
  const daysConfig = {
    '1': true, // Monday
    '2': true, // Tuesday  
    '3': true, // Wednesday
    '4': true, // Thursday
    '5': true  // Friday
  };
  
  // Build the actual API payload (same logic as MCP server v3.1.3)
  let normalizedBody = testPayload.body.trim();
  let normalizedSubject = testPayload.subject.trim();
  
  // Convert line breaks to \\n literals
  if (normalizedBody.includes('\n')) {
    normalizedBody = normalizedBody.replace(/\n/g, '\\n');
    console.log('✅ Converted line breaks to \\n literals');
  }
  
  normalizedBody = normalizedBody.replace(/\r\n/g, '\\n').replace(/\r/g, '\\n');
  normalizedSubject = normalizedSubject.replace(/\n/g, '\\n').replace(/\r\n/g, '\\n').replace(/\r/g, '\\n');
  
  const campaignData = {
    name: testPayload.name,
    email_list: testPayload.email_list,
    // Essential settings with defaults
    daily_limit: 50,
    email_gap: 10,
    // Tracking defaults  
    link_tracking: false,
    open_tracking: false,
    // Behavior defaults
    stop_on_reply: true,
    stop_on_auto_reply: true,
    text_only: false,
    // Required schedule structure
    campaign_schedule: {
      schedules: [{
        name: 'Default Schedule',
        timing: {
          from: '09:00',
          to: '17:00'
        },
        days: daysConfig,
        timezone: timezone
      }]
    },
    // Sequences array
    sequences: [{
      steps: [{
        type: 'email',
        delay: 0,
        variants: [{
          subject: normalizedSubject,
          body: normalizedBody,
          v_disabled: false
        }]
      }]
    }]
  };
  
  console.log('🚀 Final API payload:');
  console.log(JSON.stringify(campaignData, null, 2));
  console.log(`📊 Payload size: ${JSON.stringify(campaignData).length} characters`);
  
  // Test the actual API call
  try {
    const response = await fetch(`${INSTANTLY_API_URL}/campaigns`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(campaignData)
    });
    
    console.log(`🌐 Response status: ${response.status} ${response.statusText}`);
    
    if (response.status === 400) {
      const errorText = await response.text();
      console.log('❌ 400 Error response:', errorText);
      
      try {
        const errorData = JSON.parse(errorText);
        console.log('📋 Parsed error details:', JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.log('⚠️ Could not parse error as JSON');
      }
    } else if (response.ok) {
      const result = await response.json();
      console.log('✅ SUCCESS! Campaign created:', JSON.stringify(result, null, 2));
    } else {
      const errorText = await response.text();
      console.log(`❌ Unexpected error (${response.status}):`, errorText);
    }
    
  } catch (error) {
    console.error('💥 Network error:', error.message);
  }
}

// Run the test
const apiKey = process.argv[2];
if (!apiKey) {
  console.error('❌ Usage: node test-campaign.js YOUR_API_KEY');
  process.exit(1);
}

testCampaignCreation(apiKey).catch(console.error);