# Instantly MCP Server

[![npm version](https://badge.fury.io/js/instantly-mcp.svg)](https://badge.fury.io/js/instantly-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MCP server for Instantly.ai v2 API - Manage email campaigns, accounts, leads, and analytics through Claude AI. Perfect for email automation and cold outreach campaigns.

## Overview

The Instantly MCP Server is a powerful integration that brings Instantly.ai's email automation capabilities directly into Claude and other AI assistants through the Model Context Protocol. This enables AI-powered management of:

- 📧 Email campaigns and sequences
- 👥 Account management and warmup
- 📊 Analytics and performance tracking
- 🎯 Lead management and segmentation
- ✉️ Email sending and verification
- 🔑 API key management

Perfect for sales teams, marketers, and developers who want to automate their cold outreach workflows using AI.

## Quick Start

### Using with npx (no installation required)

Add to your MCP settings configuration:

```json
{
  "mcpServers": {
    "instantly": {
      "command": "npx",
      "args": ["instantly-mcp", "--api-key", "YOUR_INSTANTLY_API_KEY"]
    }
  }
}
```

### Local Installation

1. Clone and install:
```bash
npm install
npm run build
```

2. Add to your MCP settings:
```json
{
  "mcpServers": {
    "instantly": {
      "command": "node",
      "args": ["/path/to/instantly-mcp/dist/index.js", "--api-key", "YOUR_INSTANTLY_API_KEY"]
    }
  }
}
```

## Getting Your API Key

1. Log in to [Instantly.ai](https://app.instantly.ai)
2. Navigate to Settings > Integrations > API
3. Generate or copy your API key

## Available Tools

### Campaign Management
- `campaign_creation_wizard` - **🧙‍♂️ NEW!** Guided campaign creation (recommended for all users)
- `list_campaigns` - List all campaigns with optional filters and pagination
- `get_campaign` - Get details of a specific campaign
- `create_campaign` - Create a new email campaign (advanced users only)
- `update_campaign` - Update an existing campaign
- `activate_campaign` - Activate a campaign

### Analytics
- `get_campaign_analytics` - Get analytics for campaigns
- `get_campaign_analytics_overview` - Get analytics overview for all campaigns

### Account Management
- `list_accounts` - List all sending accounts with pagination
- `create_account` - Create a new sending account
- `update_account` - Update a sending account
- `get_warmup_analytics` - Get warmup analytics for an account

### Lead Management
- `list_leads` - List leads with filters and pagination
- `create_lead` - Create a new lead
- `update_lead` - Update a lead
- `move_leads` - Move leads between campaigns or lists

### Lead Lists
- `list_lead_lists` - List all lead lists with pagination
- `create_lead_list` - Create a new lead list

### Email Operations
- `send_email` - Send a single email
- `list_emails` - List emails with filters and pagination

### Email Verification
- `verify_email` - Verify if an email address is valid

### API Key Management
- `list_api_keys` - List all API keys
- `create_api_key` - Create a new API key

## Campaign Creation Wizard 🧙‍♂️

**NEW in v2.5.0!** The Campaign Creation Wizard prevents 400 Bad Request errors by guiding you through a step-by-step process:

### Quick Start
```bash
# Step 1: Check your verified accounts
campaign_creation_wizard { "step": "start" }

# Step 2: Provide campaign info (using verified email from step 1)
campaign_creation_wizard {
  "step": "info_gathered",
  "name": "My Campaign",
  "subject": "Hello!",
  "body": "Email content...",
  "selected_email": "verified@yourdomain.com"
}

# Step 3: Create the campaign
campaign_creation_wizard { "step": "create", ... }
```

### Benefits
✅ **Prevents 400 errors** by validating accounts first
✅ **Step-by-step guidance** with clear instructions
✅ **Sensible defaults** for all optional settings
✅ **Configuration preview** before creation

See [CAMPAIGN_CREATION_WIZARD.md](CAMPAIGN_CREATION_WIZARD.md) for the complete guide.

## Example Usage

Once configured, you can use natural language to interact with Instantly:

- "Create a campaign using the wizard"
- "List all my active campaigns"
- "Show me the analytics for campaign XYZ"
- "List all my sending accounts"

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev -- --api-key YOUR_API_KEY

# Build for production
npm run build
```

## Testing

### Local Testing

1. **Test the API endpoints directly:**
```bash
# Install dependencies
npm install

# Run the test script
tsx test-endpoints.ts --api-key YOUR_API_KEY
```

2. **Test with MCP Inspector:**
```bash
# Build the project
npm run build

# Test with MCP Inspector
npx @modelcontextprotocol/inspector dist/index.js -- --api-key YOUR_API_KEY
```

3. **Test with Claude Desktop:**
Add to your Claude Desktop configuration:
```json
{
  "mcpServers": {
    "instantly": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js", "--api-key", "YOUR_API_KEY"]
    }
  }
}
```

### Endpoint Documentation

The MCP server includes all major Instantly v2 API endpoints:

- **Campaigns**: Create, list, update, activate campaigns
- **Analytics**: Get campaign analytics and overview
- **Accounts**: Manage sending accounts and warmup
- **Leads**: Create, list, update, move leads
- **Lead Lists**: Create and manage lead lists
- **Emails**: Send emails and list email history
- **Email Verification**: Verify email addresses
- **API Keys**: Manage API keys

For full API documentation, visit: https://developer.instantly.ai/

## License

MIT

## Features

- 🚀 Full Instantly v2 API coverage
- 📄 Pagination support for all list endpoints
- ⚡ Rate limiting with informative messages
- 🔧 Comprehensive error handling
- 📝 TypeScript support
- 🔐 Secure API key handling
- 📚 Example scripts included

## Recent Updates

### v2.0.13 (Latest)
- Fixed campaign creation with improved field structure
- Added timezone and days configuration for campaigns
- Enhanced debug logging for troubleshooting
- Fallback mechanism for different API structures

See [CHANGELOG.md](CHANGELOG.md) for complete version history.

## Known Issues

- Campaign creation may require specific account configuration
- Some endpoints return empty results despite data existing (working on fixes)
- Email sending requires verified sender accounts

## Contributing

Pull requests are welcome! Please ensure all tests pass and follow the existing code style.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

- **Issues**: [GitHub Issues](https://github.com/bcharleson/Instantly-MCP/issues)
- **Documentation**: [Instantly API Docs](https://developer.instantly.ai/)
- **MCP Protocol**: [Model Context Protocol](https://github.com/modelcontextprotocol)

## Publishing

This package is automatically published to npm when a new version tag is pushed:

```bash
npm version patch|minor|major
git push --tags
```

## Support

- For issues or questions, please open an issue on [GitHub](https://github.com/bcharleson/Instantly-MCP/issues)
- For Instantly API documentation, visit: https://developer.instantly.ai/

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes.

## Author

Created by [bcharleson](https://github.com/bcharleson)