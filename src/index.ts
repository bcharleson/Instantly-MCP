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

const INSTANTLY_API_URL = 'https://api.instantly.ai';

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
    email_list: args.email_list,
    daily_limit: args.daily_limit || 30, // Updated default to 30 for cold email compliance
    email_gap: args.email_gap_minutes || 10,
    link_tracking: Boolean(args.link_tracking),
    open_tracking: Boolean(args.open_tracking),
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

    // Add timeout protection to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Account validation timeout after 15 seconds')), 15000);
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
  console.error(`[Instantly MCP] 🔍 Debug - Main handler params:`, JSON.stringify(request.params, null, 2));
  console.error(`[Instantly MCP] 🔍 Debug - extracted name:`, name);
  console.error(`[Instantly MCP] 🔍 Debug - extracted args:`, JSON.stringify(args, null, 2));

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
        console.error('[Instantly MCP] 🚀 Executing enhanced create_campaign...');

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

        // Step 2: Apply smart defaults and validate
        console.error('[Instantly MCP] ⚙️ Applying smart defaults...');
        const { enhanced_args, defaults_applied, defaults_explanation } = applySmartDefaults(args);

        try {
          // Step 3: Validate enhanced arguments
          const validatedData = validateCampaignData(enhanced_args);

          // Step 4: Validate sender email addresses against accounts
          await validateEmailListAgainstAccounts(enhanced_args.email_list, apiKey);

          // Step 5: Build campaign payload with proper HTML formatting
          console.error('[Instantly MCP] 🔧 Building campaign payload with HTML formatting...');
          const campaignPayload = buildCampaignPayload(enhanced_args);

          // Step 6: Create the campaign
          console.error('[Instantly MCP] 🚀 Creating campaign with validated data...');
          const response = await makeInstantlyRequest('/api/v2/campaigns', {
            method: 'POST',
            body: campaignPayload
          }, apiKey);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  campaign: response,
                  message: 'Campaign created successfully with smart defaults applied',
                  defaults_applied: defaults_explanation,
                  next_steps: [
                    {
                      step: 1,
                      action: 'activate_campaign',
                      description: 'Activate the campaign in your Instantly dashboard to start sending',
                      note: 'Campaigns are created in draft status and require manual activation'
                    },
                    {
                      step: 2,
                      action: 'monitor_performance',
                      description: 'Monitor campaign analytics',
                      tool_suggestion: `get_campaign_analytics {"campaign_id": "${response.id || 'CAMPAIGN_ID'}"}`
                    }
                  ]
                }, null, 2)
              }
            ]
          };

        } catch (error: any) {
          console.error('[Instantly MCP] ❌ Campaign creation failed:', error.message);

          // Provide helpful error context
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: error.message,
                  stage: 'validation_failed',
                  suggestion: 'Review the error message above for specific guidance on fixing the issue',
                  helpful_actions: [
                    'Call list_accounts to verify your sender email addresses',
                    'Check that your accounts are active and warmed up',
                    'Ensure email body formatting follows the guidelines',
                    'Verify all required fields are provided'
                  ]
                }, null, 2)
              }
            ]
          };
        }
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

      const { jsonrpc, id, method, params } = req.body;

      // Handle different MCP methods directly (bypass StreamableHTTPServerTransport)
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

            // TEMPORARY: Return debug info immediately to test direct handler
            return res.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      debug: 'DIRECT HANDLER WORKING',
                      received_args: args,
                      args_name: args?.name,
                      args_subject: args?.subject,
                      args_body: args?.body,
                      args_email_list: args?.email_list,
                      typeof_name: typeof args?.name,
                      typeof_subject: typeof args?.subject,
                      typeof_body: typeof args?.body,
                      typeof_email_list: typeof args?.email_list
                    }, null, 2)
                  }
                ]
              }
            });

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
            const enhanced_args = applySmartDefaults(args);

            // Step 3: Validate the enhanced arguments
            console.error('[Instantly MCP] ✅ Validating enhanced campaign data...');
            const validatedData = await validateCampaignData(enhanced_args);

            // Step 4: Validate sender email addresses against accounts
            console.error('[Instantly MCP] 📧 Validating sender email addresses against accounts...');
            await validateEmailListAgainstAccounts(enhanced_args.email_list, apiKey);

            // Step 5: Build campaign payload with proper HTML formatting
            console.error('[Instantly MCP] 🔧 Building campaign payload with HTML formatting...');
            const campaignPayload = buildCampaignPayload(enhanced_args);

            // Step 6: Create the campaign
            console.error('[Instantly MCP] 🚀 Creating campaign with validated data...');
            const response = await makeInstantlyRequest('/api/v2/campaigns', {
              method: 'POST',
              body: campaignPayload
            }, apiKey);

            return res.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      success: true,
                      campaign: response,
                      message: 'Campaign created successfully with enhanced features',
                      applied_defaults: enhanced_args._applied_defaults || [],
                      html_conversion: 'Line breaks automatically converted to HTML format',
                      features_used: [
                        'Smart defaults application',
                        'HTML line break conversion',
                        'Account validation',
                        'Enhanced error handling'
                      ]
                    }, null, 2)
                  }
                ]
              }
            });

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

        // Handle other tools...
        return res.json({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Unknown tool: ${name}` }
        });
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

      // Step 4: Validate sender email addresses against accounts
      console.error('[Instantly MCP] 📧 Validating sender email addresses against accounts...');
      await validateEmailListAgainstAccounts(enhanced_args.email_list, apiKey);

      // Step 5: Build campaign payload with proper HTML formatting
      console.error('[Instantly MCP] 🔧 Building campaign payload with HTML formatting...');
      const campaignPayload = buildCampaignPayload(enhanced_args);

      // Step 6: Create the campaign
      console.error('[Instantly MCP] 🚀 Creating campaign with validated data...');
      const response = await makeInstantlyRequest('/api/v2/campaigns', {
        method: 'POST',
        body: campaignPayload
      }, apiKey);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              campaign: response,
              message: 'Campaign created successfully with enhanced features',
              applied_defaults: enhanced_args._applied_defaults || [],
              html_conversion: 'Line breaks automatically converted to HTML format',
              features_used: [
                'Smart defaults application',
                'HTML line break conversion',
                'Account validation',
                'Enhanced error handling'
              ]
            }, null, 2)
          }
        ]
      };
    }

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
        // Call the existing handleToolCall function which will be enhanced with all tools
        const { name, arguments: args } = params;

        console.error(`[Instantly MCP] 🔧 HTTP Tool called: ${name}`);
        console.error('[Instantly MCP] 🔍 Debug - toolCall params:', JSON.stringify(params, null, 2));

        // The API key should already be in args.apiKey from the HTTP transport
        const result = await handleToolCall(params);

        // Wrap the tool response in proper JSON-RPC 2.0 format
        return {
          jsonrpc: '2.0',
          id,
          result
        };
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
