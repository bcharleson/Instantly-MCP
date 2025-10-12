/**
 * Instantly MCP Server - Account Service
 * 
 * Business logic and helper functions for account management.
 */

import { makeInstantlyRequest } from '../api/client.js';
import { ENDPOINTS } from '../api/endpoints.js';

/**
 * Get all accounts with sequential pagination
 * 
 * Fetches ONE page at a time, allowing the LLM to control pagination.
 * 
 * @param apiKey - Instantly.ai API key
 * @param params - Query parameters (limit, starting_after, filters)
 * @returns Single page of accounts with pagination metadata
 */
export async function getAllAccounts(apiKey?: string, params?: any): Promise<any> {
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
    const response = await makeInstantlyRequest(ENDPOINTS.ACCOUNTS, {
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

/**
 * Get eligible sender accounts for campaign creation
 * 
 * Filters accounts to find those that are:
 * - Active (status = 1)
 * - Setup complete
 * - Warmup complete (warmup_status = 1)
 * 
 * @param apiKey - Instantly.ai API key
 * @returns List of eligible sender accounts
 */
export async function getEligibleSenderAccounts(apiKey?: string): Promise<any[]> {
  console.error('[Instantly MCP] 🔍 Finding eligible sender accounts...');

  try {
    // Fetch all accounts (we'll filter client-side for eligibility)
    const accountsResponse = await getAllAccounts(apiKey, { limit: 100 });
    const allAccounts = accountsResponse.data || [];

    // Filter for eligible accounts
    const eligibleAccounts = allAccounts.filter((account: any) => {
      const isActive = account.status === 1;
      const isSetupComplete = !account.setup_pending;
      const isWarmupComplete = account.warmup_status === 1;

      return isActive && isSetupComplete && isWarmupComplete;
    });

    console.error(`[Instantly MCP] ✅ Found ${eligibleAccounts.length} eligible accounts out of ${allAccounts.length} total`);

    return eligibleAccounts;
  } catch (error) {
    console.error('[Instantly MCP] ❌ Error finding eligible accounts:', error);
    throw error;
  }
}

/**
 * Get account details by email
 * 
 * @param email - Account email address
 * @param apiKey - Instantly.ai API key
 * @returns Account details
 */
export async function getAccountByEmail(email: string, apiKey?: string): Promise<any> {
  console.error(`[Instantly MCP] 🔍 Fetching account details for: ${email}`);

  try {
    const response = await makeInstantlyRequest(ENDPOINTS.ACCOUNT_BY_EMAIL(email), {
      method: 'GET'
    }, apiKey);

    console.error(`[Instantly MCP] ✅ Retrieved account details for: ${email}`);
    return response;
  } catch (error) {
    console.error(`[Instantly MCP] ❌ Error fetching account ${email}:`, error);
    throw error;
  }
}

/**
 * Pause an account
 * 
 * @param email - Account email address
 * @param apiKey - Instantly.ai API key
 * @returns Success response
 */
export async function pauseAccount(email: string, apiKey?: string): Promise<any> {
  console.error(`[Instantly MCP] ⏸️  Pausing account: ${email}`);

  try {
    const response = await makeInstantlyRequest(ENDPOINTS.ACCOUNT_PAUSE(email), {
      method: 'POST'
    }, apiKey);

    console.error(`[Instantly MCP] ✅ Account paused: ${email}`);
    return response;
  } catch (error) {
    console.error(`[Instantly MCP] ❌ Error pausing account ${email}:`, error);
    throw error;
  }
}

/**
 * Resume an account
 * 
 * @param email - Account email address
 * @param apiKey - Instantly.ai API key
 * @returns Success response
 */
export async function resumeAccount(email: string, apiKey?: string): Promise<any> {
  console.error(`[Instantly MCP] ▶️  Resuming account: ${email}`);

  try {
    const response = await makeInstantlyRequest(ENDPOINTS.ACCOUNT_RESUME(email), {
      method: 'POST'
    }, apiKey);

    console.error(`[Instantly MCP] ✅ Account resumed: ${email}`);
    return response;
  } catch (error) {
    console.error(`[Instantly MCP] ❌ Error resuming account ${email}:`, error);
    throw error;
  }
}

/**
 * Enable warmup for an account
 * 
 * @param email - Account email address
 * @param apiKey - Instantly.ai API key
 * @returns Success response
 */
export async function enableWarmup(email: string, apiKey?: string): Promise<any> {
  console.error(`[Instantly MCP] 🔥 Enabling warmup for account: ${email}`);

  try {
    const response = await makeInstantlyRequest(ENDPOINTS.WARMUP_ENABLE, {
      method: 'POST',
      body: { email }
    }, apiKey);

    console.error(`[Instantly MCP] ✅ Warmup enabled for: ${email}`);
    return response;
  } catch (error) {
    console.error(`[Instantly MCP] ❌ Error enabling warmup for ${email}:`, error);
    throw error;
  }
}

/**
 * Disable warmup for an account
 * 
 * @param email - Account email address
 * @param apiKey - Instantly.ai API key
 * @returns Success response
 */
export async function disableWarmup(email: string, apiKey?: string): Promise<any> {
  console.error(`[Instantly MCP] ❄️  Disabling warmup for account: ${email}`);

  try {
    const response = await makeInstantlyRequest(ENDPOINTS.WARMUP_DISABLE, {
      method: 'POST',
      body: { email }
    }, apiKey);

    console.error(`[Instantly MCP] ✅ Warmup disabled for: ${email}`);
    return response;
  } catch (error) {
    console.error(`[Instantly MCP] ❌ Error disabling warmup for ${email}:`, error);
    throw error;
  }
}

/**
 * Test account vitals (connectivity check)
 * 
 * @param email - Account email address
 * @param apiKey - Instantly.ai API key
 * @returns Vitals test results
 */
export async function testAccountVitals(email: string, apiKey?: string): Promise<any> {
  console.error(`[Instantly MCP] 🏥 Testing account vitals for: ${email}`);

  try {
    const response = await makeInstantlyRequest(ENDPOINTS.ACCOUNT_VITALS, {
      method: 'POST',
      body: { email }
    }, apiKey);

    console.error(`[Instantly MCP] ✅ Account vitals tested for: ${email}`);
    return response;
  } catch (error) {
    console.error(`[Instantly MCP] ❌ Error testing vitals for ${email}:`, error);
    throw error;
  }
}

