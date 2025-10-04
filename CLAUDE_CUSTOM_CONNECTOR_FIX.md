# Claude.ai Custom Connector Fix - Session ID Implementation

## Problem Summary

The Instantly MCP server was failing to connect as a Custom Connector in Claude.ai browser with the error:
```
"upstream response is invalid"
```

However, the same server worked perfectly with:
- ✅ `mcp-remote` proxy (local stdio wrapper)
- ✅ Claude iOS app
- ✅ Other MCP servers (Firecrawl, HeyReach) using URL-based API keys

## Root Cause

The server was configured in **STATELESS mode** (`sessionIdGenerator: undefined`), which meant it was **NOT generating session IDs**.

According to the MCP Streamable HTTP specification (2025-03-26):
- Session IDs are OPTIONAL but have specific requirements
- If a server returns an `Mcp-Session-Id` header during initialization, clients MUST include it in all subsequent requests
- **Claude.ai browser REQUIRES session IDs** to establish Custom Connector connections

### Evidence from EventStream Analysis

Comparing working vs. failing servers:

**Firecrawl MCP (✅ Working):**
```json
{
  "connected": true,
  "tools": [{"name": "firecrawl_scrape", ...}, ...]
}
```

**HeyReach MCP (✅ Working):**
```json
{
  "connected": true,
  "tools": [{"name": "add_leads_to_campaign", ...}, ...]
}
```

**Instantly MCP (❌ Failing):**
```json
{
  "connected": false,
  "tools": [],  // ← EMPTY! No tools loaded
  "resources": [],
  "prompts": []
}
```

The connection failed during the initial handshake because no session ID was returned.

## Solution

Changed the `StreamableHTTPServerTransport` configuration from **stateless** to **stateful** mode:

### Before (Stateless - BROKEN):
```typescript
this.transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined, // ❌ Stateless mode - no session management
  enableDnsRebindingProtection: false,
  enableJsonResponse: true,
});
```

### After (Stateful - FIXED):
```typescript
this.transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(), // ✅ STATEFUL mode - generates session IDs
  enableDnsRebindingProtection: false,
  enableJsonResponse: false, // Use SSE streaming for proper MCP protocol support
});
```

## Key Changes

1. **Session ID Generation**: Added `sessionIdGenerator: () => randomUUID()`
   - Generates a unique session ID for each connection
   - Returns the session ID in the `Mcp-Session-Id` header during initialization
   - Validates session IDs on subsequent requests

2. **SSE Streaming**: Changed `enableJsonResponse: false`
   - Uses Server-Sent Events (SSE) for proper MCP protocol support
   - Matches the behavior of working servers (Firecrawl, HeyReach)

3. **Import Addition**: Added `import { randomUUID } from 'node:crypto';`

## Testing

### Local Test Results

```bash
$ curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "x-instantly-api-key: test" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }' -v 2>&1 | grep -i "mcp-session-id"

< mcp-session-id: fd8f6bdb-abea-4630-8ce8-3af6dc63ec9c
```

✅ **Session ID is now being generated and returned!**

## Expected Outcome

After deploying this fix to production (`https://mcp.instantly.ai/mcp`):

1. ✅ Claude.ai browser Custom Connector should accept the connection
2. ✅ Session ID will be returned in the `Mcp-Session-Id` header
3. ✅ Tools will be loaded and displayed in Claude.ai
4. ✅ The server will work natively without requiring `mcp-remote` proxy

## Files Modified

- `src/streaming-http-transport.ts`:
  - Added `randomUUID` import
  - Changed `sessionIdGenerator` from `undefined` to `() => randomUUID()`
  - Changed `enableJsonResponse` from `true` to `false`
  - Updated comments to explain the fix

## References

- **MCP Streamable HTTP Specification**: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports
- **Official MCP SDK Example**: `node_modules/@modelcontextprotocol/sdk/dist/esm/examples/server/sseAndStreamableHttpCompatibleServer.js`
- **Grok Analysis**: https://grok.com/share/bGVnYWN5_25c71578-76d4-42a3-a1b3-7aa3224fd69a

## Next Steps

1. ✅ Build the updated code: `npm run build`
2. ✅ Test locally to verify session ID generation
3. 🚀 Deploy to production (DigitalOcean App Platform)
4. 🧪 Test Custom Connector in Claude.ai browser
5. 📝 Update documentation if successful

## Credits

- Analysis assistance from Grok AI
- MCP SDK official examples
- EventStream debugging in Claude.ai browser DevTools

