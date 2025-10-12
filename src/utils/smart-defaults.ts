/**
 * Instantly MCP Server - Smart Defaults Utilities
 * 
 * This module contains utility functions for applying smart defaults to campaign
 * creation parameters. These defaults optimize campaigns for deliverability and
 * engagement while following email marketing best practices.
 * 
 * Functions:
 * - applySmartDefaults: Applies intelligent defaults to campaign parameters
 */

import { validateAndMapTimezone, DEFAULT_TIMEZONE } from '../timezone-config.js';

/**
 * Smart defaults system for campaign creation
 * 
 * This function applies intelligent defaults to campaign parameters to optimize
 * for deliverability, engagement, and compliance with email marketing best practices.
 * Users can override any defaults by explicitly providing values.
 * 
 * @param args - The campaign arguments to enhance with defaults
 * @returns Object containing enhanced arguments, applied defaults list, and explanation
 */
export function applySmartDefaults(args: any): any {
  const defaultsApplied: string[] = [];
  const enhancedArgs = { ...args };

  // Apply tracking defaults (disabled for better deliverability)
  if (enhancedArgs.track_opens === undefined) {
    enhancedArgs.track_opens = false;
    defaultsApplied.push('track_opens: false (disabled for better deliverability and privacy compliance)');
  }

  if (enhancedArgs.track_clicks === undefined) {
    enhancedArgs.track_clicks = false;
    defaultsApplied.push('track_clicks: false (disabled for better deliverability and privacy compliance)');
  }

  // Apply scheduling defaults with bulletproof timezone validation
  if (enhancedArgs.timezone === undefined) {
    enhancedArgs.timezone = DEFAULT_TIMEZONE;
    defaultsApplied.push(`timezone: ${DEFAULT_TIMEZONE} (verified working timezone - adjust if needed)`);
  } else {
    // Validate and map timezone if needed
    const timezoneResult = validateAndMapTimezone(enhancedArgs.timezone);
    if (timezoneResult.mapped) {
      enhancedArgs.timezone = timezoneResult.timezone;
      defaultsApplied.push(`timezone: ${timezoneResult.warning}`);
    }
  }

  if (enhancedArgs.timing_from === undefined) {
    enhancedArgs.timing_from = '09:00';
    defaultsApplied.push('timing_from: 09:00 (9 AM start time for business hours)');
  }

  if (enhancedArgs.timing_to === undefined) {
    enhancedArgs.timing_to = '17:00';
    defaultsApplied.push('timing_to: 17:00 (5 PM end time for business hours)');
  }

  // Apply sending limit defaults
  if (enhancedArgs.daily_limit === undefined) {
    enhancedArgs.daily_limit = 30;
    defaultsApplied.push('daily_limit: 30 (compliant limit for cold email outreach)');
  }

  // Handle email_gap parameter (API expects 'email_gap')
  if (enhancedArgs.email_gap === undefined) {
    enhancedArgs.email_gap = 10;
    defaultsApplied.push('email_gap: 10 (10-minute gaps between emails from same account)');
  }

  // Apply behavior defaults
  if (enhancedArgs.stop_on_reply === undefined) {
    enhancedArgs.stop_on_reply = true;
    defaultsApplied.push('stop_on_reply: true (stops campaign when recipient replies)');
  }

  if (enhancedArgs.stop_on_auto_reply === undefined) {
    enhancedArgs.stop_on_auto_reply = true;
    defaultsApplied.push('stop_on_auto_reply: true (stops on auto-replies like out-of-office)');
  }

  // Apply days of week defaults (Monday-Friday)
  if (enhancedArgs.days === undefined) {
    enhancedArgs.days = {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false
    };
    defaultsApplied.push('days: Monday-Friday only (weekends excluded for business outreach)');
  }

  // Apply sequence defaults
  if (enhancedArgs.sequence_steps === undefined) {
    enhancedArgs.sequence_steps = 1;
    defaultsApplied.push('sequence_steps: 1 (single email campaign)');
  }

  if (enhancedArgs.step_delay_days === undefined) {
    enhancedArgs.step_delay_days = 3;
    defaultsApplied.push('step_delay_days: 3 (3-day delay between follow-ups)');
  }

  // Handle sequence arrays - ensure they match sequence_steps count
  const sequenceSteps = enhancedArgs.sequence_steps || 1;

  // If sequence_bodies is provided but incomplete, extend it
  if (enhancedArgs.sequence_bodies !== undefined) {
    if (!Array.isArray(enhancedArgs.sequence_bodies)) {
      enhancedArgs.sequence_bodies = [];
    }

    // Extend array to match sequence_steps if needed
    while (enhancedArgs.sequence_bodies.length < sequenceSteps) {
      if (enhancedArgs.sequence_bodies.length === 0) {
        // First item uses the main body
        enhancedArgs.sequence_bodies.push(enhancedArgs.body || '');
      } else {
        // Additional items use follow-up template
        const stepNumber = enhancedArgs.sequence_bodies.length + 1;
        enhancedArgs.sequence_bodies.push(`Follow-up #${stepNumber}:\n\n${enhancedArgs.body || ''}`);
      }
    }

    if (enhancedArgs.sequence_bodies.length > 0) {
      defaultsApplied.push(`sequence_bodies: Extended to ${sequenceSteps} items to match sequence_steps`);
    }
  } else if (sequenceSteps > 1) {
    // Auto-generate sequence bodies for multi-step campaigns
    enhancedArgs.sequence_bodies = [];
    for (let i = 0; i < sequenceSteps; i++) {
      if (i === 0) {
        enhancedArgs.sequence_bodies.push(enhancedArgs.body || '');
      } else {
        enhancedArgs.sequence_bodies.push(`Follow-up #${i + 1}:\n\n${enhancedArgs.body || ''}`);
      }
    }
    defaultsApplied.push(`sequence_bodies: Auto-generated ${sequenceSteps} follow-up templates`);
  }

  // If sequence_subjects is provided but incomplete, extend it
  if (enhancedArgs.sequence_subjects !== undefined) {
    if (!Array.isArray(enhancedArgs.sequence_subjects)) {
      enhancedArgs.sequence_subjects = [];
    }

    // Extend array to match sequence_steps if needed
    while (enhancedArgs.sequence_subjects.length < sequenceSteps) {
      if (enhancedArgs.sequence_subjects.length === 0) {
        // First item uses the main subject
        enhancedArgs.sequence_subjects.push(enhancedArgs.subject || '');
      } else {
        // Additional items use follow-up template
        enhancedArgs.sequence_subjects.push(`Follow-up: ${enhancedArgs.subject || ''}`);
      }
    }

    if (enhancedArgs.sequence_subjects.length > 0) {
      defaultsApplied.push(`sequence_subjects: Extended to ${sequenceSteps} items to match sequence_steps`);
    }
  } else if (sequenceSteps > 1) {
    // Auto-generate sequence subjects for multi-step campaigns
    enhancedArgs.sequence_subjects = [];
    for (let i = 0; i < sequenceSteps; i++) {
      if (i === 0) {
        enhancedArgs.sequence_subjects.push(enhancedArgs.subject || '');
      } else {
        enhancedArgs.sequence_subjects.push(`Follow-up: ${enhancedArgs.subject || ''}`);
      }
    }
    defaultsApplied.push(`sequence_subjects: Auto-generated ${sequenceSteps} follow-up subjects`);
  }

  return {
    enhanced_args: enhancedArgs,
    defaults_applied: defaultsApplied,
    defaults_explanation: {
      message: 'Smart defaults have been applied to optimize your campaign for deliverability and engagement',
      applied_defaults: defaultsApplied,
      customization_note: 'You can override any of these defaults by explicitly providing values in your next call'
    }
  };
}

