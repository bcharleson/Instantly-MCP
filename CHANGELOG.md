# Changelog

All notable changes to the Instantly MCP Server project.

## [1.1.1] - 2025-10-12

### 🎉 Major Refactoring: Modular Architecture

#### Complete Codebase Restructuring
- **Modular architecture** - Refactored monolithic 4,636-line index.ts into 34 modular files
- **95% reduction** in main file size (4,636 → 163 lines)
- **6 architectural layers** - Tool definitions, handlers, services, API client, utilities, configuration
- **Zero regressions** - All 32 tools tested and validated
- **Production-ready** - Deployed and validated on personal DigitalOcean instance

#### Tool Organization
- **32 tools** across 5 categories:
  - Account Management: 11 tools
  - Campaign Management: 6 tools
  - Lead Management: 8 tools
  - Email Management: 4 tools
  - Analytics & Reporting: 3 tools

#### Pagination Verification
- **All 5 list endpoints** tested with 3-page verification:
  - ✅ list_accounts - Cursor-based pagination working
  - ✅ list_campaigns - Cursor-based pagination working
  - ✅ list_leads - Cursor-based pagination working
  - ✅ list_emails - Cursor-based pagination working
  - ✅ list_lead_lists - Cursor-based pagination working

### 🧹 Codebase Cleanup

#### Obsolete Files Removed (763 KB)
- **Backup files** (740 KB):
  - src/index-old-backup.ts (232 KB)
  - dist/index-old-backup.* (508 KB)
- **Obsolete utility files** (23 KB):
  - src/api-fixes.ts
  - src/endpoint-analysis.ts
  - src/enhanced-tools.ts
  - src/transport-manager.ts (superseded by transport-manager-new.ts)
  - src/pagination-config.ts

All files verified as not imported in codebase before deletion.

### 📝 New Modular Structure

```
src/
├── tools/              # Tool definitions (1,095 lines, 6 files)
│   ├── account-tools.ts
│   ├── campaign-tools.ts
│   ├── lead-tools.ts
│   ├── email-tools.ts
│   ├── analytics-tools.ts
│   └── index.ts
├── handlers/           # Tool execution logic (1,913 lines, 2 files)
│   ├── tool-executor.ts
│   └── mcp-handlers.ts
├── services/           # Business logic (906 lines, 3 files)
│   ├── account-service.ts
│   ├── campaign-service.ts
│   └── lead-service.ts
├── utils/              # Utilities (630 lines, 3 files)
│   ├── html-formatter.ts
│   ├── parameter-cleaner.ts
│   └── smart-defaults.ts
├── api/                # API client layer (236 lines, 2 files)
│   ├── client.ts
│   └── endpoints.ts
├── config/             # Configuration (151 lines, 2 files)
│   ├── constants.ts
│   └── server-config.ts
└── index.ts            # Main server (163 lines)
```

### ✅ Testing & Validation

#### Comprehensive Tool Testing
- **All 32 tools** tested and validated (October 12, 2025)
- **Read-only operations** tested without confirmation
- **Write operations** tested with explicit user confirmation
- **Reversible operations** tested with state capture and restoration

#### Build Verification
- ✅ TypeScript compilation successful
- ✅ Zero errors, zero warnings
- ✅ All imports resolved correctly
- ✅ Server starts without errors

### 📊 Metrics

| Metric | Before (v1.0) | After (v1.1) | Improvement |
|--------|---------------|--------------|-------------|
| Main file size | 4,636 lines | 163 lines | **95% reduction** |
| File count | 7 files | 34 files | **386% increase in modularity** |
| Average file size | 1,112 lines | 311 lines | **72% reduction** |
| Largest file | 4,636 lines | 1,913 lines | **59% reduction** |

### 🚀 Deployment

- **Personal DigitalOcean**: instantly-mcp-iyjln.ondigitalocean.app (validated)
- **Production URL**: https://mcp.instantly.ai (pending deployment)
- **Build time**: ~2-3 minutes
- **Health check**: Working correctly

---

## [1.1.0] - 2025-10-03

### 🎉 Major Features

#### Intelligent Client Detection & Timeout Protection
- **Automatic client detection** from MCP initialize request and User-Agent headers
- **Dynamic timeout configuration** based on detected client:
  - **Gemini CLI**: 20s timeout, 3 max pages (strict 30s limit)
  - **ChatGPT Desktop**: 30s timeout, 5 max pages (moderate 45s limit)
  - **Claude Desktop/Mobile**: 45s timeout, 10 max pages (generous 60s limit)
  - **Unknown clients**: 20s timeout, 3 max pages (safest default)
- **Graceful partial results** with continuation cursors when approaching timeout
- **Zero configuration required** - works automatically for all clients

#### Comprehensive CLI Testing Suite
- **quick-test.sh**: Fast validation of core functionality (~30s)
- **test-mcp-endpoints.sh**: Full endpoint coverage (~60s)
- **stress-test-pagination.sh**: Load testing and edge cases (~90s)
- **TESTING.md**: Complete testing documentation
- **CI/CD ready**: All scripts return proper exit codes

### 🐛 Bug Fixes

#### Gemini CLI Timeout Issue (MCP Error -32001)
- **Problem**: Gemini CLI has strict 30-second timeout, server was using 60s
- **Solution**: Client detection automatically applies 20s timeout for Gemini
- **Result**: ✅ Gemini CLI now works without timeouts

