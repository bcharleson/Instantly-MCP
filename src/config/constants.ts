/**
 * Instantly MCP Server - Configuration Constants
 * 
 * Centralized constants and configuration values used throughout the application.
 */

// Instantly.ai API Configuration
export const INSTANTLY_API_URL = 'https://api.instantly.ai/api/v2';

// Instantly.ai custom icons (using publicly accessible icon URL)
// Icon fetched from Instantly.ai's official website favicon
// This approach matches how Smithery and other MCP servers display icons
export const INSTANTLY_ICONS = [
  {
    src: 'https://cdn.prod.website-files.com/63860c8c65e7bef4a1eeebeb/63f62e4f7dc7e3426e9b7874_cleaned_rounded_favicon.png',
    mimeType: 'image/png',
    sizes: 'any'
  }
];

// Server Metadata
export const SERVER_NAME = 'instantly-mcp';
export const SERVER_VERSION = '1.1.0';

// Default Values
export const DEFAULT_LIMIT = 100;
export const MAX_LIMIT = 100;

// Environment Variable Names
export const ENV_VARS = {
  API_KEY: 'INSTANTLY_API_KEY',
  TRANSPORT_MODE: 'TRANSPORT_MODE',
  PORT: 'PORT',
  NODE_ENV: 'NODE_ENV'
} as const;

