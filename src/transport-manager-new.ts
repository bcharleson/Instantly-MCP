/**
 * Transport Manager for Instantly MCP Server
 * Supports both stdio (local Claude Desktop) and Streamable HTTP (remote Custom Connector)
 * 
 * This implementation uses the official MCP SDK's StreamableHTTPServerTransport
 * to provide full compatibility with Claude.ai Custom Connectors.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';

export type TransportMode = 'stdio' | 'http';

export interface TransportConfig {
  mode: TransportMode;
  port?: number;
  host?: string;
  cors?: {
    origin: string | string[] | boolean;
    credentials?: boolean;
  };
  auth?: {
    apiKeyHeader?: string;
    requiredApiKey?: string;
  };
}

/**
 * In-memory event store for session resumability
 */
class InMemoryEventStore {
  private events: Map<string, Array<{ eventId: string; message: any }>> = new Map();
  private eventCounter = 0;

  async storeEvent(streamId: string, message: any): Promise<string> {
    const eventId = `${streamId}-${this.eventCounter++}`;
    
    if (!this.events.has(streamId)) {
      this.events.set(streamId, []);
    }
    
    this.events.get(streamId)!.push({ eventId, message });
    return eventId;
  }

  async replayEventsAfter(
    lastEventId: string,
    { send }: { send: (eventId: string, message: any) => Promise<void> }
  ): Promise<string> {
    const [streamId] = lastEventId.split('-');
    const events = this.events.get(streamId) || [];
    
    const lastEventIndex = events.findIndex(e => e.eventId === lastEventId);
    const eventsToReplay = events.slice(lastEventIndex + 1);
    
    for (const event of eventsToReplay) {
      await send(event.eventId, event.message);
    }
    
    return streamId;
  }
}

export class TransportManager {
  private config: TransportConfig;
  private server: Server;
  private httpServer?: express.Application;
  private transports: Map<string, StreamableHTTPServerTransport | SSEServerTransport> = new Map();

  constructor(server: Server, config: TransportConfig) {
    this.server = server;
    this.config = config;
  }

  /**
   * Detect transport mode from environment
   */
  static detectTransportMode(): TransportMode {
    const mode = process.env.TRANSPORT_MODE?.toLowerCase();

    // Auto-detect based on environment
    if (mode === 'http' || mode === 'https') {
      return 'http';
    }

    // Auto-detect production environment (DigitalOcean App Platform)
    if (process.env.NODE_ENV === 'production' || process.env.PORT) {
      return 'http';
    }

    // Default to stdio for local usage
    return 'stdio';
  }

  /**
   * Create transport configuration based on environment
   */
  static createConfig(): TransportConfig {
    const mode = TransportManager.detectTransportMode();
    const isProduction = process.env.NODE_ENV === 'production';
    
    const config: TransportConfig = {
      mode,
      port: parseInt(process.env.PORT || '3000'),
      host: process.env.HOST || '0.0.0.0',
    };

    if (mode === 'http') {
      // Configure CORS for production instantly.ai endpoint
      config.cors = {
        origin: isProduction 
          ? ['https://claude.ai', 'https://cursor.sh', 'https://instantly.ai']
          : true,
        credentials: true,
      };

      // Configure authentication
      config.auth = {
        apiKeyHeader: 'x-api-key',
        requiredApiKey: process.env.INSTANTLY_API_KEY,
      };
    }

    return config;
  }

  /**
   * Start the appropriate transport
   */
  async start(): Promise<void> {
    console.error(`[Instantly MCP] 🚀 Starting ${this.config.mode} transport...`);

    if (this.config.mode === 'stdio') {
      await this.startStdioTransport();
    } else {
      await this.startHttpTransport();
    }
  }

  /**
   * Start stdio transport for local Claude Desktop usage
   */
  private async startStdioTransport(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('[Instantly MCP] 📡 Stdio transport ready for Claude Desktop');
  }

  /**
   * Start HTTP transport with official MCP SDK StreamableHTTPServerTransport
   */
  private async startHttpTransport(): Promise<void> {
    this.httpServer = express();
    
    // Configure middleware
    this.setupMiddleware();
    
    // Setup MCP endpoints (new Streamable HTTP + legacy SSE)
    this.setupMcpEndpoints();
    
    // Setup health and info endpoints
    this.setupUtilityEndpoints();
    
    // Start server
    const port = this.config.port!;
    const host = this.config.host!;
    
    this.httpServer.listen(port, host, () => {
      console.error(`[Instantly MCP] 🌐 HTTP transport ready at http://${host}:${port}`);
      console.error(`[Instantly MCP] 📋 Health check: http://${host}:${port}/health`);
      console.error(`[Instantly MCP] 🔗 MCP endpoint (Streamable HTTP): http://${host}:${port}/mcp`);
      console.error(`[Instantly MCP] 🔗 SSE endpoint (Legacy): http://${host}:${port}/sse`);
      
      if (process.env.NODE_ENV === 'production') {
        console.error(`[Instantly MCP] 🏢 Production endpoint: https://mcp.instantly.ai/mcp`);
      }
    });
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    if (!this.httpServer) return;

    // CORS configuration - expose Mcp-Session-Id header for browser clients
    if (this.config.cors) {
      this.httpServer.use(cors({
        ...this.config.cors,
        exposedHeaders: ['Mcp-Session-Id'],
      }));
    }

    // JSON parsing
    this.httpServer.use(express.json({ limit: '10mb' }));

    // Request logging
    this.httpServer.use((req, res, next) => {
      console.error(`[Instantly MCP] ${req.method} ${req.path} - ${req.ip}`);
      next();
    });
  }

