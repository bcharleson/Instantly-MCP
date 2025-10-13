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

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { BulletproofTimezoneSchema } from './timezone-config.js';

// ============================================================================
// COMMON VALIDATION SCHEMAS
// ============================================================================

/**
 * Email validation schema with comprehensive error messages
 * Using Zod v4's top-level z.email() for better performance and tree-shaking
 */
export const EmailSchema = z
  .string()
  .email('Invalid email format. Must be a valid email address (e.g., user@domain.com)')
  .min(1, 'Email address cannot be empty');

/**
 * BULLETPROOF Timezone validation schema - VERIFIED WORKING TIMEZONES ONLY
 *
 * This schema contains only timezones that have been systematically tested
 * and confirmed to work with the Instantly.ai API in production.
 *
 * Test results: 26/27 timezones working (96% success rate)
 * Last updated: 2025-09-29
 */
export const TimezoneSchema = BulletproofTimezoneSchema;

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
  invalid_type_error: 'Invalid stage. Must be one of: prerequisite_check, preview, create'
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
    .min(1, { message: 'Campaign name cannot be empty' })
    .max(255, { message: 'Campaign name cannot exceed 255 characters' })
    .optional(),

  subject: z.string()
    .min(1, { message: 'Subject line cannot be empty' })
    .max(255, { message: 'Subject line cannot exceed 255 characters' })
    .optional(),

  body: z.string()
    .min(1, { message: 'Email body cannot be empty' })
    .optional(),

  // Message shortcut for quick setup
  message: z.string().optional(),

  email_list: z.array(EmailSchema)
    .min(1, { message: 'At least one email address is required' })
    .max(100, { message: 'Cannot specify more than 100 email addresses' })
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
    .min(1, 'Campaign name is required. Provide a descriptive name like "Q4 Product Launch Campaign" or "Holiday Sales Outreach"')
    .max(255, 'Campaign name cannot exceed 255 characters. Keep it concise but descriptive.'),

  subject: z.string()
    .min(1, 'Email subject line is required. This is what recipients see in their inbox.')
    .max(255, 'Subject line cannot exceed 255 characters. For better deliverability, keep it under 50 characters.')
    .refine(
      (val) => val.length <= 50,
      {
        message: 'subject: Subject line is over 50 characters. Shorter subjects have better open rates. Consider: "{{firstName}}, quick question about {{companyName}}" • "Helping {{companyName}} with [specific problem]" • "{{firstName}}, saw your recent [achievement/news]"'
      }
    )
    .optional(), // Made optional for complex campaigns

  body: z.string()
    .min(1, 'Email body cannot be empty')
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
        if (val && val.includes('<') && val.includes('>')) {
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
    )
    .optional(), // Made optional for complex campaigns
  
  email_list: z.array(EmailSchema)
    .min(1, 'At least one sender email address is required. ⚠️ CRITICAL: You MUST call list_accounts first to get verified email addresses. NEVER use placeholder emails like test@example.com or user@example.com.')
    .max(100, 'Cannot specify more than 100 email addresses in a single campaign. Consider creating multiple campaigns for larger lists.')
    .refine(
      (emails) => {
        // Check for common placeholder/fake email patterns
        const placeholderPatterns = [
          /test@/i,
          /example\.com$/i,
          /user@/i,
          /email@/i,
          /demo@/i,
          /sample@/i
        ];

        const hasPlaceholder = emails.some(email =>
          placeholderPatterns.some(pattern => pattern.test(email))
        );

        return !hasPlaceholder;
      },
      {
        message: '⚠️ CRITICAL ERROR: Placeholder/fake email addresses detected (e.g., test@example.com, user@example.com). You MUST:\n1. Call list_accounts first to get real, verified email addresses\n2. Use ONLY emails from the list_accounts response\n3. NEVER use placeholder or example email addresses\n\nIt seems the email account used in the test is invalid for creating campaigns. Here are some of your available eligible sender accounts you can use for the campaign:\n\nPlease call list_accounts to see your verified email addresses, then use those addresses in the email_list parameter.'
      }
    ),
  
  // Optional scheduling parameters
  timezone: TimezoneSchema.optional(),
  timing_from: TimeFormatSchema.optional(),
  timing_to: TimeFormatSchema.optional(),
  days: DaysConfigSchema,
  
  // Optional campaign settings - EXACT parameters from Instantly.ai API v2
  daily_limit: z.number().int().min(1).max(30).optional(),
  email_gap: z.number().int().min(1).max(1440).optional(), // API v2 parameter name
  

  
  // Complex campaign structure
  campaign_schedule: z.object({
    schedules: z.array(z.object({
      days: z.record(z.string(), z.boolean()),
      from: z.string(),
      to: z.string(),
      timezone: TimezoneSchema
    }))
  }).optional(),

  sequences: z.array(z.object({
    steps: z.array(z.object({
      subject: z.string(),
      body: z.string().min(1, 'Email body cannot be empty for any step'),
      delay: z.number().int().min(0)
    })).min(1, 'At least one step is required in sequence')
  })).optional(),

  // Tracking settings
  open_tracking: z.boolean().optional(),
  link_tracking: z.boolean().optional(),
  stop_on_reply: z.boolean().optional()
}).refine(
  (data) => {
    const hasSimpleParams = data.subject && data.body;
    const hasComplexStructure = data.campaign_schedule && data.sequences;
    return hasSimpleParams || hasComplexStructure;
  },
  {
    message: 'Either provide simple parameters (subject, body, email_list) OR complex structure (campaign_schedule, sequences)',
    path: ['campaign_structure']
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
    .min(1, { message: 'At least one email address is required' })
    .max(100, { message: 'Cannot specify more than 100 email addresses' }),
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
  campaign_id: z.string().min(1, { message: 'Campaign ID cannot be empty' })
});

