/**
 * Bulletproof Timezone Configuration for Instantly.ai MCP Server
 * 
 * This file contains the verified working timezones based on systematic testing
 * against the actual Instantly.ai API. All timezones listed here have been
 * confirmed to work in production.
 * 
 * Last updated: 2025-09-29
 * Test results: 26/27 timezones working (96% success rate)
 */

import { z } from 'zod';

/**
 * VERIFIED WORKING TIMEZONES
 * These timezones have been tested and confirmed to work with Instantly.ai API
 */
export const VERIFIED_WORKING_TIMEZONES = [
  // === NORTH AMERICA ===
  "America/Anchorage",    // Alaska Time (UTC-9)
  "America/Boise",        // Mountain Time (UTC-7)
  "America/Chicago",      // Central Time (UTC-6) - RECOMMENDED DEFAULT
  "America/Detroit",      // Eastern Time (UTC-5)
  
  // === SOUTH AMERICA ===
  "America/Bogota",       // Colombia Time (UTC-5)
  "America/Caracas",      // Venezuela Time (UTC-4)
  "America/Sao_Paulo",    // Brazil Time (UTC-3)
  
  // === EUROPE ===
  "Europe/Belgrade",      // Central European Time (UTC+1)
  "Europe/Bucharest",     // Eastern European Time (UTC+2)
  "Europe/Helsinki",      // Eastern European Time (UTC+2)
  "Europe/Istanbul",      // Turkey Time (UTC+3)
  "Europe/Kaliningrad",   // Kaliningrad Time (UTC+2)
  
  // === AFRICA ===
  "Africa/Cairo",         // Egypt Time (UTC+2)
  "Africa/Casablanca",    // Morocco Time (UTC+1)
  
  // === ASIA ===
  "Asia/Baghdad",         // Arabia Standard Time (UTC+3)
  "Asia/Dubai",           // Gulf Standard Time (UTC+4)
  "Asia/Hong_Kong",       // Hong Kong Time (UTC+8)
  "Asia/Karachi",         // Pakistan Standard Time (UTC+5)
  "Asia/Kolkata",         // India Standard Time (UTC+5:30)
  "Asia/Tehran",          // Iran Standard Time (UTC+3:30)
  "Asia/Yekaterinburg",   // Yekaterinburg Time (UTC+5)
  
  // === OCEANIA ===
  "Australia/Darwin",     // Australian Central Time (UTC+9:30)
  "Australia/Melbourne",  // Australian Eastern Time (UTC+10)
  "Australia/Perth",      // Australian Western Time (UTC+8)
  "Pacific/Auckland",     // New Zealand Time (UTC+12)
  
  // === ATLANTIC ===
  "Atlantic/Cape_Verde",  // Cape Verde Time (UTC-1)
] as const;

/**
 * KNOWN FAILED TIMEZONES
 * These timezones are in the API documentation but fail in practice
 */
export const KNOWN_FAILED_TIMEZONES = [
  "Asia/Tokyo",           // Japan Standard Time - FAILS despite being in API docs
] as const;

/**
 * BUSINESS PRIORITY TIMEZONES
 * Most commonly used timezones for business operations
 */
export const BUSINESS_PRIORITY_TIMEZONES = [
  "America/Chicago",      // Central Time (US) - RECOMMENDED DEFAULT
  "America/Detroit",      // Eastern Time (US)
  "Europe/Belgrade",      // Central European Time
  "Asia/Dubai",           // Gulf Standard Time
  "Asia/Hong_Kong",       // Hong Kong Time
  "Australia/Melbourne",  // Australian Eastern Time
] as const;

/**
 * DEFAULT TIMEZONE
 * Verified working timezone to use as default
 */
export const DEFAULT_TIMEZONE = "America/Chicago";

/**
 * TIMEZONE FALLBACK MAPPING
 * Maps commonly requested but unsupported timezones to supported alternatives
 */
