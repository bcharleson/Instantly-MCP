#!/usr/bin/env node
/**
 * Zod v4 Validation Schemas for Instantly MCP Server
 *
 * This module provides type-safe validation for all tool inputs using Zod v4 schemas.
 * It replaces manual validation functions with comprehensive, reusable schemas
 * that provide better error messages, improved performance, and TypeScript inference.
 *
 * Zod v4 Features Used:
 * - Unified 'error' parameter for cleaner error customization
 * - Top-level z.email() for better tree-shaking and performance
 * - Improved error message formatting and consistency
 */

import * as z from 'zod/v4';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// ============================================================================
// COMMON VALIDATION SCHEMAS
// ============================================================================

/**
 * Email validation schema with comprehensive error messages
 * Using Zod v4's top-level z.email() for better performance and tree-shaking
 */
export const EmailSchema = z
  .email({ error: 'Invalid email format. Must be a valid email address (e.g., user@domain.com)' })
  .min(1, { error: 'Email address cannot be empty' });

/**
 * Timezone validation schema - exact values from Instantly API documentation
 */
export const TimezoneSchema = z.enum([
  "Etc/GMT+12", "Etc/GMT+11", "Etc/GMT+10", "America/Anchorage", "America/Dawson",
  "America/Creston", "America/Chihuahua", "America/Boise", "America/Belize",
  "America/Chicago", "America/New_York", "America/Denver", "America/Los_Angeles",
  "Europe/London", "Europe/Paris", "Asia/Tokyo", "Asia/Singapore", "Australia/Sydney"
], {
  error: (issue) => `Invalid timezone: ${issue.input}. Must be one of the supported Instantly API timezones.`
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
  error: 'Invalid stage. Must be one of: prerequisite_check, preview, create'
});

/**
 * Pagination limit schema - supports both number and "all" string
 * Updated for bulletproof pagination - now very flexible since we always get complete datasets
 */
export const PaginationLimitSchema = z.union([
  z.number().int().min(1), // No upper limit since bulletproof pagination handles everything
  z.literal("all"),
  z.string().refine(val => val.toLowerCase() === "all", {
    message: "String limit must be 'all'"
  })
]).optional(); // Make the entire limit parameter optional

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
 * Campaign prerequisite check validation schema
 * Flexible validation for prerequisite_check stage - allows optional parameters
 */
export const CreateCampaignPrerequisiteSchema = z.object({
  // Workflow control
  stage: CampaignStageSchema.optional(),
  confirm_creation: z.boolean().optional(),

  // Optional campaign fields for prerequisite check
  name: z.string()
    .min(1, { error: 'Campaign name cannot be empty' })
    .max(255, { error: 'Campaign name cannot exceed 255 characters' })
    .optional(),

  subject: z.string()
    .min(1, { error: 'Subject line cannot be empty' })
    .max(255, { error: 'Subject line cannot exceed 255 characters' })
    .optional(),

  body: z.string()
    .min(1, { error: 'Email body cannot be empty' })
    .optional(),

  // Message shortcut for quick setup
  message: z.string().optional(),

  email_list: z.array(EmailSchema)
    .min(1, { error: 'At least one email address is required' })
    .max(100, { error: 'Cannot specify more than 100 email addresses' })
    .optional(),

  // Optional scheduling parameters
  timezone: TimezoneSchema.optional(),
  timing_from: TimeFormatSchema.optional(),
  timing_to: TimeFormatSchema.optional(),
  days: DaysConfigSchema,

  // Optional campaign settings
  daily_limit: z.number().int().min(1).max(1000).optional(),
  email_gap_minutes: z.number().int().min(1).max(1440).optional(),

  // Sequence parameters
  sequence_steps: z.number().int().min(1).max(10).optional(),
  sequence_bodies: z.array(z.string()).optional(),
  sequence_subjects: z.array(z.string()).optional(),
  continue_thread: z.boolean().optional(),

  // Tracking settings
  open_tracking: z.boolean().optional(),
  link_tracking: z.boolean().optional(),
  stop_on_reply: z.boolean().optional()
});

