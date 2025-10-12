/**
 * Instantly MCP Server - MCP Protocol Handlers
 * 
 * This module contains the MCP protocol request handlers that were previously
 * in the main index.ts file. These handlers implement the MCP protocol for:
 * - Initialize: Server initialization and capability negotiation
 * - ListTools: Returns available tools to MCP clients
 * - CallTool: Routes tool calls to the tool executor
 * 
 * All handlers are extracted exactly as-is from the original implementation
 * to maintain 100% backward compatibility.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  InitializeRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { TOOLS_DEFINITION } from '../tools/index.js';
import { executeToolDirectly } from './tool-executor.js';
import { handleInstantlyError } from '../error-handler.js';

/**
 * Load Instantly.ai icons for MCP protocol
 * 
 * Icons are displayed in MCP clients like Claude Desktop and Claude.ai
 * to provide visual branding for the server.
 */
function loadInstantlyIcons(): Array<{src: string, mimeType: string, sizes: string}> {
  const INSTANTLY_ICONS = [
    {
      src: 'https://cdn.prod.website-files.com/63860c8c65e7bef4a1eeebeb/63f62e4f7dc7e3426e9b7874_cleaned_rounded_favicon.png',
      mimeType: 'image/png',
      sizes: 'any'
    }
  ];
  return INSTANTLY_ICONS;
}

/**
 * Register all MCP protocol handlers on the server
 * 
 * This function is called from the main index.ts to set up the MCP protocol
 * handlers. It registers three core handlers:
 * 1. Initialize - Server initialization and capability negotiation
 * 2. ListTools - Returns available tools to MCP clients
 * 3. CallTool - Routes tool calls to the tool executor
 * 
 * @param server - The MCP server instance
 * @param apiKey - Optional API key for stdio mode (from environment variable)
 */
export function registerMcpHandlers(server: Server, apiKey?: string): void {
  // Initialize handler - provides server info with icon for remote MCP connectors
  server.setRequestHandler(InitializeRequestSchema, async (request) => {
    const clientName = request.params?.clientInfo?.name || 'unknown';
    console.error('[Instantly MCP] 🔧 Initialize request received from:', clientName);

    // Update client detection manager with client info
    try {
      const { globalClientManager } = await import('../client-detection.js');
      globalClientManager.updateClientInfo(
        request.params?.clientInfo,
        undefined // User agent not available in stdio mode
      );
      console.error('[Instantly MCP] 📊 Client detection updated');
    } catch (error) {
      console.error('[Instantly MCP] ⚠️ Client detection unavailable:', error);
    }

    // Ensure icons are loaded synchronously for Claude Desktop compatibility
    const icons = loadInstantlyIcons();
    console.error('[Instantly MCP] 🎨 Icons loaded:', icons.length > 0 ? `✅ ${icons.length} icon(s)` : '❌ Missing');

    // Enhanced initialization response matching HTTP transport
    // Use 2025-03-26 for Claude Desktop/Web compatibility (supports authorization)
    const initResponse = {
      protocolVersion: '2025-03-26',
      capabilities: {
        tools: {
          listChanged: true,
        },
        resources: {
          subscribe: false,
          listChanged: false,
        },
        prompts: {
          listChanged: false,
        },
      },
      serverInfo: {
        name: 'instantly-mcp',
        version: '1.1.0',
        icons: icons,
        description: 'Instantly.ai email automation and campaign management tools',
      },
      instructions: 'Use these tools to manage Instantly.ai email campaigns, accounts, and automation workflows.',
    };

    console.error('[Instantly MCP] ✅ Initialize response prepared');
    return initResponse;
  });

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.error('[Instantly MCP] 📋 Listing available tools...');

    return {
      tools: TOOLS_DEFINITION
    };
  });

  // Call tool handler - now supports per-request API keys
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;

    console.error(`[Instantly MCP] 🔧 Tool called via MCP: ${name}`);
    console.error(`[Instantly MCP] 🔍 Debug - Main handler params:`, JSON.stringify(request.params, null, 2));
    console.error(`[Instantly MCP] 🔍 Debug - Extra parameter:`, JSON.stringify(extra, null, 2));

    // Extract API key from multiple sources
    let extractedApiKey: string | undefined;

    // Method 1: Check if API key is provided in args (from HTTP transport)
    if (args && typeof args === 'object' && 'apiKey' in args) {
      extractedApiKey = (args as any).apiKey;
      // Remove apiKey from args to avoid passing it to tool functions
      delete (args as any).apiKey;
      console.error(`[Instantly MCP] 🔑 API key extracted from args`);
    }

    // Method 2: Check if API key is in extra context (from HTTP transport headers)
    if (!extractedApiKey && extra && typeof extra === 'object') {
      const extraObj = extra as any;
      console.error(`[Instantly MCP] 🔍 Debug - extraObj structure:`, Object.keys(extraObj));

      // Try requestInfo.headers first (SDK standard)
      if (extraObj.requestInfo && extraObj.requestInfo.headers) {
        console.error(`[Instantly MCP] 🔍 Debug - requestInfo.headers keys:`, Object.keys(extraObj.requestInfo.headers));
        if (extraObj.requestInfo.headers['x-instantly-api-key']) {
          extractedApiKey = extraObj.requestInfo.headers['x-instantly-api-key'];
          console.error(`[Instantly MCP] 🔑 API key extracted from requestInfo.headers`);
        }
      }

      // Fallback to direct headers property
      if (!extractedApiKey && extraObj.headers && extraObj.headers['x-instantly-api-key']) {
        extractedApiKey = extraObj.headers['x-instantly-api-key'];
        console.error(`[Instantly MCP] 🔑 API key extracted from direct headers`);
      }
    }

    // Method 3: Fall back to environment variable for stdio transport
    if (!extractedApiKey) {
      extractedApiKey = apiKey;
      console.error(`[Instantly MCP] 🔑 API key from environment variable`);
    }

    try {
      // Use the shared tool execution function
      return await executeToolDirectly(name, args, extractedApiKey);
    } catch (error) {
      console.error(`[Instantly MCP] ❌ Tool execution error:`, error);
      
      if (error instanceof McpError) {
        throw error;
      }
      
      // Handle the error and re-throw as McpError
      try {
        handleInstantlyError(error, name);
      } catch (handledError: any) {
        throw new McpError(ErrorCode.InternalError, handledError.message || String(error));
      }
    }
  });

  console.error('[Instantly MCP] ✅ MCP protocol handlers registered successfully');
}

