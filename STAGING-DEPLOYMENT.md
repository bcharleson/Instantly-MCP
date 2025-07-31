# 🧪 **STAGING DEPLOYMENT GUIDE**
## Testing Instantly MCP Server Before instantly.ai Integration

This guide helps you deploy and test the streaming HTTP transport on a staging environment before the Instantly.ai team integrates it with the official domain.

---

## 🚀 **DEPLOYMENT OPTIONS**

### **Option 1: Railway (Recommended)**

#### **Step 1: Deploy to Railway**
```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login to Railway
railway login

# 3. Create new project
railway new

# 4. Link to your repository
railway link

# 5. Set environment variables
railway variables set INSTANTLY_API_KEY=your_api_key_here
railway variables set NODE_ENV=production
railway variables set TRANSPORT_MODE=http

# 6. Deploy
railway up
```

#### **Step 2: Get Your Staging URL**
After deployment, Railway will provide a URL like:
```
https://instantly-mcp-production.up.railway.app
```

### **Option 2: Render**

#### **Step 1: Create render.yaml**
```yaml
services:
  - type: web
    name: instantly-mcp-staging
    env: node
    buildCommand: npm run build
    startCommand: npm run start:production
    envVars:
      - key: NODE_ENV
        value: production
      - key: TRANSPORT_MODE
        value: http
      - key: INSTANTLY_API_KEY
        fromDatabase:
          name: instantly-api-key
          property: connectionString
```

#### **Step 2: Deploy**
1. Connect your GitHub repository to Render
2. Set environment variables in Render dashboard
3. Deploy automatically

### **Option 3: Fly.io**

#### **Step 1: Install Fly CLI**
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Initialize app
fly launch --no-deploy
```

#### **Step 2: Configure fly.toml**
```toml
app = "instantly-mcp-staging"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile.production"

[env]
  NODE_ENV = "production"
  TRANSPORT_MODE = "http"
  PORT = "3000"

[[services]]
  http_checks = []
  internal_port = 3000
  processes = ["app"]
  protocol = "tcp"
  script_checks = []

  [services.concurrency]
    hard_limit = 25
    soft_limit = 20
    type = "connections"

  [[services.ports]]
    force_https = true
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443

  [services.tcp_checks]
    grace_period = "1s"
    interval = "15s"
    restart_limit = 0
    timeout = "2s"
```

#### **Step 3: Deploy**
```bash
# Set secrets
fly secrets set INSTANTLY_API_KEY=your_api_key_here

# Deploy
fly deploy
```

---

## 🧪 **TESTING CHECKLIST**

### **1. Basic Health Checks**
```bash
# Replace with your staging URL
STAGING_URL="https://your-app.railway.app"

# Test health endpoint
curl $STAGING_URL/health

# Expected response:
# {
#   "status": "healthy",
#   "service": "instantly-mcp",
#   "version": "1.1.0",
#   "transport": "streaming-http"
# }
```

### **2. Server Info**
```bash
curl $STAGING_URL/info

# Expected response:
# {
#   "name": "Instantly MCP Server",
#   "version": "1.1.0",
#   "transport": "streaming-http",
#   "tools": 22
# }
```

### **3. MCP Tools List**
```bash
curl -X POST $STAGING_URL/mcp \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'

# Expected: List of 22 tools
```

### **4. Tool Execution Test**
```bash
curl -X POST $STAGING_URL/mcp \
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

---

## 🔌 **MCP CLIENT TESTING**

### **Claude Desktop Configuration**

Create a test configuration file:

**File: `claude_desktop_config_staging.json`**
```json
{
  "mcpServers": {
    "instantly-staging": {
      "command": "npx",
      "args": ["instantly-mcp"],
      "env": {
        "INSTANTLY_API_KEY": "your_api_key_here"
      }
    },
    "instantly-remote": {
      "command": "curl",
      "args": [
        "-X", "POST",
        "https://your-app.railway.app/mcp",
        "-H", "Content-Type: application/json",
        "-H", "x-api-key: your_api_key_here",
        "-d", "@-"
      ]
    }
  }
}
```

### **Cursor IDE Testing**

Add to your Cursor settings:
```json
{
  "mcp.servers": {
    "instantly-staging": {
      "command": "npx",
      "args": ["instantly-mcp"],
      "env": {
        "INSTANTLY_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### **n8n Integration Testing**

Create an n8n workflow:
```json
{
  "nodes": [
    {
      "name": "HTTP Request",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://your-app.railway.app/mcp",
        "method": "POST",
        "headers": {
          "Content-Type": "application/json",
          "x-api-key": "your_api_key_here"
        },
        "body": {
          "jsonrpc": "2.0",
          "id": 1,
          "method": "tools/call",
          "params": {
            "name": "list_campaigns",
            "arguments": {"get_all": true}
          }
        }
      }
    }
  ]
}
```

---

## 📋 **PRE-HANDOFF VALIDATION**

### **Performance Testing**
```bash
# Load testing with Apache Bench
ab -n 100 -c 10 -H "x-api-key: YOUR_API_KEY" \
   -p test-request.json \
   -T application/json \
   https://your-app.railway.app/mcp
```

### **Security Testing**
```bash
# Test without API key (should fail)
curl -X POST https://your-app.railway.app/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Test CORS
curl -H "Origin: https://claude.ai" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: x-api-key" \
     -X OPTIONS \
     https://your-app.railway.app/mcp
```

### **Monitoring Setup**
```bash
# Set up monitoring endpoints
curl https://your-app.railway.app/health
curl https://your-app.railway.app/info

# Check logs
railway logs --tail
```

---

## 📄 **HANDOFF DOCUMENTATION**

### **For Instantly.ai Team**

Create a handoff document with:

1. **Staging URL**: `https://your-app.railway.app`
2. **Test Results**: All validation checks passed
3. **Environment Variables Needed**:
   ```
   NODE_ENV=production
   TRANSPORT_MODE=http
   PORT=3000
   INSTANTLY_API_KEY=production_key
   ```

4. **DNS Configuration**:
   ```
   instantly.ai/mcp -> your_production_server:3000
   ```

5. **Health Check Endpoint**: `/health`
6. **SSL Requirements**: HTTPS required
7. **CORS Configuration**: Already configured for instantly.ai domain

### **Testing Report Template**
```markdown
# Instantly MCP Server - Staging Test Report

## Deployment Details
- **Staging URL**: https://your-app.railway.app
- **Version**: 1.1.0
- **Transport**: streaming-http
- **Tools Available**: 22

## Test Results
- ✅ Health checks passing
- ✅ All 22 tools functional
- ✅ Authentication working
- ✅ CORS configured
- ✅ n8n integration tested
- ✅ Performance acceptable

## Ready for Production
The server is ready for deployment to instantly.ai/mcp
```

---

## 🎯 **RECOMMENDED WORKFLOW**

1. **Deploy to Railway** (easiest setup)
2. **Run comprehensive tests** (use provided scripts)
3. **Test with actual MCP clients** (Claude, Cursor, n8n)
4. **Document results** (create test report)
5. **Share staging URL** with Instantly.ai team
6. **Provide deployment instructions** for production

This approach ensures everything works perfectly before the official instantly.ai integration! 🚀
