/**
 * Analysis of Instantly API endpoints based on testing feedback
 */
// Email endpoints need to fetch email UUID first
export const EMAIL_ENDPOINTS = {
    // GET /emails to get list with UUIDs
    listEmails: '/emails',
    // GET /emails/:id to get specific email
    getEmail: '/emails/:id',
    // POST /emails for sending (might be different)
    sendEmail: '/emails/send', // or might be /send-email
    // POST /emails/:id/reply for replying
    replyEmail: '/emails/:id/reply'
};
// Campaign creation is complex with nested structures
export const CAMPAIGN_STRUCTURE = {
    name: 'string',
    account_id: 'string',
    from_email: 'string',
    from_name: 'string',
    subject: 'string',
    body: 'string',
    // These might be required nested objects
    settings: {
        tracking_enabled: true,
        click_tracking: true,
        reply_tracking: true
    },
    schedule: {
        timezone: 'UTC',
        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        hours: {
            start: '09:00',
            end: '17:00'
        }
    }
};
// Lead list creation might need different endpoint
export const LEAD_LIST_ENDPOINTS = {
    create: '/lists', // not /lists with POST
    list: '/lists',
    get: '/lists/:id',
    update: '/lists/:id',
    delete: '/lists/:id'
};
// Email verification might have different path
export const VERIFY_ENDPOINTS = {
    verify: '/verify-email', // or /email/verify
    bulkVerify: '/verify-emails',
    status: '/verify-email/status/:id'
};
//# sourceMappingURL=endpoint-analysis.js.map