# Instantly MCP Server

A Model Context Protocol (MCP) server for Instantly.ai email campaign management.

## Quick Start

### Installation
```bash
npm install
npm run build
```

### Configuration
```bash
export INSTANTLY_API_KEY="your-api-key-here"
npm start
```

Server available at: `http://localhost:3000/mcp`

### Claude Desktop Setup (Local)
```json
{
  "mcpServers": {
    "instantly": {
      "command": "node",
      "args": ["/path/to/instantly-mcp/dist/index.js"],
      "env": {
        "INSTANTLY_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Remote HTTP Endpoint

### Production Endpoint
**URL**: `https://mcp.instantly.ai/mcp`

### Authentication Methods

#### 1. URL-based Authentication
```
https://mcp.instantly.ai/mcp/YOUR_API_KEY
```

#### 2. Header Authentication
```
URL: https://mcp.instantly.ai/mcp
Header: Authorization: YOUR_API_KEY
```
*Note: Bearer token prefix is not required*

### Usage with MCP Clients
Configure your MCP client to use the remote endpoint:

```json
{
  "mcpServers": {
    "instantly": {
      "url": "https://mcp.instantly.ai/mcp",
      "headers": {
        "Authorization": "your-api-key-here"
      }
    }
  }
}
```

## Available Tools (36 Total)

### Campaign Management (6 tools)
- **create_campaign** - Create email campaigns with bulletproof timezone validation
- **list_campaigns** - List campaigns with filtering
- **get_campaign** - Get campaign details
- **update_campaign** - Update campaign settings
- **activate_campaign** - Start campaigns
- **pause_campaign** - Pause campaigns

### Analytics (4 tools)
- **get_campaign_analytics** - Campaign performance metrics
- **get_daily_campaign_analytics** - Daily analytics with date filtering
- **get_warmup_analytics** - Email warmup analytics
- **test_account_vitals** - Test account connectivity

### Lead Management (8 tools)
- **create_lead** - Add leads to campaigns
- **list_leads** - List leads with filtering
- **get_lead** - Get lead details
- **update_lead** - Update lead information
- **delete_lead** - Delete leads (⚠️ destructive)
- **create_lead_list** - Create lead lists
- **list_lead_lists** - List all lead lists
- **update_lead_list** - Update lead list settings
- **get_verification_stats_for_lead_list** - Get email verification stats for a lead list
- **add_leads_to_campaign_or_list_bulk** - Bulk add leads to campaigns or lists
- **move_leads_to_campaign_or_list** - Move leads between campaigns or lists

### Email Operations (5 tools)
- **list_emails** - List emails with filtering
- **get_email** - Get email details
- **reply_to_email** - Reply to emails (⚠️ sends real emails)
- **verify_email** - Verify email deliverability
- **count_unread_emails** - Count unread emails

### Account Management (11 tools)
- **list_accounts** - List email accounts
- **create_account** - Create email accounts with IMAP/SMTP
- **update_account** - Update account settings
- **get_account_details** - Get detailed account info
- **get_account_info** - Get account status
- **pause_account** - Pause accounts
- **resume_account** - Resume accounts
- **delete_account** - Delete accounts (⚠️ destructive)
- **enable_warmup** - Enable email warmup
- **disable_warmup** - Disable email warmup
- **test_account_vitals** - Test account connectivity

## Authentication

### Environment Variable
```bash
export INSTANTLY_API_KEY="your-key"
```

### URL Authentication
```
https://server.com/mcp/your-key
```

### Header Authentication
```
Authorization: Bearer your-key
```

## Features

- **Streamable HTTP Transport** - Remote MCP server at `https://mcp.instantly.ai/mcp`
- **Bulletproof Timezone System** - 26 verified working timezones with intelligent fallbacks
- **Production Ready** - Rate limiting, error handling, pagination
- **Instantly.ai API v2** - Full compatibility with latest API
- **Dual Authentication** - URL-based and header-based API key authentication
- **Dual Transport** - STDIO and HTTP streaming support

## License

MIT
