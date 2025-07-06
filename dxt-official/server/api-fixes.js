// Corrected API endpoint paths based on official Instantly v2 API documentation and testing
export const API_ENDPOINTS = {
    // Working endpoints (confirmed)
    campaigns: '/campaigns',
    accounts: '/accounts',
    leads: '/leads',
    apiKeys: '/api-keys',
    emails: '/emails',
    // Fixed endpoints (corrected paths)
    leadLists: '/lead-lists',
    emailVerification: '/email-verification',
    // Analytics endpoints
    campaignAnalytics: '/campaigns/analytics',
    campaignAnalyticsOverview: '/campaigns/analytics/overview',
    accountWarmup: '/accounts/warmup-analytics',
    // Email operations
    sendEmail: '/emails/send', // May need verification
    replyEmail: '/emails/{id}/reply',
    // Lead operations
    listLeads: '/leads', // Changed from /lead/list
    createLead: '/leads',
    updateLead: '/leads/{id}',
    moveLeads: '/leads/move',
};
// Endpoint method mappings
export const API_METHODS = {
    // GET endpoints
    listCampaigns: 'GET',
    getCampaign: 'GET',
    listAccounts: 'GET',
    listLeads: 'GET', // Changed from POST
    listEmails: 'GET',
    listApiKeys: 'GET',
    listLeadLists: 'GET',
    getCampaignAnalytics: 'GET',
    getCampaignAnalyticsOverview: 'GET',
    // POST endpoints
    createCampaign: 'POST',
    createAccount: 'POST',
    createLead: 'POST',
    createApiKey: 'POST',
    createLeadList: 'POST',
    sendEmail: 'POST',
    verifyEmail: 'POST',
    activateCampaign: 'POST',
    getWarmupAnalytics: 'POST', // Requires POST with data
    moveLeads: 'POST',
    replyToEmail: 'POST',
    // PATCH endpoints
    updateCampaign: 'PATCH',
    updateAccount: 'PATCH',
    updateLead: 'PATCH',
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
//# sourceMappingURL=api-fixes.js.map