/**
 * Get campaign analytics validation schema
 */
export const GetCampaignAnalyticsSchema = z.object({
  campaign_id: z.string().min(1, { message: 'Campaign ID cannot be empty' }).optional(),
  campaign_ids: z.array(z.string()).optional(),
  start_date: DateFormatSchema.optional(),
  end_date: DateFormatSchema.optional(),
  exclude_total_leads_count: z.boolean().optional()
});

/**
 * Update campaign validation schema - Updated to match Instantly.ai API v2 PATCH /api/v2/campaigns/{id} specification
 * Reference: https://developer.instantly.ai/api/v2/campaign/patchcampaign
 */
export const UpdateCampaignSchema = z.object({
  campaign_id: z.string().min(1, { message: 'Campaign ID cannot be empty' }),

  // Basic campaign settings
  name: z.string().min(1).max(255).optional(),
  pl_value: z.number().nullable().optional(),
  is_evergreen: z.boolean().nullable().optional(),

  // Campaign schedule
  campaign_schedule: z.object({
    schedules: z.array(z.object({
      name: z.string(),
      timing: z.object({
        from: z.string().regex(/^([01][0-9]|2[0-3]):([0-5][0-9])$/),
        to: z.string().regex(/^([01][0-9]|2[0-3]):([0-5][0-9])$/)
      }),
      days: z.object({
        0: z.boolean().optional(),
        1: z.boolean().optional(),
        2: z.boolean().optional(),
        3: z.boolean().optional(),
        4: z.boolean().optional(),
        5: z.boolean().optional(),
        6: z.boolean().optional()
      }),
      timezone: z.string()
    })).optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional()
  }).optional(),

  // Email sequences
  sequences: z.array(z.object({
    steps: z.array(z.object({
      type: z.string(),
      delay: z.number(),
      variants: z.array(z.object({
        subject: z.string(),
        body: z.string()
      }))
    }))
  })).optional(),

  // Email sending settings
  email_gap: z.number().nullable().optional(),
  random_wait_max: z.number().nullable().optional(),
  text_only: z.boolean().nullable().optional(),
  email_list: z.array(z.string()).optional(),
  daily_limit: z.number().nullable().optional(),
  stop_on_reply: z.boolean().nullable().optional(),
  email_tag_list: z.array(z.string()).optional(),

  // Tracking settings
  link_tracking: z.boolean().nullable().optional(),
  open_tracking: z.boolean().nullable().optional(),

  // Advanced settings
  stop_on_auto_reply: z.boolean().nullable().optional(),
  daily_max_leads: z.number().nullable().optional(),
  prioritize_new_leads: z.boolean().nullable().optional(),
  auto_variant_select: z.object({
    trigger: z.string()
  }).optional(),
  match_lead_esp: z.boolean().nullable().optional(),
  stop_for_company: z.boolean().nullable().optional(),
  insert_unsubscribe_header: z.boolean().nullable().optional(),
  allow_risky_contacts: z.boolean().nullable().optional(),
  disable_bounce_protect: z.boolean().nullable().optional(),

  // CC/BCC lists
  cc_list: z.array(z.string().email()).optional(),
  bcc_list: z.array(z.string().email()).optional()
});



/**
 * Create account validation schema
 */
export const CreateAccountSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, { message: 'Password cannot be empty' }),
  smtp_host: z.string().min(1, { message: 'SMTP host cannot be empty' }),
  smtp_port: z.number().int().min(1).max(65535),
  smtp_username: z.string().min(1, { message: 'SMTP username cannot be empty' }),
  smtp_password: z.string().min(1, { message: 'SMTP password cannot be empty' })
});

