/**
 * Streaming HTTP Transport for Instantly MCP Server
 * Implements native StreamableHTTPServerTransport with session management
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import cors from 'cors';
import { createServer, Server as HttpServer } from 'http';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'node:crypto';
import { TOOLS_DEFINITION } from './tools/index.js';
import { executeToolDirectly } from './handlers/tool-executor.js';

// Simple rate limiting interface
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Instantly.ai custom icon (embedded for reliability)
const INSTANTLY_ICON = 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+CjxzdmcgdmVyc2lvbj0iMS4xIiBpZD0iTGF5ZXJfMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeD0iMHB4IiB5PSIwcHgiCgkgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiB2aWV3Qm94PSIwIDAgMjAwIDIwMCIgZW5hYmxlLWJhY2tncm91bmQ9Im5ldyAwIDAgMjAwIDIwMCIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+CjxwYXRoIGZpbGw9IiM0NTgwRjYiIG9wYWNpdHk9IjEuMDAwMDAwIiBzdHJva2U9Im5vbmUiCglkPSIKTTE0Mi4wMDAwMDAsMjAxLjAwMDAwMAoJQzk0LjY2NjY3MiwyMDEuMDAwMDAwIDQ3LjgzMzM0MCwyMDEuMDAwMDAwIDEuMDAwMDA2LDIwMS4wMDAwMDAKCUMxLjAwMDAwNCwxMzQuMzMzMzQ0IDEuMDAwMDA0LDY3LjY2NjY3OSAxLjAwMDAwMiwxLjAwMDAxNQoJQzY3LjY2NjY1NiwxLjAwMDAxMCAxMzQuMzMzMzEzLDEuMDAwMDEwIDIwMC45OTk5NjksMS4wMDAwMDUKCUMyMDAuOTk5OTg1LDY3LjY2NjY0OSAyMDAuOTk5OTg1LDEzNC4zMzMyOTggMjAxLjAwMDAwMCwyMDAuOTk5OTY5CglDMTgxLjUwMDAwMCwyMDEuMDAwMDAwIDE2Mi4wMDAwMDAsMjAxLjAwMDAwMCAxNDIuMDAwMDAwLDIwMS4wMDAwMDAKTTkwLjk2ODg4MCw1My44Mjk1NjMKCUM4MS4xODc2NDUsNzAuOTg1NjQ5IDcxLjQwNjQwMyw4OC4xNDE3MzEgNjAuODg4MTg0LDEwNi41OTA0NjkKCUM2OC4zMDEzNTMsMTA2LjU5MDQ2OSA3NC40NDc5MzcsMTA2LjU5MDQ2OSA4Mi4xMzk0MjcsMTA2LjU5MDQ2OQoJQzc4Ljc3NTcyNiwxMjAuODczMzYwIDc1LjY5ODk4MiwxMzMuOTM3Nzc1IDcyLjYyMjIzMSwxNDcuMDAyMTgyCglDNzMuMDUxNDMwLDE0Ny4yNDA5NTIgNzMuNDgwNjI5LDE0Ny40Nzk3MjEgNzMuOTA5ODIxLDE0Ny43MTg0OTEKCUM5NS44ODQ4ODgsMTI2LjUzMzY1MyAxMTcuODU5OTU1LDEwNS4zNDg4MjQgMTM5LjgzNTAyMiw4NC4xNjM5OTQKCUMxMzkuNTc0ODkwLDgzLjY4NTc4MyAxMzkuMzE0NzU4LDgzLjIwNzU2NSAxMzkuMDU0NjI2LDgyLjcyOTM1NQoJQzEzMS4zNDk5MzAsODIuNzI5MzU1IDEyMy42NDUyMjYsODIuNzI5MzU1IDExNC41Njg3NDEsODIuNzI5MzU1CglDMTIwLjQ2OTg0MSw3NC45OTY2NjYgMTI1LjYzMjA4MCw2OC4zNjA3NzEgMTMwLjY0MDUzMyw2MS42MTA3NzEKCUMxMzIuODg0ODg4LDU4LjU4NjAwNiAxMzQuODIxMTgyLDU1LjMzMjY1NyAxMzYuMzU4ODU2LDUxLjY4Mjk0NQoJQzEzNS40MDc3NjEsNTEuNDM0NzY1IDEzNC40NTcyNjAsNTAuOTczMjEzIDEzMy41MDU0OTMsNTAuOTcwNjE5CglDMTIwLjU0MDEwOCw1MC45MzUzMjIgMTA3LjU3Mzg0NSw1MC45MDc2ODQgOTQuNjEwMjE0LDUxLjA3MDY2MwoJQzkzLjQzNDk1Miw1MS4wODU0NDIgOTIuMjc2MzkwLDUyLjQyNzQ2NCA5MC45Njg4ODAsNTMuODI5NTYzCnoiLz4KPHBhdGggZmlsbD0iI0ZCRkRGRSIgb3BhY2l0eT0iMS4wMDAwMDAiIHN0cm9rZT0ibm9uZSIKCWQ9IgpNMTM2Ljg5NzI2Myw1Mi4xODMwNDQKCUMxMzQuODIxMTgyLDU1LjMzMjY1NyAxMzIuODg0ODg4LDU4LjU4NjAwNiAxMzAuNjQwNTMzLDYxLjYxMDc3MQoJQzEyNS42MzIwODAsNjguMzYwNzcxIDEyMC40Njk4NDEsNzQuOTk2NjY2IDExNC41Njg3NDEsODIuNzI5MzU1CglDMTIzLjY0NTIyNiw4Mi43MjkzNTUgMTMxLjM0OTkzMCw4Mi43MjkzNTUgMTM5LjA1NDYyNiw4Mi43MjkzNTUKCUMxMzkuMzE0NzU4LDgzLjIwNzU2NSAxMzkuNTc0ODkwLDgzLjY4NTc4MyAxMzkuODM1MDIyLDg0LjE2Mzk5NAoJQzExNy44NTk5NTUsMTA1LjM0ODgyNCA5NS44ODQ4ODgsMTI2LjUzMzY1MyA3My45MDk4MjEsMTQ3LjcxODQ5MQoJQzczLjQ4MDYyOSwxNDcuNDc5NzIxIDczLjA1MTQzMCwxNDcuMjQwOTUyIDcyLjYyMjIzMSwxNDcuMDAyMTgyCglDNzUuNjk4OTgyLDEzMy45Mzc3NzUgNzguNzc1NzI2LDEyMC44NzMzNjAgODIuMTM5NDI3LDEwNi41OTA0NjkKCUM3NC40NDc5MzcsMTA2LjU5MDQ2OSA2OC4zMDEzNTMsMTA2LjU5MDQ2OSA2MC44ODgxODQsMTA2LjU5MDQ2OQoJQzcxLjQwNjQwMyw4OC4xNDE3MzEgODEuMTg3NjQ1LDcwLjk4NTY0OSA5MS4zNzk5NjcsNTMuMjUwMTE4CglDOTIuNTY5NDI3LDUyLjQ2OTc3NiA5My4zNDc4MzksNTIuMDkzODAwIDk0LjEyNjE2Nyw1Mi4wOTM5NTYKCUMxMDguMzgzMjAyLDUyLjA5Njc3OSAxMjIuNjQwMjM2LDUyLjE0NDY4OCAxMzYuODk3MjYzLDUyLjE4MzA0NAp6Ii8+CjxwYXRoIGZpbGw9IiM1ODdEQ0MiIG9wYWNpdHk9IjEuMDAwMDAwIiBzdHJva2U9Im5vbmUiCglkPSIKTTEzNi42MjgwNTIsNTEuOTMyOTkxCglDMTIyLjY0MDIzNiw1Mi4xNDQ2ODggMTA4LjM4MzIwMiw1Mi4wOTY3NzkgOTQuMTI2MTY3LDUyLjA5Mzk1NgoJQzkzLjM0NzgzOSw1Mi4wOTM4MDAgOTIuNTY5NDI3LDUyLjQ2OTc3NiA5MS40NTA1NjIsNTIuOTExOTAzCglDOTIuMjc2MzkwLDUyLjQyNzQ2NCA5My40MzQ5NTIsNTEuMDg1NDQyIDk0LjYxMDIxNCw1MS4wNzA2NjMKCUMxMDcuNTczODQ1LDUwLjkwNzY4NCAxMjAuNTQwMTA4LDUwLjkzNTMyMiAxMzMuNTA1NDkzLDUwLjk3MDYxOQoJQzEzNC40NTcyNjAsNTAuOTczMjEzIDEzNS40MDc3NjEsNTEuNDM0NzY1IDEzNi42MjgwNTIsNTEuOTMyOTkxCnoiLz4KPC9zdmc+Cg==';

// Load the Instantly.ai icon
function loadInstantlyIcon(): string {
  return INSTANTLY_ICON;
}

export interface StreamingHttpConfig {
  port: number;
  host: string;
  cors: {
    origin: string | string[] | boolean;
    credentials?: boolean;
  };
  auth?: {
    apiKeyHeader: string;
    requiredApiKey?: string;
  };
}

export class StreamingHttpTransport {
  private server: Server;
  private config: StreamingHttpConfig;
  private app: express.Application;
  private httpServer?: HttpServer;
  private activeSessions = new Map<string, any>();
  private transports = new Map<string, StreamableHTTPServerTransport>(); // Store transports by session ID
  private sseTransports = new Map<string, SSEServerTransport>(); // Store SSE transports by session ID
  private sseSessionMetadata = new Map<string, { apiKey?: string }>(); // Store API key and other metadata per SSE session
  private requestHandlers?: {
    toolsList: (id: any) => Promise<any>;
    toolCall: (params: any, id: any) => Promise<any>;
  };
  private rateLimitMap = new Map<string, RateLimitEntry>();
  private readonly RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
  private readonly RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute per IP

  constructor(server: Server, config: StreamingHttpConfig) {
    this.server = server;
    this.config = config;
    this.app = express();
    this.setupMiddleware();
    // NOTE: We create transport instances per-request in stateful mode
    // This allows multiple concurrent sessions with different session IDs
    this.setupRoutes();
  }

  /**
   * Handle MCP request with OPTIONAL session-based transport management
   * Falls back to stateless mode if sessions aren't supported/available
   */
  private async handleMcpRequest(req: express.Request, res: express.Response): Promise<void> {
    try {
      // Check for existing session ID from request header
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      const isInitRequest = req.body?.method === 'initialize';
      let transport: StreamableHTTPServerTransport;
      let effectiveSessionId: string | undefined;

      if (sessionId && this.transports.has(sessionId)) {
        // Subsequent request with valid session: reuse existing transport
        transport = this.transports.get(sessionId)!;
        effectiveSessionId = sessionId;
        console.error(`[HTTP] 🔄 Reusing existing session: ${sessionId}`);

        // Return session ID in response header
        res.setHeader('Mcp-Session-Id', sessionId);
      } else if (sessionId && !this.transports.has(sessionId)) {
        // Session ID provided but not found - fall back to stateless mode
        console.error(`[HTTP] ⚠️  Session not found: ${sessionId} - falling back to stateless mode`);

        // Create new stateless transport for this request
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined, // Stateless mode
          enableDnsRebindingProtection: false,
          enableJsonResponse: true,
        });

        await this.server.connect(transport);
      } else {
        // No session ID - use stateless mode (backward compatible)
        console.error(`[HTTP] 🔓 Stateless request (no session ID)`);

        // Create new stateless transport for this request
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined, // Stateless mode
          enableDnsRebindingProtection: false,
          enableJsonResponse: true,
        });

        await this.server.connect(transport);
      }

      // Handle the request with the transport
      await transport.handleRequest(req, res, req.body);
      console.error(`[HTTP] ✅ Request handled successfully${effectiveSessionId ? ` for session: ${effectiveSessionId}` : ' (stateless)'}`);
    } catch (error) {
      console.error('[HTTP] ❌ MCP request error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
            data: (error as Error).message
          },
          id: req.body?.id || null,
        });
      }
    }
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Claude Desktop compatibility: Inject Accept header if missing or incomplete
    // The MCP SDK requires BOTH 'application/json' AND 'text/event-stream' in the Accept header
    // Claude Desktop/Web may send only 'application/json', while iOS sends '*/*' or no header
    // This middleware ensures all clients get the required header combination
    // IMPORTANT: Only inject for POST requests to /mcp, not GET requests (which are for discovery)
    this.app.use((req, res, next) => {
      // Only inject Accept header for POST requests to MCP endpoints
      if (req.method === 'POST' && req.path.startsWith('/mcp')) {
        const accept = req.headers.accept || '';
        const hasJson = accept.includes('application/json');
        const hasEventStream = accept.includes('text/event-stream');

        if (!hasJson || !hasEventStream) {
          req.headers.accept = 'application/json, text/event-stream';
          console.error('[HTTP] 🔧 Injected Accept header for MCP compatibility (was: %s)', accept || 'missing');
        }
      }
      next();
    });

    // Security: Origin header validation (TEMPORARILY DISABLED FOR DEBUGGING)
    // TODO: Re-enable after we capture what origin Claude Web actually sends
    this.app.use((req, res, next) => {
      const origin = req.headers.origin;
      console.error(`[HTTP] � DEBUG - Origin header received: ${origin || 'NO ORIGIN'}`);
      next();
    });

    // Enhanced headers for Claude Desktop remote connector compatibility
    this.app.use((req, res, next) => {
      res.set({
        'Connection': 'keep-alive',
        'Keep-Alive': 'timeout=120, max=100', // Increased from 30s to 120s for large campaigns
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Server': 'instantly-mcp/1.1.0'
      });
      next();
    });

    // CORS configuration for instantly.ai domain
    this.app.use(cors({
      origin: this.config.cors.origin,
      credentials: this.config.cors.credentials || true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-api-key',
        'x-instantly-api-key',
        'mcp-session-id',
        'mcp-protocol-version',
        'User-Agent',
        'X-Requested-With'
      ]
    }));

    // JSON parsing with larger limit for complex requests
    this.app.use(express.json({ limit: '10mb' }));

    // Rate limiting middleware
    this.app.use((req, res, next) => {
      if (process.env.NODE_ENV === 'production') {
        const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
        const now = Date.now();
        const rateLimitEntry = this.rateLimitMap.get(clientIp);

        if (rateLimitEntry) {
          if (now < rateLimitEntry.resetTime) {
            if (rateLimitEntry.count >= this.RATE_LIMIT_MAX_REQUESTS) {
              res.status(429).json({
                jsonrpc: '2.0',
                id: req.body?.id || null,
                error: {
                  code: -32000,
                  message: 'Rate limit exceeded',
                  data: {
                    limit: this.RATE_LIMIT_MAX_REQUESTS,
                    window: this.RATE_LIMIT_WINDOW / 1000,
                    resetTime: new Date(rateLimitEntry.resetTime).toISOString()
                  }
                }
              });
              return;
            }
            rateLimitEntry.count++;
          } else {
            // Reset the rate limit window
            this.rateLimitMap.set(clientIp, { count: 1, resetTime: now + this.RATE_LIMIT_WINDOW });
          }
        } else {
          // First request from this IP
          this.rateLimitMap.set(clientIp, { count: 1, resetTime: now + this.RATE_LIMIT_WINDOW });
        }
      }
      next();
    });

    // Enhanced request logging with user agent and auth method detection
    this.app.use((req, res, next) => {
      const timestamp = new Date().toISOString();
      const userAgent = req.headers['user-agent'] || 'unknown';
      const hasAuth = !!(req.headers.authorization || req.headers['x-instantly-api-key'] || req.params?.apiKey);
      const authMethod = req.params?.apiKey ? 'URL' : (req.headers.authorization ? 'Bearer' : (req.headers['x-instantly-api-key'] ? 'Header' : 'None'));

      console.error(`[HTTP] ${timestamp} ${req.method} ${req.path} - ${req.ip} - Auth: ${authMethod} - UA: ${userAgent.substring(0, 50)}`);

      // DETAILED LOGGING FOR CLAUDE DESKTOP DEBUGGING
      console.error(`[HTTP] 🔍 FULL REQUEST:`);
      console.error(`[HTTP]    Origin: ${req.headers.origin || 'NONE'}`);
      console.error(`[HTTP]    Referer: ${req.headers.referer || 'NONE'}`);
      console.error(`[HTTP]    Accept: ${req.headers.accept || 'NONE'}`);
      console.error(`[HTTP]    Content-Type: ${req.headers['content-type'] || 'NONE'}`);
      console.error(`[HTTP]    All Headers: ${JSON.stringify(req.headers)}`);

      // Update client detection with user agent for HTTP requests
      if (req.method === 'POST' && (req.path === '/mcp' || req.path.startsWith('/mcp/'))) {
        import('./client-detection.js').then(({ globalClientManager }) => {
          globalClientManager.updateClientInfo(undefined, userAgent);
        }).catch(err => {
          console.error('[HTTP] Client detection update failed:', err);
        });
      }

      next();
    });

    // MCP Protocol Version header (required by spec)
    // Use 2025-03-26 for Claude Desktop/Web compatibility
    this.app.use((req, res, next) => {
      res.setHeader('mcp-protocol-version', '2025-03-26');
      next();
    });
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Fast ping endpoint for Claude Desktop connection testing
    this.app.get('/ping', (req, res) => {
      res.json({
        pong: true,
        timestamp: Date.now(),
        server: 'instantly-mcp'
      });
    });

    // Claude Desktop connection test endpoint
    this.app.options('*', (req, res) => {
      res.status(200).end();
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'instantly-mcp',
        version: '1.1.0',
        transport: 'dual-protocol',
        protocols: {
          streamable_http: '2025-03-26',
          sse: '2024-11-05'
        },
        timestamp: new Date().toISOString(),
        activeSessions: this.activeSessions.size,
        sseSessions: this.sseTransports.size,
        endpoints: {
          mcp: '/mcp (GET for SSE, POST for Streamable HTTP)',
          'mcp-with-key': '/mcp/:apiKey',
          messages: '/messages (POST for SSE transport)',
          health: '/health',
          info: '/info',
          ping: '/ping'
        }
      });
    });

    // Server info endpoint
    this.app.get('/info', (req, res) => {
      res.json({
        name: 'Instantly MCP Server',
        version: '1.1.0',
        description: 'Official Instantly.ai MCP server with 34 email automation tools',
        transport: 'streaming-http',
        endpoint: 'https://mcp.instantly.ai/mcp',
        protocol: '2025-03-26',
        tools: 34,
        capabilities: {
          tools: true,
          resources: false,
          prompts: false,
          logging: false
        },
        features: [
          'Email campaign management',
          'Lead management',
          'Account management',
          'Analytics and reporting',
          'Email verification',
          'Subsequence management'
        ],
        authentication: {
          methods: [
            {
              type: 'header-based',
              description: 'API key in request headers (more secure)',
              endpoint: '/mcp',
              formats: [
                'Authorization: Bearer [INSTANTLY_API_KEY]',
                'x-instantly-api-key: [INSTANTLY_API_KEY]',
                'x-api-key: [INSTANTLY_API_KEY] (legacy)'
              ]
            },
            {
              type: 'url-based',
              description: 'API key as path parameter',
              endpoint: '/mcp/{API_KEY}',
              example: '/mcp/your-instantly-api-key-here'
            }
          ]
        },
        documentation: 'https://github.com/Instantly-ai/instantly-mcp'
      });
    });

    // DELETE /mcp - Session cleanup endpoint
    // MUST be registered BEFORE .all('/mcp') to avoid being caught by it
    this.app.delete('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      console.error('[HTTP] 🗑️  DELETE request received');
      console.error('[HTTP] Session ID from header:', sessionId);

      if (!sessionId) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: Session ID required',
            data: {
              hint: 'Include Mcp-Session-Id header with the session ID to delete'
            }
          },
          id: null,
        });
        return;
      }

      if (this.transports.has(sessionId)) {
        // Clean up the session
        this.transports.delete(sessionId);
        console.error(`[HTTP] ✅ Session deleted: ${sessionId}`);
        res.status(204).end();
      } else {
        console.error(`[HTTP] ❌ Session not found: ${sessionId}`);
        res.status(404).json({
          jsonrpc: '2.0',
          error: {
            code: -32001,
            message: 'Session not found',
            data: {
              sessionId,
              hint: 'Session may have already been cleaned up'
            }
          },
          id: null,
        });
      }
    });

    // Main MCP endpoint with header-based authentication
    // ALSO accepts API key in custom header for Claude Desktop compatibility
    this.app.all('/mcp', async (req, res) => {
      // VERBOSE LOGGING FOR CLAUDE DESKTOP/WEB DEBUGGING
      console.error('[HTTP] ========== INCOMING MCP REQUEST (HEADER AUTH) ==========');
      console.error('[HTTP] 🔍 FULL REQUEST HEADERS:', JSON.stringify(req.headers, null, 2));
      console.error('[HTTP] 🔍 REQUEST BODY:', JSON.stringify(req.body, null, 2));
      console.error('[HTTP] 🔍 REQUEST METHOD:', req.body?.method || 'unknown');
      console.error('[HTTP] =======================================');

      // Try to extract API key from headers FIRST (for Claude Desktop compatibility)
      let apiKey = req.headers.authorization?.replace('Bearer ', '') ||
                   req.headers['x-instantly-api-key'] as string ||
                   req.headers['x-api-key'] as string;

      if (apiKey) {
        // API key provided in header - store it and proceed WITHOUT auth middleware
        console.error('[HTTP] 🔑 API key found in headers, bypassing auth middleware');
        req.headers['x-instantly-api-key'] = apiKey;
        (req as any).instantlyApiKey = apiKey;
      } else {
        // No API key in headers - this might be an initialize request
        // Allow it through for protocol negotiation
        console.error('[HTTP] ⚠️  No API key in headers - allowing for initialize');
      }

      // Handle session-based transport management (stateful mode)
      await this.handleMcpRequest(req, res);
    });

    // URL-based authentication endpoint: /mcp/{API_KEY}
    this.app.all('/mcp/:apiKey', async (req, res) => {
      // Extract API key from URL path
      let apiKey = req.params.apiKey;

      if (!apiKey || apiKey.length < 10) {
        res.status(401).json({
          jsonrpc: '2.0',
          id: req.body?.id || null,
          error: {
            code: -32001,
            message: 'Invalid API key in URL path',
            data: {
              reason: 'API key too short or missing',
              format: '/mcp/{INSTANTLY_API_KEY}',
              example: '/mcp/your-instantly-api-key-here',
              note: 'Provide your Instantly.ai API key as the path parameter'
            }
          }
        });
        return;
      }

      // VERBOSE LOGGING FOR CLAUDE DESKTOP/WEB DEBUGGING
      console.error('[HTTP] ========== INCOMING MCP REQUEST (URL AUTH) ==========');
      console.error('[HTTP] 🔑 API Key from URL:', apiKey.substring(0, 20) + '...');
      console.error('[HTTP] 🔍 FULL REQUEST HEADERS:', JSON.stringify(req.headers, null, 2));
      console.error('[HTTP] 🔍 REQUEST BODY:', JSON.stringify(req.body, null, 2));
      console.error('[HTTP] 🔍 REQUEST METHOD:', req.body?.method || 'unknown');
      console.error('[HTTP] =======================================');

      // Store the API key in request headers for SDK to pass through via extra.requestInfo.headers
      req.headers['x-instantly-api-key'] = apiKey;
      // Also store in request object as backup
      (req as any).instantlyApiKey = apiKey;

      // Handle session-based transport management (stateful mode)
      await this.handleMcpRequest(req, res);
    });

    // OAuth 2.1 Authorization Server Metadata (RFC 8414)
    // Claude Desktop/Web checks this endpoint to discover auth capabilities
    // Return 404 to indicate no OAuth is supported - API key only
    this.app.get('/.well-known/oauth-authorization-server', (req, res) => {
      console.error('[HTTP] 🔍 OAuth discovery: /.well-known/oauth-authorization-server - returning 404 (API key auth only)');

      // Return 404 to clearly indicate OAuth is not supported
      // This tells Claude Desktop/Web to skip OAuth and allow direct connection
      res.status(404).json({
        error: 'OAuth not supported',
        message: 'This server uses API key authentication only. No OAuth flow required.',
        authentication: {
          type: 'api_key',
          methods: ['url_path', 'header'],
          url_format: '/mcp/{API_KEY}',
          header_format: 'Authorization: Bearer {API_KEY} or x-instantly-api-key: {API_KEY}'
        },
        documentation: 'https://github.com/Instantly-ai/instantly-mcp'
      });
    });

    // OAuth 2.0 Protected Resource Metadata (RFC 8414)
    // Return 404 to indicate no OAuth is supported
    this.app.get('/.well-known/oauth-protected-resource', (req, res) => {
      console.error('[HTTP] 🔍 OAuth discovery: /.well-known/oauth-protected-resource - returning 404 (API key auth only)');

      res.status(404).json({
        error: 'OAuth not supported',
        message: 'This server uses API key authentication only. No OAuth flow required.',
        authentication: {
          type: 'api_key',
          methods: ['url_path', 'header']
        },
        documentation: 'https://github.com/Instantly-ai/instantly-mcp'
      });
    });

    // OAuth 2.0 Protected Resource Metadata with path parameter
    this.app.get('/.well-known/oauth-protected-resource/mcp/:apiKey', (req, res) => {
      console.error('[HTTP] 🔍 OAuth discovery with API key in path');

      res.json({
        resource: 'https://mcp.instantly.ai',
        authorization_servers: ['https://mcp.instantly.ai'],
        bearer_methods_supported: ['header', 'url_path'],
        resource_documentation: 'https://github.com/Instantly-ai/instantly-mcp',
        api_key_provided: true,
        ready: true
      });
    });

    // OAuth 2.1 Authorization Server Metadata with path parameter
    this.app.get('/.well-known/oauth-authorization-server/mcp/:apiKey', (req, res) => {
      console.error('[HTTP] 🔍 OAuth authorization server discovery with API key in path');

      res.json({
        issuer: 'https://mcp.instantly.ai',
        service_documentation: 'https://github.com/Instantly-ai/instantly-mcp',
        api_key_provided: true,
        ready: true,
        // Indicate no OAuth flow needed - API key already provided
        authorization_required: false
      });
    });

    // OAuth Dynamic Client Registration (RFC 7591)
    // Return 404 to indicate OAuth registration is not supported
    this.app.post('/register', (req, res) => {
      console.error('[HTTP] 🔍 OAuth client registration attempted - returning 404 (not supported)');

      // Return 404 to clearly indicate OAuth registration is not supported
      res.status(404).json({
        error: 'OAuth registration not supported',
        message: 'This server uses API key authentication only. No client registration required.',
        authentication: {
          type: 'api_key',
          description: 'Provide your Instantly.ai API key via URL path or headers',
          methods: ['url_path', 'header']
        }
      });
    });

    // Minimal /authorize endpoint for MCP clients that expect OAuth-style discovery
    this.app.get('/authorize', (req, res) => {
      console.error('[HTTP] 🔐 /authorize endpoint accessed - MCP client discovery');

      // Return MCP server capabilities instead of OAuth flow
      res.json({
        server: 'instantly-mcp',
        version: '1.1.0',
        protocol: 'mcp',
        transport: 'streamable-http',
        auth: {
          type: 'api_key',
          methods: ['url_path', 'header'],
          description: 'Provide API key via URL path or x-instantly-api-key header'
        },
        endpoints: {
          mcp: '/mcp',
          mcp_with_key: '/mcp/{API_KEY}',
          health: '/health',
          info: '/info'
        },
        capabilities: ['tools'],
        ready: true
      });
    });

    // GET endpoint for MCP clients (supports SSE for Claude.ai proxy)
    this.app.get('/mcp/:apiKey?', async (req, res) => {
      const apiKey = req.params.apiKey;
      const acceptHeader = req.headers.accept || '';
      const protocolVersion = req.headers['mcp-protocol-version'] as string;

      console.error(`[HTTP] 🔍 GET /mcp request - API Key: ${apiKey ? '✅ Present' : '❌ Missing'}`);
      console.error(`[HTTP] 📋 Accept: ${acceptHeader}`);
      console.error(`[HTTP] 🔖 Protocol Version: ${protocolVersion || 'Not provided'}`);

      // Validate MCP-Protocol-Version header (backward compatible)
      // Per MCP spec: if no header provided, assume 2025-03-26 for backward compatibility
      if (protocolVersion && !['2025-06-18', '2025-03-26', '2024-11-05'].includes(protocolVersion)) {
        console.error(`[HTTP] ❌ Unsupported protocol version: ${protocolVersion}`);
        return res.status(400).json({
          error: 'Bad Request',
          message: `Unsupported MCP protocol version: ${protocolVersion}. Supported: 2025-06-18, 2025-03-26 (recommended), 2024-11-05`
        });
      }

      if (acceptHeader.includes('text/event-stream')) {
        // Client wants SSE stream - support for Claude.ai proxy
        console.error('[HTTP] 📡 SSE connection requested - starting SSE transport');
        console.error(`[HTTP] 📡 API Key: ${apiKey ? '✅ Present' : '❌ Missing'}`);

        try {
          const transport = new SSEServerTransport('/messages', res);
          this.sseTransports.set(transport.sessionId, transport);

          // CRITICAL FIX: Store API key with SSE session so tool calls can access it
          this.sseSessionMetadata.set(transport.sessionId, { apiKey });
          console.error(`[HTTP] 📡 SSE session metadata stored - API Key: ${apiKey ? '✅ Present' : '❌ Missing'}`);

          console.error(`[HTTP] 📡 SSE transport created with session ID: ${transport.sessionId}`);
          console.error(`[HTTP] 📡 Active SSE sessions: ${this.sseTransports.size}`);

          res.on('close', () => {
            console.error(`[HTTP] 📡 SSE connection closed for session ${transport.sessionId}`);
            this.sseTransports.delete(transport.sessionId);
            this.sseSessionMetadata.delete(transport.sessionId); // Clean up metadata
            console.error(`[HTTP] 📡 Remaining SSE sessions: ${this.sseTransports.size}`);
          });

          await this.server.connect(transport);
          console.error(`[HTTP] ✅ SSE transport connected successfully - session ID: ${transport.sessionId}`);
        } catch (error) {
          console.error('[HTTP] ❌ Failed to establish SSE connection:', error);
          console.error('[HTTP] ❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');

          if (!res.headersSent) {
            res.status(500).json({
              error: 'Internal Server Error',
              message: `Failed to establish SSE connection: ${error instanceof Error ? error.message : String(error)}`
            });
          }
        }
        return;
      }

      // Return server info for GET requests
      res.json({
        server: 'instantly-mcp',
        version: '1.1.0',
        transport: 'streamable-http',
        protocol: '2025-03-26',
        endpoints: {
          'mcp_post': apiKey ? `/mcp/${apiKey}` : '/mcp',
          'messages_post': '/messages',
          'health': '/health',
          'info': '/info'
        },
        auth: {
          required: true,
          methods: ['path_parameter', 'header']
        }
      });
    });

    // POST /messages endpoint for SSE transport (Claude.ai proxy compatibility)
    // ENHANCED: Handle requests even without SSE session (SSE handshake sometimes fails)
    this.app.post('/messages', async (req, res) => {
      const sessionId = req.query.sessionId as string;
      const apiKeyFromQuery = req.query.apiKey as string;

      console.error(`[HTTP] 📨 POST /messages request - Session ID: ${sessionId || 'Missing'}`);
      console.error(`[HTTP] 📨 Request body:`, JSON.stringify(req.body, null, 2));

      // Try to get API key from multiple sources
      let apiKey: string | undefined;

      // Source 1: Query parameter (explicit)
      if (apiKeyFromQuery) {
        apiKey = apiKeyFromQuery;
        console.error(`[HTTP] 🔑 API key from query parameter`);
      }

      // Source 2: Session metadata (if SSE session exists)
      if (!apiKey && sessionId) {
        const sessionMetadata = this.sseSessionMetadata.get(sessionId);
        if (sessionMetadata?.apiKey) {
          apiKey = sessionMetadata.apiKey;
          console.error(`[HTTP] 🔑 API key from SSE session metadata`);
        }
      }

      // Source 3: Extract from sessionId if it looks like an API key
      if (!apiKey && sessionId && sessionId.length > 20) {
        // SessionId might actually be the API key (Claude.ai sometimes does this)
        // Accept any sessionId that's long enough (could be sk_xxx or base64 encoded)
        apiKey = sessionId;
        console.error(`[HTTP] 🔑 Using sessionId as API key (fallback)`);
      }

      if (!apiKey) {
        console.error(`[HTTP] ❌ No API key found in any source`);
        return res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: API key required (provide via sessionId or apiKey query parameter)'
          },
          id: req.body?.id || null
        });
      }

      // Inject API key into request headers for tool handlers
      if (!req.headers) {
        req.headers = {};
      }
      req.headers['x-instantly-api-key'] = apiKey;
      console.error(`[HTTP] 🔑 Injected API key into request headers`);

      // Try to use SSE transport if available, otherwise handle directly
      const transport = this.sseTransports.get(sessionId);

      if (transport) {
        console.error(`[HTTP] 📡 Using SSE transport for session ${sessionId}`);
        try {
          await transport.handlePostMessage(req, res, req.body);
          console.error(`[HTTP] ✅ Message handled via SSE transport`);
          return;
        } catch (error) {
          console.error(`[HTTP] ❌ SSE transport failed, falling back to direct handling:`, error);
        }
      }

      // FALLBACK: Handle the request directly without SSE transport
      // This allows tools to work even if SSE handshake failed
      console.error(`[HTTP] 🔄 No SSE transport available - handling request directly`);

      try {
        const { method, params, id } = req.body;

        if (method === 'tools/call') {
          const { name, arguments: args } = params;
          console.error(`[HTTP] 🔧 Executing tool directly: ${name}`);

          // Use the static import from top of file (no dynamic import!)
          const result = await executeToolDirectly(name, args, apiKey);

          return res.status(200).json({
            jsonrpc: '2.0',
            result,
            id
          });
        } else if (method === 'tools/list') {
          // Return the tools list using static import
          console.error(`[HTTP] 📋 Returning tools list directly`);
          return res.status(200).json({
            jsonrpc: '2.0',
            result: { tools: TOOLS_DEFINITION },
            id
          });
        } else {
          return res.status(200).json({
            jsonrpc: '2.0',
            error: {
              code: -32601,
              message: `Method not found: ${method}`
            },
            id
          });
        }
      } catch (error) {
        console.error(`[HTTP] ❌ Error handling request directly:`, error);
        return res.status(200).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: `Internal error: ${error instanceof Error ? error.message : String(error)}`
          },
          id: req.body?.id || null
        });
      }
    });

    // Server-Sent Events endpoint for streaming MCP clients
    this.app.get('/sse', (req, res) => {
      console.error('[HTTP] 📡 SSE connection request from MCP client');
      
      // Setup SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
        'X-Accel-Buffering': 'no' // Disable Nginx buffering
      });

      // Send initial connection message
      res.write('data: {"type":"connection","status":"connected"}\n\n');

      // Keep connection alive with periodic heartbeat
      const keepAlive = setInterval(() => {
        res.write(': heartbeat\n\n');
      }, 30000);

      // Handle client disconnect
      req.on('close', () => {
        console.error('[HTTP] 📡 SSE connection closed by client');
        clearInterval(keepAlive);
      });

      req.on('error', (error) => {
        console.error('[HTTP] ❌ SSE connection error:', error);
        clearInterval(keepAlive);
      });
    });

    // SSE endpoint with API key in URL for authenticated streaming
    this.app.get('/sse/:apiKey', (req, res) => {
      const apiKey = req.params.apiKey;
      console.error(`[HTTP] 📡 Authenticated SSE connection request (API key: ${apiKey.substring(0, 8)}...)`);
      
      // Setup SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
        'X-Accel-Buffering': 'no'
      });

      // Send initial connection message with API key confirmation
      res.write(`data: {"type":"connection","status":"connected","authenticated":true}\n\n`);

      // Keep connection alive
      const keepAlive = setInterval(() => {
        res.write(': heartbeat\n\n');
      }, 30000);

      // Handle client disconnect
      req.on('close', () => {
        console.error('[HTTP] 📡 Authenticated SSE connection closed');
        clearInterval(keepAlive);
      });

      req.on('error', (error) => {
        console.error('[HTTP] ❌ Authenticated SSE connection error:', error);
        clearInterval(keepAlive);
      });
    });

    // CORS preflight
    this.app.options('*', (req, res) => {
      res.sendStatus(200);
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Endpoint ${req.path} not found`,
        availableEndpoints: ['/mcp', '/mcp/{API_KEY}', '/authorize', '/health', '/info'],
        transport: 'streamable-http',
        protocol: '2025-03-26'
      });
    });
  }

  /**
   * Authentication middleware - Extracts per-request API keys for passthrough
   */
  private authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction): void {
    // Extract Instantly API key from request headers
    let instantlyApiKey = '';

    // Try multiple header formats
    const authHeader = req.headers.authorization as string;
    if (authHeader) {
      if (authHeader.startsWith('Bearer ')) {
        instantlyApiKey = authHeader.substring(7);
      } else {
        instantlyApiKey = authHeader;
      }
    }

    // Fallback to x-instantly-api-key header
    if (!instantlyApiKey) {
      instantlyApiKey = req.headers['x-instantly-api-key'] as string;
    }

    // Fallback to query parameter
    if (!instantlyApiKey) {
      instantlyApiKey = req.query.instantly_api_key as string;
    }

    // For backward compatibility, check old x-api-key header
    if (!instantlyApiKey) {
      instantlyApiKey = req.headers['x-api-key'] as string;
    }

    if (!instantlyApiKey) {
      res.status(401).json({
        jsonrpc: '2.0',
        id: req.body?.id || null,
        error: {
          code: -32001,
          message: 'Instantly API key required',
          data: {
            reason: 'Missing API key',
            supportedFormats: [
              'Authorization: Bearer [INSTANTLY_API_KEY]',
              'x-instantly-api-key: [INSTANTLY_API_KEY]',
              'x-api-key: [INSTANTLY_API_KEY] (legacy)',
              '?instantly_api_key=[INSTANTLY_API_KEY]'
            ],
            note: 'Provide your Instantly.ai API key, not a server authentication key'
          }
        }
      });
      return;
    }

    // Use API key as-is from headers (Instantly.ai expects base64-encoded format)
    console.error(`[HTTP] 🔑 Using API key from headers as-is`);

    // Store the API key in request headers for SDK to pass through via extra.requestInfo.headers
    req.headers['x-instantly-api-key'] = instantlyApiKey;
    // Also store in request object as backup
    (req as any).instantlyApiKey = instantlyApiKey;
    next();
  }

  // Deprecated placeholder handlers are no longer needed because we delegate
  // to the official transport. setRequestHandlers is retained for backward
  // compatibility but not used by the transport.

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer = createServer(this.app);

      // Enhanced timeout and connection handling for Claude Desktop and Claude.ai
      // INCREASED: Timeout from 30s to 120s to accommodate large campaigns with many sender emails
      this.httpServer.timeout = 120000; // 120 second timeout (was 60s)
      this.httpServer.keepAliveTimeout = 125000; // 125 second keep-alive
      this.httpServer.headersTimeout = 126000; // 126 second headers timeout

      // NOTE: In stateful mode, we don't pre-connect the server to a transport
      // Instead, we create transport instances per-session in handleMcpRequest()
      // This allows multiple concurrent sessions with different session IDs

      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      this.httpServer!.listen(this.config.port, this.config.host, () => {
        console.error(`[Instantly MCP] 🌐 Streaming HTTP server running at http://${this.config.host}:${this.config.port}`);
        console.error(`[Instantly MCP] 📋 Health check: http://${this.config.host}:${this.config.port}/health`);
        console.error(`[Instantly MCP] 🔗 Ping endpoint: http://${this.config.host}:${this.config.port}/ping`);
        console.error(`[Instantly MCP] 🔗 MCP endpoint: http://${this.config.host}:${this.config.port}/mcp`);

        if (process.env.NODE_ENV === 'production') {
          console.error(`[Instantly MCP] 🏢 Production endpoints:`);
          console.error(`[Instantly MCP] 🔐 Header auth: https://mcp.instantly.ai/mcp`);
          console.error(`[Instantly MCP] 🔗 URL auth: https://mcp.instantly.ai/mcp/{API_KEY}`);
        }
        resolve();
      });

      this.httpServer.on('error', (error) => {
        console.error('[Instantly MCP] ❌ HTTP server error:', error);
        reject(error);
      });

      // Enhanced connection handling for Claude Desktop and Claude.ai
      this.httpServer.on('connection', (socket) => {
        socket.setKeepAlive(true, 30000);
        socket.setTimeout(120000); // Increased from 30s to 120s for large campaigns
        socket.on('timeout', () => {
          console.error('[Instantly MCP] ⚠️ Socket timeout (120s), closing connection');
          socket.destroy();
        });
      });

      // Session cleanup interval
      setInterval(() => {
        this.cleanupSessions();
      }, 60000); // Clean up every minute
    });
  }



  /**
   * Clean up inactive sessions and rate limit entries
   */
  private cleanupSessions(): void {
    const now = Date.now();
    const sessionTimeout = 30 * 60 * 1000; // 30 minutes
    let cleanedSessions = 0;
    let cleanedRateLimits = 0;

    // Clean up inactive sessions
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now - session.lastActivity > sessionTimeout) {
        this.activeSessions.delete(sessionId);
        cleanedSessions++;
      }
    }

    // Clean up expired rate limit entries
    for (const [ip, entry] of this.rateLimitMap.entries()) {
      if (now > entry.resetTime) {
        this.rateLimitMap.delete(ip);
        cleanedRateLimits++;
      }
    }

    if (cleanedSessions > 0 || cleanedRateLimits > 0) {
      console.error(`[HTTP] 🧹 Cleanup: ${cleanedSessions} sessions, ${cleanedRateLimits} rate limits - Active: ${this.activeSessions.size} sessions, ${this.rateLimitMap.size} rate limits`);
    }
  }



  /**
   * Set request handlers (to be called by main server)
   */
  setRequestHandlers(handlers: {
    toolsList: (id: any) => Promise<any>;
    toolCall: (params: any, id: any) => Promise<any>;
  }): void {
    this.requestHandlers = handlers;
  }

  /**
   * Get the active transports map (for debugging/monitoring)
   * In stateful mode, we maintain multiple transport instances per session
   */
  getTransports() {
    return this.transports;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.error('[Instantly MCP] 🛑 Shutting down HTTP server...');
    
    if (this.httpServer) {
      return new Promise((resolve) => {
        this.httpServer!.close(() => {
          console.error('[Instantly MCP] ✅ HTTP server shut down gracefully');
          resolve();
        });
      });
    }
  }
}
