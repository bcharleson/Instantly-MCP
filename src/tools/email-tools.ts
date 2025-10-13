/**
 * Instantly MCP Server - Email Tools
 *
 * Tool definitions for email management and communication operations.
 * Total: 5 email tools
 */

export const emailTools = [
  {
    name: 'list_emails',
    description: '📧 LIST EMAILS - Sequential Pagination\n\nReturns emails with sequential pagination support. Each call returns one page of results (default 100 emails, max 100). Email datasets are typically very large (10000s-100000s+), so filtering by campaign is strongly recommended.\n\n**Pagination:**\n- Response includes `next_starting_after` cursor if more results available\n- To get next page: Use the EXACT cursor value from `response.next_starting_after` as `starting_after` parameter\n- CRITICAL: Do NOT use email IDs from the data - only use the cursor from next_starting_after field\n- The API returns the cursor in the response, not in a separate pagination object\n- Fast response: ~2-5 seconds per page\n\n**Filtering Options:**\n- `campaign_id`: Filter by campaign ID (HIGHLY RECOMMENDED for large datasets)\n- `search`: Search by email address or thread (use "thread:UUID" format for thread search)\n- `eaccount`: Filter by sender email account(s) - comma-separated for multiple\n- `is_unread`: Filter unread emails (true/false)\n- `email_type`: Filter by type - "received", "sent", or "manual"\n- `i_status`: Filter by interest status (number)\n- `mode`: Filter by mode - "emode_focused", "emode_others", or "emode_all"\n- `limit`: Items per page (1-100, default: 100)\n- `starting_after`: Pagination cursor from previous response\n\n**Common Usage:**\n- List campaign emails: Use `campaign_id` parameter to get emails for specific campaign\n- List all emails: Call repeatedly with `starting_after` cursor from each response\n- Search thread: Use `search` parameter with "thread:UUID" format\n- Filter unread: Use `is_unread=true` parameter\n\n**Note:** Email datasets are typically massive. Filtering by `campaign_id` significantly improves performance and reduces response size.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of items per page (1-100, default: 100)', minimum: 1, maximum: 100 },
        starting_after: { type: 'string', description: 'Pagination cursor from previous response (use value from next_starting_after field)' },
        search: { type: 'string', description: 'Search by email address or thread. Use "thread:UUID" format to search specific thread' },
        campaign_id: { type: 'string', description: 'Filter by campaign ID (UUID format)' },
        i_status: { type: 'number', description: 'Filter by interest status' },
        eaccount: { type: 'string', description: 'Filter by sender email account. Comma-separated for multiple accounts' },
        is_unread: { type: 'boolean', description: 'Filter unread emails (true/false)' },
        has_reminder: { type: 'boolean', description: 'Filter emails with reminders (true/false)' },
        mode: { type: 'string', description: 'Filter by mode', enum: ['emode_focused', 'emode_others', 'emode_all'] },
        preview_only: { type: 'boolean', description: 'Return only email previews (true/false)' },
        sort_order: { type: 'string', description: 'Sort order by creation date', enum: ['asc', 'desc'] },
        scheduled_only: { type: 'boolean', description: 'Filter scheduled emails only (true/false)' },
        assigned_to: { type: 'string', description: 'Filter by assigned user ID (UUID format)' },
        lead: { type: 'string', description: 'Filter by lead email address' },
        company_domain: { type: 'string', description: 'Filter by company domain' },
        marked_as_done: { type: 'boolean', description: 'Filter emails marked as done (true/false)' },
        email_type: { type: 'string', description: 'Filter by email type', enum: ['received', 'sent', 'manual'] }
      },
      additionalProperties: false
    }
  },

  {
    name: 'get_email',
    description: 'Get email details by ID',
    inputSchema: {
      type: 'object',
      properties: {
        email_id: { type: 'string', description: 'Email ID' }
      },
      required: ['email_id'],
      additionalProperties: false
    }
  },

  {
    name: 'reply_to_email',
    description: '🚨 CRITICAL WARNING: SENDS REAL EMAILS TO REAL PEOPLE!\n\n⚠️⚠️⚠️ THIS TOOL SENDS ACTUAL EMAIL REPLIES ⚠️⚠️⚠️\n\n🛑 BEFORE CALLING THIS TOOL:\n\n1️⃣ **ALWAYS CONFIRM WITH USER FIRST**:\n   • Show the recipient email address\n   • Show the complete email body\n   • Show the subject line\n   • Get explicit "yes" confirmation before sending\n   • NEVER send without user approval\n\n2️⃣ **VERIFY RECIPIENT**:\n   • Ensure you have permission to email this person\n   • Verify the email address is correct\n   • Confirm this is the intended recipient\n   • Check if this is a test or production email\n\n3️⃣ **REVIEW CONTENT**:\n   • Proofread the email body for errors\n   • Verify tone and professionalism\n   • Check for personalization accuracy\n   • Ensure no placeholder text remains ({{firstName}}, etc.)\n\n⚠️ CRITICAL REQUIREMENTS:\n\n1️⃣ **USER CONFIRMATION REQUIRED**:\n   • MUST ask user: "Ready to send this email to [recipient]? Please confirm."\n   • MUST show complete email content before sending\n   • MUST wait for explicit approval\n   • NEVER send automatically\n\n2️⃣ **VALID PARAMETERS**:\n   • reply_to_uuid: Get from list_emails or get_email\n   • eaccount: Must be a connected sender account from your workspace\n   • subject: Should be relevant to original email (often "Re: [original subject]")\n   • body: Must include either html or text (or both)\n\n3️⃣ **SENDER ACCOUNT VERIFICATION**:\n   • eaccount must be active and connected\n   • Account must have permission to send\n   • Use list_accounts to verify account status\n\n📚 COMMON USER REQUEST EXAMPLES:\n\n1️⃣ "Reply to this email":\n   → Get email details with get_email or list_emails\n   → Extract reply_to_uuid from email\n   → Draft reply content\n   → SHOW USER: "I will send this reply to [recipient]: [body]"\n   → WAIT FOR: User confirmation\n   → THEN: Call reply_to_email\n\n2️⃣ "Send a follow-up to lead X":\n   → Find email with list_emails (filter by lead)\n   → Get reply_to_uuid\n   → Draft follow-up content\n   → CONFIRM WITH USER before sending\n   → Send reply\n\n💡 EMAIL BODY FORMAT:\n\n**Option 1 - HTML Only**:\n```json\n{\n  "body": {\n    "html": "<p>Hi John,</p><p>Thanks for your interest...</p>"\n  }\n}\n```\n\n**Option 2 - Text Only**:\n```json\n{\n  "body": {\n    "text": "Hi John,\\n\\nThanks for your interest..."\n  }\n}\n```\n\n**Option 3 - Both** (Recommended):\n```json\n{\n  "body": {\n    "html": "<p>Hi John,</p><p>Thanks for your interest...</p>",\n    "text": "Hi John,\\n\\nThanks for your interest..."\n  }\n}\n```\n\n⏱️ PERFORMANCE NOTE:\n• Email sends immediately (< 2 seconds)\n• Cannot be undone once sent\n• Recipient receives email in real-time\n• Affects sender reputation if email bounces or marked as spam\n\n🎯 BEST PRACTICES:\n\n1. **Always confirm with user** before sending\n2. **Show complete email content** for review\n3. **Verify recipient email** is correct\n4. **Use professional tone** and proper grammar\n5. **Include both HTML and text** versions when possible\n6. **Test with your own email** first if unsure\n7. **Check sender account** is active and warmed up\n\n🚨 WHAT CAN GO WRONG:\n\n• ❌ Sending to wrong recipient (cannot undo!)\n• ❌ Typos or errors in email body (cannot edit after send!)\n• ❌ Unprofessional content damaging reputation\n• ❌ Sending from inactive account (email fails)\n• ❌ Placeholder text not replaced ({{firstName}} sent as-is)\n• ❌ Spam complaints hurting sender reputation\n\nReply to an email - SENDS REAL EMAILS! Always confirm with user first. Show recipient and content before sending. Cannot be undone.',
    inputSchema: {
      type: 'object',
      properties: {
        reply_to_uuid: {
          type: 'string',
          description: 'The UUID of the email to reply to (REQUIRED). Get from list_emails or get_email response. Example: "email-uuid-here"'
        },
        eaccount: {
          type: 'string',
          description: 'The email account that will send this reply (REQUIRED). Must be a connected sender account from your workspace. Get from list_accounts. Example: "sender@yourdomain.com"'
        },
        subject: {
          type: 'string',
          description: 'Subject line of the reply email (REQUIRED). Often "Re: [original subject]". Example: "Re: Your inquiry about our services"'
        },
        body: {
          type: 'object',
          description: 'Email body content (REQUIRED). Must include html, text, or both. Recommended: Include both for best compatibility.',
          properties: {
            html: { type: 'string', description: 'HTML content of the email. Example: "<p>Hi John,</p><p>Thanks for reaching out...</p>"' },
            text: { type: 'string', description: 'Plain text content of the email. Example: "Hi John,\\n\\nThanks for reaching out..."' }
          }
        }
      },
      required: ['reply_to_uuid', 'eaccount', 'subject', 'body'],
      additionalProperties: false
    }
  },

  {
    name: 'count_unread_emails',
    description: 'Count unread emails in inbox (read-only)',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  },

  {
    name: 'verify_email',
    description: '✅ VERIFY EMAIL ADDRESS DELIVERABILITY\n\nVerifies email address deliverability with comprehensive validation checks. Uses robust polling to wait for complete verification results.\n\n**Validation Checks:**\n- Syntax validation (proper email format)\n- Domain validation (MX records exist)\n- Mailbox validation (mailbox exists, when possible)\n- Deliverability score (0-100)\n\n**Returns:**\n- `status`: "valid", "invalid", "risky", "unknown", "catch-all"\n- `score`: Quality score 0-100 (higher is better)\n- `reason`: Explanation of verification result\n- `is_disposable`: True if temporary/disposable email service\n- `is_role_based`: True if role-based email (info@, support@, etc.)\n\n**Status Meanings:**\n- "valid" or "deliverable": Email is good, safe to use\n- "risky" or "unknown": Email might work, use with caution\n- "invalid" or "undeliverable": Email will bounce\n- "catch-all": Domain accepts all emails, cannot verify mailbox\n\n**Performance:**\n- Most emails: 5-15 seconds (waits for complete verification)\n- Slow domains (gmail.com, outlook.com, instantly.ai, etc.): Up to 45 seconds\n- Uses intelligent polling with 2-second intervals\n- Real-time check against mail servers\n\n**Timeout Handling:**\n- If verification exceeds timeout (30-45s depending on domain), returns timeout status\n- Verification continues on Instantly servers - retry after 1-2 minutes\n\n**Note:** For bulk verification (10+ emails), use `verify_leads_on_import` parameter in `create_lead` instead of verifying individually.',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email address to verify (must be valid format: user@domain.com). Example: "john@acme.com"' }
      },
      required: ['email'],
      additionalProperties: false
    }
  },
];

