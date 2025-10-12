/**
 * Instantly MCP Server - Lead Service
 * 
 * Business logic and helper functions for lead management.
 */

import { makeInstantlyRequest } from '../api/client.js';
import { ENDPOINTS } from '../api/endpoints.js';

/**
 * Get leads with pagination
 * 
 * @param apiKey - Instantly.ai API key
 * @param params - Query parameters (limit, starting_after, filters)
 * @returns Single page of leads with pagination metadata
 */
export async function getLeads(apiKey?: string, params?: any): Promise<any> {
  console.error('[Instantly MCP] 📊 Retrieving leads (sequential pagination)...');

  try {
    const startTime = Date.now();

    // Build query parameters
    const queryParams: any = {
      limit: params?.limit || 100,
    };

    // Add cursor if provided
    if (params?.starting_after) {
      queryParams.starting_after = params.starting_after;
      console.error(`[Instantly MCP] 📄 Fetching page with cursor: ${params.starting_after}`);
    }

    // Add filters
    if (params?.campaign) {
      queryParams.campaign = params.campaign;
    }
    if (params?.list_id) {
      queryParams.list_id = params.list_id;
    }
    if (params?.search) {
      queryParams.search = params.search;
    }
    if (params?.filter) {
      queryParams.filter = params.filter;
    }
    if (params?.distinct_contacts !== undefined) {
      queryParams.distinct_contacts = params.distinct_contacts;
    }

    // Make API call to /leads/list endpoint (POST request)
    const response = await makeInstantlyRequest(ENDPOINTS.LEADS_LIST, {
      method: 'POST',
      body: queryParams
    }, apiKey);

    const elapsed = Date.now() - startTime;

    // Extract data and pagination info
    const data = Array.isArray(response) ? response : (response.items || response.data || []);
    const nextCursor = response.next_starting_after || null;
    const hasMore = !!nextCursor;

    console.error(`[Instantly MCP] ✅ Retrieved ${data.length} leads in ${elapsed}ms (has_more: ${hasMore})`);

    return {
      data,
      pagination: {
        returned_count: data.length,
        has_more: hasMore,
        next_starting_after: nextCursor,
        limit: queryParams.limit
      },
      metadata: {
        request_time_ms: elapsed,
        success: true
      }
    };
  } catch (error) {
    console.error('[Instantly MCP] ❌ Error retrieving leads:', error);
    throw error;
  }
}

/**
 * Get lead by ID
 * 
 * @param leadId - Lead UUID
 * @param apiKey - Instantly.ai API key
 * @returns Lead details
 */
export async function getLeadById(leadId: string, apiKey?: string): Promise<any> {
  console.error(`[Instantly MCP] 🔍 Fetching lead: ${leadId}`);

  try {
    const response = await makeInstantlyRequest(ENDPOINTS.LEAD_BY_ID(leadId), {
      method: 'GET'
    }, apiKey);

    console.error(`[Instantly MCP] ✅ Retrieved lead: ${leadId}`);
    return response;
  } catch (error) {
    console.error(`[Instantly MCP] ❌ Error fetching lead ${leadId}:`, error);
    throw error;
  }
}

/**
 * Get lead lists with pagination
 * 
 * @param apiKey - Instantly.ai API key
 * @param params - Query parameters (limit, starting_after, filters)
 * @returns Single page of lead lists with pagination metadata
 */
export async function getLeadLists(apiKey?: string, params?: any): Promise<any> {
  console.error('[Instantly MCP] 📊 Retrieving lead lists (sequential pagination)...');

  try {
    const startTime = Date.now();

    // Build query parameters
    const queryParams: any = {
      limit: params?.limit || 100,
    };

    // Add cursor if provided
    if (params?.starting_after) {
      queryParams.starting_after = params.starting_after;
    }

    // Add filters
    if (params?.search) {
      queryParams.search = params.search;
    }
    if (params?.has_enrichment_task !== undefined) {
      queryParams.has_enrichment_task = params.has_enrichment_task;
    }

    // Make API call
    const response = await makeInstantlyRequest(ENDPOINTS.LEAD_LISTS, {
      method: 'GET',
      params: queryParams
    }, apiKey);

    const elapsed = Date.now() - startTime;

    // Extract data and pagination info
    const data = Array.isArray(response) ? response : (response.items || response.data || []);
    const nextCursor = response.next_starting_after || null;
    const hasMore = !!nextCursor;

    console.error(`[Instantly MCP] ✅ Retrieved ${data.length} lead lists in ${elapsed}ms (has_more: ${hasMore})`);

    return {
      data,
      pagination: {
        returned_count: data.length,
        has_more: hasMore,
        next_starting_after: nextCursor,
        limit: queryParams.limit
      },
      metadata: {
        request_time_ms: elapsed,
        success: true
      }
    };
  } catch (error) {
    console.error('[Instantly MCP] ❌ Error retrieving lead lists:', error);
    throw error;
  }
}

/**
 * Get lead list by ID
 * 
 * @param listId - Lead list UUID
 * @param apiKey - Instantly.ai API key
 * @returns Lead list details
 */
export async function getLeadListById(listId: string, apiKey?: string): Promise<any> {
  console.error(`[Instantly MCP] 🔍 Fetching lead list: ${listId}`);

  try {
    const response = await makeInstantlyRequest(ENDPOINTS.LEAD_LIST_BY_ID(listId), {
      method: 'GET'
    }, apiKey);

    console.error(`[Instantly MCP] ✅ Retrieved lead list: ${listId}`);
    return response;
  } catch (error) {
    console.error(`[Instantly MCP] ❌ Error fetching lead list ${listId}:`, error);
    throw error;
  }
}

/**
 * Get verification stats for a lead list
 * 
 * @param listId - Lead list UUID
 * @param apiKey - Instantly.ai API key
 * @returns Verification statistics
 */
export async function getLeadListVerificationStats(listId: string, apiKey?: string): Promise<any> {
  console.error(`[Instantly MCP] 📊 Fetching verification stats for lead list: ${listId}`);

  try {
    const response = await makeInstantlyRequest(ENDPOINTS.LEAD_LIST_VERIFICATION_STATS(listId), {
      method: 'GET'
    }, apiKey);

    console.error(`[Instantly MCP] ✅ Retrieved verification stats for lead list: ${listId}`);
    return response;
  } catch (error) {
    console.error(`[Instantly MCP] ❌ Error fetching verification stats for ${listId}:`, error);
    throw error;
  }
}

