# Testing Claude.ai Connection - Step by Step Guide

## ✅ Deployment Status

**DEPLOYED AND LIVE!** 🎉

The Instantly MCP server now supports **dual-protocol** operation:
- ✅ **Streamable HTTP (2025-03-26)** - For Claude Desktop
- ✅ **HTTP+SSE (2024-11-05)** - For Claude.ai web proxy

## Current Server Status

```json
{
  "status": "healthy",
  "service": "instantly-mcp",
  "version": "1.1.0",
  "transport": "dual-protocol",
  "protocols": {
    "streamable_http": "2025-03-26",
    "sse": "2024-11-05"
  },
  "activeSessions": 0,
  "sseSessions": 0,
  "endpoints": {
    "mcp": "/mcp (GET for SSE, POST for Streamable HTTP)",
    "mcp-with-key": "/mcp/:apiKey",
    "messages": "/messages (POST for SSE transport)"
  }
}
```

## How to Test

### 1. Test Health Endpoint

```bash
curl https://instantly-mcp-5p4as.ondigitalocean.app/health | jq .
```

**Expected**: Should show `"transport": "dual-protocol"` and both protocol versions.

### 2. Test SSE Connection (What Claude.ai Uses)

```bash
curl -N -H "Accept: text/event-stream" \
  "https://instantly-mcp-5p4as.ondigitalocean.app/mcp/YOUR_INSTANTLY_API_KEY"
```

**Expected**: Should open an SSE stream and start receiving events.

**Note**: Replace `YOUR_INSTANTLY_API_KEY` with your actual Instantly.ai API key.

### 3. Test Streamable HTTP (What Claude Desktop Uses)

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2025-03-26" \
  "https://instantly-mcp-5p4as.ondigitalocean.app/mcp/YOUR_INSTANTLY_API_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

**Expected**: Should return an initialize response with server capabilities.

## Configure in Claude.ai

### Step 1: Get Your Instantly.ai API Key

1. Log into your Instantly.ai account
2. Go to Settings → API
3. Copy your API key

### Step 2: Add Custom Connector in Claude.ai

