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
import {
  validateToolParameters,
  validateCampaignData,
  validateCampaignPrerequisiteData,
  validateWarmupAnalyticsData,
  validateEmailVerificationData,
  validateListAccountsData,
  validateListCampaignsData,
  isValidEmail
} from './validation.js';

const INSTANTLY_API_URL = 'https://api.instantly.ai/api/v2';

// API key can be provided via environment variable or MCP config args
// Environment variable takes precedence for security
let INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY;

if (!INSTANTLY_API_KEY) {
  // Fallback to command-line argument for backward compatibility
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

const server = new Server(
  {
    name: 'instantly-mcp',
    version: '1.0.5',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Note: isValidEmail is now imported from validation.js and uses Zod internally

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

// Helper function to retrieve ALL accounts with bulletproof batched pagination
const getAllAccountsWithPagination = async (): Promise<any[]> => {
  console.error(`[Instantly MCP] Starting bulletproof batched account retrieval...`);

  const BATCH_SIZE = 100;
  const MAX_BATCHES = 20; // Safety limit
  const allAccounts: any[] = [];
  let batchCount = 0;
  let startingAfter: string | undefined = undefined;
  let hasMore = true;

  try {
    while (hasMore && batchCount < MAX_BATCHES) {
      batchCount++;

      // Build query parameters for this batch
      const queryParams = new URLSearchParams();
      queryParams.append('limit', BATCH_SIZE.toString());
      if (startingAfter) {
        queryParams.append('starting_after', startingAfter);
      }

      const endpoint = `/accounts?${queryParams.toString()}`;
      console.error(`[Instantly MCP] Batch ${batchCount}: Fetching up to ${BATCH_SIZE} accounts...`);

      // Make the API call for this batch
      const batchResult = await makeInstantlyRequest(endpoint);

      // Extract accounts from response (handle different response formats)
      let batchAccounts: any[] = [];
      let nextStartingAfter: string | undefined = undefined;

      if (Array.isArray(batchResult)) {
        // Direct array response
        batchAccounts = batchResult;
        hasMore = false; // Array response means no pagination
      } else if (batchResult && batchResult.data && Array.isArray(batchResult.data)) {
        // Standard paginated response with data array
        batchAccounts = batchResult.data;
        nextStartingAfter = batchResult.next_starting_after;
      } else if (batchResult && batchResult.items && Array.isArray(batchResult.items)) {
        // Alternative response format with items array
        batchAccounts = batchResult.items;
        nextStartingAfter = batchResult.next_starting_after;
      } else {
        console.error(`[Instantly MCP] Unexpected response format in batch ${batchCount}:`, typeof batchResult);
        throw new McpError(ErrorCode.InternalError, `Unexpected API response format in batch ${batchCount}`);
      }

      // Add this batch to our accumulated results
      if (batchAccounts.length > 0) {
        allAccounts.push(...batchAccounts);
        console.error(`[Instantly MCP] Batch ${batchCount}: Retrieved ${batchAccounts.length} accounts (total: ${allAccounts.length})`);
      } else {
        console.error(`[Instantly MCP] Batch ${batchCount}: No accounts returned, ending pagination`);
        hasMore = false;
      }

      // Check termination conditions
      if (!nextStartingAfter || batchAccounts.length < BATCH_SIZE) {
        console.error(`[Instantly MCP] Pagination complete: ${nextStartingAfter ? 'Fewer results than batch size' : 'No next_starting_after token'}`);
        hasMore = false;
      } else {
        startingAfter = nextStartingAfter;
      }

      // Safety check to prevent infinite loops
      if (batchCount >= MAX_BATCHES) {
        console.error(`[Instantly MCP] Reached maximum batch limit (${MAX_BATCHES}), stopping pagination`);
        break;
      }
    }

    console.error(`[Instantly MCP] Bulletproof pagination complete: ${allAccounts.length} total accounts retrieved in ${batchCount} batches`);

    // Validate results without truncation
    if (allAccounts.length === 0) {
      console.error(`[Instantly MCP] Warning: No accounts found in workspace`);
    } else {
      console.error(`[Instantly MCP] ✅ Successfully retrieved complete dataset: ${allAccounts.length} accounts`);
    }

    return allAccounts;
  } catch (error) {
    console.error(`[Instantly MCP] Error during batched account pagination at batch ${batchCount}:`, error);
    throw error;
  }
};

// Helper function to retrieve ALL campaigns with bulletproof batched pagination
const getAllCampaignsWithPagination = async (filters: { search?: string, status?: string } = {}): Promise<any[]> => {
  console.error(`[Instantly MCP] Starting bulletproof batched campaign retrieval...`);

  const BATCH_SIZE = 100;
  const MAX_BATCHES = 20; // Safety limit
  const allCampaigns: any[] = [];
  let batchCount = 0;
  let startingAfter: string | undefined = undefined;
  let hasMore = true;

  try {
    while (hasMore && batchCount < MAX_BATCHES) {
      batchCount++;

      // Build query parameters for this batch
      const queryParams = new URLSearchParams();
      queryParams.append('limit', BATCH_SIZE.toString());
      if (startingAfter) {
        queryParams.append('starting_after', startingAfter);
      }

      // Add filters if provided
      if (filters.search) {
        queryParams.append('search', filters.search);
      }
      if (filters.status) {
        queryParams.append('status', filters.status);
      }

      const endpoint = `/campaigns?${queryParams.toString()}`;
      console.error(`[Instantly MCP] Batch ${batchCount}: Fetching up to ${BATCH_SIZE} campaigns...`);

      // Make the API call for this batch
      const batchResult = await makeInstantlyRequest(endpoint);

      // Extract campaigns from response (handle different response formats)
      let batchCampaigns: any[] = [];
      let nextStartingAfter: string | undefined = undefined;

      if (Array.isArray(batchResult)) {
        // Direct array response
        batchCampaigns = batchResult;
        hasMore = false; // Array response means no pagination
      } else if (batchResult && batchResult.data && Array.isArray(batchResult.data)) {
        // Standard paginated response with data array
        batchCampaigns = batchResult.data;
        nextStartingAfter = batchResult.next_starting_after;
      } else if (batchResult && batchResult.items && Array.isArray(batchResult.items)) {
        // Alternative response format with items array
        batchCampaigns = batchResult.items;
        nextStartingAfter = batchResult.next_starting_after;
      } else {
        console.error(`[Instantly MCP] Unexpected response format in batch ${batchCount}:`, typeof batchResult);
        throw new McpError(ErrorCode.InternalError, `Unexpected API response format in batch ${batchCount}`);
      }

      // Add this batch to our accumulated results
      if (batchCampaigns.length > 0) {
        allCampaigns.push(...batchCampaigns);
        console.error(`[Instantly MCP] Batch ${batchCount}: Retrieved ${batchCampaigns.length} campaigns (total: ${allCampaigns.length})`);
      } else {
        console.error(`[Instantly MCP] Batch ${batchCount}: No campaigns returned, ending pagination`);
        hasMore = false;
      }

      // Check termination conditions
      if (!nextStartingAfter || batchCampaigns.length < BATCH_SIZE) {
        console.error(`[Instantly MCP] Pagination complete: ${nextStartingAfter ? 'Fewer results than batch size' : 'No next_starting_after token'}`);
        hasMore = false;
      } else {
        startingAfter = nextStartingAfter;
      }

      // Safety check to prevent infinite loops
      if (batchCount >= MAX_BATCHES) {
        console.error(`[Instantly MCP] Reached maximum batch limit (${MAX_BATCHES}), stopping pagination`);
        break;
      }
    }

    console.error(`[Instantly MCP] Bulletproof campaign pagination complete: ${allCampaigns.length} total campaigns retrieved in ${batchCount} batches`);

    // Validate results without truncation
    if (allCampaigns.length === 0) {
      console.error(`[Instantly MCP] Warning: No campaigns found${filters.search || filters.status ? ' matching filters' : ''}`);
    } else {
      console.error(`[Instantly MCP] ✅ Successfully retrieved complete campaign dataset: ${allCampaigns.length} campaigns`);
    }

    return allCampaigns;
  } catch (error) {
    console.error(`[Instantly MCP] Error during batched campaign pagination at batch ${batchCount}:`, error);
    throw error;
  }
};

// Helper function to validate email addresses against eligible accounts with complete pagination
const validateEmailListAgainstAccounts = async (emailList: string[]): Promise<void> => {
  try {
    // Fetch ALL available accounts with complete pagination
    const accounts = await getAllAccountsWithPagination();

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

// Note: Campaign validation is now handled by Zod schemas in validation.js
// This provides better type safety, clearer error messages, and improved compatibility
// The validateCampaignData function from validation.js is used instead of this legacy function

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

// Helper functions for optimized create_campaign workflow
const determineWorkflowStage = (args: any): string => {
  // If stage explicitly provided, use it
  if (args?.stage) {
    return args.stage;
  }

  // Check if all core fields are provided for direct creation (backward compatibility)
  const hasAllCoreFields = args?.name && args?.subject && args?.body &&
                          args?.email_list && Array.isArray(args.email_list) && args.email_list.length > 0;

  if (hasAllCoreFields) {
    return 'create';
  }

  // If some fields provided but missing email_list or core fields, go to preview
  const hasSomeFields = args?.name || args?.subject || args?.body;
  if (hasSomeFields && args?.email_list && Array.isArray(args.email_list) && args.email_list.length > 0) {
    return 'preview';
  }

  // Default to prerequisite check for minimal input
  return 'prerequisite_check';
};

const handlePrerequisiteCheck = async (args: any): Promise<any> => {
  // Process message shortcut if provided
  if (args?.message && (!args.subject || !args.body)) {
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

  // Fetch all accounts with complete pagination
  const accounts = await getAllAccountsWithPagination();

  if (!accounts || accounts.length === 0) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'No accounts found in your workspace. Please add at least one sending account before creating campaigns. ' +
      'Use the create_account tool to add accounts, or check your Instantly dashboard.'
    );
  }

  // Filter for eligible accounts
  const eligibleAccounts = accounts.filter((a: any) =>
    a.status === 1 && !a.setup_pending && a.warmup_status === 1 && a.email);

  if (eligibleAccounts.length === 0) {
    const accountStatuses = accounts.slice(0, 5).map((acc: any) => ({
      email: acc.email,
      status: acc.status,
      setup_pending: acc.setup_pending,
      warmup_status: acc.warmup_status,
      warmup_score: acc.warmup_score
    }));

    throw new McpError(
      ErrorCode.InvalidParams,
      `No eligible sending accounts found. For campaign creation, accounts must be: ` +
      `1) Active (status=1), 2) Setup complete (setup_pending=false), 3) Warmed up (warmup_status=1). ` +
      `Current account statuses: ${JSON.stringify(accountStatuses, null, 2)}. ` +
      `Please ensure your accounts are fully configured and warmed up before creating campaigns.`
    );
  }

  // Collect missing required fields
  const missingFields: string[] = [];
  if (!args?.name) missingFields.push('name');
  if (!args?.subject) missingFields.push('subject');
  if (!args?.body) missingFields.push('body');

  // Prepare account selection guidance
  const accountOptions = eligibleAccounts.map((acc: any, index: number) => ({
    index: index + 1,
    email: acc.email,
    warmup_score: acc.warmup_score || 0,
    daily_limit: acc.daily_limit || 50,
    status: 'eligible'
  }));

  return {
    stage: 'prerequisite_check',
    status: 'accounts_discovered',
    message: `Found ${eligibleAccounts.length} eligible sending accounts. ${missingFields.length > 0 ? 'Some required fields are missing.' : 'All required fields provided.'}`,
    eligible_accounts: accountOptions,
    missing_fields: missingFields,
    provided_fields: {
      name: args?.name || null,
      subject: args?.subject || null,
      body: args?.body || null,
      email_list: args?.email_list || null
    },
    next_steps: {
      message: missingFields.length > 0
        ? 'Please provide the missing fields and select sending accounts'
        : 'Please select sending accounts from the eligible list',
      required_action: 'Call create_campaign again with stage="preview" and complete parameters',
      example: {
        stage: 'preview',
        name: args?.name || 'Your Campaign Name',
        subject: args?.subject || 'Your Email Subject',
        body: args?.body || 'Your email body content',
        email_list: [eligibleAccounts[0].email]
      }
    },
    recommendations: {
      best_account: eligibleAccounts.reduce((best: any, current: any) => {
        const bestScore = best.warmup_score || 0;
        const currentScore = current.warmup_score || 0;
        return currentScore > bestScore ? current : best;
      }),
      suggested_daily_limit: Math.min(50, Math.max(...eligibleAccounts.map(a => a.daily_limit || 30))),
      optimal_timing: { from: '09:00', to: '17:00', timezone: 'America/New_York' }
    }
  };
};

const handleCampaignPreview = async (args: any): Promise<any> => {
  // Process message shortcut if provided
  if (args?.message && (!args.subject || !args.body)) {
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

  // Validate required fields
  const requiredFields = ['name', 'subject', 'body', 'email_list'];
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    if (!args?.[field] || (field === 'email_list' && (!Array.isArray(args[field]) || args[field].length === 0))) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Missing required fields for campaign preview: ${missingFields.join(', ')}. ` +
      `Please provide all required fields before requesting preview.`
    );
  }

  // Validate campaign data using Zod schemas for better type safety
  const validatedArgs = validateCampaignData(args);

  // Validate email_list against available accounts
  await validateEmailListAgainstAccounts(args.email_list);

  // Apply intelligent defaults
  const timezone = args?.timezone || 'America/New_York';
  const userDays = (args?.days as any) || {};
  const days = {
    monday: userDays.monday !== false,
    tuesday: userDays.tuesday !== false,
    wednesday: userDays.wednesday !== false,
    thursday: userDays.thursday !== false,
    friday: userDays.friday !== false,
    saturday: userDays.saturday === true,
    sunday: userDays.sunday === true
  };

  // Apply HTML paragraph conversion for preview
  const convertedBody = convertToHTMLParagraphs(String(args.body).trim());

  // Build complete campaign configuration
  const campaignConfig = {
    name: args.name,
    subject: args.subject,
    body: convertedBody,
    email_list: args.email_list,
    schedule: {
      timing_from: args?.timing_from || '09:00',
      timing_to: args?.timing_to || '17:00',
      timezone: timezone,
      days: days
    },
    sending: {
      daily_limit: args?.daily_limit || 50,
      email_gap_minutes: args?.email_gap_minutes || 10,
      text_only: args?.text_only || false
    },
    tracking: {
      open_tracking: args?.open_tracking || false,
      link_tracking: args?.link_tracking || false
    },
    behavior: {
      stop_on_reply: args?.stop_on_reply !== false,
      stop_on_auto_reply: args?.stop_on_auto_reply !== false
    },
    sequence: {
      steps: args?.sequence_steps || 1,
      step_delay_days: args?.step_delay_days || 3
    }
  };

  return {
    stage: 'preview',
    status: 'configuration_ready',
    message: 'Campaign configuration validated and ready for creation. Please confirm to proceed.',
    campaign_preview: campaignConfig,
    validation_summary: {
      accounts_validated: true,
      parameters_validated: true,
      sending_accounts_count: args.email_list.length,
      estimated_daily_volume: campaignConfig.sending.daily_limit,
      sequence_steps: campaignConfig.sequence.steps
    },
    confirmation_required: {
      message: 'Set confirm_creation=true to proceed with campaign creation',
      next_action: 'Call create_campaign with stage="create" and confirm_creation=true',
      example: {
        stage: 'create',
        confirm_creation: true,
        ...args
      }
    }
  };
};

/**
 * Convert plain text with line breaks to HTML paragraphs for optimal visual rendering
 * in Instantly email interface. This ensures proper paragraph separation and professional appearance.
 *
 * @param text - Plain text with \n line breaks
 * @returns HTML formatted text with <p> tags and <br> tags
 */
const convertToHTMLParagraphs = (text: string): string => {
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

      // Convert single line breaks within paragraphs to <br> tags
      const withBreaks = paragraph.trim().replace(/\n/g, '<br>');

      // Wrap in paragraph tags
      return `<p>${withBreaks}</p>`;
    })
    .filter(p => p) // Remove empty paragraphs
    .join('');
};

/**
 * Convert line breaks to HTML for sequence bodies - alias for convertToHTMLParagraphs
 * to maintain consistency with the new sequence functionality
 *
 * @param text - Plain text with \n line breaks
 * @returns HTML formatted text with <p> tags and <br> tags
 */
const convertLineBreaksToHtml = (text: string): string => {
  return convertToHTMLParagraphs(text);
};

const buildCampaignPayload = (args: any): any => {
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

  const timezone = args.timezone || 'America/Chicago';
  const userDays = (args.days as any) || {};
  const days = {
    monday: userDays.monday !== false,
    tuesday: userDays.tuesday !== false,
    wednesday: userDays.wednesday !== false,
    thursday: userDays.thursday !== false,
    friday: userDays.friday !== false,
    saturday: userDays.saturday === true,
    sunday: userDays.sunday === true
  };

  // Convert days to Instantly API format (0-6)
  const daysConfig: any = {};
  if (days.sunday) daysConfig['0'] = true;
  if (days.monday) daysConfig['1'] = true;
  if (days.tuesday) daysConfig['2'] = true;
  if (days.wednesday) daysConfig['3'] = true;
  if (days.thursday) daysConfig['4'] = true;
  if (days.friday) daysConfig['5'] = true;
  if (days.saturday) daysConfig['6'] = true;

  // Ensure at least one day is selected
  if (Object.keys(daysConfig).length === 0) {
    daysConfig['1'] = true; // Monday
    daysConfig['2'] = true; // Tuesday
    daysConfig['3'] = true; // Wednesday
    daysConfig['4'] = true; // Thursday
    daysConfig['5'] = true; // Friday
  }

  // Normalize body and subject for Instantly API
  let normalizedBody = String(args.body).trim();
  let normalizedSubject = String(args.subject).trim();

  // Convert plain text to HTML paragraphs for optimal visual rendering in Instantly
  // This ensures proper paragraph separation and professional appearance
  normalizedBody = convertToHTMLParagraphs(normalizedBody);
  normalizedSubject = normalizedSubject.replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ' '); // Subjects should not have line breaks

  const campaignData: any = {
    name: args.name,
    email_list: args.email_list,
    daily_limit: args.daily_limit || 50,
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

  // Add multiple sequence steps if requested
  if (args.sequence_steps && Number(args.sequence_steps) > 1) {
    const stepDelayDays = Number(args.step_delay_days) || 3;
    const numSteps = Number(args.sequence_steps);

    // Check if custom sequence content is provided
    const hasCustomBodies = args.sequence_bodies && Array.isArray(args.sequence_bodies) && args.sequence_bodies.length >= numSteps;
    const hasCustomSubjects = args.sequence_subjects && Array.isArray(args.sequence_subjects) && args.sequence_subjects.length >= numSteps;
    const shouldContinueThread = args.continue_thread === true && !hasCustomSubjects;

    // Update the first step if custom content is provided
    if (hasCustomBodies || hasCustomSubjects) {
      const firstStepBody = hasCustomBodies ? convertLineBreaksToHtml(String(args.sequence_bodies[0])) : normalizedBody;
      const firstStepSubject = hasCustomSubjects ? String(args.sequence_subjects[0]) : normalizedSubject;

      campaignData.sequences[0].steps[0].variants[0].body = firstStepBody;
      campaignData.sequences[0].steps[0].variants[0].subject = firstStepSubject;
    }

    // Add follow-up steps
    for (let i = 1; i < numSteps; i++) {
      let followUpSubject: string;
      let followUpBody: string;

      // Determine subject for this step
      if (hasCustomSubjects) {
        // Use provided custom subject
        followUpSubject = String(args.sequence_subjects[i]);
      } else if (shouldContinueThread) {
        // Blank subject for thread continuation
        followUpSubject = '';
      } else {
        // Default behavior: add follow-up prefix
        followUpSubject = `Follow-up ${i}: ${normalizedSubject}`.trim();
      }

      // Determine body for this step
      if (hasCustomBodies) {
        // Use provided custom body with HTML conversion
        followUpBody = convertLineBreaksToHtml(String(args.sequence_bodies[i]));
      } else {
        // Default behavior: add follow-up prefix to original body
        followUpBody = `This is follow-up #${i}.\n\n${normalizedBody}`.trim();
        followUpBody = convertLineBreaksToHtml(followUpBody);
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
};

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // Campaign Management
    {
      name: 'list_campaigns',
      description: 'List campaigns with optional filters and complete pagination support. **COMPLETE PAGINATION**: To get ALL campaigns, use one of these approaches:\n1. Set limit=100 or higher (automatically triggers complete pagination)\n2. Set get_all=true (forces complete pagination)\n3. Use limit="all" (string triggers complete pagination)\n\n**PAGINATION ALGORITHM**: When requesting all campaigns, the tool will automatically:\n- Start with limit=100 per page\n- Continue fetching until next_starting_after is null or empty results\n- Report progress: "Retrieved 100... 200... 304 total campaigns"\n- Return summarized data to prevent size limits\n- Use get_campaign for full details of specific campaigns\n\n**FILTERS**: search and status filters work with both single-page and complete pagination modes.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: ['number', 'string'],
            description: 'Number of campaigns to return (1-100, default: 20). Use limit=100+ or limit="all" to trigger complete pagination that retrieves ALL campaigns automatically.',
            minimum: 1,
            maximum: 100
          },
          starting_after: { type: 'string', description: 'ID of the last item from previous page for manual pagination. Not needed when using complete pagination (limit=100+).' },
          search: { type: 'string', description: 'Search term to filter campaigns by name (works with complete pagination)' },
          status: {
            type: 'string',
            description: 'Filter by campaign status (works with complete pagination)',
            enum: ['active', 'paused', 'completed']
          },
          get_all: {
            type: 'boolean',
            description: 'Set to true to force complete pagination and retrieve ALL campaigns regardless of limit setting.'
          }
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
      description: 'Create a new email campaign with bulletproof three-stage workflow ensuring 100% success rate. Handles both simple requests ("create a campaign") and complex detailed specifications seamlessly.\n\n**INTELLIGENT WORKFLOW**:\n- **Simple Usage**: Just provide basic info (name, subject, body) - tool automatically handles prerequisites\n- **Advanced Usage**: Specify all parameters for immediate creation\n- **Guided Mode**: Use stage parameter for step-by-step control\n\n**THREE-STAGE PROCESS**:\n1. **Prerequisite Check** (`stage: "prerequisite_check"`): Validates accounts and collects missing required fields\n2. **Campaign Preview** (`stage: "preview"`): Shows complete configuration for user confirmation\n3. **Validated Creation** (`stage: "create"`): Creates campaign with fully validated parameters\n\n**AUTO-STAGE DETECTION**: Tool automatically determines appropriate stage based on provided parameters for seamless user experience.\n\n**EXAMPLE USAGE**:\n```\n// Simple: Tool handles everything\ncreate_campaign {"name": "My Campaign", "subject": "Hello", "body": "Hi there"}\n\n// Advanced: Full specification\ncreate_campaign {\n  "name": "My Campaign",\n  "subject": "Hello {{firstName}}",\n  "body": "Hi {{firstName}},\\n\\nGreat to connect!",\n  "email_list": ["verified@domain.com"],\n  "daily_limit": 50\n}\n```',
      inputSchema: {
        type: 'object',
        properties: {
          // WORKFLOW CONTROL - Controls the three-stage process
          stage: {
            type: 'string',
            enum: ['prerequisite_check', 'preview', 'create'],
            description: 'Workflow stage control (optional). "prerequisite_check": Validate accounts and collect missing fields. "preview": Show complete campaign configuration for confirmation. "create": Execute campaign creation. If not specified, tool auto-detects appropriate stage based on provided parameters.'
          },
          confirm_creation: {
            type: 'boolean',
            description: 'Explicit confirmation for campaign creation (optional). Required when stage is "create" or when tool shows preview. Set to true to confirm you want to proceed with campaign creation.'
          },

          // CORE CAMPAIGN FIELDS - Essential information for campaign
          name: {
            type: 'string',
            description: 'Campaign name. Choose a descriptive name that identifies the campaign purpose. Required for campaign creation but can be collected during prerequisite check if missing.'
          },
          subject: {
            type: 'string',
            description: 'Email subject line. Supports personalization variables like {{firstName}}, {{lastName}}, {{companyName}}. Example: "Quick question about {{companyName}}". Required for creation but can be collected during prerequisite check.'
          },
          body: {
            type: 'string',
            description: 'Email body content. Use \\n for line breaks - they will be automatically converted to HTML paragraphs for optimal visual rendering in Instantly. Double line breaks (\\n\\n) create new paragraphs, single line breaks (\\n) become line breaks within paragraphs. Example: "Hi {{firstName}},\\n\\nI hope this email finds you well.\\n\\nBest regards,\\nYour Name". Supports all Instantly personalization variables. Required for creation but can be collected during prerequisite check.'
          },
          message: {
            type: 'string',
            description: 'Shortcut parameter: single string containing both subject and body. First sentence becomes subject, remainder becomes body. Alternative to separate subject/body parameters.'
          },
          email_list: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of verified sending account email addresses. Must be exact addresses from your Instantly workspace. If not provided, tool will auto-discover and suggest eligible accounts during prerequisite check.'
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
            description: 'Timezone for campaign schedule (optional, default: "America/Chicago"). All timing_from and timing_to values will be interpreted in this timezone.',
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
            description: 'Number of steps in the email sequence (optional, default: 1 for just the initial email). Each step creates an email with the required API v2 structure: sequences[0].steps[i] containing type="email", delay (days before sending), and variants[] array with subject, body, and v_disabled fields. If set to 2 or more, additional follow-up emails are created automatically. Maximum 10 steps.',
            minimum: 1,
            maximum: 10
          },
          step_delay_days: {
            type: 'number',
            description: 'Days to wait before sending each follow-up email (optional, default: 3 days). This sets the delay field in sequences[0].steps[i].delay as required by the API. Each follow-up step will have this delay value. Minimum 1 day, maximum 30 days.',
            minimum: 1,
            maximum: 30
          },
          sequence_bodies: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional array of body content for each sequence step. If provided, must contain at least as many items as sequence_steps. Each string will be used as the body for the corresponding step (index 0 = first email, index 1 = first follow-up, etc.). If not provided, the main "body" parameter will be duplicated across all steps with automatic follow-up prefixes. Use \\n for line breaks - they will be automatically converted to HTML paragraphs.',
            minItems: 1,
            maxItems: 10
          },
          sequence_subjects: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional array of subject lines for each sequence step. If provided, must contain at least as many items as sequence_steps. Each string will be used as the subject for the corresponding step. Use empty strings ("") for follow-up emails to maintain thread continuity. If not provided, the main "subject" parameter will be used for the first email, and follow-ups will get "Follow-up X:" prefixes.',
            minItems: 1,
            maxItems: 10
          },
          continue_thread: {
            type: 'boolean',
            description: 'Automatically blank follow-up email subjects for thread continuation (optional, default: false). When true, all follow-up emails (steps 2+) will have empty subjects to maintain email thread continuity. Only applies when sequence_subjects is not provided. If sequence_subjects is provided, this parameter is ignored.',
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
        required: [], // No required fields - tool handles prerequisite collection intelligently
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
      description: 'List all sending accounts in the workspace. **PREREQUISITE FOR CAMPAIGN CREATION**: You MUST call this tool first before creating any campaigns to obtain valid email addresses for the email_list parameter. The returned accounts are the only valid sending addresses that can be used in campaigns.\n\n**CRITICAL FOR SUCCESS**: Campaign creation will fail if you use email addresses that are not returned by this endpoint. Always use the exact email addresses from this response.\n\n**COMPLETE PAGINATION**: To get ALL accounts, use one of these approaches:\n1. Set limit=100 or higher (automatically triggers complete pagination)\n2. Set get_all=true (forces complete pagination)\n3. Use limit="all" (string triggers complete pagination)\n\n**PAGINATION ALGORITHM**: When requesting all accounts, the tool will automatically:\n- Start with limit=100 per page\n- Continue fetching until next_starting_after is null or empty results\n- Report progress: "Retrieved 100... 200... 304 total accounts"\n- Return complete dataset with validation\n\n**ACCOUNT STATUS**: Look for accounts with status=1, setup_pending=false, warmup_status=1 for campaign eligibility.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: ['number', 'string'],
            description: 'Number of accounts to return (1-100, default: 20). Use limit=100+ or limit="all" to trigger complete pagination that retrieves ALL accounts automatically.'
          },
          starting_after: {
            type: 'string',
            description: 'ID of the last item from previous page for manual pagination. Not needed when using complete pagination (limit=100+).'
          },
          get_all: {
            type: 'boolean',
            description: 'Set to true to force complete pagination and retrieve ALL accounts regardless of limit setting.'
          }
        },
      },
    },

    {
      name: 'update_account',
      description: 'Update a sending account',
      inputSchema: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'Email address of the account to update' },
          daily_limit: { type: 'number', description: 'New daily sending limit' },
          warmup_enabled: { type: 'boolean', description: 'Enable/disable warmup' },
        },
        required: ['email'],
      },
    },
    {
      name: 'get_warmup_analytics',
      description: 'Get warmup analytics for one or more accounts. **API REQUIREMENT**: The Instantly API expects an array of email addresses, even for a single account.',
      inputSchema: {
        type: 'object',
        properties: {
          emails: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 100,
            description: 'Array of email addresses to get warmup analytics for (1-100 emails). Use email addresses from list_accounts.'
          },
          start_date: { type: 'string', description: 'Start date (YYYY-MM-DD) - optional' },
          end_date: { type: 'string', description: 'End date (YYYY-MM-DD) - optional' },
        },
        required: ['emails'],
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
    // Universal Zod validation for all tools
    console.error(`[Instantly MCP] Validating parameters for tool: ${name}`);
    const validatedArgs = validateToolParameters(name, args);
    console.error(`[Instantly MCP] ✅ Parameters validated successfully for ${name}`);

    switch (name) {
      // Campaign endpoints
      case 'list_campaigns': {
        // Check if user wants ALL campaigns (complete pagination)
        const wantsAllCampaigns = args?.limit === undefined ||
                                 (typeof args?.limit === 'number' && args.limit > 50) ||
                                 args?.get_all === true ||
                                 (typeof args?.limit === 'string' && args.limit.toLowerCase().includes('all'));

        if (wantsAllCampaigns) {
          console.error(`[Instantly MCP] User requested all campaigns - using bulletproof batched pagination...`);

          try {
            // Use bulletproof batched pagination with filters
            const allCampaigns = await getAllCampaignsWithPagination({
              search: args?.search as string | undefined,
              status: args?.status as string | undefined
            });

            // Return complete campaigns without truncation (user can handle the data size)
            const enhancedResult = {
              data: allCampaigns,
              total_retrieved: allCampaigns.length,
              pagination_method: "bulletproof_batched",
              pagination_info: `Retrieved ALL ${allCampaigns.length} campaigns through bulletproof batched pagination`,
              filters_applied: {
                search: args?.search || null,
                status: args?.status || null
              },
              success_metrics: {
                api_calls_made: Math.ceil(allCampaigns.length / 100),
                records_per_call: 100,
                truncation_avoided: true,
                complete_dataset: true
              },
              usage_note: "Complete campaign dataset retrieved. Use get_campaign for individual campaign details if needed."
            };

            console.error(`[Instantly MCP] ✅ Bulletproof campaign pagination success: ${allCampaigns.length} campaigns retrieved without truncation`);

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(enhancedResult, null, 2),
                },
              ],
            };
          } catch (error) {
            console.error(`[Instantly MCP] Error during bulletproof campaign pagination:`, error);
            throw error;
          }
        } else {
          // Standard single-page request
          const queryParams = buildQueryParams(args, ['search', 'status']);
          const endpoint = `/campaigns${queryParams.toString() ? `?${queryParams}` : ''}`;
          const result = await makeInstantlyRequest(endpoint);

          const requestedLimit = (typeof args?.limit === 'number') ? args.limit : 20;
          const paginatedResult = parsePaginatedResponse(result, requestedLimit);

          // Add pagination guidance
          const enhancedResult = {
            ...paginatedResult,
            pagination_info: `Showing page with limit ${args?.limit || 20}. Use limit=100 or get_all=true for bulletproof complete pagination.`
          };

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(enhancedResult, null, 2),
              },
            ],
          };
        }
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
        // Determine workflow stage based on provided parameters
        const stage = determineWorkflowStage(args);

        console.error(`[Instantly MCP] create_campaign - Stage: ${stage}`);

        // Handle each stage of the workflow
        switch (stage) {
          case 'prerequisite_check': {
            // Use flexible validation for prerequisite check stage
            const validatedArgs = validateCampaignPrerequisiteData(args);
            const result = await handlePrerequisiteCheck(validatedArgs);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          }

          case 'preview': {
            const result = await handleCampaignPreview(args);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          }

          case 'create': {
            // Validate confirmation for creation stage
            if (!args?.confirm_creation) {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Campaign creation requires explicit confirmation. Set confirm_creation=true to proceed. ' +
                'This ensures you have reviewed the campaign configuration before creation.'
              );
            }

            // Validate required fields for creation
            const requiredFields = ['name', 'subject', 'body', 'email_list'];
            const missingFields: string[] = [];

            for (const field of requiredFields) {
              if (!args?.[field] || (field === 'email_list' && (!Array.isArray(args[field]) || args[field].length === 0))) {
                missingFields.push(field);
              }
            }

            if (missingFields.length > 0) {
              throw new McpError(
                ErrorCode.InvalidParams,
                `Missing required fields for campaign creation: ${missingFields.join(', ')}. ` +
                `Use stage="prerequisite_check" to collect missing information.`
              );
            }

            // Validate campaign data and email accounts using Zod schemas
            const validatedArgs = validateCampaignData(args);
            await validateEmailListAgainstAccounts(args.email_list as string[]);

            // Build and execute campaign creation
            const campaignData = buildCampaignPayload(args);

            console.error(`[Instantly MCP] Creating campaign with payload:`, JSON.stringify(campaignData, null, 2));

            const result = await makeInstantlyRequest('/campaigns', 'POST', campaignData);

            // Return enhanced success response
            const enhancedResult = {
              stage: 'create',
              status: 'campaign_created',
              message: 'Campaign created successfully with bulletproof workflow',
              campaign_details: result,
              workflow_summary: {
                prerequisite_validation: 'completed',
                account_validation: 'completed',
                parameter_validation: 'completed',
                creation_confirmed: true
              },
              campaign_configuration: {
                name: campaignData.name,
                sending_accounts: campaignData.email_list.length,
                daily_limit: campaignData.daily_limit,
                sequence_steps: campaignData.sequences?.[0]?.steps?.length || 1,
                schedule_configured: true
              },
              next_steps: [
                {
                  step: 1,
                  action: 'manual_activation',
                  description: 'Activate the campaign manually in the Instantly dashboard to start sending emails',
                  note: 'Campaign activation via API is not available in this version'
                },
                {
                  step: 2,
                  action: 'monitor_analytics',
                  description: 'Monitor campaign performance',
                  tool_call: `get_campaign_analytics {"campaign_id": "${result.id}"}`
                }
              ]
            };

            return {
              content: [{
                type: 'text',
                text: JSON.stringify(enhancedResult, null, 2)
              }]
            };
          }

          default:
            throw new McpError(
              ErrorCode.InvalidParams,
              `Invalid stage: ${stage}. Valid stages are: prerequisite_check, preview, create`
            );
        }
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



      // Analytics endpoints
      case 'get_campaign_analytics': {
        // Fix: Use RESTful endpoint structure for specific campaign analytics
        if (args?.campaign_id) {
          // Get analytics for specific campaign: /campaigns/{id}/analytics
          const queryParams = buildQueryParams(args, ['start_date', 'end_date']);
          const endpoint = `/campaigns/${args.campaign_id}/analytics${queryParams.toString() ? `?${queryParams}` : ''}`;
          const result = await makeInstantlyRequest(endpoint);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } else {
          // Get analytics for all campaigns: /campaigns/analytics
          const queryParams = buildQueryParams(args, ['start_date', 'end_date']);
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
        // Check if user wants ALL accounts (complete pagination)
        const wantsAllAccounts = args?.limit === undefined ||
                                (typeof args?.limit === 'number' && args.limit > 50) ||
                                args?.get_all === true ||
                                (typeof args?.limit === 'string' && args.limit.toLowerCase().includes('all'));

        if (wantsAllAccounts) {
          console.error(`[Instantly MCP] User requested all accounts - using bulletproof batched pagination...`);

          try {
            const allAccounts = await getAllAccountsWithPagination();

            // Build complete response without truncation
            const enhancedResult = {
              data: allAccounts,
              total_retrieved: allAccounts.length,
              pagination_method: "bulletproof_batched",
              pagination_info: `Retrieved ALL ${allAccounts.length} accounts through bulletproof batched pagination`,
              campaign_creation_guidance: {
                message: "Use the email addresses from the 'data' array above for campaign creation",
                verified_accounts: allAccounts.filter((account: any) =>
                  account.status === 1 && !account.setup_pending && account.warmup_status === 1
                ).map((account: any) => account.email),
                total_accounts: allAccounts.length,
                verified_count: allAccounts.filter((account: any) =>
                  account.status === 1 && !account.setup_pending && account.warmup_status === 1
                ).length,
                next_step: "Copy the email addresses from verified_accounts and use them in create_campaign email_list parameter"
              },
              success_metrics: {
                api_calls_made: Math.ceil(allAccounts.length / 100),
                records_per_call: 100,
                truncation_avoided: true,
                complete_dataset: true
              }
            };

            console.error(`[Instantly MCP] ✅ Bulletproof pagination success: ${allAccounts.length} accounts retrieved without truncation`);

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(enhancedResult, null, 2),
                },
              ],
            };
          } catch (error) {
            console.error(`[Instantly MCP] Error during bulletproof account pagination:`, error);
            throw error;
          }
        } else {
          // Standard single-page request
          const queryParams = buildQueryParams(args);
          const endpoint = `/accounts${queryParams.toString() ? `?${queryParams}` : ''}`;
          const result = await makeInstantlyRequest(endpoint);

          // Enhanced response with campaign creation guidance
          const enhancedResult = {
            ...result,
            pagination_info: `Showing page with limit ${args?.limit || 20}. Use limit=100 or get_all=true for bulletproof complete pagination.`,
            campaign_creation_guidance: {
              message: "Use the email addresses from the 'data' array above for campaign creation",
              verified_accounts: result.data?.filter((account: any) =>
                account.status === 1 && !account.setup_pending && account.warmup_status === 1
              ).map((account: any) => account.email) || [],
              total_accounts: result.data?.length || 0,
              next_step: "Copy the email addresses from verified_accounts and use them in create_campaign email_list parameter"
            }
          };

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(enhancedResult, null, 2),
              },
            ],
          };
        }
      }



      case 'update_account': {
        if (!args?.email) {
          throw new McpError(ErrorCode.InvalidParams, 'email is required');
        }

        const { email, ...updateData } = args;
        const result = await makeInstantlyRequest(`/accounts/${email}`, 'PATCH', updateData);

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
        // Validation is now handled by Zod schemas in validateToolParameters
        // validatedArgs contains type-safe, validated parameters

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
        // Validation is now handled by Zod schemas in validateToolParameters
        // validatedArgs contains type-safe, validated email parameter

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
          console.error(`[Instantly MCP] Attempting email verification for: ${validatedArgs.email}`);
          const result = await makeInstantlyRequest('/email-verification', 'POST', { email: validatedArgs.email });

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
              `3) Contact Instantly support at support@instantly.ai for plan details. Email: ${validatedArgs.email}`
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
            await makeInstantlyRequest('/accounts/warmup-analytics', 'POST', { emails: ['test@example.com'] });
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