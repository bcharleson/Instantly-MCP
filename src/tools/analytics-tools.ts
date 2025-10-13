/**
 * Instantly MCP Server - Analytics Tools
 * 
 * Tool definitions for analytics and reporting operations.
 * Total: 3 analytics tools
 */

export const analyticsTools = [
  {
    name: 'get_campaign_analytics',
    description: 'Get campaign performance metrics (opens, clicks, replies, bounces). Supports filtering by campaign ID(s) and date range.',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: {
          type: 'string',
          description: 'Single campaign ID (optional, omit for all campaigns)'
        },
        campaign_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Multiple campaign IDs (optional, use instead of campaign_id)'
        },
        start_date: {
          type: 'string',
          description: 'Start date (YYYY-MM-DD, optional)',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$'
        },
        end_date: {
          type: 'string',
          description: 'End date (YYYY-MM-DD, optional)',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$'
        },
        exclude_total_leads_count: {
          type: 'boolean',
          description: 'Exclude leads count for faster response (optional)'
        }
      },
      required: [],
      additionalProperties: false
    }
  },

  {
    name: 'get_daily_campaign_analytics',
    description: 'Get day-by-day campaign performance analytics with date filtering',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: {
          type: 'string',
          description: 'Campaign ID (optional, omit for all)',
          pattern: '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
        },
        start_date: {
          type: 'string',
          description: 'Start date (YYYY-MM-DD)',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$'
        },
        end_date: {
          type: 'string',
          description: 'End date (YYYY-MM-DD)',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$'
        },
        campaign_status: {
          type: 'number',
          description: 'Campaign status filter: 0=Draft, 1=Active, 2=Paused, 3=Completed, 4=Running Subsequences',
          enum: [0, 1, 2, 3, 4, -99, -1, -2]
        }
      },
      required: [],
      additionalProperties: false
    }
  },

  {
    name: 'get_warmup_analytics',
    description: 'Get email warmup analytics for one or more accounts',
    inputSchema: {
      type: 'object',
      properties: {
        emails: {
          type: 'array',
          items: { type: 'string' },
          description: 'Email addresses for warmup analytics'
        },
        email: {
          type: 'string',
          description: 'Single email address (alternative to emails array)'
        },
        start_date: {
          type: 'string',
          description: 'Start date (YYYY-MM-DD, optional)',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$'
        },
        end_date: {
          type: 'string',
          description: 'End date (YYYY-MM-DD, optional)',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$'
        }
      },
      required: [],
      additionalProperties: false
    }
  },
];

