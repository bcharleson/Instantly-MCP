# Claude.ai Web App MCP Integration Guide

## 🚨 **UNDOCUMENTED BEHAVIOR - READ THIS FIRST** 🚨

This document describes the **actual, undocumented behavior** of how Claude.ai's web application connects to MCP servers via Custom Connectors. This information was discovered through reverse engineering network requests and is **NOT documented in the official MCP specification**.

**Last Updated**: October 4, 2025  
**Discovered By**: Brandon Charleson (bcharleson)  
**Context**: Implementing Instantly MCP server for Claude.ai web app

---

## Table of Contents

1. [The Problem](#the-problem)
2. [What the Documentation Says](#what-the-documentation-says)
3. [What Actually Happens](#what-actually-happens)
4. [The Solution](#the-solution)
5. [Implementation Guide](#implementation-guide)
6. [Testing & Verification](#testing--verification)
7. [Troubleshooting](#troubleshooting)
8. [Key Takeaways](#key-takeaways)

---

## The Problem

When you configure a Custom Connector in Claude.ai's web application, **it doesn't work the same way as Claude Desktop**. The connection fails with no clear error message, and the official MCP documentation doesn't explain why.

### Symptoms

- ✅ Your MCP server works perfectly with Claude Desktop
- ✅ Your server implements the Streamable HTTP protocol (2025-03-26)
- ✅ Health checks pass, endpoints respond correctly
- ❌ Claude.ai web app shows "Connection failed" or no tools available
- ❌ No clear error messages in Claude.ai UI
- ❌ Server logs show 405 errors or rejected connections

---

## What the Documentation Says

According to the [official MCP specification](https://spec.modelcontextprotocol.io/):

> **Streamable HTTP Transport (2025-03-26)**
> - Client sends POST requests to the server endpoint
> - Server responds with streaming responses
> - Bidirectional communication over HTTP

The documentation implies that **all MCP clients** (including Claude.ai web) use this modern protocol.

**This is incorrect for Claude.ai's web application.**

---

## What Actually Happens

### Claude.ai Web App Architecture

Claude.ai's web application **does NOT connect directly to your MCP server**. Instead, it uses a **proxy architecture**:

```
┌─────────────────┐
│   Claude.ai     │
│   Web App       │
│   (Browser)     │
└────────┬────────┘
         │
         │ User configures Custom Connector
         │ URL: https://your-server.com/mcp/{API_KEY}
         │
         ▼
┌─────────────────────────────────────────────┐
│   Claude.ai Backend Proxy                   │
│   https://claude.ai/api/organizations/      │
│   {org_id}/mcp/v2/bootstrap                 │
└────────┬────────────────────────────────────┘
         │
         │ ⚠️ CRITICAL: Proxy uses DIFFERENT protocol!
         │
         ▼
┌─────────────────────────────────────────────┐
│   Your MCP Server                           │
│   https://your-server.com/mcp/{API_KEY}     │
└─────────────────────────────────────────────┘
```

### The Actual Request

When Claude.ai's proxy connects to your server, it makes this request:

```http
GET /mcp/{apiKey}
Host: your-server.com
Accept: text/event-stream
Accept-Encoding: gzip, deflate, br, zstd
Accept-Language: en-US,en;q=0.9,ar;q=0.8
Cache-Control: no-cache
Priority: u=1, i
Sec-Ch-Ua: "Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"
Sec-Ch-Ua-Mobile: 20
Sec-Ch-Ua-Platform: "macOS"
Sec-Fetch-Dest: empty
Sec-Fetch-Mode: cors
Sec-Fetch-Site: same-origin
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...
```

**Key observation**: `Accept: text/event-stream`

This is **NOT** a Streamable HTTP request. This is a **Server-Sent Events (SSE)** request!

### The Protocol Claude.ai Actually Uses

Claude.ai's proxy expects your server to implement the **legacy HTTP+SSE protocol (2024-11-05)**:

1. **GET request with `Accept: text/event-stream`** → Server opens an SSE stream
2. **POST to `/messages?sessionId={id}`** → Client sends messages to server
3. **SSE events** → Server sends messages to client

This is the **old MCP protocol** that was used before Streamable HTTP was introduced.

---

## The Solution

Your MCP server must support **BOTH protocols simultaneously**:

1. **Streamable HTTP (2025-03-26)** - For Claude Desktop and modern clients
2. **HTTP+SSE (2024-11-05)** - For Claude.ai web app proxy

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Your MCP Server                          │
│                                                             │
│  GET /mcp                                                   │
│    ├─ Accept: text/event-stream?                           │
│    │   ├─ YES → Start SSE transport (for Claude.ai)        │
│    │   └─ NO  → Return server info JSON                    │
│    │                                                        │
│  POST /mcp                                                  │
│    └─ Use Streamable HTTP transport (for Claude Desktop)   │
│                                                             │
│  POST /messages?sessionId={id}                             │
│    └─ Route to SSE transport (for Claude.ai)               │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Guide

### Prerequisites

```bash
npm install @modelcontextprotocol/sdk
```

### Step 1: Import Both Transports

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
```

### Step 2: Track Both Transport Types

```typescript
class YourMCPServer {
  private server: Server;
  private app: express.Application;
  
  // Track Streamable HTTP sessions (Claude Desktop)
  private streamableTransports = new Map<string, StreamableHTTPServerTransport>();
  
  // Track SSE sessions (Claude.ai web)
  private sseTransports = new Map<string, SSEServerTransport>();
  
  constructor(server: Server) {
    this.server = server;
    this.app = express();
    this.setupRoutes();
  }
}
```

### Step 3: Implement Dual-Protocol GET Endpoint

```typescript
setupRoutes() {
  // GET endpoint - detects protocol based on Accept header
  this.app.get('/mcp/:apiKey?', async (req, res) => {
    const apiKey = req.params.apiKey;
    const acceptHeader = req.headers.accept || '';
    
    console.log(`GET /mcp - Accept: ${acceptHeader}`);
    
    // Check if client wants SSE (Claude.ai web app)
    if (acceptHeader.includes('text/event-stream')) {
      console.log('SSE connection requested - starting SSE transport');
      
      try {
        // Create SSE transport
        const transport = new SSEServerTransport('/messages', res);
        this.sseTransports.set(transport.sessionId, transport);
        
        // Clean up on disconnect
        res.on('close', () => {
          console.log(`SSE connection closed: ${transport.sessionId}`);
          this.sseTransports.delete(transport.sessionId);
        });

        // Connect to MCP server
        await this.server.connect(transport);
        console.log(`SSE transport connected: ${transport.sessionId}`);
      } catch (error) {
        console.error('Failed to establish SSE connection:', error);
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to establish SSE connection'
          });
        }
      }
      return;
    }
    
    // Otherwise, return server info
    res.json({
      server: 'your-mcp-server',
      version: '1.0.0',
      transport: 'dual-protocol',
      protocols: {
        streamable_http: '2025-03-26',
        sse: '2024-11-05'
      },
      endpoints: {
        mcp_post: '/mcp',
        messages_post: '/messages',
        health: '/health'
      }
    });
  });
}
```

### Step 4: Implement POST /messages Endpoint

```typescript
setupRoutes() {
  // ... GET endpoint from above ...
  
  // POST /messages - for SSE transport client-to-server messages
  this.app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId as string;
    
    console.log(`POST /messages - Session: ${sessionId}`);
    
    if (!sessionId) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: sessionId query parameter required'
        },
        id: null
      });
    }
    
    const transport = this.sseTransports.get(sessionId);
    
    if (!transport) {
      console.error(`No SSE transport found for session ${sessionId}`);
      return res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: Invalid session or session expired'
        },
        id: null
      });
    }
    
    try {
      await transport.handlePostMessage(req, res, req.body);
      console.log(`Message handled for session ${sessionId}`);
    } catch (error) {
      console.error(`Error handling message:`, error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error processing message'
          },
          id: null
        });
      }
    }
  });
}
```

### Step 5: Implement POST /mcp for Streamable HTTP

```typescript
setupRoutes() {
  // ... GET and POST /messages from above ...
  
  // POST /mcp - for Streamable HTTP transport (Claude Desktop)
  this.app.post('/mcp/:apiKey?', async (req, res) => {
    const apiKey = req.params.apiKey;
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    
    console.log(`POST /mcp - Session: ${sessionId || 'new'}`);
    
    let transport: StreamableHTTPServerTransport;
    
    if (sessionId && this.streamableTransports.has(sessionId)) {
      // Reuse existing transport
      transport = this.streamableTransports.get(sessionId)!;
    } else {
      // Create new transport
      transport = new StreamableHTTPServerTransport(req, res);
      this.streamableTransports.set(transport.sessionId, transport);
      
      // Clean up on disconnect
      res.on('close', () => {
        console.log(`Streamable HTTP connection closed: ${transport.sessionId}`);
        this.streamableTransports.delete(transport.sessionId);
      });
      
      // Connect to MCP server
      await this.server.connect(transport);
      console.log(`Streamable HTTP transport connected: ${transport.sessionId}`);
    }
  });
}
```

### Step 6: Add Health Check

```typescript
setupRoutes() {
  // ... other endpoints from above ...
  
  this.app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'your-mcp-server',
      version: '1.0.0',
      transport: 'dual-protocol',
      protocols: {
        streamable_http: '2025-03-26',
        sse: '2024-11-05'
      },
      activeSessions: {
        streamable: this.streamableTransports.size,
        sse: this.sseTransports.size
      },
      endpoints: {
        mcp: '/mcp (GET for SSE, POST for Streamable HTTP)',
        messages: '/messages (POST for SSE transport)',
        health: '/health'
      }
    });
  });
}
```

---

## Testing & Verification

### 1. Test Health Endpoint

```bash
curl https://your-server.com/health | jq .
```

**Expected output**:
```json
{
  "status": "healthy",
  "transport": "dual-protocol",
  "protocols": {
    "streamable_http": "2025-03-26",
    "sse": "2024-11-05"
  }
}
```

### 2. Test SSE Connection (Claude.ai Protocol)

```bash
curl -N -H "Accept: text/event-stream" \
  "https://your-server.com/mcp/YOUR_API_KEY"