/**
 * Campaign creation validation schema
 * Comprehensive validation for all campaign parameters (create stage)
 */
export const CreateCampaignSchema = z.object({
  // Workflow control
  stage: CampaignStageSchema.optional(),
  confirm_creation: z.boolean().optional(),
  
  // Required campaign fields with enhanced guidance
  name: z.string()
    .min(1, { error: 'Campaign name is required. Provide a descriptive name like "Q4 Product Launch Campaign" or "Holiday Sales Outreach"' })
    .max(255, { error: 'Campaign name cannot exceed 255 characters. Keep it concise but descriptive.' }),

  subject: z.string()
    .min(1, { error: 'Email subject line is required. This is what recipients see in their inbox.' })
    .max(255, { error: 'Subject line cannot exceed 255 characters. For better deliverability, keep it under 50 characters.' })
    .refine(
      (val) => val.length <= 50,
      { error: 'Subject line is over 50 characters. Shorter subjects have better open rates. Consider: "{{firstName}}, quick question about {{companyName}}"' }
    ),
  
  body: z.string()
    .min(1, { error: 'Email body cannot be empty' })
    .refine(
      (val) => typeof val === 'string',
      'Body must be a plain string, not an object or array'
    )
    .refine(
      (val) => !val.includes('\\"') && !val.includes('\\t') && !val.includes('\\r'),
      'Body contains escaped characters. Use actual \\n characters, not escaped JSON'
    )
    .refine(
      (val) => {
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
      },
      'Body contains unsupported HTML tags. Only <p>, <br>, and <br/> tags are allowed for formatting. Use plain text with \\n for line breaks. Example: "Hi {{firstName}},\\n\\nYour message here."'
    ),
  
  email_list: z.array(EmailSchema)
    .min(1, { error: 'At least one sender email address is required. Use emails from your verified accounts. Call list_accounts first to see available options.' })
    .max(100, { error: 'Cannot specify more than 100 email addresses in a single campaign. Consider creating multiple campaigns for larger lists.' })
    .refine(
      (emails) => emails.length === 1,
      { error: 'Only one sender email address is allowed per campaign creation call. To use multiple senders, create separate campaigns for each email address.' }
    ),
  
  // Optional scheduling parameters
  timezone: TimezoneSchema.optional(),
  timing_from: TimeFormatSchema.optional(),
  timing_to: TimeFormatSchema.optional(),
  days: DaysConfigSchema,
  
  // Optional campaign settings
  daily_limit: z.number().int().min(1).max(30).optional(),
  email_gap_minutes: z.number().int().min(1).max(1440).optional(),
  
  // Sequence parameters (multi-step improvements)
  sequence_steps: z.number().int().min(1).max(10).optional(),
  step_delay_days: z.number().int().min(1).max(30).optional(),
  sequence_bodies: z.array(z.string()).optional(),
  sequence_subjects: z.array(z.string()).optional(),
  continue_thread: z.boolean().optional(),
  
  // Tracking settings
  open_tracking: z.boolean().optional(),
  link_tracking: z.boolean().optional(),
  stop_on_reply: z.boolean().optional()
}).refine(
  (data) => {
    // Validate sequence_bodies length matches sequence_steps
    if (data.sequence_steps && data.sequence_bodies) {
      return data.sequence_bodies.length >= data.sequence_steps;
    }
    return true;
  },
  {
    error: 'sequence_bodies array must contain at least as many items as sequence_steps',
    path: ['sequence_bodies']
  }
).refine(
  (data) => {
    // Validate sequence_subjects length matches sequence_steps
    if (data.sequence_steps && data.sequence_subjects) {
      return data.sequence_subjects.length >= data.sequence_steps;
    }
    return true;
  },
  {
    error: 'sequence_subjects array must contain at least as many items as sequence_steps',
    path: ['sequence_subjects']
  }
);

/**
 * List accounts validation schema
 */
export const ListAccountsSchema = z.object({
  limit: PaginationLimitSchema, // Already optional in the schema definition
  starting_after: z.string().optional(),
  get_all: z.boolean().optional()
});

