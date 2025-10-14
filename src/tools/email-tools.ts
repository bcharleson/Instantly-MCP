/**
 * Instantly MCP Server - Email Tools
 *
 * Tool definitions for email management and communication operations.
 * Total: 5 email tools
 */

export const emailTools = [
  {
    name: 'list_emails',
    description: 'List emails with pagination (limit, starting_after from next_starting_after). Filter by campaign_id (recommended for large datasets), search, eaccount, is_unread, email_type. Use next_starting_after cursor for next page.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Items per page (1-100, default: 100)', minimum: 1, maximum: 100 },
        starting_after: { type: 'string', description: 'Cursor from next_starting_after' },
        search: { type: 'string', description: 'Email/thread search (use "thread:UUID")' },
        campaign_id: { type: 'string', description: 'Campaign ID (recommended)' },
        i_status: { type: 'number', description: 'Interest status' },
        eaccount: { type: 'string', description: 'Sender account (comma-separated)' },
        is_unread: { type: 'boolean', description: 'Unread filter' },
        has_reminder: { type: 'boolean', description: 'Reminder filter' },
        mode: { type: 'string', description: 'Mode filter', enum: ['emode_focused', 'emode_others', 'emode_all'] },
        preview_only: { type: 'boolean', description: 'Preview only' },
        sort_order: { type: 'string', description: 'Sort order', enum: ['asc', 'desc'] },
        scheduled_only: { type: 'boolean', description: 'Scheduled only' },
        assigned_to: { type: 'string', description: 'Assigned user ID' },
        lead: { type: 'string', description: 'Lead email' },
        company_domain: { type: 'string', description: 'Company domain' },
        marked_as_done: { type: 'boolean', description: 'Marked as done' },
        email_type: { type: 'string', description: 'Email type', enum: ['received', 'sent', 'manual'] }
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
    description: '🚨 SENDS REAL EMAILS! ⚠️ ALWAYS confirm with user BEFORE calling - show recipient, subject, body. Get explicit approval. Cannot undo! Requires: reply_to_uuid (from list_emails), eaccount (active sender), subject, body (html/text).',
    inputSchema: {
      type: 'object',
      properties: {
        reply_to_uuid: {
          type: 'string',
          description: 'Email UUID to reply to (from list_emails)'
        },
        eaccount: {
          type: 'string',
          description: 'Sender account (must be active)'
        },
        subject: {
          type: 'string',
          description: 'Subject line (e.g., "Re: [original]")'
        },
        body: {
          type: 'object',
          description: 'Email body (html/text or both)',
          properties: {
            html: { type: 'string', description: 'HTML content' },
            text: { type: 'string', description: 'Plain text content' }
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
    description: 'Verify email deliverability (5-45s). Returns status (valid/invalid/risky/unknown/catch-all), score (0-100), reason, is_disposable, is_role_based. For bulk (10+), use verify_leads_on_import in create_lead instead.',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email to verify (user@domain.com)' }
      },
      required: ['email'],
      additionalProperties: false
    }
  },
];

