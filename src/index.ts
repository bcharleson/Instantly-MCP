#!/usr/bin/env node

/**
 * Instantly MCP Server - Official Multi-Transport Implementation
 *
 * Supports both local and remote usage:
 * - Stdio Transport: For Claude Desktop, Cursor IDE, local NPM usage
 * - Streaming HTTP Transport: For remote hosting at https://mcp.instantly.ai/mcp
 *
 * Usage:
 *   node dist/index.js                    # stdio mode (default)
 *   TRANSPORT_MODE=http node dist/index.js # HTTP mode for mcp.instantly.ai
 *
 * Environment Variables:
 *   INSTANTLY_API_KEY: Your Instantly.ai API key (required for stdio mode)
 *   TRANSPORT_MODE: 'stdio' (default) or 'http'
 *   PORT: HTTP server port (default: 3000)
 *   NODE_ENV: 'production' for mcp.instantly.ai deployment
 *
 * Authentication Methods (HTTP mode):
 *   1. Header-based (more secure): mcp.instantly.ai/mcp
 *      - Authorization: Bearer [API_KEY]
 *      - x-instantly-api-key: [API_KEY]
 *   2. URL-based: mcp.instantly.ai/mcp/{API_KEY}
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { TransportManager } from './transport-manager-new.js';

// Ensure fetch is available (Node.js 18+ has it built-in)
// Version: 1.1.0 - Modular architecture with extracted components
if (typeof fetch === 'undefined') {
  console.error('[Instantly MCP] ❌ fetch is not available. Please use Node.js 18+ or install a fetch polyfill.');
  process.exit(1);
}

// Import MCP protocol handlers
import { registerMcpHandlers } from './handlers/mcp-handlers.js';

// Import tools definition
import { TOOLS_DEFINITION } from './tools/index.js';

// Import tool executor
import { executeToolDirectly } from './handlers/tool-executor.js';

// Parse command line arguments and environment
function parseConfig() {
  const args = process.argv.slice(2);
  const isN8nMode = args.includes('--n8n'); // Legacy support
  const transportMode = TransportManager.detectTransportMode();

  return {
    isN8nMode, // Keep for backward compatibility
    transportMode,
    isHttpMode: transportMode === 'http' || isN8nMode
  };
}

// API key configuration
let INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY;

if (!INSTANTLY_API_KEY) {
  const args = process.argv.slice(2);
  const apiKeyIndex = args.findIndex(arg => arg === '--api-key');
  INSTANTLY_API_KEY = apiKeyIndex !== -1 && args[apiKeyIndex + 1] ? args[apiKeyIndex + 1] : undefined;
}

// Check if we need an API key at startup
const { transportMode } = parseConfig();

// Only require API key for stdio mode (local usage)
// HTTP mode handles API keys per-request via URL path: /mcp/{API_KEY}
if (!INSTANTLY_API_KEY && transportMode === 'stdio') {
  console.error('Error: API key must be provided via INSTANTLY_API_KEY environment variable or --api-key argument for stdio mode');
  console.error('For security, using the environment variable is recommended:');
  console.error('  export INSTANTLY_API_KEY="your-api-key-here"');
  process.exit(1);
}

if (!INSTANTLY_API_KEY && transportMode === 'http') {
  console.error('[Instantly MCP] ⚠️  No API key provided at startup - using per-request API key mode');
  console.error('[Instantly MCP] 🔑 Clients must provide API key via x-instantly-api-key header');
}

// Core server implementation
const server = new Server(
  {
    name: 'instantly-mcp',
    version: '1.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

console.error('[Instantly MCP] 🚀 Initializing server...');
console.error('[Instantly MCP] 🔑 API key configured:', INSTANTLY_API_KEY ? '✅ Present' : '❌ Missing');

// Register MCP protocol handlers (Initialize, ListTools, CallTool)
registerMcpHandlers(server, INSTANTLY_API_KEY);

// Main execution
async function main() {
  const { isN8nMode, transportMode, isHttpMode } = parseConfig();

  if (isHttpMode) {
    console.error(`[Instantly MCP] 🌐 Starting ${transportMode} transport mode with StreamableHTTPServerTransport...`);

    // Use the proper StreamingHttpTransport that implements MCP protocol
    const { StreamingHttpTransport } = await import('./streaming-http-transport.js');
    
    const config = {
      port: parseInt(process.env.PORT || '3000'),
      host: process.env.HOST || '0.0.0.0',
      cors: {
        origin: '*',
        credentials: true
      },
      auth: {
        apiKeyHeader: 'x-instantly-api-key'
      }
    };
    
    const transport = new StreamingHttpTransport(server, config);
    
    // Start the HTTP server (includes server.connect internally)
    await transport.start();
    
    console.error('[Instantly MCP] ✅ StreamableHTTPServerTransport started successfully');
    console.error('[Instantly MCP] 📡 Server properly implements MCP streaming protocol for Claude Desktop');
    
    if (process.env.NODE_ENV === 'production') {
      console.error('[Instantly MCP] 🏢 Production endpoints:');
      console.error('[Instantly MCP] 🔗 URL auth: https://instantly-mcp-5p4as.ondigitalocean.app/mcp/{API_KEY}');
    }

  } else {
    console.error('[Instantly MCP] 🔌 Starting stdio mode (Claude Desktop, Cursor IDE)...');
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[Instantly MCP] ✅ Server running with reliable pagination');
  }
}

main().catch((error) => {
  console.error('[Instantly MCP] ❌ Fatal error:', error);
  process.exit(1);
});

