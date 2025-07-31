# Railway Deployment Guide - Instantly MCP Server

## 🚀 **Deploy Instantly MCP Server to Railway for Remote n8n Testing**

This guide helps you deploy the Instantly MCP Server's n8n HTTP mode to Railway for remote testing and potential hosting on instantly.ai.

---

## **📋 Prerequisites**

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **GitHub Repository**: Your Instantly MCP code should be in a GitHub repo
3. **Instantly API Key**: Your Instantly.ai API key for the deployment

---

## **🔧 Deployment Steps**

### **Step 1: Prepare Repository**

Ensure your repository has these files (already included):
- `railway.toml` - Railway configuration
- `nixpacks.toml` - Build configuration  
- `Dockerfile` - Container configuration
- `package.json` - With `start:n8n` script

### **Step 2: Deploy to Railway**

#### **Option A: Railway CLI (Recommended)**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init

# Set environment variables
railway variables set INSTANTLY_API_KEY="your-api-key-here"
railway variables set NODE_ENV="production"

# Deploy
railway up
```

#### **Option B: Railway Dashboard**
1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your Instantly MCP repository
5. Railway will auto-detect the configuration

### **Step 3: Configure Environment Variables**

In Railway Dashboard → Your Project → Variables:
```
INSTANTLY_API_KEY = your-instantly-api-key-here
NODE_ENV = production
PORT = (automatically set by Railway)
```

### **Step 4: Verify Deployment**

Railway will provide a URL like: `https://your-app-name.railway.app`

Test endpoints:
- **Health Check**: `GET https://your-app-name.railway.app/health`
- **MCP Endpoint**: `POST https://your-app-name.railway.app/mcp`

---

## **🧪 Testing the Deployment**

### **Health Check Test**
```bash
curl https://your-app-name.railway.app/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "instantly-mcp",
  "mode": "n8n",
  "tools": 14,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### **MCP Tools List Test**
```bash
curl -X POST https://your-app-name.railway.app/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
```

### **List Accounts Test**
```bash
curl -X POST https://your-app-name.railway.app/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "list_accounts",
      "arguments": {
        "get_all": true
      }
    }
  }'
```

---

## **🤖 n8n Integration with Railway Deployment**

### **n8n HTTP Request Node Configuration**

**Method**: POST  
**URL**: `https://your-app-name.railway.app/mcp`  
**Headers**:
```json
{
  "Content-Type": "application/json"
}
```

**Body** (List Accounts Example):
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "list_accounts",
    "arguments": {
      "get_all": true
    }
  }
}
```

### **Available Tools on Railway**

All 14+ tools are available:

**Account Management:**
- `list_accounts` - Get all email accounts (398 accounts)
- `get_warmup_analytics` - Get warmup analytics for accounts

**Campaign Management:**
- `list_campaigns` - List all campaigns
- `create_campaign` - Create new campaigns
- `get_campaign` - Get campaign details
- `update_campaign` - Update campaigns
- `get_campaign_analytics` - Get campaign performance

**Lead Management:**
- `list_leads` - List all leads
- `create_lead` - Create new leads
- `update_lead` - Update leads
- `list_lead_lists` - List lead lists
- `create_lead_list` - Create lead lists

**Email Operations:**
- `list_emails` - List emails
- `get_email` - Get email details
- `reply_to_email` - Reply to emails
- `verify_email` - Verify email addresses

**API Management:**
- `list_api_keys` - List API keys

---

## **📊 Monitoring & Logs**

### **Railway Dashboard**
- **Deployments**: View deployment history and status
- **Metrics**: Monitor CPU, memory, and network usage
- **Logs**: Real-time application logs
- **Variables**: Manage environment variables

### **Application Logs**
Railway automatically captures console output. Look for:
```
[Instantly MCP] 🤖 Starting n8n automation mode...
[Instantly MCP] 🌐 n8n HTTP server running on port 3000
[Instantly MCP] 📡 Endpoint: http://localhost:3000/mcp
[Instantly MCP] 🏥 Health: http://localhost:3000/health
[Instantly MCP] 🤖 Ready for n8n automation workflows
```

---

## **🔧 Troubleshooting**

### **Common Issues**

#### **Build Failures**
- Check `package.json` has all dependencies
- Verify `npm run build` works locally
- Check Railway build logs for specific errors

#### **Runtime Errors**
- Verify `INSTANTLY_API_KEY` is set correctly
- Check application logs in Railway dashboard
- Test health endpoint first

#### **API Key Issues**
```bash
# Test API key locally first
export INSTANTLY_API_KEY="your-key"
node dist/index.js --n8n
curl http://localhost:3000/health
```

#### **Port Issues**
Railway automatically sets the `PORT` environment variable. The application uses:
```javascript
const PORT = process.env.PORT || 3000;
```

### **Debugging Steps**
1. Check Railway deployment logs
2. Verify environment variables are set
3. Test health endpoint
4. Test MCP endpoint with simple tools/list call
5. Check application logs for specific errors

---

## **🎯 Success Criteria**

**✅ Deployment Successful When:**
- Health endpoint returns 200 OK
- MCP endpoint accepts JSON-RPC requests
- All 14+ tools are listed in tools/list response
- list_accounts returns 398 accounts (not 0)
- n8n can successfully call the remote endpoint

**✅ Ready for instantly.ai Hosting When:**
- Railway deployment is stable
- All tools work correctly via HTTP
- Performance is acceptable for automation workflows
- Error handling works properly
- Monitoring shows healthy metrics

---

## **📚 Next Steps**

1. **Deploy to Railway** using this guide
2. **Test all tools** via the remote HTTP endpoint
3. **Create n8n workflows** using the Railway URL
4. **Monitor performance** and error rates
5. **Document any issues** for instantly.ai hosting consideration

The Railway deployment provides a production-ready environment for testing the Instantly MCP Server's n8n HTTP mode before potential integration with instantly.ai hosting infrastructure.
