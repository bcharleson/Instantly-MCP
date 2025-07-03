#!/usr/bin/env node
/**
 * Zod Validation Schemas for Instantly MCP Server
 *
 * This module provides type-safe validation for all tool inputs using Zod schemas.
 * It replaces manual validation functions with comprehensive, reusable schemas
 * that provide better error messages and TypeScript inference.
 */
import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
// ============================================================================
// COMMON VALIDATION SCHEMAS
// ============================================================================
/**
 * Email validation schema with comprehensive error messages
 */
export const EmailSchema = z
    .string()
    .email('Invalid email format. Must be a valid email address (e.g., user@domain.com)')
    .min(1, 'Email address cannot be empty');
/**
 * Timezone validation schema - exact values from Instantly API documentation
 */
export const TimezoneSchema = z.enum([
    "Etc/GMT+12", "Etc/GMT+11", "Etc/GMT+10", "America/Anchorage", "America/Dawson",
    "America/Creston", "America/Chihuahua", "America/Boise", "America/Belize",
    "America/Chicago", "America/New_York", "America/Denver", "America/Los_Angeles",
    "Europe/London", "Europe/Paris", "Asia/Tokyo", "Asia/Singapore", "Australia/Sydney"
], {
    errorMap: (issue, ctx) => ({
        message: `Invalid timezone: ${ctx.data}. Must be one of the supported Instantly API timezones.`
    })
});
/**
 * Time format validation (HH:MM)
 */
export const TimeFormatSchema = z
    .string()
    .regex(/^([01][0-9]|2[0-3]):([0-5][0-9])$/, 'Invalid time format. Must be HH:MM format (e.g., 09:00, 17:30)');
/**
 * Date format validation (YYYY-MM-DD)
 */
export const DateFormatSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Must be YYYY-MM-DD format (e.g., 2024-01-15)');
/**
 * Campaign stage validation
 */
export const CampaignStageSchema = z.enum(['prerequisite_check', 'preview', 'create'], {
    errorMap: () => ({
        message: 'Invalid stage. Must be one of: prerequisite_check, preview, create'
    })
});
/**
 * Pagination limit schema - supports both number and "all" string
 */
export const PaginationLimitSchema = z.union([
    z.number().int().min(1).max(100),
    z.literal("all")
], {
    errorMap: () => ({
        message: 'Limit must be a number between 1-100 or the string "all" for complete pagination'
    })
});
/**
 * Days configuration schema for campaign scheduling
 */
export const DaysConfigSchema = z.object({
    monday: z.boolean().optional(),
    tuesday: z.boolean().optional(),
    wednesday: z.boolean().optional(),
    thursday: z.boolean().optional(),
    friday: z.boolean().optional(),
    saturday: z.boolean().optional(),
    sunday: z.boolean().optional()
}).optional();
// ============================================================================
// TOOL-SPECIFIC VALIDATION SCHEMAS
// ============================================================================
/**
 * Campaign creation validation schema
 * Comprehensive validation for all campaign parameters
 */
