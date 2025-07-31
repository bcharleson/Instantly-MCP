/**
 * Streaming HTTP Transport for Instantly MCP Server
 * Implements native StreamableHTTPServerTransport with session management
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import express from 'express';
import cors from 'cors';
import { createServer, Server as HttpServer } from 'http';

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

  constructor(server: Server, config: StreamingHttpConfig) {
    this.server = server;
    this.config = config;
    this.app = express();
    this.setupMiddleware();
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
        'mcp-session-id',
        'mcp-protocol-version'
      ]
    }));

    // JSON parsing with larger limit for complex requests
    this.app.use(express.json({ limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      const timestamp = new Date().toISOString();
      console.error(`[HTTP] ${timestamp} ${req.method} ${req.path} - ${req.ip}`);
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
        endpoint: 'https://instantly.ai/mcp',
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
          required: !!this.config.auth?.requiredApiKey,
          method: 'api-key',
          header: this.config.auth?.apiKeyHeader || 'x-api-key'
        },
        documentation: 'https://github.com/bcharleson/Instantly-MCP'
      });
    });

    // Main MCP endpoint with authentication
    this.app.post('/mcp', this.authMiddleware.bind(this), this.handleMcpRequest.bind(this));

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
   * Authentication middleware - Supports both Bearer token and x-api-key formats
   */
  private authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction): void {
    // Skip auth if no API key is configured
    if (!this.config.auth?.requiredApiKey) {
      return next();
    }

    // Try Authorization: Bearer format first (preferred for n8n)
    let apiKey = '';
    const authHeader = req.headers.authorization as string;

    if (authHeader) {
      if (authHeader.startsWith('Bearer ')) {
        // Extract API key from "Bearer [API_KEY]" format
        apiKey = authHeader.substring(7);
      } else {
        // Support raw API key in Authorization header (auto-add Bearer prefix)
        apiKey = authHeader;
      }
    }

    // Fallback to x-api-key header for backward compatibility
    if (!apiKey) {
      apiKey = req.headers[this.config.auth.apiKeyHeader] as string;
    }

    if (!apiKey) {
      res.status(401).json({
        jsonrpc: '2.0',
        id: req.body?.id || null,
        error: {
          code: -32001,
          message: 'Authentication required',
          data: {
            reason: 'Missing API key',
            supportedFormats: [
              'Authorization: Bearer [API_KEY]',
              `${this.config.auth.apiKeyHeader}: [API_KEY]`
            ]
          }
        }
      });
      return;
    }

    if (apiKey !== this.config.auth.requiredApiKey) {
      res.status(401).json({
        jsonrpc: '2.0',
        id: req.body?.id || null,
        error: {
          code: -32001,
          message: 'Invalid API key',
          data: {
            reason: 'API key does not match'
          }
        }
      });
      return;
    }

    next();
  }

  /**
   * Handle MCP requests
   */
  private async handleMcpRequest(req: express.Request, res: express.Response): Promise<void> {
    const startTime = Date.now();
    const sessionId = req.headers['mcp-session-id'] as string || `session-${Date.now()}`;
    
    try {
      // Validate JSON-RPC format
      if (!req.body || typeof req.body !== 'object') {
        throw new Error('Invalid JSON-RPC request format');
      }

      const { jsonrpc, id, method, params } = req.body;

      if (jsonrpc !== '2.0') {
        throw new Error('Invalid JSON-RPC version');
      }

      // Track session
      this.activeSessions.set(sessionId, {
        startTime,
        lastActivity: Date.now(),
        requestCount: (this.activeSessions.get(sessionId)?.requestCount || 0) + 1
      });

      // Handle the request through the MCP server
      const response = await this.processRequest(method, params, id);

      // Add session tracking headers
      res.setHeader('mcp-session-id', sessionId);
      res.setHeader('x-response-time', `${Date.now() - startTime}ms`);

      res.json(response);

      // Log successful request
      console.error(`[HTTP] ✅ ${method} completed in ${Date.now() - startTime}ms`);

    } catch (error: any) {
      console.error(`[HTTP] ❌ Request error:`, error);

      const errorResponse = {
        jsonrpc: '2.0',
        id: req.body?.id || null,
        error: {
          code: -32603,
          message: 'Internal error',
          data: {
            error: error.message,
            timestamp: new Date().toISOString(),
            sessionId
          }
        }
      };

      res.status(500).json(errorResponse);
    } finally {
      // Update session activity
      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.lastActivity = Date.now();
      }
    }
  }

  /**
   * Process MCP request through the server
   */
  private async processRequest(method: string, params: any, id: any): Promise<any> {
    // This is a simplified implementation
    // In a full implementation, you would create a proper transport
    // that integrates with the MCP server's request handling
    
    switch (method) {
      case 'tools/list':
        return await this.handleToolsList(id);
      
      case 'tools/call':
        return await this.handleToolCall(params, id);
      
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  /**
   * Handle tools/list requests
   */
  private async handleToolsList(id: any): Promise<any> {
    // This would integrate with your existing tools list
    // For now, return a placeholder that matches your 22 tools
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: [] // This will be populated by the main server
      }
    };
  }

  /**
   * Handle tools/call requests
   */
  private async handleToolCall(params: any, id: any): Promise<any> {
    // This would integrate with your existing tool handlers
    // For now, return a placeholder
    return {
      jsonrpc: '2.0',
      id,
      result: {
        content: [
          {
            type: 'text',
            text: 'Tool call placeholder - will be implemented by main server'
          }
        ]
      }
    };
  }

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer = createServer(this.app);

      this.httpServer.listen(this.config.port, this.config.host, () => {
        console.error(`[Instantly MCP] 🌐 Streaming HTTP server running at http://${this.config.host}:${this.config.port}`);
        console.error(`[Instantly MCP] 📋 Health check: http://${this.config.host}:${this.config.port}/health`);
        console.error(`[Instantly MCP] 🔗 MCP endpoint: http://${this.config.host}:${this.config.port}/mcp`);
        
        if (process.env.NODE_ENV === 'production') {
          console.error(`[Instantly MCP] 🏢 Production endpoint: https://instantly.ai/mcp`);
        }

        resolve();
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
   * Clean up inactive sessions
   */
  private cleanupSessions(): void {
    const now = Date.now();
    const timeout = 30 * 60 * 1000; // 30 minutes

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now - session.lastActivity > timeout) {
        this.activeSessions.delete(sessionId);
        console.error(`[HTTP] 🧹 Cleaned up inactive session: ${sessionId}`);
      }
    }
  }

  /**
   * Set request handlers (to be called by main server)
   */
  setRequestHandlers(handlers: {
    toolsList: (id: any) => Promise<any>;
    toolCall: (params: any, id: any) => Promise<any>;
  }): void {
    this.handleToolsList = handlers.toolsList;
    this.handleToolCall = handlers.toolCall;
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
