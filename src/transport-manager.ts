/**
 * Transport Manager for Instantly MCP Server
 * Supports both stdio (local Claude Desktop) and streaming HTTP (remote instantly.ai/mcp)
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import express from 'express';
import cors from 'cors';

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

export class TransportManager {
  private config: TransportConfig;
  private server: Server;
  private httpServer?: express.Application;

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
   * Start HTTP transport for remote instantly.ai/mcp endpoint
   */
  private async startHttpTransport(): Promise<void> {
    this.httpServer = express();
    
    // Configure middleware
    this.setupMiddleware();
    
    // Setup MCP endpoints
    this.setupMcpEndpoints();
    
    // Setup health and info endpoints
    this.setupUtilityEndpoints();
    
    // Start server
    const port = this.config.port!;
    const host = this.config.host!;
    
    this.httpServer.listen(port, host, () => {
      console.error(`[Instantly MCP] 🌐 HTTP transport ready at http://${host}:${port}`);
      console.error(`[Instantly MCP] 📋 Health check: http://${host}:${port}/health`);
      console.error(`[Instantly MCP] 🔗 MCP endpoint: http://${host}:${port}/mcp`);
      
      if (process.env.NODE_ENV === 'production') {
        console.error(`[Instantly MCP] 🏢 Production endpoint: https://instantly.ai/mcp`);
      }
    });
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    if (!this.httpServer) return;

    // CORS configuration
    if (this.config.cors) {
      this.httpServer.use(cors(this.config.cors));
    }

    // JSON parsing
    this.httpServer.use(express.json({ limit: '10mb' }));

    // Request logging
    this.httpServer.use((req, res, next) => {
      console.error(`[Instantly MCP] ${req.method} ${req.path} - ${req.ip}`);
      next();
    });

    // Authentication middleware for MCP endpoints
    this.httpServer.use('/mcp', this.authMiddleware.bind(this));
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
   * Setup MCP endpoints
   */
  private setupMcpEndpoints(): void {
    if (!this.httpServer) return;

    // Main MCP endpoint
    this.httpServer.post('/mcp', async (req, res) => {
      try {
        const response = await this.handleMcpRequest(req.body);
        res.json(response);
      } catch (error: any) {
        console.error('[Instantly MCP] ❌ MCP request error:', error);
        res.status(500).json({
          jsonrpc: '2.0',
          id: req.body?.id || null,
          error: {
            code: -32603,
            message: 'Internal error',
            data: error.message
          }
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
        transport: 'http',
        timestamp: new Date().toISOString(),
        endpoints: {
          mcp: '/mcp',
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
        transport: 'streaming-http',
        endpoint: 'https://instantly.ai/mcp',
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
   * Handle MCP request (placeholder - will be implemented by main server)
   */
  private async handleMcpRequest(request: any): Promise<any> {
    // This will be overridden by the main server implementation
    throw new Error('MCP request handler not implemented');
  }

  /**
   * Set the MCP request handler
   */
  setMcpHandler(handler: (request: any) => Promise<any>): void {
    this.handleMcpRequest = handler;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.error('[Instantly MCP] 🛑 Shutting down transport...');
    
    if (this.httpServer && this.config.mode === 'http') {
      // Close HTTP server gracefully
      // Note: Express doesn't have a built-in close method, 
      // but in production this would be handled by the process manager
    }
  }
}
