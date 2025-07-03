#!/usr/bin/env node
/**
 * Zod Validation Schemas for Instantly MCP Server
 *
 * This module provides type-safe validation for all tool inputs using Zod schemas.
 * It replaces manual validation functions with comprehensive, reusable schemas
 * that provide better error messages and TypeScript inference.
 */
import { z } from 'zod';
/**
 * Email validation schema with comprehensive error messages
 */
export declare const EmailSchema: z.ZodString;
/**
 * Timezone validation schema - exact values from Instantly API documentation
 */
export declare const TimezoneSchema: z.ZodEnum<["Etc/GMT+12", "Etc/GMT+11", "Etc/GMT+10", "America/Anchorage", "America/Dawson", "America/Creston", "America/Chihuahua", "America/Boise", "America/Belize", "America/Chicago", "America/New_York", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Tokyo", "Asia/Singapore", "Australia/Sydney"]>;
/**
 * Time format validation (HH:MM)
 */
export declare const TimeFormatSchema: z.ZodString;
/**
 * Date format validation (YYYY-MM-DD)
 */
export declare const DateFormatSchema: z.ZodString;
/**
 * Campaign stage validation
 */
export declare const CampaignStageSchema: z.ZodEnum<["prerequisite_check", "preview", "create"]>;
/**
 * Pagination limit schema - supports both number and "all" string
 */
export declare const PaginationLimitSchema: z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"all">]>;
/**
 * Days configuration schema for campaign scheduling
 */
export declare const DaysConfigSchema: z.ZodOptional<z.ZodObject<{
    monday: z.ZodOptional<z.ZodBoolean>;
    tuesday: z.ZodOptional<z.ZodBoolean>;
    wednesday: z.ZodOptional<z.ZodBoolean>;
    thursday: z.ZodOptional<z.ZodBoolean>;
    friday: z.ZodOptional<z.ZodBoolean>;
    saturday: z.ZodOptional<z.ZodBoolean>;
    sunday: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    monday?: boolean | undefined;
    tuesday?: boolean | undefined;
    wednesday?: boolean | undefined;
    thursday?: boolean | undefined;
    friday?: boolean | undefined;
    saturday?: boolean | undefined;
    sunday?: boolean | undefined;
}, {
    monday?: boolean | undefined;
    tuesday?: boolean | undefined;
    wednesday?: boolean | undefined;
    thursday?: boolean | undefined;
    friday?: boolean | undefined;
    saturday?: boolean | undefined;
    sunday?: boolean | undefined;
}>>;
/**
 * Campaign creation validation schema
 * Comprehensive validation for all campaign parameters
 */
