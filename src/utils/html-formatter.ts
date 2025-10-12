/**
 * Instantly MCP Server - HTML Formatting Utilities
 * 
 * This module contains utility functions for converting plain text to HTML format
 * and building campaign payloads with proper HTML formatting for Instantly.ai.
 * 
 * Functions:
 * - convertLineBreaksToHTML: Converts plain text line breaks to HTML
 * - buildCampaignPayload: Builds campaign payload with proper HTML formatting
 */

import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { validateAndMapTimezone, DEFAULT_TIMEZONE } from '../timezone-config.js';

/**
 * Convert plain text line breaks to HTML for Instantly.ai email rendering
 * 
 * This function converts plain text with line breaks into properly formatted HTML
 * that renders correctly in Instantly.ai email campaigns. It handles:
 * - Normalizing different line ending formats (\r\n, \r, \n)
 * - Converting double line breaks to paragraph separations
 * - Converting single line breaks to <br /> tags
 * - Wrapping content in <p> tags for proper HTML structure
 * 
 * @param text - Plain text to convert to HTML
 * @returns HTML-formatted text
 */
export function convertLineBreaksToHTML(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Normalize line endings to \n
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split by double line breaks to create paragraphs
  const paragraphs = normalized.split('\n\n');

  return paragraphs
    .map(paragraph => {
      // Skip empty paragraphs
      if (!paragraph.trim()) {
        return '';
      }

      // Convert single line breaks within paragraphs to <br /> tags
      const withBreaks = paragraph.trim().replace(/\n/g, '<br />');

      // Wrap in paragraph tags for proper HTML structure (this is what worked!)
      return `<p>${withBreaks}</p>`;
    })
    .filter(p => p) // Remove empty paragraphs
    .join('');
}

/**
 * Build campaign payload with proper HTML formatting for Instantly.ai
 * 
 * This function builds a complete campaign payload according to the Instantly.ai API v2
 * specification. It handles both simple and complex campaign structures:
 * 
 * - Simple campaigns: Built from subject/body with automatic HTML conversion
 * - Complex campaigns: Use provided campaign_schedule and sequences directly
 * 
 * The function also handles:
 * - Multi-step sequences with custom or auto-generated follow-ups
 * - Timezone validation and mapping
 * - Days of week configuration
 * - HTML conversion for email bodies
 * - Message shortcut parsing (subject.body format)
 * 
 * @param args - Campaign arguments
 * @returns Campaign payload ready for API submission
 */
