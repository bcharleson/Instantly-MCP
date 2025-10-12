/**
 * Instantly MCP Server - Campaign Tools
 * 
 * Tool definitions for campaign management operations.
 * Total: 6 campaign tools
 */

import { BUSINESS_PRIORITY_TIMEZONES, DEFAULT_TIMEZONE } from '../timezone-config.js';

export const campaignTools = [
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
];

