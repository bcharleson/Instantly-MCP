#!/usr/bin/env tsx
/**
 * Example: Manage leads - create, list, and update
 * Usage: tsx examples/manage-leads.ts --api-key YOUR_API_KEY
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
    name: 'example-leads-client',
    version: '1.0.0',
  }, {
    capabilities: {}
  });

  try {
    // Connect to the server
    await client.connect(transport);
    console.log('Connected to Instantly MCP server');

    // Create a new lead
    const newLead = await client.callTool('create_lead', {
      email: 'john.doe@example.com',
      first_name: 'John',
      last_name: 'Doe',
      company: 'Example Corp',
      custom_fields: {
        industry: 'Technology',
        role: 'CTO',
        source: 'LinkedIn'
      }
    });

    console.log('\nLead created:');
    console.log(JSON.stringify(newLead, null, 2));

    // List leads
    const leads = await client.callTool('list_leads', {
      limit: 5,
      skip: 0
    });

    console.log('\nAll leads:');
    console.log(JSON.stringify(leads, null, 2));

    // Update the lead
    if (newLead.id) {
      const updatedLead = await client.callTool('update_lead', {
        lead_id: newLead.id,
        company: 'Example Corp (Updated)',
        custom_fields: {
          industry: 'Technology',
          role: 'CTO',
          source: 'LinkedIn',
          status: 'Qualified'
        }
      });

      console.log('\nLead updated:');
      console.log(JSON.stringify(updatedLead, null, 2));
    }

    // Create a lead list
    const leadList = await client.callTool('create_lead_list', {
      name: 'Tech CTOs',
      description: 'Chief Technology Officers in the tech industry'
    });

    console.log('\nLead list created:');
    console.log(JSON.stringify(leadList, null, 2));

    // Move leads to the list
    if (newLead.id && leadList.id) {
      const moveResult = await client.callTool('move_leads', {
        lead_ids: [newLead.id],
        to_list_id: leadList.id
      });

      console.log('\nLead moved to list:');
      console.log(JSON.stringify(moveResult, null, 2));
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

main().catch(console.error);