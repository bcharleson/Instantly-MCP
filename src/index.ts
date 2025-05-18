#!/usr/bin/env node
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
import { buildPaginationQuery, parsePaginatedResponse } from './pagination.js';

const INSTANTLY_API_URL = 'https://api.instantly.ai/api/v2';

// API key will be provided via MCP config args
const args = process.argv.slice(2);
const apiKeyIndex = args.findIndex(arg => arg === '--api-key');
const INSTANTLY_API_KEY = apiKeyIndex !== -1 && args[apiKeyIndex + 1] ? args[apiKeyIndex + 1] : null;

if (!INSTANTLY_API_KEY) {
  console.error('Error: API key must be provided via --api-key argument');
  process.exit(1);
}

const server = new Server(
  {
    name: 'instantly-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const makeInstantlyRequest = async (endpoint: string, method: string = 'GET', data?: any) => {
  // Check if we're rate limited before making request
  if (rateLimiter.isRateLimited()) {
    const timeUntilReset = rateLimiter.getTimeUntilReset();
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Rate limit exceeded. Please wait ${Math.ceil(timeUntilReset / 60000)} minutes before retrying.`
    );
  }

  const url = `${INSTANTLY_API_URL}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${INSTANTLY_API_KEY}`,
      'Content-Type': 'application/json',
    },
  };

  if (data && method !== 'GET') {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url);
    
    // Update rate limit info from response headers
    rateLimiter.updateFromHeaders(response.headers);
    
    const result = await parseInstantlyResponse(response);
    
    // Log rate limit info for debugging
    const rateLimitInfo = rateLimiter.getRateLimitInfo();
    if (rateLimitInfo) {
      console.error(rateLimiter.getRateLimitMessage());
    }
    
    return result;
  } catch (error) {
    handleInstantlyError(error, 'makeInstantlyRequest');
  }
};

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // Campaign Management
    {
      name: 'list_campaigns',
      description: 'List all campaigns with optional filters and pagination',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of campaigns to return per page (default: 20)' },
          page: { type: 'number', description: 'Page number (default: 1)' },
          search: { type: 'string', description: 'Search term to filter campaigns' },
          status: { type: 'string', description: 'Filter by status: active, paused, completed' },
        },
      },
    },
    {
      name: 'get_campaign',
      description: 'Get details of a specific campaign',
      inputSchema: {
        type: 'object',
        properties: {
          campaign_id: { type: 'string', description: 'Campaign ID' },
        },
        required: ['campaign_id'],
      },
    },
    {
      name: 'create_campaign',
      description: 'Create a new email campaign',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Campaign name' },
          from_email: { type: 'string', description: 'Sender email address' },
          from_name: { type: 'string', description: 'Sender name' },
          subject: { type: 'string', description: 'Email subject' },
          body: { type: 'string', description: 'Email body content' },
        },
        required: ['name', 'from_email', 'from_name', 'subject', 'body'],
      },
    },
    {
      name: 'update_campaign',
      description: 'Update an existing campaign',
      inputSchema: {
        type: 'object',
        properties: {
          campaign_id: { type: 'string', description: 'Campaign ID' },
          name: { type: 'string', description: 'New campaign name' },
          status: { type: 'string', description: 'New status' },
        },
        required: ['campaign_id'],
      },
    },
    {
      name: 'activate_campaign',
      description: 'Activate a campaign',
      inputSchema: {
        type: 'object',
        properties: {
          campaign_id: { type: 'string', description: 'Campaign ID' },
        },
        required: ['campaign_id'],
      },
    },
    // Analytics
    {
      name: 'get_campaign_analytics',
      description: 'Get analytics for campaigns',
      inputSchema: {
        type: 'object',
        properties: {
          campaign_id: { type: 'string', description: 'Specific campaign ID (optional)' },
          start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
          end_date: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        },
      },
    },
    {
      name: 'get_campaign_analytics_overview',
      description: 'Get analytics overview for all campaigns',
      inputSchema: {
        type: 'object',
        properties: {
          start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
          end_date: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        },
      },
    },
    // Account Management
    {
      name: 'list_accounts',
      description: 'List all sending accounts with pagination',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of accounts to return per page (default: 20)' },
          page: { type: 'number', description: 'Page number (default: 1)' },
        },
      },
    },
    {
      name: 'create_account',
      description: 'Create a new sending account',
      inputSchema: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'Email address' },
          username: { type: 'string', description: 'Username' },
          password: { type: 'string', description: 'Password' },
          provider: { type: 'string', description: 'Email provider' },
        },
        required: ['email', 'username', 'password', 'provider'],
      },
    },
    {
      name: 'update_account',
      description: 'Update a sending account',
      inputSchema: {
        type: 'object',
        properties: {
          account_id: { type: 'string', description: 'Account ID' },
          daily_limit: { type: 'number', description: 'New daily sending limit' },
          warmup_enabled: { type: 'boolean', description: 'Enable/disable warmup' },
        },
        required: ['account_id'],
      },
    },
    {
      name: 'get_warmup_analytics',
      description: 'Get warmup analytics for an account',
      inputSchema: {
        type: 'object',
        properties: {
          account_id: { type: 'string', description: 'Account ID' },
          start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
          end_date: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        },
        required: ['account_id'],
      },
    },
    // Lead Management
    {
      name: 'list_leads',
      description: 'List leads with filters and pagination',
      inputSchema: {
        type: 'object',
        properties: {
          campaign_id: { type: 'string', description: 'Filter by campaign ID' },
          list_id: { type: 'string', description: 'Filter by list ID' },
          status: { type: 'string', description: 'Filter by status' },
          limit: { type: 'number', description: 'Number of leads to return per page (default: 20)' },
          skip: { type: 'number', description: 'Number of leads to skip (offset)' },
          page: { type: 'number', description: 'Page number (alternative to skip)' },
        },
      },
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
          company: { type: 'string', description: 'Company name' },
          custom_fields: { type: 'object', description: 'Custom fields as key-value pairs' },
        },
        required: ['email'],
      },
    },
    {
      name: 'update_lead',
      description: 'Update a lead',
      inputSchema: {
        type: 'object',
        properties: {
          lead_id: { type: 'string', description: 'Lead ID' },
          first_name: { type: 'string', description: 'First name' },
          last_name: { type: 'string', description: 'Last name' },
          company: { type: 'string', description: 'Company name' },
          custom_fields: { type: 'object', description: 'Custom fields as key-value pairs' },
        },
        required: ['lead_id'],
      },
    },
    {
      name: 'move_leads',
      description: 'Move leads between campaigns or lists',
      inputSchema: {
        type: 'object',
        properties: {
          lead_ids: { type: 'array', items: { type: 'string' }, description: 'Array of lead IDs' },
          from_campaign_id: { type: 'string', description: 'Source campaign ID' },
          to_campaign_id: { type: 'string', description: 'Destination campaign ID' },
          to_list_id: { type: 'string', description: 'Destination list ID' },
        },
        required: ['lead_ids'],
      },
    },
    // Lead Lists
    {
      name: 'list_lead_lists',
      description: 'List all lead lists with pagination',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of lists to return per page (default: 20)' },
          page: { type: 'number', description: 'Page number (default: 1)' },
        },
      },
    },
    {
      name: 'create_lead_list',
      description: 'Create a new lead list',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'List name' },
          description: { type: 'string', description: 'List description' },
        },
        required: ['name'],
      },
    },
    // Email Operations
    {
      name: 'send_email',
      description: 'Send a single email',
      inputSchema: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient email' },
          from: { type: 'string', description: 'Sender email' },
          subject: { type: 'string', description: 'Email subject' },
          body: { type: 'string', description: 'Email body' },
          html: { type: 'boolean', description: 'Is HTML email' },
        },
        required: ['to', 'from', 'subject', 'body'],
      },
    },
    {
      name: 'list_emails',
      description: 'List emails with filters and pagination',
      inputSchema: {
        type: 'object',
        properties: {
          campaign_id: { type: 'string', description: 'Filter by campaign' },
          account_id: { type: 'string', description: 'Filter by account' },
          limit: { type: 'number', description: 'Number of emails to return per page (default: 20)' },
          page: { type: 'number', description: 'Page number (default: 1)' },
        },
      },
    },
    // Email Verification
    {
      name: 'verify_email',
      description: 'Verify if an email address is valid',
      inputSchema: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'Email address to verify' },
        },
        required: ['email'],
      },
    },
    // API Key Management
    {
      name: 'list_api_keys',
      description: 'List all API keys',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'create_api_key',
      description: 'Create a new API key',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'API key name' },
          scopes: { type: 'array', items: { type: 'string' }, description: 'Permission scopes' },
        },
        required: ['name'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // Campaign endpoints
      case 'list_campaigns': {
        const queryParams = buildPaginationQuery({
          page: Number(args?.page) || 1,
          limit: Number(args?.limit) || 20,
        });
        
        if (args?.search) queryParams.append('search', String(args.search));
        if (args?.status) queryParams.append('status', String(args.status));
        
        const endpoint = `/campaigns${queryParams.toString() ? `?${queryParams}` : ''}`;
        const result = await makeInstantlyRequest(endpoint);
        const paginatedResult = parsePaginatedResponse(result);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(paginatedResult, null, 2),
            },
          ],
        };
      }

      case 'get_campaign': {
        if (!args?.campaign_id) {
          throw new McpError(ErrorCode.InvalidParams, 'campaign_id is required');
        }
        
        const result = await makeInstantlyRequest(`/campaigns/${args.campaign_id}`);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'create_campaign': {
        const requiredFields = ['name', 'from_email', 'from_name', 'subject', 'body'];
        for (const field of requiredFields) {
          if (!args?.[field]) {
            throw new McpError(ErrorCode.InvalidParams, `${field} is required`);
          }
        }
        
        const result = await makeInstantlyRequest('/campaigns', 'POST', args);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'update_campaign': {
        if (!args?.campaign_id) {
          throw new McpError(ErrorCode.InvalidParams, 'campaign_id is required');
        }
        
        const { campaign_id, ...updateData } = args;
        const result = await makeInstantlyRequest(`/campaigns/${campaign_id}`, 'PATCH', updateData);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'activate_campaign': {
        if (!args?.campaign_id) {
          throw new McpError(ErrorCode.InvalidParams, 'campaign_id is required');
        }
        
        const result = await makeInstantlyRequest(`/campaigns/${args.campaign_id}/activate`, 'POST');
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      // Analytics endpoints
      case 'get_campaign_analytics': {
        const queryParams = new URLSearchParams();
        if (args?.campaign_id) queryParams.append('campaign_id', String(args.campaign_id));
        if (args?.start_date) queryParams.append('start_date', String(args.start_date));
        if (args?.end_date) queryParams.append('end_date', String(args.end_date));
        
        const endpoint = `/campaigns/analytics${queryParams.toString() ? `?${queryParams}` : ''}`;
        const result = await makeInstantlyRequest(endpoint);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'get_campaign_analytics_overview': {
        const queryParams = new URLSearchParams();
        if (args?.start_date) queryParams.append('start_date', String(args.start_date));
        if (args?.end_date) queryParams.append('end_date', String(args.end_date));
        
        const endpoint = `/campaigns/analytics/overview${queryParams.toString() ? `?${queryParams}` : ''}`;
        const result = await makeInstantlyRequest(endpoint);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      // Account endpoints
      case 'list_accounts': {
        const queryParams = buildPaginationQuery({
          page: Number(args?.page) || 1,
          limit: Number(args?.limit) || 20,
        });
        
        const endpoint = `/accounts${queryParams.toString() ? `?${queryParams}` : ''}`;
        const result = await makeInstantlyRequest(endpoint);
        const paginatedResult = parsePaginatedResponse(result);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(paginatedResult, null, 2),
            },
          ],
        };
      }

      case 'create_account': {
        const requiredFields = ['email', 'username', 'password', 'provider'];
        for (const field of requiredFields) {
          if (!args?.[field]) {
            throw new McpError(ErrorCode.InvalidParams, `${field} is required`);
          }
        }
        
        const result = await makeInstantlyRequest('/accounts', 'POST', args);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'update_account': {
        if (!args?.account_id) {
          throw new McpError(ErrorCode.InvalidParams, 'account_id is required');
        }
        
        const { account_id, ...updateData } = args;
        const result = await makeInstantlyRequest(`/accounts/${account_id}`, 'PATCH', updateData);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'get_warmup_analytics': {
        if (!args?.account_id) {
          throw new McpError(ErrorCode.InvalidParams, 'account_id is required');
        }
        
        const result = await makeInstantlyRequest('/accounts/warmup-analytics', 'POST', args);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      // Lead endpoints
      case 'list_leads': {
        const paginationParams = {
          limit: Number(args?.limit) || 20,
          skip: args?.skip,
          page: args?.page,
        };
        
        // Convert page to skip if page is provided
        if (paginationParams.page && !paginationParams.skip) {
          paginationParams.skip = (Number(paginationParams.page) - 1) * Number(paginationParams.limit);
        }
        
        const requestData = {
          ...paginationParams,
          campaign_id: args?.campaign_id,
          list_id: args?.list_id,
          status: args?.status,
        };
        
        const result = await makeInstantlyRequest('/leads/list', 'POST', requestData);
        const paginatedResult = parsePaginatedResponse(result);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(paginatedResult, null, 2),
            },
          ],
        };
      }

      case 'create_lead': {
        if (!args?.email) {
          throw new McpError(ErrorCode.InvalidParams, 'email is required');
        }
        
        const result = await makeInstantlyRequest('/leads', 'POST', args);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'update_lead': {
        if (!args?.lead_id) {
          throw new McpError(ErrorCode.InvalidParams, 'lead_id is required');
        }
        
        const { lead_id, ...updateData } = args;
        const result = await makeInstantlyRequest(`/leads/${lead_id}`, 'PATCH', updateData);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'move_leads': {
        if (!args?.lead_ids || !Array.isArray(args.lead_ids)) {
          throw new McpError(ErrorCode.InvalidParams, 'lead_ids array is required');
        }
        
        const result = await makeInstantlyRequest('/leads/move', 'POST', args);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      // Lead List endpoints
      case 'list_lead_lists': {
        const queryParams = buildPaginationQuery({
          page: Number(args?.page) || 1,
          limit: Number(args?.limit) || 20,
        });
        
        const endpoint = `/lead-lists${queryParams.toString() ? `?${queryParams}` : ''}`;
        const result = await makeInstantlyRequest(endpoint);
        const paginatedResult = parsePaginatedResponse(result);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(paginatedResult, null, 2),
            },
          ],
        };
      }

      case 'create_lead_list': {
        if (!args?.name) {
          throw new McpError(ErrorCode.InvalidParams, 'name is required');
        }
        
        const result = await makeInstantlyRequest('/lead-lists', 'POST', args);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      // Email endpoints
      case 'send_email': {
        const requiredFields = ['to', 'from', 'subject', 'body'];
        for (const field of requiredFields) {
          if (!args?.[field]) {
            throw new McpError(ErrorCode.InvalidParams, `${field} is required`);
          }
        }
        
        const result = await makeInstantlyRequest('/emails', 'POST', args);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'list_emails': {
        const queryParams = buildPaginationQuery({
          page: Number(args?.page) || 1,
          limit: Number(args?.limit) || 20,
        });
        
        if (args?.campaign_id) queryParams.append('campaign_id', String(args.campaign_id));
        if (args?.account_id) queryParams.append('account_id', String(args.account_id));
        
        const endpoint = `/emails${queryParams.toString() ? `?${queryParams}` : ''}`;
        const result = await makeInstantlyRequest(endpoint);
        const paginatedResult = parsePaginatedResponse(result);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(paginatedResult, null, 2),
            },
          ],
        };
      }

      // Email Verification
      case 'verify_email': {
        if (!args?.email) {
          throw new McpError(ErrorCode.InvalidParams, 'email is required');
        }
        
        const result = await makeInstantlyRequest('/email-verification', 'POST', args);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      // API Key endpoints
      case 'list_api_keys': {
        const result = await makeInstantlyRequest('/api-keys');
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'create_api_key': {
        if (!args?.name) {
          throw new McpError(ErrorCode.InvalidParams, 'name is required');
        }
        
        const result = await makeInstantlyRequest('/api-keys', 'POST', args);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    handleInstantlyError(error, name);
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Instantly MCP server running with comprehensive v2 API support...');
}

run().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});