/**
 * Streaming HTTP Transport for Instantly MCP Server
 * Implements native StreamableHTTPServerTransport with session management
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import cors from 'cors';
import { createServer, Server as HttpServer } from 'http';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { TOOLS_DEFINITION, executeToolDirectly } from './index.js';

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
  private transport: StreamableHTTPServerTransport;
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
    // Initialize official streamable HTTP transport in stateless mode for better compatibility
    // Stateless mode (sessionIdGenerator: undefined) allows clients to connect without session management
    this.transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode - no session management
      enableDnsRebindingProtection: false, // Disable for remote access compatibility
      enableJsonResponse: true, // Enable JSON responses for Claude Desktop compatibility
    });
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Claude Desktop compatibility: Inject Accept header if missing or incomplete
    // The MCP SDK requires BOTH 'application/json' AND 'text/event-stream' in the Accept header
    // Claude Desktop/Web may send only 'application/json', while iOS sends '*/*' or no header
    // This middleware ensures all clients get the required header combination
    this.app.use((req, res, next) => {
      const accept = req.headers.accept || '';
      const hasJson = accept.includes('application/json');
      const hasEventStream = accept.includes('text/event-stream');

      if (!hasJson || !hasEventStream) {
        req.headers.accept = 'application/json, text/event-stream';
        console.error('[HTTP] 🔧 Injected Accept header for MCP compatibility (was: %s)', accept || 'missing');
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
        'Keep-Alive': 'timeout=30, max=100',
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
    this.app.use((req, res, next) => {
      res.setHeader('mcp-protocol-version', '2025-06-18');
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
        transport: 'streaming-http',
        timestamp: new Date().toISOString(),
        activeSessions: this.activeSessions.size,
        endpoints: {
          mcp: '/mcp',
          'mcp-with-key': '/mcp/:apiKey',
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
        description: 'Official Instantly.ai MCP server with 22 email automation tools',
        transport: 'streaming-http',
        endpoint: 'https://mcp.instantly.ai/mcp',
        protocol: '2025-06-18',
        tools: 22,
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

    // Main MCP endpoint with header-based authentication
    this.app.post('/mcp', this.authMiddleware.bind(this), async (req, res) => {
      // LOG ALL HEADERS FOR DEBUGGING
      console.error('[HTTP] 🔍 INCOMING REQUEST HEADERS:', JSON.stringify({
        origin: req.headers.origin,
        host: req.headers.host,
        referer: req.headers.referer,
        'user-agent': req.headers['user-agent'],
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-forwarded-proto': req.headers['x-forwarded-proto'],
      }, null, 2));

      // Delegate to official StreamableHTTPServerTransport - it handles all MCP protocol details
      await this.transport.handleRequest(req, res, req.body);
    });

    // URL-based authentication endpoint: /mcp/{API_KEY}
    this.app.post('/mcp/:apiKey', async (req, res) => {
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

      // LOG ALL HEADERS FOR DEBUGGING - CAPTURE REAL CLIENT DATA
      console.error('[HTTP] 🔍 INCOMING REQUEST HEADERS (with API key in URL):', JSON.stringify({
        origin: req.headers.origin,
        host: req.headers.host,
        referer: req.headers.referer,
        'user-agent': req.headers['user-agent'],
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-forwarded-proto': req.headers['x-forwarded-proto'],
        'x-real-ip': req.headers['x-real-ip'],
      }, null, 2));

      // Use API key as-is from URL path (Instantly.ai expects base64-encoded format)
      console.error(`[HTTP] 🔑 Using API key from URL path as-is: ${apiKey.substring(0, 20)}...`);

      // Store the API key in request headers for SDK to pass through via extra.requestInfo.headers
      req.headers['x-instantly-api-key'] = apiKey;
      // Also store in request object as backup
      (req as any).instantlyApiKey = apiKey;
      console.error(`[HTTP] 🔍 Request body:`, JSON.stringify(req.body));

      // Delegate to official StreamableHTTPServerTransport
      await this.transport.handleRequest(req, res, req.body);
    });

    // OAuth 2.1 Authorization Server Metadata (RFC 8414)
    // Claude Desktop/Web checks this endpoint to discover auth capabilities
    this.app.get('/.well-known/oauth-authorization-server', (req, res) => {
      console.error('[HTTP] 🔍 OAuth discovery: /.well-known/oauth-authorization-server');

      // Tell Claude this server uses API key auth, not OAuth
      res.json({
        issuer: 'https://mcp.instantly.ai',
        authorization_endpoint: 'https://mcp.instantly.ai/authorize',
        token_endpoint: 'https://mcp.instantly.ai/token',
        grant_types_supported: ['client_credentials'],
        token_endpoint_auth_methods_supported: ['none'],
        response_types_supported: ['none'],
        // Indicate this is an API key based service
        service_documentation: 'https://github.com/Instantly-ai/instantly-mcp',
        ui_locales_supported: ['en-US'],
        // Custom field to indicate API key auth
        api_key_auth: {
          enabled: true,
          methods: ['url_path', 'header'],
          description: 'Use API key in URL path (/mcp/{API_KEY}) or Authorization header'
        }
      });
    });

    // OAuth 2.0 Protected Resource Metadata (RFC 8414)
    this.app.get('/.well-known/oauth-protected-resource', (req, res) => {
      console.error('[HTTP] 🔍 OAuth discovery: /.well-known/oauth-protected-resource');

      res.json({
        resource: 'https://mcp.instantly.ai',
        authorization_servers: ['https://mcp.instantly.ai'],
        bearer_methods_supported: ['header'],
        resource_documentation: 'https://github.com/Instantly-ai/instantly-mcp',
        // Indicate API key auth is used
        api_key_auth: {
          enabled: true,
          header: 'Authorization',
          url_parameter: 'api_key'
        }
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
    // Claude Desktop may try to register as a client
    this.app.post('/register', (req, res) => {
      console.error('[HTTP] 🔍 OAuth client registration attempted');

      // Return success but indicate no registration needed for API key auth
      res.json({
        client_id: 'instantly-mcp-api-key-client',
        client_name: 'Instantly MCP',
        grant_types: ['client_credentials'],
        token_endpoint_auth_method: 'none',
        // Indicate API key auth is used instead
        api_key_auth: {
          enabled: true,
          description: 'No OAuth registration needed. Use API key in URL or headers.',
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

    // GET endpoint for MCP clients (supports SSE if needed)
    this.app.get('/mcp/:apiKey?', (req, res) => {
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
          message: `Unsupported MCP protocol version: ${protocolVersion}. Supported: 2025-06-18, 2025-03-26, 2024-11-05`
        });
      }
      
      if (acceptHeader.includes('text/event-stream')) {
        // Client wants SSE stream - return 405 as we use Streamable HTTP
        console.error('[HTTP] 🚫 SSE not supported - use Streamable HTTP POST');
        res.status(405).json({
          error: 'Method Not Allowed',
          message: 'SSE not supported. Use POST for Streamable HTTP transport.',
          transport: 'streamable-http',
          endpoint: apiKey ? `/mcp/${apiKey}` : '/mcp'
        });
        return;
      }
      
      // Return server info for GET requests
      res.json({
        server: 'instantly-mcp',
        version: '1.1.0',
        transport: 'streamable-http',
        protocol: '2025-06-18',
        endpoints: {
          'mcp_post': apiKey ? `/mcp/${apiKey}` : '/mcp',
          'health': '/health',
          'info': '/info'
        },
        auth: {
          required: true,
          methods: ['path_parameter', 'header']
        }
      });
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
        protocol: '2025-06-18'
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

      // Enhanced timeout and connection handling for Claude Desktop
      this.httpServer.timeout = 30000; // 30 second timeout
      this.httpServer.keepAliveTimeout = 65000; // 65 second keep-alive
      this.httpServer.headersTimeout = 66000; // 66 second headers timeout

      // Connect server to transport before listening
      this.server.connect(this.transport).then(() => {
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
      }).catch((error) => {
        console.error('[Instantly MCP] ❌ Failed to connect streamable transport:', error);
        reject(error);
      });

      this.httpServer.on('error', (error) => {
        console.error('[Instantly MCP] ❌ HTTP server error:', error);
        reject(error);
      });

      // Enhanced connection handling for Claude Desktop
      this.httpServer.on('connection', (socket) => {
        socket.setKeepAlive(true, 30000);
        socket.setTimeout(30000);
        socket.on('timeout', () => {
          console.error('[Instantly MCP] ⚠️ Socket timeout, closing connection');
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
   * Get the underlying transport for server connection
   */
  getTransport() {
    return this.transport;
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
