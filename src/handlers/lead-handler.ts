/**
 * Lead Handler - Dedicated handler for all lead-related MCP tools
 * 
 * This module contains all lead and lead list operations, extracted from tool-executor.ts
 * for better code organization and maintainability.
 * 
 * Follows the thin wrapper philosophy: minimal opinionated logic, direct API mapping.
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { makeInstantlyRequest } from '../api/client.js';
import { ENDPOINTS } from '../api/endpoints.js';

/**
 * Handle all lead-related tool executions
 * @param toolName - Name of the tool to execute
 * @param args - Tool arguments
 * @param apiKey - Instantly.ai API key
 * @returns Tool execution result
 */
export async function handleLeadTool(toolName: string, args: any, apiKey: string) {
  switch (toolName) {
    case 'list_leads':
      return handleListLeads(args, apiKey);
    
    case 'get_lead':
      return handleGetLead(args, apiKey);
    
    case 'create_lead':
      return handleCreateLead(args, apiKey);
    
    case 'update_lead':
      return handleUpdateLead(args, apiKey);
    
    case 'delete_lead':
      return handleDeleteLead(args, apiKey);
    
    case 'add_leads_to_campaign_or_list_bulk':
      return handleBulkAddLeads(args, apiKey);
    
    case 'move_leads_to_campaign_or_list':
      return handleMoveLeads(args, apiKey);
    
    case 'list_lead_lists':
      return handleListLeadLists(args, apiKey);
    
    case 'create_lead_list':
      return handleCreateLeadList(args, apiKey);
    
    case 'update_lead_list':
      return handleUpdateLeadList(args, apiKey);
    
    case 'get_verification_stats_for_lead_list':
      return handleGetVerificationStats(args, apiKey);
    
    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown lead tool: ${toolName}`);
  }
}

/**
 * List leads with pagination and filtering
 */
async function handleListLeads(args: any, apiKey: string) {
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

  // Warn user if search query is present (can be slow)
  if (requestBody.search) {
    console.error(`[Instantly MCP] ⚠️  Search query detected: "${requestBody.search}"`);
    console.error(`[Instantly MCP] ⏱️  Search operations can take 60-120 seconds on large lead databases`);
    console.error(`[Instantly MCP] 💡 Tip: Use campaign or list_id filters to narrow results and improve performance`);
  }

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

    // Client-side filtering for created_after and created_before
    if (args?.created_after || args?.created_before) {
      const originalCount = leads.length;
      
      if (args.created_after) {
        const afterDate = new Date(args.created_after);
        leads = leads.filter((lead: any) => {
          const createdDate = new Date(lead.timestamp_created);
          return createdDate >= afterDate;
        });
        filtersApplied.created_after = args.created_after;
      }
      
      if (args.created_before) {
        const beforeDate = new Date(args.created_before);
        leads = leads.filter((lead: any) => {
          const createdDate = new Date(lead.timestamp_created);
          return createdDate <= beforeDate;
        });
        filtersApplied.created_before = args.created_before;
      }
      
      console.error(`[Instantly MCP] 🔍 Client-side date filtering: ${originalCount} → ${leads.length} leads`);
    }

    // Client-side filtering for status
    if (args?.status) {
      const originalCount = leads.length;
      leads = leads.filter((lead: any) => lead.status === args.status);
      filtersApplied.status = args.status;
      console.error(`[Instantly MCP] 🔍 Client-side status filtering: ${originalCount} → ${leads.length} leads`);
    }

    const response: any = {
      success: true,
      leads: leads,
      total_returned: leads.length,
      pagination: {
        next_starting_after: result.next_starting_after || null,
        has_more: !!result.next_starting_after
      },
      message: 'Leads retrieved successfully'
    };

    if (Object.keys(filtersApplied).length > 0) {
      response.client_side_filters_applied = filtersApplied;
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[Instantly MCP] ❌ Request failed after ${elapsed}ms: ${error.message}`);
    throw error;
  }
}

/**
 * Get a single lead by ID
 */
