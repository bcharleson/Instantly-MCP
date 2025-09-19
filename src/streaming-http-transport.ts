/**
 * Streaming HTTP Transport for Instantly MCP Server
 * Implements native StreamableHTTPServerTransport with session management
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import cors from 'cors';
import { createServer, Server as HttpServer } from 'http';

// Simple rate limiting interface
interface RateLimitEntry {
  count: number;
  resetTime: number;
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
    // Initialize official streamable HTTP transport (connect during start())
    this.transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      enableDnsRebindingProtection: true,
    });
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
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
        'mcp-protocol-version'
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
          info: '/info'
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
        documentation: 'https://github.com/bcharleson/Instantly-MCP'
      });
    });

    // Main MCP endpoint with header-based authentication (more secure)
    this.app.post('/mcp', this.authMiddleware.bind(this), async (req, res) => {
      await this.handleMcpRequest(req, res);
    });

    // URL-based authentication endpoint: /mcp/{API_KEY}
    this.app.post('/mcp/:apiKey', async (req, res) => {
      // Extract API key from URL path
      const apiKey = req.params.apiKey;

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

      // Store the API key in request for tool handlers
      (req as any).instantlyApiKey = apiKey;

      await this.handleMcpRequest(req, res);
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
        availableEndpoints: ['/mcp', '/health', '/info']
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

    // Store the API key in request for tool handlers
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

      // Connect server to transport before listening
      this.server.connect(this.transport).then(() => {
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        this.httpServer!.listen(this.config.port, this.config.host, () => {
        console.error(`[Instantly MCP] 🌐 Streaming HTTP server running at http://${this.config.host}:${this.config.port}`);
        console.error(`[Instantly MCP] 📋 Health check: http://${this.config.host}:${this.config.port}/health`);
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

      // Session cleanup interval
      setInterval(() => {
        this.cleanupSessions();
      }, 60000); // Clean up every minute
    });
  }

  /**
   * Shared MCP request handler for both authentication methods
   */
  private async handleMcpRequest(req: express.Request, res: express.Response): Promise<void> {
    const startTime = Date.now();
    const sessionId = (req.headers['mcp-session-id'] as string) || `session-${Date.now()}`;
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const authMethod = req.params?.apiKey ? 'URL' : (req.headers.authorization ? 'Bearer' : 'Header');

    try {
      // Enhanced session tracking
      this.activeSessions.set(sessionId, {
        startTime,
        lastActivity: Date.now(),
        requestCount: (this.activeSessions.get(sessionId)?.requestCount || 0) + 1,
        clientIp,
        authMethod,
        userAgent: req.headers['user-agent'] || 'unknown'
      });

      // Validate request body
      if (!req.body || typeof req.body !== 'object') {
        res.status(400).json({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32700,
            message: 'Parse error',
            data: { reason: 'Invalid JSON-RPC request body' }
          }
        });
        return;
      }

      // Handle MCP request with per-request API key
      const apiKey = (req as any).instantlyApiKey;
      const mcpRequest = req.body;

      // Log the request for monitoring
      console.error(`[MCP] ${sessionId} - ${mcpRequest.method || 'unknown'} - ${authMethod} auth - ${clientIp}`);

      // Process the MCP request with the extracted API key
      const response = await this.handleMcpRequestWithApiKey(mcpRequest, apiKey);

      const responseTime = Date.now() - startTime;
      res.setHeader('mcp-session-id', sessionId);
      res.setHeader('x-response-time', `${responseTime}ms`);
      res.setHeader('x-auth-method', authMethod);

      // Handle notifications (no response expected)
      if (response === null) {
        res.status(204).end(); // 204 No Content for notifications
      } else {
        res.json(response);
      }

      // Log successful response
      console.error(`[MCP] ${sessionId} - Success - ${responseTime}ms`);

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      console.error(`[Instantly MCP] ❌ MCP request error (${sessionId}):`, {
        error: error.message,
        stack: error.stack?.split('\n')[0],
        method: req.body?.method,
        authMethod,
        clientIp,
        responseTime
      });

      res.status(500).json({
        jsonrpc: '2.0',
        id: req.body?.id || null,
        error: {
          code: -32603,
          message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
          data: process.env.NODE_ENV === 'production' ? undefined : { stack: error.stack }
        }
      });
    } finally {
      const session = this.activeSessions.get(sessionId);
      if (session) session.lastActivity = Date.now();
    }
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
   * Handle MCP request with per-request API key
   */
  private async handleMcpRequestWithApiKey(mcpRequest: any, apiKey: string): Promise<any> {
    const { method, params, id } = mcpRequest;
    
    try {
      switch (method) {
        case 'initialize':
          // MCP protocol initialization
          return {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: {},
                logging: {}
              },
              serverInfo: {
                name: 'instantly-mcp',
                version: '1.1.0'
              }
            }
          };

        case 'initialized':
        case 'notifications/initialized':
          // MCP protocol initialization complete notification
          // Notifications don't return responses, just acknowledge receipt
          return null; // No response for notifications

        case 'tools/list':
          // Return the tools list
          if (this.requestHandlers?.toolsList) {
            return await this.requestHandlers.toolsList(id);
          }
          // Fallback to static tools list
          return {
            jsonrpc: '2.0',
            id,
            result: {
              tools: [] // Will be populated by the actual handler
            }
          };

        case 'tools/call':
          // Execute tool with API key
          if (this.requestHandlers?.toolCall) {
            // Add API key to params for tool execution
            const paramsWithApiKey = { ...params, apiKey };
            return await this.requestHandlers.toolCall(paramsWithApiKey, id);
          }
          throw new Error('Tool call handler not configured');

        default:
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: `Method not found: ${method}`
            }
          };
      }
    } catch (error: any) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: error.message || 'Internal error'
        }
      };
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