export const CreateCampaignSchema = z.object({
    // Workflow control
    stage: CampaignStageSchema.optional(),
    confirm_creation: z.boolean().optional(),
    // Required campaign fields
    name: z.string()
        .min(1, 'Campaign name cannot be empty')
        .max(255, 'Campaign name cannot exceed 255 characters'),
    subject: z.string()
        .min(1, 'Subject line cannot be empty')
        .max(255, 'Subject line cannot exceed 255 characters'),
    body: z.string()
        .min(1, 'Email body cannot be empty')
        .refine((val) => typeof val === 'string', 'Body must be a plain string, not an object or array')
        .refine((val) => !val.includes('\\"') && !val.includes('\\t') && !val.includes('\\r'), 'Body contains escaped characters. Use actual \\n characters, not escaped JSON')
        .refine((val) => {
        // Check for potentially problematic HTML tags (allow <p>, <br>, <br/> for formatting)
        if (val.includes('<') && val.includes('>')) {
            // Allow specific formatting tags that are safe and enhance visual rendering
            const allowedTags = /<\/?(?:p|br|br\/)>/gi;
            const bodyWithoutAllowedTags = val.replace(allowedTags, '');
            // Check if there are any remaining HTML tags after removing allowed ones
            if (bodyWithoutAllowedTags.includes('<') && bodyWithoutAllowedTags.includes('>')) {
                return false;
            }
        }
        return true;
    }, 'Body contains unsupported HTML tags. Only <p>, <br>, and <br/> tags are allowed for formatting. Use plain text with \\n for line breaks. Example: "Hi {{firstName}},\\n\\nYour message here."'),
    email_list: z.array(EmailSchema)
        .min(1, 'At least one email address is required')
        .max(100, 'Cannot specify more than 100 email addresses'),
    // Optional scheduling parameters
    timezone: TimezoneSchema.optional(),
    timing_from: TimeFormatSchema.optional(),
    timing_to: TimeFormatSchema.optional(),
    days: DaysConfigSchema,
    // Optional campaign settings
    daily_limit: z.number().int().min(1).max(1000).optional(),
    email_gap_minutes: z.number().int().min(1).max(1440).optional(),
    // Sequence parameters (multi-step improvements)
    sequence_steps: z.number().int().min(1).max(10).optional(),
    sequence_bodies: z.array(z.string()).optional(),
    sequence_subjects: z.array(z.string()).optional(),
    continue_thread: z.boolean().optional(),
    // Tracking settings
    open_tracking: z.boolean().optional(),
    link_tracking: z.boolean().optional(),
    stop_on_reply: z.boolean().optional()
}).refine((data) => {
    // Validate sequence_bodies length matches sequence_steps
    if (data.sequence_steps && data.sequence_bodies) {
        return data.sequence_bodies.length >= data.sequence_steps;
    }
    return true;
}, {
    message: 'sequence_bodies array must contain at least as many items as sequence_steps',
    path: ['sequence_bodies']
}).refine((data) => {
    // Validate sequence_subjects length matches sequence_steps
    if (data.sequence_steps && data.sequence_subjects) {
        return data.sequence_subjects.length >= data.sequence_steps;
    }
    return true;
}, {
    message: 'sequence_subjects array must contain at least as many items as sequence_steps',
    path: ['sequence_subjects']
});
/**
 * List accounts validation schema
 */
export const ListAccountsSchema = z.object({
    limit: PaginationLimitSchema.optional(),
    starting_after: z.string().optional(),
    get_all: z.boolean().optional()
});
/**
 * List campaigns validation schema
 */
export const ListCampaignsSchema = z.object({
    limit: PaginationLimitSchema.optional(),
    starting_after: z.string().optional(),
    get_all: z.boolean().optional(),
    search: z.string().optional(),
    status: z.string().optional()
});
/**
 * Warmup analytics validation schema
 */
export const GetWarmupAnalyticsSchema = z.object({
    emails: z.array(EmailSchema)
        .min(1, 'At least one email address is required')
        .max(100, 'Cannot specify more than 100 email addresses'),
    start_date: DateFormatSchema.optional(),
    end_date: DateFormatSchema.optional()
});
/**
 * Email verification validation schema
 */
export const VerifyEmailSchema = z.object({
    email: EmailSchema
});
/**
 * Get campaign validation schema
 */
export const GetCampaignSchema = z.object({
    campaign_id: z.string().min(1, 'Campaign ID cannot be empty')
});
/**
 * Update campaign validation schema
 */
export const UpdateCampaignSchema = z.object({
    campaign_id: z.string().min(1, 'Campaign ID cannot be empty'),
    name: z.string().min(1).max(255).optional(),
    status: z.string().optional()
});
/**
 * Campaign analytics validation schema
 */
export const GetCampaignAnalyticsSchema = z.object({
    campaign_id: z.string().optional(),
    start_date: DateFormatSchema.optional(),
    end_date: DateFormatSchema.optional()
});
/**
 * Create account validation schema
 */
export const CreateAccountSchema = z.object({
    email: EmailSchema,
    password: z.string().min(1, 'Password cannot be empty'),
    smtp_host: z.string().min(1, 'SMTP host cannot be empty'),
    smtp_port: z.number().int().min(1).max(65535),
    smtp_username: z.string().min(1, 'SMTP username cannot be empty'),
    smtp_password: z.string().min(1, 'SMTP password cannot be empty')
});
/**
 * Update account validation schema
 */
export const UpdateAccountSchema = z.object({
    email: EmailSchema,
    daily_limit: z.number().int().min(1).max(1000).optional(),
    warmup_enabled: z.boolean().optional()
});
/**
 * Lead creation validation schema
 */
export const CreateLeadSchema = z.object({
    email: EmailSchema,
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    companyName: z.string().optional(),
    personalization: z.record(z.string()).optional()
});
/**
 * Update lead validation schema
 */
