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
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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
  InitializeRequestSchema,
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

const INSTANTLY_API_URL = 'https://api.instantly.ai/api/v2';

// Instantly.ai custom icons (optimized for MCP protocol compliance)
const INSTANTLY_ICONS = [
  {
    src: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+PCFET0NUWVBFIHN2ZyBQVUJMSUMgIi0vL1czQy8vRFREIFNWRyAxLjEvL0VOIiAiaHR0cDovL3d3dy53My5vcmcvR3JhcGhpY3MvU1ZHLzEuMS9EVEQvc3ZnMTEuZHRkIj48c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IiB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAyMDAgMjAwIiBlbmFibGUtYmFja2dyb3VuZD0ibmV3IDAgMCAyMDAgMjAwIiB4bWw6c3BhY2U9InByZXNlcnZlIj48cGF0aCBmaWxsPSIjNDU4MEY2IiBvcGFjaXR5PSIxLjAwMDAwMCIgc3Ryb2tlPSJub25lIiBkPSIgTTE0Mi4wMDAwMDAsMjAxLjAwMDAwMCBDOTQuNjY2NjcyLDIwMS4wMDAwMDAgNDcuODMzMzQwLDIwMS4wMDAwMDAgMS4wMDAwMDYsMjAxLjAwMDAwMCBDMS4wMDAwMDQsMTM0LjMzMzM0NCAxLjAwMDAwNCw2Ny42NjY2NzkgMS4wMDAwMDIsMS4wMDAwMTUgQzY3LjY2NjY1NiwxLjAwMDAxMCAxMzQuMzMzMzEzLDEuMDAwMDEwIDIwMC45OTk5NjksMS4wMDAwMDUgQzIwMC45OTk5ODUsNjcuNjY2NjQ5IDIwMC45OTk5ODUsMTM0LjMzMzI5OCAyMDEuMDAwMDAwLDIwMC45OTk5NjkgQzE4MS41MDAwMDAsMjAxLjAwMDAwMCAxNjIuMDAwMDAwLDIwMS4wMDAwMDAgMTQyLjAwMDAwMCwyMDEuMDAwMDAwIE05MC45Njg4ODAsNTMuODI5NTYzIEM4MS4xODc2NDUsNzAuOTg1NjQ5IDcxLjQwNjQwMyw4OC4xNDE3MzEgNjAuODg4MTg0LDEwNi41OTA0NjkgQzY4LjMwMTM1MywxMDYuNTkwNDY5IDc0LjQ0NzkzNywxMDYuNTkwNDY5IDgyLjEzOTQyNywxMDYuNTkwNDY5IEM3OC43NzU3MjYsMTIwLjg3MzM2MCA3NS42OTg5ODIsMTMzLjkzNzc3NSA3Mi42MjIyMzEsMTQ3LjAwMjE4MiBDNzMuMDUxNDMwLDE0Ny4yNDA5NTIgNzMuNDgwNjI5LDE0Ny40Nzk3MjEgNzMuOTA5ODIxLDE0Ny43MTg0OTEgQzk1Ljg4NDg4OCwxMjYuNTMzNjUzIDExNy44NTk5NTUsMTA1LjM0ODgyNCAxMzkuODM1MDIyLDg0LjE2Mzk5NCBDMTM5LjU3NDg5MCw4My42ODU3ODMgMTM5LjMxNDc1OCw4My4yMDc1NjUgMTM5LjA1NDYyNiw4Mi43MjkzNTUgQzEzMS4zNDk5MzAsODIuNzI5MzU1IDEyMy42NDUyMjYsODIuNzI5MzU1IDExNC41Njg3NDEsODIuNzI5MzU1IEMxMjAuNDY5ODQxLDc0Ljk5NjY2NiAxMjUuNjMyMDgwLDY4LjM2MDc3MSAxMzAuNjQwNTMzLDYxLjYxMDc3MSBDMTMyLjg4NDg4OCw1OC41ODYwMDYgMTM0LjgyMTE4Miw1NS4zMzI2NTcgMTM2LjM1ODg1Niw1MS42ODI5NDUgQzEzNS40MDc3NjEsNTEuNDM0NzY1IDEzNC40NTcyNjAsNTAuOTczMjEzIDEzMy41MDU0OTMsNTAuOTcwNjE5IEMxMjAuNTQwMTA4LDUwLjkzNTMyMiAxMDcuNTczODQ1LDUwLjkwNzY4NCA5NC42MTAyMTQsNTEuMDcwNjYzIEM5My40MzQ5NTIsNTEuMDg1NDQyIDkyLjI3NjM5MCw1Mi40Mjc0NjQgOTAuOTY4ODgwLDUzLjgyOTU2MyB6Ii8+PHBhdGggZmlsbD0iI0ZCRkRGRSIgb3BhY2l0eT0iMS4wMDAwMDAiIHN0cm9rZT0ibm9uZSIgZD0iIE0xMzYuODk3MjYzLDUyLjE4MzA0NCBDMTM0LjgyMTE4Miw1NS4zMzI2NTcgMTMyLjg4NDg4OCw1OC41ODYwMDYgMTMwLjY0MDUzMyw2MS42MTA3NzEgQzEyNS42MzIwODAsNjguMzYwNzcxIDEyMC40Njk4NDEsNzQuOTk2NjY2IDExNC41Njg3NDEsODIuNzI5MzU1IEMxMjMuNjQ1MjI2LDgyLjcyOTM1NSAxMzEuMzQ5OTMwLDgyLjcyOTM1NSAxMzkuMDU0NjI2LDgyLjcyOTM1NSBDMTM5LjMxNDc1OCw4My4yMDc1NjUgMTM5LjU3NDg5MCw4My42ODU3ODMgMTM5LjgzNTAyMiw4NC4xNjM5OTQgQzExNy44NTk5NTUsMTA1LjM0ODgyNCA5NS44ODQ4ODgsMTI2LjUzMzY1MyA3My45MDk4MjEsMTQ3LjcxODQ5MSBDNzMuNDgwNjI5LDE0Ny40Nzk3MjEgNzMuMDUxNDMwLDE0Ny4yNDA5NTIgNzIuNjIyMjMxLDE0Ny4wMDIxODIgQzc1LjY5ODk4MiwxMzMuOTM3Nzc1IDc4Ljc3NTcyNiwxMjAuODczMzYwIDgyLjEzOTQyNywxMDYuNTkwNDY5IEM3NC40NDc5MzcsMTA2LjU5MDQ2OSA2OC4zMDEzNTMsMTA2LjU5MDQ2OSA2MC44ODgxODQsMTA2LjU5MDQ2OSBDNzEuNDA2NDAzLDg4LjE0MTczMSA4MS4xODc2NDUsNzAuOTg1NjQ5IDkxLjM3OTk2Nyw1My4yNTAxMTggQzkyLjU2OTQyNyw1Mi40Njk3NzYgOTMuMzQ3ODM5LDUyLjA5MzgwMCA5NC4xMjYxNjcsNTIuMDkzOTU2IEMxMDguMzgzMjAyLDUyLjA5Njc3OSAxMjIuNjQwMjM2LDUyLjE0NDY4OCAxMzYuODk3MjYzLDUyLjE4MzA0NCB6Ii8+PHBhdGggZmlsbD0iIzU4N0RDQyIgb3BhY2l0eT0iMS4wMDAwMDAiIHN0cm9rZT0ibm9uZSIgZD0iIE0xMzYuNjI4MDUyLDUxLjkzMjk5MSBDMTIyLjY0MDIzNiw1Mi4xNDQ2ODggMTA4LjM4MzIwMiw1Mi4wOTY3NzkgOTQuMTI2MTY3LDUyLjA5Mzk1NiBDOTMuMzQ3ODM5LDUyLjA5MzgwMCA5Mi41Njk0MjcsNTIuNDY5Nzc2IDkxLjQ1MDU2Miw1Mi45MTE5MDMgQzkyLjI3NjM5MCw1Mi40Mjc0NjQgOTMuNDM0OTUyLDUxLjA4NTQ0MiA5NC42MTAyMTQsNTEuMDcwNjYzIEMxMDcuNTczODQ1LDUwLjkwNzY4NCAxMjAuNTQwMTA4LDUwLjkzNTMyMiAxMzMuNTA1NDkzLDUwLjk3MDYxOSBDMTM0LjQ1NzI2MCw1MC45NzMyMTMgMTM1LjQwNzc2MSw1MS40MzQ3NjUgMTM2LjYyODA1Miw1MS45MzI5OTEgeiIvPjwvc3ZnPg==',
    mimeType: 'image/svg+xml',
    sizes: 'any'
  }
];

// Load the Instantly.ai icons (MCP protocol compliant)
function loadInstantlyIcons(): Array<{src: string, mimeType: string, sizes: string}> {
  return INSTANTLY_ICONS;
}

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

