// Based on testing feedback, here are the corrections needed:

// Correct endpoint paths based on Instantly v2 API:
export const API_ENDPOINTS = {
  // Working endpoints
  campaigns: '/campaigns',
  accounts: '/accounts', 
  leads: '/leads',
  
  // Endpoints that need correction (these returned 404)
  leadLists: '/lists', // likely should be /lists instead of /lead_lists
  apiKeys: '/api-key', // likely singular instead of plural
  emailVerification: '/verify', // simpler path
  emails: '/emails', // for sending emails
  
  // Analytics endpoints
  campaignAnalytics: '/analytics/campaigns',
  accountWarmup: '/accounts/warmup',
};

// Required fields for creating resources (to fix 400 errors)
export const REQUIRED_FIELDS = {
  createAccount: {
    required: ['email', 'username', 'password', 'smtp_host', 'smtp_port'],
    optional: ['provider', 'warmup_enabled', 'daily_limit']
  },
  createCampaign: {
    required: ['name', 'from_email', 'from_name', 'subject', 'body', 'account_id'],
    optional: ['reply_to', 'tracking_enabled', 'schedule']
  }
};