/**
 * List campaigns validation schema
 */
export const ListCampaignsSchema = z.object({
  limit: PaginationLimitSchema, // Already optional in the schema definition
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
    .min(1, { error: 'At least one email address is required' })
    .max(100, { error: 'Cannot specify more than 100 email addresses' }),
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
  campaign_id: z.string().min(1, { error: 'Campaign ID cannot be empty' })
});

/**
 * Get campaign analytics validation schema
 */
export const GetCampaignAnalyticsSchema = z.object({
  campaign_id: z.string().min(1, { error: 'Campaign ID cannot be empty' }).optional(),
  start_date: DateFormatSchema.optional(),
  end_date: DateFormatSchema.optional()
});

/**
 * Update campaign validation schema
 */
export const UpdateCampaignSchema = z.object({
  campaign_id: z.string().min(1, { error: 'Campaign ID cannot be empty' }),
  name: z.string().min(1).max(255).optional(),
  status: z.string().optional()
});



/**
 * Create account validation schema
 */
export const CreateAccountSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, { error: 'Password cannot be empty' }),
  smtp_host: z.string().min(1, { error: 'SMTP host cannot be empty' }),
  smtp_port: z.number().int().min(1).max(65535),
  smtp_username: z.string().min(1, { error: 'SMTP username cannot be empty' }),
  smtp_password: z.string().min(1, { error: 'SMTP password cannot be empty' })
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
  personalization: z.record(z.string(), z.string()).optional()
});

/**
 * Update lead validation schema
 */
export const UpdateLeadSchema = z.object({
  lead_id: z.string().min(1, { error: 'Lead ID cannot be empty' }),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  company_name: z.string().optional(),
  personalization: z.record(z.string(), z.string()).optional()
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
  name: z.string().min(1, { error: 'Lead list name cannot be empty' }),
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
    .min(1, { error: 'Reply to UUID cannot be empty' })
    .refine(
      (val) => val !== 'test-uuid',
      'reply_to_uuid must be a valid email ID. Use list_emails or get_email tools first to obtain a valid email UUID.'
    ),
  body: z.object({
    html: z.string().optional(),
    text: z.string().optional()
  }).refine(
    (val) => val.html || val.text,
    'Body must contain either html or text content'
  )
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
  email_id: z.string().min(1, { error: 'Email ID cannot be empty' })
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
export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  toolName: string
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map((err: any) => {
        const path = err.path.length > 0 ? `${err.path.join('.')}: ` : '';
        return `${path}${err.message}`;
      });
      
      throw new McpError(
        ErrorCode.InvalidParams,
        `${toolName} validation failed: ${errorMessages.join('; ')}. Please check your input parameters and try again.`
      );
    }
    
    // Re-throw non-Zod errors
    throw error;
  }
}

/**
 * Validate campaign creation data with enhanced error messages and contextual guidance
 */
