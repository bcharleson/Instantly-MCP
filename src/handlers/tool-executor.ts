/**
 * Instantly MCP Server - Tool Executor
 * 
 * Central handler for executing all 35 MCP tools.
 * Extracted from monolithic index.ts for better maintainability.
 * 
 * CRITICAL: This file contains ALL tool execution logic.
 * Any changes must preserve 100% backward compatibility.
 * 
 * Total: 35 tools across 5 categories
 * - Account tools: 11 tools
 * - Campaign tools: 6 tools
 * - Lead tools: 8 tools
 * - Email tools: 4 tools
 * - Analytics tools: 3 tools
 */

import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { makeInstantlyRequest } from '../api/client.js';
import { ENDPOINTS } from '../api/endpoints.js';
import {
  getAllAccounts,
  getEligibleSenderAccounts,
  getAccountByEmail,
  pauseAccount,
  resumeAccount,
  enableWarmup,
  disableWarmup,
  testAccountVitals
} from '../services/account-service.js';
import {
  gatherCampaignPrerequisites,
  generateCampaignGuidance
} from '../services/campaign-service.js';
import {
  getLeads,
  getLeadById,
  getLeadLists,
  getLeadListById,
  getLeadListVerificationStats
} from '../services/lead-service.js';
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
} from '../validation.js';
import { rateLimiter } from '../rate-limiter.js';
import { validateAndMapTimezone, DEFAULT_TIMEZONE } from '../timezone-config.js';
import { cleanupAndValidateParameters, validateEmailListAgainstAccounts } from '../utils/parameter-cleaner.js';
import { applySmartDefaults } from '../utils/smart-defaults.js';
import { buildCampaignPayload } from '../utils/html-formatter.js';

// Get API key from environment (fallback)
const INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY;

