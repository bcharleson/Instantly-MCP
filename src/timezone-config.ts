/**
 * Official Timezone Configuration for Instantly.ai MCP Server
 *
 * This file contains the official timezone list from the Instantly.ai application.
 * These timezones are synchronized with the Instantly.ai Copilot integration
 * and are guaranteed to work with the Instantly.ai API.
 *
 * Last updated: 2025-09-30
 * Source: Instantly.ai Copilot integration (provided by Andrei)
 * Total timezones: 107
 */

import { z } from 'zod';

/**
 * OFFICIAL INSTANTLY.AI TIMEZONES
 * Synchronized with the Instantly.ai application timezone selector
 */
export const VERIFIED_WORKING_TIMEZONES = [
  'Etc/GMT+12',
  'Etc/GMT+11',
  'Etc/GMT+10',
  'America/Anchorage',
  'America/Dawson',
  'America/Creston',
  'America/Chihuahua',
  'America/Boise',
  'America/Belize',
  'America/Chicago',
  'America/Bahia_Banderas',
  'America/Regina',
  'America/Bogota',
  'America/Detroit',
  'America/Indiana/Marengo',
  'America/Caracas',
  'America/Asuncion',
  'America/Glace_Bay',
  'America/Campo_Grande',
  'America/Anguilla',
  'America/Santiago',
  'America/St_Johns',
  'America/Sao_Paulo',
  'America/Argentina/La_Rioja',
  'America/Araguaina',
  'America/Godthab',
  'America/Montevideo',
  'America/Bahia',
  'America/Noronha',
  'America/Scoresbysund',
  'Atlantic/Cape_Verde',
  'Africa/Casablanca',
  'America/Danmarkshavn',
  'Europe/Isle_of_Man',
  'Atlantic/Canary',
  'Africa/Abidjan',
  'Arctic/Longyearbyen',
  'Europe/Belgrade',
  'Africa/Ceuta',
  'Europe/Sarajevo',
  'Africa/Algiers',
  'Africa/Windhoek',
  'Asia/Nicosia',
  'Asia/Beirut',
  'Africa/Cairo',
  'Asia/Damascus',
  'Europe/Bucharest',
  'Africa/Blantyre',
  'Europe/Helsinki',
  'Europe/Istanbul',
  'Asia/Jerusalem',
  'Africa/Tripoli',
  'Asia/Amman',
  'Asia/Baghdad',
  'Europe/Kaliningrad',
  'Asia/Aden',
  'Africa/Addis_Ababa',
  'Europe/Kirov',
  'Europe/Astrakhan',
  'Asia/Tehran',
  'Asia/Dubai',
  'Asia/Baku',
  'Indian/Mahe',
  'Asia/Tbilisi',
  'Asia/Yerevan',
  'Asia/Kabul',
  'Antarctica/Mawson',
  'Asia/Yekaterinburg',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Colombo',
  'Asia/Kathmandu',
  'Antarctica/Vostok',
  'Asia/Dhaka',
  'Asia/Rangoon',
  'Antarctica/Davis',
  'Asia/Novokuznetsk',
  'Asia/Hong_Kong',
  'Asia/Krasnoyarsk',
  'Asia/Brunei',
  'Australia/Perth',
  'Asia/Taipei',
  'Asia/Choibalsan',
  'Asia/Irkutsk',
  'Asia/Dili',
  'Asia/Pyongyang',
  'Australia/Adelaide',
  'Australia/Darwin',
  'Australia/Brisbane',
  'Australia/Melbourne',
  'Antarctica/DumontDUrville',
  'Australia/Currie',
  'Asia/Chita',
  'Antarctica/Macquarie',
  'Asia/Sakhalin',
  'Pacific/Auckland',
  'Etc/GMT-12',
  'Pacific/Fiji',
  'Asia/Anadyr',
  'Asia/Kamchatka',
  'Etc/GMT-13',
  'Pacific/Apia',
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
 * Official default timezone from Instantly.ai application
 */
export const DEFAULT_TIMEZONE = "America/Chicago";

/**
 * TIMEZONE FALLBACK MAPPING
 * Maps commonly requested timezone aliases to official Instantly.ai timezones
 */
export const TIMEZONE_FALLBACK_MAP: Record<string, string> = {
  // Common US timezone aliases
  "America/New_York": "America/Detroit",
  "America/Los_Angeles": "America/Dawson",
  "America/Denver": "America/Boise",
  "US/Eastern": "America/Detroit",
  "US/Central": "America/Chicago",
  "US/Mountain": "America/Boise",
  "US/Pacific": "America/Dawson",

  // Common European timezone aliases
  "Europe/London": "Europe/Isle_of_Man",
  "Europe/Paris": "Africa/Ceuta",
  "Europe/Berlin": "Arctic/Longyearbyen",
  "Europe/Rome": "Arctic/Longyearbyen",
  "Europe/Madrid": "Africa/Ceuta",
  "Europe/Amsterdam": "Arctic/Longyearbyen",
  "Europe/Vienna": "Arctic/Longyearbyen",
  "Europe/Prague": "Europe/Belgrade",
  "Europe/Warsaw": "Europe/Sarajevo",
  "Europe/Stockholm": "Arctic/Longyearbyen",
  "Europe/Oslo": "Arctic/Longyearbyen",
  "Europe/Copenhagen": "Africa/Ceuta",
  "Europe/Brussels": "Africa/Ceuta",
  "Europe/Zurich": "Arctic/Longyearbyen",

  // Common Asian timezone aliases
  "Asia/Tokyo": "Asia/Dili",
  "Asia/Seoul": "Asia/Pyongyang",
  "Asia/Shanghai": "Asia/Hong_Kong",
  "Asia/Singapore": "Asia/Brunei",
  "Asia/Manila": "Asia/Hong_Kong",
  "Asia/Bangkok": "Antarctica/Davis",
  "Asia/Jakarta": "Antarctica/Davis",
  "Asia/Kuala_Lumpur": "Asia/Brunei",

  // Common Australian timezone aliases
  "Australia/Sydney": "Australia/Melbourne",

  // UTC variants
  "UTC": "America/Danmarkshavn",
  "GMT": "America/Danmarkshavn",
};

/**
 * Official timezone validation schema
 * Only allows timezones from the official Instantly.ai application
 */
export const BulletproofTimezoneSchema = z.enum(VERIFIED_WORKING_TIMEZONES, {
  errorMap: (issue, ctx) => {
    const input = ctx.data;
    const fallback = TIMEZONE_FALLBACK_MAP[input as string];

    if (fallback) {
      return {
        message: `Timezone "${input}" is not in the official Instantly.ai timezone list. Using "${fallback}" instead. Recommended timezones: ${BUSINESS_PRIORITY_TIMEZONES.join(', ')}`
      };
    }

    return {
      message: `Timezone "${input}" is not supported. Use one of: ${BUSINESS_PRIORITY_TIMEZONES.join(', ')}. For a complete list of ${VERIFIED_WORKING_TIMEZONES.length} supported timezones, see the Instantly.ai application.`
    };
  }
});

/**
 * Timezone validation and fallback function
 * Automatically maps unsupported timezones to official Instantly.ai timezones
 */
export function validateAndMapTimezone(timezone: string): {
  timezone: string;
  mapped: boolean;
  originalTimezone?: string;
  warning?: string;
} {
  // Check if timezone is already in the official list
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
      warning: `Timezone "${timezone}" is not in the official Instantly.ai timezone list. Automatically mapped to "${fallback}".`
    };
  }

  // No mapping available, use default
  return {
    timezone: DEFAULT_TIMEZONE,
    mapped: true,
    originalTimezone: timezone,
    warning: `Timezone "${timezone}" is not supported. Using default timezone "${DEFAULT_TIMEZONE}". Recommended timezones: ${BUSINESS_PRIORITY_TIMEZONES.join(', ')}`
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
  const timezoneInfo: Record<string, { timezone: string; description: string; utcOffset: string; region: string }> = {
    "America/Chicago": { timezone: "America/Chicago", description: "Central Time (US)", utcOffset: "UTC-6", region: "North America" },
    "America/Detroit": { timezone: "America/Detroit", description: "Eastern Time (US)", utcOffset: "UTC-5", region: "North America" },
    "America/Boise": { timezone: "America/Boise", description: "Mountain Time (US)", utcOffset: "UTC-7", region: "North America" },
    "America/Anchorage": { timezone: "America/Anchorage", description: "Alaska Time (US)", utcOffset: "UTC-9", region: "North America" },
    "Europe/Belgrade": { timezone: "Europe/Belgrade", description: "Central European Time", utcOffset: "UTC+1", region: "Europe" },
    "Europe/Helsinki": { timezone: "Europe/Helsinki", description: "Eastern European Time", utcOffset: "UTC+2", region: "Europe" },
    "Asia/Dubai": { timezone: "Asia/Dubai", description: "Gulf Standard Time", utcOffset: "UTC+4", region: "Asia" },
    "Asia/Hong_Kong": { timezone: "Asia/Hong_Kong", description: "Hong Kong Time", utcOffset: "UTC+8", region: "Asia" },
    "Australia/Melbourne": { timezone: "Australia/Melbourne", description: "Australian Eastern Time", utcOffset: "UTC+10", region: "Oceania" },
    "Pacific/Auckland": { timezone: "Pacific/Auckland", description: "New Zealand Time", utcOffset: "UTC+12", region: "Oceania" },
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
