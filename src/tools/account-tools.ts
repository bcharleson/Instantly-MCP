/**
 * Instantly MCP Server - Account Tools
 * 
 * Tool definitions for account management operations.
 * Total: 11 account tools
 */

export const accountTools = [
  {
    name: 'list_accounts',
    description: 'List email accounts with pagination (limit, starting_after from next_starting_after). Filter by search (domain), status (1=Active, 2=Paused, -1=Error), provider_code (1=IMAP/SMTP, 2=Google, 3=Microsoft, 4=AWS), tag_ids. Use next_starting_after cursor for next page.',
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
    description: 'Get account details including warmup status and campaign eligibility',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Account email address' }
      },
      required: ['email'],
      additionalProperties: false
    }
  },

  {
    name: 'get_account_info',
    description: 'Get account information and status (read-only)',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Account email address' }
      },
      required: ['email'],
      additionalProperties: false
    }
  },

  {
    name: 'create_account',
    description: 'Create email account with IMAP/SMTP config. Requires email, name, provider_code, IMAP (username, password, host, port), SMTP (username, password, host, port).',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email address' },
        first_name: { type: 'string', description: 'First name' },
        last_name: { type: 'string', description: 'Last name' },
        provider_code: { type: 'number', description: 'Email provider code' },
        imap_username: { type: 'string', description: 'IMAP username' },
        imap_password: { type: 'string', description: 'IMAP password' },
        imap_host: { type: 'string', description: 'IMAP host (e.g., imap.gmail.com)' },
        imap_port: { type: 'number', description: 'IMAP port (e.g., 993)' },
        smtp_username: { type: 'string', description: 'SMTP username' },
        smtp_password: { type: 'string', description: 'SMTP password' },
        smtp_host: { type: 'string', description: 'SMTP host (e.g., smtp.gmail.com)' },
        smtp_port: { type: 'number', description: 'SMTP port (e.g., 587)' }
      },
      required: ['email', 'first_name', 'last_name', 'provider_code', 'imap_username', 'imap_password', 'imap_host', 'imap_port', 'smtp_username', 'smtp_password', 'smtp_host', 'smtp_port'],
      additionalProperties: false
    }
  },

  {
    name: 'pause_account',
    description: 'Pause sending account',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Account email' }
      },
      required: ['email'],
      additionalProperties: false
    }
  },

  {
    name: 'resume_account',
    description: 'Resume paused sending account',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Account email' }
      },
      required: ['email'],
      additionalProperties: false
    }
  },

  {
    name: 'enable_warmup',
    description: 'Enable email warmup to improve deliverability',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Account email' }
      },
      required: ['email'],
      additionalProperties: false
    }
  },

  {
    name: 'disable_warmup',
    description: 'Disable email warmup',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Account email' }
      },
      required: ['email'],
      additionalProperties: false
    }
  },

  {
    name: 'test_account_vitals',
    description: 'Test account connectivity and health',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Account email' }
      },
      required: ['email'],
      additionalProperties: false
    }
  },

  {
    name: 'update_account',
    description: 'Update account settings (partial updates). Requires email. Supports: name, warmup config, daily_limit, sending_gap, tracking_domain, inbox_placement_test_limit.',
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
    description: '🚨 DESTRUCTIVE: Permanently delete email account. ⚠️ CANNOT BE UNDONE! All campaign data, emails, and settings lost forever. Use with extreme caution!',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: '⚠️ Email to DELETE PERMANENTLY' }
      },
      required: ['email'],
      additionalProperties: false
    }
  },
];