```

**Expected**: Should open an SSE stream and start receiving events.

### 3. Test Streamable HTTP (Claude Desktop Protocol)

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2025-03-26" \
  "https://your-server.com/mcp/YOUR_API_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

**Expected**: Should return an initialize response.

### 4. Configure in Claude.ai

1. Go to Claude.ai → Settings → Custom Connectors
2. Add connector with URL: `https://your-server.com/mcp/YOUR_API_KEY`
3. Save and test in a conversation

---

## Troubleshooting

### Issue: "Connection failed" in Claude.ai

**Cause**: Server is rejecting SSE connections or missing POST /messages endpoint

**Fix**: Ensure GET /mcp accepts `Accept: text/event-stream` and POST /messages exists

**Verify**:
```bash
curl -N -H "Accept: text/event-stream" "https://your-server.com/mcp/YOUR_API_KEY"
```

### Issue: 405 Method Not Allowed

**Cause**: Server is explicitly rejecting SSE requests

**Fix**: Remove any code that returns 405 for SSE requests

**Before** (WRONG):
```typescript
if (acceptHeader.includes('text/event-stream')) {
  res.status(405).json({ error: 'SSE not supported' }); // ❌ DON'T DO THIS
}
```

**After** (CORRECT):
```typescript
if (acceptHeader.includes('text/event-stream')) {
  const transport = new SSEServerTransport('/messages', res); // ✅ DO THIS
  await this.server.connect(transport);
}
```