// Initialize handler - provides server info with icon for remote MCP connectors
server.setRequestHandler(InitializeRequestSchema, async (request) => {
  console.error('[Instantly MCP] 🔧 Initialize request received from:', request.params?.clientInfo?.name || 'unknown');

  // Ensure icons are loaded synchronously for Claude Desktop compatibility
  const icons = loadInstantlyIcons();
  console.error('[Instantly MCP] 🎨 Icons loaded:', icons.length > 0 ? `✅ ${icons.length} icon(s)` : '❌ Missing');

  // Enhanced initialization response matching HTTP transport
  const initResponse = {
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {
        listChanged: true,
      },
      resources: {
        subscribe: false,
        listChanged: false,
      },
      prompts: {
        listChanged: false,
      },
      // Claude Desktop expects explicit auth capability declaration
      auth: {
        required: false,
      },
    },
    serverInfo: {
      name: 'instantly-mcp',
      version: '1.1.0',
      icons: icons,
      // Add description for Claude Desktop
      description: 'Instantly.ai email automation and campaign management tools',
    },
    // Add instructions for Claude Desktop
    instructions: 'Use these tools to manage Instantly.ai email campaigns, accounts, and automation workflows.',
  };

  console.error('[Instantly MCP] ✅ Initialize response prepared');
  return initResponse;
});

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
    // Add 60-second timeout for all API requests (increased for campaign creation)
    signal: AbortSignal.timeout(60000),
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
    const result = await paginateInstantlyAPI('/accounts', makeRequestWithKey);

    console.error(`[Instantly MCP] ✅ Successfully retrieved ${result.length} accounts`);
    return result;
  } catch (error) {
    console.error('[Instantly MCP] ❌ Error retrieving accounts:', error);
    throw error;
  }
}

// Enhanced information gathering helper for campaign creation
async function gatherCampaignPrerequisites(args: any, apiKey?: string): Promise<any> {
  console.error('[Instantly MCP] 🔍 Gathering campaign prerequisites...');

  // Step 1: Fetch and analyze available accounts
  let accounts: any[] = [];
  let eligibleAccounts: any[] = [];
  let accountAnalysis: any = {};

  try {
    accounts = await getAllAccounts(apiKey);

    if (!accounts || accounts.length === 0) {
      return {
        stage: 'prerequisite_check',
        status: 'no_accounts_found',
        error: 'No accounts found in your workspace',
        required_action: {
          step: 1,
          action: 'add_accounts',
          description: 'You need to add at least one email account before creating campaigns',
          instructions: [
            'Go to your Instantly dashboard',
            'Navigate to Accounts section',
            'Add and verify email accounts',
            'Complete warmup process for each account',
            'Then retry campaign creation'
          ]
        }
      };
    }

    // Analyze account eligibility
    eligibleAccounts = accounts.filter(account =>
      account.status === 1 &&
      !account.setup_pending &&
      account.warmup_status === 1
    );

    const ineligibleAccounts = accounts.filter(account =>
      account.status !== 1 ||
      account.setup_pending ||
      account.warmup_status !== 1
    );

    accountAnalysis = {
      total_accounts: accounts.length,
      eligible_accounts: eligibleAccounts.length,
      ineligible_accounts: ineligibleAccounts.length,
      eligible_emails: eligibleAccounts.map(acc => ({
        email: acc.email,
        warmup_score: acc.warmup_score || 0,
        status: 'ready'
      })),
      ineligible_emails: ineligibleAccounts.map(acc => ({
        email: acc.email,
        issues: [
          ...(acc.status !== 1 ? ['Account not active'] : []),
          ...(acc.setup_pending ? ['Setup pending'] : []),
          ...(acc.warmup_status !== 1 ? ['Warmup not complete'] : [])
        ]
      }))
    };

  } catch (error: any) {
    return {
      stage: 'prerequisite_check',
      status: 'account_fetch_failed',
      error: `Failed to fetch accounts: ${error.message}`,
      suggestion: 'Please check your API key and try again, or call list_accounts directly to troubleshoot'
    };
  }

  // Step 2: Analyze provided campaign data
  const providedFields: Record<string, any> = {
    name: args?.name || null,
    subject: args?.subject || null,
    body: args?.body || null,
    email_list: args?.email_list || null
  };

  const requiredFields = ['name', 'subject', 'body', 'email_list'];
  const missingFields = requiredFields.filter(field => !providedFields[field]);
  const hasAllRequired = missingFields.length === 0;

  // Step 3: Validate email_list if provided
  let emailValidation: any = null;
  if (args?.email_list && Array.isArray(args.email_list)) {
    const eligibleEmailSet = new Set(eligibleAccounts.map(acc => acc.email.toLowerCase()));
    const invalidEmails = args.email_list.filter((email: string) =>
      !eligibleEmailSet.has(email.toLowerCase())
    );

    emailValidation = {
      provided_emails: args.email_list,
      valid_emails: args.email_list.filter((email: string) =>
        eligibleEmailSet.has(email.toLowerCase())
      ),
      invalid_emails: invalidEmails,
      validation_passed: invalidEmails.length === 0
    };
  }

  // Step 4: Generate comprehensive guidance
  const guidance = {
    next_steps: [] as any[],
    field_requirements: {
      name: {
        required: true,
        description: 'Campaign name for identification',
        example: 'Q4 Product Launch Campaign',
        provided: !!args?.name
      },
      subject: {
        required: true,
        description: 'Email subject line',
        example: 'Introducing our new product line',
        formatting_tips: [
          'Keep under 50 characters for better deliverability',
          'Avoid spam trigger words',
          'Use personalization: {{firstName}} or {{companyName}}'
        ],
        provided: !!args?.subject
      },
      body: {
        required: true,
        description: 'Email body content',
        formatting_requirements: [
          'Use plain text with \\n for line breaks',
          'Personalization variables: {{firstName}}, {{lastName}}, {{companyName}}',
          'Only <p>, <br>, and <br/> HTML tags are allowed',
          'Avoid escaped characters like \\" or \\t'
        ],
        example: 'Hi {{firstName}},\\n\\nI hope this email finds you well.\\n\\nBest regards,\\nYour Name',
        provided: !!args?.body
      },
      email_list: {
        required: true,
        description: 'Array of sender email addresses (must be from your verified accounts)',
        constraint: 'Only one sender email per campaign creation call',
        available_options: eligibleAccounts.map(acc => acc.email),
        example: ['john@yourcompany.com'],
        provided: !!args?.email_list,
        validation_status: emailValidation
      }
    },
    optional_settings: {
      tracking: {
        track_opens: {
          default: false,
          description: 'Track when recipients open emails (disabled by default)',
          why_disabled: 'Email tracking can hurt deliverability and raises privacy concerns. Many email clients now block tracking pixels.'
        },
        track_clicks: {
          default: false,
          description: 'Track when recipients click links (disabled by default)',
          why_disabled: 'Link tracking can trigger spam filters and reduces trust. Enable only if analytics are critical.'
        }
      },
      scheduling: {
        timezone: { default: 'America/New_York', description: 'Timezone for sending schedule' },
        timing_from: { default: '09:00', description: 'Start time for sending (24h format)' },
        timing_to: { default: '17:00', description: 'End time for sending (24h format)' },
        days: {
          default: 'Monday-Friday',
          description: 'Days of week for sending',
          format: 'Object with boolean values for each day'
        }
      },
      limits: {
        daily_limit: {
          default: 30,
          description: 'Maximum emails per day per account (30 for cold email compliance)',
          compliance_note: 'Higher limits may trigger spam filters and hurt deliverability. 30/day is the recommended maximum for cold outreach.'
        },
        email_gap_minutes: { default: 10, description: 'Minutes between emails from same account' }
      }
    }
  };

  // Add specific next steps based on current state
  if (eligibleAccounts.length === 0) {
    guidance.next_steps.push({
      priority: 'critical',
      action: 'fix_account_issues',
      description: 'Resolve account eligibility issues before proceeding',
      details: accountAnalysis.ineligible_emails
    });
  } else {
    guidance.next_steps.push({
      priority: 'recommended',
      action: 'review_available_accounts',
      description: `You have ${eligibleAccounts.length} eligible sending accounts available`,
      accounts: accountAnalysis.eligible_emails
    });
  }

  if (missingFields.length > 0) {
    guidance.next_steps.push({
      priority: 'required',
      action: 'provide_missing_fields',
      description: `Provide the following required fields: ${missingFields.join(', ')}`,
      missing_fields: missingFields
    });
  }

  if (emailValidation && !emailValidation.validation_passed) {
    guidance.next_steps.push({
      priority: 'critical',
      action: 'fix_email_list',
      description: 'Email list contains invalid addresses',
      invalid_emails: emailValidation.invalid_emails,
      suggestion: 'Use only emails from your eligible accounts listed above'
    });
  }

  // Include comprehensive guidance for users
  const fullGuidance = generateCampaignGuidance();

  return {
    stage: 'prerequisite_check',
    status: hasAllRequired && eligibleAccounts.length > 0 && (!emailValidation || emailValidation.validation_passed)
      ? 'ready_for_creation'
      : 'missing_requirements',
    message: hasAllRequired
      ? 'All required fields provided. Ready to create campaign.'
      : `Missing required information. Please provide: ${missingFields.join(', ')}`,
    account_analysis: accountAnalysis,
    field_analysis: providedFields,
    validation_results: emailValidation,
    step_by_step_guidance: guidance,
    comprehensive_guide: fullGuidance,
    ready_for_next_stage: hasAllRequired && eligibleAccounts.length > 0 && (!emailValidation || emailValidation.validation_passed)
  };
}

