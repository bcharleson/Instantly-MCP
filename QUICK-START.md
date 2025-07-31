# ⚡ **QUICK START GUIDE**
## Deploy & Test Instantly MCP Server in 10 Minutes

Get your streaming HTTP transport running and tested before instantly.ai integration.

---

## 🚀 **OPTION 1: RAILWAY DEPLOYMENT (RECOMMENDED)**

### **Step 1: One-Command Deploy**
```bash
# Set your API key
export INSTANTLY_API_KEY="your_api_key_here"

# Deploy to Railway
./deploy-staging.sh
```

**That's it!** The script will:
- ✅ Install Railway CLI if needed
- ✅ Create and deploy project
- ✅ Set environment variables
- ✅ Run comprehensive tests
- ✅ Provide staging URL

### **Step 2: Get Your URL**
After deployment, you'll get a URL like:
```
https://instantly-mcp-staging-production.up.railway.app
```

### **Step 3: Test Immediately**
```bash
# Quick health check
curl https://your-staging-url.railway.app/health

# Test MCP endpoint
curl -X POST https://your-staging-url.railway.app/mcp \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

---

## 🚀 **OPTION 2: MANUAL RAILWAY SETUP**

### **Step 1: Install Railway CLI**
```bash
npm install -g @railway/cli
railway login
```

### **Step 2: Deploy**
```bash
# Build project
npm run build

# Create Railway project
railway new instantly-mcp-staging

# Set environment variables
railway variables set INSTANTLY_API_KEY="your_api_key"
railway variables set NODE_ENV=production
railway variables set TRANSPORT_MODE=http

# Deploy
railway up
```

### **Step 3: Test**
```bash
# Get your URL
railway domain

# Run tests
STAGING_URL="https://your-url.railway.app" node test-staging-environment.js
```

---

## 🚀 **OPTION 3: RENDER DEPLOYMENT**

### **Step 1: Connect Repository**
1. Go to [render.com](https://render.com)
2. Connect your GitHub repository
3. Choose "Web Service"

### **Step 2: Configure**
- **Build Command**: `npm run build`
- **Start Command**: `npm run start:production`
- **Environment Variables**:
  ```
  NODE_ENV=production
  TRANSPORT_MODE=http
  INSTANTLY_API_KEY=your_api_key
  ```

### **Step 3: Deploy & Test**
Render will provide a URL like `https://instantly-mcp.onrender.com`

---

## 🧪 **INSTANT TESTING**

### **1. Health Check (30 seconds)**
```bash
curl https://your-staging-url/health
# Expected: {"status":"healthy","service":"instantly-mcp"}
```

### **2. Tools List (1 minute)**
```bash
curl -X POST https://your-staging-url/mcp \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
# Expected: 22 tools listed
```

### **3. Tool Execution (2 minutes)**
```bash
curl -X POST https://your-staging-url/mcp \
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
# Expected: Account data returned
```

### **4. Comprehensive Test Suite (5 minutes)**
```bash
STAGING_URL="https://your-staging-url" \
INSTANTLY_API_KEY="your_api_key" \
node test-staging-environment.js
```

---

## 📋 **INSTANT VALIDATION CHECKLIST**

### **✅ Basic Functionality**
- [ ] Health endpoint returns 200
- [ ] Server info shows 22 tools
- [ ] Tools list returns all tools
- [ ] Tool execution works
- [ ] Authentication required

### **✅ Production Readiness**
- [ ] HTTPS enabled
- [ ] CORS configured
- [ ] Error handling works
- [ ] Performance acceptable
- [ ] Monitoring ready

### **✅ Client Compatibility**
- [ ] n8n HTTP requests work
- [ ] Browser fetch API works
- [ ] Postman/curl work
- [ ] Local stdio still works

---

## 🎯 **SUCCESS INDICATORS**

### **You'll Know It's Working When:**
1. **Health check returns**: `{"status":"healthy"}`
2. **Tools list shows**: 22 tools available
3. **Tool execution**: Returns actual data
4. **Authentication**: Rejects requests without API key
5. **Test suite**: All tests pass

### **Ready for Instantly.ai When:**
- ✅ All tests passing
- ✅ Performance under 2 seconds
- ✅ No errors in logs
- ✅ CORS working for instantly.ai
- ✅ Authentication enforced

---

## 📞 **INSTANT SUPPORT**

### **If Something Goes Wrong:**

#### **Deployment Issues**
```bash
# Check Railway logs
railway logs

# Check build status
railway status

# Redeploy
railway up --detach
```

#### **API Issues**
```bash
# Test health first
curl https://your-url/health

# Check API key
echo $INSTANTLY_API_KEY

# Test without auth (should fail)
curl -X POST https://your-url/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

#### **Performance Issues**
```bash
# Check response time
time curl https://your-url/health

# Monitor logs
railway logs --tail
```

---

## 🚀 **NEXT STEPS AFTER SUCCESS**

### **1. Share with Instantly.ai Team**
```markdown
✅ Staging URL: https://your-staging-url.railway.app
✅ All tests passing
✅ Ready for production deployment
✅ See INSTANTLY-TEAM-HANDOFF.md for details
```

### **2. Prepare for Production**
- Domain configuration: `instantly.ai/mcp`
- SSL certificate setup
- Production API key
- Monitoring configuration

### **3. Go Live**
Once Instantly.ai team configures DNS:
```bash
# Test production endpoint
curl https://instantly.ai/health
curl -X POST https://instantly.ai/mcp \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

---

## 🎉 **YOU'RE DONE!**

**In just 10 minutes, you have:**
- ✅ Deployed streaming HTTP MCP server
- ✅ Tested all functionality
- ✅ Validated client compatibility
- ✅ Prepared for instantly.ai integration

**Your staging environment is ready to share with the Instantly.ai team for production deployment!** 🚀

---

*Need help? Check the detailed guides:*
- 📖 **STAGING-DEPLOYMENT.md** - Comprehensive deployment guide
- 🧪 **MCP-CLIENT-TESTING.md** - Client testing procedures  
- 📋 **INSTANTLY-TEAM-HANDOFF.md** - Production handoff document
