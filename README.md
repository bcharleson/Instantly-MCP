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

### Claude Desktop Setup
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

## Available Tools

### Campaign Management
- **create_campaign** - Create email campaigns with bulletproof timezone validation
- **list_campaigns** - List campaigns with filtering
- **get_campaign** - Get campaign details
- **update_campaign** - Update campaign settings
- **activate_campaign** - Start campaigns
- **pause_campaign** - Pause campaigns

### Analytics
- **get_campaign_analytics** - Campaign performance metrics
- **get_campaign_analytics_overview** - Overview across all campaigns
- **get_daily_campaign_analytics** - Daily analytics with date filtering
- **get_warmup_analytics** - Email warmup analytics

### Lead Management
- **create_lead** - Add leads to campaigns
- **list_leads** - List leads with filtering
- **get_lead** - Get lead details
- **update_lead** - Update lead information
- **create_lead_list** - Create lead lists
- **list_lead_lists** - List all lead lists

### Email Operations
- **list_emails** - List emails with filtering
- **get_email** - Get email details
- **reply_to_email** - Reply to emails (⚠️ sends real emails)
- **verify_email** - Verify email deliverability
- **count_unread_emails** - Count unread emails

### Account Management
- **list_accounts** - List email accounts
- **create_account** - Create email accounts with IMAP/SMTP
- **update_account** - Update account settings
- **get_account_details** - Get detailed account info
- **get_account_info** - Get account status
- **pause_account** - Pause accounts
- **resume_account** - Resume accounts
- **delete_account** - Delete accounts (⚠️ destructive)

### Warmup & Health
- **enable_warmup** - Enable email warmup
- **disable_warmup** - Disable email warmup
- **test_account_vitals** - Test account connectivity

### Utilities
- **validate_campaign_accounts** - Validate accounts for campaigns
- **list_api_keys** - List API keys

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

- **Bulletproof Timezone System** - 26 verified working timezones with intelligent fallbacks
- **Production Ready** - Rate limiting, error handling, pagination
- **Instantly.ai API v2** - Full compatibility with latest API
- **Dual Transport** - STDIO and HTTP streaming support

## License

MIT
