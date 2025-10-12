/**
 * Instantly MCP Server - Campaign Service
 * 
 * Business logic and helper functions for campaign management.
 */

import { getAllAccounts, getEligibleSenderAccounts } from './account-service.js';
import { DEFAULT_TIMEZONE } from '../timezone-config.js';

/**
 * Gather campaign prerequisites and validate requirements
 * 
 * This function analyzes the current state of accounts and campaign parameters
 * to provide comprehensive guidance for campaign creation.
 * 
 * @param args - Campaign creation arguments
 * @param apiKey - Instantly.ai API key
 * @returns Prerequisite analysis and guidance
 */
export async function gatherCampaignPrerequisites(args: any, apiKey?: string): Promise<any> {
  console.error('[Instantly MCP] 🔍 Gathering campaign prerequisites...');

  // Step 1: Fetch and analyze available accounts
  let accounts: any[] = [];
  let eligibleAccounts: any[] = [];
  let accountAnalysis: any = {};

  try {
    const accountsResult = await getAllAccounts(apiKey);

    // FIX: getAllAccounts returns { data: [...], metadata: {...} }, not an array directly
    accounts = accountsResult.data || accountsResult;

    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      return {
        stage: 'prerequisite_check',
        status: 'no_accounts_found',
        error: 'No accounts found in your workspace',
        required_action: {
          step: 1,
          action: 'add_accounts',
          description: 'You need to add at least one email account before creating campaigns',
          instructions: [
            'Go to your Instantly dashboard',
            'Navigate to Accounts section',
            'Add and verify email accounts',
            'Complete warmup process for each account',
            'Then retry campaign creation'
          ]
        }
      };
    }

    // Analyze account eligibility
    eligibleAccounts = accounts.filter(account =>
      account.status === 1 &&
      !account.setup_pending &&
      account.warmup_status === 1
    );

    const ineligibleAccounts = accounts.filter(account =>
      account.status !== 1 ||
      account.setup_pending ||
      account.warmup_status !== 1
    );

    accountAnalysis = {
      total_accounts: accounts.length,
      eligible_accounts: eligibleAccounts.length,
      ineligible_accounts: ineligibleAccounts.length,
      eligible_emails: eligibleAccounts.map(acc => ({
        email: acc.email,
        warmup_score: acc.warmup_score || 0,
        status: 'ready'
      })),
      ineligible_emails: ineligibleAccounts.map(acc => ({
        email: acc.email,
        issues: [
          ...(acc.status !== 1 ? ['Account not active'] : []),
          ...(acc.setup_pending ? ['Setup pending'] : []),
          ...(acc.warmup_status !== 1 ? ['Warmup not complete'] : [])
        ]
      }))
    };

  } catch (error: any) {
    return {
      stage: 'prerequisite_check',
      status: 'account_fetch_failed',
      error: `Failed to fetch accounts: ${error.message}`,
      suggestion: 'Please check your API key and try again, or call list_accounts directly to troubleshoot'
    };
  }

  // Step 2: Analyze provided campaign data
  const providedFields: Record<string, any> = {
    name: args?.name || null,
    subject: args?.subject || null,
    body: args?.body || null,
    email_list: args?.email_list || null,
    campaign_schedule: args?.campaign_schedule || null,
    sequences: args?.sequences || null
  };

  // Determine required fields based on campaign type
  const hasComplexStructure = args?.campaign_schedule && args?.sequences;
  const requiredFields = hasComplexStructure
    ? ['name', 'email_list']  // Complex campaigns only need name and email_list
    : ['name', 'subject', 'body', 'email_list'];  // Simple campaigns need all fields

  const missingFields = requiredFields.filter(field => !providedFields[field]);
  const hasAllRequired = missingFields.length === 0;

  // Step 3: Validate email_list if provided
  let emailValidation: any = null;
  if (args?.email_list && Array.isArray(args.email_list)) {
    const eligibleEmailSet = new Set(eligibleAccounts.map(acc => acc.email.toLowerCase()));
    const invalidEmails = args.email_list.filter((email: string) =>
      !eligibleEmailSet.has(email.toLowerCase())
    );

    emailValidation = {
      provided_emails: args.email_list,
      valid_emails: args.email_list.filter((email: string) =>
        eligibleEmailSet.has(email.toLowerCase())
      ),
      invalid_emails: invalidEmails,
      validation_passed: invalidEmails.length === 0
    };
  }

  // Step 4: Generate comprehensive guidance
  const guidance = {
    next_steps: [] as any[],
    field_requirements: {
      name: {
        required: true,
        description: 'Campaign name for identification',
        example: 'Q4 Product Launch Campaign',
        provided: !!args?.name
      },
      subject: {
        required: true,
        description: 'Email subject line',
        example: 'Introducing our new product line',
        formatting_tips: [
          'Keep under 50 characters for better deliverability',
          'Avoid spam trigger words',
          'Use personalization: {{firstName}} or {{companyName}}'
        ],
        provided: !!args?.subject
      },
      body: {
        required: true,
        description: 'Email body content',
        formatting_requirements: [
          'Use plain text with \\n for line breaks',
          'Personalization variables: {{firstName}}, {{lastName}}, {{companyName}}',
          'Only <p>, <br>, and <br/> HTML tags are allowed',
          'Avoid escaped characters like \\" or \\t'
        ],
        example: 'Hi {{firstName}},\\n\\nI hope this email finds you well.\\n\\nBest regards,\\nYour Name',
        provided: !!args?.body
      },
      email_list: {
        required: true,
        description: 'Array of sender email addresses (must be from your verified accounts)',
        constraint: 'Only one sender email per campaign creation call',
        available_options: eligibleAccounts.map(acc => acc.email),
        example: ['john@yourcompany.com'],
        provided: !!args?.email_list,
        validation_status: emailValidation
      }
    },
    optional_settings: {
      tracking: {
        track_opens: {
          default: false,
          description: 'Track when recipients open emails (disabled by default)',
          why_disabled: 'Email tracking can hurt deliverability and raises privacy concerns. Many email clients now block tracking pixels.'
        },
        track_clicks: {
          default: false,
          description: 'Track when recipients click links (disabled by default)',
          why_disabled: 'Link tracking can trigger spam filters and reduces trust. Enable only if analytics are critical.'
        }
      },
      scheduling: {
        timezone: { default: DEFAULT_TIMEZONE, description: 'Timezone for sending schedule (verified working timezone)' },
        timing_from: { default: '09:00', description: 'Start time for sending (24h format)' },
        timing_to: { default: '17:00', description: 'End time for sending (24h format)' },
        days: {
          default: 'Monday-Friday',
          description: 'Days of week for sending',
          format: 'Object with boolean values for each day'
        }
      },
      limits: {
        daily_limit: {
          default: 30,
          description: 'Maximum emails per day per account (30 for cold email compliance)',
          compliance_note: 'Higher limits may trigger spam filters and hurt deliverability. 30/day is the recommended maximum for cold outreach.'
        },
        email_gap: { default: 10, description: 'Minutes between emails from same account (1-1440 minutes)' }
      }
    }
  };

  // Add specific next steps based on current state
  if (eligibleAccounts.length === 0) {
    guidance.next_steps.push({
      priority: 'critical',
      action: 'fix_account_issues',
      description: 'Resolve account eligibility issues before proceeding',
      details: accountAnalysis.ineligible_emails
    });
  } else {
    guidance.next_steps.push({
      priority: 'recommended',
      action: 'review_available_accounts',
      description: `You have ${eligibleAccounts.length} eligible sending accounts available`,
      accounts: accountAnalysis.eligible_emails
    });
  }

  if (missingFields.length > 0) {
    guidance.next_steps.push({
      priority: 'required',
      action: 'provide_missing_fields',
      description: `Provide the following required fields: ${missingFields.join(', ')}`,
      missing_fields: missingFields
    });
  }

  if (emailValidation && !emailValidation.validation_passed) {
    guidance.next_steps.push({
      priority: 'critical',
      action: 'fix_email_list',
      description: 'Email list contains invalid addresses',
      invalid_emails: emailValidation.invalid_emails,
      suggestion: 'Use only emails from your eligible accounts listed above'
    });
  }

  // Include comprehensive guidance for users
  const fullGuidance = generateCampaignGuidance();

  return {
    stage: 'prerequisite_check',
    status: hasAllRequired && eligibleAccounts.length > 0 && (!emailValidation || emailValidation.validation_passed)
      ? 'ready_for_creation'
      : 'missing_requirements',
    message: hasAllRequired
      ? 'All required fields provided. Ready to create campaign.'
      : `Missing required information. Please provide: ${missingFields.join(', ')}`,
    account_analysis: accountAnalysis,
    field_analysis: providedFields,
    validation_results: emailValidation,
    step_by_step_guidance: guidance,
    comprehensive_guide: fullGuidance,
    ready_for_next_stage: hasAllRequired && eligibleAccounts.length > 0 && (!emailValidation || emailValidation.validation_passed)
  };
}

