#!/usr/bin/env tsx
/**
 * Diagnostic script to check campaign creation error
 * This will help identify why the campaign creation is failing
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function diagnoseCampaignError() {
  const apiKey = process.argv[2];
  if (!apiKey) {
    console.error('❌ Usage: tsx diagnose-campaign-error.ts YOUR_API_KEY');
    console.error('   Get your API key from: https://app.instantly.ai/app/settings/integrations');
    process.exit(1);
  }

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['instantly-mcp@latest', '--api-key', apiKey],
  });

  const client = new Client({
    name: 'campaign-diagnostics',
    version: '1.0.0',
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    console.log('✅ Connected to Instantly MCP server');

    // Step 1: Check verified sending accounts
    console.log('\n🔍 Step 1: Checking your verified sending accounts...');
    try {
      const accountsResult = await client.callTool('list_accounts', { limit: 20 });
      const accounts = JSON.parse(accountsResult.content[0].text);
      
      console.log('📧 Your verified sending accounts:');
      if (accounts.items && accounts.items.length > 0) {
        accounts.items.forEach((account: any, index: number) => {
          console.log(`   ${index + 1}. ${account.email} (Status: ${account.status || 'Unknown'})`);
        });
        
        // Check if mike.curry@253paymentpros.com is in the list
        const targetEmail = 'mike.curry@253paymentpros.com';
        const isVerified = accounts.items.some((account: any) => 
          account.email.toLowerCase() === targetEmail.toLowerCase()
        );
        
        if (isVerified) {
          console.log(`✅ ${targetEmail} is verified and available for campaigns`);
        } else {
          console.log(`❌ ${targetEmail} is NOT found in your verified accounts`);
          console.log(`   You need to add and verify this email in your Instantly account first.`);
        }
      } else {
        console.log('❌ No verified sending accounts found!');
        console.log('   You need to add and verify sending accounts in your Instantly dashboard first.');
      }
    } catch (error: any) {
      console.error('❌ Error checking accounts:', error.message);
    }

    // Step 2: Test campaign creation with detailed logging
    console.log('\n🔍 Step 2: Testing campaign creation with your data...');
    const campaignData = {
      "name": "Test Campaign - Demo",
      "subject": "Test Email Subject Line", 
      "body": "Hi there,\n\nThis is a test email campaign created for demonstration purposes.\n\nThis email is part of a test campaign to verify that everything is working correctly with the Instantly platform.\n\nBest regards,\nMike Curry",
      "email_list": ["mike.curry@253paymentpros.com"]
    };

    try {
      console.log('📤 Attempting to create campaign with data:');
      console.log(JSON.stringify(campaignData, null, 2));
      
      const result = await client.callTool('create_campaign', campaignData);
      console.log('✅ Campaign created successfully!');
      console.log(JSON.stringify(result, null, 2));
    } catch (error: any) {
      console.error('❌ Campaign creation failed:', error.message);
      
      // Analyze the error
      if (error.message.includes('placeholder email')) {
        console.log('\n💡 Solution: Use a verified sending account from Step 1');
      } else if (error.message.includes('email_list')) {
        console.log('\n💡 Solution: Check that your email is verified in Instantly');
      } else if (error.message.includes('400')) {
        console.log('\n💡 This is likely due to the email not being verified in your Instantly account');
      }
    }

    // Step 3: Provide recommendations
    console.log('\n📋 Diagnostic Summary:');
    console.log('1. Check if mike.curry@253paymentpros.com is verified in your Instantly account');
    console.log('2. If not verified, add it in: https://app.instantly.ai/app/accounts');
    console.log('3. Wait for verification to complete (can take a few minutes)');
    console.log('4. Use one of your verified accounts from Step 1 instead');
    console.log('5. Make sure the account has proper SMTP/sending permissions');

  } catch (error) {
    console.error('❌ Connection error:', error);
  } finally {
    await client.close();
  }
}

diagnoseCampaignError().catch(console.error);