export const UpdateLeadSchema = z.object({
    lead_id: z.string().min(1, 'Lead ID cannot be empty'),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    company_name: z.string().optional(),
    personalization: z.record(z.string()).optional()
});
/**
 * List leads validation schema
 */
export const ListLeadsSchema = z.object({
    campaign_id: z.string().optional(),
    list_id: z.string().optional(),
    status: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    starting_after: z.string().optional()
});
/**
 * Create lead list validation schema
 */
export const CreateLeadListSchema = z.object({
    name: z.string().min(1, 'Lead list name cannot be empty'),
    description: z.string().optional()
});
/**
 * List lead lists validation schema
 */
export const ListLeadListsSchema = z.object({
    limit: z.number().int().min(1).max(100).optional(),
    starting_after: z.string().optional()
});
/**
 * Reply to email validation schema
 */
export const ReplyToEmailSchema = z.object({
    reply_to_uuid: z.string()
        .min(1, 'Reply to UUID cannot be empty')
        .refine((val) => val !== 'test-uuid', 'reply_to_uuid must be a valid email ID. Use list_emails or get_email tools first to obtain a valid email UUID.'),
    body: z.object({
        html: z.string().optional(),
        text: z.string().optional()
    }).refine((val) => val.html || val.text, 'Body must contain either html or text content')
});
/**
 * List emails validation schema
 */
export const ListEmailsSchema = z.object({
    campaign_id: z.string().optional(),
    account_id: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    starting_after: z.string().optional()
});
/**
 * Get email validation schema
 */
export const GetEmailSchema = z.object({
    email_id: z.string().min(1, 'Email ID cannot be empty')
});
/**
 * Validate campaign accounts validation schema
 */
export const ValidateCampaignAccountsSchema = z.object({
    email_list: z.array(EmailSchema).optional()
});
/**
 * Get account details validation schema
 */
export const GetAccountDetailsSchema = z.object({
    email: EmailSchema
});
// ============================================================================
// VALIDATION HELPER FUNCTIONS
// ============================================================================
/**
 * Generic validation function that converts Zod errors to McpError
 */
export function validateWithSchema(schema, data, toolName) {
    try {
        return schema.parse(data);
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors.map(err => {
                const path = err.path.length > 0 ? `${err.path.join('.')}: ` : '';
                return `${path}${err.message}`;
            });
            throw new McpError(ErrorCode.InvalidParams, `${toolName} validation failed: ${errorMessages.join('; ')}. Please check your input parameters and try again.`);
        }
        // Re-throw non-Zod errors
        throw error;
    }
}
/**
 * Validate campaign creation data with enhanced error messages
 */
export function validateCampaignData(args) {
    return validateWithSchema(CreateCampaignSchema, args, 'create_campaign');
}
/**
 * Validate list accounts parameters
 */
export function validateListAccountsData(args) {
    return validateWithSchema(ListAccountsSchema, args, 'list_accounts');
}
/**
 * Validate list campaigns parameters
 */
export function validateListCampaignsData(args) {
    return validateWithSchema(ListCampaignsSchema, args, 'list_campaigns');
}
/**
 * Validate warmup analytics parameters
 */
export function validateWarmupAnalyticsData(args) {
    return validateWithSchema(GetWarmupAnalyticsSchema, args, 'get_warmup_analytics');
}
/**
 * Validate email verification parameters
 */
export function validateEmailVerificationData(args) {
    return validateWithSchema(VerifyEmailSchema, args, 'verify_email');
}
/**
 * Validate get campaign parameters
 */
export function validateGetCampaignData(args) {
    return validateWithSchema(GetCampaignSchema, args, 'get_campaign');
}
/**
 * Validate update campaign parameters
 */
export function validateUpdateCampaignData(args) {
    return validateWithSchema(UpdateCampaignSchema, args, 'update_campaign');
}
/**
 * Validate campaign analytics parameters
 */
export function validateCampaignAnalyticsData(args) {
    return validateWithSchema(GetCampaignAnalyticsSchema, args, 'get_campaign_analytics');
}
/**
 * Validate create account parameters
 */
export function validateCreateAccountData(args) {
    return validateWithSchema(CreateAccountSchema, args, 'create_account');
}
/**
 * Validate update account parameters
 */
export function validateUpdateAccountData(args) {
    return validateWithSchema(UpdateAccountSchema, args, 'update_account');
}
/**
 * Validate create lead parameters
 */
export function validateCreateLeadData(args) {
    return validateWithSchema(CreateLeadSchema, args, 'create_lead');
}
/**
 * Validate update lead parameters
 */
