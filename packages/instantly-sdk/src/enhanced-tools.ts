// COPIED FROM MCP src/enhanced-tools.ts – do not edit without syncing with original

export const enhancedCreateCampaignTool = {
  name: 'create_campaign',
  description: 'Create a new email campaign using the Instantly v2 API. **MANDATORY PREREQUISITE**: You MUST call `list_accounts` first to obtain valid email addresses for the email_list parameter. Campaign creation will fail if you use email addresses that don\'t exist in the user\'s workspace.\n\n**COMPLETE WORKFLOW**:\n1. Call `list_accounts` to get available sending accounts\n2. Select verified accounts from the response (status should be "verified" or "active")\n3. Use those exact email addresses in the email_list parameter\n4. Provide campaign name, subject, and body\n5. Optionally configure schedule, sequence steps, and other settings\n\n**GUARANTEED SUCCESS**: Following this workflow ensures 100% success rate for campaign creation.\n\n**EXAMPLE WORKFLOW**:\n```\n// Step 1: Get accounts\nlist_accounts {"limit": 50}\n\n// Step 2: Use returned emails in campaign\ncreate_campaign {\n  "name": "My Campaign",\n  "subject": "Hello {{firstName}}",\n  "body": "Hi {{firstName}},\\n\\nI hope you are well.\\n\\nBest regards,\\nYour Name",\n  "email_list": ["account1@domain.com", "account2@domain.com"]\n}\n```',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Campaign name (REQUIRED). Choose a descriptive name that identifies the campaign purpose. Must be unique within your workspace.'
      },
      subject: {
        type: 'string',
        description: 'Email subject line (REQUIRED). This is the subject for the first email in the sequence. Supports personalization variables like {{firstName}}, {{lastName}}, {{companyName}}.'
      },
      body: {
        type: 'string',
        description: 'Email body content (REQUIRED). Must be a plain text string with \n for line breaks.'
      },
      message: {
        type: 'string',
        description: 'Optional shortcut: a single string that contains both subject and body.'
      },
      email_list: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of sending account email addresses (REQUIRED).'
      },
      schedule_name: { type: 'string' },
      timing_from: { type: 'string' },
      timing_to: { type: 'string' },
      timezone: { type: 'string' },
      days: {
        type: 'object',
        properties: {
          monday: { type: 'boolean' }, tuesday: { type: 'boolean' }, wednesday: { type: 'boolean' }, thursday: { type: 'boolean' }, friday: { type: 'boolean' }, saturday: { type: 'boolean' }, sunday: { type: 'boolean' }
        }
      },
      sequence_steps: { type: 'number', minimum: 1, maximum: 10 },
      step_delay_days: { type: 'number', minimum: 1, maximum: 30 },
      text_only: { type: 'boolean' },
      daily_limit: { type: 'number', minimum: 1, maximum: 1000 },
      email_gap_minutes: { type: 'number', minimum: 1, maximum: 1440 },
      link_tracking: { type: 'boolean' },
      open_tracking: { type: 'boolean' },
      stop_on_reply: { type: 'boolean' },
      stop_on_auto_reply: { type: 'boolean' }
    },
    required: ['name', 'subject', 'body', 'email_list'],
  },
};

export const enhancedListAccountsTool = {
  name: 'list_accounts',
  description: 'List all sending accounts in the workspace. **PREREQUISITE FOR CAMPAIGN CREATION**: You MUST call this tool first before creating any campaigns to obtain valid email addresses for the email_list parameter.\n\n**PAGINATION**: If you have many accounts, use pagination to get all accounts. Set limit=100 to get maximum accounts per request.',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', minimum: 1, maximum: 100 },
      starting_after: { type: 'string' },
    },
  },
};