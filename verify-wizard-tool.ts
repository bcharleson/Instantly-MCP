#!/usr/bin/env tsx
/**
 * Verify Campaign Creation Wizard Tool Registration
 * 
 * This script checks that the campaign_creation_wizard tool is properly
 * registered in the MCP server's tools list.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function verifyWizardTool() {
  const apiKey = process.argv[2];
  if (!apiKey) {
    console.error('❌ Usage: tsx verify-wizard-tool.ts YOUR_API_KEY');
    console.error('   Get your API key from: https://app.instantly.ai/app/settings/integrations');
    process.exit(1);
  }

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['instantly-mcp@2.5.1', '--api-key', apiKey],
  });

  const client = new Client({
    name: 'wizard-tool-verifier',
    version: '1.0.0',
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    console.log('✅ Connected to Instantly MCP server v2.5.1');

    // List all available tools
    console.log('\n🔍 Checking available tools...');
    const toolsResult = await client.listTools();
    
    console.log(`📋 Found ${toolsResult.tools.length} total tools`);
    
    // Look for campaign-related tools
    const campaignTools = toolsResult.tools.filter(tool => 
      tool.name.includes('campaign')
    );
    
    console.log('\n🎯 Campaign-related tools:');
    campaignTools.forEach(tool => {
      console.log(`   • ${tool.name}: ${tool.description}`);
    });
    
    // Specifically check for the wizard
    const wizardTool = toolsResult.tools.find(tool => 
      tool.name === 'campaign_creation_wizard'
    );
    
    if (wizardTool) {
      console.log('\n🧙‍♂️ ✅ WIZARD TOOL FOUND!');
      console.log('📋 Tool Details:');
      console.log(`   Name: ${wizardTool.name}`);
      console.log(`   Description: ${wizardTool.description}`);
      
      // Check input schema
      if (wizardTool.inputSchema && wizardTool.inputSchema.properties) {
        const props = wizardTool.inputSchema.properties;
        console.log('   Parameters:');
        Object.keys(props).forEach(prop => {
          console.log(`     • ${prop}: ${props[prop].description || 'No description'}`);
        });
      }
      
      console.log('\n🎉 VERIFICATION SUCCESSFUL!');
      console.log('   The campaign_creation_wizard tool is properly registered');
      console.log('   and ready for use in the MCP server.');
      
    } else {
      console.log('\n❌ WIZARD TOOL NOT FOUND!');
      console.log('   The campaign_creation_wizard tool is missing from the tools list.');
      console.log('   This indicates a registration issue.');
    }
    
    // Test basic wizard functionality
    console.log('\n🧪 Testing basic wizard functionality...');
    try {
      const testResult = await client.callTool('campaign_creation_wizard', {
        step: 'start'
      });
      
      const testData = JSON.parse(testResult.content[0].text);
      
      if (testData.step === 'accounts_checked' || testData.step === 'error') {
        console.log('✅ Wizard responds correctly to step="start"');
        if (testData.step === 'error') {
          console.log(`   Note: ${testData.message}`);
        }
      } else {
        console.log('⚠️  Wizard response format unexpected');
      }
      
    } catch (error: any) {
      console.log('❌ Wizard tool call failed:', error.message);
    }

  } catch (error) {
    console.error('❌ Connection error:', error);
  } finally {
    await client.close();
  }
}

console.log('🔍 Campaign Creation Wizard Tool Verification');
console.log('============================================');
verifyWizardTool().catch(console.error);