export declare const CreateCampaignSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    stage: z.ZodOptional<z.ZodEnum<["prerequisite_check", "preview", "create"]>>;
    confirm_creation: z.ZodOptional<z.ZodBoolean>;
    name: z.ZodString;
    subject: z.ZodString;
    body: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
    email_list: z.ZodArray<z.ZodString, "many">;
    timezone: z.ZodOptional<z.ZodEnum<["Etc/GMT+12", "Etc/GMT+11", "Etc/GMT+10", "America/Anchorage", "America/Dawson", "America/Creston", "America/Chihuahua", "America/Boise", "America/Belize", "America/Chicago", "America/New_York", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Tokyo", "Asia/Singapore", "Australia/Sydney"]>>;
    timing_from: z.ZodOptional<z.ZodString>;
    timing_to: z.ZodOptional<z.ZodString>;
    days: z.ZodOptional<z.ZodObject<{
        monday: z.ZodOptional<z.ZodBoolean>;
        tuesday: z.ZodOptional<z.ZodBoolean>;
        wednesday: z.ZodOptional<z.ZodBoolean>;
        thursday: z.ZodOptional<z.ZodBoolean>;
        friday: z.ZodOptional<z.ZodBoolean>;
        saturday: z.ZodOptional<z.ZodBoolean>;
        sunday: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        monday?: boolean | undefined;
        tuesday?: boolean | undefined;
        wednesday?: boolean | undefined;
        thursday?: boolean | undefined;
        friday?: boolean | undefined;
        saturday?: boolean | undefined;
        sunday?: boolean | undefined;
    }, {
        monday?: boolean | undefined;
        tuesday?: boolean | undefined;
        wednesday?: boolean | undefined;
        thursday?: boolean | undefined;
        friday?: boolean | undefined;
        saturday?: boolean | undefined;
        sunday?: boolean | undefined;
    }>>;
    daily_limit: z.ZodOptional<z.ZodNumber>;
    email_gap_minutes: z.ZodOptional<z.ZodNumber>;
    sequence_steps: z.ZodOptional<z.ZodNumber>;
    sequence_bodies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sequence_subjects: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    continue_thread: z.ZodOptional<z.ZodBoolean>;
    open_tracking: z.ZodOptional<z.ZodBoolean>;
    link_tracking: z.ZodOptional<z.ZodBoolean>;
    stop_on_reply: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    subject: string;
    body: string;
    email_list: string[];
    daily_limit?: number | undefined;
    stage?: "prerequisite_check" | "preview" | "create" | undefined;
    confirm_creation?: boolean | undefined;
    timezone?: "Etc/GMT+12" | "Etc/GMT+11" | "Etc/GMT+10" | "America/Anchorage" | "America/Dawson" | "America/Creston" | "America/Chihuahua" | "America/Boise" | "America/Belize" | "America/Chicago" | "America/New_York" | "America/Denver" | "America/Los_Angeles" | "Europe/London" | "Europe/Paris" | "Asia/Tokyo" | "Asia/Singapore" | "Australia/Sydney" | undefined;
    timing_from?: string | undefined;
    timing_to?: string | undefined;
    days?: {
        monday?: boolean | undefined;
        tuesday?: boolean | undefined;
        wednesday?: boolean | undefined;
        thursday?: boolean | undefined;
        friday?: boolean | undefined;
        saturday?: boolean | undefined;
        sunday?: boolean | undefined;
    } | undefined;
    email_gap_minutes?: number | undefined;
    sequence_steps?: number | undefined;
    sequence_bodies?: string[] | undefined;
    sequence_subjects?: string[] | undefined;
    continue_thread?: boolean | undefined;
    open_tracking?: boolean | undefined;
    link_tracking?: boolean | undefined;
    stop_on_reply?: boolean | undefined;
}, {
    name: string;
    subject: string;
    body: string;
    email_list: string[];
    daily_limit?: number | undefined;
    stage?: "prerequisite_check" | "preview" | "create" | undefined;
    confirm_creation?: boolean | undefined;
    timezone?: "Etc/GMT+12" | "Etc/GMT+11" | "Etc/GMT+10" | "America/Anchorage" | "America/Dawson" | "America/Creston" | "America/Chihuahua" | "America/Boise" | "America/Belize" | "America/Chicago" | "America/New_York" | "America/Denver" | "America/Los_Angeles" | "Europe/London" | "Europe/Paris" | "Asia/Tokyo" | "Asia/Singapore" | "Australia/Sydney" | undefined;
    timing_from?: string | undefined;
    timing_to?: string | undefined;
    days?: {
        monday?: boolean | undefined;
        tuesday?: boolean | undefined;
        wednesday?: boolean | undefined;
        thursday?: boolean | undefined;
        friday?: boolean | undefined;
        saturday?: boolean | undefined;
        sunday?: boolean | undefined;
    } | undefined;
    email_gap_minutes?: number | undefined;
    sequence_steps?: number | undefined;
    sequence_bodies?: string[] | undefined;
    sequence_subjects?: string[] | undefined;
    continue_thread?: boolean | undefined;
    open_tracking?: boolean | undefined;
    link_tracking?: boolean | undefined;
    stop_on_reply?: boolean | undefined;
}>, {
    name: string;
    subject: string;
    body: string;
    email_list: string[];
    daily_limit?: number | undefined;
    stage?: "prerequisite_check" | "preview" | "create" | undefined;
    confirm_creation?: boolean | undefined;
    timezone?: "Etc/GMT+12" | "Etc/GMT+11" | "Etc/GMT+10" | "America/Anchorage" | "America/Dawson" | "America/Creston" | "America/Chihuahua" | "America/Boise" | "America/Belize" | "America/Chicago" | "America/New_York" | "America/Denver" | "America/Los_Angeles" | "Europe/London" | "Europe/Paris" | "Asia/Tokyo" | "Asia/Singapore" | "Australia/Sydney" | undefined;
    timing_from?: string | undefined;
    timing_to?: string | undefined;
    days?: {
        monday?: boolean | undefined;
        tuesday?: boolean | undefined;
        wednesday?: boolean | undefined;
        thursday?: boolean | undefined;
        friday?: boolean | undefined;
        saturday?: boolean | undefined;
        sunday?: boolean | undefined;
    } | undefined;
    email_gap_minutes?: number | undefined;
    sequence_steps?: number | undefined;
    sequence_bodies?: string[] | undefined;
    sequence_subjects?: string[] | undefined;
    continue_thread?: boolean | undefined;
    open_tracking?: boolean | undefined;
    link_tracking?: boolean | undefined;
    stop_on_reply?: boolean | undefined;
}, {
    name: string;
    subject: string;
    body: string;
    email_list: string[];
    daily_limit?: number | undefined;
    stage?: "prerequisite_check" | "preview" | "create" | undefined;
    confirm_creation?: boolean | undefined;
    timezone?: "Etc/GMT+12" | "Etc/GMT+11" | "Etc/GMT+10" | "America/Anchorage" | "America/Dawson" | "America/Creston" | "America/Chihuahua" | "America/Boise" | "America/Belize" | "America/Chicago" | "America/New_York" | "America/Denver" | "America/Los_Angeles" | "Europe/London" | "Europe/Paris" | "Asia/Tokyo" | "Asia/Singapore" | "Australia/Sydney" | undefined;
    timing_from?: string | undefined;
    timing_to?: string | undefined;
    days?: {
        monday?: boolean | undefined;
        tuesday?: boolean | undefined;
        wednesday?: boolean | undefined;
        thursday?: boolean | undefined;
        friday?: boolean | undefined;
        saturday?: boolean | undefined;
        sunday?: boolean | undefined;
    } | undefined;
    email_gap_minutes?: number | undefined;
    sequence_steps?: number | undefined;
    sequence_bodies?: string[] | undefined;
    sequence_subjects?: string[] | undefined;
    continue_thread?: boolean | undefined;
    open_tracking?: boolean | undefined;
    link_tracking?: boolean | undefined;
    stop_on_reply?: boolean | undefined;
}>, {
    name: string;
    subject: string;
    body: string;
    email_list: string[];
    daily_limit?: number | undefined;
    stage?: "prerequisite_check" | "preview" | "create" | undefined;
    confirm_creation?: boolean | undefined;
    timezone?: "Etc/GMT+12" | "Etc/GMT+11" | "Etc/GMT+10" | "America/Anchorage" | "America/Dawson" | "America/Creston" | "America/Chihuahua" | "America/Boise" | "America/Belize" | "America/Chicago" | "America/New_York" | "America/Denver" | "America/Los_Angeles" | "Europe/London" | "Europe/Paris" | "Asia/Tokyo" | "Asia/Singapore" | "Australia/Sydney" | undefined;
    timing_from?: string | undefined;
    timing_to?: string | undefined;
    days?: {
        monday?: boolean | undefined;
        tuesday?: boolean | undefined;
        wednesday?: boolean | undefined;
        thursday?: boolean | undefined;
        friday?: boolean | undefined;
        saturday?: boolean | undefined;
        sunday?: boolean | undefined;
    } | undefined;
    email_gap_minutes?: number | undefined;
    sequence_steps?: number | undefined;
    sequence_bodies?: string[] | undefined;
    sequence_subjects?: string[] | undefined;
    continue_thread?: boolean | undefined;
    open_tracking?: boolean | undefined;
    link_tracking?: boolean | undefined;
    stop_on_reply?: boolean | undefined;
}, {
    name: string;
    subject: string;
    body: string;
    email_list: string[];
    daily_limit?: number | undefined;
    stage?: "prerequisite_check" | "preview" | "create" | undefined;
    confirm_creation?: boolean | undefined;
    timezone?: "Etc/GMT+12" | "Etc/GMT+11" | "Etc/GMT+10" | "America/Anchorage" | "America/Dawson" | "America/Creston" | "America/Chihuahua" | "America/Boise" | "America/Belize" | "America/Chicago" | "America/New_York" | "America/Denver" | "America/Los_Angeles" | "Europe/London" | "Europe/Paris" | "Asia/Tokyo" | "Asia/Singapore" | "Australia/Sydney" | undefined;
    timing_from?: string | undefined;
    timing_to?: string | undefined;
    days?: {
        monday?: boolean | undefined;
        tuesday?: boolean | undefined;
        wednesday?: boolean | undefined;
        thursday?: boolean | undefined;
        friday?: boolean | undefined;
        saturday?: boolean | undefined;
        sunday?: boolean | undefined;
    } | undefined;
    email_gap_minutes?: number | undefined;
    sequence_steps?: number | undefined;
    sequence_bodies?: string[] | undefined;
    sequence_subjects?: string[] | undefined;
    continue_thread?: boolean | undefined;
    open_tracking?: boolean | undefined;
    link_tracking?: boolean | undefined;
    stop_on_reply?: boolean | undefined;
}>;
/**
 * List accounts validation schema
 */