### Issue: Session not found in POST /messages

**Cause**: SSE transport not being stored or session ID mismatch

**Fix**: Ensure you're storing the transport with its sessionId:
```typescript
this.sseTransports.set(transport.sessionId, transport);
```

### Issue: Works in Claude Desktop but not Claude.ai

**Cause**: Only Streamable HTTP is implemented, SSE is missing

**Fix**: Implement dual-protocol support as shown in this guide

---

## Key Takeaways

### ✅ **DO**

1. **Support BOTH protocols** - Streamable HTTP AND HTTP+SSE
2. **Detect protocol** based on `Accept` header
3. **Implement POST /messages** for SSE transport
4. **Track both transport types** separately
5. **Test with both clients** - Claude Desktop AND Claude.ai web

### ❌ **DON'T**

1. **Don't assume** all MCP clients use Streamable HTTP
2. **Don't reject** SSE requests with 405 errors
3. **Don't rely** solely on official documentation
4. **Don't forget** the POST /messages endpoint
5. **Don't mix** transport types for the same session

### 🔑 **Critical Points**

1. **Claude.ai web app uses a proxy** - not direct connection
2. **The proxy uses SSE protocol** - not Streamable HTTP
3. **This is undocumented** - discovered through reverse engineering
4. **Both protocols are required** - for full compatibility
5. **Session management is separate** - different Maps for each protocol

---

## References

- **MCP Specification**: https://spec.modelcontextprotocol.io/
- **MCP SDK**: https://github.com/modelcontextprotocol/sdk
- **SSE Specification**: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
- **This Implementation**: https://github.com/Instantly-ai/instantly-mcp

---

## Contributing

If you discover additional undocumented behavior or have improvements to this guide, please:

1. Test thoroughly with both Claude Desktop and Claude.ai web
2. Document your findings with network traces
3. Submit a pull request or issue

---

## License

This documentation is provided as-is for the benefit of the MCP developer community.

---

**Last Updated**: October 4, 2025  
**Maintainer**: Brandon Charleson (@bcharleson)  
**Status**: Production-tested with Instantly MCP server