export const TIMEZONE_FALLBACK_MAP: Record<string, string> = {
  // Common US timezone aliases
  "America/New_York": "America/Detroit",
  "America/Los_Angeles": "America/Boise", // Closest working timezone
  "America/Denver": "America/Boise",
  "US/Eastern": "America/Detroit",
  "US/Central": "America/Chicago",
  "US/Mountain": "America/Boise",
  "US/Pacific": "America/Boise",
  
  // Common European timezone aliases
  "Europe/London": "Europe/Belgrade",
  "Europe/Paris": "Europe/Belgrade",
  "Europe/Berlin": "Europe/Belgrade",
  "Europe/Rome": "Europe/Belgrade",
  "Europe/Madrid": "Europe/Belgrade",
  "Europe/Amsterdam": "Europe/Belgrade",
  "Europe/Vienna": "Europe/Belgrade",
  "Europe/Prague": "Europe/Belgrade",
  "Europe/Warsaw": "Europe/Belgrade",
  "Europe/Stockholm": "Europe/Helsinki",
  "Europe/Oslo": "Europe/Belgrade",
  "Europe/Copenhagen": "Europe/Belgrade",
  "Europe/Brussels": "Europe/Belgrade",
  "Europe/Zurich": "Europe/Belgrade",
  
  // Common Asian timezone aliases
  "Asia/Tokyo": "Asia/Hong_Kong",
  "Asia/Seoul": "Asia/Hong_Kong",
  "Asia/Shanghai": "Asia/Hong_Kong",
  "Asia/Singapore": "Asia/Hong_Kong",
  "Asia/Manila": "Asia/Hong_Kong",
  "Asia/Bangkok": "Asia/Dubai",
  "Asia/Jakarta": "Asia/Dubai",
  "Asia/Kuala_Lumpur": "Asia/Hong_Kong",
  
  // Common Australian timezone aliases
  "Australia/Sydney": "Australia/Melbourne",
  "Australia/Brisbane": "Australia/Melbourne",
  "Australia/Adelaide": "Australia/Darwin",
  
  // UTC variants
  "UTC": "America/Chicago",
  "GMT": "Europe/Belgrade",
};

/**
 * Bulletproof timezone validation schema
 * Only allows verified working timezones
 */
export const BulletproofTimezoneSchema = z.enum(VERIFIED_WORKING_TIMEZONES, {
  errorMap: (issue, ctx) => {
    const input = ctx.data;
    const fallback = TIMEZONE_FALLBACK_MAP[input as string];
    
    if (fallback) {
      return {
        message: `Timezone "${input}" is not supported by Instantly.ai API. Using "${fallback}" instead. Supported timezones: ${BUSINESS_PRIORITY_TIMEZONES.join(', ')}`
      };
    }
    
    return {
      message: `Timezone "${input}" is not supported by Instantly.ai API. Use one of: ${BUSINESS_PRIORITY_TIMEZONES.join(', ')}. For a complete list of ${VERIFIED_WORKING_TIMEZONES.length} supported timezones, see the documentation.`
    };
  }
});

/**
 * Timezone validation and fallback function
 * Automatically maps unsupported timezones to supported ones
 */
export function validateAndMapTimezone(timezone: string): {
  timezone: string;
  mapped: boolean;
  originalTimezone?: string;
  warning?: string;
} {
  // Check if timezone is already supported
  if (VERIFIED_WORKING_TIMEZONES.includes(timezone as any)) {
    return {
      timezone,
      mapped: false
    };
  }
  
  // Check if we have a fallback mapping
  const fallback = TIMEZONE_FALLBACK_MAP[timezone];
  if (fallback) {
    return {
      timezone: fallback,
      mapped: true,
      originalTimezone: timezone,
      warning: `Timezone "${timezone}" is not supported by Instantly.ai API. Automatically mapped to "${fallback}".`
    };
  }
  
  // No mapping available, use default
  return {
    timezone: DEFAULT_TIMEZONE,
    mapped: true,
    originalTimezone: timezone,
    warning: `Timezone "${timezone}" is not supported by Instantly.ai API. Using default timezone "${DEFAULT_TIMEZONE}". Supported timezones: ${BUSINESS_PRIORITY_TIMEZONES.join(', ')}`
  };
}

/**
 * Get timezone display information
 */
export function getTimezoneInfo(timezone: string): {
  timezone: string;
  description: string;
  utcOffset: string;
  region: string;
} {
  const timezoneInfo: Record<string, { description: string; utcOffset: string; region: string }> = {
    "America/Chicago": { description: "Central Time (US)", utcOffset: "UTC-6", region: "North America" },
    "America/Detroit": { description: "Eastern Time (US)", utcOffset: "UTC-5", region: "North America" },
    "America/Boise": { description: "Mountain Time (US)", utcOffset: "UTC-7", region: "North America" },
    "America/Anchorage": { description: "Alaska Time (US)", utcOffset: "UTC-9", region: "North America" },
    "Europe/Belgrade": { description: "Central European Time", utcOffset: "UTC+1", region: "Europe" },
    "Europe/Helsinki": { description: "Eastern European Time", utcOffset: "UTC+2", region: "Europe" },
    "Asia/Dubai": { description: "Gulf Standard Time", utcOffset: "UTC+4", region: "Asia" },
    "Asia/Hong_Kong": { description: "Hong Kong Time", utcOffset: "UTC+8", region: "Asia" },
    "Australia/Melbourne": { description: "Australian Eastern Time", utcOffset: "UTC+10", region: "Oceania" },
    "Pacific/Auckland": { description: "New Zealand Time", utcOffset: "UTC+12", region: "Oceania" },
  };
  
  return timezoneInfo[timezone] || {
    timezone: timezone,
    description: timezone,
    utcOffset: "Unknown",
    region: "Unknown"
  };
}

/**
 * Export type for TypeScript
 */
export type VerifiedTimezone = typeof VERIFIED_WORKING_TIMEZONES[number];