export declare const ListAccountsSchema: z.ZodObject<{
    limit: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"all">]>>;
    starting_after: z.ZodOptional<z.ZodString>;
    get_all: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    limit?: number | "all" | undefined;
    starting_after?: string | undefined;
    get_all?: boolean | undefined;
}, {
    limit?: number | "all" | undefined;
    starting_after?: string | undefined;
    get_all?: boolean | undefined;
}>;
/**
 * List campaigns validation schema
 */
export declare const ListCampaignsSchema: z.ZodObject<{
    limit: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"all">]>>;
    starting_after: z.ZodOptional<z.ZodString>;
    get_all: z.ZodOptional<z.ZodBoolean>;
    search: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    limit?: number | "all" | undefined;
    starting_after?: string | undefined;
    status?: string | undefined;
    get_all?: boolean | undefined;
    search?: string | undefined;
}, {
    limit?: number | "all" | undefined;
    starting_after?: string | undefined;
    status?: string | undefined;
    get_all?: boolean | undefined;
    search?: string | undefined;
}>;
/**
 * Warmup analytics validation schema
 */
export declare const GetWarmupAnalyticsSchema: z.ZodObject<{
    emails: z.ZodArray<z.ZodString, "many">;
    start_date: z.ZodOptional<z.ZodString>;
    end_date: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    emails: string[];
    start_date?: string | undefined;
    end_date?: string | undefined;
}, {
    emails: string[];
    start_date?: string | undefined;
    end_date?: string | undefined;
}>;
/**
 * Email verification validation schema
 */
