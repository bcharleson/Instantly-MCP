/**
 * Instantly MCP Server - API Client
 * 
 * HTTP client for making requests to the Instantly.ai API v2.
 */

import { INSTANTLY_API_URL } from '../config/constants.js';
import { handleInstantlyError, parseInstantlyResponse } from '../error-handler.js';
import { rateLimiter } from '../rate-limiter.js';

/**
 * API key configuration
 * Can be set via environment variable or command line argument
 */
let INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY;

// Check for API key in command line arguments
if (!INSTANTLY_API_KEY) {
  const args = process.argv.slice(2);
  const apiKeyIndex = args.findIndex(arg => arg === '--api-key');
  INSTANTLY_API_KEY = apiKeyIndex !== -1 && args[apiKeyIndex + 1] ? args[apiKeyIndex + 1] : undefined;
}

/**
 * Get the configured API key
 */
export function getConfiguredApiKey(): string | undefined {
  return INSTANTLY_API_KEY;
}

/**
 * Set the API key programmatically (used for testing)
 */
export function setApiKey(apiKey: string): void {
  INSTANTLY_API_KEY = apiKey;
}

/**
 * Core API request function
 * 
 * Makes HTTP requests to the Instantly.ai API with proper authentication,
 * error handling, and rate limiting.
 * 
 * @param endpoint - API endpoint path (e.g., '/accounts', '/campaigns/{id}')
 * @param options - Request options (method, body, params)
 * @param apiKey - Optional API key (overrides environment variable)
 * @returns Parsed API response
 */
export async function makeInstantlyRequest(
  endpoint: string,
  options: any = {},
  apiKey?: string
): Promise<any> {
  const method = options.method || 'GET';
  
  // Use provided API key or fall back to environment variable
  const useApiKey = apiKey || INSTANTLY_API_KEY;
  
  if (!useApiKey) {
    throw new Error('Instantly API key is required - provide via parameter or INSTANTLY_API_KEY environment variable');
  }
  
  const requestOptions: any = {
    method,
    headers: {
      'Authorization': `Bearer ${useApiKey}`,
    },
    // Add 60-second timeout for all API requests (increased for campaign creation)
    signal: AbortSignal.timeout(60000),
  };

  if (method !== 'GET' && options.body) {
    requestOptions.headers['Content-Type'] = 'application/json';
    requestOptions.body = JSON.stringify(options.body);
  }

  // Add query parameters for GET requests
  if (method === 'GET' && options.params) {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        // Handle array parameters - append each value separately
        if (Array.isArray(value)) {
          value.forEach((item) => {
            searchParams.append(key, String(item));
          });
        } else {
          searchParams.append(key, String(value));
        }
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      const separator = endpoint.includes('?') ? '&' : '?';
      endpoint = `${endpoint}${separator}${queryString}`;
    }
  }

  try {
    console.error(`[Instantly MCP] 🔍 DEBUG: About to fetch ${INSTANTLY_API_URL}${endpoint}`);
    const response = await fetch(`${INSTANTLY_API_URL}${endpoint}`, requestOptions);
    console.error(`[Instantly MCP] 🔍 DEBUG: Fetch completed, response status: ${response.status}`);
    console.error(`[Instantly MCP] 🔍 DEBUG: Response headers type: ${typeof response.headers}`);
    console.error(`[Instantly MCP] 🔍 DEBUG: Response headers has get method: ${typeof response.headers?.get === 'function'}`);

    // Update rate limit info from response headers
    try {
      console.error(`[Instantly MCP] 🔍 DEBUG: About to call rateLimiter.updateFromHeaders`);
      rateLimiter.updateFromHeaders(response.headers);
      console.error(`[Instantly MCP] 🔍 DEBUG: rateLimiter.updateFromHeaders completed`);
    } catch (error: any) {
      console.error('[Instantly MCP] ⚠️ Rate limiter update failed:', error.message);
      console.error('[Instantly MCP] ⚠️ Rate limiter error stack:', error.stack);
    }

    // Let centralized parser handle success and error payloads
    return await parseInstantlyResponse(response as unknown as Response);
  } catch (error) {
    throw handleInstantlyError(error, 'makeInstantlyRequest');
  }
}

/**
 * Check if API key is configured
 */
export function hasApiKey(): boolean {
  return !!INSTANTLY_API_KEY;
}

/**
 * Validate API key configuration for transport mode
 * 
 * @param transportMode - 'stdio' or 'http'
 * @returns true if API key is properly configured for the transport mode
 */
export function validateApiKeyForTransport(transportMode: 'stdio' | 'http'): boolean {
  // Only require API key for stdio mode (local usage)
  // HTTP mode handles API keys per-request via URL path: /mcp/{API_KEY}
  if (!INSTANTLY_API_KEY && transportMode === 'stdio') {
    console.error('Error: API key must be provided via INSTANTLY_API_KEY environment variable or --api-key argument for stdio mode');
    console.error('For security, using the environment variable is recommended:');
    console.error('  export INSTANTLY_API_KEY="your-api-key-here"');
    return false;
  }

  if (!INSTANTLY_API_KEY && transportMode === 'http') {
    console.error('[Instantly MCP] ⚠️  No API key provided at startup - using per-request API key mode');
    console.error('[Instantly MCP] 🔑 Clients must provide API key via x-instantly-api-key header');
  }

  return true;
}

/**
 * Log API key configuration status
 */
export function logApiKeyStatus(): void {
  console.error('[Instantly MCP] 🔑 API key configured:', INSTANTLY_API_KEY ? '✅ Present' : '❌ Missing');
}

