/**
 * Instantly MCP Server - Account Tools
 * 
 * Tool definitions for account management operations.
 * Total: 11 account tools
 */

export const accountTools = [
  {
    name: 'list_accounts',
    description: '📧 LIST EMAIL ACCOUNTS - Sequential Pagination\n\nReturns email accounts with sequential pagination support. Each call returns one page of results (default 100 accounts, max 100).\n\n**Pagination:**\n- Response includes `pagination.next_starting_after` cursor if more results available\n- To get next page: Use the EXACT cursor value from `response.pagination.next_starting_after` as `starting_after` parameter\n- CRITICAL: Do NOT use email addresses or IDs from the data - only use the cursor from pagination field\n- No cursor in response means you have all results\n- Fast response: ~2-5 seconds per page\n\n**Pagination Example:**\nPage 1: Call with no starting_after → Response has "next_starting_after": "cursor123"\nPage 2: Call with starting_after="cursor123" → Response has "next_starting_after": "cursor456"\nPage 3: Call with starting_after="cursor456" → Response has no next_starting_after (complete)\n\n**Filtering Options:**\n- `search`: Filter by email domain (e.g., "gmail.com", "company.com")\n- `status`: Filter by account status (1=Active, 2=Paused, -1=Connection Error, etc.)\n- `provider_code`: Filter by email provider (1=Custom IMAP/SMTP, 2=Google, 3=Microsoft, 4=AWS)\n- `tag_ids`: Filter by tag IDs (comma-separated)\n- `limit`: Items per page (1-100, default: 100)\n\n**Common Usage:**\n- List all accounts: Call repeatedly with cursor from pagination.next_starting_after until no cursor returned\n- Count accounts: Iterate through all pages, sum the counts\n- Filter accounts: Use search/status/provider_code parameters to narrow results\n- Active accounts only: Use `status=1`\n\n**Note:** For large account lists, consider using filtering parameters to narrow results.',
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
          description: 'Pagination cursor from previous response. CRITICAL: Use the EXACT value from response.pagination.next_starting_after field (NOT an email address or ID from the data). Example: If previous response had "next_starting_after": "abc123xyz", use starting_after="abc123xyz". Omit for first page.'
        },
        search: {
          type: 'string',
          description: 'Search accounts by email domain (e.g., "gmail.com", "company.com"). Filters accounts whose email addresses contain this string.'
        },
        status: {
          type: 'number',
          description: 'Filter by account status. Values: 1=Active, 2=Paused, -1=Connection Error, -2=Soft Bounce Error, -3=Sending Error',
          enum: [1, 2, -1, -2, -3]
        },
        provider_code: {
          type: 'number',
          description: 'Filter by ESP provider. Values: 1=Custom IMAP/SMTP, 2=Google, 3=Microsoft, 4=AWS',
          enum: [1, 2, 3, 4]
        },
        tag_ids: {
          type: 'string',
          description: 'Filter by tag IDs (comma-separated). Example: "tag1,tag2,tag3"'
        }
      },
      additionalProperties: false
    }
  },

  {
    name: 'get_account_details',
    description: 'Get detailed information about a specific account including warmup status and campaign eligibility',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email address of the account to inspect' }
      },
      required: ['email'],
      additionalProperties: false
    }
  },

  {
    name: 'get_account_info',
    description: 'Get detailed account information and status - Safe read-only account inspection',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email address of the account to retrieve information for' }
      },
      required: ['email'],
      additionalProperties: false
    }
  },

  {
    name: 'create_account',
    description: 'Create a new email account for sending campaigns - Account creation with full IMAP/SMTP configuration',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email address for the new account' },
        first_name: { type: 'string', description: 'First name associated with the account' },
        last_name: { type: 'string', description: 'Last name associated with the account' },
        provider_code: { type: 'number', description: 'Email provider code (required by API)' },
        imap_username: { type: 'string', description: 'IMAP username for receiving emails' },
        imap_password: { type: 'string', description: 'IMAP password for receiving emails' },
        imap_host: { type: 'string', description: 'IMAP server host (e.g., imap.gmail.com)' },
        imap_port: { type: 'number', description: 'IMAP server port (e.g., 993)' },
        smtp_username: { type: 'string', description: 'SMTP username for sending emails' },
        smtp_password: { type: 'string', description: 'SMTP password for sending emails' },
        smtp_host: { type: 'string', description: 'SMTP server host (e.g., smtp.gmail.com)' },
        smtp_port: { type: 'number', description: 'SMTP server port (e.g., 587)' }
      },
      required: ['email', 'first_name', 'last_name', 'provider_code', 'imap_username', 'imap_password', 'imap_host', 'imap_port', 'smtp_username', 'smtp_password', 'smtp_host', 'smtp_port'],
      additionalProperties: false
    }
  },

  {
    name: 'pause_account',
    description: 'Pause a sending account - Account state management',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email address of the account to pause' }
      },
      required: ['email'],
      additionalProperties: false
    }
  },

  {
    name: 'resume_account',
    description: 'Resume a paused sending account - Account state management',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email address of the account to resume' }
      },
      required: ['email'],
      additionalProperties: false
    }
  },

  {
    name: 'enable_warmup',
    description: 'Enable email warmup for an account to improve deliverability',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email address of the account to enable warmup for' }
      },
      required: ['email'],
      additionalProperties: false
    }
  },

  {
    name: 'disable_warmup',
    description: 'Disable email warmup for an account',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email address of the account to disable warmup for' }
      },
      required: ['email'],
      additionalProperties: false
    }
  },

  {
    name: 'test_account_vitals',
    description: 'Test account vitals and connectivity - Diagnostic tool for account health',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email address of the account to test' }
      },
      required: ['email'],
      additionalProperties: false
    }
  },

  {
    name: 'update_account',
    description: 'Update a sending account settings with comprehensive parameter support matching Instantly.ai API v2 PATCH /api/v2/accounts/{email} specification. Supports updating account details, warmup configuration, tracking domains, and sending limits.',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email address of the account to update (required)' },

        // Basic account information
        first_name: { type: 'string', description: 'First name associated with the account' },
        last_name: { type: 'string', description: 'Last name associated with the account' },

        // Warmup configuration
        warmup: {
          type: 'object',
          description: 'Warmup configuration for the account',
          properties: {
            limit: { type: 'number', description: 'Warmup limit (number of warmup emails per day)' },
            advanced: {
              type: 'object',
              description: 'Advanced warmup settings',
              properties: {
                warm_ctd: { type: 'boolean', description: 'Warm click-to-deliver' },
                open_rate: { type: 'number', description: 'Target open rate for warmup emails' },
                important_rate: { type: 'number', description: 'Rate of marking emails as important' },
                read_emulation: { type: 'boolean', description: 'Enable read emulation' },
                spam_save_rate: { type: 'number', description: 'Rate of saving emails from spam' },
                weekday_only: { type: 'boolean', description: 'Send warmup emails only on weekdays' }
              }
            },
            warmup_custom_ftag: { type: 'string', description: 'Custom warmup tag' },
            increment: { type: 'string', description: 'Increment setting for warmup ramp-up' },
            reply_rate: { type: 'number', description: 'Target reply rate for warmup emails' }
          }
        },

        // Sending limits and configuration
        daily_limit: { type: 'number', description: 'Daily email sending limit per account' },
        sending_gap: { type: 'number', description: 'Gap between emails sent from this account in minutes (0-1440, minimum wait time when used with multiple campaigns)' },
        enable_slow_ramp: { type: 'boolean', description: 'Enable slow ramp up for sending limits' },

        // Tracking domain configuration
        tracking_domain_name: { type: 'string', description: 'Tracking domain name' },
        tracking_domain_status: { type: 'string', description: 'Tracking domain status' },
        skip_cname_check: { type: 'boolean', description: 'Skip CNAME check for tracking domain' },
        remove_tracking_domain: { type: 'boolean', description: 'Remove tracking domain from account' },

        // Inbox placement testing
        inbox_placement_test_limit: { type: 'number', description: 'Limit for inbox placement tests' }
      },
      required: ['email'],
      additionalProperties: false
    }
  },

  {
    name: 'delete_account',
    description: '🚨 EXTREMELY DESTRUCTIVE: PERMANENTLY DELETE EMAIL ACCOUNT - ⚠️ WARNING: This action CANNOT be undone! ⚠️ WARNING: All campaign data, emails, and account settings will be lost forever! ⚠️ WARNING: Use with extreme caution!',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: '⚠️ DANGER: Email address of the account to DELETE PERMANENTLY AND IRREVERSIBLY' }
      },
      required: ['email'],
      additionalProperties: false
    }
  },
];

