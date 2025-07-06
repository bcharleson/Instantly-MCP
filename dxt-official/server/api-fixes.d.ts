export declare const API_ENDPOINTS: {
    campaigns: string;
    accounts: string;
    leads: string;
    apiKeys: string;
    emails: string;
    leadLists: string;
    emailVerification: string;
    campaignAnalytics: string;
    campaignAnalyticsOverview: string;
    accountWarmup: string;
    sendEmail: string;
    replyEmail: string;
    listLeads: string;
    createLead: string;
    updateLead: string;
    moveLeads: string;
};
export declare const API_METHODS: {
    listCampaigns: string;
    getCampaign: string;
    listAccounts: string;
    listLeads: string;
    listEmails: string;
    listApiKeys: string;
    listLeadLists: string;
    getCampaignAnalytics: string;
    getCampaignAnalyticsOverview: string;
    createCampaign: string;
    createAccount: string;
    createLead: string;
    createApiKey: string;
    createLeadList: string;
    sendEmail: string;
    verifyEmail: string;
    activateCampaign: string;
    getWarmupAnalytics: string;
    moveLeads: string;
    replyToEmail: string;
    updateCampaign: string;
    updateAccount: string;
    updateLead: string;
};
export declare const REQUIRED_FIELDS: {
    createAccount: {
        required: string[];
        optional: string[];
    };
    createCampaign: {
        required: string[];
        optional: string[];
    };
};
