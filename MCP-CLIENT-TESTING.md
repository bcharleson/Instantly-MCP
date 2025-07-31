# 🔌 **MCP CLIENT TESTING GUIDE**
## Testing Instantly MCP Server with Various Clients

This guide helps you test the streaming HTTP transport with different MCP clients before the instantly.ai integration.

---

## 🖥️ **CLAUDE DESKTOP TESTING**

### **Method 1: Local NPM Package (Stdio)**
This tests the existing stdio transport to ensure backward compatibility.

**Configuration File**: `~/.claude/claude_desktop_config.json`
```json
{
  "mcpServers": {
    "instantly-local": {
      "command": "npx",
      "args": ["instantly-mcp"],
      "env": {
        "INSTANTLY_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

**Test Steps**:
1. Restart Claude Desktop
2. Look for "Instantly MCP" in the tools list
3. Try running: "List my email campaigns"
4. Verify all 22 tools are available

### **Method 2: Remote HTTP Endpoint (New)**
This tests the new streaming HTTP transport.

**Note**: Claude Desktop doesn't natively support HTTP MCP servers yet, but you can test the endpoint directly.

**Test Script**: `test-claude-http.js`
```javascript
const https = require('https');

const testClaudeHTTP = async () => {
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  };

  const options = {
    hostname: 'your-staging-url.railway.app',
    port: 443,
    path: '/mcp',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'your_api_key'
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log('Claude HTTP Test Result:', JSON.parse(data));
    });
  });

  req.write(JSON.stringify(request));
  req.end();
};

testClaudeHTTP();
```

---

## 🎯 **CURSOR IDE TESTING**

### **Method 1: Local Package (Stdio)**
**Configuration**: Add to Cursor settings (`Cmd+,` → Extensions → MCP)
```json
{
  "mcp.servers": {
    "instantly-local": {
      "command": "npx",
      "args": ["instantly-mcp"],
      "env": {
        "INSTANTLY_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

**Test Steps**:
1. Restart Cursor IDE
2. Open command palette (`Cmd+Shift+P`)
3. Search for "MCP" commands
4. Test: "List email campaigns using Instantly"

### **Method 2: Remote HTTP (Future)**
Cursor IDE will support HTTP MCP servers in future versions. For now, test the endpoint directly.

---

## 🤖 **N8N AUTOMATION TESTING**

### **HTTP Request Node Configuration**

**Create New Workflow**:
1. Add "HTTP Request" node
2. Configure as follows:

```json
{
  "method": "POST",
  "url": "https://your-staging-url.railway.app/mcp",
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
      "arguments": {
        "get_all": true
      }
    }
  }
}
```

### **Test Workflows**

#### **Workflow 1: List Campaigns**
```json
{
  "nodes": [
    {
      "name": "Get Campaigns",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://your-staging-url.railway.app/mcp",
        "method": "POST",
        "headers": {
          "Content-Type": "application/json",
          "x-api-key": "={{$env.INSTANTLY_API_KEY}}"
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

#### **Workflow 2: Create and Manage Lead**
```json
{
  "nodes": [
    {
      "name": "Create Lead",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://your-staging-url.railway.app/mcp",
        "method": "POST",
        "headers": {
          "Content-Type": "application/json",
          "x-api-key": "={{$env.INSTANTLY_API_KEY}}"
        },
        "body": {
          "jsonrpc": "2.0",
          "id": 2,
          "method": "tools/call",
          "params": {
            "name": "create_lead",
            "arguments": {
              "email": "test@example.com",
              "firstName": "Test",
              "lastName": "User",
              "campaignId": "campaign_id_here"
            }
          }
        }
      }
    }
  ]
}
```

---

## 🌐 **BROWSER-BASED TESTING**

### **JavaScript Fetch API**
```javascript
// Test in browser console
const testMCPEndpoint = async () => {
  try {
    const response = await fetch('https://your-staging-url.railway.app/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'your_api_key_here'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      })
    });
    
    const data = await response.json();
    console.log('MCP Response:', data);
  } catch (error) {
    console.error('Error:', error);
  }
};

testMCPEndpoint();
```

### **Postman Collection**
Import this collection for comprehensive testing:

```json
{
  "info": {
    "name": "Instantly MCP Server Tests",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "base_url",
      "value": "https://your-staging-url.railway.app"
    },
    {
      "key": "api_key",
      "value": "your_api_key_here"
    }
  ],
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "header": [],
        "url": "{{base_url}}/health"
      }
    },
    {
      "name": "Server Info",
      "request": {
        "method": "GET",
        "header": [],
        "url": "{{base_url}}/info"
      }
    },
    {
      "name": "List Tools",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "x-api-key",
            "value": "{{api_key}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"jsonrpc\": \"2.0\",\n  \"id\": 1,\n  \"method\": \"tools/list\",\n  \"params\": {}\n}"
        },
        "url": "{{base_url}}/mcp"
      }
    },
    {
      "name": "List Campaigns",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "x-api-key",
            "value": "{{api_key}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"jsonrpc\": \"2.0\",\n  \"id\": 2,\n  \"method\": \"tools/call\",\n  \"params\": {\n    \"name\": \"list_campaigns\",\n    \"arguments\": {\"get_all\": true}\n  }\n}"
        },
        "url": "{{base_url}}/mcp"
      }
    }
  ]
}
```

---

## 🧪 **AUTOMATED CLIENT TESTING**

### **Test Script for All Clients**
```bash
#!/bin/bash