// Comprehensive user guidance for campaign creation
function generateCampaignGuidance(): any {
  return {
    getting_started: {
      title: 'Campaign Creation Quick Start Guide',
      overview: 'Creating successful email campaigns requires proper setup and understanding of key requirements.',
      essential_first_step: {
        action: 'Call list_accounts first',
        reason: 'You need to see which email accounts are available and eligible for sending',
        command: 'list_accounts {"get_all": true}'
      }
    },

    required_fields: {
      name: {
        description: 'Campaign identifier for your reference',
        examples: ['Q4 Product Launch Campaign', 'Holiday Sales Outreach', 'Partnership Inquiry - SaaS Companies'],
        tips: ['Be descriptive but concise', 'Include target audience or purpose', 'Use consistent naming convention']
      },
      subject: {
        description: 'Email subject line that recipients see',
        best_practices: [
          'Keep under 50 characters for better open rates',
          'Personalize with {{firstName}} or {{companyName}}',
          'Be specific and relevant to recipient',
          'Avoid spam trigger words (FREE, URGENT, etc.)'
        ],
        examples: [
          '{{firstName}}, quick question about {{companyName}}',
          'Helping {{companyName}} with [specific problem]',
          '{{firstName}}, saw your recent [achievement/news]'
        ]
      },
      body: {
        description: 'Main email content',
        formatting_rules: [
          'Use plain text with \\n for line breaks - they will be automatically converted to <br /> tags for HTML email rendering',
          'Double line breaks (\\n\\n) create new paragraphs with <p> tags',
          'Single line breaks (\\n) become <br /> tags within paragraphs',
          'Personalize with {{firstName}}, {{lastName}}, {{companyName}}',
          'Avoid escaped characters like \\" or \\t',
          'The tool automatically handles HTML conversion - just use \\n in your input'
        ],
        structure_template: 'Hi {{firstName}},\\n\\n[Opening line referencing something specific about them/their company]\\n\\n[Your value proposition or question]\\n\\n[Clear call to action]\\n\\nBest regards,\\n[Your name]',
        example: 'Hi {{firstName}},\\n\\nI noticed {{companyName}} recently expanded into the European market. Congratulations!\\n\\nI help companies like yours streamline their international operations. Would you be open to a brief conversation about how we could support your expansion?\\n\\nBest regards,\\nJohn Smith',
        html_conversion_note: 'This example will be automatically converted to proper HTML with <p> tags for paragraphs and <br /> tags for line breaks'
      },
      email_list: {
        description: 'Sender email addresses from your verified accounts',
        constraints: [
          'Must use emails from your verified Instantly accounts',
          'Only one sender email per campaign creation call',
          'Accounts must be active (status=1) and warmed up (warmup_status=1)'
        ],
        how_to_find: 'Call list_accounts to see available options',
        example: ['john@yourcompany.com']
      }
    },

    optional_settings_explained: {
      tracking: {
        track_opens: 'Tracks when recipients open your emails (recommended: true)',
        track_clicks: 'Tracks when recipients click links in your emails (recommended: true)'
      },
      scheduling: {
        timezone: 'Timezone for sending schedule (default: America/New_York)',
        timing_from: 'Start time for sending in 24h format (default: 09:00)',
        timing_to: 'End time for sending in 24h format (default: 17:00)',
        days: 'Days of week for sending (default: Monday-Friday only)'
      },
      limits: {
        daily_limit: 'Maximum emails per day per account (default: 30 for cold email compliance)',
        email_gap_minutes: 'Minutes between emails from same account (default: 10)'
      },
      behavior: {
        stop_on_reply: 'Stop campaign when recipient replies (default: true)',
        stop_on_auto_reply: 'Stop on auto-replies like out-of-office (default: true)'
      },
      sequences: {
        sequence_steps: 'Number of emails in the sequence (default: 1 for single email, max: 10)',
        step_delay_days: 'Days between each follow-up email (default: 3 days)',
        sequence_bodies: 'Optional custom email content for each step (array of strings)',
        sequence_subjects: 'Optional custom subject lines for each step (array of strings)',
        when_to_use: 'Multi-step sequences are effective for cold outreach, nurturing leads, and following up on proposals',
        best_practices: [
          'Start with 2-3 steps for cold outreach',
          'Increase value with each follow-up',
          'Reference previous emails in follow-ups',
          'Space follow-ups 3-7 days apart',
          'Personalize each step differently'
        ]
      }
    },

    common_mistakes: [
      {
        mistake: 'Not calling list_accounts first',
        consequence: 'Using invalid email addresses that cause campaign creation to fail',
        solution: 'Always call list_accounts to see available sender emails'
      },
      {
        mistake: 'Using escaped characters in email body',
        consequence: 'Email body appears with literal \\n instead of line breaks',
        solution: 'Use plain \\n characters - they will be automatically converted to <br /> tags for HTML rendering'
      },
      {
        mistake: 'Subject lines too long',
        consequence: 'Poor open rates due to truncated subjects',
        solution: 'Keep subjects under 50 characters'
      },
      {
        mistake: 'Setting daily limits too high',
        consequence: 'Triggers spam filters and hurts deliverability',
        solution: 'Use maximum 30 emails per day for cold outreach compliance'
      },
      {
        mistake: 'Enabling email tracking',
        consequence: 'Reduced deliverability and privacy compliance issues',
        solution: 'Keep tracking disabled unless analytics are absolutely necessary'
      },
      {
        mistake: 'Generic, non-personalized content',
        consequence: 'Low response rates and potential spam classification',
        solution: 'Use personalization variables and specific, relevant content'
      }
    ],

    success_checklist: [
      '✓ Called list_accounts to verify available sender emails',
      '✓ Campaign name is descriptive and follows your naming convention',
      '✓ Subject line is under 50 characters and personalized',
      '✓ Email body uses \\n for line breaks (automatically converted to HTML)',
      '✓ Content is personalized and relevant to recipients',
      '✓ Sender email is from verified, warmed-up account',
      '✓ Daily limit set to 30 or less for cold email compliance',
      '✓ Email tracking disabled for better deliverability',
      '✓ Sending schedule matches your target audience timezone',
      '✓ Multi-step sequences configured appropriately (if using)'
    ]
  };
}

// Smart defaults system for campaign creation
function applySmartDefaults(args: any): any {
  const defaultsApplied: string[] = [];
  const enhancedArgs = { ...args };

  // Apply tracking defaults (disabled for better deliverability)
  if (enhancedArgs.track_opens === undefined) {
    enhancedArgs.track_opens = false;
    defaultsApplied.push('track_opens: false (disabled for better deliverability and privacy compliance)');
  }

  if (enhancedArgs.track_clicks === undefined) {
    enhancedArgs.track_clicks = false;
    defaultsApplied.push('track_clicks: false (disabled for better deliverability and privacy compliance)');
  }

  // Apply scheduling defaults
  if (enhancedArgs.timezone === undefined) {
    enhancedArgs.timezone = 'America/New_York';
    defaultsApplied.push('timezone: America/New_York (Eastern Time - adjust if needed)');
  }

  if (enhancedArgs.timing_from === undefined) {
    enhancedArgs.timing_from = '09:00';
    defaultsApplied.push('timing_from: 09:00 (9 AM start time for business hours)');
  }

  if (enhancedArgs.timing_to === undefined) {
    enhancedArgs.timing_to = '17:00';
    defaultsApplied.push('timing_to: 17:00 (5 PM end time for business hours)');
  }

  // Apply sending limit defaults
  if (enhancedArgs.daily_limit === undefined) {
    enhancedArgs.daily_limit = 30;
    defaultsApplied.push('daily_limit: 30 (compliant limit for cold email outreach)');
  }

  if (enhancedArgs.email_gap_minutes === undefined) {
    enhancedArgs.email_gap_minutes = 10;
    defaultsApplied.push('email_gap_minutes: 10 (10-minute gaps between emails from same account)');
  }

  // Apply behavior defaults
  if (enhancedArgs.stop_on_reply === undefined) {
    enhancedArgs.stop_on_reply = true;
    defaultsApplied.push('stop_on_reply: true (stops campaign when recipient replies)');
  }

  if (enhancedArgs.stop_on_auto_reply === undefined) {
    enhancedArgs.stop_on_auto_reply = true;
    defaultsApplied.push('stop_on_auto_reply: true (stops on auto-replies like out-of-office)');
  }

  // Apply days of week defaults (Monday-Friday)
  if (enhancedArgs.days === undefined) {
    enhancedArgs.days = {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false
    };
    defaultsApplied.push('days: Monday-Friday only (weekends excluded for business outreach)');
  }

  // Apply sequence defaults
  if (enhancedArgs.sequence_steps === undefined) {
    enhancedArgs.sequence_steps = 1;
    defaultsApplied.push('sequence_steps: 1 (single email campaign)');
  }

  if (enhancedArgs.step_delay_days === undefined) {
    enhancedArgs.step_delay_days = 3;
    defaultsApplied.push('step_delay_days: 3 (3-day delay between follow-ups)');
  }

  // Handle sequence arrays - ensure they match sequence_steps count
  const sequenceSteps = enhancedArgs.sequence_steps || 1;

  // If sequence_bodies is provided but incomplete, extend it
  if (enhancedArgs.sequence_bodies !== undefined) {
    if (!Array.isArray(enhancedArgs.sequence_bodies)) {
      enhancedArgs.sequence_bodies = [];
    }

    // Extend array to match sequence_steps if needed
    while (enhancedArgs.sequence_bodies.length < sequenceSteps) {
      if (enhancedArgs.sequence_bodies.length === 0) {
        // First item uses the main body
        enhancedArgs.sequence_bodies.push(enhancedArgs.body || '');
      } else {
        // Additional items use follow-up template
        const stepNumber = enhancedArgs.sequence_bodies.length + 1;
        enhancedArgs.sequence_bodies.push(`Follow-up #${stepNumber}:\n\n${enhancedArgs.body || ''}`);
      }
    }

    if (enhancedArgs.sequence_bodies.length > 0) {
      defaultsApplied.push(`sequence_bodies: Extended to ${sequenceSteps} items to match sequence_steps`);
    }
  } else if (sequenceSteps > 1) {
    // Auto-generate sequence bodies for multi-step campaigns
    enhancedArgs.sequence_bodies = [];
    for (let i = 0; i < sequenceSteps; i++) {
      if (i === 0) {
        enhancedArgs.sequence_bodies.push(enhancedArgs.body || '');
      } else {
        enhancedArgs.sequence_bodies.push(`Follow-up #${i + 1}:\n\n${enhancedArgs.body || ''}`);
      }
    }
    defaultsApplied.push(`sequence_bodies: Auto-generated ${sequenceSteps} follow-up templates`);
  }

  // If sequence_subjects is provided but incomplete, extend it
  if (enhancedArgs.sequence_subjects !== undefined) {
    if (!Array.isArray(enhancedArgs.sequence_subjects)) {
      enhancedArgs.sequence_subjects = [];
    }

    // Extend array to match sequence_steps if needed
    while (enhancedArgs.sequence_subjects.length < sequenceSteps) {
      if (enhancedArgs.sequence_subjects.length === 0) {
        // First item uses the main subject
        enhancedArgs.sequence_subjects.push(enhancedArgs.subject || '');
      } else {
        // Additional items use follow-up template
        enhancedArgs.sequence_subjects.push(`Follow-up: ${enhancedArgs.subject || ''}`);
      }
    }

    if (enhancedArgs.sequence_subjects.length > 0) {
      defaultsApplied.push(`sequence_subjects: Extended to ${sequenceSteps} items to match sequence_steps`);
    }
  } else if (sequenceSteps > 1) {
    // Auto-generate sequence subjects for multi-step campaigns
    enhancedArgs.sequence_subjects = [];
    for (let i = 0; i < sequenceSteps; i++) {
      if (i === 0) {
        enhancedArgs.sequence_subjects.push(enhancedArgs.subject || '');
      } else {
        enhancedArgs.sequence_subjects.push(`Follow-up: ${enhancedArgs.subject || ''}`);
      }
    }
    defaultsApplied.push(`sequence_subjects: Auto-generated ${sequenceSteps} follow-up subjects`);
  }

  return {
    enhanced_args: enhancedArgs,
    defaults_applied: defaultsApplied,
    defaults_explanation: {
      message: 'Smart defaults have been applied to optimize your campaign for deliverability and engagement',
      applied_defaults: defaultsApplied,
      customization_note: 'You can override any of these defaults by explicitly providing values in your next call'
    }
  };
}