  /**
   * Authentication middleware
   */
  private authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction): void {
    if (!this.config.auth?.requiredApiKey) {
      return next(); // No auth required
    }

    const apiKey = req.headers[this.config.auth.apiKeyHeader!] as string;
    
    if (!apiKey || apiKey !== this.config.auth.requiredApiKey) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid API key required',
        code: 'INVALID_API_KEY'
      });
      return;
    }

    next();
  }

  /**
   * Setup MCP endpoints - both new Streamable HTTP and legacy SSE
   */
  private setupMcpEndpoints(): void {
    if (!this.httpServer) return;

    //=============================================================================
    // STREAMABLE HTTP TRANSPORT (PROTOCOL VERSION 2025-03-26)
    // This is the NEW transport that Claude.ai Custom Connectors require
    //=============================================================================
    this.httpServer.all('/mcp', this.authMiddleware.bind(this), async (req, res) => {
      console.error(`[Instantly MCP] Streamable HTTP: ${req.method} /mcp`);
      
      try {
        // Check for existing session ID
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        let transport: StreamableHTTPServerTransport;

        if (sessionId && this.transports.has(sessionId)) {
          // Reuse existing transport
          const existingTransport = this.transports.get(sessionId);
          
          if (existingTransport instanceof StreamableHTTPServerTransport) {
            transport = existingTransport;
          } else {
            // Session exists but uses different transport (SSE)
            res.status(400).json({
              jsonrpc: '2.0',
              error: {
                code: -32000,
                message: 'Bad Request: Session exists but uses a different transport protocol',
              },
              id: null,
            });
            return;
          }
        } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
          // Create new transport for initialization request
          const eventStore = new InMemoryEventStore();
          
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(), // ✅ CRITICAL: Generate session IDs
            eventStore, // Enable resumability
            onsessioninitialized: (sessionId) => {
              console.error(`[Instantly MCP] ✅ Session initialized: ${sessionId}`);
              this.transports.set(sessionId, transport);
            },
            onsessionclosed: (sessionId) => {
              console.error(`[Instantly MCP] 🔒 Session closed: ${sessionId}`);
              this.transports.delete(sessionId);
            }
          });

          // Set up onclose handler
          transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid && this.transports.has(sid)) {
              console.error(`[Instantly MCP] Transport closed for session ${sid}`);
              this.transports.delete(sid);
            }
          };

          // Connect the transport to the MCP server
          await this.server.connect(transport);
        } else {
          // Invalid request
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: No valid session ID provided or not an initialization request',
            },
            id: null,
          });
          return;
        }

        // Handle the request with the transport
        await transport.handleRequest(req, res, req.body);
      } catch (error: any) {
        console.error('[Instantly MCP] ❌ Streamable HTTP error:', error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error',
              data: error.message
            },
            id: null,
          });
        }
      }
    });

    //=============================================================================
    // DEPRECATED HTTP+SSE TRANSPORT (PROTOCOL VERSION 2024-11-05)
    // Keep for backward compatibility with mcp-remote and older clients
    //=============================================================================
    this.httpServer.get('/sse', this.authMiddleware.bind(this), async (req, res) => {
      console.error('[Instantly MCP] Legacy SSE: GET /sse');
      
      const transport = new SSEServerTransport('/messages', res);
      this.transports.set(transport.sessionId, transport);
      
      res.on('close', () => {
        this.transports.delete(transport.sessionId);
      });

      await this.server.connect(transport);
    });

    this.httpServer.post('/messages', this.authMiddleware.bind(this), async (req, res) => {
      const sessionId = req.query.sessionId as string;
      const transport = this.transports.get(sessionId);

      if (transport instanceof SSEServerTransport) {
        await transport.handlePostMessage(req, res, req.body);
      } else {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: Invalid session or wrong transport type',
          },
          id: null,
        });
      }
    });
  }

  /**
   * Setup utility endpoints
   */
  private setupUtilityEndpoints(): void {
    if (!this.httpServer) return;

    // Health check
    this.httpServer.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'instantly-mcp',
        version: '1.1.0',
        transport: 'streamable-http',
        timestamp: new Date().toISOString(),
        endpoints: {
          mcp: '/mcp (Streamable HTTP - 2025-03-26)',
          sse: '/sse (Legacy SSE - 2024-11-05)',
          messages: '/messages (Legacy POST - 2024-11-05)',
          health: '/health',
          info: '/info'
        }
      });
    });

    // Server info
    this.httpServer.get('/info', (req, res) => {
      res.json({
        name: 'Instantly MCP Server',
        version: '1.1.0',
        description: 'Official Instantly.ai MCP server with 22 email automation tools',
        transport: 'streamable-http',
        endpoint: 'https://mcp.instantly.ai/mcp',
        tools: 22,
        features: [
          'Email campaign management',
          'Lead management',
          'Account management',
          'Analytics and reporting',
          'Email verification',
          'Subsequence management'
        ],
        documentation: 'https://github.com/Instantly-ai/instantly-mcp'
      });
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.error('[Instantly MCP] 🛑 Shutting down transport...');
    
    // Close all active transports
    for (const [sessionId, transport] of this.transports.entries()) {
      try {
        console.error(`[Instantly MCP] Closing transport for session ${sessionId}`);
        await transport.close();
        this.transports.delete(sessionId);
      } catch (error) {
        console.error(`[Instantly MCP] Error closing transport for session ${sessionId}:`, error);
      }
    }
  }
}