# test-all-clients.sh
STAGING_URL="https://your-staging-url.railway.app"
API_KEY="your_api_key_here"

echo "🧪 Testing MCP Client Compatibility"
echo "=================================="

# Test 1: Direct HTTP endpoint
echo "📡 Testing direct HTTP endpoint..."
curl -X POST $STAGING_URL/mcp \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | jq '.result.tools | length'

# Test 2: CORS preflight
echo "🌐 Testing CORS..."
curl -X OPTIONS $STAGING_URL/mcp \
  -H "Origin: https://claude.ai" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: x-api-key" \
  -v

# Test 3: Authentication
echo "🔐 Testing authentication..."
curl -X POST $STAGING_URL/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | jq '.error.code'

echo "✅ Client compatibility tests complete"
```

---

## 📋 **CLIENT TEST CHECKLIST**

### **Before Testing**
- [ ] Staging environment deployed
- [ ] API key configured
- [ ] Health check passing
- [ ] All 22 tools available

### **Claude Desktop**
- [ ] Local stdio mode works (backward compatibility)
- [ ] Can list tools
- [ ] Can execute campaigns tool
- [ ] Can execute accounts tool
- [ ] All 22 tools accessible

### **Cursor IDE**
- [ ] MCP server loads correctly
- [ ] Tools appear in command palette
- [ ] Can execute tools via commands
- [ ] Code completion works with tool results

### **n8n Automation**
- [ ] HTTP request node configured
- [ ] Can call tools/list
- [ ] Can execute individual tools
- [ ] Error handling works
- [ ] Workflow automation successful

### **Browser/API Clients**
- [ ] CORS headers working
- [ ] Authentication required
- [ ] JSON-RPC format correct
- [ ] All endpoints accessible

---

## 🎯 **SUCCESS CRITERIA**

### **All Clients Should**
- ✅ Connect to staging endpoint
- ✅ Authenticate with API key
- ✅ List all 22 tools
- ✅ Execute tools successfully
- ✅ Handle errors gracefully
- ✅ Maintain session state

### **Performance Expectations**
- ✅ Response time < 2 seconds
- ✅ No connection timeouts
- ✅ Stable under load
- ✅ Memory usage reasonable

**Once all client tests pass, the implementation is ready for instantly.ai production deployment!** 🚀