export declare const VerifyEmailSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
/**
 * Get campaign validation schema
 */
export declare const GetCampaignSchema: z.ZodObject<{
    campaign_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    campaign_id: string;
}, {
    campaign_id: string;
}>;
/**
 * Update campaign validation schema
 */
export declare const UpdateCampaignSchema: z.ZodObject<{
    campaign_id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    campaign_id: string;
    name?: string | undefined;
    status?: string | undefined;
}, {
    campaign_id: string;
    name?: string | undefined;
    status?: string | undefined;
}>;
/**
 * Campaign analytics validation schema
 */
export declare const GetCampaignAnalyticsSchema: z.ZodObject<{
    campaign_id: z.ZodOptional<z.ZodString>;
    start_date: z.ZodOptional<z.ZodString>;
    end_date: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    start_date?: string | undefined;
    end_date?: string | undefined;
    campaign_id?: string | undefined;
}, {
    start_date?: string | undefined;
    end_date?: string | undefined;
    campaign_id?: string | undefined;
}>;
/**
 * Create account validation schema
 */
export declare const CreateAccountSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    smtp_host: z.ZodString;
    smtp_port: z.ZodNumber;
    smtp_username: z.ZodString;
    smtp_password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    smtp_host: string;
    smtp_port: number;
    smtp_username: string;
    smtp_password: string;
}, {
    email: string;
    password: string;
    smtp_host: string;
    smtp_port: number;
    smtp_username: string;
    smtp_password: string;
}>;
/**
 * Update account validation schema
 */
export declare const UpdateAccountSchema: z.ZodObject<{
    email: z.ZodString;
    daily_limit: z.ZodOptional<z.ZodNumber>;
    warmup_enabled: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    email: string;
    warmup_enabled?: boolean | undefined;
    daily_limit?: number | undefined;
}, {
    email: string;
    warmup_enabled?: boolean | undefined;
    daily_limit?: number | undefined;
}>;
/**
 * Lead creation validation schema
 */
export declare const CreateLeadSchema: z.ZodObject<{
    email: z.ZodString;
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    companyName: z.ZodOptional<z.ZodString>;
    personalization: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    email: string;
    firstName?: string | undefined;
    lastName?: string | undefined;
    companyName?: string | undefined;
    personalization?: Record<string, string> | undefined;
}, {
    email: string;
    firstName?: string | undefined;
    lastName?: string | undefined;
    companyName?: string | undefined;
    personalization?: Record<string, string> | undefined;
}>;
/**
 * Update lead validation schema
 */
