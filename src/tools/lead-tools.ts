/**
 * Instantly MCP Server - Lead Tools
 *
 * Tool definitions for lead and lead list management operations.
 * Total: 11 lead tools (includes bulk import, delete, and move)
 */

export const leadTools = [
  {
    name: 'list_leads',
    description: 'List leads with pagination (limit, starting_after from pagination.next_starting_after). Filter by campaign, list_id, search (name/email), filter (FILTER_VAL_CONTACTED/NOT_CONTACTED/COMPLETED/UNSUBSCRIBED/ACTIVE, FILTER_LEAD_INTERESTED/MEETING_BOOKED/CLOSED), distinct_contacts. Use EXACT cursor from pagination.next_starting_after for next page (NOT lead IDs/emails). No cursor = all results.',
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
          description: 'Contact status filter. Values: FILTER_VAL_CONTACTED (replied), FILTER_VAL_NOT_CONTACTED (not contacted), FILTER_VAL_COMPLETED (completed), FILTER_VAL_UNSUBSCRIBED (unsubscribed), FILTER_VAL_ACTIVE (active), FILTER_LEAD_INTERESTED (interested), FILTER_LEAD_MEETING_BOOKED (meeting booked), FILTER_LEAD_CLOSED (closed/won)'
        },
        distinct_contacts: {
          type: 'boolean',
          description: 'Group leads by email address (true) or show all instances (false). Default: false. Use true to deduplicate by email.'
        },

        // Pagination
        limit: {
          type: 'number',
          description: 'Number of items per page (1-100, default: 100)',
          minimum: 1,
          maximum: 100
        },
        starting_after: {
          type: 'string',
          description: 'Pagination cursor from previous response. CRITICAL: Use the EXACT value from response.pagination.next_starting_after field (NOT a lead ID or email from the data). Example: If previous response had "next_starting_after": "cursor_abc123", use starting_after="cursor_abc123". Omit for first page.'
        }
      },
      additionalProperties: false
    }
  },

  {
    name: 'get_lead',
    description: 'Get lead details by ID',
    inputSchema: {
      type: 'object',
      properties: {
        lead_id: { type: 'string', description: 'Lead ID (UUID)' }
      },
      required: ['lead_id'],
      additionalProperties: false
    }
  },

  {
    name: 'create_lead',
    description: 'Create lead with custom variables. ⚠️ CRITICAL: When using campaign_id, ALWAYS ask user about custom_variables to align with existing campaign fields (e.g., headcount, revenue). Match EXACT field names. Use skip_if_in_campaign to prevent duplicates. Set verify_leads_on_import for email validation.',
    inputSchema: {
      type: 'object',
      properties: {
        campaign: { type: 'string', description: 'Campaign ID (UUID)' },
        email: { type: 'string', description: 'Email (required, user@domain.com)' },
        first_name: { type: 'string', description: 'First name' },
        last_name: { type: 'string', description: 'Last name' },
        company_name: { type: 'string', description: 'Company name' },
        phone: { type: 'string', description: 'Phone' },
        website: { type: 'string', description: 'Website URL' },
        personalization: { type: 'string', description: 'Custom message' },
        lt_interest_status: { type: 'number', description: 'Interest status (-3 to 4)', minimum: -3, maximum: 4 },
        pl_value_lead: { type: 'string', description: 'Lead value (e.g., "$5000")' },
        list_id: { type: 'string', description: 'List ID (UUID)' },
        assigned_to: { type: 'string', description: 'User ID to assign' },
        skip_if_in_workspace: { type: 'boolean', description: 'Skip if email exists in workspace', default: false },
        skip_if_in_campaign: { type: 'boolean', description: 'Skip if email exists in campaign (recommended)', default: false },
        skip_if_in_list: { type: 'boolean', description: 'Skip if email exists in list', default: false },
        blocklist_id: { type: 'string', description: 'Blocklist ID to check' },
        verify_leads_for_lead_finder: { type: 'boolean', description: 'Enable lead finder verification', default: false },
        verify_leads_on_import: { type: 'boolean', description: 'Verify email before import (adds 2-5s)', default: false },
        custom_variables: {
          type: 'object',
          description: '⚠️ Ask user about campaign variables first! Match exact field names. Examples: {"headcount": "50-100", "revenue": "$1M-$5M"}',
          additionalProperties: true
        }
      },
      required: [],
      additionalProperties: false
    }
  },

  {
    name: 'update_lead',
    description: 'Update lead (partial updates supported). ⚠️ custom_variables REPLACES entire object - include ALL existing fields + changes. Get current data with get_lead first.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_id: { type: 'string', description: 'Lead ID (UUID, required)' },
        personalization: { type: 'string', description: 'Custom message' },
        website: { type: 'string', description: 'Website URL' },
        last_name: { type: 'string', description: 'Last name' },
        first_name: { type: 'string', description: 'First name' },
        company_name: { type: 'string', description: 'Company name' },
        phone: { type: 'string', description: 'Phone' },
        lt_interest_status: { type: 'number', description: 'Interest status (-3 to 4)', minimum: -3, maximum: 4 },
        pl_value_lead: { type: 'string', description: 'Lead value' },
        assigned_to: { type: 'string', description: 'User UUID to assign' },
        custom_variables: {
          type: 'object',
          description: '⚠️ REPLACES entire object! Include ALL existing + new fields. Get current with get_lead first.',
          additionalProperties: true
        }
      },
      required: ['lead_id'],
      additionalProperties: false
    }
  },

  {
    name: 'list_lead_lists',
    description: 'List lead lists with pagination (limit, starting_after from pagination cursor). Filter by search (name), has_enrichment_task. Use EXACT cursor from pagination field for next page (NOT manual timestamps). No cursor = all results.',
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
    description: 'Create lead list to organize leads by source/segment. Use for batch imports or organizing prospects. Alternative: Add leads directly to campaigns with create_lead (campaign_id) - faster and simpler. Set has_enrichment_task=true to auto-enrich lead data.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'List name (e.g., "LinkedIn Prospects Q1 2025")' },
        has_enrichment_task: { type: 'boolean', description: 'Auto-enrich lead data (default: false)', default: false },
        owned_by: { type: 'string', description: 'Owner user ID (UUID)' }
      },
      required: ['name'],
      additionalProperties: false
    }
  },

  {
    name: 'update_lead_list',
    description: 'Update lead list (name, enrichment, owner). Partial updates supported.',
    inputSchema: {
      type: 'object',
      properties: {
        list_id: { type: 'string', description: 'Lead list ID (UUID)' },
        name: { type: 'string', description: 'New name' },
        has_enrichment_task: { type: 'boolean', description: 'Enable/disable enrichment' },
        owned_by: { type: 'string', description: 'New owner user ID' }
      },
      required: ['list_id'],
      additionalProperties: false
    }
  },

  {
    name: 'get_verification_stats_for_lead_list',
    description: 'Get email verification statistics for lead list (verified, invalid, risky, catch-all, pending counts)',
    inputSchema: {
      type: 'object',
      properties: {
        list_id: { type: 'string', description: 'Lead list ID (UUID)' }
      },
      required: ['list_id'],
      additionalProperties: false
    }
  },

  {
    name: 'add_leads_to_campaign_or_list_bulk',
    description: 'Bulk add up to 1,000 leads to campaign OR list (not both). 10-100x faster than individual create_lead. Use skip_if_in_campaign to prevent duplicates. Set verify_leads_on_import for email validation. Response shows detailed breakdown (uploaded, duplicates, invalid, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        leads: {
          type: 'array',
          description: 'Lead objects (1-1000). Each: email, first_name, last_name, company_name, phone, website, personalization, lt_interest_status, pl_value_lead, assigned_to, custom_variables.',
          items: {
            type: 'object',
            properties: {
              email: { type: 'string', description: 'Email (required for campaigns)' },
              first_name: { type: 'string', description: 'First name' },
              last_name: { type: 'string', description: 'Last name' },
              company_name: { type: 'string', description: 'Company' },
              phone: { type: 'string', description: 'Phone' },
              website: { type: 'string', description: 'Website' },
              personalization: { type: 'string', description: 'Custom message' },
              lt_interest_status: { type: 'number', description: 'Interest status (-3 to 4)', minimum: -3, maximum: 4 },
              pl_value_lead: { type: 'string', description: 'Lead value' },
              assigned_to: { type: 'string', description: 'User UUID' },
              custom_variables: {
                type: 'object',
                description: '⚠️ Align with campaign variables!',
                additionalProperties: true
              }
            },
            additionalProperties: false
          },
          minItems: 1,
          maxItems: 1000
        },
        campaign_id: { type: 'string', description: 'Campaign UUID (use this OR list_id)' },
        list_id: { type: 'string', description: 'List UUID (use this OR campaign_id)' },
        blocklist_id: { type: 'string', description: 'Blocklist UUID' },
        assigned_to: { type: 'string', description: 'User UUID for all leads' },
        verify_leads_on_import: { type: 'boolean', description: 'Verify emails (recommended)', default: false },
        skip_if_in_workspace: { type: 'boolean', description: 'Skip if exists in workspace', default: false },
        skip_if_in_campaign: { type: 'boolean', description: 'Skip if exists in campaign (recommended)', default: false },
        skip_if_in_list: { type: 'boolean', description: 'Skip if exists in list', default: false }
      },
      required: ['leads'],
      additionalProperties: false
    }
  },

  {
    name: 'delete_lead',
    description: '🗑️ DESTRUCTIVE: Permanently delete lead. ⚠️ CANNOT BE UNDONE! Removes from all campaigns/lists, deletes email history and analytics. Always confirm with user first. Alternatives: update_lead (pause), move_leads_to_campaign_or_list (move).',
    inputSchema: {
      type: 'object',
      properties: {
        lead_id: {
          type: 'string',
          description: '⚠️ Lead ID to DELETE PERMANENTLY (cannot recover!)'
        }
      },
      required: ['lead_id'],
      additionalProperties: false
    }
  },

  {
    name: 'move_leads_to_campaign_or_list',
    description: 'Move/copy leads between campaigns/lists (background job). Requires to_campaign_id OR to_list_id (not both). Select leads via: ids, search, filter, campaign, list_id. Set copy_leads=true to copy instead of move. Returns background job ID - check status with /background-jobs/{id}.',
    inputSchema: {
      type: 'object',
      properties: {
        to_campaign_id: {
          type: 'string',
          description: 'Destination campaign ID (use this OR to_list_id)'
        },
        to_list_id: {
          type: 'string',
          description: 'Destination list ID (use this OR to_campaign_id)'
        },
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Lead IDs to move'
        },
        search: {
          type: 'string',
          description: 'Search string (name/email)'
        },
        filter: {
          type: 'string',
          description: 'Contact status: FILTER_VAL_CONTACTED, FILTER_VAL_NOT_CONTACTED, FILTER_VAL_COMPLETED, FILTER_VAL_UNSUBSCRIBED, FILTER_VAL_ACTIVE, FILTER_LEAD_INTERESTED, FILTER_LEAD_MEETING_BOOKED, FILTER_LEAD_CLOSED'
        },
        campaign: {
          type: 'string',
          description: 'Source campaign ID'
        },
        list_id: {
          type: 'string',
          description: 'Source list ID'
        },
        in_campaign: {
          type: 'boolean',
          description: 'Filter: in campaign (true/false)'
        },
        in_list: {
          type: 'boolean',
          description: 'Filter: in list (true/false)'
        },
        queries: {
          type: 'array',
          items: { type: 'object' },
          description: 'Advanced filters'
        },
        excluded_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Lead IDs to exclude'
        },
        contacts: {
          type: 'array',
          items: { type: 'string' },
          description: 'Email addresses to filter'
        },
        check_duplicates_in_campaigns: {
          type: 'boolean',
          description: 'Check duplicates (recommended: true)'
        },
        skip_leads_in_verification: {
          type: 'boolean',
          description: 'Skip leads being verified (recommended: true)'
        },
        limit: {
          type: 'number',
          description: 'Max leads to move'
        },
        assigned_to: {
          type: 'string',
          description: 'User ID to assign moved leads'
        },
        esp_code: {
          type: 'number',
          description: 'ESP code: 0=Queue, 1=Google, 2=Microsoft, 3=Zoho, 9=Yahoo, 10=Yandex, 12=Web.de, 13=Libero.it, 999=Other, 1000=Not Found'
        },
        esg_code: {
          type: 'number',
          description: 'ESG code: 0=Queue, 1=Barracuda, 2=Mimecast, 3=Proofpoint, 4=Cisco'
        },
        copy_leads: {
          type: 'boolean',
          description: 'Copy instead of move (default: false)'
        },
        check_duplicates: {
          type: 'boolean',
          description: 'Check duplicates (default: false)'
        }
      },
      required: [],
      additionalProperties: false
    }
  },
];