async function handleGetLead(args: any, apiKey: string) {
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

/**
 * Create a new lead
 */
async function handleCreateLead(args: any, apiKey: string) {
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

/**
 * Update an existing lead
 */
async function handleUpdateLead(args: any, apiKey: string) {
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

/**
 * Delete a lead permanently
 */
async function handleDeleteLead(args: any, apiKey: string) {
  console.error('[Instantly MCP] 🗑️ Executing delete_lead...');

  if (!args.lead_id) {
    throw new McpError(ErrorCode.InvalidParams, 'lead_id is required for delete_lead');
  }

  console.error(`[Instantly MCP] ⚠️ DELETING lead ${args.lead_id} - THIS CANNOT BE UNDONE`);

  const deleteResult = await makeInstantlyRequest(`/leads/${args.lead_id}`, { method: 'DELETE' }, apiKey);

  console.error(`[Instantly MCP] ✅ Lead ${args.lead_id} deleted successfully`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          deleted_lead: deleteResult,
          message: 'Lead deleted permanently'
        }, null, 2)
      }
    ]
  };
}

/**
 * Bulk add leads to campaign or list
 */
async function handleBulkAddLeads(args: any, apiKey: string) {
  console.error('[Instantly MCP] 📦 Executing add_leads_to_campaign_or_list_bulk...');

  // Validate required parameters
  if (!args.leads || !Array.isArray(args.leads) || args.leads.length === 0) {
    throw new McpError(ErrorCode.InvalidParams, 'leads array is required and must contain at least 1 lead');
  }

  if (args.leads.length > 1000) {
    throw new McpError(ErrorCode.InvalidParams, 'Maximum 1,000 leads per request. Please split into multiple batches.');
  }

  // Validate mutually exclusive campaign_id and list_id
  if (!args.campaign_id && !args.list_id) {
    throw new McpError(ErrorCode.InvalidParams, 'Either campaign_id or list_id is required (but not both)');
  }

  if (args.campaign_id && args.list_id) {
    throw new McpError(ErrorCode.InvalidParams, 'Cannot provide both campaign_id and list_id. Use one or the other.');
  }

  // Build request body matching Instantly.ai API v2 specification
  const bulkData: any = {
    leads: args.leads
  };

  // Add campaign_id or list_id (mutually exclusive)
  if (args.campaign_id) bulkData.campaign_id = args.campaign_id;
  if (args.list_id) bulkData.list_id = args.list_id;

  // Add optional parameters
  if (args.blocklist_id) bulkData.blocklist_id = args.blocklist_id;
  if (args.assigned_to) bulkData.assigned_to = args.assigned_to;
  if (args.verify_leads_on_import !== undefined) bulkData.verify_leads_on_import = args.verify_leads_on_import;

  // Add skip flags
  if (args.skip_if_in_workspace !== undefined) bulkData.skip_if_in_workspace = args.skip_if_in_workspace;
  if (args.skip_if_in_campaign !== undefined) bulkData.skip_if_in_campaign = args.skip_if_in_campaign;
  if (args.skip_if_in_list !== undefined) bulkData.skip_if_in_list = args.skip_if_in_list;

  console.error(`[Instantly MCP] 📤 Creating ${args.leads.length} leads in bulk for ${args.campaign_id ? 'campaign' : 'list'}: ${args.campaign_id || args.list_id}`);
  console.error(`[Instantly MCP] 📋 Bulk import settings: skip_if_in_workspace=${bulkData.skip_if_in_workspace}, skip_if_in_campaign=${bulkData.skip_if_in_campaign}, skip_if_in_list=${bulkData.skip_if_in_list}, verify=${bulkData.verify_leads_on_import}`);

  const bulkResult = await makeInstantlyRequest(ENDPOINTS.LEADS_BULK_ADD, { method: 'POST', body: bulkData }, apiKey);

  console.error(`[Instantly MCP] ✅ Bulk import complete: ${bulkResult.leads_uploaded}/${bulkResult.total_sent} leads uploaded successfully`);
  console.error(`[Instantly MCP] 📊 Breakdown: in_blocklist=${bulkResult.in_blocklist}, duplicated=${bulkResult.duplicated_leads}, skipped=${bulkResult.skipped_count}, invalid_email=${bulkResult.invalid_email_count}, duplicate_email=${bulkResult.duplicate_email_count}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          summary: {
            total_sent: bulkResult.total_sent,
            leads_uploaded: bulkResult.leads_uploaded,
            in_blocklist: bulkResult.in_blocklist,
            duplicated_leads: bulkResult.duplicated_leads,
            skipped_count: bulkResult.skipped_count,
            invalid_email_count: bulkResult.invalid_email_count,
            incomplete_count: bulkResult.incomplete_count || 0,
            duplicate_email_count: bulkResult.duplicate_email_count,
            remaining_in_plan: bulkResult.remaining_in_plan || null
          },
          blocklist_used: bulkResult.blocklist_used || null,
          message: `Bulk import complete: ${bulkResult.leads_uploaded}/${bulkResult.total_sent} leads uploaded successfully`
        }, null, 2)
      }
    ]
  };
}

/**
 * Move leads to a different campaign or list
 */
async function handleMoveLeads(args: any, apiKey: string) {
  console.error('[Instantly MCP] 🔄 Executing move_leads_to_campaign_or_list...');

  // Validate mutually exclusive to_campaign_id and to_list_id
  if (!args.to_campaign_id && !args.to_list_id) {
    throw new McpError(ErrorCode.InvalidParams, 'Either to_campaign_id or to_list_id is required (but not both)');
  }

  if (args.to_campaign_id && args.to_list_id) {
    throw new McpError(ErrorCode.InvalidParams, 'Cannot provide both to_campaign_id and to_list_id. Use one or the other.');
  }

  // Build request body matching Instantly.ai API v2 specification
  const moveData: any = {};

  // Destination (required - mutually exclusive)
  if (args.to_campaign_id) moveData.to_campaign_id = args.to_campaign_id;
  if (args.to_list_id) moveData.to_list_id = args.to_list_id;

  // Lead selection filters (at least one required)
  if (args.search) moveData.search = args.search;
  if (args.filter) moveData.filter = args.filter;
  if (args.campaign) moveData.campaign = args.campaign;
  if (args.list_id) moveData.list_id = args.list_id;
  if (args.in_campaign !== undefined) moveData.in_campaign = args.in_campaign;
  if (args.in_list !== undefined) moveData.in_list = args.in_list;
  if (args.ids && args.ids.length > 0) moveData.ids = args.ids;
  if (args.queries && args.queries.length > 0) moveData.queries = args.queries;
  if (args.excluded_ids && args.excluded_ids.length > 0) moveData.excluded_ids = args.excluded_ids;
  if (args.contacts && args.contacts.length > 0) moveData.contacts = args.contacts;

  // Optional parameters
  if (args.check_duplicates_in_campaigns !== undefined) moveData.check_duplicates_in_campaigns = args.check_duplicates_in_campaigns;
  if (args.skip_leads_in_verification !== undefined) moveData.skip_leads_in_verification = args.skip_leads_in_verification;
  if (args.limit !== undefined) moveData.limit = args.limit;
  if (args.assigned_to) moveData.assigned_to = args.assigned_to;
  if (args.esp_code !== undefined) moveData.esp_code = args.esp_code;
  if (args.esg_code !== undefined) moveData.esg_code = args.esg_code;
  if (args.copy_leads !== undefined) moveData.copy_leads = args.copy_leads;
  if (args.check_duplicates !== undefined) moveData.check_duplicates = args.check_duplicates;

  console.error(`[Instantly MCP] 📤 Moving leads to ${args.to_campaign_id ? 'campaign' : 'list'}: ${args.to_campaign_id || args.to_list_id}`);
  console.error(`[Instantly MCP] 📋 Move settings: ${JSON.stringify(moveData, null, 2)}`);

  const moveResult = await makeInstantlyRequest(ENDPOINTS.LEADS_MOVE, { method: 'POST', body: moveData }, apiKey);

  console.error(`[Instantly MCP] ✅ Move operation initiated - Background job created: ${moveResult.id}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          background_job: moveResult,
          message: `Move operation initiated. Background job ID: ${moveResult.id}. Use /background-jobs/${moveResult.id} to check status.`
        }, null, 2)
      }
    ]
  };
}

/**
 * List lead lists with pagination
 */
async function handleListLeadLists(args: any, apiKey: string) {
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

/**
 * Create a new lead list
 */
async function handleCreateLeadList(args: any, apiKey: string) {
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

/**
 * Update an existing lead list
 */
async function handleUpdateLeadList(args: any, apiKey: string) {
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

/**
 * Get verification statistics for a lead list
 */
async function handleGetVerificationStats(args: any, apiKey: string) {
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