1. Go to **Claude.ai** (https://claude.ai)
2. Click your profile → **Settings**
3. Navigate to **Custom Connectors** (or **Integrations**)
4. Click **Add Connector** or **New Custom Connector**
5. Enter the following details:

   **Connector URL**:
   ```
   https://instantly-mcp-5p4as.ondigitalocean.app/mcp/YOUR_INSTANTLY_API_KEY
   ```
   
   **Name**: `Instantly Email Automation`
   
   **Description**: `Access to 34 Instantly.ai email automation tools`

6. Click **Save** or **Add**

### Step 3: Test the Connection

1. Start a new conversation in Claude.ai
2. Try asking: "What tools do you have access to?"
3. Claude should list the Instantly MCP tools
4. Try a simple command: "List my Instantly campaigns"

## What Happens Behind the Scenes

When you configure the connector in Claude.ai:

```
┌─────────────┐
│  Claude.ai  │
│  Web App    │
└──────┬──────┘
       │
       │ 1. User configures connector
       │    URL: https://instantly-mcp-5p4as.ondigitalocean.app/mcp/{API_KEY}
       │
       ▼
┌──────────────────────────────────────┐
│   Claude.ai Backend Proxy            │
│   /api/organizations/{org}/mcp/v2/   │
│   bootstrap                          │
└──────┬───────────────────────────────┘
       │
       │ 2. Proxy makes SSE request
       │    GET /mcp/{API_KEY}
       │    Accept: text/event-stream
       │
       ▼
┌──────────────────────────────────────┐
│   Instantly MCP Server               │
│   (DigitalOcean App Platform)        │
│                                      │
│   ┌────────────────────────────┐    │
│   │ GET /mcp Endpoint          │    │
│   │ - Detects SSE request      │    │
│   │ - Creates SSEServerTransport│   │
│   │ - Returns event stream     │    │
│   └────────────────────────────┘    │
│                                      │
│   ┌────────────────────────────┐    │
│   │ POST /messages Endpoint    │    │
│   │ - Receives client messages │    │
│   │ - Routes to SSE transport  │    │
│   └────────────────────────────┘    │
└──────────────────────────────────────┘
       │
       │ 3. MCP protocol communication
       │    - Initialize
       │    - List tools
       │    - Call tools
       │
       ▼
┌──────────────────────────────────────┐
│   Instantly.ai API                   │
│   https://api.instantly.ai/api/v1/   │
└──────────────────────────────────────┘
```

## Troubleshooting

### Issue: "Connection failed" in Claude.ai

**Check**:
1. Is your API key correct?
2. Is the URL exactly: `https://instantly-mcp-5p4as.ondigitalocean.app/mcp/YOUR_API_KEY`
3. Did you replace `YOUR_API_KEY` with your actual key?

**Test**:
```bash
curl https://instantly-mcp-5p4as.ondigitalocean.app/health
```

### Issue: "No tools available"

**Check**:
1. The SSE connection is established
2. The initialize handshake completed
3. Tools list was requested

**Test**:
```bash
# Test SSE connection
curl -N -H "Accept: text/event-stream" \
  "https://instantly-mcp-5p4as.ondigitalocean.app/mcp/YOUR_API_KEY"
```

### Issue: "Authentication failed"

**Check**:
1. Your Instantly.ai API key is valid
2. The API key has the necessary permissions
3. You're using the correct API key format

**Test**:
```bash
# Test your API key directly with Instantly.ai
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.instantly.ai/api/v1/account
```

## Expected Behavior

### ✅ Success Indicators

1. **Health endpoint** shows `"transport": "dual-protocol"`
2. **SSE connection** opens and stays connected
3. **Claude.ai** shows the connector as "Connected"
4. **Tools list** appears when you ask Claude
5. **Tool calls** execute successfully

### ❌ Failure Indicators

1. **Health endpoint** returns error or wrong transport
2. **SSE connection** closes immediately
3. **Claude.ai** shows "Connection failed"
4. **No tools** appear in Claude's responses
5. **Tool calls** fail with errors

## Monitoring

### Check Server Logs

If you have access to DigitalOcean:

```bash
doctl apps logs instantly-mcp-5p4as --follow
```

Look for:
- `[HTTP] 📡 SSE connection requested` - SSE connection started
- `[HTTP] ✅ SSE transport connected` - SSE transport established
- `[HTTP] 📨 POST /messages request` - Client sending messages
- `[HTTP] ✅ Message handled` - Messages processed successfully

### Monitor Active Sessions

```bash
watch -n 2 'curl -s https://instantly-mcp-5p4as.ondigitalocean.app/health | jq ".sseSessions"'
```

Should show `1` or more when Claude.ai is connected.

## Next Steps After Successful Connection

Once connected, you can use Claude.ai to:

1. **List campaigns**: "Show me all my Instantly campaigns"
2. **Get campaign stats**: "What are the stats for campaign X?"
3. **List accounts**: "List all my email accounts"
4. **Check account health**: "Check the health of account@example.com"
5. **Manage leads**: "Add a lead to campaign X"
6. **View analytics**: "Show me analytics for campaign Y"

And 28 more tools! Ask Claude: "What Instantly tools can you use?"

## Support

If you encounter issues:

1. Check this troubleshooting guide
2. Review the server logs
3. Test the endpoints manually with curl
4. Verify your API key is valid
5. Check the CLAUDE_AI_PROXY_SUPPORT.md document

## Summary

✅ **Server is deployed and running**
✅ **Dual-protocol support is active**
✅ **SSE endpoint is working**
✅ **POST /messages endpoint is ready**
✅ **Ready for Claude.ai connection**

**Your connector URL**:
```
https://instantly-mcp-5p4as.ondigitalocean.app/mcp/YOUR_INSTANTLY_API_KEY
```

Replace `YOUR_INSTANTLY_API_KEY` with your actual Instantly.ai API key and add it to Claude.ai!

