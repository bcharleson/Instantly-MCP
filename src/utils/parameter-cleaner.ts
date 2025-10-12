/**
 * Instantly MCP Server - Parameter Cleanup Utilities
 * 
 * This module contains utility functions for cleaning and validating parameters
 * before sending them to the Instantly.ai API v2. These functions ensure that
 * only valid parameters are sent to the API to prevent errors.
 * 
 * Functions:
 * - cleanupAndValidateParameters: Removes unsupported parameters from API calls
 * - validateEmailListAgainstAccounts: Validates sender email addresses against eligible accounts
 */

import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { getAllAccounts } from '../services/account-service.js';

/**
 * CRITICAL: Parameter cleanup and validation for Instantly.ai API v2 compatibility
 * 
 * This function MUST remove all parameters that don't exist in the official API
 * to prevent API errors. It also handles parameter conversions for backward compatibility.
 * 
 * @param args - The arguments object to clean
 * @returns Object containing cleaned arguments and warnings
 */
export function cleanupAndValidateParameters(args: any): { cleanedArgs: any; warnings: string[] } {
  const warnings: string[] = [];
  const cleanedArgs = { ...args };

  console.error('[Instantly MCP] 🧹 CRITICAL: Cleaning parameters for API v2 compatibility...');

  // CRITICAL: List of parameters that DO NOT EXIST in Instantly.ai API v2
  // These MUST be removed to prevent API errors
  const unsupportedParams = [
    'continue_thread',  // Not supported in API v2
    'email_gap_minutes' // This parameter does NOT exist in API v2 - only email_gap exists
    // NOTE: sequence_steps, step_delay_days, sequence_bodies, sequence_subjects are internal parameters
    // used to build multi-step sequences and should NOT be removed
  ];

  // Remove unsupported parameters and warn user
  for (const param of unsupportedParams) {
    if (cleanedArgs[param] !== undefined) {
      console.error(`[Instantly MCP] ⚠️ REMOVING invalid parameter: ${param} = ${cleanedArgs[param]}`);

      // Special handling for email_gap_minutes conversion
      if (param === 'email_gap_minutes' && cleanedArgs.email_gap === undefined) {
        cleanedArgs.email_gap = cleanedArgs[param];
        warnings.push(`✅ Converted legacy 'email_gap_minutes' to 'email_gap' (${cleanedArgs[param]} minutes) for API v2 compatibility.`);
      } else {
        warnings.push(`⚠️ Parameter '${param}' does not exist in Instantly.ai API v2 and has been removed.`);
      }

      delete cleanedArgs[param];
    }
  }

  console.error(`[Instantly MCP] ✅ Parameter cleanup complete. Warnings: ${warnings.length}`);
  return { cleanedArgs, warnings };
}

/**
 * Helper function to validate sender email addresses against eligible accounts
 * 
 * email_list contains SENDER email addresses that must be from verified Instantly accounts.
 * This function validates that all provided sender emails exist in the workspace and are
 * eligible for sending (active, setup complete, warmup finished).
 * 
 * @param emailList - Array of sender email addresses to validate
 * @param apiKey - Instantly.ai API key for fetching accounts
 * @throws McpError if validation fails
 */
export async function validateEmailListAgainstAccounts(emailList: string[], apiKey?: string): Promise<void> {
  try {
    console.error('[Instantly MCP] 🔍 Validating sender email addresses against accounts...');

    // Add timeout protection to prevent hanging - increased to 90 seconds for large account lists
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Account validation timeout after 90 seconds. This may indicate a large number of accounts or slow API response.')), 90000);
    });

    const accountsPromise = getAllAccounts(apiKey);
    const accountsResult = await Promise.race([accountsPromise, timeoutPromise]) as any;

    // FIX: getAllAccounts returns { data: [...], metadata: {...} }, not an array directly
    const accounts = accountsResult.data || accountsResult;

    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'No accounts found in your workspace. Please add at least one account before creating campaigns.'
      );
    }

    // Filter to eligible accounts (status=1, not setup_pending, warmup_status=1)
    const eligibleAccounts = accounts.filter(account =>
      account.status === 1 &&
      !account.setup_pending &&
      account.warmup_status === 1
    );

    if (eligibleAccounts.length === 0) {
      const accountIssues = accounts.map(acc => ({
        email: acc.email,
        issues: [
          ...(acc.status !== 1 ? ['Account not active'] : []),
          ...(acc.setup_pending ? ['Setup pending'] : []),
          ...(acc.warmup_status !== 1 ? ['Warmup not complete'] : [])
        ]
      }));

      throw new McpError(
        ErrorCode.InvalidParams,
        `No eligible sender accounts found for campaign creation. Account issues:\n${
          accountIssues.map(acc => `• ${acc.email}: ${acc.issues.join(', ')}`).join('\n')
        }\n\nPlease ensure accounts are active, setup is complete, and warmup is finished before creating campaigns.`
      );
    }

    // Create set of eligible email addresses for validation
    const eligibleEmails = new Set<string>();
    const eligibleEmailsForDisplay: string[] = [];

    for (const account of eligibleAccounts) {
      eligibleEmails.add(account.email.toLowerCase());
      eligibleEmailsForDisplay.push(`${account.email} (warmup: ${account.warmup_score || 'N/A'})`);
    }

    // Validate each sender email in the provided list
    const invalidEmails: string[] = [];
    for (const email of emailList) {
      if (!eligibleEmails.has(email.toLowerCase())) {
        invalidEmails.push(email);
      }
    }

    if (invalidEmails.length > 0) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid sender email addresses found in email_list: ${invalidEmails.join(', ')}\n\n` +
        `Available eligible sender accounts:\n${eligibleEmailsForDisplay.map(email => `• ${email}`).join('\n')}\n\n` +
        `Please use only verified sender email addresses from your Instantly workspace. Call list_accounts to see all available accounts.`
      );
    }

    console.error(`[Instantly MCP] ✅ Validated ${emailList.length} sender email(s) against ${eligibleAccounts.length} eligible accounts`);

  } catch (error: any) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to validate email addresses: ${error.message}`
    );
  }
}

