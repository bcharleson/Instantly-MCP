/**
 * MCP Client Detection and Timeout Configuration
 * 
 * Different MCP clients have different timeout thresholds:
 * - Gemini CLI: ~30 seconds
 * - ChatGPT Desktop: ~45 seconds
 * - Claude Desktop: ~60 seconds
 * - Claude Mobile: ~60 seconds
 * 
 * This module detects the client and provides appropriate timeout configurations
 */

export interface ClientTimeoutConfig {
  clientName: string;
  totalTimeoutMs: number;
  bufferMs: number;
  delayBetweenRequestsMs: number;
  maxPages: number;
  description: string;
}

export interface ClientInfo {
  name: string;
  version?: string;
  userAgent?: string;
}

/**
 * Predefined timeout configurations for known MCP clients
 */
const CLIENT_TIMEOUT_CONFIGS: Record<string, ClientTimeoutConfig> = {
  gemini: {
    clientName: 'Gemini',
    totalTimeoutMs: 20000, // 20 seconds (conservative for 30s timeout)
    bufferMs: 3000, // 3 second buffer
    delayBetweenRequestsMs: 50, // Minimal delay
    maxPages: 3, // Limit pages to ensure completion
    description: 'Gemini CLI has strict 30-second timeout'
  },
  
  chatgpt: {
    clientName: 'ChatGPT',
    totalTimeoutMs: 30000, // 30 seconds (conservative for 45s timeout)
    bufferMs: 5000, // 5 second buffer
    delayBetweenRequestsMs: 100, // Small delay
    maxPages: 5, // Moderate page limit
    description: 'ChatGPT Desktop has moderate timeout'
  },
  
  claude: {
    clientName: 'Claude',
    totalTimeoutMs: 45000, // 45 seconds (conservative for 60s timeout)
    bufferMs: 5000, // 5 second buffer
    delayBetweenRequestsMs: 100, // Small delay
    maxPages: 10, // Higher page limit
    description: 'Claude has generous timeout'
  },
  
  default: {
    clientName: 'Unknown',
    totalTimeoutMs: 20000, // 20 seconds (safest default)
    bufferMs: 3000, // 3 second buffer
    delayBetweenRequestsMs: 50, // Minimal delay
    maxPages: 3, // Conservative page limit
    description: 'Unknown client - using conservative settings'
  }
};

/**
 * Detect MCP client from initialization info
 */
export function detectClient(clientInfo?: ClientInfo, userAgent?: string): string {
  // Check client name from MCP initialize request
  if (clientInfo?.name) {
    const name = clientInfo.name.toLowerCase();
    
    if (name.includes('gemini')) return 'gemini';
    if (name.includes('chatgpt') || name.includes('openai')) return 'chatgpt';
    if (name.includes('claude') || name.includes('anthropic')) return 'claude';
  }
  
  // Check user agent as fallback
  if (userAgent) {
    const ua = userAgent.toLowerCase();
    
    if (ua.includes('gemini')) return 'gemini';
    if (ua.includes('chatgpt') || ua.includes('openai')) return 'chatgpt';
    if (ua.includes('claude') || ua.includes('anthropic')) return 'claude';
  }
  
  return 'default';
}

/**
 * Get timeout configuration for a specific client
 */
export function getClientTimeoutConfig(clientType: string): ClientTimeoutConfig {
  return CLIENT_TIMEOUT_CONFIGS[clientType] || CLIENT_TIMEOUT_CONFIGS.default;
}

/**
 * Get timeout configuration from client info
 */
export function getTimeoutConfigFromClientInfo(
  clientInfo?: ClientInfo,
  userAgent?: string
): ClientTimeoutConfig {
  const clientType = detectClient(clientInfo, userAgent);
  const config = getClientTimeoutConfig(clientType);
  
  console.error(`[Client Detection] Detected client: ${config.clientName}`);
  console.error(`[Client Detection] Timeout config: ${config.totalTimeoutMs}ms total, ${config.maxPages} max pages`);
  
  return config;
}

/**
 * Client detection manager - stores client info for the session
 */
export class ClientDetectionManager {
  private clientInfo?: ClientInfo;
  private userAgent?: string;
  private detectedClient?: string;
  private timeoutConfig?: ClientTimeoutConfig;
  
  /**
   * Update client information from initialize request
   */
  updateClientInfo(clientInfo?: ClientInfo, userAgent?: string): void {
    this.clientInfo = clientInfo;
    this.userAgent = userAgent;
    this.detectedClient = detectClient(clientInfo, userAgent);
    this.timeoutConfig = getClientTimeoutConfig(this.detectedClient);
    
    console.error(`[Client Detection] Client updated: ${this.timeoutConfig.clientName}`);
    console.error(`[Client Detection] Config: ${JSON.stringify(this.timeoutConfig, null, 2)}`);
  }
  
  /**
   * Get current timeout configuration
   */
  getTimeoutConfig(): ClientTimeoutConfig {
    if (!this.timeoutConfig) {
      console.error('[Client Detection] No client info available, using default config');
      return CLIENT_TIMEOUT_CONFIGS.default;
    }
    
    return this.timeoutConfig;
  }
  
  /**
   * Get detected client name
   */
  getClientName(): string {
    return this.timeoutConfig?.clientName || 'Unknown';
  }
  
  /**
   * Check if client is known to have strict timeouts
   */
  hasStrictTimeout(): boolean {
    return this.detectedClient === 'gemini' || this.detectedClient === 'default';
  }
  
  /**
   * Get recommended strategy for pagination
   */
  getRecommendedPaginationStrategy(): 'fast' | 'balanced' | 'complete' {
    if (!this.detectedClient || this.detectedClient === 'default') {
      return 'fast'; // Unknown clients get fastest strategy
    }
    
    switch (this.detectedClient) {
      case 'gemini':
        return 'fast'; // Gemini needs fast strategy
      case 'chatgpt':
        return 'balanced'; // ChatGPT can handle balanced
      case 'claude':
        return 'complete'; // Claude can handle complete pagination
      default:
        return 'fast';
    }
  }
}

/**
 * Global client detection manager instance
 */
export const globalClientManager = new ClientDetectionManager();

/**
 * Helper function to format timeout warning message
 */
export function formatTimeoutWarning(
  itemsRetrieved: number,
  nextCursor?: string,
  clientName?: string
): string {
  const client = clientName || 'your MCP client';
  
  if (nextCursor) {
    return `⚠️ Timeout protection: Retrieved ${itemsRetrieved} items to avoid ${client} timeout. More results available. To retrieve additional items, call this tool again with starting_after="${nextCursor}"`;
  }
  
  return `✅ Retrieved ${itemsRetrieved} items successfully within ${client} timeout limits.`;
}

/**
 * Calculate safe page limit based on estimated time per page
 */
export function calculateSafePageLimit(
  config: ClientTimeoutConfig,
  estimatedMsPerPage: number = 3000
): number {
  const availableTime = config.totalTimeoutMs - config.bufferMs;
  const calculatedPages = Math.floor(availableTime / estimatedMsPerPage);
  
  // Return minimum of calculated pages and configured max pages
  return Math.min(calculatedPages, config.maxPages);
}