export declare const UpdateLeadSchema: z.ZodObject<{
    lead_id: z.ZodString;
    first_name: z.ZodOptional<z.ZodString>;
    last_name: z.ZodOptional<z.ZodString>;
    company_name: z.ZodOptional<z.ZodString>;
    personalization: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    lead_id: string;
    personalization?: Record<string, string> | undefined;
    first_name?: string | undefined;
    last_name?: string | undefined;
    company_name?: string | undefined;
}, {
    lead_id: string;
    personalization?: Record<string, string> | undefined;
    first_name?: string | undefined;
    last_name?: string | undefined;
    company_name?: string | undefined;
}>;
/**
 * List leads validation schema
 */
export declare const ListLeadsSchema: z.ZodObject<{
    campaign_id: z.ZodOptional<z.ZodString>;
    list_id: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodNumber>;
    starting_after: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    limit?: number | undefined;
    starting_after?: string | undefined;
    status?: string | undefined;
    campaign_id?: string | undefined;
    list_id?: string | undefined;
}, {
    limit?: number | undefined;
    starting_after?: string | undefined;
    status?: string | undefined;
    campaign_id?: string | undefined;
    list_id?: string | undefined;
}>;
/**
 * Create lead list validation schema
 */
export declare const CreateLeadListSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | undefined;
}, {
    name: string;
    description?: string | undefined;
}>;
/**
 * List lead lists validation schema
 */
export declare const ListLeadListsSchema: z.ZodObject<{
    limit: z.ZodOptional<z.ZodNumber>;
    starting_after: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    limit?: number | undefined;
    starting_after?: string | undefined;
}, {
    limit?: number | undefined;
    starting_after?: string | undefined;
}>;
/**
 * Reply to email validation schema
 */
export declare const ReplyToEmailSchema: z.ZodObject<{
    reply_to_uuid: z.ZodEffects<z.ZodString, string, string>;
    body: z.ZodEffects<z.ZodObject<{
        html: z.ZodOptional<z.ZodString>;
        text: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        html?: string | undefined;
        text?: string | undefined;
    }, {
        html?: string | undefined;
        text?: string | undefined;
    }>, {
        html?: string | undefined;
        text?: string | undefined;
    }, {
        html?: string | undefined;
        text?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        html?: string | undefined;
        text?: string | undefined;
    };
    reply_to_uuid: string;
}, {
    body: {
        html?: string | undefined;
        text?: string | undefined;
    };
    reply_to_uuid: string;
}>;
/**
 * List emails validation schema
 */
export declare const ListEmailsSchema: z.ZodObject<{
    campaign_id: z.ZodOptional<z.ZodString>;
    account_id: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodNumber>;
    starting_after: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    account_id?: string | undefined;
    limit?: number | undefined;
    starting_after?: string | undefined;
    campaign_id?: string | undefined;
}, {
    account_id?: string | undefined;
    limit?: number | undefined;
    starting_after?: string | undefined;
    campaign_id?: string | undefined;
}>;
/**
 * Get email validation schema
 */
export declare const GetEmailSchema: z.ZodObject<{
    email_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email_id: string;
}, {
    email_id: string;
}>;
/**
 * Validate campaign accounts validation schema
 */
export declare const ValidateCampaignAccountsSchema: z.ZodObject<{
    email_list: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    email_list?: string[] | undefined;
}, {
    email_list?: string[] | undefined;
}>;
/**
 * Get account details validation schema
 */
export declare const GetAccountDetailsSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
/**
 * Generic validation function that converts Zod errors to McpError
 */
export declare function validateWithSchema<T>(schema: z.ZodSchema<T>, data: unknown, toolName: string): T;
/**
 * Validate campaign creation data with enhanced error messages
 */
export declare function validateCampaignData(args: unknown): z.infer<typeof CreateCampaignSchema>;
/**
 * Validate list accounts parameters
 */
export declare function validateListAccountsData(args: unknown): z.infer<typeof ListAccountsSchema>;
/**
 * Validate list campaigns parameters
 */
export declare function validateListCampaignsData(args: unknown): z.infer<typeof ListCampaignsSchema>;
/**
 * Validate warmup analytics parameters
 */
export declare function validateWarmupAnalyticsData(args: unknown): z.infer<typeof GetWarmupAnalyticsSchema>;
/**
 * Validate email verification parameters
 */
export declare function validateEmailVerificationData(args: unknown): z.infer<typeof VerifyEmailSchema>;
/**
 * Validate get campaign parameters
 */
