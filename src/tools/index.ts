/**
 * Instantly MCP Server - Tools Registry
 *
 * Central registry that combines all tool definitions from different categories.
 * This file exports the complete TOOLS_DEFINITION array used by the MCP server.
 *
 * Total: 34 tools across 5 categories
 * - Account tools: 11 tools
 * - Campaign tools: 6 tools
 * - Lead tools: 9 tools (includes bulk import)
 * - Email tools: 5 tools
 * - Analytics tools: 3 tools
 */

import { accountTools } from './account-tools.js';
import { campaignTools } from './campaign-tools.js';
import { leadTools } from './lead-tools.js';
import { emailTools } from './email-tools.js';
import { analyticsTools } from './analytics-tools.js';

/**
 * Complete tool definitions array
 * 
 * This array is used by the MCP server to register all available tools.
 * Tools are organized by category for better maintainability.
 */
export const TOOLS_DEFINITION = [
  // Account Management Tools (11 tools)
  ...accountTools,

  // Campaign Management Tools (6 tools)
  ...campaignTools,

  // Lead Management Tools (9 tools - includes bulk import)
  ...leadTools,

  // Email Management Tools (5 tools)
  ...emailTools,

  // Analytics & Reporting Tools (3 tools)
  ...analyticsTools,
];

/**
 * Tool count by category
 * 
 * Useful for validation and debugging
 */
export const TOOL_COUNTS = {
  account: accountTools.length,
  campaign: campaignTools.length,
  lead: leadTools.length,
  email: emailTools.length,
  analytics: analyticsTools.length,
  total: TOOLS_DEFINITION.length,
};

/**
 * Validate tool definitions
 * 
 * Ensures all tools have required properties and no duplicate names
 */
export function validateToolDefinitions(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const toolNames = new Set<string>();

  for (const tool of TOOLS_DEFINITION) {
    // Check required properties
    if (!tool.name) {
      errors.push('Tool missing name property');
    }
    if (!tool.description) {
      errors.push(`Tool ${tool.name || 'unknown'} missing description`);
    }
    if (!tool.inputSchema) {
      errors.push(`Tool ${tool.name || 'unknown'} missing inputSchema`);
    }

    // Check for duplicate names
    if (tool.name) {
      if (toolNames.has(tool.name)) {
        errors.push(`Duplicate tool name: ${tool.name}`);
      }
      toolNames.add(tool.name);
    }
  }

  // Validate expected count
  if (TOOLS_DEFINITION.length !== 34) {
    errors.push(`Expected 34 tools, found ${TOOLS_DEFINITION.length}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get tool by name
 * 
 * @param name - Tool name to search for
 * @returns Tool definition or undefined if not found
 */
export function getToolByName(name: string): any | undefined {
  return TOOLS_DEFINITION.find(tool => tool.name === name);
}

/**
 * Get tools by category
 * 
 * @param category - Category name (account, campaign, lead, email, analytics)
 * @returns Array of tool definitions for the category
 */
export function getToolsByCategory(category: 'account' | 'campaign' | 'lead' | 'email' | 'analytics'): any[] {
  switch (category) {
    case 'account':
      return accountTools;
    case 'campaign':
      return campaignTools;
    case 'lead':
      return leadTools;
    case 'email':
      return emailTools;
    case 'analytics':
      return analyticsTools;
    default:
      return [];
  }
}