export function validateCampaignData(args: unknown): z.infer<typeof CreateCampaignSchema> {
  try {
    return validateWithSchema(CreateCampaignSchema, args, 'create_campaign');
  } catch (error: any) {
    // Enhance error messages with contextual guidance
    if (error.message) {
      let enhancedMessage = error.message;

      // Add specific guidance for common issues
      if (error.message.includes('email_list')) {
        enhancedMessage += '\n\n💡 GUIDANCE: Call list_accounts first to see your available sender email addresses. Only use verified, warmed-up accounts that show status=1 and warmup_status=1.';
      }

      if (error.message.includes('subject') || error.message.includes('Subject')) {
        enhancedMessage += '\n\n💡 GUIDANCE: Good subject lines are personal and specific. Examples:\n• "{{firstName}}, quick question about {{companyName}}"\n• "Helping {{companyName}} with [specific problem]"\n• "{{firstName}}, saw your recent [achievement/news]"';
      }

      if (error.message.includes('body') || error.message.includes('Body')) {
        enhancedMessage += '\n\n💡 GUIDANCE: Email body formatting tips:\n• Use \\n for line breaks - they will be automatically converted to <br /> tags for HTML email rendering\n• Double line breaks (\\n\\n) create new paragraphs\n• Personalize with {{firstName}}, {{lastName}}, {{companyName}}\n• Keep it conversational and specific\n• Example: "Hi {{firstName}},\\n\\nI noticed {{companyName}} recently [specific observation].\\n\\nBest regards,\\nYour Name"';
      }

      if (error.message.includes('daily_limit')) {
        enhancedMessage += '\n\n💡 GUIDANCE: Daily email limits for cold outreach:\n• Maximum 30 emails per day per account for compliance\n• Higher limits may trigger spam filters\n• Start with lower limits (10-20) for new accounts\n• Gradually increase as account reputation improves';
      }

      if (error.message.includes('track_opens') || error.message.includes('track_clicks')) {
        enhancedMessage += '\n\n💡 GUIDANCE: Email tracking considerations:\n• Tracking is disabled by default for better deliverability\n• Many email clients now block tracking pixels\n• Tracking can trigger spam filters and reduce trust\n• Enable only if analytics are absolutely necessary';
      }

      if (error.message.includes('name') && error.message.includes('Campaign')) {
        enhancedMessage += '\n\n💡 GUIDANCE: Use descriptive campaign names that help you identify the purpose. Examples:\n• "Q4 Product Launch - Tech Companies"\n• "Holiday Sales Outreach - Existing Customers"\n• "Partnership Inquiry - SaaS Companies"';
      }

      error.message = enhancedMessage;
    }

    throw error;
  }
}

/**
 * Validate campaign prerequisite check data with flexible validation
 */
export function validateCampaignPrerequisiteData(args: unknown): z.infer<typeof CreateCampaignPrerequisiteSchema> {
  return validateWithSchema(CreateCampaignPrerequisiteSchema, args, 'create_campaign_prerequisite');
}

/**
 * Validate get campaign analytics parameters
 */
export function validateGetCampaignAnalyticsData(args: unknown): z.infer<typeof GetCampaignAnalyticsSchema> {
  return validateWithSchema(GetCampaignAnalyticsSchema, args, 'get_campaign_analytics');
}

/**
 * Validate list accounts parameters
 */
export function validateListAccountsData(args: unknown): z.infer<typeof ListAccountsSchema> {
  return validateWithSchema(ListAccountsSchema, args, 'list_accounts');
}

/**
 * Validate list campaigns parameters
 */
export function validateListCampaignsData(args: unknown): z.infer<typeof ListCampaignsSchema> {
  return validateWithSchema(ListCampaignsSchema, args, 'list_campaigns');
}

/**
 * Validate warmup analytics parameters
 */
export function validateWarmupAnalyticsData(args: unknown): z.infer<typeof GetWarmupAnalyticsSchema> {
  return validateWithSchema(GetWarmupAnalyticsSchema, args, 'get_warmup_analytics');
}

/**
 * Validate email verification parameters
 */
export function validateEmailVerificationData(args: unknown): z.infer<typeof VerifyEmailSchema> {
  return validateWithSchema(VerifyEmailSchema, args, 'verify_email');
}

/**
 * Validate get campaign parameters
 */
export function validateGetCampaignData(args: unknown): z.infer<typeof GetCampaignSchema> {
  return validateWithSchema(GetCampaignSchema, args, 'get_campaign');
}

/**
 * Validate update campaign parameters
 */
export function validateUpdateCampaignData(args: unknown): z.infer<typeof UpdateCampaignSchema> {
  return validateWithSchema(UpdateCampaignSchema, args, 'update_campaign');
}



/**
 * Validate create account parameters
 */
export function validateCreateAccountData(args: unknown): z.infer<typeof CreateAccountSchema> {
  return validateWithSchema(CreateAccountSchema, args, 'create_account');
}

/**
 * Validate update account parameters
 */
export function validateUpdateAccountData(args: unknown): z.infer<typeof UpdateAccountSchema> {
  return validateWithSchema(UpdateAccountSchema, args, 'update_account');
}