// Convert plain text line breaks to HTML for Instantly.ai email rendering
function convertLineBreaksToHTML(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Normalize line endings to \n
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split by double line breaks to create paragraphs
  const paragraphs = normalized.split('\n\n');

  return paragraphs
    .map(paragraph => {
      // Skip empty paragraphs
      if (!paragraph.trim()) {
        return '';
      }

      // Convert single line breaks within paragraphs to <br /> tags
      const withBreaks = paragraph.trim().replace(/\n/g, '<br />');

      // Wrap in paragraph tags for proper HTML structure
      return `<p>${withBreaks}</p>`;
    })
    .filter(p => p) // Remove empty paragraphs
    .join('');
}

// Build campaign payload with proper HTML formatting for Instantly.ai
function buildCampaignPayload(args: any): any {
  if (!args) {
    throw new McpError(ErrorCode.InvalidParams, 'Campaign arguments are required');
  }

  // Process message shortcut if provided
  if (args.message && (!args.subject || !args.body)) {
    const msg = String(args.message).trim();
    let splitIdx = msg.indexOf('.');
    const nlIdx = msg.indexOf('\n');
    if (nlIdx !== -1 && (nlIdx < splitIdx || splitIdx === -1)) splitIdx = nlIdx;
    if (splitIdx === -1) splitIdx = msg.length;
    const subj = msg.slice(0, splitIdx).trim();
    const bod = msg.slice(splitIdx).trim();
    if (!args.subject) args.subject = subj;
    if (!args.body) args.body = bod || subj;
  }

  // Apply timezone and days configuration
  const timezone = args?.timezone || 'America/New_York';
  const userDays = (args?.days as any) || {};
  const daysConfig = {
    0: userDays.sunday === true,
    1: userDays.monday !== false,
    2: userDays.tuesday !== false,
    3: userDays.wednesday !== false,
    4: userDays.thursday !== false,
    5: userDays.friday !== false,
    6: userDays.saturday === true
  };

  // Normalize and convert body content for HTML email rendering
  let normalizedBody = String(args.body).trim();
  let normalizedSubject = String(args.subject).trim();

  // CRITICAL: Convert \n line breaks to <br /> tags for Instantly.ai HTML rendering
  normalizedBody = convertLineBreaksToHTML(normalizedBody);

  // Subjects should not have line breaks
  normalizedSubject = normalizedSubject.replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ' ');

  const campaignData: any = {
    name: args.name,
    // CRITICAL: Add required fields that were missing
    subject: normalizedSubject,
    body: normalizedBody,
    from_email: args.email_list[0], // Use first email as sender
    from_name: args.from_name || 'Campaign Sender',
    email_list: args.email_list,
    daily_limit: args.daily_limit || 30, // Updated default to 30 for cold email compliance
    email_gap: args.email_gap_minutes || 10,
    // Fix field names to match API expectations (corrected based on API docs)
    open_tracking: Boolean(args.track_opens),
    link_tracking: Boolean(args.track_clicks),
    stop_on_reply: args.stop_on_reply !== false,
    stop_on_auto_reply: args.stop_on_auto_reply !== false,
    text_only: Boolean(args.text_only),
    campaign_schedule: {
      schedules: [{
        name: args.schedule_name || 'Default Schedule',
        timing: {
          from: args.timing_from || '09:00',
          to: args.timing_to || '17:00'
        },
        days: daysConfig,
        timezone: timezone
      }]
    },
    sequences: [{
      steps: [{
        type: 'email',
        delay: 0,
        variants: [{
          subject: normalizedSubject,
          body: normalizedBody,
          v_disabled: false
        }]
      }]
    }]
  };

  // Handle multi-step sequences if specified
  const sequenceSteps = args?.sequence_steps || 1;
  const stepDelayDays = args?.step_delay_days || 3;

  if (sequenceSteps > 1) {
    const hasCustomBodies = args?.sequence_bodies && Array.isArray(args.sequence_bodies);
    const hasCustomSubjects = args?.sequence_subjects && Array.isArray(args.sequence_subjects);

    // Update the first step if custom content is provided
    if (hasCustomBodies || hasCustomSubjects) {
      const firstStepBody = hasCustomBodies ? convertLineBreaksToHTML(String(args.sequence_bodies[0])) : normalizedBody;
      const firstStepSubject = hasCustomSubjects ? String(args.sequence_subjects[0]) : normalizedSubject;

      campaignData.sequences[0].steps[0].variants[0].body = firstStepBody;
      campaignData.sequences[0].steps[0].variants[0].subject = firstStepSubject;
    }

    // Add follow-up steps
    for (let i = 1; i < sequenceSteps; i++) {
      let followUpSubject: string;
      let followUpBody: string;

      // Determine subject for this step
      if (hasCustomSubjects) {
        followUpSubject = String(args.sequence_subjects[i]);
      } else {
        followUpSubject = `Follow-up: ${normalizedSubject}`;
      }

      // Determine body for this step
      if (hasCustomBodies) {
        // Use provided custom body with HTML conversion
        followUpBody = convertLineBreaksToHTML(String(args.sequence_bodies[i]));
      } else {
        // Default behavior: add follow-up prefix to original body
        followUpBody = `This is follow-up #${i}.\n\n${args.body}`.trim();
        followUpBody = convertLineBreaksToHTML(followUpBody);
      }

      campaignData.sequences[0].steps.push({
        type: 'email',
        delay: stepDelayDays,
        variants: [{
          subject: followUpSubject,
          body: followUpBody,
          v_disabled: false
        }]
      });
    }
  }

  return campaignData;
}