/**
 * Update account validation schema - Updated to match Instantly.ai API v2 specification
 */
export const UpdateAccountSchema = z.object({
  email: EmailSchema,
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  warmup: z.object({
    limit: z.number().optional(),
    advanced: z.object({
      warm_ctd: z.boolean().optional(),
      open_rate: z.number().optional(),
      important_rate: z.number().optional(),
      read_emulation: z.boolean().optional(),
      spam_save_rate: z.number().optional(),
      weekday_only: z.boolean().optional()
    }).optional(),
    warmup_custom_ftag: z.string().optional(),
    increment: z.string().optional(),
    reply_rate: z.number().optional()
  }).optional(),
  daily_limit: z.number().int().min(1).max(1000).nullable().optional(),
  tracking_domain_name: z.string().nullable().optional(),
  tracking_domain_status: z.string().nullable().optional(),
  enable_slow_ramp: z.boolean().nullable().optional(),
  inbox_placement_test_limit: z.number().nullable().optional(),
  sending_gap: z.number().min(0).max(1440).optional(),
  skip_cname_check: z.boolean().optional(),
  remove_tracking_domain: z.boolean().optional()
});

/**
 * Lead creation validation schema - Updated to match Instantly.ai API v2 specification
 */
export const CreateLeadSchema = z.object({
  // Core lead information
  campaign: z.string().optional(),
  email: z.string().email().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  company_name: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional(),
  personalization: z.string().optional(),

  // Advanced parameters
  lt_interest_status: z.number().int().min(-3).max(4).optional(),
  pl_value_lead: z.string().optional(),
  list_id: z.string().optional(),
  assigned_to: z.string().optional(),

  // Skip conditions
  skip_if_in_workspace: z.boolean().optional(),
  skip_if_in_campaign: z.boolean().optional(),
  skip_if_in_list: z.boolean().optional(),

  // Verification and blocklist
  blocklist_id: z.string().optional(),
  verify_leads_for_lead_finder: z.boolean().optional(),
  verify_leads_on_import: z.boolean().optional(),

  // Custom variables
  custom_variables: z.record(z.string(), z.any()).optional()
});

/**
 * Update lead validation schema - Updated to match Instantly.ai API v2 specification
 */
export const UpdateLeadSchema = z.object({
  lead_id: z.string().min(1, { message: 'Lead ID cannot be empty' }),
  personalization: z.string().optional(),
  website: z.string().url().optional(),
  last_name: z.string().optional(),
  first_name: z.string().optional(),
  company_name: z.string().optional(),
  phone: z.string().optional(),
  lt_interest_status: z.number().int().min(-3).max(4).optional(),
  pl_value_lead: z.string().optional(),
  assigned_to: z.string().optional(),
  custom_variables: z.record(z.string(), z.any()).optional()
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
 * Create lead list validation schema - Updated to match Instantly.ai API v2 specification
 */
export const CreateLeadListSchema = z.object({
  name: z.string().min(1, { message: 'Lead list name cannot be empty' }),
  has_enrichment_task: z.boolean().optional(),
  owned_by: z.string().optional()
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
    .min(1, { message: 'Reply to UUID cannot be empty' })
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
  email_id: z.string().min(1, { message: 'Email ID cannot be empty' })
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
      if (error.message.includes('email_list') || error.message.includes('Placeholder')) {
        enhancedMessage += '\n\n💡 CRITICAL GUIDANCE: \n1️⃣ Call list_accounts first to see your available sender email addresses\n2️⃣ Only use verified, warmed-up accounts that show status=1 and warmup_status=1\n3️⃣ NEVER use placeholder emails like test@example.com, user@example.com, etc.\n4️⃣ To create ONE campaign with MULTIPLE emails, provide ALL emails in a SINGLE email_list array\n5️⃣ Example: email_list: ["real1@domain.com", "real2@domain.com"] creates ONE campaign with 2 senders';
      }

      if (error.message.includes('subject') || error.message.includes('Subject')) {
        enhancedMessage += '\n\n💡 GUIDANCE: Good subject lines are personal and specific. Examples:\n• "{{firstName}}, quick question about {{companyName}}" (48 chars)\n• "Helping {{companyName}} with [specific problem]" (adjust to <50)\n• "{{firstName}}, saw your recent [achievement/news]" (adjust to <50)\n\n⚠️ CRITICAL: Subject line MUST be under 50 characters. If your subject is too long, you MUST shorten it before retrying.';
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
  'activate_campaign': () => ({})
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
