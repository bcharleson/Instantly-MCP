/**
 * Production Configuration for Instantly.ai MCP Server
 * Deployment configuration for https://instantly.ai/mcp endpoint
 */

module.exports = {
  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    environment: 'production'
  },

  // Transport Configuration
  transport: {
    mode: 'http',
    protocol: 'https',
    domain: 'instantly.ai',
    path: '/mcp'
  },

  // CORS Configuration for Production
  cors: {
    origin: [
      'https://claude.ai',
      'https://cursor.sh', 
      'https://instantly.ai',
      'https://app.instantly.ai',
      // Add other authorized domains
    ],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-api-key',
      'mcp-session-id',
      'mcp-protocol-version'
    ]
  },

  // Authentication Configuration
  auth: {
    required: true,
    method: 'api-key',
    header: 'x-api-key',
    // API key will be provided via INSTANTLY_API_KEY environment variable
  },

  // Rate Limiting (if needed)
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
  },

  // Logging Configuration
  logging: {
    level: 'info',
    format: 'json',
    includeRequestId: true,
    logRequests: true,
    logErrors: true
  },

  // Health Check Configuration
  healthCheck: {
    enabled: true,
    path: '/health',
    includeSystemInfo: false, // Don't expose system info in production
    timeout: 5000
  },

  // Session Management
  session: {
    timeout: 30 * 60 * 1000, // 30 minutes
    cleanupInterval: 60 * 1000, // 1 minute
    maxSessions: 10000
  },

  // SSL/TLS Configuration (handled by reverse proxy)
  ssl: {
    enabled: false, // Handled by load balancer/reverse proxy
    redirectHttp: true
  },

  // Monitoring and Metrics
  monitoring: {
    enabled: true,
    metricsPath: '/metrics',
    collectDefaultMetrics: true,
    requestDuration: true,
    requestCount: true,
    errorRate: true
  },

  // Security Headers
  security: {
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https://api.instantly.ai"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }
  },

  // Error Handling
  errorHandling: {
    includeStackTrace: false, // Don't expose stack traces in production
    logErrors: true,
    notifyOnError: false, // Could integrate with monitoring service
  },

  // Performance Configuration
  performance: {
    compression: true,
    keepAliveTimeout: 65000,
    headersTimeout: 66000,
    maxRequestSize: '10mb',
    requestTimeout: 30000
  },

  // Instantly.ai API Configuration
  instantly: {
    apiUrl: 'https://api.instantly.ai/api/v2',
    timeout: 30000,
    retries: 3,
    retryDelay: 1000
  },

  // Feature Flags
  features: {
    enableMetrics: true,
    enableDetailedLogging: false,
    enableRequestTracing: true,
    enableCaching: false, // Disable caching for real-time data
    enableRateLimiting: true
  }
};
