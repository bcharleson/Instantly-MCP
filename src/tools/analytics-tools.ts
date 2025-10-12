/**
 * Instantly MCP Server - Analytics Tools
 * 
 * Tool definitions for analytics and reporting operations.
 * Total: 3 analytics tools
 */

export const analyticsTools = [
  {
    name: 'get_campaign_analytics',
    description: 'Get campaign performance metrics, statistics, and analytics data (opens, clicks, replies, bounces, etc.). Use this tool when the user wants to see campaign performance, metrics, or statistics. NOT for listing campaigns themselves - use list_campaigns for that. Supports filtering by single campaign ID, multiple campaign IDs, and/or date range.',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: {
          type: 'string',
          description: 'Single campaign ID to filter analytics (optional). API receives this as "id" parameter. Omit to get analytics for all campaigns. Use this OR campaign_ids, not both.'
        },
        campaign_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of campaign IDs to filter analytics for multiple campaigns (optional). API receives this as "ids" parameter. Use this OR campaign_id, not both. Example: ["campaign-id-1", "campaign-id-2"]'
        },
        start_date: {
          type: 'string',
          description: 'Start date for analytics range in YYYY-MM-DD format (optional). Example: 2024-01-01',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$'
        },
        end_date: {
          type: 'string',
          description: 'End date for analytics range in YYYY-MM-DD format (optional). Example: 2024-12-31',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$'
        },
        exclude_total_leads_count: {
          type: 'boolean',
          description: 'Exclude total leads count from result to considerably decrease response time (optional). Default: false'
        }
      },
      required: [],
      additionalProperties: false
    }
  },

  {
    name: 'get_daily_campaign_analytics',
    description: 'Get daily campaign performance analytics with date filtering. Returns day-by-day analytics data for campaign performance tracking.',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: {
          type: 'string',
          description: 'Campaign ID (optional - omit for all campaigns). Example: "0199c64d-6999-7801-82bd-cf5e06198b3f"',
          pattern: '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
        },
        start_date: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format. Example: 2024-01-01',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$'
        },
        end_date: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format. Example: 2024-01-01',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$'
        },
        campaign_status: {
          type: 'number',
          description: 'Filter by campaign status (optional). Values: 0=Draft, 1=Active, 2=Paused, 3=Completed, 4=Running Subsequences, -99=Account Suspended, -1=Accounts Unhealthy, -2=Bounce Protect',
          enum: [0, 1, 2, 3, 4, -99, -1, -2]
        }
      },
      required: [],
      additionalProperties: false
    }
  },

  {
    name: 'get_warmup_analytics',
    description: 'Get email warmup analytics for one or more email accounts. Supports both single email and multiple emails.',
    inputSchema: {
      type: 'object',
      properties: {
        emails: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of email addresses to get warmup analytics for (e.g., ["user@example.com"])'
        },
        email: {
          type: 'string',
          description: 'Single email address (will be converted to array internally for API compatibility)'
        },
        start_date: {
          type: 'string',
          description: 'Start date for analytics range in YYYY-MM-DD format (optional)',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$'
        },
        end_date: {
          type: 'string',
          description: 'End date for analytics range in YYYY-MM-DD format (optional)',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$'
        }
      },
      required: [],
      additionalProperties: false
    }
  },
];

