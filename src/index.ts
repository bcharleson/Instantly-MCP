#!/usr/bin/env node

/**
 * Instantly MCP Server - Clean Implementation
 * 
 * Primary Mode (Default): stdio transport for Claude Desktop, Cursor IDE, NPM
 * n8n Mode (Optional): Simple HTTP transport for automation workflows
 * 
 * Usage:
 *   node dist/index.js           # stdio mode (default)
 *   node dist/index.js --n8n     # n8n HTTP mode
 * 
 * Environment Variables:
 *   INSTANTLY_API_KEY: Your Instantly.ai API key (required)
 *   PORT: HTTP server port for n8n mode (default: 3000)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { handleInstantlyError, parseInstantlyResponse } from './error-handler.js';
import { rateLimiter } from './rate-limiter.js';
import { buildInstantlyPaginationQuery, buildQueryParams, parsePaginatedResponse, paginateInstantlyAPI } from './pagination.js';
import {
  validateToolParameters,
  validateCampaignData,
  validateCampaignPrerequisiteData,
  validateGetCampaignAnalyticsData,
  validateWarmupAnalyticsData,
  validateEmailVerificationData,
  validateListAccountsData,
  validateListCampaignsData,
  isValidEmail
} from './validation.js';

const INSTANTLY_API_URL = 'https://api.instantly.ai/api/v2';

// API key configuration
let INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY;

if (!INSTANTLY_API_KEY) {
  const args = process.argv.slice(2);
  const apiKeyIndex = args.findIndex(arg => arg === '--api-key');
  INSTANTLY_API_KEY = apiKeyIndex !== -1 && args[apiKeyIndex + 1] ? args[apiKeyIndex + 1] : undefined;
}

if (!INSTANTLY_API_KEY) {
  console.error('Error: API key must be provided via INSTANTLY_API_KEY environment variable or --api-key argument');
  console.error('For security, using the environment variable is recommended:');
  console.error('  export INSTANTLY_API_KEY="your-api-key-here"');
  process.exit(1);
}

// Parse command line arguments
function parseConfig() {
  const args = process.argv.slice(2);
  const isN8nMode = args.includes('--n8n');
  return { isN8nMode };
}

// Core server implementation
const server = new Server(
  {
    name: 'instantly-mcp',
    version: '1.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

console.error('[Instantly MCP] 🚀 Initializing server...');
console.error('[Instantly MCP] 🔑 API key configured:', INSTANTLY_API_KEY ? '✅ Present' : '❌ Missing');

// Core API request function
async function makeInstantlyRequest(endpoint: string, options: any = {}): Promise<any> {
  const method = options.method || 'GET';
  
  const requestOptions: any = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${INSTANTLY_API_KEY}`,
    },
  };

  if (method !== 'GET' && options.body) {
    requestOptions.body = JSON.stringify(options.body);
  }

  // Add query parameters for GET requests
  if (method === 'GET' && options.params) {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      const separator = endpoint.includes('?') ? '&' : '?';
      endpoint = `${endpoint}${separator}${queryString}`;
    }
  }

  try {
    const response = await fetch(`${INSTANTLY_API_URL}${endpoint}`, requestOptions);

    // Update rate limit info from response headers
    rateLimiter.updateFromHeaders(response.headers);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return parseInstantlyResponse(data);
  } catch (error) {
    throw handleInstantlyError(error, 'makeInstantlyRequest');
  }
}

// FIXED: Simple, reliable pagination for list_accounts
async function getAllAccounts(): Promise<any[]> {
  console.error('[Instantly MCP] 📊 Retrieving all accounts with reliable pagination...');

  try {
    // Use direct API call with pagination
    const result = await paginateInstantlyAPI('/accounts', makeInstantlyRequest);

    console.error(`[Instantly MCP] ✅ Successfully retrieved ${result.length} accounts`);
    return result;
  } catch (error) {
    console.error('[Instantly MCP] ❌ Error retrieving accounts:', error);
    throw error;
  }
}

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error('[Instantly MCP] 📋 Listing available tools...');

  return {
    tools: [
      {
        name: 'list_accounts',
        description: 'List all email accounts with reliable pagination',
        inputSchema: {
          type: 'object',
          properties: {
            get_all: {
              type: 'boolean',
              description: 'Retrieve all accounts (recommended: true)',
              default: true
            }
          },
          additionalProperties: false
        }
      },
      {
        name: 'create_campaign',
        description: 'Create a new email campaign with comprehensive validation',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Campaign name' },
            from_email: { type: 'string', description: 'Sender email address' },
            subject: { type: 'string', description: 'Email subject line' },
            body: { type: 'string', description: 'Email body content' },
            track_opens: { type: 'boolean', description: 'Track email opens', default: true },
            track_clicks: { type: 'boolean', description: 'Track link clicks', default: true }
          },
          required: ['name', 'from_email', 'subject', 'body'],
          additionalProperties: false
        }
      },
      {
        name: 'list_campaigns',
        description: 'List campaigns with filtering and pagination',
        inputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string', description: 'Filter by campaign status' },
            get_all: { type: 'boolean', description: 'Retrieve all campaigns', default: true }
          },
          additionalProperties: false
        }
      },
      {
        name: 'get_campaign_analytics',
        description: 'Get detailed campaign performance analytics',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'string', description: 'Campaign ID' }
          },
          required: ['campaign_id'],
          additionalProperties: false
        }
      },
      {
        name: 'verify_email',
        description: 'Verify email addresses for deliverability',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', description: 'Email address to verify' }
          },
          required: ['email'],
          additionalProperties: false
        }
      }
    ]
  };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  console.error(`[Instantly MCP] 🔧 Tool called: ${name}`);

  try {
    // Check rate limit status
    if (rateLimiter.isRateLimited()) {
      throw new McpError(ErrorCode.InternalError, `Rate limited. ${rateLimiter.getRateLimitMessage()}`);
    }

    switch (name) {
      case 'list_accounts': {
        console.error('[Instantly MCP] 📊 Executing list_accounts...');

        const allAccounts = await getAllAccounts();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                data: allAccounts,
                total_retrieved: allAccounts.length,
                pagination_method: "reliable_complete",
                success: true
              }, null, 2)
            }
          ]
        };
      }

      case 'create_campaign': {
        console.error('[Instantly MCP] 🚀 Executing create_campaign...');

        // Validate required parameters
        const validatedData = validateCampaignData(args);

        const response = await makeInstantlyRequest('/campaigns', {
          method: 'POST',
          body: validatedData
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                campaign: response,
                message: 'Campaign created successfully'
              }, null, 2)
            }
          ]
        };
      }

      case 'list_campaigns': {
        console.error('[Instantly MCP] 📋 Executing list_campaigns...');

        const campaigns = await paginateInstantlyAPI('/campaigns', makeInstantlyRequest);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                data: campaigns,
                total_retrieved: campaigns.length,
                success: true
              }, null, 2)
            }
          ]
        };
      }

      case 'get_campaign_analytics': {
        console.error('[Instantly MCP] 📈 Executing get_campaign_analytics...');

        const validatedData = validateGetCampaignAnalyticsData(args);
        const analytics = await makeInstantlyRequest(`/campaigns/${validatedData.campaign_id}/analytics`);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                analytics: analytics
              }, null, 2)
            }
          ]
        };
      }

      case 'verify_email': {
        console.error('[Instantly MCP] ✉️ Executing verify_email...');

        const validatedData = validateEmailVerificationData(args);
        const verification = await makeInstantlyRequest('/email/verify', {
          method: 'POST',
          body: { email: validatedData.email }
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                verification: verification
              }, null, 2)
            }
          ]
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    
  } catch (error) {
    console.error(`[Instantly MCP] ❌ Tool execution error:`, error);
    
    if (error instanceof McpError) {
      throw error;
    }
    
    // Handle the error and re-throw as McpError
    try {
      handleInstantlyError(error, name);
    } catch (handledError: any) {
      throw new McpError(ErrorCode.InternalError, handledError.message || String(error));
    }
  }
});

// Main execution
async function main() {
  const { isN8nMode } = parseConfig();
  
  if (isN8nMode) {
    console.error('[Instantly MCP] 🌐 n8n mode will be implemented in Phase 2');
    console.error('[Instantly MCP] 🔌 Starting stdio mode for now...');
  }
  
  console.error('[Instantly MCP] 🔌 Starting stdio transport...');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[Instantly MCP] ✅ Server running with reliable pagination');
}

main().catch((error) => {
  console.error('[Instantly MCP] ❌ Fatal error:', error);
  process.exit(1);
});
