# Instantly MCP Server - Production Deployment Guide

## Official Endpoint: https://instantly.ai/mcp

This guide covers deploying the Instantly MCP Server to the official `https://instantly.ai/mcp` endpoint for remote access.

## 🚀 **Quick Start**

### Local Testing (HTTP Mode)
```bash
# Build the server
npm run build

# Start in HTTP mode
npm run start:http

# Test the endpoint
curl http://localhost:3000/health
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### Production Deployment
```bash
# Build production image
docker build -f Dockerfile.production -t instantly-mcp:latest .

# Run production container
docker run -d \
  --name instantly-mcp \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e TRANSPORT_MODE=http \
  -e INSTANTLY_API_KEY=your_api_key \
  instantly-mcp:latest
```

## 🏗️ **Architecture Overview**

### Multi-Transport Support
- **Stdio Transport**: Local Claude Desktop, Cursor IDE usage
- **Streaming HTTP Transport**: Remote access via https://instantly.ai/mcp

### Transport Detection
```javascript
// Automatic detection based on environment
TRANSPORT_MODE=stdio  # Default - for local usage
TRANSPORT_MODE=http   # For remote hosting
```

## 🔧 **Configuration**

### Environment Variables

#### Required
- `INSTANTLY_API_KEY`: Your Instantly.ai API key

#### Optional
- `TRANSPORT_MODE`: `stdio` (default) or `http`
- `NODE_ENV`: `development` or `production`
- `PORT`: HTTP server port (default: 3000)
- `HOST`: Bind address (default: 0.0.0.0)

### Production Configuration
```bash
# Production environment
export NODE_ENV=production
export TRANSPORT_MODE=http
export PORT=3000
export HOST=0.0.0.0
export INSTANTLY_API_KEY=your_production_api_key
```

## 🌐 **HTTP Endpoints**

### Main MCP Endpoint
```
POST https://instantly.ai/mcp
Content-Type: application/json
x-api-key: YOUR_API_KEY

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

### Health Check
```
GET https://instantly.ai/health

Response:
{
  "status": "healthy",
  "service": "instantly-mcp",
  "version": "1.1.0",
  "transport": "streaming-http",
  "timestamp": "2025-01-12T...",
  "activeSessions": 5,
  "endpoints": {
    "mcp": "/mcp",
    "health": "/health", 
    "info": "/info"
  }
}
```

### Server Info
```
GET https://instantly.ai/info

Response:
{
  "name": "Instantly MCP Server",
  "version": "1.1.0",
  "description": "Official Instantly.ai MCP server with 22 email automation tools",
  "transport": "streaming-http",
  "endpoint": "https://instantly.ai/mcp",
  "protocol": "2025-06-18",
  "tools": 22,
  "capabilities": {
    "tools": true,
    "resources": false,
    "prompts": false,
    "logging": false
  }
}
```

## 🔐 **Authentication**

### API Key Authentication
- Header: `x-api-key`
- Value: Your Instantly.ai API key
- Required for all `/mcp` requests

### CORS Configuration
Production CORS allows:
- `https://claude.ai`
- `https://cursor.sh`
- `https://instantly.ai`

## 🛠️ **Development vs Production**

### Development Mode
```bash
# Local development with hot reload
npm run dev

# HTTP mode for testing
TRANSPORT_MODE=http npm run dev
```

### Production Mode
```bash
# Production build
npm run build

# Production server
npm run start:production
```

## 📊 **Monitoring & Health Checks**

### Health Check Endpoint
- URL: `/health`
- Method: GET
- Response: JSON with server status

### Session Management
- Automatic session cleanup
- 30-minute session timeout
- Session tracking via `mcp-session-id` header

### Error Handling
- Structured JSON-RPC error responses
- Request/response logging
- Graceful error recovery

## 🔄 **Backward Compatibility**

### Stdio Mode (Default)
```bash
# Works exactly as before
node dist/index.js
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
```

### Legacy n8n Support
```bash
# Legacy flag still works
node dist/index.js --n8n
```

## 🚀 **Deployment Options**

### Option 1: Docker Container
```bash
docker build -f Dockerfile.production -t instantly-mcp .
docker run -p 3000:3000 -e INSTANTLY_API_KEY=key instantly-mcp
```

### Option 2: Node.js Process
```bash
npm run build
NODE_ENV=production TRANSPORT_MODE=http npm start
```

### Option 3: Process Manager (PM2)
```bash
npm install -g pm2
pm2 start dist/index.js --name instantly-mcp --env production
```

## 🔍 **Testing the Deployment**

### 1. Health Check
```bash
curl https://instantly.ai/health
```

### 2. Tools List
```bash
curl -X POST https://instantly.ai/mcp \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### 3. Tool Execution
```bash
curl -X POST https://instantly.ai/mcp \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "list_accounts",
      "arguments": {"get_all": true}
    }
  }'
```

## 🔧 **Troubleshooting**

### Common Issues

1. **CORS Errors**
   - Ensure your domain is in the CORS allowlist
   - Check that credentials are included in requests

2. **Authentication Failures**
   - Verify `x-api-key` header is present
   - Check that API key is valid

3. **Connection Issues**
   - Verify server is running on correct port
   - Check firewall/security group settings

### Debug Mode
```bash
DEBUG=instantly-mcp* npm run start:production
```

## 📈 **Performance Considerations**

- Session cleanup runs every minute
- Request timeout: 30 seconds
- Maximum request size: 10MB
- Keep-alive timeout: 65 seconds

## 🔒 **Security Features**

- Non-root container user
- Security headers via Helmet
- Request rate limiting
- Input validation
- Error message sanitization
- HTTPS enforcement (via reverse proxy)

## 📝 **Logs and Monitoring**

Production logs include:
- Request/response timing
- Error tracking
- Session management
- Health check status
- API usage metrics