#### Claude Desktop Accept Header Issue
- **Problem**: Claude Desktop BETA connector doesn't send Accept header
- **Solution**: Middleware injects `Accept: application/json, text/event-stream` if missing
- **Result**: ✅ Claude Mobile works, Claude Desktop pending service restoration

### 📝 Files Added

```
src/client-detection.ts          # Client detection and timeout configuration
quick-test.sh                    # Fast CLI testing script
test-mcp-endpoints.sh            # Comprehensive endpoint testing
stress-test-pagination.sh        # Pagination stress testing
TESTING.md                       # Testing documentation
TIMEOUT-PROTECTION.md            # Timeout protection guide
CHANGELOG.md                     # This file
```

### 📝 Files Modified

```
src/pagination.ts                # Client-aware timeout configuration
src/index.ts                     # Capture client info during initialize
src/streaming-http-transport.ts  # Capture User-Agent for HTTP requests
```

### ✅ Compatibility Status

| Client | Status | Notes |
|--------|--------|-------|
| **Gemini CLI** | ✅ Working | Timeout protection active |
| **ChatGPT Playground** | ✅ Working | Full functionality |
| **ChatGPT Desktop** | ❌ "Connector is not safe" | OpenAI-specific validation issue |
| **Claude Mobile** | ✅ Working | Full functionality |
| **Claude Desktop** | ⏸️ Service Down | Anthropic service outage (not our issue) |
| **n8n** | ✅ Working | Full functionality |
| **MCP Inspector** | ✅ Working | Full functionality |

### 🔧 Technical Details

#### Client Detection Logic
1. Capture `clientInfo.name` from MCP `initialize` request
2. Fallback to HTTP `User-Agent` header (HTTP mode only)
3. Pattern match against known clients (Gemini, ChatGPT, Claude)
4. Apply client-specific timeout configuration
5. Unknown clients get safest default (20s timeout)

#### Timeout Protection Flow
```
1. Client connects → Detect client type
2. Apply timeout config → Set limits (20s/30s/45s)
3. Start pagination → Track elapsed time
4. Approaching limit? → Stop gracefully
5. Return partial results → Include continuation cursor
6. Client can continue → Use starting_after parameter
```

#### Pagination Metadata
```json
{
  "data": [...],
  "pagination": {
    "returned_count": 300,
    "has_more": true,
    "next_starting_after": "camp_xyz123",
    "note": "⚠️ Timeout protection: Retrieved 300 items to avoid Gemini CLI timeout. More results available. To retrieve additional items, call this tool again with starting_after=\"camp_xyz123\""
  }
}
```

### 📊 Performance Benchmarks

Expected response times (production server):

| Operation | Gemini | ChatGPT | Claude |
|-----------|--------|---------|--------|
| 10 items | 2-4s | 2-4s | 2-4s |
| 50 items | 8-15s | 10-20s | 10-25s |
| 100 items | 15-20s | 20-30s | 25-40s |

### 🚀 Deployment

- **Production URL**: `https://mcp.instantly.ai`
- **Auto-deployment**: Enabled via DigitalOcean App Platform
- **Deployment trigger**: Push to `main` branch
- **Build time**: ~2-3 minutes
- **Health check**: `https://mcp.instantly.ai/health`

### 📚 Documentation Updates

- Added **TIMEOUT-PROTECTION.md** - Complete guide to timeout protection
- Added **TESTING.md** - CLI testing guide with examples
- Updated **README.md** - Added client compatibility matrix
- Added **CHANGELOG.md** - This changelog

### 🎯 Next Steps

#### High Priority
1. **Investigate ChatGPT Desktop "Connector is not safe" error**
   - Review OpenAI's MCP specification requirements
   - Identify missing required tools or capabilities
   - Add logging to capture ChatGPT Desktop handshake details

#### Medium Priority
2. **Adaptive timeout based on actual API response times**
   - Monitor real-world API latency
   - Adjust timeouts dynamically based on performance

3. **Workspace size detection for better defaults**
   - Detect large workspaces (1000+ campaigns)
   - Automatically use smaller page sizes

#### Low Priority
4. **Performance analytics dashboard**
   - Track timeout protection activation rate
   - Monitor client distribution
   - Identify slow endpoints

5. **Automatic retry with smaller page sizes on timeout**
   - If timeout occurs, retry with reduced limit
   - Progressive reduction until success

### 🙏 Acknowledgments

- **Anthropic** - Claude Desktop MCP support
- **OpenAI** - ChatGPT MCP integration
- **Google** - Gemini CLI MCP support
- **DigitalOcean** - Hosting and deployment platform

### 📞 Support

- **GitHub**: https://github.com/Instantly-ai/instantly-mcp
- **Issues**: Report bugs and feature requests
- **Discussions**: Ask questions and share feedback

---

## [1.0.0] - 2025-09-XX

### Initial Release
- 22 Instantly.ai tools
- Dual transport (stdio + HTTP)
- Pagination support
- Rate limiting
- Error handling
- Production deployment

---

**Legend:**
- ✅ Working
- ⏸️ Pending
- ❌ Issue
- 🎉 Major Feature
- 🐛 Bug Fix
- 📝 Documentation
- 🔧 Technical
- 🚀 Deployment