export declare function validateGetCampaignData(args: unknown): z.infer<typeof GetCampaignSchema>;
/**
 * Validate update campaign parameters
 */
export declare function validateUpdateCampaignData(args: unknown): z.infer<typeof UpdateCampaignSchema>;
/**
 * Validate campaign analytics parameters
 */
export declare function validateCampaignAnalyticsData(args: unknown): z.infer<typeof GetCampaignAnalyticsSchema>;
/**
 * Validate create account parameters
 */
export declare function validateCreateAccountData(args: unknown): z.infer<typeof CreateAccountSchema>;
/**
 * Validate update account parameters
 */
export declare function validateUpdateAccountData(args: unknown): z.infer<typeof UpdateAccountSchema>;
/**
 * Validate create lead parameters
 */
export declare function validateCreateLeadData(args: unknown): z.infer<typeof CreateLeadSchema>;
/**
 * Validate update lead parameters
 */
export declare function validateUpdateLeadData(args: unknown): z.infer<typeof UpdateLeadSchema>;
/**
 * Validate list leads parameters
 */
export declare function validateListLeadsData(args: unknown): z.infer<typeof ListLeadsSchema>;
/**
 * Validate create lead list parameters
 */
export declare function validateCreateLeadListData(args: unknown): z.infer<typeof CreateLeadListSchema>;
/**
 * Validate list lead lists parameters
 */
export declare function validateListLeadListsData(args: unknown): z.infer<typeof ListLeadListsSchema>;
/**
 * Validate reply to email parameters
 */
export declare function validateReplyToEmailData(args: unknown): z.infer<typeof ReplyToEmailSchema>;
/**
 * Validate list emails parameters
 */
export declare function validateListEmailsData(args: unknown): z.infer<typeof ListEmailsSchema>;
/**
 * Validate get email parameters
 */
export declare function validateGetEmailData(args: unknown): z.infer<typeof GetEmailSchema>;
/**
 * Validate campaign accounts parameters
 */
export declare function validateCampaignAccountsData(args: unknown): z.infer<typeof ValidateCampaignAccountsSchema>;
/**
 * Validate get account details parameters
 */
export declare function validateGetAccountDetailsData(args: unknown): z.infer<typeof GetAccountDetailsSchema>;
/**
 * Mapping of tool names to their validation functions
 * This provides a centralized way to validate any tool's parameters
 */
export declare const TOOL_VALIDATORS: {
    readonly create_campaign: typeof validateCampaignData;
    readonly get_campaign: typeof validateGetCampaignData;
    readonly update_campaign: typeof validateUpdateCampaignData;
    readonly get_campaign_analytics: typeof validateCampaignAnalyticsData;
    readonly get_campaign_analytics_overview: typeof validateCampaignAnalyticsData;
    readonly list_accounts: typeof validateListAccountsData;
    readonly create_account: typeof validateCreateAccountData;
    readonly update_account: typeof validateUpdateAccountData;
    readonly get_warmup_analytics: typeof validateWarmupAnalyticsData;
    readonly list_leads: typeof validateListLeadsData;
    readonly create_lead: typeof validateCreateLeadData;
    readonly update_lead: typeof validateUpdateLeadData;
    readonly list_lead_lists: typeof validateListLeadListsData;
    readonly create_lead_list: typeof validateCreateLeadListData;
    readonly reply_to_email: typeof validateReplyToEmailData;
    readonly list_emails: typeof validateListEmailsData;
    readonly get_email: typeof validateGetEmailData;
    readonly verify_email: typeof validateEmailVerificationData;
    readonly list_campaigns: typeof validateListCampaignsData;
    readonly validate_campaign_accounts: typeof validateCampaignAccountsData;
    readonly get_account_details: typeof validateGetAccountDetailsData;
    readonly activate_campaign: () => {};
    readonly list_api_keys: () => {};
    readonly check_feature_availability: () => {};
};
/**
 * Universal validation function that automatically selects the right validator
 * for any tool based on its name
 */
export declare function validateToolParameters(toolName: string, args: unknown): any;
/**
 * Legacy email validation function - now uses Zod internally
 * Maintained for backward compatibility
 */
export declare const isValidEmail: (email: string) => boolean;
/**
 * Legacy campaign validation function - now uses Zod internally
 * Maintained for backward compatibility during transition
 */
export declare const validateCampaignDataLegacy: (args: any) => void;
