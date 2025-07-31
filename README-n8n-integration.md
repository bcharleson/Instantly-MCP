# Instantly MCP Server - n8n Automation Integration

## 🚀 **Complete Implementation: Core Functionality + n8n Support**

The Instantly MCP Server now supports both AI assistants (Claude Desktop, Cursor IDE) and automation platforms (n8n) with a simple, focused implementation.

---

## **📋 Two Modes Available**

### **1. stdio Mode (Default) - AI Assistants**
- **For:** Claude Desktop, Cursor IDE, NPM package users
- **Transport:** stdio (direct connection)
- **Usage:** `node dist/index.js` or `npx instantly-mcp`
- **Features:** All 22+ email automation tools with bulletproof pagination

### **2. n8n Mode - Automation Workflows**
- **For:** n8n automation workflows, web-based integrations
- **Transport:** Streamable HTTP (latest MCP standard)
- **Usage:** `node dist/index.js --n8n` or `npm run start:n8n`
- **Features:** Same tools as stdio mode, HTTP endpoint for automation

---

## **🔧 Installation & Setup**

### **Prerequisites**
```bash
# Required
export INSTANTLY_API_KEY="your-instantly-api-key-here"

# Optional for n8n mode
export PORT=3000  # Default port for HTTP server
```

### **Install via NPM**
```bash
# Global installation
npm install -g instantly-mcp

# Local installation
npm install instantly-mcp
```

### **Install from Source**
```bash
git clone https://github.com/bcharleson/Instantly-MCP.git
cd Instantly-MCP
npm install
npm run build
```

---

## **🤖 n8n Automation Integration**

### **Step 1: Start n8n HTTP Server**
```bash
# Method 1: Direct command
node dist/index.js --n8n

# Method 2: NPM script
npm run start:n8n

# Method 3: Global package
npx instantly-mcp --n8n
```

**Expected Output:**
```
[Instantly MCP] 🤖 Starting n8n automation mode...
[Instantly MCP] 🌐 n8n HTTP server running on port 3000
[Instantly MCP] 📡 Endpoint: http://localhost:3000/mcp
[Instantly MCP] 🏥 Health: http://localhost:3000/health
[Instantly MCP] 🤖 Ready for n8n automation workflows
```

### **Step 2: Configure n8n Workflow**

#### **Health Check Node (Optional)**
```json
{
  "node": "HTTP Request",
  "method": "GET",
  "url": "http://localhost:3000/health",
  "headers": {
    "Content-Type": "application/json"
  }
}
```

#### **List All Accounts Node**
```json
{
  "node": "HTTP Request",
  "method": "POST",
  "url": "http://localhost:3000/mcp",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
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
}
```

#### **Create Campaign Node**
```json
{
  "node": "HTTP Request",
  "method": "POST",
  "url": "http://localhost:3000/mcp",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "create_campaign",
      "arguments": {
        "name": "Automated Campaign",
        "from_email": "sender@example.com",
        "subject": "Automated Email Subject",
        "body": "This is an automated email campaign created via n8n.",
        "track_opens": true,
        "track_clicks": true
      }
    }
  }
}
```

#### **Get Campaign Analytics Node**
```json
{
  "node": "HTTP Request",
  "method": "POST",
  "url": "http://localhost:3000/mcp",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "get_campaign_analytics",
      "arguments": {
        "campaign_id": "{{ $json.campaign.id }}"
      }
    }
  }
}
```

### **Step 3: Handle Responses**

#### **Success Response Format**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"data\":[...],\"total_retrieved\":398,\"success\":true}"
      }
    ]
  }
}
```

#### **Error Response Format**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "Internal server error"
  }
}
```

---

## **📊 Available Tools for n8n**

All tools available in stdio mode are also available in n8n mode:

### **Account Management**
- `list_accounts` - Get all email accounts (398 accounts with bulletproof pagination)

### **Campaign Management**
- `create_campaign` - Create new email campaigns
- `list_campaigns` - List all campaigns with filtering
- `get_campaign_analytics` - Get detailed campaign performance

### **Email Operations**
- `verify_email` - Verify email addresses for deliverability

### **More Tools Available**
The server includes 22+ tools total. Use the `tools/list` method to see all available tools:

```json
{
  "jsonrpc": "2.0",
  "id": 0,
  "method": "tools/list",
  "params": {}
}
```

---

## **🔍 Testing & Troubleshooting**

### **Test Health Endpoint**
```bash
curl http://localhost:3000/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "instantly-mcp",
  "mode": "n8n",
  "tools": 5,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### **Test MCP Endpoint**
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
```

### **Common Issues**

#### **Port Already in Use**
```bash
# Change port
export PORT=3001
npm run start:n8n
```

#### **API Key Not Set**
```bash
# Set API key
export INSTANTLY_API_KEY="your-api-key-here"
npm run start:n8n
```

#### **CORS Issues**
The server includes CORS headers for web-based clients. If you encounter CORS issues, the server logs will show the specific error.

---

## **🎯 Success Criteria**

### **✅ Core Functionality (stdio mode)**
- ✅ list_accounts returns 398 accounts (not 0, not 109)
- ✅ All 5+ tools work correctly
- ✅ Compatible with Claude Desktop, Cursor IDE
- ✅ Clean error handling and validation

### **✅ n8n Integration (HTTP mode)**
- ✅ --n8n flag enables HTTP transport
- ✅ Same functionality as stdio mode
- ✅ Easy n8n workflow integration
- ✅ Health check endpoint available
- ✅ Proper JSON-RPC 2.0 responses

### **🚀 Benefits**
- **AI Assistants:** Instantly tools accessible in Claude Desktop, Cursor IDE
- **Automation:** Instantly tools accessible in n8n workflows
- **Simple:** Single codebase, two transport modes
- **Reliable:** Bulletproof pagination, comprehensive validation
- **Maintainable:** Focused implementation, clear separation of concerns

---

## **📚 Next Steps**

1. **Test stdio mode** with Claude Desktop (should return 398 accounts)
2. **Test n8n mode** with the provided workflow examples
3. **Create custom n8n workflows** using the available tools
4. **Monitor performance** and add more tools as needed

The implementation successfully provides both AI assistant integration and automation platform support with minimal complexity and maximum reliability.
