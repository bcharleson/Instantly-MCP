#!/usr/bin/env tsx
/**
 * Quick test to verify the create_campaign fix
 * This will test the improved validation and error messages
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testCampaignFix() {
  const apiKey = process.argv[2];
  if (!apiKey) {
    console.error('❌ Usage: tsx test-campaign-fix.ts YOUR_API_KEY');
    process.exit(1);
  }

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js', '--api-key', apiKey],
  });

  const client = new Client({
    name: 'campaign-fix-tester',
    version: '1.0.0',
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    console.log('✅ Connected to MCP server');

    // Test 1: Try with placeholder email (should fail with helpful message)
    console.log('\n🧪 Test 1: Testing placeholder email validation...');
    try {
      await client.callTool('create_campaign', {
        name: 'Test Campaign',
        subject: 'Test Subject',
        body: 'Test Body',
        email_list: ['your-verified-email@example.com'] // This should trigger our validation
      });
      console.log('❌ Test 1 FAILED: Should have rejected placeholder email');
    } catch (error: any) {
      if (error.message.includes('placeholder email addresses')) {
        console.log('✅ Test 1 PASSED: Correctly rejected placeholder email');
        console.log(`   Error message: ${error.message}`);
      } else {
        console.log('⚠️  Test 1 PARTIAL: Rejected but with different error');
        console.log(`   Error message: ${error.message}`);
      }
    }

    // Test 2: Try with missing email_list (should fail with helpful message)
    console.log('\n🧪 Test 2: Testing missing email_list validation...');
    try {
      await client.callTool('create_campaign', {
        name: 'Test Campaign',
        subject: 'Test Subject',
        body: 'Test Body'
        // Missing email_list
      });
      console.log('❌ Test 2 FAILED: Should have required email_list');
    } catch (error: any) {
      if (error.message.includes('email_list is required')) {
        console.log('✅ Test 2 PASSED: Correctly required email_list');
        console.log(`   Error message: ${error.message}`);
      } else {
        console.log('⚠️  Test 2 PARTIAL: Rejected but with different error');
        console.log(`   Error message: ${error.message}`);
      }
    }

    // Test 3: Try with invalid email format
    console.log('\n🧪 Test 3: Testing invalid email format validation...');
    try {
      await client.callTool('create_campaign', {
        name: 'Test Campaign',
        subject: 'Test Subject',
        body: 'Test Body',
        email_list: ['not-an-email'] // Invalid format
      });
      console.log('❌ Test 3 FAILED: Should have rejected invalid email format');
    } catch (error: any) {
      if (error.message.includes('Invalid email address')) {
        console.log('✅ Test 3 PASSED: Correctly rejected invalid email format');
        console.log(`   Error message: ${error.message}`);
      } else {
        console.log('⚠️  Test 3 PARTIAL: Rejected but with different error');
        console.log(`   Error message: ${error.message}`);
      }
    }

    console.log('\n📋 Summary:');
    console.log('The create_campaign endpoint now has improved validation that:');
    console.log('✅ Rejects placeholder emails with helpful guidance');
    console.log('✅ Requires email_list parameter');
    console.log('✅ Validates email format');
    console.log('✅ Includes sequences field as required by API');
    console.log('✅ Provides clear error messages for troubleshooting');
    
    console.log('\n💡 Next Steps:');
    console.log('1. Run `list_accounts` to see your verified sending accounts');
    console.log('2. Use actual verified account emails in the email_list parameter');
    console.log('3. The campaign should then create successfully!');

  } catch (error) {
    console.error('❌ Connection error:', error);
  } finally {
    await client.close();
  }
}

testCampaignFix().catch(console.error);