export function buildCampaignPayload(args: any): any {
  if (!args) {
    throw new McpError(ErrorCode.InvalidParams, 'Campaign arguments are required');
  }

  // Validate required fields
  if (!args.name) {
    throw new McpError(ErrorCode.InvalidParams, 'Campaign name is required');
  }

  // CRITICAL: Detect campaign type - complex vs simple
  const hasComplexStructure = args.campaign_schedule && args.sequences;

  if (hasComplexStructure) {
    // COMPLEX CAMPAIGN: Use provided structure directly
    console.error('[Instantly MCP] 🏗️ Building COMPLEX campaign payload with provided sequences');

    const campaignData: any = {
      name: args.name,
      campaign_schedule: args.campaign_schedule,
      sequences: args.sequences,
      email_list: args.email_list || []
    };

    // Add optional fields
    if (args.daily_limit !== undefined) campaignData.daily_limit = Number(args.daily_limit);
    if (args.email_gap !== undefined) campaignData.email_gap = Number(args.email_gap);
    if (args.text_only !== undefined) campaignData.text_only = Boolean(args.text_only);
    if (args.open_tracking !== undefined) campaignData.open_tracking = Boolean(args.open_tracking);
    if (args.link_tracking !== undefined) campaignData.link_tracking = Boolean(args.link_tracking);
    if (args.stop_on_reply !== undefined) campaignData.stop_on_reply = Boolean(args.stop_on_reply);

    return campaignData;
  }

  // SIMPLE CAMPAIGN: Build traditional structure
  console.error('[Instantly MCP] 🏗️ Building SIMPLE campaign payload with subject/body');

  // Process message shortcut if provided
  if (args.message && (!args.subject || !args.body)) {
    const msg = String(args.message).trim();
    let splitIdx = msg.indexOf('.');
    const nlIdx = msg.indexOf('\n');
    if (nlIdx !== -1 && (nlIdx < splitIdx || splitIdx === -1)) splitIdx = nlIdx;
    if (splitIdx === -1) splitIdx = msg.length;
    const subj = msg.slice(0, splitIdx).trim();
    const bod = msg.slice(splitIdx).trim();
    if (!args.subject) args.subject = subj;
    if (!args.body) args.body = bod || subj;
  }

  // Apply timezone and days configuration with bulletproof validation
  let timezone = args?.timezone || DEFAULT_TIMEZONE;

  // Validate and map timezone if needed
  const timezoneResult = validateAndMapTimezone(timezone);
  if (timezoneResult.mapped) {
    timezone = timezoneResult.timezone;
    console.error(`[Instantly MCP] 🔄 ${timezoneResult.warning}`);
  }

  const userDays = (args?.days as any) || {};

  // CRITICAL: days object must be non-empty according to API spec
  // API requires string keys for days ("0" through "6"), not numeric keys
  const daysConfig = {
    "0": userDays.sunday === true,
    "1": userDays.monday !== false,
    "2": userDays.tuesday !== false,
    "3": userDays.wednesday !== false,
    "4": userDays.thursday !== false,
    "5": userDays.friday !== false,
    "6": userDays.saturday === true
  };

  // Normalize and convert body content for HTML email rendering
  let normalizedBody = args.body ? String(args.body).trim() : '';
  let normalizedSubject = args.subject ? String(args.subject).trim() : '';

  // CRITICAL: Convert \n line breaks to <br /> tags for Instantly.ai HTML rendering
  if (normalizedBody) {
    normalizedBody = convertLineBreaksToHTML(normalizedBody);
  }

  // Subjects should not have line breaks
  if (normalizedSubject) {
    normalizedSubject = normalizedSubject.replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ' ');
  }

  // CRITICAL: Build payload according to exact API v2 specification
  const campaignData: any = {
    name: args.name,
    campaign_schedule: {
      schedules: [{
        name: args.schedule_name || 'My Schedule',
        timing: {
          from: args.timing_from || '09:00',
          to: args.timing_to || '17:00'
        },
        days: daysConfig,
        timezone: timezone
      }]
    }
  };

  // Add optional fields only if provided
  if (args.email_list && Array.isArray(args.email_list) && args.email_list.length > 0) {
    campaignData.email_list = args.email_list;
  }

  if (args.daily_limit !== undefined) {
    campaignData.daily_limit = Number(args.daily_limit);
  } else {
    campaignData.daily_limit = 30; // Default for cold email compliance
  }

  if (args.text_only !== undefined) {
    campaignData.text_only = Boolean(args.text_only);
  }

  if (args.track_opens !== undefined) {
    campaignData.open_tracking = Boolean(args.track_opens);
  }

  if (args.track_clicks !== undefined) {
    campaignData.link_tracking = Boolean(args.track_clicks);
  }

  if (args.stop_on_reply !== undefined) {
    campaignData.stop_on_reply = Boolean(args.stop_on_reply);
  }

  // Handle email gap parameter (API expects 'email_gap' in minutes)
  if (args.email_gap !== undefined) {
    campaignData.email_gap = Number(args.email_gap);
  }

  // Add sequences if email content is provided
  // CRITICAL FIX: Use correct Instantly API v2 structure with variants
  // Handle multi-step sequences if specified
  const sequenceSteps = args?.sequence_steps || 1;
  const stepDelayDays = args?.step_delay_days || 3;

  if (normalizedSubject || normalizedBody) {
    campaignData.sequences = [{
      steps: [{
        type: "email",
        // CRITICAL: delay field means "days to wait AFTER sending this step before sending next step"
        // For single-step campaigns (sequenceSteps === 1), delay should be 0 (no next step)
        // For multi-step campaigns, Step 1 should have the delay before Step 2
        delay: sequenceSteps > 1 ? stepDelayDays : 0,
        variants: [{
          subject: normalizedSubject,
          body: normalizedBody
        }]
      }]
    }];
  }

  if (sequenceSteps > 1 && campaignData.sequences) {
    const hasCustomBodies = args?.sequence_bodies && Array.isArray(args.sequence_bodies);
    const hasCustomSubjects = args?.sequence_subjects && Array.isArray(args.sequence_subjects);

    // Update the first step if custom content is provided
    if (hasCustomBodies || hasCustomSubjects) {
      const firstStepBody = hasCustomBodies ? convertLineBreaksToHTML(String(args.sequence_bodies[0])) : normalizedBody;
      const firstStepSubject = hasCustomSubjects ? String(args.sequence_subjects[0]) : normalizedSubject;

      // CRITICAL FIX: Update variants array, not direct properties
      campaignData.sequences[0].steps[0].variants[0].body = firstStepBody;
      campaignData.sequences[0].steps[0].variants[0].subject = firstStepSubject;
    }

    // Add follow-up steps
    for (let i = 1; i < sequenceSteps; i++) {
      let followUpSubject: string;
      let followUpBody: string;

      // Determine subject for this step
      if (hasCustomSubjects && args.sequence_subjects[i]) {
        followUpSubject = String(args.sequence_subjects[i]);
      } else {
        followUpSubject = `Follow-up: ${normalizedSubject}`;
      }

      // Determine body for this step
      if (hasCustomBodies && args.sequence_bodies[i]) {
        // Use provided custom body with HTML conversion
        followUpBody = convertLineBreaksToHTML(String(args.sequence_bodies[i]));
      } else {
        // Default behavior: add follow-up prefix to original body
        followUpBody = `This is follow-up #${i}.<br /><br />${normalizedBody}`.trim();
      }

      // CRITICAL FIX: Use correct Instantly API v2 structure with variants
      campaignData.sequences[0].steps.push({
        type: "email",
        delay: stepDelayDays,  // delay in days between steps
        variants: [{
          subject: followUpSubject,
          body: followUpBody
        }]
      });
    }
  }

  return campaignData;
}