// Helper function to validate sender email addresses against eligible accounts
// email_list contains SENDER email addresses that must be from verified Instantly accounts
async function validateEmailListAgainstAccounts(emailList: string[], apiKey?: string): Promise<void> {
  try {
    console.error('[Instantly MCP] 🔍 Validating sender email addresses against accounts...');

    // Add timeout protection to prevent hanging - increased to 90 seconds for large account lists
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Account validation timeout after 90 seconds. This may indicate a large number of accounts or slow API response.')), 90000);
    });

    const accountsPromise = getAllAccounts(apiKey);
    const accounts = await Promise.race([accountsPromise, timeoutPromise]) as any[];

    if (!accounts || accounts.length === 0) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'No accounts found in your workspace. Please add at least one account before creating campaigns.'
      );
    }

    // Filter to eligible accounts (status=1, not setup_pending, warmup_status=1)
    const eligibleAccounts = accounts.filter(account =>
      account.status === 1 &&
      !account.setup_pending &&
      account.warmup_status === 1
    );

    if (eligibleAccounts.length === 0) {
      const accountIssues = accounts.map(acc => ({
        email: acc.email,
        issues: [
          ...(acc.status !== 1 ? ['Account not active'] : []),
          ...(acc.setup_pending ? ['Setup pending'] : []),
          ...(acc.warmup_status !== 1 ? ['Warmup not complete'] : [])
        ]
      }));

      throw new McpError(
        ErrorCode.InvalidParams,
        `No eligible sender accounts found for campaign creation. Account issues:\n${
          accountIssues.map(acc => `• ${acc.email}: ${acc.issues.join(', ')}`).join('\n')
        }\n\nPlease ensure accounts are active, setup is complete, and warmup is finished before creating campaigns.`
      );
    }

    // Create set of eligible email addresses for validation
    const eligibleEmails = new Set<string>();
    const eligibleEmailsForDisplay: string[] = [];

    for (const account of eligibleAccounts) {
      eligibleEmails.add(account.email.toLowerCase());
      eligibleEmailsForDisplay.push(`${account.email} (warmup: ${account.warmup_score || 'N/A'})`);
    }

    // Validate each sender email in the provided list
    const invalidEmails: string[] = [];
    for (const email of emailList) {
      if (!eligibleEmails.has(email.toLowerCase())) {
        invalidEmails.push(email);
      }
    }

    if (invalidEmails.length > 0) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid sender email addresses found in email_list: ${invalidEmails.join(', ')}\n\n` +
        `Available eligible sender accounts:\n${eligibleEmailsForDisplay.map(email => `• ${email}`).join('\n')}\n\n` +
        `Please use only verified sender email addresses from your Instantly workspace. Call list_accounts to see all available accounts.`
      );
    }

    console.error(`[Instantly MCP] ✅ Validated ${emailList.length} sender email(s) against ${eligibleAccounts.length} eligible accounts`);

  } catch (error: any) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to validate email addresses: ${error.message}`
    );
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
        description: 'Create a new email campaign with intelligent guidance and validation. Automatically provides comprehensive prerequisite checking, account validation, and user-friendly error messages. Call with minimal information to get detailed guidance on requirements.',
        inputSchema: {
          type: 'object',
          properties: {
            // Core required fields
            name: {
              type: 'string',
              description: 'Campaign name for identification (e.g., "Q4 Product Launch Campaign")'
            },
            subject: {
              type: 'string',
              description: 'Email subject line. Keep under 50 characters. Use personalization: {{firstName}}, {{companyName}}'
            },
            body: {
              type: 'string',
              description: 'Email body content. Use plain text with \\n for line breaks - they will be automatically converted to <br /> tags for HTML email rendering in Instantly.ai. Double line breaks (\\n\\n) create paragraphs. Personalization: {{firstName}}, {{lastName}}, {{companyName}}. Example: "Hi {{firstName}},\\n\\nI hope this finds you well.\\n\\nBest regards"'
            },
            email_list: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of sender email addresses. Must be from your verified accounts (call list_accounts first to see options). Only one email per campaign creation call.',
              example: ['john@yourcompany.com']
            },

            // Tracking settings (disabled by default for better deliverability)
            track_opens: {
              type: 'boolean',
              description: 'Track when recipients open emails (disabled by default for better deliverability and privacy compliance)',
              default: false
            },
            track_clicks: {
              type: 'boolean',
              description: 'Track when recipients click links (disabled by default for better deliverability and privacy compliance)',
              default: false
            },

            // Scheduling options
            timezone: {
              type: 'string',
              description: 'Timezone for sending schedule',
              default: 'America/New_York',
              example: 'America/New_York'
            },
            timing_from: {
              type: 'string',
              description: 'Start time for sending (24h format)',
              default: '09:00',
              pattern: '^([01][0-9]|2[0-3]):([0-5][0-9])$'
            },
            timing_to: {
              type: 'string',
              description: 'End time for sending (24h format)',
              default: '17:00',
              pattern: '^([01][0-9]|2[0-3]):([0-5][0-9])$'
            },

            // Sending limits
            daily_limit: {
              type: 'number',
              description: 'Maximum emails per day per account (30 recommended for cold email compliance)',
              default: 30,
              minimum: 1,
              maximum: 30
            },
            email_gap_minutes: {
              type: 'number',
              description: 'Minutes between emails from same account',
              default: 10,
              minimum: 1,
              maximum: 1440
            },

            // Campaign behavior
            stop_on_reply: {
              type: 'boolean',
              description: 'Stop campaign when recipient replies',
              default: true
            },

            // Multi-step sequence configuration
            sequence_steps: {
              type: 'number',
              description: 'Number of follow-up emails in the sequence (1 = single email, 2-10 = multi-step sequence)',
              default: 1,
              minimum: 1,
              maximum: 10
            },
            step_delay_days: {
              type: 'number',
              description: 'Days between each step in the sequence',
              default: 3,
              minimum: 1,
              maximum: 30
            },
            sequence_bodies: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional: Custom email body content for each step. If not provided, follow-ups will use default templates. Must have at least sequence_steps items.'
            },
            sequence_subjects: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional: Custom subject lines for each step. If not provided, follow-ups will use "Follow-up: [original subject]". Must have at least sequence_steps items.'
            }
          },
          required: ['name', 'subject', 'body', 'email_list'],
          additionalProperties: true
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
        description: 'Get detailed campaign performance analytics with optional date range filtering. Supports filtering by specific campaign ID and/or date range (start_date, end_date). Call without parameters to get analytics for all campaigns.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: {
              type: 'string',
              description: 'Campaign ID to filter analytics (optional). Omit to get analytics for all campaigns.'
            },
            start_date: {
              type: 'string',
              description: 'Start date for analytics range in YYYY-MM-DD format (optional). Example: 2024-01-01',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$'
            },
            end_date: {
              type: 'string',
              description: 'End date for analytics range in YYYY-MM-DD format (optional). Example: 2024-12-31',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$'
            }
          },
          required: [],
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
        description: 'Get email warmup analytics for one or more email accounts. Supports both single email and multiple emails.',
        inputSchema: {
          type: 'object',
          properties: {
            emails: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of email addresses to get warmup analytics for (e.g., ["user@example.com"])'
            },
            email: {
              type: 'string',
              description: 'Single email address (will be converted to array internally for API compatibility)'
            },
            start_date: {
              type: 'string',
              description: 'Start date for analytics range in YYYY-MM-DD format (optional)',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$'
            },
            end_date: {
              type: 'string',
              description: 'End date for analytics range in YYYY-MM-DD format (optional)',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$'
            }
          },
          required: [],
          additionalProperties: false
        }
      },
      {
        name: 'list_leads',
        description: 'List multiple leads with filtering and pagination using POST /leads/list endpoint. **WARNING**: When get_all=true, this may take 30-60+ seconds for large datasets as it automatically paginates through ALL pages.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'string', description: 'Filter by campaign ID (optional)' },
            list_id: { type: 'string', description: 'Filter by list ID (optional)' },
            status: { type: 'string', description: 'Filter by lead status (optional)' },
            limit: { type: 'number', description: 'Number of leads per page (1-100, default: 20). When get_all=true, this is automatically set to 100 for efficiency.', minimum: 1, maximum: 100 },
            skip: { type: 'number', description: 'Number of leads to skip for pagination (default: 0). Only used when get_all=false.', minimum: 0 },
            starting_after: { type: 'string', description: 'Lead ID to start pagination after (from previous response next_starting_after field). Only used when get_all=false.' },
            get_all: {
              type: 'boolean',
              description: 'When true: Automatically retrieves ALL leads across ALL pages (may take 30-60+ seconds for large datasets). When false: Returns single page only. Default: false',
              default: false
            }
          },
          additionalProperties: false
        }
      },
      {
        name: 'get_lead',
        description: 'Get details of a specific lead by ID using GET /leads/{id} endpoint',
        inputSchema: {
          type: 'object',
          properties: {
            lead_id: { type: 'string', description: 'ID of the lead to retrieve' }
          },
          required: ['lead_id'],
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
        description: 'Get comprehensive analytics overview across all campaigns with optional date range filtering. Provides aggregated metrics and performance summaries. Both date parameters are optional - omit for all-time analytics.',
        inputSchema: {
          type: 'object',
          properties: {
            start_date: {
              type: 'string',
              description: 'Start date for analytics range in YYYY-MM-DD format (optional). Example: 2024-01-01',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$'
            },
            end_date: {
              type: 'string',
              description: 'End date for analytics range in YYYY-MM-DD format (optional). Example: 2024-12-31',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$'
            }
          },
          required: [],
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

// Shared tool execution function that can be called from both MCP and HTTP handlers
async function executeToolDirectly(name: string, args: any, apiKey?: string): Promise<any> {
  console.error(`[Instantly MCP] 🔧 Executing tool directly: ${name}`);
  console.error(`[Instantly MCP] 🔍 Tool arguments:`, JSON.stringify(args, null, 2));

  // Extract API key from multiple sources if not provided
  if (!apiKey) {
    // Method 1: Check if API key is provided in args
    if (args && typeof args === 'object' && 'apiKey' in args) {
      apiKey = (args as any).apiKey;
      // Remove apiKey from args to avoid passing it to tool functions
      delete (args as any).apiKey;
      console.error(`[Instantly MCP] 🔑 API key extracted from args`);
    }

    // Method 2: Fall back to environment variable
    if (!apiKey) {
      apiKey = INSTANTLY_API_KEY;
      console.error(`[Instantly MCP] 🔑 API key from environment variable`);
    }
  }

  if (!apiKey) {
    throw new McpError(ErrorCode.InvalidParams, 'Instantly API key is required. Provide via x-instantly-api-key header (HTTP) or INSTANTLY_API_KEY environment variable (stdio).');
  }

  // Check rate limit status
  if (rateLimiter.isRateLimited()) {
    throw new McpError(ErrorCode.InternalError, `Rate limited. ${rateLimiter.getRateLimitMessage()}`);
  }

  // Execute the tool logic (this is the same logic from the main MCP handler)
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

    case 'list_campaigns': {
      console.error('[Instantly MCP] 📋 Executing list_campaigns...');

      const makeRequestWithKey = (endpoint: string, options: any = {}) =>
        makeInstantlyRequest(endpoint, options, apiKey);
      const campaigns = await paginateInstantlyAPI('/campaigns', makeRequestWithKey);

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
    }

    case 'get_campaign': {
      if (!args?.campaign_id) {
        throw new McpError(ErrorCode.InvalidParams, 'campaign_id is required');
      }

      const result = await makeInstantlyRequest(`/campaigns/${args.campaign_id}`, {}, apiKey);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case 'get_campaign_analytics': {
      try {
        // Validate parameters with Zod v4 schema
        const validatedArgs = validateGetCampaignAnalyticsData(args);

        // Use the correct Instantly API endpoint from official documentation
        // Official endpoint: https://api.instantly.ai/api/v2/campaigns/analytics
        // IMPORTANT: API uses 'id' parameter, not 'campaign_id'
        const apiParams: any = { ...validatedArgs };
        if (apiParams.campaign_id) {
          apiParams.id = apiParams.campaign_id;
          delete apiParams.campaign_id;
        }

        const queryParams = buildQueryParams(apiParams, ['id', 'start_date', 'end_date']);
        const endpoint = `/campaigns/analytics${queryParams.toString() ? `?${queryParams}` : ''}`;

        console.error(`[Instantly MCP] get_campaign_analytics endpoint (PARAMETER FIX): ${endpoint}`);
        console.error(`[Instantly MCP] Full URL will be: ${INSTANTLY_API_URL}${endpoint}`);
        console.error(`[Instantly MCP] Original parameters: ${JSON.stringify(validatedArgs, null, 2)}`);
        console.error(`[Instantly MCP] API parameters (campaign_id->id): ${JSON.stringify(apiParams, null, 2)}`);

        const result = await makeInstantlyRequest(endpoint, {}, apiKey);

        // With the correct parameter names, server-side filtering should work natively
        // Add metadata about the parameter fix for transparency
        const enhancedResult = validatedArgs?.campaign_id ? {
          ...result,
          _metadata: {
            filtered_by_campaign_id: validatedArgs.campaign_id,
            endpoint_used: endpoint,
            filtering_method: "server_side",
            parameter_mapping: "campaign_id -> id",
            note: "Using correct Instantly.ai API endpoint /campaigns/analytics with proper parameter names (campaign_id mapped to id)"
          }
        } : result;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(enhancedResult, null, 2),
            },
          ],
        };
      } catch (error: any) {
        // Enhanced error handling for campaign analytics with detailed debugging
        console.error(`[Instantly MCP] get_campaign_analytics ERROR:`, error);
        console.error(`[Instantly MCP] Error details:`, {
          message: error.message,
          status: error.status,
          statusCode: error.statusCode,
          response: error.response?.data || error.response,
          endpoint: '/campaigns/analytics'
        });

        if (error.message?.includes('404') && args?.campaign_id) {
          // If specific campaign not found, try to provide helpful guidance
          throw new McpError(
            ErrorCode.InvalidParams,
            `Campaign analytics not found for campaign_id: ${args.campaign_id}. ` +
            `This could mean: 1) Campaign ID is invalid, 2) Campaign has no analytics data yet, ` +
            `or 3) You don't have access to this campaign. Try calling without campaign_id to see all available campaigns. ` +
            `DEBUG: Endpoint used was /campaigns/analytics with parameter mapping campaign_id->id`
          );
        } else if (error.message?.includes('404')) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Campaign analytics endpoint not available. The Instantly API may not support analytics for your account type. ` +
            `DEBUG: Endpoint used was /campaigns/analytics. This should be the correct endpoint per official API docs.`
          );
        }
        // Re-throw other errors as-is
        throw error;
      }
    }

    case 'get_campaign_analytics_overview': {
      const queryParams = buildQueryParams(args, ['start_date', 'end_date']);

      const endpoint = `/campaigns/analytics/overview${queryParams.toString() ? `?${queryParams}` : ''}`;
      const result = await makeInstantlyRequest(endpoint, {}, apiKey);

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
      // This is a complex tool that requires special handling
      // Route to the existing create_campaign implementation in the HTTP handler
      throw new McpError(ErrorCode.InvalidRequest,
        'create_campaign requires special workflow handling. Use the enhanced create_campaign tool with stage parameters for proper campaign creation.');
    }

    case 'update_campaign': {
      if (!args?.campaign_id) {
        throw new McpError(ErrorCode.InvalidParams, 'campaign_id is required');
      }

      const updateData: any = {};
      if (args.name) updateData.name = args.name;
      if (args.status) updateData.status = args.status;

      const result = await makeInstantlyRequest(`/campaigns/${args.campaign_id}`, {
        method: 'PATCH',
        body: updateData
      }, apiKey);

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

      const result = await makeInstantlyRequest(`/campaigns/${args.campaign_id}/activate`, {
        method: 'POST'
      }, apiKey);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case 'create_account': {
      if (!args?.email) {
        throw new McpError(ErrorCode.InvalidParams, 'email is required');
      }

      const accountData = {
        email: args.email,
        smtp_host: args.smtp_host,
        smtp_port: args.smtp_port,
        smtp_username: args.smtp_username,
        smtp_password: args.smtp_password,
        ...args
      };

      const result = await makeInstantlyRequest('/accounts', {
        method: 'POST',
        body: accountData
      }, apiKey);

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
      if (!args?.email) {
        throw new McpError(ErrorCode.InvalidParams, 'email is required');
      }

      const result = await makeInstantlyRequest(`/accounts/${args.email}`, {
        method: 'PATCH',
        body: args.settings || {}
      }, apiKey);

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
      // Handle both single email and emails array for user convenience
      let emailsArray: string[] = [];

      if (args?.emails && Array.isArray(args.emails)) {
        emailsArray = args.emails;
      } else if (args?.email && typeof args.email === 'string') {
        emailsArray = [args.email];
      } else {
        throw new McpError(ErrorCode.InvalidParams, 'Either "email" (string) or "emails" (array) is required');
      }

      // Validate email array
      if (emailsArray.length === 0) {
        throw new McpError(ErrorCode.InvalidParams, 'At least one email address is required');
      }

      console.error(`[Instantly MCP] get_warmup_analytics for emails: ${JSON.stringify(emailsArray)}`);

      // Use POST method with JSON body as per official API documentation
      const requestBody: any = { emails: emailsArray };

      // Add optional date parameters to the body if provided
      if (args?.start_date) requestBody.start_date = args.start_date;
      if (args?.end_date) requestBody.end_date = args.end_date;

      console.error(`[Instantly MCP] POST body: ${JSON.stringify(requestBody, null, 2)}`);

      const result = await makeInstantlyRequest('/accounts/warmup-analytics', {
        method: 'POST',
        body: requestBody
      }, apiKey);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case 'verify_email': {
      // Validate parameters with Zod schema
      const validatedArgs = validateEmailVerificationData(args);

      const result = await makeInstantlyRequest('/email-verification', {
        method: 'POST',
        body: { email: validatedArgs.email }
      }, apiKey);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case 'list_leads': {
      console.error('[Instantly MCP] 📋 Executing list_leads...');

      // Check if user wants all leads with automatic pagination
      const getAllLeads = args?.get_all === true;

      if (getAllLeads) {
        console.error('[Instantly MCP] 🔄 get_all=true: Starting automatic pagination for all leads...');

        // Build base request body for pagination
        const baseRequestBody: any = {};
        if (args?.campaign_id) baseRequestBody.campaign_id = args.campaign_id;
        if (args?.list_id) baseRequestBody.list_id = args.list_id;
        if (args?.status) baseRequestBody.status = args.status;

        // Use larger page size for efficiency (max 100)
        baseRequestBody.limit = 100;

        let allLeads: any[] = [];
        let currentPage = 1;
        let startingAfter: string | undefined = undefined;
        const maxPages = 500; // Safety limit to prevent infinite loops

        console.error(`[Instantly MCP] 📊 Starting pagination with filters: ${JSON.stringify(baseRequestBody, null, 2)}`);

        while (currentPage <= maxPages) {
          const requestBody = { ...baseRequestBody };
          if (startingAfter) {
            requestBody.starting_after = startingAfter;
          }

          console.error(`[Instantly MCP] 📄 Fetching page ${currentPage} (starting_after: ${startingAfter || 'none'})...`);

          try {
            const pageResult = await makeInstantlyRequest('/leads/list', {
              method: 'POST',
              body: requestBody
            }, apiKey);

            // Add leads from this page
            if (pageResult.items && Array.isArray(pageResult.items)) {
              allLeads.push(...pageResult.items);
              console.error(`[Instantly MCP] ✅ Page ${currentPage}: Retrieved ${pageResult.items.length} leads. Total so far: ${allLeads.length}`);
            } else {
              console.error(`[Instantly MCP] ⚠️ Page ${currentPage}: No items array found in response`);
            }

            // Check if there are more pages
            if (pageResult.next_starting_after) {
              startingAfter = pageResult.next_starting_after;
              currentPage++;

              // Add small delay to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 100));
            } else {
              console.error(`[Instantly MCP] 🏁 Pagination complete! No more pages. Total leads retrieved: ${allLeads.length}`);
              break;
            }
          } catch (error) {
            console.error(`[Instantly MCP] ❌ Error on page ${currentPage}:`, error);
            throw error;
          }
        }

        if (currentPage > maxPages) {
          console.error(`[Instantly MCP] ⚠️ Reached maximum page limit (${maxPages}). Total leads retrieved: ${allLeads.length}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                items: allLeads,
                total_retrieved: allLeads.length,
                pages_fetched: currentPage - 1,
                pagination_method: "automatic_complete",
                get_all: true,
                success: true
              }, null, 2),
            },
          ],
        };
      } else {
        // Single page request (original behavior)
        console.error('[Instantly MCP] 📄 Single page request...');

        const requestBody: any = {};

        // Add optional filter parameters
        if (args?.campaign_id) requestBody.campaign_id = args.campaign_id;
        if (args?.list_id) requestBody.list_id = args.list_id;
        if (args?.status) requestBody.status = args.status;
        if (args?.limit) requestBody.limit = args.limit;
        if (args?.skip !== undefined) requestBody.skip = args.skip;
        if (args?.starting_after) requestBody.starting_after = args.starting_after;

        console.error(`[Instantly MCP] list_leads POST body: ${JSON.stringify(requestBody, null, 2)}`);

        const result = await makeInstantlyRequest('/leads/list', {
          method: 'POST',
          body: requestBody
        }, apiKey);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    }

    case 'get_lead': {
      console.error('[Instantly MCP] 🔍 Executing get_lead...');

      if (!args?.lead_id) {
        throw new McpError(ErrorCode.InvalidParams, 'lead_id is required');
      }

      console.error(`[Instantly MCP] get_lead for ID: ${args.lead_id}`);

      const result = await makeInstantlyRequest(`/leads/${args.lead_id}`, {}, apiKey);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    // Add more tools as needed...
    default:
      throw new McpError(ErrorCode.InvalidRequest, `Unknown tool: ${name}`);
  }
}

