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
import { TransportManager } from './transport-manager-new.js';

// Ensure fetch is available (Node.js 18+ has it built-in)
// Version: 1.1.0 - Parameter validation fixes deployed
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
import { buildQueryParams } from './pagination.js';
import { validateAndMapTimezone, DEFAULT_TIMEZONE, BUSINESS_PRIORITY_TIMEZONES } from './timezone-config.js';
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

// Instantly.ai custom icons (using publicly accessible icon URL)
// Icon fetched from Instantly.ai's official website favicon
// This approach matches how Smithery and other MCP servers display icons
const INSTANTLY_ICONS = [
  {
    src: 'https://cdn.prod.website-files.com/63860c8c65e7bef4a1eeebeb/63f62e4f7dc7e3426e9b7874_cleaned_rounded_favicon.png',
    mimeType: 'image/png',
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

// Only require API key for stdio mode (local usage)
// HTTP mode handles API keys per-request via URL path: /mcp/{API_KEY}
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
  const clientName = request.params?.clientInfo?.name || 'unknown';
  console.error('[Instantly MCP] 🔧 Initialize request received from:', clientName);

  // Update client detection manager with client info
  try {
    const { globalClientManager } = await import('./client-detection.js');
    globalClientManager.updateClientInfo(
      request.params?.clientInfo,
      undefined // User agent not available in stdio mode
    );
    console.error('[Instantly MCP] 📊 Client detection updated');
  } catch (error) {
    console.error('[Instantly MCP] ⚠️ Client detection unavailable:', error);
  }

  // Ensure icons are loaded synchronously for Claude Desktop compatibility
  const icons = loadInstantlyIcons();
  console.error('[Instantly MCP] 🎨 Icons loaded:', icons.length > 0 ? `✅ ${icons.length} icon(s)` : '❌ Missing');

  // Enhanced initialization response matching HTTP transport
  // Use 2025-03-26 for Claude Desktop/Web compatibility (supports authorization)
  const initResponse = {
    protocolVersion: '2025-03-26',
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
    },
    serverInfo: {
      name: 'instantly-mcp',
      version: '1.1.0',
      icons: icons,
      description: 'Instantly.ai email automation and campaign management tools',
    },
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
      'Authorization': `Bearer ${useApiKey}`,
    },
    // Add 60-second timeout for all API requests (increased for campaign creation)
    signal: AbortSignal.timeout(60000),
  };

  if (method !== 'GET' && options.body) {
    requestOptions.headers['Content-Type'] = 'application/json';
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

// SEQUENTIAL PAGINATION: Fetch ONE page at a time, let LLM control pagination
async function getAllAccounts(apiKey?: string, params?: any): Promise<any> {
  console.error('[Instantly MCP] 📊 Retrieving accounts (sequential pagination)...');

  try {
    const startTime = Date.now();

    // Build query parameters for single page request
    const queryParams: any = {
      limit: params?.limit || 100, // Default to 100 items per page (API maximum)
    };

    // Add cursor if provided (for subsequent pages)
    if (params?.starting_after) {
      queryParams.starting_after = params.starting_after;
      console.error(`[Instantly MCP] 📄 Fetching page with cursor: ${params.starting_after}`);
    } else {
      console.error('[Instantly MCP] 📄 Fetching first page');
    }

    // Add API filter parameters (sent to Instantly API)
    if (params?.search) {
      queryParams.search = params.search;
      console.error(`[Instantly MCP] 🔍 Filtering by search: ${params.search}`);
    }
    if (params?.status !== undefined) {
      queryParams.status = params.status;
      console.error(`[Instantly MCP] 🔍 Filtering by status: ${params.status}`);
    }
    if (params?.provider_code !== undefined) {
      queryParams.provider_code = params.provider_code;
      console.error(`[Instantly MCP] 🔍 Filtering by provider_code: ${params.provider_code}`);
    }
    if (params?.tag_ids) {
      queryParams.tag_ids = params.tag_ids;
      console.error(`[Instantly MCP] 🔍 Filtering by tag_ids: ${params.tag_ids}`);
    }

    // Make single API call to /accounts endpoint
    const response = await makeInstantlyRequest('/accounts', {
      method: 'GET',
      params: queryParams
    }, apiKey);

    const elapsed = Date.now() - startTime;

    // Extract data and pagination info from response
    const data = Array.isArray(response) ? response : (response.items || response.data || []);
    const nextCursor = response.next_starting_after || null;
    const hasMore = !!nextCursor;

    console.error(`[Instantly MCP] ✅ Retrieved ${data.length} accounts in ${elapsed}ms (has_more: ${hasMore})`);

    // Return single page with clear pagination metadata
    return {
      data,
      pagination: {
        returned_count: data.length,
        has_more: hasMore,
        next_starting_after: nextCursor,
        limit: queryParams.limit,
        current_page_note: hasMore
          ? `Retrieved ${data.length} accounts. More results available. To get next page, call list_accounts again with starting_after='${nextCursor}'`
          : `Retrieved all available accounts (${data.length} items).`
      },
      metadata: {
        request_time_ms: elapsed,
        success: true,
        filters_applied: {
          ...(params?.search && { search: params.search }),
          ...(params?.status !== undefined && { status: params.status }),
          ...(params?.provider_code !== undefined && { provider_code: params.provider_code }),
          ...(params?.tag_ids && { tag_ids: params.tag_ids })
        }
      }
    };
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
    const accountsResult = await getAllAccounts(apiKey);

    // FIX: getAllAccounts returns { data: [...], metadata: {...} }, not an array directly
    accounts = accountsResult.data || accountsResult;

    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
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
    email_list: args?.email_list || null,
    campaign_schedule: args?.campaign_schedule || null,
    sequences: args?.sequences || null
  };

  // Determine required fields based on campaign type
  const hasComplexStructure = args?.campaign_schedule && args?.sequences;
  const requiredFields = hasComplexStructure
    ? ['name', 'email_list']  // Complex campaigns only need name and email_list
    : ['name', 'subject', 'body', 'email_list'];  // Simple campaigns need all fields

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
        timezone: { default: DEFAULT_TIMEZONE, description: 'Timezone for sending schedule (verified working timezone)' },
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
        email_gap: { default: 10, description: 'Minutes between emails from same account (1-1440 minutes)' }
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
        timezone: `Timezone for sending schedule (default: ${DEFAULT_TIMEZONE} - verified working timezone)`,
        timing_from: 'Start time for sending in 24h format (default: 09:00)',
        timing_to: 'End time for sending in 24h format (default: 17:00)',
        days: 'Days of week for sending (default: Monday-Friday only)'
      },
      limits: {
        daily_limit: 'Maximum emails per day per account (default: 30 for cold email compliance)',
        email_gap: 'Minutes between emails from same account (default: 10) - API v2 parameter'
      },
      behavior: {
        stop_on_reply: 'Stop campaign when recipient replies (default: true)',
        stop_on_auto_reply: 'Stop on auto-replies like out-of-office (default: true)'
      },
      sequences: {
        sequence_steps: 'Number of emails in the sequence (default: 1 for single email, max: 10)',
        step_delay_days: 'Days to wait AFTER sending each step before sending the next step (default: 3 days). CRITICAL: This delay applies to ALL steps including Step 1. Example with 2-day delay: Step 1 sends → Wait 2 days → Step 2 sends → Wait 2 days → Step 3 sends.',
        sequence_bodies: 'Optional custom email content for each step (array of strings)',
        sequence_subjects: 'Optional custom subject lines for each step (array of strings)',
        when_to_use: 'Multi-step sequences are effective for cold outreach, nurturing leads, and following up on proposals',
        best_practices: [
          'Start with 2-3 steps for cold outreach',
          'Increase value with each follow-up',
          'Reference previous emails in follow-ups',
          'Space follow-ups 2-7 days apart (step_delay_days parameter)',
          'Personalize each step differently',
          'CRITICAL: The delay applies to ALL steps - Step 1 will wait before Step 2, Step 2 will wait before Step 3, etc.'
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

// CRITICAL: Parameter cleanup and validation for Instantly.ai API v2 compatibility
// This function MUST remove all parameters that don't exist in the official API
function cleanupAndValidateParameters(args: any): { cleanedArgs: any; warnings: string[] } {
  const warnings: string[] = [];
  const cleanedArgs = { ...args };

  console.error('[Instantly MCP] 🧹 CRITICAL: Cleaning parameters for API v2 compatibility...');

  // CRITICAL: List of parameters that DO NOT EXIST in Instantly.ai API v2
  // These MUST be removed to prevent API errors
  const unsupportedParams = [
    'continue_thread',  // Not supported in API v2
    'email_gap_minutes' // This parameter does NOT exist in API v2 - only email_gap exists
    // NOTE: sequence_steps, step_delay_days, sequence_bodies, sequence_subjects are internal parameters
    // used to build multi-step sequences and should NOT be removed
  ];

  // Remove unsupported parameters and warn user
  for (const param of unsupportedParams) {
    if (cleanedArgs[param] !== undefined) {
      console.error(`[Instantly MCP] ⚠️ REMOVING invalid parameter: ${param} = ${cleanedArgs[param]}`);

      // Special handling for email_gap_minutes conversion
      if (param === 'email_gap_minutes' && cleanedArgs.email_gap === undefined) {
        cleanedArgs.email_gap = cleanedArgs[param];
        warnings.push(`✅ Converted legacy 'email_gap_minutes' to 'email_gap' (${cleanedArgs[param]} minutes) for API v2 compatibility.`);
      } else {
        warnings.push(`⚠️ Parameter '${param}' does not exist in Instantly.ai API v2 and has been removed.`);
      }

      delete cleanedArgs[param];
    }
  }

  console.error(`[Instantly MCP] ✅ Parameter cleanup complete. Warnings: ${warnings.length}`);
  return { cleanedArgs, warnings };
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

  // Apply scheduling defaults with bulletproof timezone validation
  if (enhancedArgs.timezone === undefined) {
    enhancedArgs.timezone = DEFAULT_TIMEZONE;
    defaultsApplied.push(`timezone: ${DEFAULT_TIMEZONE} (verified working timezone - adjust if needed)`);
  } else {
    // Validate and map timezone if needed
    const timezoneResult = validateAndMapTimezone(enhancedArgs.timezone);
    if (timezoneResult.mapped) {
      enhancedArgs.timezone = timezoneResult.timezone;
      defaultsApplied.push(`timezone: ${timezoneResult.warning}`);
    }
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

  // Handle email_gap parameter (API expects 'email_gap')
  if (enhancedArgs.email_gap === undefined) {
    enhancedArgs.email_gap = 10;
    defaultsApplied.push('email_gap: 10 (10-minute gaps between emails from same account)');
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

      // Wrap in paragraph tags for proper HTML structure (this is what worked!)
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

  // Validate required fields
  if (!args.name) {
    throw new McpError(ErrorCode.InvalidParams, 'Campaign name is required');
  }

  // CRITICAL: Detect campaign type - complex vs simple
  const hasComplexStructure = args.campaign_schedule && args.sequences;

  if (hasComplexStructure) {
    // COMPLEX CAMPAIGN: Use provided structure directly
    console.error('[Instantly MCP] 🏗️ Building COMPLEX campaign payload with provided sequences');

    const campaignData: any = {
      name: args.name,
      campaign_schedule: args.campaign_schedule,
      sequences: args.sequences,
      email_list: args.email_list || []
    };

    // Add optional fields
    if (args.daily_limit !== undefined) campaignData.daily_limit = Number(args.daily_limit);
    if (args.email_gap !== undefined) campaignData.email_gap = Number(args.email_gap);
    if (args.text_only !== undefined) campaignData.text_only = Boolean(args.text_only);
    if (args.open_tracking !== undefined) campaignData.open_tracking = Boolean(args.open_tracking);
    if (args.link_tracking !== undefined) campaignData.link_tracking = Boolean(args.link_tracking);
    if (args.stop_on_reply !== undefined) campaignData.stop_on_reply = Boolean(args.stop_on_reply);

    return campaignData;
  }

  // SIMPLE CAMPAIGN: Build traditional structure
  console.error('[Instantly MCP] 🏗️ Building SIMPLE campaign payload with subject/body');

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

  // Apply timezone and days configuration with bulletproof validation
  let timezone = args?.timezone || DEFAULT_TIMEZONE;

  // Validate and map timezone if needed
  const timezoneResult = validateAndMapTimezone(timezone);
  if (timezoneResult.mapped) {
    timezone = timezoneResult.timezone;
    console.error(`[Instantly MCP] 🔄 ${timezoneResult.warning}`);
  }

  const userDays = (args?.days as any) || {};

  // CRITICAL: days object must be non-empty according to API spec
  // API requires string keys for days ("0" through "6"), not numeric keys
  const daysConfig = {
    "0": userDays.sunday === true,
    "1": userDays.monday !== false,
    "2": userDays.tuesday !== false,
    "3": userDays.wednesday !== false,
    "4": userDays.thursday !== false,
    "5": userDays.friday !== false,
    "6": userDays.saturday === true
  };

  // Normalize and convert body content for HTML email rendering
  let normalizedBody = args.body ? String(args.body).trim() : '';
  let normalizedSubject = args.subject ? String(args.subject).trim() : '';

  // CRITICAL: Convert \n line breaks to <br /> tags for Instantly.ai HTML rendering
  if (normalizedBody) {
    normalizedBody = convertLineBreaksToHTML(normalizedBody);
  }

  // Subjects should not have line breaks
  if (normalizedSubject) {
    normalizedSubject = normalizedSubject.replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ' ');
  }

  // CRITICAL: Build payload according to exact API v2 specification
  const campaignData: any = {
    name: args.name,
    campaign_schedule: {
      schedules: [{
        name: args.schedule_name || 'My Schedule',
        timing: {
          from: args.timing_from || '09:00',
          to: args.timing_to || '17:00'
        },
        days: daysConfig,
        timezone: timezone
      }]
    }
  };

  // Add optional fields only if provided
  if (args.email_list && Array.isArray(args.email_list) && args.email_list.length > 0) {
    campaignData.email_list = args.email_list;
  }

  if (args.daily_limit !== undefined) {
    campaignData.daily_limit = Number(args.daily_limit);
  } else {
    campaignData.daily_limit = 30; // Default for cold email compliance
  }

  if (args.text_only !== undefined) {
    campaignData.text_only = Boolean(args.text_only);
  }

  if (args.track_opens !== undefined) {
    campaignData.open_tracking = Boolean(args.track_opens);
  }

  if (args.track_clicks !== undefined) {
    campaignData.link_tracking = Boolean(args.track_clicks);
  }

  if (args.stop_on_reply !== undefined) {
    campaignData.stop_on_reply = Boolean(args.stop_on_reply);
  }

  // Handle email gap parameter (API expects 'email_gap' in minutes)
  if (args.email_gap !== undefined) {
    campaignData.email_gap = Number(args.email_gap);
  }

  // Add sequences if email content is provided
  // CRITICAL FIX: Use correct Instantly API v2 structure with variants
  // Handle multi-step sequences if specified
  const sequenceSteps = args?.sequence_steps || 1;
  const stepDelayDays = args?.step_delay_days || 3;

  if (normalizedSubject || normalizedBody) {
    campaignData.sequences = [{
      steps: [{
        type: "email",
        // CRITICAL: delay field means "days to wait AFTER sending this step before sending next step"
        // For single-step campaigns (sequenceSteps === 1), delay should be 0 (no next step)
        // For multi-step campaigns, Step 1 should have the delay before Step 2
        delay: sequenceSteps > 1 ? stepDelayDays : 0,
        variants: [{
          subject: normalizedSubject,
          body: normalizedBody
        }]
      }]
    }];
  }

  if (sequenceSteps > 1 && campaignData.sequences) {
    const hasCustomBodies = args?.sequence_bodies && Array.isArray(args.sequence_bodies);
    const hasCustomSubjects = args?.sequence_subjects && Array.isArray(args.sequence_subjects);

    // Update the first step if custom content is provided
    if (hasCustomBodies || hasCustomSubjects) {
      const firstStepBody = hasCustomBodies ? convertLineBreaksToHTML(String(args.sequence_bodies[0])) : normalizedBody;
      const firstStepSubject = hasCustomSubjects ? String(args.sequence_subjects[0]) : normalizedSubject;

      // CRITICAL FIX: Update variants array, not direct properties
      campaignData.sequences[0].steps[0].variants[0].body = firstStepBody;
      campaignData.sequences[0].steps[0].variants[0].subject = firstStepSubject;
    }

    // Add follow-up steps
    for (let i = 1; i < sequenceSteps; i++) {
      let followUpSubject: string;
      let followUpBody: string;

      // Determine subject for this step
      if (hasCustomSubjects && args.sequence_subjects[i]) {
        followUpSubject = String(args.sequence_subjects[i]);
      } else {
        followUpSubject = `Follow-up: ${normalizedSubject}`;
      }

      // Determine body for this step
      if (hasCustomBodies && args.sequence_bodies[i]) {
        // Use provided custom body with HTML conversion
        followUpBody = convertLineBreaksToHTML(String(args.sequence_bodies[i]));
      } else {
        // Default behavior: add follow-up prefix to original body
        followUpBody = `This is follow-up #${i}.<br /><br />${normalizedBody}`.trim();
      }

      // CRITICAL FIX: Use correct Instantly API v2 structure with variants
      campaignData.sequences[0].steps.push({
        type: "email",
        delay: stepDelayDays,  // delay in days between steps
        variants: [{
          subject: followUpSubject,
          body: followUpBody
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
    const accountsResult = await Promise.race([accountsPromise, timeoutPromise]) as any;

    // FIX: getAllAccounts returns { data: [...], metadata: {...} }, not an array directly
    const accounts = accountsResult.data || accountsResult;

    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
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
export const TOOLS_DEFINITION = [
      {
        name: 'list_accounts',
        description: '📧 LIST EMAIL ACCOUNTS - Sequential Pagination\n\nReturns email accounts with sequential pagination support. Each call returns one page of results (default 100 accounts, max 100).\n\n**Pagination:**\n- Response includes `pagination.next_starting_after` cursor if more results available\n- To get next page: Use the EXACT cursor value from `response.pagination.next_starting_after` as `starting_after` parameter\n- CRITICAL: Do NOT use email addresses or IDs from the data - only use the cursor from pagination field\n- No cursor in response means you have all results\n- Fast response: ~2-5 seconds per page\n\n**Pagination Example:**\nPage 1: Call with no starting_after → Response has \"next_starting_after\": \"cursor123\"\nPage 2: Call with starting_after=\"cursor123\" → Response has \"next_starting_after\": \"cursor456\"\nPage 3: Call with starting_after=\"cursor456\" → Response has no next_starting_after (complete)\n\n**Filtering Options:**\n- `search`: Filter by email domain (e.g., "gmail.com", "company.com")\n- `status`: Filter by account status (1=Active, 2=Paused, -1=Connection Error, etc.)\n- `provider_code`: Filter by email provider (1=Custom IMAP/SMTP, 2=Google, 3=Microsoft, 4=AWS)\n- `tag_ids`: Filter by tag IDs (comma-separated)\n- `limit`: Items per page (1-100, default: 100)\n\n**Common Usage:**\n- List all accounts: Call repeatedly with cursor from pagination.next_starting_after until no cursor returned\n- Count accounts: Iterate through all pages, sum the counts\n- Filter accounts: Use search/status/provider_code parameters to narrow results\n- Active accounts only: Use `status=1`\n\n**Note:** For large account lists, consider using filtering parameters to narrow results.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Number of items per page (1-100, default: 100)',
              minimum: 1,
              maximum: 100
            },
            starting_after: {
              type: 'string',
              description: 'Pagination cursor from previous response. CRITICAL: Use the EXACT value from response.pagination.next_starting_after field (NOT an email address or ID from the data). Example: If previous response had "next_starting_after": "abc123xyz", use starting_after="abc123xyz". Omit for first page.'
            },
            search: {
              type: 'string',
              description: 'Search accounts by email domain (e.g., "gmail.com", "company.com"). Filters accounts whose email addresses contain this string.'
            },
            status: {
              type: 'number',
              description: 'Filter by account status. Values: 1=Active, 2=Paused, -1=Connection Error, -2=Soft Bounce Error, -3=Sending Error',
              enum: [1, 2, -1, -2, -3]
            },
            provider_code: {
              type: 'number',
              description: 'Filter by ESP provider. Values: 1=Custom IMAP/SMTP, 2=Google, 3=Microsoft, 4=AWS',
              enum: [1, 2, 3, 4]
            },
            tag_ids: {
              type: 'string',
              description: 'Filter accounts by tag IDs (comma-separated, e.g., "tag1,tag2,tag3")'
            }
          },
          additionalProperties: false
        }
      },
      {
        name: 'create_campaign',
        description: '🚀 INTELLIGENT CAMPAIGN CREATION WITH AUTOMATIC ACCOUNT DISCOVERY\n\n✨ RECOMMENDED TWO-STEP WORKFLOW:\n\n📋 STEP 1 - DISCOVER ELIGIBLE ACCOUNTS (omit email_list parameter):\n• Call create_campaign with name, subject, and body ONLY\n• Tool will automatically fetch and display eligible sender accounts\n• You will see accounts that meet these criteria:\n  - Account is active (status = 1)\n  - Setup is complete (no pending setup)\n  - Warmup is complete (warmup_status = 1)\n• Tool will ASK the user how many accounts they want to use\n\n📧 STEP 2 - CREATE CAMPAIGN (include email_list parameter):\n• Call create_campaign again with the same parameters PLUS email_list\n• Include the email addresses the user selected from Step 1\n• Campaign will be created with all selected sender accounts\n\n⚠️ CRITICAL REQUIREMENTS:\n1️⃣ NEVER use placeholder emails like test@example.com or user@example.com\n2️⃣ ONLY use email addresses from the eligible accounts list shown in Step 1\n3️⃣ To create ONE campaign with MULTIPLE sender emails, provide ALL emails in a SINGLE email_list array\n4️⃣ Do NOT create multiple separate campaigns when user provides multiple emails - create ONE campaign with all emails\n5️⃣ Instantly.ai\'s core value is multi-account sending - users typically have 10-100+ accounts for better scalability and deliverability\n\n✨ MULTI-STEP CAMPAIGNS SUPPORTED:\n• Use sequence_steps parameter (2-10) to create follow-up sequences\n• Use step_delay_days parameter (1-30) to set delay between steps\n• Perfect for cold outreach, nurture campaigns, and follow-up workflows\n• Example: sequence_steps=3, step_delay_days=2 creates 3-step sequence with 2-day delays\n\n📚 COMMON USER REQUEST EXAMPLES:\n\n1️⃣ "Create a campaign with 50 email addresses":\n   → First call list_accounts to get eligible accounts\n   → Select the FIRST 50 email addresses from the eligible list\n   → Create ONE campaign with all 50 in email_list array\n   → Expected processing time: 10-30 seconds for large account lists\n\n2️⃣ "Attach 10 accounts to this campaign":\n   → Select the FIRST 10 email addresses from eligible accounts\n   → Create ONE campaign with all 10 in email_list array\n\n3️⃣ "Use all my verified accounts":\n   → Get all eligible accounts from list_accounts\n   → Create ONE campaign with ALL eligible emails in email_list array\n\n4️⃣ "Create a 4-step sequence with 2-day delays":\n   → Set sequence_steps=4 and step_delay_days=2\n   → Tool will auto-generate follow-up content for steps 2-4\n\n⏱️ PERFORMANCE NOTE:\n• Large account lists (50+ emails) may take 10-30 seconds to process\n• This is NORMAL and expected - the tool is validating all accounts\n• Do NOT retry if the call takes longer than usual\n\nCreate a new email campaign with intelligent guidance and validation. Automatically provides comprehensive prerequisite checking, account validation, and user-friendly error messages.',
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
              description: '⚠️ CRITICAL: Subject line MUST be under 50 characters for optimal deliverability. Current best practices:\n• Keep it under 50 characters (HARD LIMIT for good open rates)\n• Make it personal and specific\n• Use personalization variables: {{firstName}}, {{companyName}}\n• Examples of GOOD subjects (under 50 chars):\n  - "{{firstName}}, quick question about {{companyName}}"\n  - "Helping {{companyName}} with [problem]"\n  - "{{firstName}}, saw your recent [achievement]"\n• BAD examples (too long, generic, spammy):\n  - "I wanted to reach out to discuss an exciting opportunity"\n  - "Special offer just for you - limited time only!"\n\nIf validation fails with "Subject line is over 50 characters", you MUST shorten the subject line before retrying.'
            },
            body: {
              type: 'string',
              description: 'Email body content. Use plain text with \\n for line breaks - they will be automatically converted to <br /> tags for HTML email rendering in Instantly.ai. Double line breaks (\\n\\n) create paragraphs. Personalization: {{firstName}}, {{lastName}}, {{companyName}}. Example: "Hi {{firstName}},\\n\\nI came across your website.\\n\\nBest regards" Never say "I hope this finds you well" or "I hope this email finds you well" or anything like that. Get straight to the point. The body of the email should be high-value and engaging.'
            },
            email_list: {
              type: 'array',
              items: { type: 'string' },
              description: '⚠️ SENDER EMAIL ADDRESSES - OPTIONAL PARAMETER WITH AUTOMATIC DISCOVERY:\n\n✨ HOW THIS WORKS:\n• If NOT provided: Tool will automatically fetch eligible accounts and ASK the user which ones to use\n• If provided: Tool will validate the emails against eligible accounts and create the campaign\n\n✨ AUTOMATIC ACCOUNT DISCOVERY (when email_list is omitted):\nThe tool will show you ONLY eligible sender accounts that meet these criteria:\n• Active (status = 1)\n• Setup complete (no pending setup)\n• Warmup complete (warmup_status = 1)\n\nThen it will ASK you how many accounts you want to use for this campaign.\n\n⚠️ WHEN PROVIDING email_list:\n1️⃣ ONLY use email addresses from the eligible accounts list shown to you\n2️⃣ NEVER use fake/placeholder emails like:\n   ❌ test@example.com\n   ❌ user@example.com\n   ❌ email@test.com\n\n3️⃣ MULTIPLE EMAILS = ONE CAMPAIGN:\n   ✅ CORRECT: ["email1@domain.com", "email2@domain.com", "email3@domain.com"] → Creates ONE campaign with 3 senders\n   ❌ WRONG: Creating 3 separate campaigns with one email each\n\n4️⃣ When user provides multiple emails, include ALL of them in THIS SINGLE email_list array\n\n5️⃣ Maximum 100 emails per campaign\n\n6️⃣ Instantly.ai users typically have 10-100+ accounts for better deliverability\n\n💡 RECOMMENDED WORKFLOW:\n1. First call: Omit email_list to see eligible accounts\n2. User selects how many accounts to use\n3. Second call: Include selected emails in email_list\n\nExample: If eligible accounts shown are [a@x.com, b@x.com, c@x.com] and user wants all 3:\n- Create ONE campaign with email_list: ["a@x.com", "b@x.com", "c@x.com"]\n- NOT 3 separate campaigns',
              example: ['john@yourcompany.com', 'jane@yourcompany.com']
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
              description: `Timezone for sending schedule. Supported timezones: ${BUSINESS_PRIORITY_TIMEZONES.join(', ')}. Unsupported timezones will be automatically mapped to closest supported timezone.`,
              default: DEFAULT_TIMEZONE,
              example: DEFAULT_TIMEZONE
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
            email_gap: {
              type: 'number',
              description: 'Minutes between emails from same account (1-1440 minutes)',
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

            // Advanced options (optional)
            stop_on_auto_reply: {
              type: 'boolean',
              description: 'Stop campaign when auto-reply is detected (out-of-office, etc.)',
              default: true
            },

            // Multi-step sequence configuration
            sequence_steps: {
              type: 'number',
              description: 'Number of steps in the email sequence (optional, default: 1 for single email, max: 10).\n\n⚠️ MULTI-STEP CAMPAIGNS SUPPORTED:\n• Set to 2 or more to create follow-up sequences\n• Step 1 sends immediately when campaign starts\n• Each step waits step_delay_days before sending next step\n• Example: sequence_steps=3 with step_delay_days=2 creates:\n  Step 1 → Wait 2 days → Step 2 → Wait 2 days → Step 3\n\nUse this for cold outreach sequences, nurture campaigns, and follow-up workflows.',
              minimum: 1,
              maximum: 10,
              default: 1
            },
            step_delay_days: {
              type: 'number',
              description: 'Days to wait AFTER sending each step before sending the next step (optional, default: 3 days).\n\n⚠️ DELAY BEHAVIOR:\n• Applies to ALL steps in the sequence (including Step 1)\n• Step 1: delay=X (wait X days after Step 1 before Step 2)\n• Step 2: delay=X (wait X days after Step 2 before Step 3)\n• Best practices: Use 2-7 days for cold outreach\n• Only used when sequence_steps > 1',
              minimum: 1,
              maximum: 30,
              default: 3
            },
            sequence_subjects: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional: Custom subject lines for each step (array of strings). Must match sequence_steps count. If not provided, follow-ups use "Follow-up: {original subject}". Example: ["Initial Email", "Follow-up 1", "Follow-up 2"]'
            },
            sequence_bodies: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional: Custom email bodies for each step (array of strings). Must match sequence_steps count. Use \\n for line breaks. If not provided, follow-ups use auto-generated content. Example: ["Hi {{firstName}},...", "Following up...", "Last attempt..."]'
            }
          },
          required: ['name', 'subject', 'body'],
          additionalProperties: true
        }
      },
      {
        name: 'list_campaigns',
        description: 'List all campaigns in the account. Returns campaigns with pagination support (default 100 campaigns per page, max 100).\n\n**When to use this tool:**\n- User asks: "list campaigns", "show campaigns", "what campaigns do I have", "my campaigns"\n- User asks about campaign status: "active campaigns", "running campaigns", "paused campaigns" → List ALL campaigns (status filtering happens in response, not parameters)\n- User wants to see all campaigns regardless of status\n\n**IMPORTANT - Status Filtering:**\n- This endpoint does NOT have a status parameter\n- To show "active" or "running" campaigns: List ALL campaigns, then filter the response by status=1\n- To show "paused" campaigns: List ALL campaigns, then filter the response by status=2\n- Status codes in response: 0=Draft, 1=Active, 2=Paused, 3=Completed, 4=Running Subsequences\n\n**Parameters:**\n- `limit`: Items per page (1-100, default: 100)\n- `starting_after`: Pagination cursor from previous response\n- `search`: Search by campaign NAME only (not status) - use sparingly\n- `tag_ids`: Filter by tag IDs (comma-separated)\n\n**Pagination:**\n- Response includes `pagination.next_starting_after` cursor if more results available\n- To get next page: Use cursor value from `response.pagination.next_starting_after` as `starting_after` parameter\n- No cursor in response means you have all results\n\n**Common User Phrases & Correct Interpretation:**\n- "What campaigns are running?" → Call list_campaigns with NO search parameter, filter response for status=1\n- "Show my active campaigns" → Call list_campaigns with NO search parameter, filter response for status=1\n- "List all campaigns" → Call list_campaigns with NO parameters\n- "Find campaign named X" → Call list_campaigns with search="X"\n\n**Note:** This is READ-ONLY. Use `get_campaign` for details, `update_campaign` for modifications.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Number of items per page (1-100, default: 100)',
              minimum: 1,
              maximum: 100
            },
            starting_after: {
              type: 'string',
              description: 'Pagination cursor from previous response. CRITICAL: Use the EXACT value from response.pagination.next_starting_after field (NOT a campaign ID from the data). Example: If previous response had "next_starting_after": "cursor123", use starting_after="cursor123". Omit for first page.'
            },
            search: {
              type: 'string',
              description: 'Search campaigns by campaign NAME only (optional). CRITICAL: Do NOT use this for status filtering (e.g., do NOT search for "running", "active", "paused"). Only use when user explicitly wants to find a campaign by its name. Examples: search="Product Launch", search="Q4 Campaign". Leave empty to list all campaigns.'
            },
            tag_ids: {
              type: 'string',
              description: 'Filter by tag IDs, comma-separated (optional)'
            }
          },
          additionalProperties: false
        }
      },
      {
        name: 'get_campaign_analytics',
        description: 'Get campaign performance metrics, statistics, and analytics data (opens, clicks, replies, bounces, etc.). Use this tool when the user wants to see campaign performance, metrics, or statistics. NOT for listing campaigns themselves - use list_campaigns for that. Supports filtering by single campaign ID, multiple campaign IDs, and/or date range.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: {
              type: 'string',
              description: 'Single campaign ID to filter analytics (optional). API receives this as "id" parameter. Omit to get analytics for all campaigns. Use this OR campaign_ids, not both.'
            },
            campaign_ids: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of campaign IDs to filter analytics for multiple campaigns (optional). API receives this as "ids" parameter. Use this OR campaign_id, not both. Example: ["campaign-id-1", "campaign-id-2"]'
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
            },
            exclude_total_leads_count: {
              type: 'boolean',
              description: 'Exclude total leads count from result to considerably decrease response time (optional). Default: false'
            }
          },
          required: [],
          additionalProperties: false
        }
      },
      {
        name: 'verify_email',
        description: '✅ VERIFY EMAIL ADDRESS DELIVERABILITY\n\nVerifies email address deliverability with comprehensive validation checks. Takes 2-5 seconds per email.\n\n**Validation Checks:**\n- Syntax validation (proper email format)\n- Domain validation (MX records exist)\n- Mailbox validation (mailbox exists, when possible)\n- Deliverability score (0-100)\n\n**Returns:**\n- `status`: "valid", "invalid", "risky", "unknown", "catch-all"\n- `score`: Quality score 0-100 (higher is better)\n- `reason`: Explanation of verification result\n- `is_disposable`: True if temporary/disposable email service\n- `is_role_based`: True if role-based email (info@, support@, etc.)\n\n**Status Meanings:**\n- "valid" or "deliverable": Email is good, safe to use\n- "risky" or "unknown": Email might work, use with caution\n- "invalid" or "undeliverable": Email will bounce\n- "catch-all": Domain accepts all emails, cannot verify mailbox\n\n**Performance:**\n- 2-5 seconds per verification\n- Real-time check against mail servers\n\n**Note:** For bulk verification (10+ emails), use `verify_leads_on_import` parameter in `create_lead` instead of verifying individually.',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', description: 'Email address to verify (must be valid format: user@domain.com). Example: "john@acme.com"' }
          },
          required: ['email'],
          additionalProperties: false
        }
      },
      {
        name: 'get_campaign',
        description: '🔍 GET CAMPAIGN DETAILS BY ID\n\nReturns complete details of a single campaign by ID. Read-only operation.\n\n**Required:**\n- `campaign_id`: Campaign UUID (get from list_campaigns if needed)\n\n**Returns:**\n- Complete campaign configuration\n- Email sequences and variants\n- Sending schedules and timezones\n- Sender email accounts (email_list)\n- Tracking settings\n- Daily limits and gaps\n- Campaign status and timestamps\n\n**Performance:**\n- Fast response (< 1 second)\n- No pagination needed\n\n**Related Tools:**\n- Use `list_campaigns` to find campaigns or get campaign IDs\n- Use `update_campaign` to modify campaign settings',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'string', description: 'Campaign ID (UUID) - REQUIRED. Get from list_campaigns if you don\'t have it. Example: "9a309ee6-2908-4158-a2c5-431c9bfadf40"' }
          },
          required: ['campaign_id'],
          additionalProperties: false
        }
      },
      {
        name: 'update_campaign',
        description: '✏️ UPDATE CAMPAIGN SETTINGS\n\nModifies settings of an existing campaign. Requires campaign_id. All settings are optional - only provide fields you want to change.\n\n**Required:**\n- `campaign_id`: ID of campaign to update\n\n**Common Updates:**\n- Campaign name, status, schedules\n- Email sequences and variants\n- Tracking settings (open/link tracking)\n- Daily limits and sending gaps\n- Sender accounts (email_list)\n\n**Note:** This modifies campaign data. Use `get_campaign` to view details, `list_campaigns` to list campaigns.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: {
              type: 'string',
              description: 'REQUIRED: ID of the existing campaign to modify. This parameter is mandatory.'
            },
            name: {
              type: 'string',
              description: 'OPTIONAL: New campaign name to UPDATE the existing campaign name. Only provide this if you want to CHANGE the campaign name.'
            },
            pl_value: {
              type: 'number',
              description: 'OPTIONAL: New positive lead value to UPDATE. Only provide this if you want to MODIFY the pl_value setting.'
            },
            is_evergreen: {
              type: 'boolean',
              description: 'OPTIONAL: New evergreen status to UPDATE. Only provide this if you want to CHANGE whether the campaign is evergreen.'
            },
            campaign_schedule: {
              type: 'object',
              description: 'OPTIONAL: New schedule configuration to UPDATE the existing campaign schedule. Only provide this if you want to MODIFY the schedule settings.',
              properties: {
                schedules: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: true
                  }
                }
              },
              additionalProperties: true
            },
            sequences: {
              type: 'array',
              description: 'OPTIONAL: New email sequences to UPDATE the existing sequences. Only provide this if you want to MODIFY the email sequences.',
              items: {
                type: 'object',
                additionalProperties: true
              }
            },
            email_gap: {
              type: 'number',
              description: 'OPTIONAL: New email gap value (in minutes) to UPDATE. Only provide this if you want to CHANGE the gap between emails.'
            },
            random_wait_max: {
              type: 'number',
              description: 'OPTIONAL: New maximum random wait time (in minutes) to UPDATE. Only provide this if you want to MODIFY the random wait setting.'
            },
            text_only: {
              type: 'boolean',
              description: 'OPTIONAL: New text-only setting to UPDATE. Only provide this if you want to CHANGE whether the campaign is text only.'
            },
            email_list: {
              type: 'array',
              description: 'OPTIONAL: New list of account emails to UPDATE for sending. Only provide this if you want to MODIFY which email accounts are used.',
              items: { type: 'string' }
            },
            daily_limit: {
              type: 'number',
              description: 'OPTIONAL: New daily sending limit to UPDATE per account. Only provide this if you want to CHANGE the daily limit.'
            },
            stop_on_reply: {
              type: 'boolean',
              description: 'OPTIONAL: New stop-on-reply setting to UPDATE. Only provide this if you want to MODIFY whether the campaign stops on reply.'
            },
            email_tag_list: {
              type: 'array',
              description: 'OPTIONAL: New list of email tag UUIDs to UPDATE. Only provide this if you want to CHANGE the email tags.',
              items: { type: 'string' }
            },
            link_tracking: {
              type: 'boolean',
              description: 'OPTIONAL: New link tracking setting to UPDATE. Only provide this if you want to MODIFY whether links are tracked.'
            },
            open_tracking: {
              type: 'boolean',
              description: 'OPTIONAL: New open tracking setting to UPDATE. Only provide this if you want to MODIFY whether opens are tracked.'
            },
            stop_on_auto_reply: {
              type: 'boolean',
              description: 'OPTIONAL: New stop-on-auto-reply setting to UPDATE. Only provide this if you want to CHANGE whether to stop on auto-replies.'
            },
            daily_max_leads: {
              type: 'number',
              description: 'OPTIONAL: New daily maximum leads value to UPDATE. Only provide this if you want to MODIFY the daily max leads setting.'
            },
            prioritize_new_leads: {
              type: 'boolean',
              description: 'OPTIONAL: New prioritize-new-leads setting to UPDATE. Only provide this if you want to CHANGE the lead prioritization.'
            },
            auto_variant_select: {
              type: 'object',
              description: 'OPTIONAL: New auto variant selection settings to UPDATE. Only provide this if you want to MODIFY the auto variant selection configuration.',
              additionalProperties: true
            },
            match_lead_esp: {
              type: 'boolean',
              description: 'OPTIONAL: New match-lead-ESP setting to UPDATE. Only provide this if you want to CHANGE whether to match leads by ESP.'
            },
            stop_for_company: {
              type: 'boolean',
              description: 'OPTIONAL: New stop-for-company setting to UPDATE. Only provide this if you want to MODIFY whether to stop for entire company on reply.'
            },
            insert_unsubscribe_header: {
              type: 'boolean',
              description: 'OPTIONAL: New unsubscribe header setting to UPDATE. Only provide this if you want to CHANGE whether to insert unsubscribe headers.'
            },
            allow_risky_contacts: {
              type: 'boolean',
              description: 'OPTIONAL: New risky contacts setting to UPDATE. Only provide this if you want to MODIFY whether to allow risky contacts.'
            },
            disable_bounce_protect: {
              type: 'boolean',
              description: 'OPTIONAL: New bounce protection setting to UPDATE. Only provide this if you want to CHANGE whether bounce protection is disabled.'
            },
            cc_list: {
              type: 'array',
              description: 'OPTIONAL: New CC email addresses list to UPDATE. Only provide this if you want to MODIFY the CC list.',
              items: { type: 'string' }
            },
            bcc_list: {
              type: 'array',
              description: 'OPTIONAL: New BCC email addresses list to UPDATE. Only provide this if you want to MODIFY the BCC list.',
              items: { type: 'string' }
            }
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
        description: '📊 LIST LEADS - Sequential Pagination\n\nReturns leads with sequential pagination support. Each call returns one page of results (default 100 leads, max 100). Lead datasets can be large (1000s-10000s+), so filtering is recommended for targeted queries.\n\n**Pagination:**\n- Response includes `pagination.next_starting_after` cursor if more results available\n- To get next page: Use the EXACT cursor value from `response.pagination.next_starting_after` as `starting_after` parameter\n- CRITICAL: Do NOT use lead IDs or emails from the data - only use the cursor from pagination field\n- The API returns the correct cursor - do not construct it yourself\n- No cursor in response means you have all results\n- Fast response: ~2-5 seconds per page\n\n**Pagination Example:**\nPage 1: Call with no starting_after → Response has \"next_starting_after\": \"lead_cursor_xyz\"\nPage 2: Call with starting_after=\"lead_cursor_xyz\" → Response has \"next_starting_after\": \"lead_cursor_abc\"\nPage 3: Call with starting_after=\"lead_cursor_abc\" → Response has no next_starting_after (complete)\n\n**Filtering Options:**\n- `campaign`: Filter by campaign ID\n- `list_id`: Filter by lead list ID\n- `search`: Search by name or email\n- `filter`: Contact status filters (see below)\n- `distinct_contacts`: Group by email (true/false)\n- `limit`: Items per page (1-100, default: 100)\n\n**Contact Status Filters:**\n- `FILTER_VAL_CONTACTED` - Leads that replied\n- `FILTER_VAL_NOT_CONTACTED` - Not yet contacted\n- `FILTER_VAL_COMPLETED` - Completed sequence\n- `FILTER_VAL_UNSUBSCRIBED` - Unsubscribed\n- `FILTER_VAL_ACTIVE` - Currently active\n\n**Interest Status Filters:**\n- `FILTER_LEAD_INTERESTED` - Marked as interested\n- `FILTER_LEAD_MEETING_BOOKED` - Meeting scheduled\n- `FILTER_LEAD_CLOSED` - Closed/won\n\n**Common Usage:**\n- List all leads: Call repeatedly with cursor from pagination.next_starting_after until no cursor returned\n- Count leads: Iterate through all pages, sum the counts\n- Find specific lead: Use `search` parameter\n- Campaign leads: Use `campaign` parameter\n- Replied leads: Use `filter="FILTER_VAL_CONTACTED"`\n\n**Note:** For large datasets, use filtering parameters to narrow results and improve performance.',
        inputSchema: {
          type: 'object',
          properties: {
            // Basic filtering parameters
            campaign: { type: 'string', description: 'Campaign ID to filter leads (UUID format)' },
            list_id: { type: 'string', description: 'List ID to filter leads (UUID format)' },
            list_ids: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by multiple list IDs (optional). Example: ["list1", "list2"]'
            },
            status: { type: 'string', description: 'Filter by lead status (optional)' },

            // Date filtering (client-side)
            created_after: {
              type: 'string',
              description: 'Filter leads created after this date (YYYY-MM-DD format). Client-side filtering applied after retrieval. Example: "2025-09-01"',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$'
            },
            created_before: {
              type: 'string',
              description: 'Filter leads created before this date (YYYY-MM-DD format). Client-side filtering applied after retrieval. Example: "2025-09-30"',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$'
            },

            // Search and filtering
            search: {
              type: 'string',
              description: 'Search string to search leads by First Name, Last Name, or Email. Example: "John Doe"'
            },
            filter: {
              type: 'string',
              description: `Filter criteria for leads. The LLM should understand natural language and map to these technical values (send technical value to API, but communicate human-readable description to user):

**Contact Status Filters:**
• FILTER_VAL_CONTACTED - "Leads that have been contacted (replied to emails)"
• FILTER_VAL_NOT_CONTACTED - "Leads that have not been contacted yet"
• FILTER_VAL_COMPLETED - "Leads that completed the email sequence"
• FILTER_VAL_UNSUBSCRIBED - "Leads that unsubscribed from emails"
• FILTER_VAL_ACTIVE - "Leads that are currently active in campaigns"

**Interest Status Filters:**
• FILTER_LEAD_INTERESTED - "Leads marked as interested"
• FILTER_LEAD_NOT_INTERESTED - "Leads marked as not interested"
• FILTER_LEAD_MEETING_BOOKED - "Leads with a meeting booked"
• FILTER_LEAD_MEETING_COMPLETED - "Leads with a completed meeting"
• FILTER_LEAD_CLOSED - "Leads marked as closed/won"

**Additional Filters (26 total - API supports 16 more beyond the 10 listed above)**

When user asks in natural language (e.g., "show me leads that replied"), map to technical value (FILTER_VAL_CONTACTED) for API call, but show user-friendly description in response.

Example: "FILTER_VAL_CONTACTED"`,
              enum: [
                'FILTER_VAL_CONTACTED',
                'FILTER_VAL_NOT_CONTACTED',
                'FILTER_VAL_COMPLETED',
                'FILTER_VAL_UNSUBSCRIBED',
                'FILTER_VAL_ACTIVE',
                'FILTER_LEAD_INTERESTED',
                'FILTER_LEAD_NOT_INTERESTED',
                'FILTER_LEAD_MEETING_BOOKED',
                'FILTER_LEAD_MEETING_COMPLETED',
                'FILTER_LEAD_CLOSED'
              ]
            },

            // ID-based filtering (corrected parameter names per API docs)
            included_ids: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of specific lead IDs to include (maps to API "ids" parameter). Example: ["01997ba3-0106-7bf4-8584-634349eecf07"]'
            },
            excluded_ids: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of lead IDs to exclude. Example: ["01997ba3-0106-7bf4-8584-6344c6b1ce5a"]'
            },
            contacts: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of emails the leads need to have. Example: ["test@test.com"]'
            },
            organization_user_ids: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of organization user IDs to filter leads. Example: ["01997ba3-0434-7c3e-ae15-161ee2bf2b82"]'
            },
            smart_view_id: {
              type: 'string',
              description: 'Smart view ID to filter leads. Example: "01997ba3-0434-7c3e-ae15-161fc88bf890"'
            },
            is_website_visitor: {
              type: 'boolean',
              description: 'Filter for leads that are website visitors. Example: true'
            },
            distinct_contacts: {
              type: 'boolean',
              description: 'Whether to return distinct contacts only'
            },
            in_campaign: {
              type: 'boolean',
              description: 'Whether the lead is in a campaign. Example: true'
            },
            in_list: {
              type: 'boolean',
              description: 'Whether the lead is in a list. Example: true'
            },
            enrichment_status: {
              type: 'number',
              description: 'Enrichment status enum: 1=successfully enriched, 11=pending enrichment, -1=not available, -2=error occurred. Example: 1'
            },
            queries: {
              type: 'array',
              items: { type: 'object' },
              description: 'Advanced query objects for complex filtering. Example: [{"actionType":"email-open","values":{"occurrence-days":1}}]'
            },

            // Pagination parameters
            limit: {
              type: 'number',
              description: 'Number of leads per page (1-100, default: 100)',
              minimum: 1,
              maximum: 100
            },
            starting_after: {
              type: 'string',
              description: 'Pagination cursor from previous response. CRITICAL: Use the EXACT value from response.pagination.next_starting_after field (NOT a lead ID or email from the data). The API returns the correct cursor value - do not construct it yourself. Omit for first page.'
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
        description: '📋 CREATE NEW LEAD WITH CUSTOM VARIABLES SUPPORT\n\n✨ RECOMMENDED WORKFLOW:\n\n1️⃣ Basic Lead Creation:\n• Provide email (required for identification)\n• Add first_name, last_name, company_name for personalization\n• Lead will be created and can be added to campaigns\n\n2️⃣ Advanced Lead Creation with Custom Variables:\n• Use custom_variables parameter for campaign-specific data\n• CRITICAL: Always check existing campaign custom variables FIRST\n• Align your custom_variables with campaign\'s existing fields\n• Example: If campaign uses {{headcount}}, include headcount in custom_variables\n\n⚠️ CRITICAL REQUIREMENTS:\n\n1️⃣ EMAIL VALIDATION:\n• Email must be valid format (user@domain.com)\n• Email is the primary identifier for leads\n• Duplicate emails are handled by skip_if_* parameters\n\n2️⃣ CUSTOM VARIABLES - ALIGNMENT IS CRITICAL:\n• ALWAYS ask user about custom_variables when campaign_id is provided\n• Check what variables the campaign already uses ({{headcount}}, {{revenue}}, etc.)\n• Match the EXACT field names from the campaign\n• Do NOT arbitrarily create new custom variable names\n• Example: If campaign uses {{companyRevenue}}, use "companyRevenue" not "revenue"\n\n3️⃣ SKIP PARAMETERS:\n• skip_if_in_workspace: Skip if email exists anywhere in workspace\n• skip_if_in_campaign: Skip if email exists in THIS campaign\n• skip_if_in_list: Skip if email exists in THIS list\n• Use these to prevent duplicates\n\n📚 COMMON USER REQUEST EXAMPLES:\n\n1️⃣ "Add a lead to campaign X":\n   → Get campaign_id from user or list_campaigns\n   → Ask user: "Does this campaign use custom variables like headcount, revenue, etc.?"\n   → Collect email, first_name, last_name, company_name\n   → If custom variables exist, collect those values\n   → Create lead with aligned custom_variables\n\n2️⃣ "Import lead with custom fields":\n   → Ask: "What custom fields does your campaign expect?"\n   → Example response: "headcount, company_revenue, industry"\n   → Create custom_variables object: {"headcount": "50-100", "company_revenue": "$1M-$5M", "industry": "SaaS"}\n   → NEVER use arbitrary field names\n\n3️⃣ "Add lead and skip if duplicate":\n   → Set skip_if_in_campaign: true (most common)\n   → Or skip_if_in_workspace: true (stricter)\n   → Lead creation will be skipped if email already exists\n\n4️⃣ "Create lead with verification":\n   → Set verify_leads_on_import: true\n   → Email will be verified before adding to campaign\n   → Improves deliverability\n\n💡 CUSTOM VARIABLES BEST PRACTICES:\n\n• Custom variables enable personalization: "Hi {{firstName}}, I see {{companyName}} has {{headcount}} employees"\n• Common custom variables: headcount, revenue, industry, location, job_title, pain_point\n• Always use camelCase or snake_case consistently\n• Values should be strings, even for numbers: "50-100" not 50\n• Ask user for campaign context before creating custom variables\n\n⏱️ PERFORMANCE NOTE:\n• Lead creation is fast (< 1 second)\n• Verification (if enabled) adds 2-5 seconds\n• Batch imports should use skip_if_* to avoid duplicate errors\n\nCreate a new lead with full support for custom variables, campaign association, and duplicate prevention.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign: { type: 'string', description: 'Campaign ID (UUID) to associate the lead with. Get this from list_campaigns or user.' },
            email: { type: 'string', description: 'Lead email address (REQUIRED for lead identification). Must be valid format: user@domain.com' },
            first_name: { type: 'string', description: 'Lead first name for personalization (e.g., "John")' },
            last_name: { type: 'string', description: 'Lead last name for personalization (e.g., "Smith")' },
            company_name: { type: 'string', description: 'Lead company name for personalization (e.g., "Acme Corp")' },
            phone: { type: 'string', description: 'Lead phone number (optional)' },
            website: { type: 'string', description: 'Lead website URL (optional, e.g., "https://acme.com")' },
            personalization: { type: 'string', description: 'Custom personalization message for this specific lead (optional)' },
            lt_interest_status: { type: 'number', description: 'Lead interest status enum: -3 (Not Interested) to 4 (Meeting Completed). Optional.', minimum: -3, maximum: 4 },
            pl_value_lead: { type: 'string', description: 'Potential lead value (optional, e.g., "$5000")' },
            list_id: { type: 'string', description: 'List ID (UUID) to associate lead with. Use create_lead_list first if needed.' },
            assigned_to: { type: 'string', description: 'User ID (UUID) to assign this lead to for follow-up (optional)' },
            skip_if_in_workspace: { type: 'boolean', description: 'Skip creation if email exists ANYWHERE in workspace (strictest duplicate check)', default: false },
            skip_if_in_campaign: { type: 'boolean', description: 'Skip creation if email exists in THIS campaign (recommended for campaign imports)', default: false },
            skip_if_in_list: { type: 'boolean', description: 'Skip creation if email exists in THIS list (recommended for list imports)', default: false },
            blocklist_id: { type: 'string', description: 'Blocklist ID (UUID) to check against before creating lead (optional)' },
            verify_leads_for_lead_finder: { type: 'boolean', description: 'Enable lead finder verification (optional, adds processing time)', default: false },
            verify_leads_on_import: { type: 'boolean', description: 'Verify email deliverability before import (recommended, adds 2-5 seconds)', default: false },
            custom_variables: {
              type: 'object',
              description: '⚠️ CRITICAL: Custom metadata for campaign personalization. ALWAYS ask user about existing campaign variables FIRST!\n\nExamples:\n• {"headcount": "50-100", "revenue": "$1M-$5M", "industry": "SaaS"}\n• {"job_title": "CEO", "pain_point": "scaling sales", "location": "San Francisco"}\n• {"company_size": "Mid-market", "tech_stack": "Salesforce, HubSpot"}\n\nBest Practices:\n1. Ask: "What custom variables does your campaign use?"\n2. Match EXACT field names from campaign (case-sensitive)\n3. Use string values even for numbers: "100" not 100\n4. Common fields: headcount, revenue, industry, location, job_title, pain_point\n5. These enable personalization: {{headcount}}, {{revenue}} in email templates',
              additionalProperties: true
            }
          },
          required: [],
          additionalProperties: false
        }
      },
      {
        name: 'update_lead',
        description: '✏️ UPDATE EXISTING LEAD WITH CUSTOM VARIABLES SUPPORT\n\n✨ RECOMMENDED WORKFLOW:\n\n1️⃣ Get Lead ID:\n• Use list_leads or get_lead to find the lead you want to update\n• Lead ID is required (UUID format)\n\n2️⃣ Partial Updates Supported:\n• Only provide the fields you want to CHANGE\n• Omitted fields will remain unchanged\n• Example: Update only custom_variables without changing name\n\n3️⃣ Custom Variables Updates:\n• Can add NEW custom variables to existing lead\n• Can modify EXISTING custom variable values\n• Can replace entire custom_variables object\n• Maintains alignment with campaign variables\n\n⚠️ CRITICAL REQUIREMENTS:\n\n1️⃣ LEAD ID REQUIRED:\n• Must provide valid lead_id (UUID)\n• Get from list_leads, get_lead, or create_lead response\n• Example: "01997ba3-0106-7bf4-8584-634349eecf07"\n\n2️⃣ PARTIAL UPDATES:\n• Only include parameters you want to UPDATE\n• Do NOT include all fields if only changing one\n• Example: To update just phone, only send {lead_id, phone}\n\n3️⃣ CUSTOM VARIABLES UPDATES:\n• Updating custom_variables REPLACES the entire object\n• To add a field: Include ALL existing fields + new field\n• To modify a field: Include ALL fields with updated value\n• To remove a field: Omit it from the custom_variables object\n\n📚 COMMON USER REQUEST EXAMPLES:\n\n1️⃣ "Update lead\'s custom variables":\n   → Get current lead data with get_lead first\n   → See existing custom_variables: {"headcount": "50-100", "revenue": "$1M"}\n   → To add industry: {"headcount": "50-100", "revenue": "$1M", "industry": "SaaS"}\n   → To update revenue: {"headcount": "50-100", "revenue": "$5M", "industry": "SaaS"}\n\n2️⃣ "Change lead\'s interest status":\n   → Set lt_interest_status to appropriate value:\n     • -3 = Not Interested\n     • 0 = Neutral/Unknown\n     • 1 = Interested\n     • 2 = Very Interested\n     • 3 = Meeting Booked\n     • 4 = Meeting Completed\n   → Only send {lead_id, lt_interest_status}\n\n3️⃣ "Update lead contact info":\n   → Update first_name, last_name, company_name, phone, website\n   → Only include fields that changed\n   → Example: {lead_id, phone: "+1-555-0123", website: "https://newdomain.com"}\n\n4️⃣ "Assign lead to team member":\n   → Set assigned_to to user UUID\n   → Get user UUID from workspace settings or team list\n   → Example: {lead_id, assigned_to: "user-uuid-here"}\n\n💡 CUSTOM VARIABLES UPDATE PATTERNS:\n\nPattern 1 - Add New Field:\n• Current: {"headcount": "50"}\n• Update: {"headcount": "50", "industry": "SaaS"}\n• Result: Both fields present\n\nPattern 2 - Modify Existing Field:\n• Current: {"revenue": "$1M"}\n• Update: {"revenue": "$5M"}\n• Result: Revenue updated\n\nPattern 3 - Replace All Variables:\n• Current: {"old_field": "value"}\n• Update: {"new_field": "value"}\n• Result: old_field removed, new_field added\n\n⏱️ PERFORMANCE NOTE:\n• Updates are instant (< 1 second)\n• No verification delay\n• Safe to update multiple leads in sequence\n\nUpdate an existing lead with support for partial updates and custom variables management.',
        inputSchema: {
          type: 'object',
          properties: {
            lead_id: { type: 'string', description: 'Lead ID (UUID) - REQUIRED. Get from list_leads or get_lead. Example: "01997ba3-0106-7bf4-8584-634349eecf07"' },
            personalization: { type: 'string', description: 'Custom personalization message for this lead (optional). Overrides campaign default.' },
            website: { type: 'string', description: 'Website URL (optional). Example: "https://acme.com"' },
            last_name: { type: 'string', description: 'Last name (optional). Example: "Smith"' },
            first_name: { type: 'string', description: 'First name (optional). Example: "John"' },
            company_name: { type: 'string', description: 'Company name (optional). Example: "Acme Corp"' },
            phone: { type: 'string', description: 'Phone number (optional). Example: "+1-555-0123"' },
            lt_interest_status: { type: 'number', description: 'Lead interest status (optional): -3=Not Interested, 0=Neutral, 1=Interested, 2=Very Interested, 3=Meeting Booked, 4=Meeting Completed', minimum: -3, maximum: 4 },
            pl_value_lead: { type: 'string', description: 'Potential lead value (optional). Example: "$5000"' },
            assigned_to: { type: 'string', description: 'User UUID to assign lead to (optional). Get from workspace team list.' },
            custom_variables: {
              type: 'object',
              description: '⚠️ REPLACES entire custom_variables object! To add/modify fields, include ALL existing fields + changes.\n\nUpdate Patterns:\n1. Add field: Include all current fields + new field\n2. Modify field: Include all fields with updated value\n3. Remove field: Omit from object\n\nExample - Add industry to existing variables:\n• Current: {"headcount": "50-100", "revenue": "$1M"}\n• Update: {"headcount": "50-100", "revenue": "$1M", "industry": "SaaS"}\n\nGet current custom_variables with get_lead first!',
              additionalProperties: true
            }
          },
          required: ['lead_id'],
          additionalProperties: false
        }
      },
      {
        name: 'list_lead_lists',
        description: '📋 LIST LEAD LISTS - Sequential Pagination\n\nReturns lead lists with sequential pagination support. Each call returns one page of results (default 100 lead lists, max 100).\n\n**Pagination:**\n- Response includes timestamp-based cursor in pagination field if more results available\n- To get next page: Use the EXACT cursor value from response pagination field as `starting_after` parameter\n- CRITICAL: Do NOT construct timestamps manually - only use the cursor from pagination field\n- The API returns the correct cursor value\n- No cursor in response means you have all results\n- Fast response: ~2-5 seconds per page\n\n**Pagination Example:**\nPage 1: Call with no starting_after → Response has pagination cursor\nPage 2: Call with starting_after=<cursor from response> → Response has next pagination cursor\nPage 3: Call with starting_after=<cursor from response> → Response has no cursor (complete)\n\n**Filtering Options:**\n- `search`: Search by lead list name\n- `has_enrichment_task`: Filter by enrichment status (true/false)\n- `limit`: Items per page (1-100, default: 100)\n\n**Common Usage:**\n- List all lead lists: Call repeatedly with cursor from pagination field until no cursor returned\n- Search lead lists: Use `search` parameter\n- Filter by enrichment: Use `has_enrichment_task` parameter\n- Count lead lists: Iterate through all pages, sum the counts',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Number of items to return (1-100, default: 100)', minimum: 1, maximum: 100 },
            starting_after: { type: 'string', description: 'Pagination cursor (timestamp) from previous response. CRITICAL: Use the EXACT value from response pagination field (NOT constructed manually). The API returns the correct cursor. Omit for first page.' },
            has_enrichment_task: { type: 'boolean', description: 'Filter by enrichment task status - true returns only lists with enrichment enabled, false returns only lists without enrichment' },
            search: { type: 'string', description: 'Search query to filter lead lists by name (e.g., "Summer 2025 List")' }
          },
          additionalProperties: false
        }
      },
      {
        name: 'create_lead_list',
        description: '📝 CREATE LEAD LIST - ORGANIZE LEADS INTO COLLECTIONS\n\n✨ WHAT ARE LEAD LISTS?\n\nLead lists are collections/groups of leads that can be:\n• Organized by source (e.g., "LinkedIn Prospects", "Conference Attendees")\n• Organized by segment (e.g., "Enterprise Leads", "SMB Leads")\n• Used for batch operations (import, export, assign to campaigns)\n• Tracked separately for analytics\n\n✨ WHEN TO USE LEAD LISTS:\n\n✅ USE create_lead_list when:\n• Organizing leads by source or segment\n• Importing leads in batches\n• Want to track lead groups separately\n• Need to assign multiple leads to campaigns together\n• Building targeted prospect lists\n\n❌ DO NOT USE when:\n• Adding single leads directly to campaigns → Use create_lead with campaign_id instead\n• Just want to add leads to existing campaign → Use create_lead with campaign_id\n\n⚠️ LEAD LISTS vs DIRECT CAMPAIGN ADD:\n\n**Lead Lists** (create_lead_list + create_lead with list_id):\n• ✅ Organize leads before adding to campaigns\n• ✅ Reuse same list across multiple campaigns\n• ✅ Track lead source/segment\n• ✅ Batch operations\n• Use when: Organizing large prospect databases\n\n**Direct Campaign Add** (create_lead with campaign_id):\n• ✅ Faster - one step instead of two\n• ✅ Simpler - no list management needed\n• ✅ Direct association with campaign\n• Use when: Adding leads directly to specific campaign\n\n📚 COMMON USER REQUEST EXAMPLES:\n\n1️⃣ "Create a list for LinkedIn prospects":\n   → Call create_lead_list with name: "LinkedIn Prospects"\n   → Returns list_id\n   → Use list_id when creating leads with create_lead\n\n2️⃣ "Organize leads by industry":\n   → Create multiple lists: "SaaS Leads", "E-commerce Leads", "Healthcare Leads"\n   → Add leads to appropriate list using create_lead with list_id\n\n3️⃣ "Import leads from CSV":\n   → Create lead list first: "CSV Import - Jan 2025"\n   → Import leads with create_lead using list_id\n   → Assign entire list to campaign later\n\n💡 ENRICHMENT (has_enrichment_task parameter):\n\n**What is enrichment?**\n• Automatically enriches lead data when leads are added to this list\n• Finds missing info: company data, social profiles, phone numbers\n• Runs in background for each lead added to the list\n• Optional - set has_enrichment_task: true to enable\n\n**When to enable enrichment:**\n• Have partial lead data (just email, need company info)\n• Want to auto-fill missing fields for all leads in this list\n• Building prospect lists from minimal data\n\n**When NOT to enable:**\n• Already have complete lead data\n• Don\'t need additional enrichment\n• Most standard use cases (default: false)\n\n⏱️ PERFORMANCE NOTE:\n• List creation is instant (< 1 second)\n• Enrichment (if enabled) runs in background per lead\n• Can add leads to list immediately after creation\n\n🎯 RECOMMENDED WORKFLOW:\n\n**Option A - Using Lead Lists**:\n1. Create lead list with create_lead_list\n2. Add leads with create_lead (use list_id parameter)\n3. Assign list to campaign (leads inherit campaign association)\n\n**Option B - Direct Campaign Add** (Simpler):\n1. Create campaign with create_campaign\n2. Add leads directly with create_lead (use campaign_id parameter)\n3. Skip list creation entirely\n\nCreate a new lead list for organizing leads into collections. Use list_id when creating leads to associate them with this list.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name of the lead list (REQUIRED). Be descriptive! Examples: "LinkedIn Prospects Q1 2025", "Conference Attendees - SaaStr", "Enterprise SaaS Leads"' },
            has_enrichment_task: { type: 'boolean', description: 'Enable automatic enrichment for leads added to this list (OPTIONAL, default: false). Set to true to auto-enrich lead data (find missing company info, social profiles, etc.). Most users should leave this false.', default: false },
            owned_by: { type: 'string', description: 'User ID (UUID) of the owner of this lead list (OPTIONAL). Defaults to the user that created the list. Only specify if assigning to different team member.' }
          },
          required: ['name'],
          additionalProperties: false
        }
      },
      {
        name: 'list_emails',
        description: '📧 LIST EMAILS - Offset-Based Pagination\n\nReturns emails with offset-based pagination. Each call returns one page of results (default 100 emails, max 100). Email datasets are typically very large (10000s-100000s+), so filtering by campaign is strongly recommended.\n\n**Pagination:**\n- Uses offset-based pagination (not cursor-based)\n- Set `offset` parameter to skip items (e.g., offset=0 for page 1, offset=100 for page 2)\n- Increment offset by limit value for each subsequent page\n- Fast response: ~2-5 seconds per page\n\n**Filtering Options:**\n- `campaign_id`: Filter by campaign ID (HIGHLY RECOMMENDED for large datasets)\n- `limit`: Items per page (1-100, default: 100)\n- `offset`: Number of items to skip (default: 0)\n\n**Common Usage:**\n- List campaign emails: Use `campaign_id` parameter to get emails for specific campaign\n- List all emails: Call repeatedly, incrementing `offset` by 100 each time\n- Count emails: Iterate through all pages, sum the counts\n- Paginate through emails: Start with offset=0, then offset=100, offset=200, etc.\n\n**Note:** Email datasets are typically massive. Filtering by `campaign_id` significantly improves performance and reduces response size.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'string', description: 'Filter by campaign ID' },
            limit: { type: 'number', description: 'Maximum number of emails to retrieve (default: 100, max: 100)', default: 100 },
            offset: { type: 'number', description: 'Number of emails to skip for pagination (default: 0)', default: 0 }
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
        description: '🚨 CRITICAL WARNING: SENDS REAL EMAILS TO REAL PEOPLE!\n\n⚠️⚠️⚠️ THIS TOOL SENDS ACTUAL EMAIL REPLIES ⚠️⚠️⚠️\n\n🛑 BEFORE CALLING THIS TOOL:\n\n1️⃣ **ALWAYS CONFIRM WITH USER FIRST**:\n   • Show the recipient email address\n   • Show the complete email body\n   • Show the subject line\n   • Get explicit "yes" confirmation before sending\n   • NEVER send without user approval\n\n2️⃣ **VERIFY RECIPIENT**:\n   • Ensure you have permission to email this person\n   • Verify the email address is correct\n   • Confirm this is the intended recipient\n   • Check if this is a test or production email\n\n3️⃣ **REVIEW CONTENT**:\n   • Proofread the email body for errors\n   • Verify tone and professionalism\n   • Check for personalization accuracy\n   • Ensure no placeholder text remains ({{firstName}}, etc.)\n\n⚠️ CRITICAL REQUIREMENTS:\n\n1️⃣ **USER CONFIRMATION REQUIRED**:\n   • MUST ask user: "Ready to send this email to [recipient]? Please confirm."\n   • MUST show complete email content before sending\n   • MUST wait for explicit approval\n   • NEVER send automatically\n\n2️⃣ **VALID PARAMETERS**:\n   • reply_to_uuid: Get from list_emails or get_email\n   • eaccount: Must be a connected sender account from your workspace\n   • subject: Should be relevant to original email (often "Re: [original subject]")\n   • body: Must include either html or text (or both)\n\n3️⃣ **SENDER ACCOUNT VERIFICATION**:\n   • eaccount must be active and connected\n   • Account must have permission to send\n   • Use list_accounts to verify account status\n\n📚 COMMON USER REQUEST EXAMPLES:\n\n1️⃣ "Reply to this email":\n   → Get email details with get_email or list_emails\n   → Extract reply_to_uuid from email\n   → Draft reply content\n   → SHOW USER: "I will send this reply to [recipient]: [body]"\n   → WAIT FOR: User confirmation\n   → THEN: Call reply_to_email\n\n2️⃣ "Send a follow-up to lead X":\n   → Find email with list_emails (filter by lead)\n   → Get reply_to_uuid\n   → Draft follow-up content\n   → CONFIRM WITH USER before sending\n   → Send reply\n\n💡 EMAIL BODY FORMAT:\n\n**Option 1 - HTML Only**:\n```json\n{\n  "body": {\n    "html": "<p>Hi John,</p><p>Thanks for your interest...</p>"\n  }\n}\n```\n\n**Option 2 - Text Only**:\n```json\n{\n  "body": {\n    "text": "Hi John,\\n\\nThanks for your interest..."\n  }\n}\n```\n\n**Option 3 - Both** (Recommended):\n```json\n{\n  "body": {\n    "html": "<p>Hi John,</p><p>Thanks for your interest...</p>",\n    "text": "Hi John,\\n\\nThanks for your interest..."\n  }\n}\n```\n\n⏱️ PERFORMANCE NOTE:\n• Email sends immediately (< 2 seconds)\n• Cannot be undone once sent\n• Recipient receives email in real-time\n• Affects sender reputation if email bounces or marked as spam\n\n🎯 BEST PRACTICES:\n\n1. **Always confirm with user** before sending\n2. **Show complete email content** for review\n3. **Verify recipient email** is correct\n4. **Use professional tone** and proper grammar\n5. **Include both HTML and text** versions when possible\n6. **Test with your own email** first if unsure\n7. **Check sender account** is active and warmed up\n\n🚨 WHAT CAN GO WRONG:\n\n• ❌ Sending to wrong recipient (cannot undo!)\n• ❌ Typos or errors in email body (cannot edit after send!)\n• ❌ Unprofessional content damaging reputation\n• ❌ Sending from inactive account (email fails)\n• ❌ Placeholder text not replaced ({{firstName}} sent as-is)\n• ❌ Spam complaints hurting sender reputation\n\nReply to an email - SENDS REAL EMAILS! Always confirm with user first. Show recipient and content before sending. Cannot be undone.',
        inputSchema: {
          type: 'object',
          properties: {
            reply_to_uuid: {
              type: 'string',
              description: 'The UUID of the email to reply to (REQUIRED). Get from list_emails or get_email response. Example: "email-uuid-here"'
            },
            eaccount: {
              type: 'string',
              description: 'The email account that will send this reply (REQUIRED). Must be a connected sender account from your workspace. Get from list_accounts. Example: "sender@yourdomain.com"'
            },
            subject: {
              type: 'string',
              description: 'Subject line of the reply email (REQUIRED). Often "Re: [original subject]". Example: "Re: Your inquiry about our services"'
            },
            body: {
              type: 'object',
              description: 'Email body content (REQUIRED). Must include html, text, or both. Recommended: Include both for best compatibility.',
              properties: {
                html: { type: 'string', description: 'HTML content of the email. Example: "<p>Hi John,</p><p>Thanks for reaching out...</p>"' },
                text: { type: 'string', description: 'Plain text content of the email. Example: "Hi John,\\n\\nThanks for reaching out..."' }
              }
            }
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
        description: 'Get comprehensive analytics overview across all campaigns with optional date range and status filtering. Provides aggregated metrics and performance summaries. All parameters are optional - omit for all-time analytics across all campaigns.',
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
            },
            campaign_status: {
              type: 'number',
              description: 'Filter by campaign status (optional). Values: 0=Draft, 1=Active, 2=Paused, 3=Completed, 4=Running Subsequences, -99=Account Suspended, -1=Accounts Unhealthy, -2=Bounce Protect',
              enum: [0, 1, 2, 3, 4, -99, -1, -2]
            }
          },
          required: [],
          additionalProperties: false
        }
      },
      {
        name: 'update_account',
        description: 'Update a sending account settings with comprehensive parameter support matching Instantly.ai API v2 PATCH /api/v2/accounts/{email} specification. Supports updating account details, warmup configuration, tracking domains, and sending limits.',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', description: 'Email address of the account to update (required)' },

            // Basic account information
            first_name: { type: 'string', description: 'First name associated with the account' },
            last_name: { type: 'string', description: 'Last name associated with the account' },

            // Warmup configuration
            warmup: {
              type: 'object',
              description: 'Warmup configuration for the account',
              properties: {
                limit: { type: 'number', description: 'Warmup limit (number of warmup emails per day)' },
                advanced: {
                  type: 'object',
                  description: 'Advanced warmup settings',
                  properties: {
                    warm_ctd: { type: 'boolean', description: 'Warm click-to-deliver' },
                    open_rate: { type: 'number', description: 'Target open rate for warmup emails' },
                    important_rate: { type: 'number', description: 'Rate of marking emails as important' },
                    read_emulation: { type: 'boolean', description: 'Enable read emulation' },
                    spam_save_rate: { type: 'number', description: 'Rate of saving emails from spam' },
                    weekday_only: { type: 'boolean', description: 'Send warmup emails only on weekdays' }
                  }
                },
                warmup_custom_ftag: { type: 'string', description: 'Custom warmup tag' },
                increment: { type: 'string', description: 'Increment setting for warmup ramp-up' },
                reply_rate: { type: 'number', description: 'Target reply rate for warmup emails' }
              }
            },

            // Sending limits and configuration
            daily_limit: { type: 'number', description: 'Daily email sending limit per account' },
            sending_gap: { type: 'number', description: 'Gap between emails sent from this account in minutes (0-1440, minimum wait time when used with multiple campaigns)' },
            enable_slow_ramp: { type: 'boolean', description: 'Enable slow ramp up for sending limits' },

            // Tracking domain configuration
            tracking_domain_name: { type: 'string', description: 'Tracking domain name' },
            tracking_domain_status: { type: 'string', description: 'Tracking domain status' },
            skip_cname_check: { type: 'boolean', description: 'Skip CNAME check for tracking domain' },
            remove_tracking_domain: { type: 'boolean', description: 'Remove tracking domain from account' },

            // Inbox placement testing
            inbox_placement_test_limit: { type: 'number', description: 'Limit for inbox placement tests' }
          },
          required: ['email'],
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
      // ===== NEW TIER 1 TOOLS - PRODUCTION VERIFIED =====
      {
        name: 'count_unread_emails',
        description: 'Count unread emails in inbox - Safe read-only monitoring tool for production testing',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false
        }
      },
      {
        name: 'get_daily_campaign_analytics',
        description: 'Get daily campaign performance analytics with date filtering. Returns day-by-day analytics data for campaign performance tracking.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: {
              type: 'string',
              description: 'Campaign ID (optional - omit for all campaigns). Example: "0199c64d-6999-7801-82bd-cf5e06198b3f"',
              pattern: '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
            },
            start_date: {
              type: 'string',
              description: 'Start date in YYYY-MM-DD format. Example: 2024-01-01',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$'
            },
            end_date: {
              type: 'string',
              description: 'End date in YYYY-MM-DD format. Example: 2024-01-01',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$'
            },
            campaign_status: {
              type: 'number',
              description: 'Filter by campaign status (optional). Values: 0=Draft, 1=Active, 2=Paused, 3=Completed, 4=Running Subsequences, -99=Account Suspended, -1=Accounts Unhealthy, -2=Bounce Protect',
              enum: [0, 1, 2, 3, 4, -99, -1, -2]
            }
          },
          required: [],
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
        description: '🚀 ACTIVATE CAMPAIGN - START SENDING EMAILS\n\n✨ WHAT HAPPENS WHEN YOU ACTIVATE:\n\n1️⃣ **Campaign Status Changes**: Draft (0) → Active (1)\n2️⃣ **Email Sending Begins**: Campaign starts sending to leads immediately\n3️⃣ **Schedule Applies**: Emails sent according to campaign schedule (timezone, timing, days)\n4️⃣ **Daily Limits Enforced**: Respects daily_limit per sender account\n5️⃣ **Sequences Start**: Multi-step sequences begin with Step 1\n\n⚠️ CRITICAL PREREQUISITES - CHECK BEFORE ACTIVATING:\n\n✅ **REQUIRED BEFORE ACTIVATION**:\n\n1️⃣ **Campaign Must Have Sender Accounts**:\n   • Check email_list is not empty\n   • Use get_campaign to verify sender accounts are attached\n   • If empty, use update_campaign to add email_list first\n\n2️⃣ **Campaign Must Have Leads**:\n   • Campaign needs leads to send to\n   • Use list_leads with campaign_id to verify leads exist\n   • If no leads, use create_lead to add leads first\n\n3️⃣ **Campaign Must Be Configured**:\n   • Has valid email sequences (subject + body)\n   • Has valid schedule (timezone, timing, days)\n   • Has reasonable daily_limit (recommended: 30 per account)\n\n4️⃣ **Sender Accounts Must Be Ready**:\n   • Accounts must be active (status = 1)\n   • Warmup must be complete (warmup_status = 1)\n   • Use list_accounts to verify account status\n\n📚 COMMON USER REQUEST EXAMPLES:\n\n1️⃣ "Activate my campaign":\n   → FIRST: Verify prerequisites with get_campaign\n   → Check: email_list exists, sequences exist, schedule exists\n   → THEN: Call activate_campaign with campaign_id\n   → Campaign starts sending immediately\n\n2️⃣ "Start sending emails for campaign X":\n   → Same as activate - verify prerequisites first\n   → Use activate_campaign to begin sending\n\n3️⃣ "Launch campaign after review":\n   → Review campaign with get_campaign\n   → Verify all settings are correct\n   → Activate when ready\n\n💡 RECOMMENDED WORKFLOW:\n\n**Step 1**: Create campaign with create_campaign\n**Step 2**: Add leads with create_lead\n**Step 3**: Review with get_campaign (verify email_list, sequences, schedule)\n**Step 4**: Verify sender accounts with list_accounts (check warmup_status)\n**Step 5**: Activate with activate_campaign\n**Step 6**: Monitor with get_campaign_analytics\n\n⚠️ WHAT TO EXPECT AFTER ACTIVATION:\n\n• **Immediate**: Campaign status changes to Active (1)\n• **Within minutes**: First emails start sending (based on schedule)\n• **Ongoing**: Emails sent according to daily_limit and email_gap\n• **Follow-ups**: Sequence steps sent after delay (step_delay_days)\n• **Stops on reply**: If stop_on_reply=true, campaign stops for that lead\n\n🛑 TO PAUSE AFTER ACTIVATION:\n• Use pause_campaign to temporarily stop sending\n• Leads remain in campaign, sending pauses\n• Use activate_campaign again to resume\n\n⏱️ PERFORMANCE NOTE:\n• Activation is instant (< 1 second)\n• Email sending begins within minutes\n• Respects campaign schedule (won\'t send outside timing window)\n\nActivate a campaign to start sending emails. Verify prerequisites first: campaign must have sender accounts, leads, and valid configuration.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'string', description: 'Campaign ID (UUID) to activate. Get from list_campaigns or create_campaign. Example: "9a309ee6-2908-4158-a2c5-431c9bfadf40"' }
          },
          required: ['campaign_id'],
          additionalProperties: false
        }
      },
      {
        name: 'pause_campaign',
        description: '⏸️ PAUSE ACTIVE CAMPAIGN - TEMPORARILY STOP SENDING\n\n✨ WHAT HAPPENS WHEN YOU PAUSE:\n\n1️⃣ **Campaign Status Changes**: Active (1) → Paused (2)\n2️⃣ **Email Sending Stops**: No new emails will be sent\n3️⃣ **Leads Remain**: All leads stay in campaign (not removed)\n4️⃣ **Sequences Pause**: Multi-step sequences pause at current step\n5️⃣ **Can Resume**: Use activate_campaign to resume sending later\n\n✨ WHEN TO USE THIS TOOL:\n\n✅ USE pause_campaign when:\n• Need to temporarily stop sending (e.g., holiday break)\n• Want to review campaign performance before continuing\n• Need to update campaign settings before resuming\n• Sender accounts need maintenance\n• Want to prevent further sends while investigating issues\n\n❌ DO NOT USE when:\n• Want to permanently stop campaign → Leave paused or delete campaign\n• Want to stop for ONE lead only → Campaign stops automatically on reply if stop_on_reply=true\n\n⚠️ CRITICAL REQUIREMENTS:\n\n1️⃣ CAMPAIGN MUST BE ACTIVE:\n• Can only pause Active (status=1) campaigns\n• Cannot pause Draft (0) or already Paused (2) campaigns\n• Use get_campaign to check current status first\n\n2️⃣ PAUSING IS IMMEDIATE:\n• Takes effect instantly\n• In-flight emails may still send (already queued)\n• New emails will NOT be queued\n\n📚 COMMON USER REQUEST EXAMPLES:\n\n1️⃣ "Pause my campaign":\n   → Call pause_campaign with campaign_id\n   → Campaign stops sending immediately\n   → Use activate_campaign to resume later\n\n2️⃣ "Stop sending for now":\n   → Same as pause - temporarily stops campaign\n   → Leads remain, can resume anytime\n\n3️⃣ "Pause to update campaign settings":\n   → Call pause_campaign first\n   → Use update_campaign to modify settings\n   → Call activate_campaign to resume with new settings\n\n💡 PAUSE vs STOP vs DELETE:\n\n**Pause** (pause_campaign):\n• ✅ Temporary stop\n• ✅ Can resume with activate_campaign\n• ✅ Leads remain in campaign\n• ✅ Settings preserved\n• Use when: Need temporary break\n\n**Stop** (no dedicated tool):\n• Just leave campaign paused\n• Leads remain but no sending\n• Use when: Done sending but want to keep data\n\n**Delete** (no tool - use Instantly.ai UI):\n• ❌ Permanent removal\n• ❌ Cannot undo\n• ❌ All data lost\n• Use when: Campaign no longer needed\n\n⚠️ WHAT HAPPENS TO SEQUENCES:\n\n• **Step 1 sent, Step 2 pending**: Step 2 will NOT send while paused\n• **Resume campaign**: Sequences continue from where they paused\n• **Delay timing**: Pause does NOT reset step delays\n• **Example**: If Step 2 was scheduled for tomorrow, it sends tomorrow after resume\n\n🔄 TO RESUME AFTER PAUSING:\n• Use activate_campaign with same campaign_id\n• Campaign status: Paused (2) → Active (1)\n• Sending resumes immediately\n• Sequences continue from paused state\n\n⏱️ PERFORMANCE NOTE:\n• Pause is instant (< 1 second)\n• In-flight emails (already queued) may still send\n• New emails stop immediately\n• Safe to pause/resume multiple times\n\nPause an active campaign to temporarily stop sending. Leads remain in campaign. Use activate_campaign to resume.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'string', description: 'Campaign ID (UUID) to pause. Must be Active (status=1). Get from list_campaigns. Example: "9a309ee6-2908-4158-a2c5-431c9bfadf40"' }
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
      },
      {
        name: 'create_account',
        description: 'Create a new email account for sending campaigns - Account creation with full IMAP/SMTP configuration',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', description: 'Email address for the new account' },
            first_name: { type: 'string', description: 'First name associated with the account' },
            last_name: { type: 'string', description: 'Last name associated with the account' },
            provider_code: { type: 'number', description: 'Email provider code (required by API)' },
            imap_username: { type: 'string', description: 'IMAP username for receiving emails' },
            imap_password: { type: 'string', description: 'IMAP password for receiving emails' },
            imap_host: { type: 'string', description: 'IMAP server host (e.g., imap.gmail.com)' },
            imap_port: { type: 'number', description: 'IMAP server port (e.g., 993)' },
            smtp_username: { type: 'string', description: 'SMTP username for sending emails' },
            smtp_password: { type: 'string', description: 'SMTP password for sending emails' },
            smtp_host: { type: 'string', description: 'SMTP server host (e.g., smtp.gmail.com)' },
            smtp_port: { type: 'number', description: 'SMTP server port (e.g., 587)' }
          },
          required: ['email', 'first_name', 'last_name', 'provider_code', 'imap_username', 'imap_password', 'imap_host', 'imap_port', 'smtp_username', 'smtp_password', 'smtp_host', 'smtp_port'],
          additionalProperties: false
        }
      },
      {
        name: 'delete_account',
        description: '🚨 EXTREMELY DESTRUCTIVE: PERMANENTLY DELETE EMAIL ACCOUNT - ⚠️ WARNING: This action CANNOT be undone! ⚠️ WARNING: All campaign data, emails, and account settings will be lost forever! ⚠️ WARNING: Use with extreme caution!',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', description: '⚠️ DANGER: Email address of the account to DELETE PERMANENTLY AND IRREVERSIBLY' }
          },
          required: ['email'],
          additionalProperties: false
        }
      },
      {
        name: 'enable_warmup',
        description: 'Enable email warmup for an account to improve deliverability',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', description: 'Email address of the account to enable warmup for' }
          },
          required: ['email'],
          additionalProperties: false
        }
      },
      {
        name: 'disable_warmup',
        description: 'Disable email warmup for an account',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', description: 'Email address of the account to disable warmup for' }
          },
          required: ['email'],
          additionalProperties: false
        }
      },
      {
        name: 'test_account_vitals',
        description: 'Test account vitals and connectivity - Diagnostic tool for account health',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', description: 'Email address of the account to test' }
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
export async function executeToolDirectly(name: string, args: any, apiKey?: string): Promise<any> {
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
      console.error('[Instantly MCP] 📊 Executing list_accounts (sequential pagination)...');

      try {
        // Build pagination and filter parameters
        const paginationParams = {
          limit: args?.limit || 100,
          ...(args?.starting_after && { starting_after: args.starting_after }),
          ...(args?.search && { search: args.search }),
          ...(args?.status !== undefined && { status: args.status }),
          ...(args?.provider_code !== undefined && { provider_code: args.provider_code }),
          ...(args?.tag_ids && { tag_ids: args.tag_ids })
        };

        // Validate parameters
        const validatedData = validateListAccountsData(paginationParams);
        console.error('[Instantly MCP] 📊 Parameters validated:', validatedData);

        // Fetch ONE page of accounts
        const result = await getAllAccounts(apiKey, paginationParams);

        // Return single page with clear pagination metadata
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                data: result.data,
                pagination: result.pagination,
                metadata: result.metadata,
                success: true
              }, null, 2)
            }
          ]
        };
      } catch (error: any) {
        console.error('[Instantly MCP] ❌ Error in list_accounts:', error.message);
        throw error;
      }
    }

    case 'list_campaigns': {
      console.error('[Instantly MCP] 📋 Executing list_campaigns (sequential pagination)...');

      try {
        const startTime = Date.now();

        // Status mapping: API returns numbers, we convert to human-readable labels
        const STATUS_MAP: Record<number, string> = {
          0: 'Draft',
          1: 'Active',
          2: 'Paused',
          3: 'Completed',
          4: 'Running Subsequences',
          '-99': 'Account Suspended',
          '-1': 'Accounts Unhealthy',
          '-2': 'Bounce Protect'
        };

        // Build query parameters for single page request
        const queryParams: any = {
          limit: args?.limit || 100, // Default to 100 items per page (max pagination)
        };

        // Add cursor if provided (for subsequent pages)
        if (args?.starting_after) {
          queryParams.starting_after = args.starting_after;
          console.error(`[Instantly MCP] 📄 Fetching page with cursor: ${args.starting_after}`);
        } else {
          console.error('[Instantly MCP] 📄 Fetching first page');
        }

        // Add API filter parameters
        if (args?.search) queryParams.search = args.search;
        if (args?.tag_ids) queryParams.tag_ids = args.tag_ids;

        // Make single API call to /campaigns endpoint
        const response = await makeInstantlyRequest('/campaigns', {
          method: 'GET',
          params: queryParams
        }, apiKey);

        const elapsed = Date.now() - startTime;

        // Extract data and pagination info from response
        const data = Array.isArray(response) ? response : (response.items || response.data || []);
        const nextCursor = response.next_starting_after || null;
        const hasMore = !!nextCursor;

        console.error(`[Instantly MCP] ✅ Retrieved ${data.length} campaigns in ${elapsed}ms (has_more: ${hasMore})`);

        // Apply status mapping to all campaigns (convert numeric status to human-readable labels)
        const campaignsWithReadableStatus = data.map((campaign: any) => ({
          ...campaign,
          status_label: STATUS_MAP[campaign.status] || `Unknown (${campaign.status})`,
          status_code: campaign.status // Keep original numeric code for reference
        }));

        // Track applied filters
        const filtersApplied: any = {};
        if (args?.search) filtersApplied.search = args.search;
        if (args?.tag_ids) filtersApplied.tag_ids = args.tag_ids;

        // Return single page with clear pagination metadata
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                data: campaignsWithReadableStatus,
                pagination: {
                  returned_count: campaignsWithReadableStatus.length,
                  has_more: hasMore,
                  next_starting_after: nextCursor,
                  limit: queryParams.limit,
                  current_page_note: hasMore
                    ? `Retrieved ${campaignsWithReadableStatus.length} campaigns. More results available. To get next page, call list_campaigns again with starting_after='${nextCursor}'`
                    : `Retrieved all available campaigns (${campaignsWithReadableStatus.length} items).`
                },
                filters_applied: Object.keys(filtersApplied).length > 0 ? filtersApplied : undefined,
                metadata: {
                  request_time_ms: elapsed,
                  success: true,
                  status_mapping_note: 'All campaigns include status_label (human-readable) and status_code (numeric) fields'
                },
                success: true
              }, null, 2)
            }
          ]
        };
      } catch (error: any) {
        console.error('[Instantly MCP] ❌ Error in list_campaigns:', error.message);
        throw error;
      }
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
        // IMPORTANT: API uses 'id'/'ids' parameters, not 'campaign_id'/'campaign_ids'
        
        // Build params object for makeInstantlyRequest
        const params: any = {};
        
        // Handle campaign_id -> id mapping
        if (validatedArgs.campaign_id) {
          params.id = validatedArgs.campaign_id;
        }
        
        // Handle campaign_ids -> ids mapping
        if (validatedArgs.campaign_ids && Array.isArray(validatedArgs.campaign_ids)) {
          params.ids = validatedArgs.campaign_ids.join(','); // API expects comma-separated string
        }
        
        // Add date range parameters
        if (validatedArgs.start_date) params.start_date = validatedArgs.start_date;
        if (validatedArgs.end_date) params.end_date = validatedArgs.end_date;
        
        // Add exclude_total_leads_count parameter
        if (validatedArgs.exclude_total_leads_count !== undefined) {
          params.exclude_total_leads_count = validatedArgs.exclude_total_leads_count;
        }

        console.error(`[Instantly MCP] get_campaign_analytics`);
        console.error(`[Instantly MCP] Endpoint: /campaigns/analytics`);
        console.error(`[Instantly MCP] Original parameters: ${JSON.stringify(validatedArgs, null, 2)}`);
        console.error(`[Instantly MCP] API parameters: ${JSON.stringify(params, null, 2)}`);

        const result = await makeInstantlyRequest('/campaigns/analytics', { params }, apiKey);

        // Add metadata about the parameter mapping for transparency
        const enhancedResult = (validatedArgs?.campaign_id || validatedArgs?.campaign_ids) ? {
          ...result,
          _metadata: {
            filtered_by_campaign: validatedArgs.campaign_id ? `Single: ${validatedArgs.campaign_id}` : `Multiple: ${validatedArgs.campaign_ids?.length} campaigns`,
            endpoint_used: '/campaigns/analytics',
            filtering_method: "server_side",
            parameter_mapping: validatedArgs.campaign_id ? "campaign_id -> id" : "campaign_ids -> ids (comma-separated)",
            exclude_total_leads_count: validatedArgs.exclude_total_leads_count || false,
            note: "Using correct Instantly.ai API endpoint /campaigns/analytics with proper parameter names"
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
      console.error('[Instantly MCP] 📊 Executing get_campaign_analytics_overview...');
      
      // Build params object for makeInstantlyRequest
      const params: any = {};
      if (args?.start_date) params.start_date = args.start_date;
      if (args?.end_date) params.end_date = args.end_date;
      if (args?.campaign_status !== undefined) params.campaign_status = args.campaign_status;

      console.error('[Instantly MCP] Parameters:', JSON.stringify(params, null, 2));
      
      const result = await makeInstantlyRequest('/campaigns/analytics/overview', { params }, apiKey);

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
      console.error('[Instantly MCP] 🚀 Executing create_campaign with automatic account discovery...');

      try {
        // STEP 0: Automatic Account Discovery - Fetch and display eligible accounts
        console.error('[Instantly MCP] 📋 Fetching eligible sender accounts...');

        // Check if validation should be skipped (used throughout this handler)
        const skipValidation = process.env.SKIP_ACCOUNT_VALIDATION === 'true';
        const isTestKey = apiKey?.includes('test') || apiKey?.includes('demo');

        if (!skipValidation && !isTestKey) {
          const accountsResult = await getAllAccounts(apiKey);
          const accounts = accountsResult.data || accountsResult;

          if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
            throw new McpError(
              ErrorCode.InvalidParams,
              '❌ No accounts found in your workspace.\n\n' +
              '📋 Required Action:\n' +
              '1. Go to your Instantly.ai dashboard\n' +
              '2. Navigate to Accounts section\n' +
              '3. Add and verify email accounts\n' +
              '4. Complete warmup process for each account\n' +
              '5. Then retry campaign creation'
            );
          }

          // Filter for eligible accounts (active, setup complete, warmup complete)
          const eligibleAccounts = accounts.filter(account =>
            account.status === 1 &&
            !account.setup_pending &&
            account.warmup_status === 1
          );

          if (eligibleAccounts.length === 0) {
            const accountIssues = accounts.slice(0, 10).map(acc => ({
              email: acc.email,
              issues: [
                ...(acc.status !== 1 ? ['❌ Account not active'] : []),
                ...(acc.setup_pending ? ['⏳ Setup pending'] : []),
                ...(acc.warmup_status !== 1 ? ['🔥 Warmup not complete'] : [])
              ]
            }));

            throw new McpError(
              ErrorCode.InvalidParams,
              `❌ No eligible sender accounts found for campaign creation.\n\n` +
              `📊 Account Status (showing first 10 of ${accounts.length} total):\n${
                accountIssues.map(acc => `• ${acc.email}: ${acc.issues.join(', ')}`).join('\n')
              }\n\n` +
              `✅ Requirements for eligible accounts:\n` +
              `• Account must be active (status = 1)\n` +
              `• Setup must be complete (no pending setup)\n` +
              `• Warmup must be complete (warmup_status = 1)\n\n` +
              `📋 Next Steps:\n` +
              `1. Complete setup for pending accounts\n` +
              `2. Wait for warmup to complete\n` +
              `3. Ensure accounts are active\n` +
              `4. Then retry campaign creation`
            );
          }

          // If email_list is NOT provided, return eligible accounts and ask user to select
          if (!args.email_list || args.email_list.length === 0) {
            const eligibleEmailsList = eligibleAccounts.map(acc => ({
              email: acc.email,
              warmup_score: acc.warmup_score || 0,
              status: 'ready'
            }));

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    stage: 'account_selection_required',
                    message: '📋 Eligible Sender Accounts Found',
                    total_eligible_accounts: eligibleAccounts.length,
                    total_accounts: accounts.length,
                    eligible_accounts: eligibleEmailsList,
                    instructions: [
                      `✅ Found ${eligibleAccounts.length} eligible sender accounts (out of ${accounts.length} total)`,
                      '',
                      '📧 Eligible Sender Accounts:',
                      ...eligibleEmailsList.map(acc => `  • ${acc.email} (warmup score: ${acc.warmup_score})`),
                      '',
                      '❓ How many of these accounts would you like to use as senders for this campaign?',
                      '',
                      '💡 Instantly.ai\'s core value is multi-account sending for better deliverability.',
                      '   Most users use 10-100+ accounts per campaign.',
                      '',
                      '📝 Next Step:',
                      '   Call create_campaign again with the email_list parameter containing the sender emails you want to use.',
                      '',
                      '   Example:',
                      `   email_list: ["${eligibleEmailsList[0]?.email || 'email1@domain.com'}", "${eligibleEmailsList[1]?.email || 'email2@domain.com'}"]`
                    ].join('\n'),
                    required_action: {
                      step: 'select_sender_accounts',
                      description: 'Select which eligible accounts to use as senders',
                      parameter: 'email_list',
                      example: eligibleEmailsList.slice(0, 3).map(acc => acc.email)
                    }
                  }, null, 2)
                }
              ]
            };
          }

          console.error(`[Instantly MCP] ✅ Found ${eligibleAccounts.length} eligible accounts, proceeding with validation...`);
        }

        // Step 1: Clean up and validate parameters for API compatibility
        console.error('[Instantly MCP] 🧹 Cleaning up parameters for API compatibility...');
        const { cleanedArgs, warnings } = cleanupAndValidateParameters(args);

        if (warnings.length > 0) {
          console.error('[Instantly MCP] ⚠️ Parameter cleanup warnings:');
          warnings.forEach(warning => console.error(`  ${warning}`));
        }

        // Step 2: Apply smart defaults and enhancements
        console.error('[Instantly MCP] 🔧 Applying smart defaults...');
        const smartDefaultsResult = await applySmartDefaults(cleanedArgs);
        const enhanced_args = smartDefaultsResult.enhanced_args;

        // Step 3: Validate the enhanced arguments
        console.error('[Instantly MCP] ✅ Validating enhanced campaign data...');

        // WORKAROUND: Add temporary subject/body for complex campaigns to pass validation
        const hasComplexStructure = enhanced_args.campaign_schedule && enhanced_args.sequences;
        const validationArgs = { ...enhanced_args };
        if (hasComplexStructure && !validationArgs.subject && !validationArgs.body) {
          validationArgs.subject = 'temp-subject-for-validation';
          validationArgs.body = 'temp-body-for-validation';
        }

        const validatedData = await validateCampaignData(validationArgs);

        // Step 4: Validate sender email addresses against accounts (skip for test API keys or if disabled)
        // Note: skipValidation and isTestKey are already declared at the top of this handler

        if (!skipValidation && !isTestKey && enhanced_args.email_list && enhanced_args.email_list.length > 0) {
          console.error('[Instantly MCP] 🔍 Validating sender email addresses...');
          await validateEmailListAgainstAccounts(enhanced_args.email_list, apiKey);
        } else {
          console.error('[Instantly MCP] ⏭️ Skipping account validation (test key or disabled)');
        }

        // Step 5: Build the API v2 compliant payload
        console.error('[Instantly MCP] 🏗️ Building API v2 compliant payload...');
        const campaignPayload = buildCampaignPayload(enhanced_args);
        console.error('[Instantly MCP] 📦 Generated payload:', JSON.stringify(campaignPayload, null, 2));

        // Step 6: Make the API request
        console.error('[Instantly MCP] 🌐 Making API request to create campaign...');
        const response = await fetch('https://api.instantly.ai/api/v2/campaigns', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(campaignPayload)
        });

        const responseText = await response.text();
        console.error(`[Instantly MCP] 📡 API Response Status: ${response.status}`);
        console.error(`[Instantly MCP] 📡 API Response Body: ${responseText}`);

        if (!response.ok) {
          throw new McpError(ErrorCode.InternalError,
            `Campaign creation failed (${response.status}): ${responseText}`);
        }

        const result = JSON.parse(responseText);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                campaign: result,
                message: 'Campaign created successfully with API v2 compliant payload',
                payload_used: campaignPayload
              }, null, 2)
            }
          ]
        };

      } catch (error: any) {
        console.error('[Instantly MCP] ❌ create_campaign error:', error);
        throw error;
      }
    }

    case 'update_campaign': {
      if (!args?.campaign_id) {
        throw new McpError(ErrorCode.InvalidParams, 'campaign_id is required');
      }

      // Build update data with all provided parameters (excluding campaign_id from body)
      const updateData: any = {};

      // Basic campaign settings
      if (args.name !== undefined) updateData.name = args.name;
      if (args.pl_value !== undefined) updateData.pl_value = args.pl_value;
      if (args.is_evergreen !== undefined) updateData.is_evergreen = args.is_evergreen;

      // Campaign schedule
      if (args.campaign_schedule !== undefined) updateData.campaign_schedule = args.campaign_schedule;

      // Email sequences
      if (args.sequences !== undefined) updateData.sequences = args.sequences;

      // Email sending settings
      if (args.email_gap !== undefined) updateData.email_gap = args.email_gap;
      if (args.random_wait_max !== undefined) updateData.random_wait_max = args.random_wait_max;
      if (args.text_only !== undefined) updateData.text_only = args.text_only;
      if (args.email_list !== undefined) updateData.email_list = args.email_list;
      if (args.daily_limit !== undefined) updateData.daily_limit = args.daily_limit;
      if (args.stop_on_reply !== undefined) updateData.stop_on_reply = args.stop_on_reply;
      if (args.email_tag_list !== undefined) updateData.email_tag_list = args.email_tag_list;

      // Tracking settings
      if (args.link_tracking !== undefined) updateData.link_tracking = args.link_tracking;
      if (args.open_tracking !== undefined) updateData.open_tracking = args.open_tracking;

      // Advanced settings
      if (args.stop_on_auto_reply !== undefined) updateData.stop_on_auto_reply = args.stop_on_auto_reply;
      if (args.daily_max_leads !== undefined) updateData.daily_max_leads = args.daily_max_leads;
      if (args.prioritize_new_leads !== undefined) updateData.prioritize_new_leads = args.prioritize_new_leads;
      if (args.auto_variant_select !== undefined) updateData.auto_variant_select = args.auto_variant_select;
      if (args.match_lead_esp !== undefined) updateData.match_lead_esp = args.match_lead_esp;
      if (args.stop_for_company !== undefined) updateData.stop_for_company = args.stop_for_company;
      if (args.insert_unsubscribe_header !== undefined) updateData.insert_unsubscribe_header = args.insert_unsubscribe_header;
      if (args.allow_risky_contacts !== undefined) updateData.allow_risky_contacts = args.allow_risky_contacts;
      if (args.disable_bounce_protect !== undefined) updateData.disable_bounce_protect = args.disable_bounce_protect;

      // CC/BCC lists
      if (args.cc_list !== undefined) updateData.cc_list = args.cc_list;
      if (args.bcc_list !== undefined) updateData.bcc_list = args.bcc_list;

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

    case 'update_account': {
      console.error('[Instantly MCP] 🔧 Executing update_account...');

      if (!args?.email) {
        throw new McpError(ErrorCode.InvalidParams, 'email is required');
      }

      // Build account update data with all provided parameters (excluding email from body)
      const updateData: any = {};

      // Add all optional parameters if provided
      if (args.first_name !== undefined) updateData.first_name = args.first_name;
      if (args.last_name !== undefined) updateData.last_name = args.last_name;
      if (args.warmup !== undefined) updateData.warmup = args.warmup;
      if (args.daily_limit !== undefined) updateData.daily_limit = args.daily_limit;
      if (args.tracking_domain_name !== undefined) updateData.tracking_domain_name = args.tracking_domain_name;
      if (args.tracking_domain_status !== undefined) updateData.tracking_domain_status = args.tracking_domain_status;
      if (args.enable_slow_ramp !== undefined) updateData.enable_slow_ramp = args.enable_slow_ramp;
      if (args.inbox_placement_test_limit !== undefined) updateData.inbox_placement_test_limit = args.inbox_placement_test_limit;
      if (args.sending_gap !== undefined) updateData.sending_gap = args.sending_gap;
      if (args.skip_cname_check !== undefined) updateData.skip_cname_check = args.skip_cname_check;
      if (args.remove_tracking_domain !== undefined) updateData.remove_tracking_domain = args.remove_tracking_domain;

      console.error(`[Instantly MCP] 📤 Updating account with data: ${JSON.stringify(updateData, null, 2)}`);

      const result = await makeInstantlyRequest(`/accounts/${encodeURIComponent(args.email)}`, {
        method: 'PATCH',
        body: updateData
      }, apiKey);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              account: result,
              message: 'Account updated successfully'
            }, null, 2),
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
      console.error('[Instantly MCP] 📧 Executing verify_email with complete workflow...');

      // Validate parameters with Zod schema
      const validatedArgs = validateEmailVerificationData(args);
      const email = validatedArgs.email;

      console.error(`[Instantly MCP] 🔍 Initiating verification for: ${email}`);

      // Step 1: Initiate email verification
      const initialResult = await makeInstantlyRequest('/email-verification', {
        method: 'POST',
        body: { email: email }
      }, apiKey);

      console.error(`[Instantly MCP] 📊 Initial verification result: ${JSON.stringify(initialResult, null, 2)}`);

      // Step 2: Check if verification is complete or needs polling
      if (initialResult.verification_status === 'pending' || initialResult.status === 'pending') {
        console.error('[Instantly MCP] ⏳ Verification pending, starting polling process...');

        // Domain-specific timeout handling for known slow-verifying domains
        const emailDomain = email.split('@')[1]?.toLowerCase();
        const slowDomains = ['creatorbuzz.com', 'techrecruiterpro.net', 'topoffunnel.com', 'gmail.com', 'outlook.com', 'yahoo.com', 'lead411.io'];
        const isSlowDomain = slowDomains.includes(emailDomain);

        // EXTREME timeout safety for MCP constraints - addresses intermittent delays
        const baseMaxPollingTime = 5000; // 5 seconds base maximum (extreme safety)
        const slowDomainReduction = 2000; // Reduce by 2 seconds for slow domains
        const maxPollingTime = isSlowDomain ? (baseMaxPollingTime - slowDomainReduction) : baseMaxPollingTime; // 3s for slow domains, 5s for others
        const pollingInterval = 1000; // 1 second between polls (maximum responsiveness)
        const startTime = Date.now();
        let attempts = 0;
        const maxAttempts = Math.floor(maxPollingTime / pollingInterval); // ~3-5 attempts

        console.error(`[Instantly MCP] 🎯 EXTREME SAFETY config: ${emailDomain} (slow: ${isSlowDomain}) - max time: ${maxPollingTime}ms, max attempts: ${maxAttempts}, interval: ${pollingInterval}ms`);

        while (Date.now() - startTime < maxPollingTime && attempts < maxAttempts) {
          attempts++;
          console.error(`[Instantly MCP] 🔄 Polling attempt ${attempts}/${maxAttempts}...`);

          // Wait before polling
          await new Promise(resolve => setTimeout(resolve, pollingInterval));

          try {
            // Step 3: Check verification status
            const statusResult = await makeInstantlyRequest('/email-verification/check-verification-status', {
              params: { email: email }
            }, apiKey);

            console.error(`[Instantly MCP] 📋 Status check result: ${JSON.stringify(statusResult, null, 2)}`);

            // Check if verification is complete
            if (statusResult.verification_status && statusResult.verification_status !== 'pending') {
              console.error(`[Instantly MCP] ✅ Verification complete after ${attempts} attempts`);

              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      success: true,
                      email: email,
                      verification_status: statusResult.verification_status,
                      deliverability: statusResult.deliverability || statusResult.verification_status,
                      catch_all: statusResult.catch_all,
                      credits: statusResult.credits || initialResult.credits,
                      credits_used: statusResult.credits_used || initialResult.credits_used,
                      polling_attempts: attempts,
                      total_time_seconds: Math.round((Date.now() - startTime) / 1000),
                      message: 'Email verification completed successfully'
                    }, null, 2)
                  }
                ]
              };
            }
          } catch (pollError) {
            console.error(`[Instantly MCP] ⚠️ Polling attempt ${attempts} failed:`, pollError);
            // Continue polling unless it's the last attempt
            if (attempts >= maxAttempts) {
              throw pollError;
            }
          }
        }

        // Step 4: Handle timeout scenario with "quick verification" partial results
        console.error('[Instantly MCP] ⏰ Verification polling timed out - providing quick verification results');

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true, // Changed to true - we provide partial results
                email: email,
                verification_status: 'quick_verification_timeout',
                deliverability: 'verification_in_progress',
                catch_all: initialResult.catch_all || 'unknown',
                credits: initialResult.credits,
                credits_used: initialResult.credits_used,
                polling_attempts: attempts,
                total_time_seconds: Math.round((Date.now() - startTime) / 1000),
                max_polling_time_seconds: Math.round(maxPollingTime / 1000),
                polling_interval_seconds: Math.round(pollingInterval / 1000),
                message: `Quick verification completed - full verification still processing after ${Math.round((Date.now() - startTime) / 1000)} seconds`,
                verification_mode: 'quick_verification',
                domain: emailDomain,
                is_slow_domain: isSlowDomain,
                initial_result: initialResult,
                note: `This email domain (${emailDomain}) requires extended verification time. Partial results provided to avoid MCP timeout. Full verification may complete later.`,
                recommendation: isSlowDomain ?
                  `Domain ${emailDomain} is known to require extended verification. Consider using a background verification service for this domain.` :
                  'For domains requiring extended verification, consider using a background verification service.'
              }, null, 2)
            }
          ]
        };
      } else {
        // Step 5: Verification completed immediately
        console.error('[Instantly MCP] ⚡ Verification completed immediately');

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                email: email,
                verification_status: initialResult.verification_status,
                deliverability: initialResult.deliverability || initialResult.verification_status,
                catch_all: initialResult.catch_all,
                credits: initialResult.credits,
                credits_used: initialResult.credits_used,
                polling_attempts: 0,
                total_time_seconds: 0,
                message: 'Email verification completed immediately'
              }, null, 2)
            }
          ]
        };
      }
    }

    case 'list_leads': {
      console.error('[Instantly MCP] 📋 Executing list_leads...');
      console.error(`[Instantly MCP] 🔍 Request args: ${JSON.stringify(args, null, 2)}`);

      const startTime = Date.now();

      // Build request body for POST /leads/list
      const requestBody: any = {};

      // Basic filtering parameters (API parameter names)
      if (args?.campaign) requestBody.campaign = args.campaign;
      if (args?.list_id) requestBody.list_id = args.list_id;
      if (args?.list_ids && args.list_ids.length > 0) requestBody.list_ids = args.list_ids;

      // Search and filtering
      if (args?.search) requestBody.search = args.search;
      if (args?.filter) requestBody.filter = args.filter;

      // ID-based filtering (corrected API parameter names)
      if (args?.included_ids && args.included_ids.length > 0) requestBody.ids = args.included_ids;
      if (args?.excluded_ids && args.excluded_ids.length > 0) requestBody.excluded_ids = args.excluded_ids;
      if (args?.contacts && args.contacts.length > 0) requestBody.contacts = args.contacts;
      if (args?.organization_user_ids && args.organization_user_ids.length > 0) requestBody.organization_user_ids = args.organization_user_ids;
      if (args?.smart_view_id) requestBody.smart_view_id = args.smart_view_id;
      if (args?.is_website_visitor !== undefined) requestBody.is_website_visitor = args.is_website_visitor;
      if (args?.distinct_contacts !== undefined) requestBody.distinct_contacts = args.distinct_contacts;
      if (args?.in_campaign !== undefined) requestBody.in_campaign = args.in_campaign;
      if (args?.in_list !== undefined) requestBody.in_list = args.in_list;
      if (args?.enrichment_status !== undefined) requestBody.enrichment_status = args.enrichment_status;
      if (args?.queries && args.queries.length > 0) requestBody.queries = args.queries;

      // Pagination parameters
      requestBody.limit = args?.limit || 100; // Default to 100 items per page (API maximum)
      if (args?.starting_after) requestBody.starting_after = args.starting_after;

      console.error(`[Instantly MCP] 📤 POST body: ${JSON.stringify(requestBody, null, 2)}`);
      console.error(`[Instantly MCP] 🌐 Making request to: POST /leads/list`);

      try {
        const result = await makeInstantlyRequest('/leads/list', {
          method: 'POST',
          body: requestBody
        }, apiKey);

        const elapsed = Date.now() - startTime;
        console.error(`[Instantly MCP] ✅ Request completed in ${elapsed}ms`);

        // Extract leads from response
        let leads = result.items || result.data || [];
        const filtersApplied: any = {};

        // Apply client-side date filtering if requested
        if (args?.created_after || args?.created_before) {
          const { applyDateFilters } = await import('./pagination.js');
          const originalCount = leads.length;
          leads = applyDateFilters(
            leads,
            args.created_after,
            args.created_before,
            'created_at' // Try created_at first
          );

          if (args.created_after) filtersApplied.created_after = args.created_after;
          if (args.created_before) filtersApplied.created_before = args.created_before;

          console.error(`[Instantly MCP] Date filtering: ${originalCount} → ${leads.length} leads`);
        }

        // Add other filters to metadata
        if (args?.campaign) filtersApplied.campaign = args.campaign;
        if (args?.list_id) filtersApplied.list_id = args.list_id;
        if (args?.search) filtersApplied.search = args.search;
        if (args?.filter) filtersApplied.filter = args.filter;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                items: leads,
                pagination: {
                  returned_count: leads.length,
                  has_more: !!result.next_starting_after,
                  next_starting_after: result.next_starting_after,
                  limit: args?.limit || 50
                },
                filters_applied: Object.keys(filtersApplied).length > 0 ? filtersApplied : undefined,
                metadata: {
                  request_time_ms: elapsed,
                  note: result.next_starting_after
                    ? `Retrieved ${leads.length} leads. More results available. To retrieve additional pages, call this tool again with starting_after parameter set to: ${result.next_starting_after}`
                    : `Retrieved all available leads (${leads.length} items).`,
                  timeout_occurred: false
                },
                success: true
              }, null, 2),
            },
          ],
        };
      } catch (error: any) {
        const elapsed = Date.now() - startTime;
        console.error(`[Instantly MCP] ❌ Request failed after ${elapsed}ms:`, error.message);
        throw error;
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

    case 'count_unread_emails': {
      console.error('[Instantly MCP] 📧 Executing count_unread_emails...');

      const unreadResult = await makeInstantlyRequest('/emails/unread/count', {}, apiKey);

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
    }

    case 'get_account_info': {
      console.error('[Instantly MCP] 👤 Executing get_account_info...');

      if (!args.email) {
        throw new McpError(ErrorCode.InvalidParams, 'Email parameter is required for get_account_info');
      }

      const accountResult = await makeInstantlyRequest(`/accounts/${args.email}`, {}, apiKey);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              account: accountResult,
              message: 'Account information retrieved successfully'
            }, null, 2)
          }
        ]
      };
    }

    case 'list_api_keys': {
      console.error('[Instantly MCP] 🔑 Executing list_api_keys...');

      const apiKeysResult = await makeInstantlyRequest('/api-keys', {}, apiKey);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              api_keys: apiKeysResult,
              message: 'API keys retrieved successfully'
            }, null, 2)
          }
        ]
      };
    }

    case 'get_daily_campaign_analytics': {
      console.error('[Instantly MCP] 📊 Executing get_daily_campaign_analytics...');

      const analyticsParams: any = {};
      if (args.campaign_id) analyticsParams.campaign_id = args.campaign_id;
      if (args.start_date) analyticsParams.start_date = args.start_date;
      if (args.end_date) analyticsParams.end_date = args.end_date;
      if (args.campaign_status !== undefined) analyticsParams.campaign_status = args.campaign_status;

      const analyticsResult = await makeInstantlyRequest('/campaigns/analytics/daily', { params: analyticsParams }, apiKey);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              analytics: analyticsResult,
              message: 'Daily campaign analytics retrieved successfully'
            }, null, 2)
          }
        ]
      };
    }

    case 'pause_campaign': {
      console.error('[Instantly MCP] ⏸️ Executing pause_campaign...');

      if (!args.campaign_id) {
        throw new McpError(ErrorCode.InvalidParams, 'Campaign ID is required for pause_campaign');
      }

      const pauseResult = await makeInstantlyRequest(`/campaigns/${args.campaign_id}/pause`, { method: 'POST' }, apiKey);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              result: pauseResult,
              message: 'Campaign paused successfully'
            }, null, 2)
          }
        ]
      };
    }

    case 'create_lead': {
      console.error('[Instantly MCP] 👤 Executing create_lead...');

      // Build lead data with all supported parameters from Instantly.ai API v2
      const leadData: any = {};

      // Core lead information
      if (args.campaign) leadData.campaign = args.campaign;
      if (args.email) leadData.email = args.email;
      if (args.first_name) leadData.first_name = args.first_name;
      if (args.last_name) leadData.last_name = args.last_name;
      if (args.company_name) leadData.company_name = args.company_name;
      if (args.phone) leadData.phone = args.phone;
      if (args.website) leadData.website = args.website;
      if (args.personalization) leadData.personalization = args.personalization;

      // Advanced parameters
      if (args.lt_interest_status !== undefined) leadData.lt_interest_status = args.lt_interest_status;
      if (args.pl_value_lead) leadData.pl_value_lead = args.pl_value_lead;
      if (args.list_id) leadData.list_id = args.list_id;
      if (args.assigned_to) leadData.assigned_to = args.assigned_to;

      // Skip conditions
      if (args.skip_if_in_workspace !== undefined) leadData.skip_if_in_workspace = args.skip_if_in_workspace;
      if (args.skip_if_in_campaign !== undefined) leadData.skip_if_in_campaign = args.skip_if_in_campaign;
      if (args.skip_if_in_list !== undefined) leadData.skip_if_in_list = args.skip_if_in_list;

      // Verification and blocklist
      if (args.blocklist_id) leadData.blocklist_id = args.blocklist_id;
      if (args.verify_leads_for_lead_finder !== undefined) leadData.verify_leads_for_lead_finder = args.verify_leads_for_lead_finder;
      if (args.verify_leads_on_import !== undefined) leadData.verify_leads_on_import = args.verify_leads_on_import;

      // Custom variables
      if (args.custom_variables) leadData.custom_variables = args.custom_variables;

      console.error(`[Instantly MCP] 📤 Creating lead with data: ${JSON.stringify(leadData, null, 2)}`);

      const createResult = await makeInstantlyRequest('/leads', { method: 'POST', body: leadData }, apiKey);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              lead: createResult,
              message: 'Lead created successfully'
            }, null, 2)
          }
        ]
      };
    }

    case 'update_lead': {
      console.error('[Instantly MCP] ✏️ Executing update_lead...');

      if (!args.lead_id) {
        throw new McpError(ErrorCode.InvalidParams, 'Lead ID is required for update_lead');
      }

      // Build update data with all supported parameters from Instantly.ai API v2
      const updateData: any = {};

      // Core lead information
      if (args.personalization !== undefined) updateData.personalization = args.personalization;
      if (args.website !== undefined) updateData.website = args.website;
      if (args.last_name !== undefined) updateData.last_name = args.last_name;
      if (args.first_name !== undefined) updateData.first_name = args.first_name;
      if (args.company_name !== undefined) updateData.company_name = args.company_name;
      if (args.phone !== undefined) updateData.phone = args.phone;

      // Advanced parameters
      if (args.lt_interest_status !== undefined) updateData.lt_interest_status = args.lt_interest_status;
      if (args.pl_value_lead !== undefined) updateData.pl_value_lead = args.pl_value_lead;
      if (args.assigned_to !== undefined) updateData.assigned_to = args.assigned_to;

      // Custom variables
      if (args.custom_variables !== undefined) updateData.custom_variables = args.custom_variables;

      console.error(`[Instantly MCP] 📤 Updating lead ${args.lead_id} with data: ${JSON.stringify(updateData, null, 2)}`);

      const updateResult = await makeInstantlyRequest(`/leads/${args.lead_id}`, { method: 'PATCH', body: updateData }, apiKey);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              lead: updateResult,
              message: 'Lead updated successfully'
            }, null, 2)
          }
        ]
      };
    }

    case 'create_lead_list': {
      console.error('[Instantly MCP] 📋 Executing create_lead_list...');

      if (!args.name) {
        throw new McpError(ErrorCode.InvalidParams, 'Name is required for create_lead_list');
      }

      // Build list data with official API v2 parameters
      const listData: any = { name: args.name };
      if (args.has_enrichment_task !== undefined) listData.has_enrichment_task = args.has_enrichment_task;
      if (args.owned_by) listData.owned_by = args.owned_by;

      console.error(`[Instantly MCP] 📤 Creating lead list with data: ${JSON.stringify(listData, null, 2)}`);

      const createResult = await makeInstantlyRequest('/lead-lists', { method: 'POST', body: listData }, apiKey);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              lead_list: createResult,
              message: 'Lead list created successfully'
            }, null, 2)
          }
        ]
      };
    }

    case 'list_lead_lists': {
      console.error('[Instantly MCP] 📋 Executing list_lead_lists...');

      // Build query parameters from args
      const queryParams: any = {
        limit: args.limit || 100 // Default to 100 items per page (max pagination)
      };

      if (args.starting_after !== undefined) queryParams.starting_after = args.starting_after;
      if (args.has_enrichment_task !== undefined) queryParams.has_enrichment_task = args.has_enrichment_task;
      if (args.search !== undefined) queryParams.search = args.search;

      console.error(`[Instantly MCP] 📤 Fetching lead lists with params: ${JSON.stringify(queryParams, null, 2)}`);

      const listsResult = await makeInstantlyRequest('/lead-lists', { params: queryParams }, apiKey);

      // Extract items and pagination info
      const items = listsResult.items || listsResult;
      const nextStartingAfter = listsResult.next_starting_after;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              lead_lists: items,
              next_starting_after: nextStartingAfter,
              total_returned: Array.isArray(items) ? items.length : 0,
              has_more: !!nextStartingAfter,
              message: 'Lead lists retrieved successfully'
            }, null, 2)
          }
        ]
      };
    }

    case 'list_emails': {
      console.error('[Instantly MCP] 📧 Executing list_emails...');

      const emailsParams: any = {};
      if (args.campaign_id) emailsParams.campaign_id = args.campaign_id;
      emailsParams.limit = args.limit || 100; // Default to 100 items per page (API maximum)
      if (args.offset) emailsParams.offset = args.offset;

      const emailsResult = await makeInstantlyRequest('/emails', { params: emailsParams }, apiKey);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              emails: emailsResult,
              message: 'Emails retrieved successfully'
            }, null, 2)
          }
        ]
      };
    }

    case 'get_email': {
      console.error('[Instantly MCP] 📧 Executing get_email...');

      if (!args.email_id) {
        throw new McpError(ErrorCode.InvalidParams, 'Email ID is required for get_email');
      }

      const emailResult = await makeInstantlyRequest(`/emails/${args.email_id}`, {}, apiKey);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              email: emailResult,
              message: 'Email retrieved successfully'
            }, null, 2)
          }
        ]
      };
    }

    case 'reply_to_email': {
      console.error('[Instantly MCP] ⚠️ CRITICAL: Executing reply_to_email - WILL SEND REAL EMAIL!');

      // Strict validation of required parameters
      if (!args.reply_to_uuid) {
        throw new McpError(ErrorCode.InvalidParams, 'reply_to_uuid is required - the ID of the email to reply to');
      }
      if (!args.eaccount) {
        throw new McpError(ErrorCode.InvalidParams, 'eaccount is required - the email account that will send the reply');
      }
      if (!args.subject) {
        throw new McpError(ErrorCode.InvalidParams, 'subject is required - the subject line of the reply');
      }
      if (!args.body) {
        throw new McpError(ErrorCode.InvalidParams, 'body is required - the content of the reply email');
      }

      // Build the reply data according to API v2 specification
      const replyData = {
        reply_to_uuid: args.reply_to_uuid,
        eaccount: args.eaccount,
        subject: args.subject,
        body: args.body
      };

      console.error(`[Instantly MCP] ⚠️ SENDING EMAIL REPLY with data: ${JSON.stringify(replyData, null, 2)}`);
      console.error(`[Instantly MCP] ⚠️ This will send a real email to real people!`);
      console.error(`[Instantly MCP] 🔧 Using endpoint: /emails/reply`);

      const replyResult = await makeInstantlyRequest('/emails/reply', {
        method: 'POST',
        body: replyData
      }, apiKey);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              reply: replyResult,
              message: '⚠️ Email reply sent successfully - REAL EMAIL WAS SENT!',
              warning: 'This tool sent an actual email reply to real recipients'
            }, null, 2)
          }
        ]
      };
    }

    // pause_account and resume_account are handled in the duplicate implementations section below

    case 'check_feature_availability': {
      console.error('[Instantly MCP] 🔍 Executing check_feature_availability...');

      // This tool checks current plan features - no specific endpoint, return plan info
      const accountResult = await makeInstantlyRequest('/accounts', {}, apiKey);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Feature availability check - this tool provides account information to determine available features',
              note: 'Feature availability depends on your Instantly.ai plan. Check account details for plan information.',
              account_count: Array.isArray(accountResult) ? accountResult.length : 'N/A'
            }, null, 2)
          }
        ]
      };
    }

    case 'get_account_details': {
      console.error('[Instantly MCP] 👤 Executing get_account_details...');

      if (!args.email) {
        throw new McpError(ErrorCode.InvalidParams, 'Email parameter is required for get_account_details');
      }

      // This is essentially the same as get_account_info - might be a duplicate
      const accountResult = await makeInstantlyRequest(`/accounts/${args.email}`, {}, apiKey);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              account_details: accountResult,
              message: 'Account details retrieved successfully',
              note: 'This tool provides the same information as get_account_info'
            }, null, 2)
          }
        ]
      };
    }



    case 'pause_account': {
      console.error('[Instantly MCP] ⏸️ Executing pause_account...');

      if (!args.email) {
        throw new McpError(ErrorCode.InvalidParams, 'Email is required for pause_account');
      }

      console.error(`[Instantly MCP] 🔧 Using endpoint: /accounts/${args.email}/pause`);
      const pauseAccountResult = await makeInstantlyRequest(`/accounts/${args.email}/pause`, { method: 'POST' }, apiKey);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              account: pauseAccountResult,
              message: `Account ${args.email} paused successfully`
            }, null, 2)
          }
        ]
      };
    }

    case 'resume_account': {
      console.error('[Instantly MCP] ▶️ Executing resume_account...');

      if (!args.email) {
        throw new McpError(ErrorCode.InvalidParams, 'Email is required for resume_account');
      }

      console.error(`[Instantly MCP] 🔧 Using endpoint: /accounts/${args.email}/resume`);
      const resumeAccountResult = await makeInstantlyRequest(`/accounts/${args.email}/resume`, { method: 'POST' }, apiKey);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              account: resumeAccountResult,
              message: `Account ${args.email} resumed successfully`
            }, null, 2)
          }
        ]
      };
    }

    case 'create_account': {
      console.error('[Instantly MCP] ➕ Executing create_account...');

      // Validate all required parameters according to official API
      const requiredParams = ['email', 'first_name', 'last_name', 'provider_code', 'imap_username', 'imap_password', 'imap_host', 'imap_port', 'smtp_username', 'smtp_password', 'smtp_host', 'smtp_port'];
      const missingParams = requiredParams.filter(param => !args[param]);

      if (missingParams.length > 0) {
        throw new McpError(ErrorCode.InvalidParams, `Missing required parameters for create_account: ${missingParams.join(', ')}`);
      }

      console.error(`[Instantly MCP] 🔧 Using endpoint: /accounts`);
      const createAccountResult = await makeInstantlyRequest('/accounts', {
        method: 'POST',
        body: {
          email: args.email,
          first_name: args.first_name,
          last_name: args.last_name,
          provider_code: args.provider_code,
          imap_username: args.imap_username,
          imap_password: args.imap_password,
          imap_host: args.imap_host,
          imap_port: args.imap_port,
          smtp_username: args.smtp_username,
          smtp_password: args.smtp_password,
          smtp_host: args.smtp_host,
          smtp_port: args.smtp_port
        }
      }, apiKey);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              account: createAccountResult,
              message: `Account ${args.email} created successfully`
            }, null, 2)
          }
        ]
      };
    }

    case 'delete_account': {
      console.error('[Instantly MCP] 🚨 EXECUTING EXTREMELY DESTRUCTIVE OPERATION: delete_account...');
      console.error('[Instantly MCP] ⚠️ CRITICAL WARNING: This will PERMANENTLY DELETE the email account!');
      console.error('[Instantly MCP] ⚠️ CRITICAL WARNING: All campaign data, emails, and settings will be LOST FOREVER!');
      console.error('[Instantly MCP] ⚠️ CRITICAL WARNING: This action CANNOT be undone or reversed!');
      console.error('[Instantly MCP] 🚨 PROCEED WITH EXTREME CAUTION!');

      if (!args.email) {
        throw new McpError(ErrorCode.InvalidParams, 'Email is required for delete_account');
      }

      console.error(`[Instantly MCP] 🔧 Using endpoint: /accounts/${encodeURIComponent(args.email)}`);
      console.error(`[Instantly MCP] 🚨 FINAL WARNING: About to permanently delete account: ${args.email}`);

      const deleteAccountResult = await makeInstantlyRequest(`/accounts/${encodeURIComponent(args.email)}`, { method: 'DELETE' }, apiKey);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              result: deleteAccountResult,
              message: `🚨 ACCOUNT ${args.email} HAS BEEN PERMANENTLY DELETED`,
              critical_warning: 'THIS ACTION CANNOT BE UNDONE - ALL DATA IS LOST FOREVER',
              deleted_account: args.email,
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      };
    }

    case 'enable_warmup': {
      console.error('[Instantly MCP] 🔥 Executing enable_warmup...');

      if (!args.email) {
        throw new McpError(ErrorCode.InvalidParams, 'Email is required for enable_warmup');
      }

      console.error(`[Instantly MCP] 🔧 Using endpoint: /accounts/warmup/enable`);
      const enableWarmupResult = await makeInstantlyRequest('/accounts/warmup/enable', {
        method: 'POST',
        body: { emails: [args.email] }
      }, apiKey);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              result: enableWarmupResult,
              message: `Warmup enabled for account ${args.email}`
            }, null, 2)
          }
        ]
      };
    }

    case 'disable_warmup': {
      console.error('[Instantly MCP] ❄️ Executing disable_warmup...');

      if (!args.email) {
        throw new McpError(ErrorCode.InvalidParams, 'Email is required for disable_warmup');
      }

      console.error(`[Instantly MCP] 🔧 Using endpoint: /accounts/warmup/disable`);
      const disableWarmupResult = await makeInstantlyRequest('/accounts/warmup/disable', {
        method: 'POST',
        body: { emails: [args.email] }
      }, apiKey);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              result: disableWarmupResult,
              message: `Warmup disabled for account ${args.email}`
            }, null, 2)
          }
        ]
      };
    }

    case 'test_account_vitals': {
      console.error('[Instantly MCP] 🩺 Executing test_account_vitals...');

      if (!args.email) {
        throw new McpError(ErrorCode.InvalidParams, 'Email is required for test_account_vitals');
      }

      console.error(`[Instantly MCP] 🔧 Using endpoint: /accounts/test/vitals`);
      const testVitalsResult = await makeInstantlyRequest('/accounts/test/vitals', {
        method: 'POST',
        body: { accounts: [args.email] }
      }, apiKey);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              vitals: testVitalsResult,
              message: `Account vitals tested for ${args.email}`,
              note: 'This diagnostic tool helps identify account connectivity and health issues'
            }, null, 2)
          }
        ]
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
  console.error(`[Instantly MCP] 🔍 Debug - Extra parameter:`, JSON.stringify(extra, null, 2));

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
    console.error(`[Instantly MCP] 🔍 Debug - extraObj structure:`, Object.keys(extraObj));

    // Try requestInfo.headers first (SDK standard)
    if (extraObj.requestInfo && extraObj.requestInfo.headers) {
      console.error(`[Instantly MCP] 🔍 Debug - requestInfo.headers keys:`, Object.keys(extraObj.requestInfo.headers));
      if (extraObj.requestInfo.headers['x-instantly-api-key']) {
        apiKey = extraObj.requestInfo.headers['x-instantly-api-key'];
        console.error(`[Instantly MCP] 🔑 API key extracted from requestInfo.headers`);
      }
    }

    // Fallback to direct headers property
    if (!apiKey && extraObj.headers && extraObj.headers['x-instantly-api-key']) {
      apiKey = extraObj.headers['x-instantly-api-key'];
      console.error(`[Instantly MCP] 🔑 API key extracted from direct headers`);
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

      // Handle different MCP methods directly via Express.js

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
              icons: loadInstantlyIcons(), // Add Instantly.ai logo for visual branding
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
            const hasComplexStructure = args?.campaign_schedule && args?.sequences;
            const hasSimpleParams = args?.subject && args?.body;
            const hasMinimalInfo = !args?.name || !args?.email_list || (!hasSimpleParams && !hasComplexStructure);

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

            // Step 2: CRITICAL - Clean up and validate parameters for API compatibility
            console.error('[Instantly MCP] 🧹 CRITICAL: Cleaning up parameters for API v2 compatibility...');
            const { cleanedArgs, warnings } = cleanupAndValidateParameters(args);

            if (warnings.length > 0) {
              console.error('[Instantly MCP] ⚠️ Parameter cleanup warnings:');
              warnings.forEach(warning => console.error(`  ${warning}`));
            }

            // Step 3: Apply smart defaults and enhancements
            console.error('[Instantly MCP] 🎯 Applying smart defaults and enhancements...');
            const smartDefaultsResult = await applySmartDefaults(cleanedArgs);
            const enhanced_args = smartDefaultsResult.enhanced_args;
            // Step 4: Validate the enhanced arguments
            console.error('[Instantly MCP] ✅ Validating enhanced campaign data...');

            // WORKAROUND: Add temporary subject/body for complex campaigns to pass validation
            const isComplexCampaign = enhanced_args.campaign_schedule && enhanced_args.sequences;
            const validationArgs = { ...enhanced_args };
            if (isComplexCampaign && !validationArgs.subject && !validationArgs.body) {
              validationArgs.subject = 'temp-subject-for-validation';
              validationArgs.body = 'temp-body-for-validation';
            }

            const validatedData = await validateCampaignData(validationArgs);

            // Step 5: Validate sender email addresses against accounts (skip for test API keys or if disabled)
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

            // Step 6: Build campaign payload with proper HTML formatting
            console.error('[Instantly MCP] 🔧 Building campaign payload with HTML formatting...');
            const campaignPayload = buildCampaignPayload(enhanced_args);

            // DEBUG: Log the exact payload being sent to Instantly.ai API
            console.error('[Instantly MCP] 🔍 DEBUG: Exact payload being sent to Instantly.ai API:');
            console.error(JSON.stringify(campaignPayload, null, 2));

            // Step 7: Create the campaign
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
      const hasComplexStructure = args?.campaign_schedule && args?.sequences;
      const hasSimpleParams = args?.subject && args?.body;
      const hasMinimalInfo = !args?.name || !args?.email_list || (!hasSimpleParams && !hasComplexStructure);

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

      // Step 2: CRITICAL - Clean up and validate parameters for API compatibility
      console.error('[Instantly MCP] 🧹 CRITICAL: Cleaning up parameters for API v2 compatibility...');
      const { cleanedArgs, warnings } = cleanupAndValidateParameters(args);

      if (warnings.length > 0) {
        console.error('[Instantly MCP] ⚠️ Parameter cleanup warnings:');
        warnings.forEach(warning => console.error(`  ${warning}`));
      }

      // Step 3: Apply smart defaults and enhancements
      console.error('[Instantly MCP] 🎯 Applying smart defaults and enhancements...');
      const smartDefaultsResult = await applySmartDefaults(cleanedArgs);
      const enhanced_args = smartDefaultsResult.enhanced_args;

      // Step 4: Validate the enhanced arguments
      console.error('[Instantly MCP] ✅ Validating enhanced campaign data...');

      // WORKAROUND: Add temporary subject/body for complex campaigns to pass validation
      const isComplexCampaignStructure = enhanced_args.campaign_schedule && enhanced_args.sequences;
      const validationArgs = { ...enhanced_args };
      if (isComplexCampaignStructure && !validationArgs.subject && !validationArgs.body) {
        validationArgs.subject = 'temp-subject-for-validation';
        validationArgs.body = 'temp-body-for-validation';
      }

      const validatedData = await validateCampaignData(validationArgs);

      // Step 5: Validate sender email addresses against accounts (skip for test API keys or if disabled)
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

      // Step 6: Build campaign payload with proper HTML formatting
      console.error('[Instantly MCP] 🔧 Building campaign payload with HTML formatting...');
      const campaignPayload = buildCampaignPayload(enhanced_args);

      // DEBUG: Log the exact payload being sent to Instantly.ai API
      console.error('[Instantly MCP] 🔍 DEBUG: Exact payload being sent to Instantly.ai API:');
      console.error(JSON.stringify(campaignPayload, null, 2));

      // Step 7: Create the campaign
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

    case 'list_accounts': {
      // Sequential pagination - fetch ONE page at a time
      const result = await getAllAccounts(args.apiKey, args);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              data: result.data,
              pagination: result.pagination,
              metadata: result.metadata,
              success: true
            }, null, 2)
          }
        ]
      };
    }

    // ===== NEW TIER 1 TOOLS - PRODUCTION VERIFIED =====
    case 'count_unread_emails': {
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
    }

    case 'get_daily_campaign_analytics': {
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
    }

    case 'get_account_info': {
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
    }



    // Duplicate implementations removed - using the main implementations above



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
    console.error(`[Instantly MCP] 🌐 Starting ${transportMode} transport mode with StreamableHTTPServerTransport...`);

    // Use the proper StreamingHttpTransport that implements MCP protocol
    const { StreamingHttpTransport } = await import('./streaming-http-transport.js');
    
    const config = {
      port: parseInt(process.env.PORT || '3000'),
      host: process.env.HOST || '0.0.0.0',
      cors: {
        origin: '*',
        credentials: true
      },
      auth: {
        apiKeyHeader: 'x-instantly-api-key'
      }
    };
    
    const transport = new StreamingHttpTransport(server, config);
    
    // Start the HTTP server (includes server.connect internally)
    await transport.start();
    
    console.error('[Instantly MCP] ✅ StreamableHTTPServerTransport started successfully');
    console.error('[Instantly MCP] 📡 Server properly implements MCP streaming protocol for Claude Desktop');
    
    if (process.env.NODE_ENV === 'production') {
      console.error('[Instantly MCP] 🏢 Production endpoints:');
      console.error('[Instantly MCP] 🔗 URL auth: https://instantly-mcp-5p4as.ondigitalocean.app/mcp/{API_KEY}');
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
