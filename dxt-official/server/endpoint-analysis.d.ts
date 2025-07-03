/**
 * Analysis of Instantly API endpoints based on testing feedback
 */
export declare const EMAIL_ENDPOINTS: {
    listEmails: string;
    getEmail: string;
    sendEmail: string;
    replyEmail: string;
};
export declare const CAMPAIGN_STRUCTURE: {
    name: string;
    account_id: string;
    from_email: string;
    from_name: string;
    subject: string;
    body: string;
    settings: {
        tracking_enabled: boolean;
        click_tracking: boolean;
        reply_tracking: boolean;
    };
    schedule: {
        timezone: string;
        days: string[];
        hours: {
            start: string;
            end: string;
        };
    };
};
export declare const LEAD_LIST_ENDPOINTS: {
    create: string;
    list: string;
    get: string;
    update: string;
    delete: string;
};
export declare const VERIFY_ENDPOINTS: {
    verify: string;
    bulkVerify: string;
    status: string;
};
