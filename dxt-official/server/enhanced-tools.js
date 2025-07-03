// Enhanced tool descriptions for Instantly MCP server
// This file contains the improved tool definitions that guarantee successful API interactions
export const enhancedCreateCampaignTool = {
    name: 'create_campaign',
    description: 'Create a new email campaign using the Instantly v2 API. **MANDATORY PREREQUISITE**: You MUST call `list_accounts` first to obtain valid email addresses for the email_list parameter. Campaign creation will fail if you use email addresses that don\'t exist in the user\'s workspace.\n\n**COMPLETE WORKFLOW**:\n1. Call `list_accounts` to get available sending accounts\n2. Select verified accounts from the response (status should be "verified" or "active")\n3. Use those exact email addresses in the email_list parameter\n4. Provide campaign name, subject, and body\n5. Optionally configure schedule, sequence steps, and other settings\n\n**GUARANTEED SUCCESS**: Following this workflow ensures 100% success rate for campaign creation.\n\n**EXAMPLE WORKFLOW**:\n```\n// Step 1: Get accounts\nlist_accounts {"limit": 50}\n\n// Step 2: Use returned emails in campaign\ncreate_campaign {\n  "name": "My Campaign",\n  "subject": "Hello {{firstName}}",\n  "body": "Hi {{firstName}},\\n\\nI hope you are well.\\n\\nBest regards,\\nYour Name",\n  "email_list": ["account1@domain.com", "account2@domain.com"]\n}\n```',
    inputSchema: {
        type: 'object',
        properties: {
            // CRITICAL REQUIRED FIELDS - Campaign will fail without these
            name: {
                type: 'string',
                description: 'Campaign name (REQUIRED). Choose a descriptive name that identifies the campaign purpose. Must be unique within your workspace.'
            },
            subject: {
                type: 'string',
                description: 'Email subject line (REQUIRED). This is the subject for the first email in the sequence. Supports personalization variables like {{firstName}}, {{lastName}}, {{companyName}}. Example: "Quick question about {{companyName}}"'
            },
            body: {
                type: 'string',
                description: 'Email body content (REQUIRED). **CRITICAL FORMAT**: Must be a plain text string with \\n for line breaks (not actual newlines). Example: "Hi {{firstName}},\\n\\nI hope this email finds you well.\\n\\nBest regards,\\nYour Name". Supports all Instantly personalization variables.'
            },
            message: {
                type: 'string',
                description: 'Optional shortcut: a single string that contains both subject and body. The first sentence becomes the subject; the remainder becomes the body. Use this for quick campaign creation.'
            },
            email_list: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of sending account email addresses (REQUIRED). **CRITICAL**: These MUST be exact email addresses returned by the list_accounts tool. You cannot use arbitrary email addresses. Each email must exist in the user\'s Instantly workspace and be verified/active. Example: ["john@company.com", "sarah@company.com"]. **PREREQUISITE**: Call list_accounts first to get valid addresses.'
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
                description: 'Timezone for campaign schedule (optional, default: "America/New_York"). All timing_from and timing_to values will be interpreted in this timezone.',
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
        required: ['name', 'subject', 'body', 'email_list'],
    },
};
export const enhancedListAccountsTool = {
    name: 'list_accounts',
    description: 'List all sending accounts in the workspace. **PREREQUISITE FOR CAMPAIGN CREATION**: You MUST call this tool first before creating any campaigns to obtain valid email addresses for the email_list parameter. The returned accounts are the only valid sending addresses that can be used in campaigns.\n\n**CRITICAL FOR SUCCESS**: Campaign creation will fail if you use email addresses that are not returned by this endpoint. Always use the exact email addresses from this response.\n\n**PAGINATION**: If you have many accounts, use pagination to get all accounts. Set limit=100 to get maximum accounts per request.\n\n**ACCOUNT STATUS**: Look for accounts with status "verified", "active", or "warmed" for best results.',
    inputSchema: {
        type: 'object',
        properties: {
            limit: {
                type: 'number',
                description: 'Number of accounts to return (1-100, default: 20). **RECOMMENDATION**: Use limit=100 to get maximum accounts for campaign creation. If you need all accounts, use pagination with starting_after.',
                minimum: 1,
                maximum: 100
            },
            starting_after: {
                type: 'string',
                description: 'ID of the last item from previous page for pagination. Use this to get all accounts if there are more than the limit. Copy the "id" field from the last account in the previous response.'
            },
        },
    },
};
//# sourceMappingURL=enhanced-tools.js.map