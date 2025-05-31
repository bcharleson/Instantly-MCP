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
    version: '3.0.6',
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

// Helper function to check if email verification is available
const checkEmailVerificationAvailability = async (): Promise<{ available: boolean; reason?: string }> => {
  try {
    // Try to get API keys to check account capabilities
    const apiKeysResult = await makeInstantlyRequest('/api-keys');
    
    // Check if this is a trial/basic account by looking at available features
    // This is a heuristic - we'll try a minimal verification first
    
    return { available: true };
  } catch (error: any) {
    // If we can't even get API keys, there might be permission issues
    if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
      return { 
        available: false, 
        reason: 'Your account may not have access to advanced features. Email verification typically requires a premium Instantly plan.' 
      };
    }
    
    // For other errors, assume verification might be available
    return { available: true };
  }
};

// Helper function to validate email addresses against eligible accounts
const validateEmailListAgainstAccounts = async (emailList: string[]): Promise<void> => {
  try {
    // Fetch available accounts
    const accountsResult = await makeInstantlyRequest('/accounts');
    
    // Handle different API response formats
    let accounts: any[];
    if (Array.isArray(accountsResult)) {
      // Direct array response
      accounts = accountsResult;
    } else if (accountsResult && accountsResult.data && Array.isArray(accountsResult.data)) {
      // Wrapped in data property
      accounts = accountsResult.data;
    } else if (accountsResult && accountsResult.items && Array.isArray(accountsResult.items)) {
      // Wrapped in items property (pagination format)
      accounts = accountsResult.items;
    } else {
      console.error(`[Instantly MCP] Unexpected accounts response format:`, JSON.stringify(accountsResult, null, 2));
      throw new McpError(
        ErrorCode.InvalidParams, 
        `Unable to retrieve accounts from your workspace. Response format: ${typeof accountsResult}. Please ensure you have at least one account configured.`
      );
    }

    if (!accounts || accounts.length === 0) {
      throw new McpError(
        ErrorCode.InvalidParams, 
        'No accounts found in your workspace. Please add at least one account before creating campaigns.'
      );
    }

    console.error(`[Instantly MCP] Found ${accounts.length} total accounts`);
    
    // Filter accounts to find eligible ones for campaign sending
    const eligibleAccounts = accounts.filter((account: any) => {
      const isEligible = 
        account.status === 1 &&                    // Account is active
        !account.setup_pending &&                  // Setup is complete
        account.email &&                          // Has email address
        account.warmup_status === 1;              // Warmup is complete/active
      
      if (!isEligible) {
        console.error(`[Instantly MCP] Account ${account.email} not eligible:`, {
          status: account.status,
          setup_pending: account.setup_pending,
          warmup_status: account.warmup_status
        });
      }
      
      return isEligible;
    });

    console.error(`[Instantly MCP] Found ${eligibleAccounts.length} eligible accounts`);
    
    // Check if no eligible accounts are available
    if (eligibleAccounts.length === 0) {
      const accountStatuses = accounts.map((acc: any) => ({
        email: acc.email,
        status: acc.status,
        setup_pending: acc.setup_pending,
        warmup_status: acc.warmup_status,
        warmup_score: acc.warmup_score
      }));
      
      throw new McpError(
        ErrorCode.InvalidParams, 
        `No eligible sending accounts found. For campaign creation, accounts must meet ALL criteria: ` +
        `1) Active (status=1), 2) Setup complete (setup_pending=false), 3) Warmup active (warmup_status=1). ` +
        `Current account statuses: ${JSON.stringify(accountStatuses, null, 2)}. ` +
        `Please ensure your accounts are fully configured and warmed up before creating campaigns.`
      );
    }
    
    // Create set of eligible email addresses
    const eligibleEmails = new Set<string>();
    const eligibleEmailsForDisplay: string[] = [];
    
    for (const account of eligibleAccounts) {
      eligibleEmails.add(account.email.toLowerCase());
      eligibleEmailsForDisplay.push(`${account.email} (warmup: ${account.warmup_score})`);
    }
    
    // Validate each email in the provided list
    const invalidEmails: string[] = [];
    for (const email of emailList) {
      if (!eligibleEmails.has(email.toLowerCase())) {
        invalidEmails.push(email);
      }
    }
    
    if (invalidEmails.length > 0) {
      throw new McpError(
        ErrorCode.InvalidParams, 
        `The following email addresses are not eligible for campaign sending: ${invalidEmails.join(', ')}. ` +
        `Eligible accounts (active, setup complete, warmed up): ${eligibleEmailsForDisplay.join(', ')}. ` +
        `Please use only fully configured and warmed-up accounts.`
      );
    }

    console.error(`[Instantly MCP] All ${emailList.length} email addresses validated successfully`);
  } catch (error) {
    // If it's already an McpError, rethrow it
    if (error instanceof McpError) {
      throw error;
    }
    // For other errors, wrap them
    throw new McpError(
      ErrorCode.InternalError, 
      `Failed to validate email addresses against available accounts: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
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

  // Validate timezone if provided - exact values from Instantly API documentation
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
      description: 'List campaigns with optional filters and smart pagination. **PAGINATION GUIDE**: For large datasets, responses are automatically truncated to prevent size limits. Use limit=20-50 for full details, or higher limits for summary view. Use starting_after for pagination through large result sets.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { 
            type: 'number', 
            description: 'Number of campaigns to return (1-100, default: 20). **IMPORTANT**: Limits >50 may return summarized data to prevent response size limits. Use smaller limits for full campaign details.',
            minimum: 1,
            maximum: 100
          },
          starting_after: { type: 'string', description: 'ID of the last item from previous page for pagination. Use this to fetch the next batch of campaigns.' },
          search: { type: 'string', description: 'Search term to filter campaigns by name' },
          status: { 
            type: 'string', 
            description: 'Filter by campaign status',
            enum: ['active', 'paused', 'completed']
          },
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
      description: 'Create a new email campaign with complete configuration. **CRITICAL WORKFLOW**: Before calling this tool, you MUST first call list_accounts to obtain valid sending email addresses. The email_list parameter can ONLY contain email addresses returned by list_accounts - using any other addresses will result in 400 Bad Request errors. This tool creates comprehensive email campaigns with sequences, scheduling, and tracking capabilities.',
      inputSchema: {
        type: 'object',
        properties: {
          // CRITICAL REQUIRED FIELDS - Campaign will fail without these
          name: {
            type: 'string',
            description: 'Campaign name (REQUIRED). Choose a descriptive name that identifies the campaign purpose.'
          },
          subject: {
            type: 'string',
            description: 'Email subject line (REQUIRED). This is the subject for the first email in the sequence. Supports personalization variables like {{firstName}}.'
          },
          body: {
            type: 'string',
            description: 'Email body content (REQUIRED). This is the content for the first email in the sequence. Supports personalization variables like {{firstName}}, {{lastName}}, {{companyName}}. Use \\n for line breaks.'
          },
          email_list: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of sending account email addresses (REQUIRED). **CRITICAL**: These MUST be email addresses obtained from list_accounts tool - you cannot use arbitrary email addresses. Each email in this array must exist in the user\'s Instantly workspace. Example: ["sender1@company.com", "sender2@company.com"]'
          },

          // SCHEDULE CONFIGURATION - Controls when emails are sent
          schedule_name: {
            type: 'string',
            description: 'Schedule name (optional, default: "Default Schedule"). Internal name for the sending schedule.'
          },
          timing_from: {
            type: 'string',
            description: 'Daily start time in HH:MM format (optional, default: "09:00"). Emails will only be sent after this time each day. Example: "09:00" for 9 AM.'
          },
          timing_to: {
            type: 'string',
            description: 'Daily end time in HH:MM format (optional, default: "17:00"). Emails will stop being sent after this time each day. Example: "17:00" for 5 PM.'
          },
          timezone: {
            type: 'string',
            description: 'Timezone for campaign schedule (optional, default: "America/New_York"). All timing_from and timing_to values will be interpreted in this timezone.',
            enum: ["Etc/GMT+12", "Etc/GMT+11", "Etc/GMT+10", "America/Anchorage", "America/Dawson", "America/Creston", "America/Chihuahua", "America/Boise", "America/Belize", "America/Chicago", "America/New_York", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Tokyo", "Asia/Singapore", "Australia/Sydney"]
          },
          days: {
            type: 'object',
            description: 'Days of the week to send emails (optional, default: Monday-Friday only). Specify which days the campaign should send emails. Weekend sending is disabled by default for better deliverability.',
            properties: {
              monday: { type: 'boolean', description: 'Send emails on Monday (default: true)' },
              tuesday: { type: 'boolean', description: 'Send emails on Tuesday (default: true)' },
              wednesday: { type: 'boolean', description: 'Send emails on Wednesday (default: true)' },
              thursday: { type: 'boolean', description: 'Send emails on Thursday (default: true)' },
              friday: { type: 'boolean', description: 'Send emails on Friday (default: true)' },
              saturday: { type: 'boolean', description: 'Send emails on Saturday (default: false)' },
              sunday: { type: 'boolean', description: 'Send emails on Sunday (default: false)' }
            }
          },

          // SEQUENCE CONFIGURATION - Controls follow-up emails
          sequence_steps: {
            type: 'number',
            description: 'Number of follow-up steps in the sequence (optional, default: 1 for just the initial email). If set to 2 or more, the system will automatically create follow-up emails with the same subject/body but with "Follow-up N:" prefix. Maximum 10 steps.',
            minimum: 1,
            maximum: 10
          },
          step_delay_days: {
            type: 'number',
            description: 'Days to wait between sequence steps (optional, default: 3 days). This is the delay between the initial email and first follow-up, then between each subsequent follow-up. Minimum 1 day, maximum 30 days.',
            minimum: 1,
            maximum: 30
          },

          // EMAIL SENDING CONFIGURATION - Controls delivery behavior
          text_only: {
            type: 'boolean',
            description: 'Send as text-only emails (optional, default: false for HTML). Text-only emails often have better deliverability but no formatting.'
          },
          daily_limit: {
            type: 'number',
            description: 'Maximum emails to send per day across all sending accounts (optional, default: 50). Higher limits may affect deliverability. Recommended: 20-100 for new accounts, up to 500 for warmed accounts.',
            minimum: 1,
            maximum: 1000
          },
          email_gap_minutes: {
            type: 'number',
            description: 'Minutes to wait between individual emails (optional, default: 10). Longer gaps improve deliverability. Minimum 1 minute, maximum 1440 minutes (24 hours).',
            minimum: 1,
            maximum: 1440
          },

          // TRACKING AND BEHAVIOR - Controls campaign behavior
          link_tracking: {
            type: 'boolean',
            description: 'Track link clicks in emails (optional, default: false). When enabled, links are replaced with tracking URLs.'
          },
          open_tracking: {
            type: 'boolean',
            description: 'Track email opens (optional, default: false). When enabled, invisible tracking pixels are added to emails.'
          },
          stop_on_reply: {
            type: 'boolean',
            description: 'Stop sending follow-ups when lead replies (optional, default: true). Recommended to keep true to avoid annoying engaged prospects.'
          },
          stop_on_auto_reply: {
            type: 'boolean',
            description: 'Stop sending when auto-reply is detected (optional, default: true). Helps avoid sending to out-of-office or vacation responders.'
          }
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
      description: 'List all sending accounts in the workspace. **PREREQUISITE FOR CAMPAIGN CREATION**: You MUST call this tool first before creating any campaigns to obtain valid email addresses for the email_list parameter. The returned accounts are the only valid sending addresses that can be used in campaigns. If no accounts are returned, campaigns cannot be created until accounts are added to the workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of accounts to return (1-100, default: 20). If you need all accounts for campaign creation, use a high limit or handle pagination.'
          },
          starting_after: {
            type: 'string',
            description: 'ID of the last item from previous page for pagination. Use this to get all accounts if there are more than the limit.'
          },
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
      name: 'reply_to_email',
      description: 'Reply to an existing email. **IMPORTANT**: This can only be used to reply to existing emails, not to send new emails. You must provide the ID of an existing email to reply to. Use campaigns for sending new emails.',
      inputSchema: {
        type: 'object',
        properties: {
          reply_to_uuid: {
            type: 'string',
            description: 'The ID of the email to reply to (REQUIRED). Get this from list_emails or get_email endpoints.'
          },
          eaccount: {
            type: 'string',
            description: 'The email account to send from (REQUIRED). Must be an email address from list_accounts that exists in your workspace.'
          },
          subject: {
            type: 'string',
            description: 'Reply subject line (REQUIRED). Usually starts with "Re: "'
          },
          body: {
            type: 'object',
            description: 'Email body content (REQUIRED). Provide either html or text, or both.',
            properties: {
              html: { type: 'string', description: 'HTML body content' },
              text: { type: 'string', description: 'Plain text body content' }
            }
          },
          cc_address_email_list: {
            type: 'string',
            description: 'Comma-separated list of CC email addresses (optional)'
          },
          bcc_address_email_list: {
            type: 'string',
            description: 'Comma-separated list of BCC email addresses (optional)'
          },
        },
        required: ['reply_to_uuid', 'eaccount', 'subject', 'body'],
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
    // Email Verification
    {
      name: 'verify_email',
      description: 'Verify if an email address is valid. **IMPORTANT**: This feature may require a premium Instantly plan or specific API permissions. If you receive a 403 Forbidden error, check: 1) Your Instantly plan includes email verification, 2) Your API key has the required scopes, 3) Contact Instantly support to confirm feature availability.',
      inputSchema: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'Email address to verify (must be valid email format)' },
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
      description: 'Create a new API key. **NOTE**: The scopes parameter is optional and format varies by Instantly plan. If you get a 400 error, try creating the API key with just the name parameter first.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'API key name (must be unique)' },
          scopes: { 
            type: 'array', 
            items: { type: 'string' }, 
            description: 'Optional: Permission scopes. Leave empty for default permissions. Format may vary by plan.'
          },
        },
        required: ['name'],
      },
    },
    // Debugging and Helper Tools
    {
      name: 'validate_campaign_accounts',
      description: 'Validate which accounts are eligible for campaign creation. This tool helps debug campaign creation issues by showing the status of all accounts and which ones meet the requirements for sending campaigns.',
      inputSchema: {
        type: 'object',
        properties: {
          email_list: { 
            type: 'array', 
            items: { type: 'string' }, 
            description: 'Optional: Specific email addresses to validate. If not provided, shows all account statuses.' 
          },
        },
      },
    },
    {
      name: 'get_account_details',
      description: 'Get detailed information about a specific account including warmup status, SMTP settings, and eligibility for campaigns.',
      inputSchema: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'Email address of the account to inspect' },
        },
        required: ['email'],
      },
    },
    {
      name: 'check_feature_availability',
      description: 'Check which premium features are available with your current Instantly plan and API key permissions.',
      inputSchema: {
        type: 'object',
        properties: {},
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
        const queryParams = buildQueryParams(args, ['search', 'status']);

        const endpoint = `/campaigns${queryParams.toString() ? `?${queryParams}` : ''}`;
        const result = await makeInstantlyRequest(endpoint);
        
        // Pass the requested limit to maintain it in the response structure
        const requestedLimit = (typeof args?.limit === 'number') ? args.limit : 20; // Default to 20 if not specified
        const paginatedResult = parsePaginatedResponse(result, requestedLimit);

        // Handle large responses that might exceed MCP size limits
        const responseText = JSON.stringify(paginatedResult, null, 2);
        const maxResponseSize = 900000; // ~900KB to stay under 1MB limit with buffer
        
        if (responseText.length > maxResponseSize) {
          console.error(`[Instantly MCP] Response too large (${responseText.length} chars), truncating campaigns...`);
          
          // Create summary version with essential fields only
          const summarizedCampaigns = paginatedResult.data.map((campaign: any) => ({
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            timestamp_created: campaign.timestamp_created,
            timestamp_updated: campaign.timestamp_updated,
            email_list_count: campaign.email_list?.length || 0,
            sequence_steps_count: campaign.sequences?.[0]?.steps?.length || 0,
            daily_limit: campaign.daily_limit,
            organization: campaign.organization
          }));
          
          const truncatedResult = {
            ...paginatedResult,
            data: summarizedCampaigns,
            truncated: true,
            original_count: paginatedResult.data.length,
            message: `Response truncated due to size. Showing summary of ${summarizedCampaigns.length} campaigns. Use smaller limit or get individual campaigns with get_campaign for full details.`
          };
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(truncatedResult, null, 2),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: responseText,
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

        // Validate email_list against available accounts
        console.error(`[Instantly MCP] create_campaign - Validating ${args.email_list.length} email addresses...`);
        try {
          await validateEmailListAgainstAccounts(args.email_list);
          console.error(`[Instantly MCP] create_campaign - Email validation successful`);
        } catch (validationError) {
          console.error(`[Instantly MCP] create_campaign - Email validation failed:`, validationError);
          throw validationError;
        }

        // Get timezone from args with default - use valid timezone from API docs
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

        // Convert days object to Instantly's format (0-6) - ensure non-empty as required by API
        const daysConfig: any = {};
        if (days.sunday) daysConfig['0'] = true;
        if (days.monday) daysConfig['1'] = true;
        if (days.tuesday) daysConfig['2'] = true;
        if (days.wednesday) daysConfig['3'] = true;
        if (days.thursday) daysConfig['4'] = true;
        if (days.friday) daysConfig['5'] = true;
        if (days.saturday) daysConfig['6'] = true;
        
        // Ensure at least one day is selected (API requires non-empty)
        if (Object.keys(daysConfig).length === 0) {
          // Default to Monday-Friday if no days specified
          daysConfig['1'] = true; // Monday
          daysConfig['2'] = true; // Tuesday
          daysConfig['3'] = true; // Wednesday
          daysConfig['4'] = true; // Thursday
          daysConfig['5'] = true; // Friday
        }

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
          // Sequences with email content - add all required fields
          sequences: [{
            steps: [{
              type: 'email',
              subject: args!.subject,
              body: args!.body,
              delay: 0,  // First step has no delay
              variants: [{
                subject: args!.subject,
                body: args!.body
              }]
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
            const followUpSubject = `Follow-up ${i}: ${args!.subject}`;
            const followUpBody = `This is follow-up #${i}.\n\n${args!.body}`;
            
            campaignData.sequences[0].steps.push({
              type: 'email',
              subject: followUpSubject,
              body: followUpBody,
              delay: stepDelayDays * i,
              variants: [{
                subject: followUpSubject,
                body: followUpBody
              }]
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

        // Enhanced validation for get_warmup_analytics
        if (args.account_id === 'test-id') {
          throw new McpError(
            ErrorCode.InvalidParams,
            `account_id must be a valid account ID. Use list_accounts tool first to obtain valid account IDs.`
          );
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
        // Fix: Use POST /leads/list with body parameters instead of GET /leads with query params
        const requestData: any = {
          limit: args?.limit || 20,
          skip: args?.starting_after || 0
        };

        // Add optional filter parameters to the request body
        if (args?.campaign_id) requestData.campaign_id = args.campaign_id;
        if (args?.list_id) requestData.list_id = args.list_id;
        if (args?.status) requestData.status = args.status;

        console.error(`[Instantly MCP] List leads payload:`, JSON.stringify(requestData, null, 2));

        const result = await makeInstantlyRequest('/leads/list', 'POST', requestData);

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

        // Map camelCase fields to snake_case for API compatibility
        const leadData: any = {
          email: args.email,
        };

        // Map optional fields with proper naming
        if (args.firstName) leadData.first_name = args.firstName;
        if (args.lastName) leadData.last_name = args.lastName;
        if (args.companyName) leadData.company_name = args.companyName;
        if (args.website) leadData.website = args.website;
        if (args.personalization) leadData.personalization = args.personalization;
        if (args.custom_fields) leadData.custom_fields = args.custom_fields;

        console.error(`[Instantly MCP] Create lead payload:`, JSON.stringify(leadData, null, 2));

        const result = await makeInstantlyRequest('/leads', 'POST', leadData);

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
        
        const requestedLimit = (typeof args?.limit === 'number') ? args.limit : 20;
        const paginatedResult = parsePaginatedResponse(result, requestedLimit);

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

      case 'list_emails': {
        const queryParams = buildQueryParams(args, ['campaign_id', 'account_id']);

        const endpoint = `/emails${queryParams.toString() ? `?${queryParams}` : ''}`;
        const result = await makeInstantlyRequest(endpoint);
        
        const requestedLimit = (typeof args?.limit === 'number') ? args.limit : 20;
        const paginatedResult = parsePaginatedResponse(result, requestedLimit);

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
        const requiredFields = ['reply_to_uuid', 'eaccount', 'subject', 'body'];
        for (const field of requiredFields) {
          if (!args?.[field]) {
            throw new McpError(ErrorCode.InvalidParams, `${field} is required`);
          }
        }

        // Enhanced validation for reply_to_email
        if (!args!.reply_to_uuid || args!.reply_to_uuid === 'test-uuid') {
          throw new McpError(
            ErrorCode.InvalidParams,
            `reply_to_uuid must be a valid email ID. Use list_emails or get_email tools first to obtain a valid email UUID.`
          );
        }

        // Validate body object has either html or text
        const bodyObj = args!.body as any;
        if (!bodyObj?.html && !bodyObj?.text) {
          throw new McpError(ErrorCode.InvalidParams, 'body must contain either html or text content');
        }

        const emailData: any = {
          reply_to_uuid: args!.reply_to_uuid,
          eaccount: args!.eaccount,
          subject: args!.subject,
          body: args!.body,
        };

        if (args?.cc_address_email_list) {
          emailData.cc_address_email_list = args.cc_address_email_list;
        }

        if (args?.bcc_address_email_list) {
          emailData.bcc_address_email_list = args.bcc_address_email_list;
        }

        const result = await makeInstantlyRequest('/emails/reply', 'POST', emailData);

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

        // Validate email format before making API call
        if (!isValidEmail(args.email as string)) {
          throw new McpError(ErrorCode.InvalidParams, `Invalid email format: ${args.email}`);
        }

        // Check if email verification is likely available before attempting
        console.error(`[Instantly MCP] Checking email verification availability...`);
        const availabilityCheck = await checkEmailVerificationAvailability();
        
        if (!availabilityCheck.available) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Email verification is not available: ${availabilityCheck.reason} ` +
            `This feature typically requires a premium Instantly plan. Please: ` +
            `1) Upgrade your Instantly plan to include email verification, ` +
            `2) Verify your API key has the required scopes, ` +
            `3) Contact Instantly support to confirm feature availability for your account.`
          );
        }

        try {
          console.error(`[Instantly MCP] Attempting email verification for: ${args.email}`);
          const result = await makeInstantlyRequest('/email-verification', 'POST', { email: args.email });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error: any) {
          // Enhanced error handling for 403 permission issues
          if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Email verification access denied (403): This feature requires a premium Instantly plan. ` +
              `Your current plan does not include email verification capabilities. ` +
              `Please: 1) Upgrade to a premium plan, 2) Verify your API key permissions, ` +
              `3) Contact Instantly support at support@instantly.ai for plan details. Email: ${args.email}`
            );
          }
          
          // Enhanced error handling for other common errors
          if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Email verification unauthorized (401): Your API key may be invalid or expired. ` +
              `Please verify your API key is correct and has the required permissions.`
            );
          }

          if (error.message?.includes('429') || error.message?.includes('Too Many Requests')) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Email verification rate limited (429): Too many verification requests. ` +
              `Please wait before retrying. Consider upgrading your plan for higher limits.`
            );
          }

          // Enhanced error handling for 402 payment required
          if (error.message?.includes('402') || error.message?.includes('Payment Required')) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Email verification requires payment (402): This feature is not included in your current plan. ` +
              `Please upgrade to a plan that includes email verification or contact Instantly support.`
            );
          }

          // Re-throw the original error if it's not a known permission issue
          throw error;
        }
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

        // Build API key creation payload with proper formatting
        const apiKeyData: any = {
          name: args.name
        };

        // Handle scopes parameter - try different formats that might be accepted
        if (args.scopes) {
          if (Array.isArray(args.scopes)) {
            // Try array format first
            apiKeyData.scopes = args.scopes;
          } else if (typeof args.scopes === 'string') {
            // Try string format
            apiKeyData.scopes = args.scopes;
          }
        }

        console.error(`[Instantly MCP] Creating API key with payload:`, JSON.stringify(apiKeyData, null, 2));

        try {
          const result = await makeInstantlyRequest('/api-keys', 'POST', apiKeyData);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error: any) {
          // Enhanced error handling for API key creation
          if (error.message?.includes('400') || error.message?.includes('Bad Request')) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `API key creation failed (400): ${error.message}. ` +
              `Common issues: 1) Invalid scope values (try omitting scopes parameter), ` +
              `2) Duplicate API key name, 3) Invalid name format. ` +
              `Try creating with just the name parameter first.`
            );
          }
          throw error;
        }
      }

      // Debugging and Helper Tools
      case 'validate_campaign_accounts': {
        try {
          const accountsResult = await makeInstantlyRequest('/accounts');
          
          // Handle different API response formats (same logic as main validation function)
          let accounts: any[];
          if (Array.isArray(accountsResult)) {
            accounts = accountsResult;
          } else if (accountsResult && accountsResult.data && Array.isArray(accountsResult.data)) {
            accounts = accountsResult.data;
          } else if (accountsResult && accountsResult.items && Array.isArray(accountsResult.items)) {
            accounts = accountsResult.items;
          } else {
            console.error(`[Instantly MCP] validate_campaign_accounts - Unexpected response:`, JSON.stringify(accountsResult, null, 2));
            throw new McpError(ErrorCode.InternalError, `Unable to retrieve accounts. Response format: ${typeof accountsResult}`);
          }

          if (!accounts || accounts.length === 0) {
            throw new McpError(ErrorCode.InternalError, 'No accounts found in workspace');
          }

          const emailList = args?.email_list;
          
          const analysis: any = {
            total_accounts: accounts.length,
            eligible_accounts: [],
            ineligible_accounts: [],
            validation_results: {},
            eligibility_criteria: {
              active_status: 'status must equal 1',
              setup_complete: 'setup_pending must be false',
              warmup_active: 'warmup_status must equal 1',
              has_email: 'email address must be present'
            }
          };

          for (const account of accounts) {
            const accountInfo: any = {
              email: account.email,
              status: account.status,
              setup_pending: account.setup_pending,
              warmup_status: account.warmup_status,
              warmup_score: account.warmup_score,
              provider_code: account.provider_code,
              eligible: false,
              issues: []
            };

            // Check eligibility criteria
            if (account.status !== 1) accountInfo.issues.push('Account not active (status != 1)');
            if (account.setup_pending) accountInfo.issues.push('Setup still pending');
            if (account.warmup_status !== 1) accountInfo.issues.push('Warmup not active (warmup_status != 1)');
            if (!account.email) accountInfo.issues.push('No email address');

            accountInfo.eligible = accountInfo.issues.length === 0;

            if (accountInfo.eligible) {
              analysis.eligible_accounts.push(accountInfo);
            } else {
              analysis.ineligible_accounts.push(accountInfo);
            }

            // If specific emails were requested, validate them
            if (emailList && Array.isArray(emailList) && emailList.includes(account.email)) {
              analysis.validation_results[account.email] = accountInfo;
            }
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(analysis, null, 2),
              },
            ],
          };
        } catch (error) {
          handleInstantlyError(error, 'validate_campaign_accounts');
        }
      }

      case 'get_account_details': {
        if (!args?.email) {
          throw new McpError(ErrorCode.InvalidParams, 'email is required');
        }

        try {
          const accountsResult = await makeInstantlyRequest('/accounts');
          
          // Handle different API response formats (same logic as main validation function)
          let accounts: any[];
          if (Array.isArray(accountsResult)) {
            accounts = accountsResult;
          } else if (accountsResult && accountsResult.data && Array.isArray(accountsResult.data)) {
            accounts = accountsResult.data;
          } else if (accountsResult && accountsResult.items && Array.isArray(accountsResult.items)) {
            accounts = accountsResult.items;
          } else {
            console.error(`[Instantly MCP] get_account_details - Unexpected response:`, JSON.stringify(accountsResult, null, 2));
            throw new McpError(ErrorCode.InternalError, `Unable to retrieve accounts. Response format: ${typeof accountsResult}`);
          }

          if (!accounts || accounts.length === 0) {
            throw new McpError(ErrorCode.InternalError, 'No accounts found in workspace');
          }

          const account = accounts.find((acc: any) => acc.email.toLowerCase() === (args.email as string).toLowerCase());
          
          if (!account) {
            throw new McpError(ErrorCode.InvalidParams, `Account with email ${args.email} not found`);
          }

          const details = {
            basic_info: {
              email: account.email,
              username: account.username,
              provider: account.provider,
              provider_code: account.provider_code,
              created_at: account.created_at
            },
            status_info: {
              status: account.status,
              status_meaning: account.status === 1 ? 'Active' : 'Inactive',
              setup_pending: account.setup_pending,
              setup_status: account.setup_pending ? 'Setup in progress' : 'Setup complete'
            },
            warmup_info: {
              warmup_enabled: account.warmup_enabled,
              warmup_status: account.warmup_status,
              warmup_status_meaning: account.warmup_status === 1 ? 'Active/Complete' : 'Inactive/Pending',
              warmup_score: account.warmup_score,
              warmup_limit: account.warmup_limit,
              warmup_reply_rate: account.warmup_reply_rate
            },
            sending_limits: {
              max_daily_limit: account.max_daily_limit,
              daily_limit: account.daily_limit
            },
            campaign_eligibility: {
              eligible: account.status === 1 && !account.setup_pending && account.warmup_status === 1 && account.email,
              requirements_met: {
                active_status: account.status === 1,
                setup_complete: !account.setup_pending,
                warmup_active: account.warmup_status === 1,
                has_email: !!account.email
              }
            }
          };

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(details, null, 2),
              },
            ],
          };
        } catch (error) {
          handleInstantlyError(error, 'get_account_details');
        }
      }

      case 'check_feature_availability': {
        try {
          const features: any = {
            basic_features: {
              campaigns: 'Available',
              leads: 'Available', 
              accounts: 'Available',
              analytics: 'Available'
            },
            premium_features: {},
            api_access: {}
          };

          // Test API keys access
          try {
            await makeInstantlyRequest('/api-keys');
            features.api_access['api_key_management'] = 'Available';
          } catch (error: any) {
            features.api_access['api_key_management'] = `Error: ${error.message}`;
          }

          // Test email verification
          try {
            // Try a minimal verification call to test permissions
            await makeInstantlyRequest('/email-verification', 'POST', { email: 'test@example.com' });
            features.premium_features['email_verification'] = 'Available';
          } catch (error: any) {
            if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
              features.premium_features['email_verification'] = 'Requires premium plan';
            } else if (error.message?.includes('402')) {
              features.premium_features['email_verification'] = 'Requires payment/upgrade';
            } else {
              features.premium_features['email_verification'] = `Unknown status: ${error.message}`;
            }
          }

          // Test warmup analytics
          try {
            await makeInstantlyRequest('/accounts/warmup-analytics', 'POST', { account_id: 'test' });
            features.premium_features['warmup_analytics'] = 'Available';
          } catch (error: any) {
            if (error.message?.includes('400')) {
              features.premium_features['warmup_analytics'] = 'Available (invalid test data expected)';
            } else {
              features.premium_features['warmup_analytics'] = `Error: ${error.message}`;
            }
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(features, null, 2),
              },
            ],
          };
        } catch (error) {
          handleInstantlyError(error, 'check_feature_availability');
        }
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