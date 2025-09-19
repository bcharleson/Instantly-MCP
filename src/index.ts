#!/usr/bin/env node

/**
 * Instantly MCP Server - Official Multi-Transport Implementation
 *
 * Supports both local and remote usage:
 * - Stdio Transport: For Claude Desktop, Cursor IDE, local NPM usage
 * - Streaming HTTP Transport: For remote hosting at https://mcp.instantly.ai/mcp
 *
 * Usage:
 *   node dist/index.js                    # stdio mode (default)
 *   TRANSPORT_MODE=http node dist/index.js # HTTP mode for mcp.instantly.ai
 *
 * Environment Variables:
 *   INSTANTLY_API_KEY: Your Instantly.ai API key (required for stdio mode)
 *   TRANSPORT_MODE: 'stdio' (default) or 'http'
 *   PORT: HTTP server port (default: 3000)
 *   NODE_ENV: 'production' for mcp.instantly.ai deployment
 *
 * Authentication Methods (HTTP mode):
 *   1. Header-based (more secure): mcp.instantly.ai/mcp
 *      - Authorization: Bearer [API_KEY]
 *      - x-instantly-api-key: [API_KEY]
 *   2. URL-based: mcp.instantly.ai/mcp/{API_KEY}
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { TransportManager, TransportConfig } from './transport-manager.js';
import { StreamingHttpTransport, StreamingHttpConfig } from './streaming-http-transport.js';

// Ensure fetch is available (Node.js 18+ has it built-in)
if (typeof fetch === 'undefined') {
  console.error('[Instantly MCP] ❌ fetch is not available. Please use Node.js 18+ or install a fetch polyfill.');
  process.exit(1);
}
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
  validateGetCampaignAnalyticsOverviewData,
  validateWarmupAnalyticsData,
  validateEmailVerificationData,
  validateListAccountsData,
  validateListCampaignsData,
  validateUpdateAccountData,
  validateCampaignAccountsData,
  validateGetAccountDetailsData,
  validateGetEmailData,
  validateReplyToEmailData,
  validateCreateLeadData,
  validateUpdateLeadData,
  validateCreateLeadListData,
  validateGetCampaignData,
  validateUpdateCampaignData,
  isValidEmail
} from './validation.js';

const INSTANTLY_API_URL = 'https://api.instantly.ai';

// Parse command line arguments and environment
function parseConfig() {
  const args = process.argv.slice(2);
  const isN8nMode = args.includes('--n8n'); // Legacy support
  const transportMode = TransportManager.detectTransportMode();

  return {
    isN8nMode, // Keep for backward compatibility
    transportMode,
    isHttpMode: transportMode === 'http' || isN8nMode
  };
}

// API key configuration
let INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY;

if (!INSTANTLY_API_KEY) {
  const args = process.argv.slice(2);
  const apiKeyIndex = args.findIndex(arg => arg === '--api-key');
  INSTANTLY_API_KEY = apiKeyIndex !== -1 && args[apiKeyIndex + 1] ? args[apiKeyIndex + 1] : undefined;
}

// Check if we need an API key at startup
const { transportMode } = parseConfig();

if (!INSTANTLY_API_KEY && transportMode === 'stdio') {
  console.error('Error: API key must be provided via INSTANTLY_API_KEY environment variable or --api-key argument for stdio mode');
  console.error('For security, using the environment variable is recommended:');
  console.error('  export INSTANTLY_API_KEY="your-api-key-here"');
  process.exit(1);
}

if (!INSTANTLY_API_KEY && transportMode === 'http') {
  console.error('[Instantly MCP] ⚠️  No API key provided at startup - using per-request API key mode');
  console.error('[Instantly MCP] 🔑 Clients must provide API key via x-instantly-api-key header');
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

// Core API request function - now supports per-request API keys
async function makeInstantlyRequest(endpoint: string, options: any = {}, apiKey?: string): Promise<any> {
  const method = options.method || 'GET';
  
  // Use provided API key or fall back to environment variable
  const useApiKey = apiKey || INSTANTLY_API_KEY;
  
  if (!useApiKey) {
    throw new Error('Instantly API key is required - provide via parameter or INSTANTLY_API_KEY environment variable');
  }
  
  const requestOptions: any = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${useApiKey}`,
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
    console.error(`[Instantly MCP] 🔍 DEBUG: About to fetch ${INSTANTLY_API_URL}${endpoint}`);
    const response = await fetch(`${INSTANTLY_API_URL}${endpoint}`, requestOptions);
    console.error(`[Instantly MCP] 🔍 DEBUG: Fetch completed, response status: ${response.status}`);
    console.error(`[Instantly MCP] 🔍 DEBUG: Response headers type: ${typeof response.headers}`);
    console.error(`[Instantly MCP] 🔍 DEBUG: Response headers has get method: ${typeof response.headers?.get === 'function'}`);

    // Update rate limit info from response headers
    try {
      console.error(`[Instantly MCP] 🔍 DEBUG: About to call rateLimiter.updateFromHeaders`);
      rateLimiter.updateFromHeaders(response.headers);
      console.error(`[Instantly MCP] 🔍 DEBUG: rateLimiter.updateFromHeaders completed`);
    } catch (error: any) {
      console.error('[Instantly MCP] ⚠️ Rate limiter update failed:', error.message);
      console.error('[Instantly MCP] ⚠️ Rate limiter error stack:', error.stack);
    }

    // Let centralized parser handle success and error payloads
    return await parseInstantlyResponse(response as unknown as Response);
  } catch (error) {
    throw handleInstantlyError(error, 'makeInstantlyRequest');
  }
}

// FIXED: Simple, reliable pagination for list_accounts - now supports per-request API keys
async function getAllAccounts(apiKey?: string): Promise<any[]> {
  console.error('[Instantly MCP] 📊 Retrieving all accounts with reliable pagination...');

  try {
    // Create a wrapper function that includes the API key
    const makeRequestWithKey = (endpoint: string, options: any = {}) => 
      makeInstantlyRequest(endpoint, options, apiKey);
    
    // Use direct API call with pagination
    const result = await paginateInstantlyAPI('/api/v2/accounts', makeRequestWithKey);

    console.error(`[Instantly MCP] ✅ Successfully retrieved ${result.length} accounts`);
    return result;
  } catch (error) {
    console.error('[Instantly MCP] ❌ Error retrieving accounts:', error);
    throw error;
  }
}

// Define tools array for both stdio and HTTP transports
const TOOLS_DEFINITION = [
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
      },
      {
        name: 'get_campaign',
        description: 'Get details of a specific campaign',
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
        name: 'update_campaign',
        description: 'Update an existing campaign',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'string', description: 'Campaign ID' },
            name: { type: 'string', description: 'Campaign name' },
            status: { type: 'string', description: 'Campaign status' }
          },
          required: ['campaign_id'],
          additionalProperties: false
        }
      },
      {
        name: 'get_warmup_analytics',
        description: 'Get email warmup analytics',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', description: 'Email address' }
          },
          required: ['email'],
          additionalProperties: false
        }
      },
      {
        name: 'list_leads',
        description: 'List leads with filtering and pagination',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'string', description: 'Filter by campaign ID' },
            get_all: { type: 'boolean', description: 'Retrieve all leads', default: true }
          },
          additionalProperties: false
        }
      },
      {
        name: 'create_lead',
        description: 'Create a new lead',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', description: 'Lead email address' },
            first_name: { type: 'string', description: 'First name' },
            last_name: { type: 'string', description: 'Last name' },
            company_name: { type: 'string', description: 'Company name' }
          },
          required: ['email'],
          additionalProperties: false
        }
      },
      {
        name: 'update_lead',
        description: 'Update an existing lead',
        inputSchema: {
          type: 'object',
          properties: {
            lead_id: { type: 'string', description: 'Lead ID' },
            email: { type: 'string', description: 'Lead email address' },
            first_name: { type: 'string', description: 'First name' },
            last_name: { type: 'string', description: 'Last name' }
          },
          required: ['lead_id'],
          additionalProperties: false
        }
      },
      {
        name: 'list_lead_lists',
        description: 'List all lead lists',
        inputSchema: {
          type: 'object',
          properties: {
            get_all: { type: 'boolean', description: 'Retrieve all lead lists', default: true }
          },
          additionalProperties: false
        }
      },
      {
        name: 'create_lead_list',
        description: 'Create a new lead list',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Lead list name' }
          },
          required: ['name'],
          additionalProperties: false
        }
      },
      {
        name: 'list_emails',
        description: 'List emails with filtering and pagination',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'string', description: 'Filter by campaign ID' },
            get_all: { type: 'boolean', description: 'Retrieve all emails', default: true }
          },
          additionalProperties: false
        }
      },
      {
        name: 'get_email',
        description: 'Get details of a specific email',
        inputSchema: {
          type: 'object',
          properties: {
            email_id: { type: 'string', description: 'Email ID' }
          },
          required: ['email_id'],
          additionalProperties: false
        }
      },
      {
        name: 'reply_to_email',
        description: 'Reply to an email',
        inputSchema: {
          type: 'object',
          properties: {
            reply_to_uuid: { type: 'string', description: 'Reply UUID' },
            eaccount: { type: 'string', description: 'Email account' },
            subject: { type: 'string', description: 'Reply subject' },
            body: { type: 'string', description: 'Reply body' }
          },
          required: ['reply_to_uuid', 'eaccount', 'subject', 'body'],
          additionalProperties: false
        }
      },
      {
        name: 'list_api_keys',
        description: 'List API keys for the account',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false
        }
      },
      {
        name: 'get_campaign_analytics_overview',
        description: 'Get analytics overview for all campaigns',
        inputSchema: {
          type: 'object',
          properties: {
            start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
            end_date: { type: 'string', description: 'End date (YYYY-MM-DD)' }
          },
          additionalProperties: false
        }
      },
      {
        name: 'update_account',
        description: 'Update a sending account settings',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', description: 'Email address of the account to update' },
            daily_limit: { type: 'number', description: 'New daily sending limit' },
            warmup_enabled: { type: 'boolean', description: 'Enable/disable warmup' }
          },
          required: ['email'],
          additionalProperties: false
        }
      },
      {
        name: 'validate_campaign_accounts',
        description: 'Validate which accounts are eligible for campaign creation. Debug tool for campaign issues.',
        inputSchema: {
          type: 'object',
          properties: {
            email_list: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional: Specific email addresses to validate. If not provided, shows all account statuses.'
            }
          },
          additionalProperties: false
        }
      },
      {
        name: 'get_account_details',
        description: 'Get detailed information about a specific account including warmup status and campaign eligibility',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', description: 'Email address of the account to inspect' }
          },
          required: ['email'],
          additionalProperties: false
        }
      },
      {
        name: 'check_feature_availability',
        description: 'Check which premium features are available with your current Instantly plan and API key permissions',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false
        }
      },
      // ===== NEW TIER 1 TOOLS - PRODUCTION VERIFIED =====
      {
        name: 'count_unread_emails',
        description: 'Count unread emails in inbox - Safe read-only monitoring tool',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false
        }
      },
      {
        name: 'get_daily_campaign_analytics',
        description: 'Get daily campaign performance analytics with date filtering - Enhanced analytics capability',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'string', description: 'Campaign ID (optional - leave empty for all campaigns)' },
            start_date: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
            end_date: { type: 'string', description: 'End date in YYYY-MM-DD format' },
            campaign_status: { type: 'number', description: 'Filter by campaign status (0=Draft, 1=Active, 2=Paused, 3=Completed)' }
          },
          additionalProperties: false
        }
      },
      {
        name: 'get_account_info',
        description: 'Get detailed account information and status - Safe read-only account inspection',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', description: 'Email address of the account to retrieve information for' }
          },
          required: ['email'],
          additionalProperties: false
        }
      },
      // ===== NEW TIER 2 TOOLS - TESTABLE STATE-CHANGE =====
      {
        name: 'activate_campaign',
        description: 'Activate a campaign to start sending emails - Campaign lifecycle management',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'string', description: 'Campaign ID to activate' }
          },
          required: ['campaign_id'],
          additionalProperties: false
        }
      },
      {
        name: 'pause_campaign',
        description: 'Pause an active campaign - Campaign control functionality',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'string', description: 'Campaign ID to pause' }
          },
          required: ['campaign_id'],
          additionalProperties: false
        }
      },
      {
        name: 'pause_account',
        description: 'Pause a sending account - Account state management',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', description: 'Email address of the account to pause' }
          },
          required: ['email'],
          additionalProperties: false
        }
      },
      {
        name: 'resume_account',
        description: 'Resume a paused sending account - Account state management',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', description: 'Email address of the account to resume' }
          },
          required: ['email'],
          additionalProperties: false
        }
      }
];

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error('[Instantly MCP] 📋 Listing available tools...');

  return {
    tools: TOOLS_DEFINITION
  };
});

// Call tool handler - now supports per-request API keys
server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  const { name, arguments: args } = request.params;
  
  console.error(`[Instantly MCP] 🔧 Tool called: ${name}`);

  // Extract API key from params (for HTTP transport) or environment (for stdio)
  let apiKey: string | undefined;
  
  // Check if API key is provided in params (from HTTP transport)
  if (args && typeof args === 'object' && 'apiKey' in args) {
    apiKey = (args as any).apiKey;
    // Remove apiKey from args to avoid passing it to tool functions
    delete (args as any).apiKey;
  }
  
  // Fall back to environment variable for stdio transport
  if (!apiKey) {
    apiKey = INSTANTLY_API_KEY;
  }
  
  if (!apiKey) {
    throw new McpError(ErrorCode.InvalidParams, 'Instantly API key is required. Provide via x-instantly-api-key header (HTTP) or INSTANTLY_API_KEY environment variable (stdio).');
  }

  try {
    // Check rate limit status
    if (rateLimiter.isRateLimited()) {
      throw new McpError(ErrorCode.InternalError, `Rate limited. ${rateLimiter.getRateLimitMessage()}`);
    }

    switch (name) {
      case 'list_accounts': {
        console.error('[Instantly MCP] 📊 Executing list_accounts...');

        try {
          // Validate parameters (even though they're optional)
          const validatedData = validateListAccountsData(args || {});
          console.error('[Instantly MCP] 📊 Parameters validated:', validatedData);

          console.error('[Instantly MCP] 🔍 DEBUG: About to call getAllAccounts()');
          const allAccounts = await getAllAccounts(apiKey);
          console.error('[Instantly MCP] 🔍 DEBUG: getAllAccounts() completed successfully');

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
        } catch (error: any) {
          console.error('[Instantly MCP] ❌ FULL ERROR STACK in list_accounts:', error.stack);
          console.error('[Instantly MCP] ❌ ERROR MESSAGE:', error.message);
          console.error('[Instantly MCP] ❌ ERROR TYPE:', typeof error);
          throw error;
        }
      }

      case 'create_campaign': {
        console.error('[Instantly MCP] 🚀 Executing create_campaign...');

        // Validate required parameters
        const validatedData = validateCampaignData(args);

        const response = await makeInstantlyRequest('/api/v2/campaigns', {
          method: 'POST',
          body: validatedData
        }, apiKey);

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

        const makeRequestWithKey = (endpoint: string, options: any = {}) => 
          makeInstantlyRequest(endpoint, options, apiKey);
        const campaigns = await paginateInstantlyAPI('/api/v2/campaigns', makeRequestWithKey);

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
        const analytics = await makeInstantlyRequest(`/api/v2/campaigns/${validatedData.campaign_id}/analytics`, {}, apiKey);

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
        const verification = await makeInstantlyRequest('/api/v2/email-verification', {
          method: 'POST',
          body: { email: validatedData.email }
        }, apiKey);

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

      case 'get_campaign': {
        console.error('[Instantly MCP] 📋 Executing get_campaign...');

        const validatedData = validateGetCampaignData(args);
        const campaign = await makeInstantlyRequest(`/api/v2/campaigns/${validatedData.campaign_id}`, {}, apiKey);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                campaign: campaign
              }, null, 2)
            }
          ]
        };
      }

      case 'update_campaign': {
        console.error('[Instantly MCP] 🔄 Executing update_campaign...');

        const validatedData = validateUpdateCampaignData(args);
        const { campaign_id, ...updateData } = validatedData;

        const updatedCampaign = await makeInstantlyRequest(`/api/v2/campaigns/${campaign_id}`, {
          method: 'PATCH',
          body: updateData
        }, apiKey);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                campaign: updatedCampaign
              }, null, 2)
            }
          ]
        };
      }

      case 'get_warmup_analytics': {
        console.error('[Instantly MCP] 🌡️ Executing get_warmup_analytics...');

        const validatedData = validateWarmupAnalyticsData(args);
        // Use the first email from the emails array
        const email = validatedData.emails[0];
        const analytics = await makeInstantlyRequest(`/api/v2/accounts/warmup-analytics`, {
          method: 'POST',
          body: { emails: validatedData.emails }
        }, apiKey);

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

      case 'list_leads': {
        console.error('[Instantly MCP] 👥 Executing list_leads...');

        const makeRequestWithKey = (endpoint: string, options: any = {}) => 
          makeInstantlyRequest(endpoint, options, apiKey);
        const leads = await paginateInstantlyAPI('/api/v2/leads', makeRequestWithKey);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                data: leads,
                total_retrieved: leads.length,
                success: true
              }, null, 2)
            }
          ]
        };
      }

      case 'create_lead': {
        console.error('[Instantly MCP] ➕ Executing create_lead...');

        const validatedData = validateCreateLeadData(args);
        const lead = await makeInstantlyRequest('/api/v2/leads', {
          method: 'POST',
          body: validatedData
        }, apiKey);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                lead: lead
              }, null, 2)
            }
          ]
        };
      }

      case 'update_lead': {
        console.error('[Instantly MCP] 🔄 Executing update_lead...');

        const validatedData = validateUpdateLeadData(args);
        const { lead_id, ...updateData } = validatedData;

        const updatedLead = await makeInstantlyRequest(`/api/v2/leads/${lead_id}`, {
          method: 'PATCH',
          body: updateData
        }, apiKey);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                lead: updatedLead
              }, null, 2)
            }
          ]
        };
      }

      case 'list_lead_lists': {
        console.error('[Instantly MCP] 📋 Executing list_lead_lists...');

        const makeRequestWithKey = (endpoint: string, options: any = {}) => 
          makeInstantlyRequest(endpoint, options, apiKey);
        const leadLists = await paginateInstantlyAPI('/api/v2/lead-lists', makeRequestWithKey);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                data: leadLists,
                total_retrieved: leadLists.length,
                success: true
              }, null, 2)
            }
          ]
        };
      }

      case 'create_lead_list': {
        console.error('[Instantly MCP] ➕ Executing create_lead_list...');

        const validatedData = validateCreateLeadListData(args);
        const leadList = await makeInstantlyRequest('/api/v2/lead-lists', {
          method: 'POST',
          body: validatedData
        }, apiKey);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                lead_list: leadList
              }, null, 2)
            }
          ]
        };
      }

      case 'list_emails': {
        console.error('[Instantly MCP] 📧 Executing list_emails...');

        const makeRequestWithKey = (endpoint: string, options: any = {}) => 
          makeInstantlyRequest(endpoint, options, apiKey);
        const emails = await paginateInstantlyAPI('/api/v2/emails', makeRequestWithKey);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                data: emails,
                total_retrieved: emails.length,
                success: true
              }, null, 2)
            }
          ]
        };
      }

      case 'get_email': {
        console.error('[Instantly MCP] 📧 Executing get_email...');

        const validatedData = validateGetEmailData(args);
        const email = await makeInstantlyRequest(`/api/v2/emails/${validatedData.email_id}`, {}, apiKey);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                email: email
              }, null, 2)
            }
          ]
        };
      }

      case 'reply_to_email': {
        console.error('[Instantly MCP] 💬 Executing reply_to_email...');

        const validatedData = validateReplyToEmailData(args);
        const reply = await makeInstantlyRequest('/api/v2/emails/reply', {
          method: 'POST',
          body: validatedData
        }, apiKey);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                reply: reply
              }, null, 2)
            }
          ]
        };
      }

      case 'list_api_keys': {
        console.error('[Instantly MCP] 🔑 Executing list_api_keys...');

        const apiKeys = await makeInstantlyRequest('/api/v2/api-keys', {}, apiKey);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                api_keys: apiKeys
              }, null, 2)
            }
          ]
        };
      }

      case 'get_campaign_analytics_overview': {
        console.error('[Instantly MCP] 📊 Executing get_campaign_analytics_overview...');

        const validatedData = validateGetCampaignAnalyticsOverviewData(args);
        const overview = await makeInstantlyRequest('/api/v2/campaigns/analytics/overview', {
          params: validatedData
        }, apiKey);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                overview: overview
              }, null, 2)
            }
          ]
        };
      }

      case 'update_account': {
        console.error('[Instantly MCP] 🔄 Executing update_account...');

        const validatedData = validateUpdateAccountData(args);
        const { email, ...updateData } = validatedData;

        const updatedAccount = await makeInstantlyRequest(`/api/v2/accounts/${email}`, {
          method: 'PATCH',
          body: updateData
        }, apiKey);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                account: updatedAccount
              }, null, 2)
            }
          ]
        };
      }

      case 'validate_campaign_accounts': {
        console.error('[Instantly MCP] 🔍 Executing validate_campaign_accounts...');

        const validatedData = validateCampaignAccountsData(args);

        // Get all accounts first
        const allAccounts = await getAllAccounts(apiKey);

        // Filter to specific emails if provided
        const accountsToCheck = validatedData.email_list
          ? allAccounts.filter(acc => validatedData.email_list!.includes(acc.email))
          : allAccounts;

        // Analyze eligibility
        const validation = accountsToCheck.map(account => ({
          email: account.email,
          eligible: account.status === 1 && !account.setup_pending && account.warmup_status === 1,
          status: account.status,
          setup_pending: account.setup_pending,
          warmup_status: account.warmup_status,
          issues: []
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                validation: validation,
                total_checked: validation.length,
                eligible_count: validation.filter(v => v.eligible).length
              }, null, 2)
            }
          ]
        };
      }

      case 'get_account_details': {
        console.error('[Instantly MCP] 🔍 Executing get_account_details...');

        const validatedData = validateGetAccountDetailsData(args);
        const details = await makeInstantlyRequest(`/api/v2/accounts/${validatedData.email}`, {}, apiKey);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                account_details: details
              }, null, 2)
            }
          ]
        };
      }

      case 'check_feature_availability': {
        console.error('[Instantly MCP] 🔍 Executing check_feature_availability...');

        try {
          // Test basic API connectivity with accounts endpoint
          const accounts = await makeInstantlyRequest('/api/v2/accounts', {}, apiKey);

          // Basic feature availability based on successful API calls
          const features = {
            basic_features: {
              accounts_access: 'Available',
              campaigns_access: 'Available',
              leads_access: 'Available',
              emails_access: 'Available'
            },
            api_connectivity: 'Working',
            total_accounts: Array.isArray(accounts) ? accounts.length : 'Unknown'
          };

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  features: features
                }, null, 2)
              }
            ]
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'API connectivity test failed',
                  message: error instanceof Error ? error.message : String(error)
                }, null, 2)
              }
            ]
          };
        }
      }

      // ===== NEW TIER 1 TOOLS - PRODUCTION VERIFIED =====

      case 'count_unread_emails': {
        console.error('[Instantly MCP] 📧 Executing count_unread_emails...');

        try {
          const result = await makeInstantlyRequest('/api/v2/emails/unread/count', {}, apiKey);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  unread_count: result.count || result.unread_count || 0,
                  message: 'Unread emails count retrieved successfully'
                }, null, 2)
              }
            ]
          };
        } catch (error) {
          throw new McpError(ErrorCode.InternalError, `Failed to count unread emails: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      case 'get_daily_campaign_analytics': {
        console.error('[Instantly MCP] 📊 Executing get_daily_campaign_analytics...');

        try {
          const params: any = {};

          if (args?.campaign_id) params.campaign_id = args.campaign_id;
          if (args?.start_date) params.start_date = args.start_date;
          if (args?.end_date) params.end_date = args.end_date;
          if (args?.campaign_status !== undefined) params.campaign_status = args.campaign_status;

          const result = await makeInstantlyRequest('/api/v2/campaigns/analytics/daily', { params }, apiKey);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  analytics: result,
                  total_days: Array.isArray(result) ? result.length : 0,
                  message: 'Daily campaign analytics retrieved successfully'
                }, null, 2)
              }
            ]
          };
        } catch (error) {
          throw new McpError(ErrorCode.InternalError, `Failed to get daily campaign analytics: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      case 'get_account_info': {
        console.error('[Instantly MCP] 👤 Executing get_account_info...');

        try {
          if (!args?.email) {
            throw new McpError(ErrorCode.InvalidParams, 'Email address is required');
          }

          const result = await makeInstantlyRequest(`/api/v2/accounts/${args.email}`, {}, apiKey);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  account: result,
                  message: 'Account information retrieved successfully'
                }, null, 2)
              }
            ]
          };
        } catch (error) {
          throw new McpError(ErrorCode.InternalError, `Failed to get account info: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // ===== NEW TIER 2 TOOLS - TESTABLE STATE-CHANGE =====

      case 'activate_campaign': {
        console.error('[Instantly MCP] ▶️ Executing activate_campaign...');

        try {
          if (!args?.campaign_id) {
            throw new McpError(ErrorCode.InvalidParams, 'Campaign ID is required');
          }

          const result = await makeInstantlyRequest(`/api/v2/campaigns/${args.campaign_id}/activate`, { method: 'POST' }, apiKey);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  campaign: result,
                  message: 'Campaign activated successfully'
                }, null, 2)
              }
            ]
          };
        } catch (error) {
          throw new McpError(ErrorCode.InternalError, `Failed to activate campaign: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      case 'pause_campaign': {
        console.error('[Instantly MCP] ⏸️ Executing pause_campaign...');

        try {
          if (!args?.campaign_id) {
            throw new McpError(ErrorCode.InvalidParams, 'Campaign ID is required');
          }

          const result = await makeInstantlyRequest(`/api/v2/campaigns/${args.campaign_id}/pause`, { method: 'POST' }, apiKey);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  campaign: result,
                  message: 'Campaign paused successfully'
                }, null, 2)
              }
            ]
          };
        } catch (error) {
          throw new McpError(ErrorCode.InternalError, `Failed to pause campaign: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      case 'pause_account': {
        console.error('[Instantly MCP] ⏸️ Executing pause_account...');

        try {
          if (!args?.email) {
            throw new McpError(ErrorCode.InvalidParams, 'Email address is required');
          }

          const result = await makeInstantlyRequest(`/api/v2/accounts/${args.email}/pause`, { method: 'POST' }, apiKey);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  account: result,
                  message: 'Account paused successfully'
                }, null, 2)
              }
            ]
          };
        } catch (error) {
          throw new McpError(ErrorCode.InternalError, `Failed to pause account: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      case 'resume_account': {
        console.error('[Instantly MCP] ▶️ Executing resume_account...');

        try {
          if (!args?.email) {
            throw new McpError(ErrorCode.InvalidParams, 'Email address is required');
          }

          const result = await makeInstantlyRequest(`/api/v2/accounts/${args.email}/resume`, { method: 'POST' }, apiKey);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  account: result,
                  message: 'Account resumed successfully'
                }, null, 2)
              }
            ]
          };
        } catch (error) {
          throw new McpError(ErrorCode.InternalError, `Failed to resume account: ${error instanceof Error ? error.message : String(error)}`);
        }
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

// n8n HTTP server setup (minimal implementation)
async function startN8nHttpServer() {
  const express = await import('express');
  const cors = await import('cors');
  const { randomUUID } = await import('node:crypto');

  const app = express.default();
  const PORT = process.env.PORT || 3000;

  // CORS for n8n workflows
  app.use(cors.default({
    origin: '*', // Configure for production
    exposedHeaders: ['Mcp-Session-Id'],
    allowedHeaders: ['Content-Type', 'mcp-session-id'],
  }));

  app.use(express.default.json());

  // Health check for n8n
  app.get('/health', (req: any, res: any) => {
    res.json({
      status: 'healthy',
      service: 'instantly-mcp',
      mode: 'n8n',
      tools: 29,
      timestamp: new Date().toISOString()
    });
  });

  // Main MCP endpoint for n8n
  app.post('/mcp', async (req: any, res: any) => {
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableDnsRebindingProtection: false, // Simplified for n8n
      });

      // Use the same server instance for n8n requests
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);

    } catch (error) {
      console.error('[Instantly MCP n8n] Error:', error);
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null
      });
    }
  });

  return new Promise<void>((resolve, reject) => {
    app.listen(PORT, (error?: Error) => {
      if (error) {
        reject(error);
        return;
      }
      console.error(`[Instantly MCP] 🌐 n8n HTTP server running on port ${PORT}`);
      console.error(`[Instantly MCP] 📡 Endpoint: http://localhost:${PORT}/mcp`);
      console.error(`[Instantly MCP] 🏥 Health: http://localhost:${PORT}/health`);
      console.error(`[Instantly MCP] 🤖 Ready for n8n automation workflows`);
      resolve();
    });
  });
}

// Helper function to get tools list for HTTP transport
async function getToolsList() {
  // Return the same tools list that the MCP server provides
  // This ensures HTTP and stdio transports have identical tool sets
  return TOOLS_DEFINITION;
}

// Helper function to handle tool calls for HTTP transport
async function handleToolCall(params: any) {
  const { name, arguments: args } = params;

  // This integrates with your existing tool handling logic
  // For now, return a placeholder that will be replaced with actual implementation
  switch (name) {
    case 'list_campaigns':
      const campaigns = await makeInstantlyRequest('/api/v2/campaigns', {}, args.apiKey);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              data: campaigns,
              total_retrieved: campaigns.length,
              pagination_method: "reliable_complete",
              success: true
            }, null, 2)
          }
        ]
      };

    case 'list_accounts':
      const accounts = await getAllAccounts(args.apiKey);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              data: accounts,
              total_retrieved: accounts.length,
              pagination_method: "reliable_complete",
              success: true
            }, null, 2)
          }
        ]
      };

    // ===== NEW TIER 1 TOOLS - PRODUCTION VERIFIED =====
    case 'count_unread_emails':
      const unreadResult = await makeInstantlyRequest('/api/v2/emails/unread/count', {}, args.apiKey);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              unread_count: unreadResult.count || unreadResult.unread_count || 0,
              message: 'Unread emails count retrieved successfully'
            }, null, 2)
          }
        ]
      };

    case 'get_daily_campaign_analytics':
      const analyticsParams: any = {};
      if (args.campaign_id) analyticsParams.campaign_id = args.campaign_id;
      if (args.start_date) analyticsParams.start_date = args.start_date;
      if (args.end_date) analyticsParams.end_date = args.end_date;
      if (args.campaign_status !== undefined) analyticsParams.campaign_status = args.campaign_status;

      const analyticsResult = await makeInstantlyRequest('/api/v2/campaigns/analytics/daily', { params: analyticsParams }, args.apiKey);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              analytics: analyticsResult,
              total_days: Array.isArray(analyticsResult) ? analyticsResult.length : 0,
              message: 'Daily campaign analytics retrieved successfully'
            }, null, 2)
          }
        ]
      };

    case 'get_account_info':
      const accountInfoResult = await makeInstantlyRequest('/api/v2/account', {}, args.apiKey);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              account: accountInfoResult,
              message: 'Account information retrieved successfully'
            }, null, 2)
          }
        ]
      };

    case 'check_feature_availability':
      const featuresResult = await makeInstantlyRequest('/api/v2/account/features', {}, args.apiKey);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              features: featuresResult,
              message: 'Feature availability checked successfully'
            }, null, 2)
          }
        ]
      };

    // ===== NEW TIER 2 TOOLS - TESTABLE STATE-CHANGE =====
    case 'activate_campaign':
      if (!args.campaign_id) throw new Error('Campaign ID is required');
      const activateResult = await makeInstantlyRequest(`/api/v2/campaigns/${args.campaign_id}/activate`, { method: 'POST' }, args.apiKey);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              campaign: activateResult,
              message: 'Campaign activated successfully'
            }, null, 2)
          }
        ]
      };

    case 'pause_campaign':
      if (!args.campaign_id) throw new Error('Campaign ID is required');
      const pauseCampaignResult = await makeInstantlyRequest(`/api/v2/campaigns/${args.campaign_id}/pause`, { method: 'POST' }, args.apiKey);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              campaign: pauseCampaignResult,
              message: 'Campaign paused successfully'
            }, null, 2)
          }
        ]
      };

    case 'pause_account':
      if (!args.email) throw new Error('Email address is required');
      const pauseAccountResult = await makeInstantlyRequest(`/api/v2/accounts/${args.email}/pause`, { method: 'POST' }, args.apiKey);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              account: pauseAccountResult,
              message: 'Account paused successfully'
            }, null, 2)
          }
        ]
      };

    case 'resume_account':
      if (!args.email) throw new Error('Email address is required');
      const resumeAccountResult = await makeInstantlyRequest(`/api/v2/accounts/${args.email}/resume`, { method: 'POST' }, args.apiKey);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              account: resumeAccountResult,
              message: 'Account resumed successfully'
            }, null, 2)
          }
        ]
      };

    // Add other tool handlers here
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Main execution
async function main() {
  const { isN8nMode, transportMode, isHttpMode } = parseConfig();

  if (isHttpMode) {
    console.error(`[Instantly MCP] 🌐 Starting ${transportMode} transport mode...`);

    if (process.env.NODE_ENV === 'production') {
      console.error('[Instantly MCP] 🏢 Production endpoints:');
      console.error('[Instantly MCP] 🔐 Header auth: https://mcp.instantly.ai/mcp');
      console.error('[Instantly MCP] 🔗 URL auth: https://mcp.instantly.ai/mcp/{API_KEY}');
    }

    // Use new streaming HTTP transport
    const config: StreamingHttpConfig = {
      port: parseInt(process.env.PORT || '3000'),
      host: process.env.HOST || '0.0.0.0',
      cors: {
        origin: process.env.NODE_ENV === 'production'
          ? ['https://claude.ai', 'https://cursor.sh', 'https://instantly.ai', 'https://mcp.instantly.ai']
          : true,
        credentials: true
      }
      // No auth config - using per-request API key passthrough
    };

    const httpTransport = new StreamingHttpTransport(server, config);

    // Set up request handlers to integrate with existing server logic
    httpTransport.setRequestHandlers({
      toolsList: async (id: any) => {
        const tools = await getToolsList();
        return {
          jsonrpc: '2.0',
          id,
          result: { tools }
        };
      },
      toolCall: async (params: any, id: any) => {
        // Call the main tool handler logic directly
        const { name, arguments: args } = params;

        console.error(`[Instantly MCP] 🔧 HTTP Tool called: ${name}`);

        // The API key should already be in args.apiKey from the HTTP transport
        // Just call the existing handleToolCall function which expects this format
        const result = await handleToolCall(params);

        return result;
      }
    });

    await httpTransport.start();

    // Keep legacy n8n support
    if (isN8nMode) {
      console.error('[Instantly MCP] 🤖 Legacy n8n mode compatibility enabled');
    }

  } else {
    console.error('[Instantly MCP] 🔌 Starting stdio mode (Claude Desktop, Cursor IDE)...');
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[Instantly MCP] ✅ Server running with reliable pagination');
  }
}

main().catch((error) => {
  console.error('[Instantly MCP] ❌ Fatal error:', error);
  process.exit(1);
});
