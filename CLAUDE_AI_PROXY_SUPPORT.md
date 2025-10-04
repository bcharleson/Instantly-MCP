# Claude.ai Proxy Support - Dual Protocol Implementation

## Overview

This document explains how the Instantly MCP server now supports **both** the modern Streamable HTTP protocol and the legacy SSE protocol to enable compatibility with Claude.ai's web application proxy.

## The Problem

Claude.ai's web application doesn't connect directly to MCP servers. Instead, it uses a **proxy architecture**:

```
Claude.ai Web App → Claude.ai Proxy → Your MCP Server
                    (/api/organizations/{org}/mcp/v2/bootstrap)
```

### What Claude.ai Actually Requests

When you configure a Custom Connector in Claude.ai, their backend makes this request:

```http
GET /api/organizations/{org_id}/mcp/v2/bootstrap
Accept: text/event-stream
```

**This is NOT a direct MCP protocol request!** Claude.ai's proxy:
1. Uses their own bootstrap endpoint
2. Expects an SSE (Server-Sent Events) stream
3. Goes through Cloudflare infrastructure
4. Proxies to your MCP server using the **legacy HTTP+SSE protocol (2024-11-05)**

## The Solution: Dual Protocol Support

We've implemented **dual-protocol support** in `streaming-http-transport.ts`:

### 1. **Streamable HTTP (Modern - 2025-03-26)**
- Used by Claude Desktop and direct MCP clients
- POST requests to `/mcp` or `/mcp/{apiKey}`
- Bidirectional streaming over HTTP

### 2. **HTTP+SSE (Legacy - 2024-11-05)**
- Used by Claude.ai web app proxy
- GET request to `/mcp` with `Accept: text/event-stream` → Opens SSE stream
- POST requests to `/messages?sessionId={id}` → Client-to-server messages

## Implementation Details

### Key Changes

1. **Import SSEServerTransport**
   ```typescript
   import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
   ```

2. **Track SSE Sessions**
   ```typescript
   private sseTransports = new Map<string, SSEServerTransport>();
   ```

3. **Updated GET /mcp Endpoint**
   - Detects `Accept: text/event-stream` header
   - Creates SSEServerTransport instance
   - Connects to MCP server
   - Returns SSE stream to client

4. **New POST /messages Endpoint**
   - Accepts `sessionId` query parameter
   - Routes messages to correct SSE transport
   - Handles client-to-server communication

### Protocol Detection Flow

```
GET /mcp
  ├─ Accept: text/event-stream?
  │  ├─ YES → Start SSE transport (Legacy protocol)
  │  └─ NO  → Return server info JSON
  │
POST /mcp
  └─ Use Streamable HTTP transport (Modern protocol)

POST /messages?sessionId={id}
  └─ Route to SSE transport for that session
```

## Testing the Implementation

### 1. Check Health Endpoint

```bash
curl https://instantly-mcp-5p4as.ondigitalocean.app/health
```

Expected response:
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
    "messages": "/messages (POST for SSE transport)",
    "health": "/health",
    "info": "/info",
    "ping": "/ping"
  }
}
```

### 2. Test SSE Connection

```bash
curl -N -H "Accept: text/event-stream" \
  https://instantly-mcp-5p4as.ondigitalocean.app/mcp/{YOUR_API_KEY}
```

Should return an SSE stream with session ID.

### 3. Test in Claude.ai

1. Go to Claude.ai Settings → Custom Connectors
2. Add connector with URL: `https://instantly-mcp-5p4as.ondigitalocean.app/mcp/{YOUR_API_KEY}`
3. Claude.ai's proxy should now successfully connect via SSE

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Instantly MCP Server                      │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         GET /mcp (Accept Detection)                 │    │
│  │                                                      │    │
│  │  ┌──────────────────┐    ┌──────────────────┐     │    │
│  │  │ Accept:          │    │ Accept:          │     │    │
│  │  │ text/event-stream│    │ application/json │     │    │
│  │  └────────┬─────────┘    └────────┬─────────┘     │    │
│  │           │                       │                │    │
│  │           ▼                       ▼                │    │
│  │  ┌──────────────────┐    ┌──────────────────┐     │    │
│  │  │ SSEServerTransport│    │ Return Server    │     │    │
│  │  │ (Legacy 2024-11-05)│    │ Info JSON        │     │    │
│  │  └──────────────────┘    └──────────────────┘     │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         POST /mcp (Streamable HTTP)                 │    │
│  │                                                      │    │
│  │  ┌──────────────────────────────────────────┐      │    │
│  │  │ StreamableHTTPServerTransport            │      │    │
│  │  │ (Modern 2025-03-26)                      │      │    │
│  │  └──────────────────────────────────────────┘      │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │    POST /messages?sessionId={id} (SSE Messages)     │    │
│  │                                                      │    │
│  │  ┌──────────────────────────────────────────┐      │    │
│  │  │ Route to SSEServerTransport by sessionId │      │    │
│  │  └──────────────────────────────────────────┘      │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Benefits

1. **Claude Desktop Compatibility** - Continues to work with Streamable HTTP
2. **Claude.ai Web Compatibility** - Now works with SSE proxy
3. **Backward Compatible** - Supports both old and new protocols
4. **Future Proof** - Can add more transport protocols as needed

## Next Steps

1. Wait for DigitalOcean deployment to complete (~2-3 minutes)
2. Test the `/health` endpoint to verify dual-protocol support
3. Try connecting from Claude.ai web app
4. Monitor logs for SSE connection attempts

## Troubleshooting

### If Claude.ai still can't connect:

1. **Check deployment logs**:
   ```bash
   doctl apps logs {app-id} --follow
   ```

2. **Verify SSE endpoint**:
   ```bash
   curl -N -H "Accept: text/event-stream" \
     https://instantly-mcp-5p4as.ondigitalocean.app/mcp/{API_KEY}
   ```

3. **Check for CORS issues** - SSE requires proper CORS headers

4. **Verify session management** - POST /messages must find the session

## References

- MCP Specification: https://spec.modelcontextprotocol.io/
- SSE Protocol: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
- Streamable HTTP: MCP Protocol Version 2025-03-26

