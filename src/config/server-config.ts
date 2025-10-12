/**
 * Instantly MCP Server - Server Configuration
 * 
 * Server initialization configuration and helpers.
 */

import { SERVER_NAME, SERVER_VERSION, INSTANTLY_ICONS } from './constants.js';

/**
 * Server metadata for MCP protocol
 */
export const SERVER_METADATA = {
  name: SERVER_NAME,
  version: SERVER_VERSION
};

/**
 * Load the Instantly.ai icons (MCP protocol compliant)
 */
export function loadInstantlyIcons(): Array<{src: string, mimeType: string, sizes: string}> {
  return INSTANTLY_ICONS;
}

/**
 * Parse command line arguments and environment
 */
export function parseConfig() {
  const args = process.argv.slice(2);
  const isN8nMode = args.includes('--n8n'); // Legacy support
  
  // Detect transport mode from environment or arguments
  const transportMode = detectTransportMode();

  return {
    isN8nMode, // Keep for backward compatibility
    transportMode,
    isHttpMode: transportMode === 'http' || isN8nMode
  };
}

/**
 * Detect transport mode from environment variables and arguments
 */
function detectTransportMode(): 'stdio' | 'http' {
  const args = process.argv.slice(2);
  
  // Check command line arguments first
  if (args.includes('--http') || args.includes('--n8n')) {
    return 'http';
  }
  
  // Check environment variable
  const envMode = process.env.TRANSPORT_MODE?.toLowerCase();
  if (envMode === 'http' || envMode === 'n8n') {
    return 'http';
  }
  
  // Check if running in production (DigitalOcean deployment)
  if (process.env.NODE_ENV === 'production') {
    return 'http';
  }
  
  // Default to stdio for local development
  return 'stdio';
}

/**
 * Get server configuration for transport initialization
 */
export function getServerConfig() {
  const config = parseConfig();
  
  return {
    ...config,
    metadata: SERVER_METADATA,
    icons: loadInstantlyIcons()
  };
}

