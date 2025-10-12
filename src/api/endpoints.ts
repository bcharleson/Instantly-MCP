/**
 * Instantly MCP Server - API Endpoints
 * 
 * API endpoint path constants for Instantly.ai API v2.
 */

/**
 * Base API endpoints
 */
export const ENDPOINTS = {
  // Account endpoints
  ACCOUNTS: '/accounts',
  ACCOUNT_BY_EMAIL: (email: string) => `/accounts/${encodeURIComponent(email)}`,
  ACCOUNT_PAUSE: (email: string) => `/accounts/${encodeURIComponent(email)}/pause`,
  ACCOUNT_RESUME: (email: string) => `/accounts/${encodeURIComponent(email)}/resume`,
  WARMUP_ENABLE: '/accounts/warmup/enable',
  WARMUP_DISABLE: '/accounts/warmup/disable',
  WARMUP_ANALYTICS: '/accounts/warmup-analytics',
  ACCOUNT_VITALS: '/accounts/test/vitals',
  
  // Campaign endpoints
  CAMPAIGNS: '/campaigns',
  CAMPAIGN_BY_ID: (id: string) => `/campaigns/${id}`,
  CAMPAIGN_ACTIVATE: (id: string) => `/campaigns/${id}/activate`,
  CAMPAIGN_PAUSE: (id: string) => `/campaigns/${id}/pause`,
  CAMPAIGN_ANALYTICS: '/campaigns/analytics',
  CAMPAIGN_ANALYTICS_OVERVIEW: '/campaigns/analytics/overview',
  CAMPAIGN_ANALYTICS_DAILY: '/campaigns/analytics/daily',
  CAMPAIGN_SEARCH_BY_CONTACT: '/campaigns/search-by-contact',
  
  // Lead endpoints
  LEADS: '/leads',
  LEADS_LIST: '/leads/list',
  LEADS_BULK_ADD: '/leads/add',
  LEAD_BY_ID: (id: string) => `/leads/${id}`,
  
  // Lead List endpoints
  LEAD_LISTS: '/lead-lists',
  LEAD_LIST_BY_ID: (id: string) => `/lead-lists/${id}`,
  LEAD_LIST_VERIFICATION_STATS: (id: string) => `/lead-lists/${id}/verification-stats`,
  
  // Email endpoints
  EMAILS: '/emails',
  EMAIL_BY_ID: (id: string) => `/emails/${id}`,
  EMAIL_REPLY: '/emails/reply',
  EMAIL_UNREAD_COUNT: '/emails/unread/count',
  
  // Email Verification endpoints
  EMAIL_VERIFICATION: '/email-verification',
  EMAIL_VERIFICATION_BY_EMAIL: (email: string) => `/email-verification/${encodeURIComponent(email)}`,
  
  // API Key endpoints
  API_KEYS: '/api-keys',
  API_KEY_BY_ID: (id: string) => `/api-keys/${id}`
} as const;