/**
 * Generate comprehensive campaign creation guidance
 * 
 * @returns Detailed guidance object with best practices and examples
 */
export function generateCampaignGuidance(): any {
  return {
    getting_started: {
      title: 'Campaign Creation Quick Start Guide',
      overview: 'Creating successful email campaigns requires proper setup and understanding of key requirements.',
      essential_first_step: {
        action: 'Call list_accounts first',
        reason: 'You need to see which email accounts are available and eligible for sending',
        command: 'list_accounts {"get_all": true}'
      }
    },

    required_fields: {
      name: {
        description: 'Campaign identifier for your reference',
        examples: ['Q4 Product Launch Campaign', 'Holiday Sales Outreach', 'Partnership Inquiry - SaaS Companies'],
        tips: ['Be descriptive but concise', 'Include target audience or purpose', 'Use consistent naming convention']
      },
      subject: {
        description: 'Email subject line that recipients see',
        best_practices: [
          'Keep under 50 characters for better open rates',
          'Personalize with {{firstName}} or {{companyName}}',
          'Be specific and relevant to recipient',
          'Avoid spam trigger words (FREE, URGENT, etc.)'
        ],
        examples: [
          '{{firstName}}, quick question about {{companyName}}',
          'Helping {{companyName}} with [specific problem]',
          '{{firstName}}, saw your recent [achievement/news]'
        ]
      },
      body: {
        description: 'Main email content',
        formatting_rules: [
          'Use plain text with \\n for line breaks - they will be automatically converted to <br /> tags for HTML email rendering',
          'Double line breaks (\\n\\n) create new paragraphs with <p> tags',
          'Single line breaks (\\n) become <br /> tags within paragraphs',
          'Personalize with {{firstName}}, {{lastName}}, {{companyName}}',
          'Avoid escaped characters like \\" or \\t',
          'The tool automatically handles HTML conversion - just use \\n in your input'
        ],
        structure_template: 'Hi {{firstName}},\\n\\n[Opening line referencing something specific about them/their company]\\n\\n[Your value proposition or question]\\n\\n[Clear call to action]\\n\\nBest regards,\\n[Your name]',
        example: 'Hi {{firstName}},\\n\\nI noticed {{companyName}} recently expanded into the European market. Congratulations!\\n\\nI help companies like yours streamline their international operations. Would you be open to a brief conversation about how we could support your expansion?\\n\\nBest regards,\\nJohn Smith',
        html_conversion_note: 'This example will be automatically converted to proper HTML with <p> tags for paragraphs and <br /> tags for line breaks'
      },
      email_list: {
        description: 'Sender email addresses from your verified accounts',
        constraints: [
          'Must use emails from your verified Instantly accounts',
          'Only one sender email per campaign creation call',
          'Accounts must be active (status=1) and warmed up (warmup_status=1)'
        ],
        how_to_find: 'Call list_accounts to see available options',
        example: ['john@yourcompany.com']
      }
    },

    optional_settings_explained: {
      tracking: {
        track_opens: 'Tracks when recipients open your emails (recommended: true)',
        track_clicks: 'Tracks when recipients click links in your emails (recommended: true)'
      },
      scheduling: {
        timezone: `Timezone for sending schedule (default: ${DEFAULT_TIMEZONE} - verified working timezone)`,
        timing_from: 'Start time for sending in 24h format (default: 09:00)',
        timing_to: 'End time for sending in 24h format (default: 17:00)',
        days: 'Days of week for sending (default: Monday-Friday only)'
      },
      limits: {
        daily_limit: 'Maximum emails per day per account (default: 30 for cold email compliance)',
        email_gap: 'Minutes between emails from same account (default: 10) - API v2 parameter'
      },
      behavior: {
        stop_on_reply: 'Stop campaign when recipient replies (default: true)',
        stop_on_auto_reply: 'Stop on auto-replies like out-of-office (default: true)'
      },
      sequences: {
        sequence_steps: 'Number of emails in the sequence (default: 1 for single email, max: 10)',
        step_delay_days: 'Days to wait AFTER sending each step before sending the next step (default: 3 days). CRITICAL: This delay applies to ALL steps including Step 1. Example with 2-day delay: Step 1 sends → Wait 2 days → Step 2 sends → Wait 2 days → Step 3 sends.',
        sequence_bodies: 'Optional custom email content for each step (array of strings)',
        sequence_subjects: 'Optional custom subject lines for each step (array of strings)',
        when_to_use: 'Multi-step sequences are effective for cold outreach, nurturing leads, and following up on proposals',
        best_practices: [
          'Start with 2-3 steps for cold outreach',
          'Increase value with each follow-up',
          'Reference previous emails in follow-ups',
          'Space follow-ups 2-7 days apart (step_delay_days parameter)',
          'Personalize each step differently',
          'CRITICAL: The delay applies to ALL steps - Step 1 will wait before Step 2, Step 2 will wait before Step 3, etc.'
        ]
      }
    },

    common_mistakes: [
      {
        mistake: 'Not calling list_accounts first',
        consequence: 'Using invalid email addresses that cause campaign creation to fail',
        solution: 'Always call list_accounts to see available sender emails'
      },
      {
        mistake: 'Using escaped characters in email body',
        consequence: 'Email body appears with literal \\n instead of line breaks',
        solution: 'Use plain \\n characters - they will be automatically converted to <br /> tags for HTML rendering'
      },
      {
        mistake: 'Subject lines too long',
        consequence: 'Poor open rates due to truncated subjects',
        solution: 'Keep subjects under 50 characters'
      },
      {
        mistake: 'Setting daily limits too high',
        consequence: 'Triggers spam filters and hurts deliverability',
        solution: 'Use maximum 30 emails per day for cold outreach compliance'
      },
      {
        mistake: 'Enabling email tracking',
        consequence: 'Reduced deliverability and privacy compliance issues',
        solution: 'Keep tracking disabled unless analytics are absolutely necessary'
      },
      {
        mistake: 'Generic, non-personalized content',
        consequence: 'Low response rates and potential spam classification',
        solution: 'Use personalization variables and specific, relevant content'
      }
    ],

    success_checklist: [
      '✓ Called list_accounts to verify available sender emails',
      '✓ Campaign name is descriptive and follows your naming convention',
      '✓ Subject line is under 50 characters and personalized',
      '✓ Email body uses \\n for line breaks (automatically converted to HTML)',
      '✓ Content is personalized and relevant to recipients',
      '✓ Sender email is from verified, warmed-up account',
      '✓ Daily limit set to 30 or less for cold email compliance',
      '✓ Email tracking disabled for better deliverability',
      '✓ Sending schedule matches your target audience timezone',
      '✓ Multi-step sequences configured appropriately (if using)'
    ]
  };
}

