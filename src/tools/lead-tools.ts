/**
 * Instantly MCP Server - Lead Tools
 *
 * Tool definitions for lead and lead list management operations.
 * Total: 11 lead tools (includes bulk import, delete, and move)
 */

export const leadTools = [
  {
    name: 'list_leads',
    description: '📊 LIST LEADS - Sequential Pagination\n\nReturns leads with sequential pagination support. Each call returns one page of results (default 100 leads, max 100). Lead datasets can be large (1000s-10000s+), so filtering is recommended for targeted queries.\n\n**Pagination:**\n- Response includes `pagination.next_starting_after` cursor if more results available\n- To get next page: Use the EXACT cursor value from `response.pagination.next_starting_after` as `starting_after` parameter\n- CRITICAL: Do NOT use lead IDs or emails from the data - only use the cursor from pagination field\n- The API returns the correct cursor - do not construct it yourself\n- No cursor in response means you have all results\n- Fast response: ~2-5 seconds per page\n\n**Pagination Example:**\nPage 1: Call with no starting_after → Response has "next_starting_after": "lead_cursor_xyz"\nPage 2: Call with starting_after="lead_cursor_xyz" → Response has "next_starting_after": "lead_cursor_abc"\nPage 3: Call with starting_after="lead_cursor_abc" → Response has no next_starting_after (complete)\n\n**Filtering Options:**\n- `campaign`: Filter by campaign ID\n- `list_id`: Filter by lead list ID\n- `search`: Search by name or email\n- `filter`: Contact status filters (see below)\n- `distinct_contacts`: Group by email (true/false)\n- `limit`: Items per page (1-100, default: 100)\n\n**Contact Status Filters:**\n- `FILTER_VAL_CONTACTED` - Leads that replied\n- `FILTER_VAL_NOT_CONTACTED` - Not yet contacted\n- `FILTER_VAL_COMPLETED` - Completed sequence\n- `FILTER_VAL_UNSUBSCRIBED` - Unsubscribed\n- `FILTER_VAL_ACTIVE` - Currently active\n\n**Interest Status Filters:**\n- `FILTER_LEAD_INTERESTED` - Marked as interested\n- `FILTER_LEAD_MEETING_BOOKED` - Meeting scheduled\n- `FILTER_LEAD_CLOSED` - Closed/won\n\n**Common Usage:**\n- List all leads: Call repeatedly with cursor from pagination.next_starting_after until no cursor returned\n- Count leads: Iterate through all pages, sum the counts\n- Find specific lead: Use `search` parameter\n- Campaign leads: Use `campaign` parameter\n- Replied leads: Use `filter="FILTER_VAL_CONTACTED"`\n\n**Note:** For large datasets, use filtering parameters to narrow results and improve performance.',
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
    name: 'update_lead_list',
    description: '✏️ UPDATE LEAD LIST - MODIFY EXISTING LEAD LIST\n\n**What this tool does:**\nUpdates properties of an existing lead list (name, enrichment settings, owner).\n\n**Required:**\n- `list_id`: Lead list UUID (get from list_lead_lists)\n\n**Optional parameters (only provide what you want to change):**\n- `name`: New name for the list\n- `has_enrichment_task`: Enable/disable automatic enrichment (true/false)\n- `owned_by`: Transfer ownership to different user (user UUID)\n\n**Common use cases:**\n1️⃣ "Rename a lead list":\n   → Call update_lead_list with list_id and new name\n   → Example: {list_id: "uuid", name: "Q1 2025 Prospects"}\n\n2️⃣ "Enable enrichment for existing list":\n   → Call update_lead_list with list_id and has_enrichment_task: true\n   → All future leads added to this list will be auto-enriched\n\n3️⃣ "Transfer list ownership":\n   → Call update_lead_list with list_id and owned_by: "user-uuid"\n   → List ownership transfers to specified user\n\n**Performance:**\n- Update is instant (< 1 second)\n- Changes take effect immediately\n- Does not affect existing leads in the list\n\nUpdate an existing lead list. Only provide the fields you want to change.',
    inputSchema: {
      type: 'object',
      properties: {
        list_id: { type: 'string', description: 'Lead list ID (UUID) to update - REQUIRED. Get from list_lead_lists. Example: "0199cf87-d1a7-7533-8218-782cda8d4e68"' },
        name: { type: 'string', description: 'New name for the lead list (OPTIONAL). Only provide if you want to rename the list. Example: "Updated List Name"' },
        has_enrichment_task: { type: 'boolean', description: 'Enable/disable automatic enrichment (OPTIONAL). Only provide if you want to change enrichment setting. true = enable, false = disable.' },
        owned_by: { type: 'string', description: 'User ID (UUID) to transfer ownership to (OPTIONAL). Only provide if you want to change the owner. Example: "0199cf87-b33d-766b-833d-e326bc17066a"' }
      },
      required: ['list_id'],
      additionalProperties: false
    }
  },

  {
    name: 'get_verification_stats_for_lead_list',
    description: '📊 GET VERIFICATION STATS FOR LEAD LIST - EMAIL QUALITY ANALYTICS\n\n**What this tool does:**\nReturns email verification statistics for all leads in a specific lead list.\n\n**Required:**\n- `list_id`: Lead list UUID (get from list_lead_lists)\n\n**Returns:**\n- `stats` object with verification breakdown:\n  - `verified`: Count of verified/deliverable emails\n  - `invalid`: Count of invalid/undeliverable emails\n  - `risky`: Count of risky emails (might bounce)\n  - `catch_all`: Count of catch-all domain emails\n  - `job_change`: Count of leads with job changes detected\n  - `verification_job_pending_leadfinder`: Pending verification (leadfinder)\n  - `verification_job_pending_user`: Pending verification (user-initiated)\n- `total_leads`: Total number of leads in the list\n\n**Common use cases:**\n1️⃣ "Check email quality of my lead list":\n   → Call get_verification_stats_for_lead_list with list_id\n   → Review verified vs invalid counts\n   → High verified % = good quality list\n\n2️⃣ "See how many leads need verification":\n   → Check verification_job_pending counts\n   → These leads are queued for verification\n\n3️⃣ "Assess list deliverability before campaign":\n   → Get stats before launching campaign\n   → Remove/fix invalid emails to improve deliverability\n\n**Performance:**\n- Fast response (< 2 seconds)\n- Read-only operation (no changes to data)\n- Stats are real-time\n\n**Example response:**\n```json\n{\n  "stats": {\n    "verified": 150,\n    "invalid": 25,\n    "risky": 10,\n    "catch_all": 5,\n    "job_change": 2,\n    "verification_job_pending_leadfinder": 11,\n    "verification_job_pending_user": 12\n  },\n  "total_leads": 203\n}\n```\n\nGet email verification statistics for a lead list to assess email quality and deliverability.',
    inputSchema: {
      type: 'object',
      properties: {
        list_id: { type: 'string', description: 'Lead list ID (UUID) - REQUIRED. Get from list_lead_lists. Example: "0199cf87-d1a7-7533-8218-782cda8d4e68"' }
      },
      required: ['list_id'],
      additionalProperties: false
    }
  },

  {
    name: 'add_leads_to_campaign_or_list_bulk',
    description: '📦 ADD LEADS IN BULK TO CAMPAIGN OR LIST - BATCH IMPORT UP TO 1,000 LEADS\n\n✨ WHAT THIS TOOL DOES:\n\nAdds up to 1,000 leads to either a campaign or a list in a single API call. This is the RECOMMENDED way to import multiple leads, as it:\n• ✅ Avoids rate limiting issues from concurrent requests\n• ✅ Provides detailed success/failure breakdown\n• ✅ Validates emails and checks blocklists automatically\n• ✅ Handles duplicates intelligently with skip flags\n• ✅ Supports custom variables for personalization\n• ✅ Is 10-100x faster than individual create_lead calls\n\n⚠️ CRITICAL REQUIREMENTS:\n\n1️⃣ CAMPAIGN OR LIST (MUTUALLY EXCLUSIVE):\n• Must provide EITHER campaign_id OR list_id (NOT both)\n• campaign_id: Adds leads to a campaign for outreach\n• list_id: Adds leads to a list for organization\n\n2️⃣ LEAD REQUIREMENTS:\n• For campaigns: Each lead MUST have an email address\n• For lists: Each lead MUST have at least one of: email, first_name, or last_name\n• Maximum 1,000 leads per request\n• Minimum 1 lead per request\n\n3️⃣ CUSTOM VARIABLES:\n• ALWAYS check existing campaign custom variables FIRST\n• Align custom_variables with campaign\'s existing fields\n• Example: If campaign uses {{headcount}}, include headcount in custom_variables\n• Custom variables update the campaign schema for ALL leads\n\n📚 COMMON USER REQUEST EXAMPLES:\n\n1️⃣ "Add multiple leads to campaign X":\n   → Get campaign_id from list_campaigns\n   → Build leads array with email, first_name, last_name, company_name\n   → Set skip_if_in_campaign: true to avoid duplicates\n   → Call add_leads_to_campaign_or_list_bulk\n\n2️⃣ "Import 100 leads with custom variables":\n   → Ask: "What custom variables does your campaign use?"\n   → Build leads array with custom_variables for each lead\n   → Example: {"headcount": "50-100", "revenue": "$1M-$5M"}\n   → Set campaign_id and call tool\n\n3️⃣ "Add leads and verify emails":\n   → Set verify_leads_on_import: true\n   → Background job will verify all emails\n   → Check response for verification job status\n\n4️⃣ "Import to list for later use":\n   → Use list_id instead of campaign_id\n   → Leads stored in list without sending\n   → Can add to campaign later\n\n💡 WHEN TO USE BULK vs INDIVIDUAL create_lead:\n\n**Use add_leads_to_campaign_or_list_bulk when:**\n• ✅ Adding 2+ leads at once\n• ✅ Importing from CSV or external source\n• ✅ Need detailed success/failure reporting\n• ✅ Want to avoid rate limiting\n• ✅ Batch operations in n8n or automation tools\n\n**Use create_lead when:**\n• ❌ Adding only 1 lead\n• ❌ Interactive lead-by-lead creation\n• ❌ Need immediate per-lead feedback\n\n📊 RESPONSE FORMAT:\n\nThe response provides detailed breakdown:\n```json\n{\n  "status": "success",\n  "total_sent": 10,\n  "leads_uploaded": 7,\n  "in_blocklist": 1,\n  "blocklist_used": "blocklist-uuid",\n  "duplicated_leads": 0,\n  "skipped_count": 1,\n  "invalid_email_count": 1,\n  "incomplete_count": 0,\n  "duplicate_email_count": 0,\n  "remaining_in_plan": 9993\n}\n```\n\n**Response Fields:**\n• total_sent: Total leads in request\n• leads_uploaded: Successfully created leads ✅\n• in_blocklist: Leads skipped (on blocklist) 🚫\n• duplicated_leads: Leads already in campaign/list 🔄\n• skipped_count: Leads skipped due to skip_if_* flags ⏭️\n• invalid_email_count: Invalid email format ❌\n• incomplete_count: Missing required fields (lists only) ⚠️\n• duplicate_email_count: Duplicate emails within request 🔁\n• remaining_in_plan: Remaining lead quota (campaigns only) 📊\n\n⚠️ IMPORTANT LIMITS:\n\n• Maximum 1,000 leads per request\n• For larger imports, split into multiple batches\n• Use skip_if_in_campaign to avoid duplicates across batches\n• Response time: 2-10 seconds depending on lead count\n\n⏱️ PERFORMANCE:\n\n• 10 leads: ~2-3 seconds\n• 100 leads: ~3-5 seconds\n• 1,000 leads: ~5-10 seconds\n• Much faster than 1,000 individual create_lead calls (which would take 1,000+ seconds)\n\n🎯 BEST PRACTICES:\n\n1. Always set skip_if_in_campaign: true to avoid duplicates\n2. Use verify_leads_on_import: true for email validation\n3. Check response breakdown to identify issues\n4. For 1,000+ leads, batch into multiple requests\n5. Align custom_variables with existing campaign schema\n\nAdd up to 1,000 leads to a campaign or list in a single efficient API call with automatic validation and duplicate detection.',
    inputSchema: {
      type: 'object',
      properties: {
        // Leads array (1-1000 items)
        leads: {
          type: 'array',
          description: 'Array of lead objects to create (1-1000 items). Each lead can contain: email, first_name, last_name, company_name, phone, website, personalization, lt_interest_status, pl_value_lead, assigned_to, custom_variables.',
          items: {
            type: 'object',
            properties: {
              email: { type: 'string', description: 'Email address (REQUIRED for campaigns, optional for lists). Example: "john@acme.com"' },
              first_name: { type: 'string', description: 'First name. Example: "John"' },
              last_name: { type: 'string', description: 'Last name. Example: "Doe"' },
              company_name: { type: 'string', description: 'Company name. Example: "Acme Corp"' },
              phone: { type: 'string', description: 'Phone number. Example: "+1-555-0123"' },
              website: { type: 'string', description: 'Website URL. Example: "https://acme.com"' },
              personalization: { type: 'string', description: 'Custom personalization message. Example: "Hi John, saw your post about AI"' },
              lt_interest_status: { type: 'number', description: 'Interest status: -3=Not Interested, -2=Wrong Person, -1=Lost, 0=Out of Office, 1=Interested, 2=Meeting Booked, 3=Meeting Completed, 4=Closed', minimum: -3, maximum: 4 },
              pl_value_lead: { type: 'string', description: 'Potential lead value. Example: "$5000"' },
              assigned_to: { type: 'string', description: 'User UUID to assign this lead to. Example: "user-uuid-here"' },
              custom_variables: {
                type: 'object',
                description: 'Custom metadata for campaign personalization. CRITICAL: Align with existing campaign variables! Example: {"headcount": "50-100", "revenue": "$1M-$5M", "industry": "SaaS"}',
                additionalProperties: true
              }
            },
            additionalProperties: false
          },
          minItems: 1,
          maxItems: 1000
        },

        // Campaign or List (mutually exclusive)
        campaign_id: { type: 'string', description: 'Campaign UUID to add leads to. Use this OR list_id (NOT both). Get from list_campaigns. Example: "campaign-uuid-here"' },
        list_id: { type: 'string', description: 'List UUID to add leads to. Use this OR campaign_id (NOT both). Get from list_lead_lists. Example: "list-uuid-here"' },

        // Optional parameters
        blocklist_id: { type: 'string', description: 'Blocklist UUID to check leads against. If omitted, workspace default blocklist is used. Example: "blocklist-uuid-here"' },
        assigned_to: { type: 'string', description: 'User UUID to assign ALL imported leads to. If omitted, leads assigned to campaign owner (for campaigns) or requesting user (for lists). Example: "user-uuid-here"' },
        verify_leads_on_import: { type: 'boolean', description: 'If true, creates background job to verify email addresses. Recommended for better deliverability. Default: false', default: false },

        // Skip flags for duplicate prevention
        skip_if_in_workspace: { type: 'boolean', description: 'Skip if lead exists ANYWHERE in workspace (strictest). Overrides other skip flags. Default: false', default: false },
        skip_if_in_campaign: { type: 'boolean', description: 'Skip if lead exists in ANY campaign. Recommended for campaign imports. Default: false', default: false },
        skip_if_in_list: { type: 'boolean', description: 'Skip if lead exists in ANY list. Recommended for list imports. Default: false', default: false }
      },
      required: ['leads'],
      additionalProperties: false
    }
  },

  {
    name: 'delete_lead',
    description: '🗑️ EXTREMELY DESTRUCTIVE: PERMANENTLY DELETE LEAD - ⚠️ WARNING: This action CANNOT be undone! ⚠️\n\n✨ WHAT THIS TOOL DOES:\n\nPermanently deletes a lead from your Instantly.ai workspace. This action is IRREVERSIBLE and will:\n• ❌ Remove the lead from all campaigns and lists\n• ❌ Delete all associated email history and analytics\n• ❌ Remove all custom variables and lead data\n• ❌ Cannot be recovered after deletion\n\n⚠️ CRITICAL WARNINGS:\n\n1️⃣ **PERMANENT DELETION**:\n• This action CANNOT be undone\n• All lead data will be lost forever\n• Email history and analytics will be deleted\n• Custom variables will be removed\n\n2️⃣ **CONFIRM BEFORE USING**:\n• Always verify the lead_id before deletion\n• Double-check you have the correct lead\n• Consider exporting lead data first\n• Use with extreme caution\n\n3️⃣ **ALTERNATIVES TO DELETION**:\n• **Pause lead**: Use update_lead to change status instead\n• **Remove from campaign**: Use move_leads_to_campaign_or_list to move to a different list\n• **Mark as unsubscribed**: Update lead status instead of deleting\n\n📚 COMMON USER REQUEST EXAMPLES:\n\n1️⃣ "Delete lead X":\n   → Get lead_id from list_leads or get_lead\n   → CONFIRM with user: "Are you sure you want to permanently delete this lead?"\n   → Call delete_lead with lead_id\n   → Lead is permanently removed\n\n2️⃣ "Remove duplicate lead":\n   → Identify duplicate lead_id\n   → Verify it\'s truly a duplicate\n   → CONFIRM deletion with user\n   → Delete the duplicate lead\n\n3️⃣ "Clean up test leads":\n   → List test leads with list_leads\n   → Identify test lead IDs\n   → CONFIRM bulk deletion with user\n   → Delete each test lead individually\n\n💡 BEST PRACTICES:\n\n• Always confirm with user before deleting\n• Verify lead_id is correct\n• Export lead data before deletion if needed\n• Use alternatives (pause, move) when possible\n• Never delete leads in bulk without explicit confirmation\n\n⏱️ PERFORMANCE NOTE:\n• Deletion is instant (< 1 second)\n• Cannot be undone\n• Lead is immediately removed from all campaigns/lists\n\n🎯 WHEN TO USE:\n\n✅ **Use delete_lead when:**\n• Lead explicitly requested removal (GDPR/privacy)\n• Duplicate lead confirmed and verified\n• Test lead that should not exist in production\n• User explicitly confirms permanent deletion\n\n❌ **DO NOT use when:**\n• Just want to pause outreach → Use update_lead instead\n• Want to move to different campaign → Use move_leads_to_campaign_or_list\n• Unsure if deletion is needed → Ask user first\n• No explicit user confirmation → NEVER delete without confirmation\n\nDelete a lead permanently. This action CANNOT be undone. Always confirm with user before executing.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_id: {
          type: 'string',
          description: 'Lead ID (UUID) to delete - REQUIRED. Get from list_leads or get_lead. Example: "01997ba3-0106-7bf4-8584-634349eecf07". ⚠️ WARNING: This lead will be permanently deleted and cannot be recovered!'
        }
      },
      required: ['lead_id'],
      additionalProperties: false
    }
  },

  {
    name: 'move_leads_to_campaign_or_list',
    description: '🔄 MOVE LEADS TO CAMPAIGN OR LIST - BULK LEAD TRANSFER\n\n✨ WHAT THIS TOOL DOES:\n\nMoves leads from one campaign/list to another campaign/list in a single operation. This is a background job that processes the move asynchronously.\n\n**Key Features:**\n• ✅ Bulk move multiple leads at once\n• ✅ Move between campaigns, lists, or campaign ↔ list\n• ✅ Flexible lead selection (IDs, filters, search)\n• ✅ Duplicate checking and prevention\n• ✅ Background job processing (check status with /background-jobs/{id})\n• ✅ Optional copy instead of move\n\n⚠️ CRITICAL REQUIREMENTS:\n\n1️⃣ **DESTINATION (REQUIRED - MUTUALLY EXCLUSIVE)**:\n• Must provide EITHER to_campaign_id OR to_list_id (NOT both)\n• to_campaign_id: Move leads to a campaign for outreach\n• to_list_id: Move leads to a list for organization\n\n2️⃣ **LEAD SELECTION (AT LEAST ONE REQUIRED)**:\n• ids: Array of specific lead IDs to move\n• search: Search string (name, email)\n• filter: Contact status filter (FILTER_VAL_CONTACTED, etc.)\n• campaign: Source campaign ID\n• list_id: Source list ID\n• queries: Advanced query filters\n\n3️⃣ **BACKGROUND JOB**:\n• Returns immediately with background job ID\n• Move processes asynchronously\n• Use /background-jobs/{id} to check status\n• Job statuses: pending → in-progress → success/failed\n\n📚 COMMON USER REQUEST EXAMPLES:\n\n1️⃣ "Move all leads from campaign A to campaign B":\n   → Get campaign IDs from list_campaigns\n   → Call move_leads_to_campaign_or_list with:\n     - campaign: "campaign-A-id" (source)\n     - to_campaign_id: "campaign-B-id" (destination)\n   → Returns background job ID\n   → Check job status with /background-jobs/{id}\n\n2️⃣ "Move specific leads to a list":\n   → Get lead IDs from list_leads\n   → Call move_leads_to_campaign_or_list with:\n     - ids: ["lead-1-id", "lead-2-id", "lead-3-id"]\n     - to_list_id: "target-list-id"\n   → Leads moved to list\n\n3️⃣ "Move replied leads to a different campaign":\n   → Call move_leads_to_campaign_or_list with:\n     - campaign: "source-campaign-id"\n     - filter: "FILTER_VAL_CONTACTED"\n     - to_campaign_id: "replied-leads-campaign-id"\n   → All replied leads moved\n\n4️⃣ "Copy leads instead of moving":\n   → Set copy_leads: true\n   → Leads are copied to destination (not removed from source)\n   → Useful for testing or multi-campaign outreach\n\n💡 MOVE vs COPY:\n\n**Move** (copy_leads: false, default):\n• ✅ Leads removed from source\n• ✅ Leads added to destination\n• ✅ No duplicates in source\n• Use when: Transferring leads permanently\n\n**Copy** (copy_leads: true):\n• ✅ Leads remain in source\n• ✅ Leads added to destination\n• ✅ Leads exist in both locations\n• Use when: Testing, multi-campaign outreach\n\n📊 RESPONSE FORMAT:\n\nThe response is a background job object:\n```json\n{\n  "success": true,\n  "background_job": {\n    "id": "675266e304a8e55b17f0228b",\n    "workspace_id": "workspace-uuid",\n    "type": "move-leads",\n    "entity_id": "destination-id",\n    "entity_type": "campaign" or "list",\n    "progress": 0,\n    "status": "pending",\n    "created_at": "2025-01-12T...",\n    "updated_at": "2025-01-12T..."\n  },\n  "message": "Move operation initiated. Background job ID: 675266e304a8e55b17f0228b. Use /background-jobs/675266e304a8e55b17f0228b to check status."\n}\n```\n\n**Job Statuses:**\n• pending: Waiting in queue\n• in-progress: Currently processing\n• success: Move completed successfully\n• failed: Move failed (check job data for error)\n\n⚠️ IMPORTANT PARAMETERS:\n\n• **check_duplicates_in_campaigns**: Check for duplicates before moving (recommended: true)\n• **skip_leads_in_verification**: Skip leads currently being verified (recommended: true)\n• **limit**: Maximum number of leads to move (optional)\n• **assigned_to**: Assign moved leads to specific user (UUID)\n\n⏱️ PERFORMANCE:\n\n• API call: Instant (< 1 second)\n• Background job: Depends on lead count\n  - 10 leads: ~5-10 seconds\n  - 100 leads: ~30-60 seconds\n  - 1,000 leads: ~5-10 minutes\n• Check job status periodically\n\n🎯 WHEN TO USE:\n\n✅ **Use move_leads_to_campaign_or_list when:**\n• Moving leads between campaigns\n• Organizing leads into different lists\n• Transferring replied leads to nurture campaign\n• Consolidating leads from multiple sources\n• Copying leads for multi-campaign outreach\n\n❌ **DO NOT use when:**\n• Moving single lead → Use update_lead to change campaign/list\n• Deleting leads → Use delete_lead instead\n• Just updating lead data → Use update_lead\n\nMove leads to a different campaign or list. Returns a background job that processes the move asynchronously.',
    inputSchema: {
      type: 'object',
      properties: {
        // Destination (required - mutually exclusive)
        to_campaign_id: {
          type: 'string',
          description: 'Campaign ID to move leads to (UUID). Mutually exclusive with to_list_id. Example: "0199d953-30b8-79f5-829b-6f09f4437ae1"'
        },
        to_list_id: {
          type: 'string',
          description: 'List ID to move leads to (UUID). Mutually exclusive with to_campaign_id. Example: "0199d953-30b8-79f5-829b-6f0aaea23954"'
        },

        // Lead selection (at least one required)
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of lead IDs to move (UUIDs). Example: ["lead-1-id", "lead-2-id"]'
        },
        search: {
          type: 'string',
          description: 'Search string to filter leads (First Name, Last Name, or Email). Example: "John Doe"'
        },
        filter: {
          type: 'string',
          description: 'Contact status filter. Values: FILTER_VAL_CONTACTED (replied), FILTER_VAL_NOT_CONTACTED (not contacted), FILTER_VAL_COMPLETED (completed), FILTER_VAL_UNSUBSCRIBED (unsubscribed), FILTER_VAL_ACTIVE (active), FILTER_LEAD_INTERESTED (interested), FILTER_LEAD_MEETING_BOOKED (meeting booked), FILTER_LEAD_CLOSED (closed/won)'
        },
        campaign: {
          type: 'string',
          description: 'Source campaign ID to filter leads from (UUID). Example: "0199d953-2ba9-7f56-b08d-d13ac654d7d5"'
        },
        list_id: {
          type: 'string',
          description: 'Source list ID to filter leads from (UUID). Example: "0199d953-2ba9-7f56-b08d-d13bb46099cf"'
        },
        in_campaign: {
          type: 'boolean',
          description: 'Filter leads that are in a campaign (true) or not in a campaign (false)'
        },
        in_list: {
          type: 'boolean',
          description: 'Filter leads that are in a list (true) or not in a list (false)'
        },
        queries: {
          type: 'array',
          items: { type: 'object' },
          description: 'Advanced query filters. Example: [{"actionType":"email-open","values":{"occurrence-days":1}}]'
        },
        excluded_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of lead IDs to exclude from move (UUIDs). Example: ["lead-to-exclude-1", "lead-to-exclude-2"]'
        },
        contacts: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of email addresses to filter leads by. Example: ["test@test.com"]'
        },

        // Optional parameters
        check_duplicates_in_campaigns: {
          type: 'boolean',
          description: 'Check for duplicates in destination campaign before moving (recommended: true). Default: false'
        },
        skip_leads_in_verification: {
          type: 'boolean',
          description: 'Skip leads currently being verified (recommended: true). Default: false'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of leads to move. Example: 100'
        },
        assigned_to: {
          type: 'string',
          description: 'User ID (UUID) to assign moved leads to. Example: "0199d953-30b8-79f5-829b-6f0bc069a642"'
        },
        esp_code: {
          type: 'number',
          description: 'ESP code to filter leads by. Values: 0=In Queue, 1=Google, 2=Microsoft, 3=Zoho, 9=Yahoo, 10=Yandex, 12=Web.de, 13=Libero.it, 999=Other, 1000=Not Found'
        },
        esg_code: {
          type: 'number',
          description: 'ESG code to filter leads by. Values: 0=In Queue, 1=Barracuda, 2=Mimecast, 3=Proofpoint, 4=Cisco'
        },
        copy_leads: {
          type: 'boolean',
          description: 'Copy leads instead of moving (leads remain in source). Default: false (move)'
        },
        check_duplicates: {
          type: 'boolean',
          description: 'Check for duplicates before moving. Default: false'
        }
      },
      required: [],
      additionalProperties: false
    }
  },
];

