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
import { buildInstantlyPaginationQuery, buildQueryParams, parsePaginatedResponse } from './pagination.js';

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
    version: '2.2.1',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Helper function to validate email addresses
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Helper function to validate campaign creation data
const validateCampaignData = (args: any): void => {
  // Validate email_list contains valid email addresses
  if (args.email_list && Array.isArray(args.email_list)) {
    for (const email of args.email_list) {
      if (!isValidEmail(email)) {
        throw new McpError(ErrorCode.InvalidParams, `Invalid email address in email_list: ${email}`);
      }
    }
  }

  // Validate timezone if provided
  const validTimezones = [
    "Etc/GMT+12", "Etc/GMT+11", "Etc/GMT+10", "America/Anchorage", "America/Dawson",
    "America/Creston", "America/Chihuahua", "America/Boise", "America/Belize",
    "America/Chicago", "America/New_York", "America/Denver", "America/Los_Angeles",
    "Europe/London", "Europe/Paris", "Asia/Tokyo", "Asia/Singapore", "Australia/Sydney"
  ];

  if (args.timezone && !validTimezones.includes(args.timezone)) {
    throw new McpError(ErrorCode.InvalidParams, `Invalid timezone: ${args.timezone}. Must be one of: ${validTimezones.join(', ')}`);
  }

  // Validate timing format
  const timeRegex = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;
  if (args.timing_from && !timeRegex.test(args.timing_from)) {
    throw new McpError(ErrorCode.InvalidParams, `Invalid timing_from format: ${args.timing_from}. Must be HH:MM format (e.g., 09:00)`);
  }
  if (args.timing_to && !timeRegex.test(args.timing_to)) {
    throw new McpError(ErrorCode.InvalidParams, `Invalid timing_to format: ${args.timing_to}. Must be HH:MM format (e.g., 17:00)`);
  }
};

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
  console.error(`[Instantly MCP] Request: ${method} ${url}`);
  console.error(`[Instantly MCP] API Key: ${INSTANTLY_API_KEY?.substring(0, 10)}...${INSTANTLY_API_KEY?.substring(INSTANTLY_API_KEY.length - 4)}`);

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${INSTANTLY_API_KEY}`,
      'Content-Type': 'application/json',
    },
  };

  if (data && method !== 'GET') {
    options.body = JSON.stringify(data);
    console.error(`[Instantly MCP] Request body: ${JSON.stringify(data, null, 2)}`);
  }

  try {
    let response = await fetch(url, options);
    console.error(`[Instantly MCP] Response status: ${response.status} ${response.statusText}`);

    // For 400 errors, log the response body for debugging
    if (response.status === 400) {
      const responseText = await response.text();
      console.error(`[Instantly MCP] 400 Response body: ${responseText}`);

      // Try to parse the error message
      try {
        const errorData = JSON.parse(responseText);
        console.error(`[Instantly MCP] Parsed error:`, JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.error(`[Instantly MCP] Could not parse error response as JSON`);
      }

      // Re-create response with the text we already read
      response = new Response(responseText, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    }

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
    console.error(`[Instantly MCP] Error:`, error);
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
          limit: { type: 'number', description: 'Number of campaigns to return (1-100, default: 20)' },
          starting_after: { type: 'string', description: 'ID of the last item from previous page for pagination' },
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
      description: 'Create a new email campaign with complete configuration',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Campaign name (required)' },
          subject: { type: 'string', description: 'Email subject line (required)' },
          body: { type: 'string', description: 'Email body content (required)' },
          email_list: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of verified sending account email addresses (required) - these must be accounts you have added and verified in Instantly'
          },

          // Schedule configuration
          schedule_name: { type: 'string', description: 'Schedule name (optional, default: "Default Schedule")' },
          timing_from: { type: 'string', description: 'Start time in HH:MM format (optional, default: "09:00")' },
          timing_to: { type: 'string', description: 'End time in HH:MM format (optional, default: "17:00")' },
          timezone: {
            type: 'string',
            description: 'Timezone for campaign schedule (optional, default: "America/New_York")',
            enum: ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Tokyo", "Asia/Singapore", "Australia/Sydney", "Etc/GMT+12"]
          },
          days: {
            type: 'object',
            description: 'Days to send emails (optional, default: Monday-Friday only)',
            properties: {
              monday: { type: 'boolean', description: 'Send on Monday (default: true)' },
              tuesday: { type: 'boolean', description: 'Send on Tuesday (default: true)' },
              wednesday: { type: 'boolean', description: 'Send on Wednesday (default: true)' },
              thursday: { type: 'boolean', description: 'Send on Thursday (default: true)' },
              friday: { type: 'boolean', description: 'Send on Friday (default: true)' },
              saturday: { type: 'boolean', description: 'Send on Saturday (default: false)' },
              sunday: { type: 'boolean', description: 'Send on Sunday (default: false)' }
            }
          },

          // Sequence configuration
          sequence_steps: {
            type: 'number',
            description: 'Number of follow-up steps in the sequence (optional, default: 1 for just the initial email)',
            minimum: 1,
            maximum: 10
          },
          step_delay_days: {
            type: 'number',
            description: 'Days to wait between sequence steps (optional, default: 3 days)',
            minimum: 1,
            maximum: 30
          },

          // Email configuration
          text_only: { type: 'boolean', description: 'Send as text-only emails (optional, default: false for HTML)' },
          daily_limit: {
            type: 'number',
            description: 'Maximum emails to send per day (optional, default: 50)',
            minimum: 1,
            maximum: 1000
          },
          email_gap_minutes: {
            type: 'number',
            description: 'Minutes to wait between individual emails (optional, default: 10)',
            minimum: 1,
            maximum: 1440
          },

          // Tracking and behavior
          link_tracking: { type: 'boolean', description: 'Track link clicks (optional, default: false)' },
          open_tracking: { type: 'boolean', description: 'Track email opens (optional, default: false)' },
          stop_on_reply: { type: 'boolean', description: 'Stop campaign when lead replies (optional, default: true)' },
          stop_on_auto_reply: { type: 'boolean', description: 'Stop on auto-reply detection (optional, default: true)' }
        },
        required: ['name', 'subject', 'body', 'email_list'],
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
          limit: { type: 'number', description: 'Number of accounts to return (1-100, default: 20)' },
          starting_after: { type: 'string', description: 'ID of the last item from previous page for pagination' },
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
          smtp_host: { type: 'string', description: 'SMTP host (e.g., smtp.gmail.com)' },
          smtp_port: { type: 'number', description: 'SMTP port (e.g., 587)' },
          imap_host: { type: 'string', description: 'IMAP host (optional)' },
          imap_port: { type: 'number', description: 'IMAP port (optional)' },
          provider: { type: 'string', description: 'Email provider (optional)' },
          warmup_enabled: { type: 'boolean', description: 'Enable warmup (optional, default: true)' },
          max_daily_limit: { type: 'number', description: 'Max daily sending limit (optional, default: 30)' },
          warmup_limit: { type: 'number', description: 'Warmup daily limit (optional, default: 20)' },
          warmup_reply_rate: { type: 'number', description: 'Warmup reply rate percentage (optional, default: 50)' },
        },
        required: ['email', 'username', 'password', 'smtp_host', 'smtp_port'],
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
          limit: { type: 'number', description: 'Number of leads to return (1-100, default: 20)' },
          starting_after: { type: 'string', description: 'ID of the last item from previous page for pagination' },
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
          firstName: { type: 'string', description: 'First name' },
          lastName: { type: 'string', description: 'Last name' },
          companyName: { type: 'string', description: 'Company name' },
          website: { type: 'string', description: 'Company website' },
          personalization: { type: 'string', description: 'Personalization field' },
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
          limit: { type: 'number', description: 'Number of lists to return (1-100, default: 20)' },
          starting_after: { type: 'string', description: 'ID of the last item from previous page for pagination' },
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
          limit: { type: 'number', description: 'Number of emails to return (1-100, default: 20)' },
          starting_after: { type: 'string', description: 'ID of the last item from previous page for pagination' },
        },
      },
    },
    {
      name: 'get_email',
      description: 'Get a specific email by ID',
      inputSchema: {
        type: 'object',
        properties: {
          email_id: { type: 'string', description: 'Email ID/UUID' },
        },
        required: ['email_id'],
      },
    },
    {
      name: 'reply_to_email',
      description: 'Reply to an existing email',
      inputSchema: {
        type: 'object',
        properties: {
          email_id: { type: 'string', description: 'Email ID to reply to' },
          body: { type: 'string', description: 'Reply body content' },
        },
        required: ['email_id', 'body'],
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
      // Campaign Creation Wizard - Guided workflow
      case 'campaign_creation_wizard': {
        const step = args?.step || 'start';

        switch (step) {
          case 'start': {
            // Step 1: Check verified sending accounts
            console.error('[Campaign Wizard] Step 1: Checking verified accounts...');

            try {
              const accountsResult = await makeInstantlyRequest('/accounts');
              const accounts = accountsResult.items || accountsResult;

              if (!accounts || accounts.length === 0) {
                return {
                  content: [{
                    type: 'text',
                    text: JSON.stringify({
                      step: 'error',
                      message: 'No verified sending accounts found. You need to add and verify at least one sending account in your Instantly dashboard before creating campaigns.',
                      action_required: 'Go to https://app.instantly.ai/app/accounts to add a sending account',
                      next_step: 'After adding accounts, run this wizard again'
                    }, null, 2)
                  }]
                };
              }

              const verifiedAccounts = accounts.filter((account: any) =>
                account.status === 'active' || account.status === 'verified' || !account.status
              );

              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    step: 'accounts_checked',
                    message: 'Found verified sending accounts. Please select one and provide campaign details.',
                    verified_accounts: verifiedAccounts.map((account: any, index: number) => ({
                      index: index + 1,
                      email: account.email,
                      status: account.status || 'active',
                      daily_limit: account.daily_limit || 'Not set'
                    })),
                    next_step: 'Call campaign_creation_wizard with step="info_gathered" and provide: name, subject, body, selected_email (from the list above)',
                    example: {
                      step: 'info_gathered',
                      name: 'My Campaign Name',
                      subject: 'Email Subject Line',
                      body: 'Email body content...',
                      selected_email: verifiedAccounts[0]?.email || 'your-verified-email@domain.com'
                    }
                  }, null, 2)
                }]
              };
            } catch (error: any) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    step: 'error',
                    message: 'Failed to check verified accounts',
                    error: error.message,
                    action_required: 'Check your API key and network connection'
                  }, null, 2)
                }]
              };
            }
          }

          case 'info_gathered': {
            // Step 2: Validate required information and show configuration options
            console.error('[Campaign Wizard] Step 2: Validating campaign information...');

            const requiredFields = ['name', 'subject', 'body', 'selected_email'];
            const missingFields = requiredFields.filter(field => !args?.[field]);

            if (missingFields.length > 0) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    step: 'error',
                    message: 'Missing required campaign information',
                    missing_fields: missingFields,
                    action_required: 'Please provide all required fields',
                    example: {
                      step: 'info_gathered',
                      name: 'My Campaign Name',
                      subject: 'Email Subject Line',
                      body: 'Email body content...',
                      selected_email: 'your-verified-email@domain.com'
                    }
                  }, null, 2)
                }]
              };
            }

            // Validate email format
            if (!isValidEmail(args!.selected_email as string)) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    step: 'error',
                    message: 'Invalid email format for selected_email',
                    provided_email: args!.selected_email,
                    action_required: 'Please provide a valid email address'
                  }, null, 2)
                }]
              };
            }

            // Show configuration summary with defaults
            const config = {
              // Required fields
              name: args!.name,
              subject: args!.subject,
              body: args!.body,
              selected_email: args!.selected_email,

              // Optional fields with defaults
              timezone: args?.timezone || 'America/New_York',
              timing_from: args?.timing_from || '09:00',
              timing_to: args?.timing_to || '17:00',
              daily_limit: args?.daily_limit || 50,
              email_gap_minutes: args?.email_gap_minutes || 10,
              open_tracking: args?.open_tracking !== false,
              link_tracking: args?.link_tracking !== false,
              stop_on_reply: args?.stop_on_reply !== false,
              text_only: args?.text_only === true,
              send_weekdays: args?.send_weekdays !== false,
              send_weekends: args?.send_weekends === true
            };

            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  step: 'validated',
                  message: 'Campaign information validated successfully. Review the configuration below.',
                  campaign_config: config,
                  next_step: 'If everything looks correct, call campaign_creation_wizard with step="create" and the same parameters to create the campaign',
                  modify_step: 'To modify any settings, call again with step="info_gathered" and updated parameters'
                }, null, 2)
              }]
            };
          }

          case 'create': {
            // Step 3: Create the campaign with validated information
            console.error('[Campaign Wizard] Step 3: Creating campaign...');

            // Validate required fields again
            const requiredFields = ['name', 'subject', 'body', 'selected_email'];
            const missingFields = requiredFields.filter(field => !args?.[field]);

            if (missingFields.length > 0) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    step: 'error',
                    message: 'Missing required fields for campaign creation',
                    missing_fields: missingFields,
                    action_required: 'Go back to step="info_gathered" and provide all required information'
                  }, null, 2)
                }]
              };
            }

            // Prepare campaign data for create_campaign
            const campaignData = {
              name: args!.name,
              subject: args!.subject,
              body: args!.body,
              email_list: [args!.selected_email],

              // Optional configuration with defaults
              timezone: args?.timezone || 'America/New_York',
              timing_from: args?.timing_from || '09:00',
              timing_to: args?.timing_to || '17:00',
              daily_limit: args?.daily_limit || 50,
              email_gap_minutes: args?.email_gap_minutes || 10,
              open_tracking: args?.open_tracking !== false,
              link_tracking: args?.link_tracking !== false,
              stop_on_reply: args?.stop_on_reply !== false,
              text_only: args?.text_only === true,

              // Days configuration
              days: {
                monday: args?.send_weekdays !== false,
                tuesday: args?.send_weekdays !== false,
                wednesday: args?.send_weekdays !== false,
                thursday: args?.send_weekdays !== false,
                friday: args?.send_weekdays !== false,
                saturday: args?.send_weekends === true,
                sunday: args?.send_weekends === true
              }
            };

            console.error('[Campaign Wizard] Creating campaign with data:', JSON.stringify(campaignData, null, 2));

            // Call the internal create_campaign logic
            try {
              // Validate campaign data
              validateCampaignData(campaignData);

              // Get timezone and days configuration
              const timezone = campaignData.timezone;
              const days = campaignData.days;

              // Convert days to API format
              const daysConfig = {
                '0': days.sunday,     // Sunday = 0
                '1': days.monday,     // Monday = 1
                '2': days.tuesday,    // Tuesday = 2
                '3': days.wednesday,  // Wednesday = 3
                '4': days.thursday,   // Thursday = 4
                '5': days.friday,     // Friday = 5
                '6': days.saturday    // Saturday = 6
              };

              // Build campaign data for API
              const apiCampaignData: any = {
                name: campaignData.name,
                campaign_schedule: {
                  schedules: [{
                    name: 'Default Schedule',
                    timing: {
                      from: campaignData.timing_from,
                      to: campaignData.timing_to
                    },
                    days: daysConfig,
                    timezone: timezone
                  }]
                },
                sequences: [{
                  steps: [{
                    subject: campaignData.subject,
                    body: campaignData.body
                  }]
                }],
                email_list: campaignData.email_list,
                daily_limit: campaignData.daily_limit,
                email_gap: campaignData.email_gap_minutes,
                text_only: campaignData.text_only,
                link_tracking: campaignData.link_tracking,
                open_tracking: campaignData.open_tracking,
                stop_on_reply: campaignData.stop_on_reply,
                stop_on_auto_reply: true,
                pl_value: 100,
                is_evergreen: false,
                random_wait_max: 10,
                daily_max_leads: campaignData.daily_limit,
                prioritize_new_leads: false,
                match_lead_esp: false,
                stop_for_company: false,
                insert_unsubscribe_header: true,
                allow_risky_contacts: false,
                disable_bounce_protect: false
              };

              const result = await makeInstantlyRequest('/campaigns', 'POST', apiCampaignData);

              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    step: 'completed',
                    message: 'Campaign created successfully!',
                    campaign: result,
                    summary: {
                      name: campaignData.name,
                      sending_from: campaignData.email_list[0],
                      daily_limit: campaignData.daily_limit,
                      schedule: `${campaignData.timing_from}-${campaignData.timing_to} ${timezone}`,
                      tracking: {
                        opens: campaignData.open_tracking,
                        links: campaignData.link_tracking
                      }
                    }
                  }, null, 2)
                }]
              };
            } catch (error: any) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    step: 'error',
                    message: 'Failed to create campaign',
                    error: error.message,
                    campaign_data: campaignData,
                    troubleshooting: {
                      check_email: 'Ensure the selected email is verified in your Instantly account',
                      check_api_key: 'Verify your API key has campaign creation permissions',
                      check_limits: 'Check if you have reached your campaign limits'
                    }
                  }, null, 2)
                }]
              };
            }
          }

          default: {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  step: 'error',
                  message: 'Invalid step provided',
                  valid_steps: ['start', 'info_gathered', 'create'],
                  action_required: 'Use step="start" to begin the campaign creation wizard'
                }, null, 2)
              }]
            };
          }
        }
      }

      // Campaign endpoints
      case 'list_campaigns': {
        const queryParams = buildQueryParams(args, ['search', 'status']);

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
        const requiredFields = ['name', 'subject', 'body'];
        for (const field of requiredFields) {
          if (!args?.[field]) {
            throw new McpError(ErrorCode.InvalidParams, `${field} is required`);
          }
        }

        // Validate that email_list is provided and contains verified sending accounts
        if (!args?.email_list || !Array.isArray(args.email_list) || args.email_list.length === 0) {
          throw new McpError(ErrorCode.InvalidParams, 'email_list is required and must contain at least one verified sending account email address');
        }

        // Validate campaign data
        validateCampaignData(args);

        // Get timezone from args with default
        const timezone = args?.timezone || 'America/New_York';

        // Get days from args with defaults (weekdays only by default)
        const userDays = (args?.days as any) || {};
        const days = {
          monday: userDays.monday !== false,  // Default true
          tuesday: userDays.tuesday !== false,  // Default true
          wednesday: userDays.wednesday !== false,  // Default true
          thursday: userDays.thursday !== false,  // Default true
          friday: userDays.friday !== false,  // Default true
          saturday: userDays.saturday === true,  // Default false
          sunday: userDays.sunday === true  // Default false
        };

        // Convert days object to Instantly's format (0-6)
        const daysConfig = {
          '0': days.sunday,    // Sunday = 0
          '1': days.monday,    // Monday = 1
          '2': days.tuesday,   // Tuesday = 2
          '3': days.wednesday, // Wednesday = 3
          '4': days.thursday,  // Thursday = 4
          '5': days.friday,    // Friday = 5
          '6': days.saturday   // Saturday = 6
        };

        // Build comprehensive campaign data according to API documentation
        const campaignData: any = {
          name: args!.name,
          campaign_schedule: {
            schedules: [{
              name: args?.schedule_name || 'Default Schedule',
              timing: {
                from: args?.timing_from || '09:00',
                to: args?.timing_to || '17:00'
              },
              days: daysConfig,
              timezone: timezone
            }]
          },
          // Sequences with email content
          sequences: [{
            steps: [{
              subject: args!.subject,
              body: args!.body
            }]
          }],
          // Use provided verified sending accounts
          email_list: args!.email_list,

          // Campaign configuration with proper defaults
          daily_limit: args?.daily_limit || 50,
          email_gap: args?.email_gap_minutes || 10,
          text_only: args?.text_only || false,
          link_tracking: args?.link_tracking || false,
          open_tracking: args?.open_tracking || false,
          stop_on_reply: args?.stop_on_reply !== false, // Default true
          stop_on_auto_reply: args?.stop_on_auto_reply !== false, // Default true

          // Additional required campaign settings
          pl_value: args?.pl_value || 100,
          is_evergreen: args?.is_evergreen || false,
          random_wait_max: args?.random_wait_max || 10,
          daily_max_leads: args?.daily_max_leads || args?.daily_limit || 50,
          prioritize_new_leads: args?.prioritize_new_leads || false,
          match_lead_esp: args?.match_lead_esp || false,
          stop_for_company: args?.stop_for_company || false,
          insert_unsubscribe_header: args?.insert_unsubscribe_header !== false, // Default true
          allow_risky_contacts: args?.allow_risky_contacts || false,
          disable_bounce_protect: args?.disable_bounce_protect || false
        };

        // Add multiple sequence steps if requested
        if (args?.sequence_steps && Number(args.sequence_steps) > 1) {
          const stepDelayDays = Number(args?.step_delay_days) || 3;
          const numSteps = Number(args.sequence_steps);

          // Create additional follow-up steps
          for (let i = 1; i < numSteps; i++) {
            campaignData.sequences[0].steps.push({
              subject: `Follow-up ${i}: ${args!.subject}`,
              body: `This is follow-up #${i}.\n\n${args!.body}`,
              delay: stepDelayDays * i
            });
          }
        }

        console.error(`[Instantly MCP] Campaign creation payload:`, JSON.stringify(campaignData, null, 2));

        const result = await makeInstantlyRequest('/campaigns', 'POST', campaignData);

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
        const queryParams = buildQueryParams(args, ['campaign_id', 'start_date', 'end_date']);

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
        const queryParams = buildQueryParams(args, ['start_date', 'end_date']);

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
        const queryParams = buildQueryParams(args);

        const endpoint = `/accounts${queryParams.toString() ? `?${queryParams}` : ''}`;
        const result = await makeInstantlyRequest(endpoint);

        // Don't use pagination parsing, return raw results
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
        const requiredFields = ['email', 'username', 'password', 'smtp_host', 'smtp_port'];
        for (const field of requiredFields) {
          if (!args?.[field]) {
            throw new McpError(ErrorCode.InvalidParams, `${field} is required`);
          }
        }

        // Ensure numeric values for port and proper data structure
        const accountData = {
          email: args!.email,
          username: args!.username,
          password: args!.password,
          smtp_host: args!.smtp_host,
          smtp_port: Number(args!.smtp_port),
          imap_host: args?.imap_host,
          imap_port: args?.imap_port ? Number(args.imap_port) : undefined,
          max_daily_limit: args?.max_daily_limit || 30,
          warmup_limit: args?.warmup_limit || 20,
          warmup_reply_rate: args?.warmup_reply_rate || 50,
          warmup_enabled: args?.warmup_enabled !== false, // Default to true
          provider: args?.provider
        };

        const result = await makeInstantlyRequest('/accounts', 'POST', accountData);

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
        const queryParams = buildQueryParams(args, ['campaign_id', 'list_id', 'status']);

        const endpoint = `/leads${queryParams.toString() ? `?${queryParams}` : ''}`;
        const result = await makeInstantlyRequest(endpoint, 'GET');

        // Return raw results without pagination parsing
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
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
        const queryParams = buildQueryParams(args);

        const endpoint = `/lead-lists${queryParams.toString() ? `?${queryParams}` : ''}`;
        const result = await makeInstantlyRequest(endpoint, 'GET');
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

        const result = await makeInstantlyRequest('/emails/send', 'POST', args);

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
        const queryParams = buildQueryParams(args, ['campaign_id', 'account_id']);

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

      case 'get_email': {
        if (!args?.email_id) {
          throw new McpError(ErrorCode.InvalidParams, 'email_id is required');
        }

        const result = await makeInstantlyRequest(`/emails/${args.email_id}`);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'reply_to_email': {
        if (!args?.email_id || !args?.body) {
          throw new McpError(ErrorCode.InvalidParams, 'email_id and body are required');
        }

        const result = await makeInstantlyRequest(`/emails/${args.email_id}/reply`, 'POST', { body: args.body });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      // Email Verification
      case 'verify_email': {
        if (!args?.email) {
          throw new McpError(ErrorCode.InvalidParams, 'email is required');
        }

        const result = await makeInstantlyRequest('/email-verification', 'POST', { email: args.email });

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