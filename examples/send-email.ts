#!/usr/bin/env tsx
/**
 * Example: Send a single email
 * Usage: tsx examples/send-email.ts --api-key YOUR_API_KEY
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
    name: 'example-send-email-client',
    version: '1.0.0',
  }, {
    capabilities: {}
  });

  try {
    // Connect to the server
    await client.connect(transport);
    console.log('Connected to Instantly MCP server');

    // Send an email
    const result = await client.callTool('send_email', {
      to: 'recipient@example.com',
      from: 'sender@yourdomain.com',
      subject: 'Test Email from Instantly MCP',
      body: 'This is a test email sent via the Instantly MCP server.',
      html: false
    });

    console.log('\nEmail sent successfully:');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

main().catch(console.error);