// Call tool handler - now supports per-request API keys
server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  const { name, arguments: args } = request.params;

  console.error(`[Instantly MCP] 🔧 Tool called via MCP: ${name}`);
  console.error(`[Instantly MCP] 🔍 Debug - Main handler params:`, JSON.stringify(request.params, null, 2));

  // Extract API key from multiple sources
  let apiKey: string | undefined;

  // Method 1: Check if API key is provided in args (from HTTP transport)
  if (args && typeof args === 'object' && 'apiKey' in args) {
    apiKey = (args as any).apiKey;
    // Remove apiKey from args to avoid passing it to tool functions
    delete (args as any).apiKey;
    console.error(`[Instantly MCP] 🔑 API key extracted from args`);
  }

  // Method 2: Check if API key is in extra context (from HTTP transport headers)
  if (!apiKey && extra && typeof extra === 'object') {
    const extraObj = extra as any;
    if (extraObj.headers && extraObj.headers['x-instantly-api-key']) {
      apiKey = extraObj.headers['x-instantly-api-key'];
      console.error(`[Instantly MCP] 🔑 API key extracted from headers`);
    }
  }

  // Method 3: Fall back to environment variable for stdio transport
  if (!apiKey) {
    apiKey = INSTANTLY_API_KEY;
    console.error(`[Instantly MCP] 🔑 API key from environment variable`);
  }

  try {
    // Use the shared tool execution function
    return await executeToolDirectly(name, args, apiKey);
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

  // REMOVED: Old /mcp endpoint that was causing routing conflicts
  // All requests now go through the direct handler at /mcp/:apiKey

  // URL-based authentication endpoint for n8n compatibility
  app.post('/mcp/:apiKey', async (req: any, res: any) => {
    try {
      // Extract API key from URL parameter
      const apiKey = req.params.apiKey;

      if (!apiKey) {
        return res.status(400).json({
          error: 'API key required',
          message: 'Please provide your Instantly.ai API key in the URL path'
        });
      }

      console.error(`[Instantly MCP] 🔗 URL-based auth request with API key: ${apiKey.substring(0, 8)}...`);
      console.error('[Instantly MCP] 🔍 Request body:', JSON.stringify(req.body, null, 2));

      // Set required MCP protocol headers
      res.setHeader('mcp-protocol-version', '2024-11-05');
      res.setHeader('mcp-session-id', req.headers['mcp-session-id'] || `session-${Date.now()}`);

      const { jsonrpc, id, method, params } = req.body;

      // Handle different MCP methods directly (bypass StreamableHTTPServerTransport)

      // MCP Protocol initialization - Required for MCP Inspector
      if (method === 'initialize') {
        console.error('[Instantly MCP] 🔧 Initialize request received from MCP Inspector');
        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {
                listChanged: true,
              },
              resources: {
                subscribe: false,
                listChanged: false,
              },
              prompts: {
                listChanged: false,
              },
              auth: {
                required: false,
              },
            },
            serverInfo: {
              name: 'instantly-mcp',
              version: '1.1.0',
              description: 'Instantly.ai email automation and campaign management tools',
            },
            instructions: 'Use these tools to manage Instantly.ai email campaigns, accounts, and automation workflows.',
          }
        });
      }

      // MCP Protocol initialization complete notification
      if (method === 'initialized' || method === 'notifications/initialized') {
        console.error('[Instantly MCP] ✅ Initialized notification received from MCP Inspector');
        // Notifications don't return responses
        return res.status(204).end();
      }

      // Health/ping check
      if (method === 'ping' || method === 'health') {
        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            server: 'instantly-mcp',
            version: '1.1.0'
          }
        });
      }

      if (method === 'tools/list') {
        return res.json({
          jsonrpc: '2.0',
          id,
          result: { tools: TOOLS_DEFINITION }
        });
      }

      if (method === 'tools/call') {
        const { name, arguments: args } = params;
        console.error(`[Instantly MCP] 🔧 Direct tool call: ${name}`);
        console.error(`[Instantly MCP] 🔍 Tool arguments:`, JSON.stringify(args, null, 2));

        if (name === 'create_campaign') {
          // Call the create_campaign logic directly with proper API key
          try {
            console.error('[Instantly MCP] 🚀 DIRECT HANDLER - create_campaign called');
            console.error('[Instantly MCP] 🔍 DIRECT HANDLER - Raw args:', JSON.stringify(args, null, 2));
            console.error('[Instantly MCP] 🔍 DIRECT HANDLER - args.name:', args?.name, typeof args?.name);
            console.error('[Instantly MCP] 🔍 DIRECT HANDLER - args.subject:', args?.subject, typeof args?.subject);
            console.error('[Instantly MCP] 🔍 DIRECT HANDLER - args.body:', args?.body, typeof args?.body);
            console.error('[Instantly MCP] 🔍 DIRECT HANDLER - args.email_list:', args?.email_list, typeof args?.email_list);

            // SUCCESS! Parameters are now extracted correctly
            console.error('[Instantly MCP] ✅ DIRECT HANDLER - Parameters extracted successfully!');

            // Step 1: Check if this is a minimal request that needs prerequisite gathering
            const hasMinimalInfo = !args?.name || !args?.subject || !args?.body || !args?.email_list;

            if (hasMinimalInfo) {
              console.error('[Instantly MCP] 🔍 Minimal information provided, gathering prerequisites...');
              const prerequisiteResult = await gatherCampaignPrerequisites(args, apiKey);

              return res.json({
                jsonrpc: '2.0',
                id,
                result: {
                  content: [
                    {
                      type: 'text',
                      text: JSON.stringify({
                        stage: 'prerequisite_check',
                        ...prerequisiteResult,
                        next_action: prerequisiteResult.ready_for_next_stage
                          ? 'All requirements met. Call create_campaign again with the same parameters to proceed with creation.'
                          : 'Please provide the missing information and call create_campaign again.'
                      }, null, 2)
                    }
                  ]
                }
              });
            }

            // Step 2: Apply smart defaults and enhancements
            console.error('[Instantly MCP] 🎯 Applying smart defaults and enhancements...');
            const smartDefaultsResult = applySmartDefaults(args);
            const enhanced_args = smartDefaultsResult.enhanced_args;
            // Step 3: Validate the enhanced arguments
            console.error('[Instantly MCP] ✅ Validating enhanced campaign data...');
            const validatedData = await validateCampaignData(enhanced_args);

            // Step 4: Validate sender email addresses against accounts (skip for test API keys or if disabled)
            const skipValidation = process.env.SKIP_ACCOUNT_VALIDATION === 'true';
            if (apiKey && !apiKey.startsWith('test-') && !apiKey.startsWith('real-api') && !skipValidation) {
              console.error('[Instantly MCP] 📧 Validating sender email addresses against accounts...');
              const validationStart = Date.now();
              try {
                await validateEmailListAgainstAccounts(enhanced_args.email_list, apiKey);
                const validationTime = Date.now() - validationStart;
                console.error(`[Instantly MCP] ✅ Account validation completed in ${validationTime}ms`);
              } catch (error) {
                const validationTime = Date.now() - validationStart;
                console.error(`[Instantly MCP] ❌ Account validation failed after ${validationTime}ms:`, error instanceof Error ? error.message : String(error));
                throw error;
              }
            } else {
              if (skipValidation) {
                console.error('[Instantly MCP] ⚠️ Skipping account validation (SKIP_ACCOUNT_VALIDATION=true)');
              } else {
                console.error('[Instantly MCP] ⚠️ Skipping account validation for test/demo API key');
              }
            }

            // Step 5: Build campaign payload with proper HTML formatting
            console.error('[Instantly MCP] 🔧 Building campaign payload with HTML formatting...');
            const campaignPayload = buildCampaignPayload(enhanced_args);

            // DEBUG: Log the exact payload being sent to Instantly.ai API
            console.error('[Instantly MCP] 🔍 DEBUG: Exact payload being sent to Instantly.ai API:');
            console.error(JSON.stringify(campaignPayload, null, 2));

            // Step 6: Create the campaign
            console.error('[Instantly MCP] 🚀 Creating campaign with validated data...');
            const campaignStart = Date.now();
            const startTime = Date.now(); // Add startTime for performance tracking
            let validationTime = 0; // Initialize validation time
            try {
              const response = await makeInstantlyRequest('/campaigns', {
                method: 'POST',
                body: campaignPayload
              }, apiKey);
              const campaignTime = Date.now() - campaignStart;
              console.error(`[Instantly MCP] ✅ Campaign created successfully in ${campaignTime}ms`);

              return res.json({
                jsonrpc: '2.0',
                id,
                result: {
                  content: [
                    {
                      type: 'text',
                      text: JSON.stringify({
                        success: true,
                        message: 'Campaign created successfully',
                        campaign: response,
                        performance: {
                          total_time_ms: Date.now() - startTime,
                          validation_time_ms: validationTime,
                          creation_time_ms: campaignTime
                        }
                      }, null, 2)
                    }
                  ]
                }
              });
            } catch (error) {
              const campaignTime = Date.now() - campaignStart;
              console.error(`[Instantly MCP] ❌ Campaign creation failed after ${campaignTime}ms:`, error instanceof Error ? error.message : String(error));
              throw error;
            }

            // This return statement is now handled in the try block above

          } catch (error) {
            console.error('[Instantly MCP] ❌ Error in direct create_campaign:', error);
            return res.json({
              jsonrpc: '2.0',
              id,
              error: {
                code: -32602,
                message: error instanceof Error ? error.message : 'Unknown error occurred'
              }
            });
          }
        }

        // Route ALL other tools to the shared tool execution function
        try {
          console.error(`[Instantly MCP] 🔄 Routing ${name} to shared tool handler...`);

          // Call the shared tool execution function directly
          const result = await executeToolDirectly(name, args, apiKey);

          return res.json({
            jsonrpc: '2.0',
            id,
            result
          });

        } catch (error) {
          console.error(`[Instantly MCP] ❌ Error executing ${name}:`, error);
          return res.json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: error instanceof Error ? error.message : `Failed to execute tool: ${name}`
            }
          });
        }
      }

      return res.json({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Unknown method: ${method}` }
      });

    } catch (error) {
      console.error('[Instantly MCP] ❌ Error handling URL-based MCP request:', error);
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

  console.error('[Instantly MCP] 🔍 Debug - handleToolCall params:', JSON.stringify(params, null, 2));
  console.error('[Instantly MCP] 🔍 Debug - extracted name:', name);
  console.error('[Instantly MCP] 🔍 Debug - extracted args:', JSON.stringify(args, null, 2));

  // This integrates with your existing tool handling logic
  // Route create_campaign to the main handler, others handled here
  switch (name) {
    case 'create_campaign': {
      // Route to the main server's create_campaign handler
      console.error('[Instantly MCP] 🔄 Routing create_campaign to main handler...');

      // Extract API key from args if present
      let apiKey: string | undefined;
      if (args && typeof args === 'object' && 'apiKey' in args) {
        apiKey = (args as any).apiKey;
        delete (args as any).apiKey;
      }

      // Call the main create_campaign logic (from the main switch statement)
      console.error('[Instantly MCP] 🚀 Executing enhanced create_campaign...');
      const startTime = Date.now();

      // Step 1: Check if this is a minimal request that needs prerequisite gathering
      const hasMinimalInfo = !args?.name || !args?.subject || !args?.body || !args?.email_list;

      if (hasMinimalInfo) {
        console.error('[Instantly MCP] 🔍 Minimal information provided, gathering prerequisites...');
        const prerequisiteResult = await gatherCampaignPrerequisites(args, apiKey);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                stage: 'prerequisite_check',
                ...prerequisiteResult,
                next_action: prerequisiteResult.ready_for_next_stage
                  ? 'All requirements met. Call create_campaign again with the same parameters to proceed with creation.'
                  : 'Please provide the missing information and call create_campaign again.'
              }, null, 2)
            }
          ]
        };
      }

      // Step 2: Apply smart defaults and enhancements
      console.error('[Instantly MCP] 🎯 Applying smart defaults and enhancements...');
      const enhanced_args = applySmartDefaults(args);

      // Step 3: Validate the enhanced arguments
      console.error('[Instantly MCP] ✅ Validating enhanced campaign data...');
      const validatedData = await validateCampaignData(enhanced_args);

      // Step 4: Validate sender email addresses against accounts (skip for test API keys or if disabled)
      const skipValidation = process.env.SKIP_ACCOUNT_VALIDATION === 'true';
      if (apiKey && !apiKey.startsWith('test-') && !apiKey.startsWith('real-api') && !skipValidation) {
        console.error('[Instantly MCP] 📧 Validating sender email addresses against accounts...');
        const validationStart = Date.now();
        try {
          await validateEmailListAgainstAccounts(enhanced_args.email_list, apiKey);
          const validationTime = Date.now() - validationStart;
          console.error(`[Instantly MCP] ✅ Account validation completed in ${validationTime}ms`);
        } catch (error) {
          const validationTime = Date.now() - validationStart;
          console.error(`[Instantly MCP] ❌ Account validation failed after ${validationTime}ms:`, error instanceof Error ? error.message : String(error));
          throw error;
        }
      } else {
        if (skipValidation) {
          console.error('[Instantly MCP] ⚠️ Skipping account validation (SKIP_ACCOUNT_VALIDATION=true)');
        } else {
          console.error('[Instantly MCP] ⚠️ Skipping account validation for test/demo API key');
        }
      }

      // Step 5: Build campaign payload with proper HTML formatting
      console.error('[Instantly MCP] 🔧 Building campaign payload with HTML formatting...');
      const campaignPayload = buildCampaignPayload(enhanced_args);

      // DEBUG: Log the exact payload being sent to Instantly.ai API
      console.error('[Instantly MCP] 🔍 DEBUG: Exact payload being sent to Instantly.ai API:');
      console.error(JSON.stringify(campaignPayload, null, 2));

      // Step 6: Create the campaign
      console.error('[Instantly MCP] 🚀 Creating campaign with validated data...');
      const campaignStart = Date.now();
      try {
        const response = await makeInstantlyRequest('/campaigns', {
          method: 'POST',
          body: campaignPayload
        }, apiKey);
        const campaignTime = Date.now() - campaignStart;
        console.error(`[Instantly MCP] ✅ Campaign created successfully in ${campaignTime}ms`);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'Campaign created successfully',
                campaign: response,
                performance: {
                  total_time_ms: Date.now() - startTime,
                  creation_time_ms: campaignTime
                }
              }, null, 2)
            }
          ]
        };
      } catch (error) {
        const campaignTime = Date.now() - campaignStart;
        console.error(`[Instantly MCP] ❌ Campaign creation failed after ${campaignTime}ms:`, error instanceof Error ? error.message : String(error));
        throw error;
      }

      // Return statement is now handled in the try block above
    }

    case 'list_campaigns':
      const campaigns = await makeInstantlyRequest('/campaigns', {}, args.apiKey);
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
      const unreadResult = await makeInstantlyRequest('/emails/unread/count', {}, args.apiKey);
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

      const analyticsResult = await makeInstantlyRequest('/campaigns/analytics/daily', { params: analyticsParams }, args.apiKey);
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
      const accountInfoResult = await makeInstantlyRequest('/account', {}, args.apiKey);
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
      const featuresResult = await makeInstantlyRequest('/account/features', {}, args.apiKey);
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
      const activateResult = await makeInstantlyRequest(`/campaigns/${args.campaign_id}/activate`, { method: 'POST' }, args.apiKey);
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
      const pauseCampaignResult = await makeInstantlyRequest(`/campaigns/${args.campaign_id}/pause`, { method: 'POST' }, args.apiKey);
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
      const pauseAccountResult = await makeInstantlyRequest(`/accounts/${args.email}/pause`, { method: 'POST' }, args.apiKey);
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
      const resumeAccountResult = await makeInstantlyRequest(`/accounts/${args.email}/resume`, { method: 'POST' }, args.apiKey);
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

    // ===== ADDITIONAL TOOLS FROM MAIN HANDLER =====
    // Note: create_campaign is handled in the main switch statement above with enhanced functionality

    // Add other tool handlers here
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Main execution
async function main() {
  const { isN8nMode, transportMode, isHttpMode } = parseConfig();

  if (isHttpMode) {
    console.error(`[Instantly MCP] 🌐 Starting ${transportMode} transport mode with direct Express handler...`);

    if (process.env.NODE_ENV === 'production') {
      console.error('[Instantly MCP] 🏢 Production endpoints:');
      console.error('[Instantly MCP] 🔗 URL auth: https://instantly-mcp-iyjln.ondigitalocean.app/mcp/{API_KEY}');
    }

    // DISABLED: StreamingHttpTransport was intercepting requests before our direct handler
    // Use only the direct Express handler for better control and debugging
    console.error('[Instantly MCP] 🚀 Using direct Express handler (StreamingHttpTransport disabled)');

    // Start the direct Express handler
    await startN8nHttpServer();

    console.error('[Instantly MCP] ✅ Direct Express handler started successfully');

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