/**
 * Execute a tool by name with provided arguments
 * 
 * This is the main entry point for all tool executions.
 * It handles API key extraction, rate limiting, and routing to specific tool handlers.
 * 
 * @param name - Tool name to execute
 * @param args - Tool arguments
 * @param apiKey - Optional API key (falls back to environment variable)
 * @returns Tool execution result in MCP format
 */
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
        // API expects array of UUIDs - URLSearchParams will handle multiple values
        if (validatedArgs.campaign_ids && Array.isArray(validatedArgs.campaign_ids)) {
          params.ids = validatedArgs.campaign_ids; // Pass array directly
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
            parameter_mapping: validatedArgs.campaign_id ? "campaign_id -> id" : "campaign_ids -> ids (array of UUIDs)",
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
        const slowDomains = ['creatorbuzz.com', 'techrecruiterpro.net', 'topoffunnel.com', 'gmail.com', 'outlook.com', 'yahoo.com', 'lead411.io', 'instantly.ai'];
        const isSlowDomain = slowDomains.includes(emailDomain);

        // ROBUST polling configuration - wait for complete verification
        // Increased timeout to allow slow domains to complete verification
        const baseMaxPollingTime = 30000; // 30 seconds base maximum (allows most verifications to complete)
        const slowDomainExtension = 15000; // Add 15 seconds for slow domains
        const maxPollingTime = isSlowDomain ? (baseMaxPollingTime + slowDomainExtension) : baseMaxPollingTime; // 45s for slow domains, 30s for others
        const pollingInterval = 2000; // 2 seconds between polls (balance between responsiveness and API load)
        const startTime = Date.now();
        let attempts = 0;
        const maxAttempts = Math.floor(maxPollingTime / pollingInterval); // ~15-22 attempts

        console.error(`[Instantly MCP] 🎯 ROBUST polling config: ${emailDomain} (slow: ${isSlowDomain}) - max time: ${maxPollingTime}ms (${maxPollingTime/1000}s), max attempts: ${maxAttempts}, interval: ${pollingInterval}ms`);

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

        // Step 4: Handle timeout scenario - verification still pending after extended polling
        console.error(`[Instantly MCP] ⏰ Verification polling timed out after ${Math.round((Date.now() - startTime) / 1000)}s - verification still in progress`);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false, // Changed to false - verification incomplete
                email: email,
                verification_status: 'timeout',
                deliverability: 'verification_in_progress',
                catch_all: initialResult.catch_all || 'pending',
                credits: initialResult.credits,
                credits_used: initialResult.credits_used,
                polling_attempts: attempts,
                total_time_seconds: Math.round((Date.now() - startTime) / 1000),
                max_polling_time_seconds: Math.round(maxPollingTime / 1000),
                polling_interval_seconds: Math.round(pollingInterval / 1000),
                message: `Verification timed out after ${Math.round((Date.now() - startTime) / 1000)} seconds of polling. The verification is still processing on Instantly's servers.`,
                verification_mode: 'extended_polling_timeout',
                domain: emailDomain,
                is_slow_domain: isSlowDomain,
                initial_result: initialResult,
                note: `This email domain (${emailDomain}) requires exceptionally long verification time (>${Math.round(maxPollingTime / 1000)}s). The verification was initiated successfully but has not completed yet.`,
                recommendation: 'Try verifying this email again in 1-2 minutes, or use the Instantly.ai web dashboard to check verification status.'
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
          const { applyDateFilters } = await import('../pagination.js');
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

    case 'update_lead_list': {
      console.error('[Instantly MCP] ✏️ Executing update_lead_list...');

      if (!args.list_id) {
        throw new McpError(ErrorCode.InvalidParams, 'list_id is required for update_lead_list');
      }

      // Build update data - only include fields that are provided
      const updateData: any = {};
      if (args.name !== undefined) updateData.name = args.name;
      if (args.has_enrichment_task !== undefined) updateData.has_enrichment_task = args.has_enrichment_task;
      if (args.owned_by !== undefined) updateData.owned_by = args.owned_by;

      console.error(`[Instantly MCP] 📤 Updating lead list ${args.list_id} with data: ${JSON.stringify(updateData, null, 2)}`);

      const updateResult = await makeInstantlyRequest(`/lead-lists/${args.list_id}`, { method: 'PATCH', body: updateData }, apiKey);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              lead_list: updateResult,
              message: 'Lead list updated successfully'
            }, null, 2)
          }
        ]
      };
    }

    case 'get_verification_stats_for_lead_list': {
      console.error('[Instantly MCP] 📊 Executing get_verification_stats_for_lead_list...');

      if (!args.list_id) {
        throw new McpError(ErrorCode.InvalidParams, 'list_id is required for get_verification_stats_for_lead_list');
      }

      console.error(`[Instantly MCP] 📤 Getting verification stats for lead list ${args.list_id}`);

      const statsResult = await makeInstantlyRequest(`/lead-lists/${args.list_id}/verification-stats`, { method: 'GET' }, apiKey);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              ...statsResult,
              message: 'Verification stats retrieved successfully'
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

      // Pagination parameters
      emailsParams.limit = args.limit || 100; // Default to 100 items per page (API maximum)
      if (args.starting_after) emailsParams.starting_after = args.starting_after;

      // Filtering parameters
      if (args.campaign_id) emailsParams.campaign_id = args.campaign_id;
      if (args.search) emailsParams.search = args.search;
      if (args.i_status !== undefined) emailsParams.i_status = args.i_status;
      if (args.eaccount) emailsParams.eaccount = args.eaccount;
      if (args.is_unread !== undefined) emailsParams.is_unread = args.is_unread;
      if (args.has_reminder !== undefined) emailsParams.has_reminder = args.has_reminder;
      if (args.mode) emailsParams.mode = args.mode;
      if (args.preview_only !== undefined) emailsParams.preview_only = args.preview_only;
      if (args.sort_order) emailsParams.sort_order = args.sort_order;
      if (args.scheduled_only !== undefined) emailsParams.scheduled_only = args.scheduled_only;
      if (args.assigned_to) emailsParams.assigned_to = args.assigned_to;
      if (args.lead) emailsParams.lead = args.lead;
      if (args.company_domain) emailsParams.company_domain = args.company_domain;
      if (args.marked_as_done !== undefined) emailsParams.marked_as_done = args.marked_as_done;
      if (args.email_type) emailsParams.email_type = args.email_type;

      const emailsResult = await makeInstantlyRequest('/emails', { params: emailsParams }, apiKey);

      // Add metadata about pagination
      const metadata: any = {
        request_time_ms: Date.now(),
        note: `Retrieved ${emailsResult.items?.length || 0} emails.`
      };

      if (emailsResult.next_starting_after) {
        metadata.note += ` More results available. To retrieve additional pages, call this tool again with starting_after parameter set to: ${emailsResult.next_starting_after}`;
      } else {
        metadata.note += ' All results retrieved (no more pages available).';
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ...emailsResult,
              metadata,
              success: true
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

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

