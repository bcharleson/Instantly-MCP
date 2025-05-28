#!/usr/bin/env tsx
/**
 * Complete Campaign Creation Wizard Test
 * 
 * This script tests the full wizard workflow:
 * 1. Check verified accounts
 * 2. Validate campaign information
 * 3. Create campaign with validated data
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testCompleteWizard() {
  const apiKey = process.argv[2];
  if (!apiKey) {
    console.error('❌ Usage: tsx test-complete-wizard.ts YOUR_API_KEY');
    console.error('   Get your API key from: https://app.instantly.ai/app/settings/integrations');
    process.exit(1);
  }

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['instantly-mcp@2.5.1', '--api-key', apiKey],
  });

  const client = new Client({
    name: 'wizard-complete-test',
    version: '1.0.0',
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    console.log('🎉 Connected to Instantly MCP server v2.5.1');
    console.log('🧙‍♂️ Testing Campaign Creation Wizard...\n');

    // ========================================
    // STEP 1: Check verified accounts
    // ========================================
    console.log('🔍 STEP 1: Checking verified sending accounts...');
    console.log('Command: campaign_creation_wizard {"step": "start"}');
    
    const step1Result = await client.callTool('campaign_creation_wizard', {
      step: 'start'
    });

    const step1Data = JSON.parse(step1Result.content[0].text);
    console.log('📧 Response:', JSON.stringify(step1Data, null, 2));

    if (step1Data.step === 'error') {
      console.error('\n❌ STEP 1 FAILED:', step1Data.message);
      console.error('   Action required:', step1Data.action_required);
      return;
    }

    if (!step1Data.verified_accounts || step1Data.verified_accounts.length === 0) {
      console.error('\n❌ No verified accounts found!');
      console.error('   Please add and verify sending accounts in your Instantly dashboard');
      console.error('   Go to: https://app.instantly.ai/app/accounts');
      return;
    }

    console.log('\n✅ STEP 1 SUCCESS: Found verified accounts');
    console.log('📋 Available accounts:');
    step1Data.verified_accounts.forEach((account: any) => {
      console.log(`   ${account.index}. ${account.email} (${account.status}, limit: ${account.daily_limit})`);
    });

    // ========================================
    // STEP 2: Validate campaign information
    // ========================================
    console.log('\n🔍 STEP 2: Providing campaign information...');
    
    const campaignInfo = {
      step: 'info_gathered',
      name: 'Wizard Test Campaign',
      subject: 'Testing the Campaign Creation Wizard',
      body: `Hi there!

This is a test email created using the new Campaign Creation Wizard in the Instantly MCP server v2.5.1.

The wizard ensures that:
✅ Only verified sending accounts are used
✅ All required information is validated
✅ No 400 Bad Request errors occur
✅ Clear guidance is provided at each step

This makes campaign creation much more reliable and user-friendly!

Best regards,
The Instantly MCP Team

P.S. This campaign was created safely using the guided workflow!`,
      selected_email: step1Data.verified_accounts[0].email, // Use first verified account
      
      // Optional configuration
      timezone: 'America/New_York',
      timing_from: '09:00',
      timing_to: '17:00',
      daily_limit: 25,
      email_gap_minutes: 15,
      open_tracking: true,
      link_tracking: true,
      stop_on_reply: true,
      send_weekdays: true,
      send_weekends: false
    };

    console.log('Command: campaign_creation_wizard', JSON.stringify(campaignInfo, null, 2));
    
    const step2Result = await client.callTool('campaign_creation_wizard', campaignInfo);
    const step2Data = JSON.parse(step2Result.content[0].text);

    console.log('\n📧 Response:', JSON.stringify(step2Data, null, 2));

    if (step2Data.step === 'error') {
      console.error('\n❌ STEP 2 FAILED:', step2Data.message);
      if (step2Data.missing_fields) {
        console.error('   Missing fields:', step2Data.missing_fields);
      }
      return;
    }

    console.log('\n✅ STEP 2 SUCCESS: Campaign information validated');
    console.log('📋 Configuration summary:');
    console.log(`   Name: ${step2Data.campaign_config.name}`);
    console.log(`   Subject: ${step2Data.campaign_config.subject}`);
    console.log(`   Sending from: ${step2Data.campaign_config.selected_email}`);
    console.log(`   Schedule: ${step2Data.campaign_config.timing_from}-${step2Data.campaign_config.timing_to} ${step2Data.campaign_config.timezone}`);
    console.log(`   Daily limit: ${step2Data.campaign_config.daily_limit}`);
    console.log(`   Tracking: Opens=${step2Data.campaign_config.open_tracking}, Links=${step2Data.campaign_config.link_tracking}`);

    // ========================================
    // STEP 3: Create the campaign
    // ========================================
    console.log('\n🔍 STEP 3: Creating the campaign...');
    
    const step3Info = {
      ...campaignInfo,
      step: 'create'
    };

    console.log('Command: campaign_creation_wizard', JSON.stringify(step3Info, null, 2));
    
    const step3Result = await client.callTool('campaign_creation_wizard', step3Info);
    const step3Data = JSON.parse(step3Result.content[0].text);

    console.log('\n📧 Response:', JSON.stringify(step3Data, null, 2));

    if (step3Data.step === 'error') {
      console.error('\n❌ STEP 3 FAILED:', step3Data.message);
      console.error('   Error details:', step3Data.error);
      if (step3Data.troubleshooting) {
        console.error('   Troubleshooting:');
        Object.entries(step3Data.troubleshooting).forEach(([key, value]) => {
          console.error(`     ${key}: ${value}`);
        });
      }
      return;
    }

    // ========================================
    // SUCCESS!
    // ========================================
    console.log('\n🎉 CAMPAIGN CREATION WIZARD TEST COMPLETED SUCCESSFULLY!');
    console.log('=====================================');
    console.log('📊 Campaign Details:');
    console.log(`   ID: ${step3Data.campaign.id}`);
    console.log(`   Name: ${step3Data.summary.name}`);
    console.log(`   Sending from: ${step3Data.summary.sending_from}`);
    console.log(`   Daily limit: ${step3Data.summary.daily_limit}`);
    console.log(`   Schedule: ${step3Data.summary.schedule}`);
    console.log(`   Tracking: Opens=${step3Data.summary.tracking.opens}, Links=${step3Data.summary.tracking.links}`);

    console.log('\n✨ WIZARD BENEFITS DEMONSTRATED:');
    console.log('   ✅ No 400 Bad Request errors');
    console.log('   ✅ Verified account validation');
    console.log('   ✅ Step-by-step guidance');
    console.log('   ✅ Configuration preview');
    console.log('   ✅ Clear error handling');
    console.log('   ✅ Successful campaign creation');

    console.log('\n🚀 NEXT STEPS:');
    console.log('   1. The campaign is created but not activated');
    console.log('   2. Use activate_campaign tool to start sending');
    console.log('   3. Monitor with get_campaign_analytics');
    console.log('   4. The wizard prevented all common errors!');

  } catch (error) {
    console.error('\n❌ UNEXPECTED ERROR:', error);
    console.error('   This might be a connection or API issue');
  } finally {
    await client.close();
  }
}

// Run the complete test
console.log('🧙‍♂️ Campaign Creation Wizard Complete Test');
console.log('==========================================');
testCompleteWizard().catch(console.error);
