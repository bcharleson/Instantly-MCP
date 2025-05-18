#!/usr/bin/env tsx
/**
 * Example: Create a new campaign
 * Usage: tsx examples/create-campaign.ts --api-key YOUR_API_KEY
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const args = process.argv.slice(2);
  const apiKeyIndex = args.findIndex(arg => arg === '--api-key');
  const apiKey = apiKeyIndex !== -1 && args[apiKeyIndex + 1] ? args[apiKeyIndex + 1] : null;

  if (!apiKey) {
    console.error('Error: Please provide API key using --api-key argument');
    process.exit(1);
  }

  // Create the transport
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js', '--api-key', apiKey],
  });

  // Create the client
  const client = new Client({
    name: 'example-campaign-client',
    version: '1.0.0',
  }, {
    capabilities: {}
  });

  try {
    // Connect to the server
    await client.connect(transport);
    console.log('Connected to Instantly MCP server');

    // Create a new campaign
    const campaign = await client.callTool('create_campaign', {
      name: 'Summer Sale 2024',
      from_email: 'sales@example.com',
      from_name: 'Example Sales Team',
      subject: 'Exclusive Summer Sale - 50% Off!',
      body: `Hi {{first_name}},

We're excited to announce our biggest sale of the year!

For a limited time, enjoy 50% off on all products.

Best regards,
The Sales Team`
    });

    console.log('\nCampaign created successfully:');
    console.log(JSON.stringify(campaign, null, 2));

    // Get campaign analytics
    const analytics = await client.callTool('get_campaign_analytics', {
      campaign_id: campaign.id,
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0]
    });

    console.log('\nCampaign analytics:');
    console.log(JSON.stringify(analytics, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

main().catch(console.error);