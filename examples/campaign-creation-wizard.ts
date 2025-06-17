#!/usr/bin/env tsx
/**
 * Campaign Creation Wizard Example
 * 
 * This example demonstrates the complete guided workflow for creating campaigns
 * that prevents 400 Bad Request errors by validating accounts and information first.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function campaignCreationWizardExample() {
  const apiKey = process.argv[2];
  if (!apiKey) {
    console.error('❌ Usage: tsx campaign-creation-wizard.ts YOUR_API_KEY');
    console.error('   Get your API key from: https://app.instantly.ai/app/settings/integrations');
    process.exit(1);
  }

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['instantly-mcp@latest', '--api-key', apiKey],
  });

  const client = new Client({
    name: 'campaign-wizard-example',
    version: '1.0.0',
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    console.log('✅ Connected to Instantly MCP server');

    // Step 1: Start the wizard to check verified accounts
    console.log('\n🔍 Step 1: Checking verified sending accounts...');
    const step1Result = await client.callTool('campaign_creation_wizard', {
      step: 'start'
    });

    const step1Data = JSON.parse(step1Result.content[0].text);
    console.log('📧 Verified accounts found:');
    
    if (step1Data.step === 'error') {
      console.error('❌ Error:', step1Data.message);
      console.error('   Action required:', step1Data.action_required);
      return;
    }

    // Display verified accounts
    step1Data.verified_accounts.forEach((account: any) => {
      console.log(`   ${account.index}. ${account.email} (${account.status}, limit: ${account.daily_limit})`);
    });

    // Step 2: Gather campaign information
    console.log('\n📝 Step 2: Providing campaign information...');
    const campaignInfo = {
      step: 'info_gathered',
      name: 'Demo Campaign - Wizard Test',
      subject: 'Welcome to Our Service!',
      body: `Hi there,

This is a test email campaign created using the Campaign Creation Wizard.

The wizard ensures that:
✅ Only verified sending accounts are used
✅ All required information is provided
✅ Configuration is validated before creation
✅ No 400 Bad Request errors occur

This makes campaign creation much more reliable!

Best regards,
The Instantly MCP Team`,
      selected_email: step1Data.verified_accounts[0].email, // Use first verified account
      
      // Optional configuration (showing some custom settings)
      timezone: 'America/New_York',
      timing_from: '09:00',
      timing_to: '17:00',
      daily_limit: 30,
      email_gap_minutes: 15,
      open_tracking: true,
      link_tracking: true,
      stop_on_reply: true,
      send_weekdays: true,
      send_weekends: false
    };

    const step2Result = await client.callTool('campaign_creation_wizard', campaignInfo);
    const step2Data = JSON.parse(step2Result.content[0].text);

    if (step2Data.step === 'error') {
      console.error('❌ Validation error:', step2Data.message);
      console.error('   Missing fields:', step2Data.missing_fields);
      return;
    }

    console.log('✅ Campaign information validated successfully!');
    console.log('📋 Configuration summary:');
    console.log(`   Name: ${step2Data.campaign_config.name}`);
    console.log(`   Subject: ${step2Data.campaign_config.subject}`);
    console.log(`   Sending from: ${step2Data.campaign_config.selected_email}`);
    console.log(`   Schedule: ${step2Data.campaign_config.timing_from}-${step2Data.campaign_config.timing_to} ${step2Data.campaign_config.timezone}`);
    console.log(`   Daily limit: ${step2Data.campaign_config.daily_limit}`);
    console.log(`   Tracking: Opens=${step2Data.campaign_config.open_tracking}, Links=${step2Data.campaign_config.link_tracking}`);

    // Step 3: Create the campaign
    console.log('\n🚀 Step 3: Creating the campaign...');
    const step3Result = await client.callTool('campaign_creation_wizard', {
      ...campaignInfo,
      step: 'create'
    });

    const step3Data = JSON.parse(step3Result.content[0].text);

    if (step3Data.step === 'error') {
      console.error('❌ Campaign creation failed:', step3Data.message);
      console.error('   Error details:', step3Data.error);
      console.error('   Troubleshooting:');
      Object.entries(step3Data.troubleshooting).forEach(([key, value]) => {
        console.error(`     ${key}: ${value}`);
      });
      return;
    }

    // Success!
    console.log('🎉 Campaign created successfully!');
    console.log('📊 Campaign details:');
    console.log(`   ID: ${step3Data.campaign.id}`);
    console.log(`   Name: ${step3Data.summary.name}`);
    console.log(`   Sending from: ${step3Data.summary.sending_from}`);
    console.log(`   Daily limit: ${step3Data.summary.daily_limit}`);
    console.log(`   Schedule: ${step3Data.summary.schedule}`);
    console.log(`   Tracking: Opens=${step3Data.summary.tracking.opens}, Links=${step3Data.summary.tracking.links}`);

    console.log('\n✨ Campaign Creation Wizard completed successfully!');
    console.log('   The campaign is now ready to be activated and start sending emails.');
    console.log('   Use the activate_campaign tool to start the campaign when ready.');

  } catch (error) {
    console.error('❌ Error during campaign creation:', error);
  } finally {
    await client.close();
  }
}

// Run the example
campaignCreationWizardExample().catch(console.error);