export function validateUpdateLeadData(args) {
    return validateWithSchema(UpdateLeadSchema, args, 'update_lead');
}
/**
 * Validate list leads parameters
 */
export function validateListLeadsData(args) {
    return validateWithSchema(ListLeadsSchema, args, 'list_leads');
}
/**
 * Validate create lead list parameters
 */
export function validateCreateLeadListData(args) {
    return validateWithSchema(CreateLeadListSchema, args, 'create_lead_list');
}
/**
 * Validate list lead lists parameters
 */
export function validateListLeadListsData(args) {
    return validateWithSchema(ListLeadListsSchema, args, 'list_lead_lists');
}
/**
 * Validate reply to email parameters
 */
export function validateReplyToEmailData(args) {
    return validateWithSchema(ReplyToEmailSchema, args, 'reply_to_email');
}
/**
 * Validate list emails parameters
 */
export function validateListEmailsData(args) {
    return validateWithSchema(ListEmailsSchema, args, 'list_emails');
}
/**
 * Validate get email parameters
 */
export function validateGetEmailData(args) {
    return validateWithSchema(GetEmailSchema, args, 'get_email');
}
/**
 * Validate campaign accounts parameters
 */
export function validateCampaignAccountsData(args) {
    return validateWithSchema(ValidateCampaignAccountsSchema, args, 'validate_campaign_accounts');
}
/**
 * Validate get account details parameters
 */
export function validateGetAccountDetailsData(args) {
    return validateWithSchema(GetAccountDetailsSchema, args, 'get_account_details');
}
// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================
// ============================================================================
// VALIDATION MAPPING SYSTEM
// ============================================================================
/**
 * Mapping of tool names to their validation functions
 * This provides a centralized way to validate any tool's parameters
 */
export const TOOL_VALIDATORS = {
    // Campaign Management
    'create_campaign': validateCampaignData,
    'get_campaign': validateGetCampaignData,
    'update_campaign': validateUpdateCampaignData,
    'get_campaign_analytics': validateCampaignAnalyticsData,
    'get_campaign_analytics_overview': validateCampaignAnalyticsData,
    // Account Management
    'list_accounts': validateListAccountsData,
    'create_account': validateCreateAccountData,
    'update_account': validateUpdateAccountData,
    'get_warmup_analytics': validateWarmupAnalyticsData,
    // Lead Management
    'list_leads': validateListLeadsData,
    'create_lead': validateCreateLeadData,
    'update_lead': validateUpdateLeadData,
    // Lead Lists
    'list_lead_lists': validateListLeadListsData,
    'create_lead_list': validateCreateLeadListData,
    // Email Operations
    'reply_to_email': validateReplyToEmailData,
    'list_emails': validateListEmailsData,
    'get_email': validateGetEmailData,
    // Email Verification
    'verify_email': validateEmailVerificationData,
    // Campaign Management
    'list_campaigns': validateListCampaignsData,
    // Debugging Tools
    'validate_campaign_accounts': validateCampaignAccountsData,
    'get_account_details': validateGetAccountDetailsData,
    // Tools with no parameters (empty validation)
    'activate_campaign': () => ({}),
    'list_api_keys': () => ({}),
    'check_feature_availability': () => ({})
};
/**
 * Universal validation function that automatically selects the right validator
 * for any tool based on its name
 */
export function validateToolParameters(toolName, args) {
    const validator = TOOL_VALIDATORS[toolName];
    if (!validator) {
        // For tools without specific validation, just return the args as-is
        console.warn(`[Zod Validation] No validator found for tool: ${toolName}`);
        return args;
    }
    try {
        return validator(args);
    }
    catch (error) {
        // Add tool context to error messages
        if (error instanceof McpError) {
            throw error;
        }
        throw new McpError(ErrorCode.InvalidParams, `Validation failed for ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================
/**
 * Legacy email validation function - now uses Zod internally
 * Maintained for backward compatibility
 */
export const isValidEmail = (email) => {
    try {
        EmailSchema.parse(email);
        return true;
    }
    catch {
        return false;
    }
};
/**
 * Legacy campaign validation function - now uses Zod internally
 * Maintained for backward compatibility during transition
 */
export const validateCampaignDataLegacy = (args) => {
    try {
        validateCampaignData(args);
    }
    catch (error) {
        // Re-throw as the original function did
        throw error;
    }
};
//# sourceMappingURL=validation.js.map