/**
 * Validate create lead parameters
 */
export function validateCreateLeadData(args: unknown): z.infer<typeof CreateLeadSchema> {
  return validateWithSchema(CreateLeadSchema, args, 'create_lead');
}

/**
 * Validate update lead parameters
 */
export function validateUpdateLeadData(args: unknown): z.infer<typeof UpdateLeadSchema> {
  return validateWithSchema(UpdateLeadSchema, args, 'update_lead');
}

/**
 * Validate list leads parameters
 */
export function validateListLeadsData(args: unknown): z.infer<typeof ListLeadsSchema> {
  return validateWithSchema(ListLeadsSchema, args, 'list_leads');
}

/**
 * Validate create lead list parameters
 */
export function validateCreateLeadListData(args: unknown): z.infer<typeof CreateLeadListSchema> {
  return validateWithSchema(CreateLeadListSchema, args, 'create_lead_list');
}

/**
 * Validate list lead lists parameters
 */
export function validateListLeadListsData(args: unknown): z.infer<typeof ListLeadListsSchema> {
  return validateWithSchema(ListLeadListsSchema, args, 'list_lead_lists');
}

/**
 * Validate reply to email parameters
 */
export function validateReplyToEmailData(args: unknown): z.infer<typeof ReplyToEmailSchema> {
  return validateWithSchema(ReplyToEmailSchema, args, 'reply_to_email');
}

/**
 * Validate list emails parameters
 */
export function validateListEmailsData(args: unknown): z.infer<typeof ListEmailsSchema> {
  return validateWithSchema(ListEmailsSchema, args, 'list_emails');
}

/**
 * Validate get email parameters
 */
export function validateGetEmailData(args: unknown): z.infer<typeof GetEmailSchema> {
  return validateWithSchema(GetEmailSchema, args, 'get_email');
}

/**
 * Validate campaign accounts parameters
 */
export function validateCampaignAccountsData(args: unknown): z.infer<typeof ValidateCampaignAccountsSchema> {
  return validateWithSchema(ValidateCampaignAccountsSchema, args, 'validate_campaign_accounts');
}

/**
 * Validate get account details parameters
 */
export function validateGetAccountDetailsData(args: unknown): z.infer<typeof GetAccountDetailsSchema> {
  return validateWithSchema(GetAccountDetailsSchema, args, 'get_account_details');
}

/**
 * Validate get campaign analytics overview parameters
 */
export function validateGetCampaignAnalyticsOverviewData(args: unknown): z.infer<typeof GetCampaignAnalyticsSchema> {
  return validateWithSchema(GetCampaignAnalyticsSchema, args, 'get_campaign_analytics_overview');
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
  'get_campaign_analytics': validateGetCampaignAnalyticsData,
  'get_campaign_analytics_overview': validateGetCampaignAnalyticsOverviewData,

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
} as const;

/**
 * Universal validation function that automatically selects the right validator
 * for any tool based on its name
 */
export function validateToolParameters(toolName: string, args: unknown): any {
  const validator = TOOL_VALIDATORS[toolName as keyof typeof TOOL_VALIDATORS];

  if (!validator) {
    // For tools without specific validation, just return the args as-is
    console.warn(`[Zod Validation] No validator found for tool: ${toolName}`);
    return args;
  }

  try {
    return validator(args);
  } catch (error) {
    // Add tool context to error messages
    if (error instanceof McpError) {
      throw error;
    }

    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation failed for ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * Legacy email validation function - now uses Zod internally
 * Maintained for backward compatibility
 */
export const isValidEmail = (email: string): boolean => {
  try {
    EmailSchema.parse(email);
    return true;
  } catch {
    return false;
  }
};

/**
 * Legacy campaign validation function - now uses Zod internally
 * Maintained for backward compatibility during transition
 */
export const validateCampaignDataLegacy = (args: any): void => {
  try {
    validateCampaignData(args);
  } catch (error) {
    // Re-throw as the original function did
    throw error;
  }
};
