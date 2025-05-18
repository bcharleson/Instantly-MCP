# Instantly MCP Examples

This directory contains example scripts demonstrating how to use the Instantly MCP server.

## Prerequisites

1. Build the project first:
```bash
cd ..
npm install
npm run build
```

2. Get your Instantly API key from: https://app.instantly.ai/app/settings/integrations/api

## Running Examples

### 1. List Campaigns
Lists all active campaigns:
```bash
tsx list-campaigns.ts --api-key YOUR_API_KEY
```

### 2. Create Campaign
Creates a new email campaign:
```bash
tsx create-campaign.ts --api-key YOUR_API_KEY
```

### 3. Send Email
Sends a single email:
```bash
tsx send-email.ts --api-key YOUR_API_KEY
```

### 4. Manage Leads
Creates, lists, updates leads and manages lead lists:
```bash
tsx manage-leads.ts --api-key YOUR_API_KEY
```

## MCP Configuration

See `simple-mcp-config.json` for example MCP configuration that can be used with:
- Claude Desktop
- Other MCP-compatible clients

## Notes

- Replace `YOUR_API_KEY` with your actual Instantly API key
- These examples use the MCP SDK client to communicate with the server
- Make sure the server is built (`npm run build`) before running examples
- Check the Instantly API documentation for more details on available endpoints