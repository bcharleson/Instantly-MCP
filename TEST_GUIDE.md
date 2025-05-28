# Instantly MCP Server Test Guide

## Automated Test Suite

The `test-mcp-endpoints.ts` script provides comprehensive automated testing for all 25+ API endpoints in the Instantly MCP server.

## Quick Start

### 1. Build and Test (Recommended)
```bash
npm run test:endpoints -- --api-key YOUR_INSTANTLY_API_KEY
```

### 2. Quick Test (Skip Build)
```bash
npm run test:quick -- --api-key YOUR_INSTANTLY_API_KEY
```

### 3. Direct Execution
```bash
tsx test-mcp-endpoints.ts --api-key YOUR_INSTANTLY_API_KEY
```

## What Gets Tested

### ✅ Fixed Endpoints (Priority Testing)
- **create_campaign** - Now uses `email_list` array instead of `from_email`
- **list_leads** - Fixed to use `GET /leads` instead of `POST /lead/list`
- **verify_email** - Fixed to use `/email-verification` endpoint
- **get_warmup_analytics** - Fixed endpoint path

### 📋 All Test Categories
1. **Campaign Management** (5 tests)
   - List campaigns with filters
   - Create campaigns with proper validation
   - Test invalid inputs (expected failures)

2. **Analytics** (2 tests)
   - Campaign analytics overview
   - Detailed campaign analytics

3. **Account Management** (3 tests)
   - List sending accounts
   - Create new accounts
   - Warmup analytics

4. **Lead Management** (4 tests)
   - List leads (fixed endpoint)
   - Create leads with validation
   - Move leads between campaigns
   - Invalid email handling

5. **Lead Lists** (2 tests)
   - List all lead lists
   - Create new lead lists

6. **Email Operations** (3 tests)
   - List emails
   - Send emails
   - Email verification (fixed)

7. **API Key Management** (2 tests)
   - List API keys
   - Create new API keys

## Test Output

### Real-time Progress
```
🚀 Starting Instantly MCP Server Test Suite
🔑 Using API key: NTc3NDExNT...2eb68
⏰ Started at: 2024-01-20T10:30:00.000Z

📋 Running Campaign Management Tests
==================================================
  🧪 Testing: List all campaigns
  ✅ list_campaigns (245ms)
  🧪 Testing: Create campaign with proper email_list (FIXED)
  ❌ create_campaign (1205ms)
    💥 Error: email_list is required and must contain verified accounts
    🌐 HTTP Status: 400
```

### Comprehensive Report
```
📊 COMPREHENSIVE TEST REPORT
================================================================================

📈 SUMMARY:
  ✅ Passed: 18/25 (72.0%)
  ❌ Failed: 7/25 (28.0%)
  ⏭️  Skipped: 0/25 (0.0%)
  ⏱️  Total Duration: 12.45s
  🕐 Completed at: 2024-01-20T10:30:12.450Z

🔧 ANALYSIS OF RECENT FIXES:
----------------------------------------
  create_campaign: ✅ WORKING
  list_leads: ✅ WORKING
  verify_email: ❌ STILL BROKEN
    └─ Resource not found: Not Found
  get_warmup_analytics: ❌ STILL BROKEN
    └─ account_id is required

🌐 HTTP STATUS CODE ANALYSIS:
  400 Bad Request: 3 occurrences
  404 Not Found: 2 occurrences
  422 Unprocessable Entity: 1 occurrences

💡 RECOMMENDATIONS:
  • Review failed endpoints and check API documentation
  • Verify API key has sufficient permissions
  • Check if accounts need to be verified before use
```

## Understanding Results

### ✅ PASS
- Endpoint works correctly
- Returns expected data
- No errors encountered

### ❌ FAIL
- Endpoint returned an error
- HTTP status code indicates issue
- May need API key permissions or data setup

### ⏭️ SKIP
- Test was skipped (usually due to dependencies)
- Not counted in pass/fail statistics

## Common Issues & Solutions

### 400 Bad Request
- **create_campaign**: Ensure `email_list` contains verified sending accounts
- **create_account**: Check SMTP/IMAP settings are valid
- **Missing fields**: Review required parameters

### 401 Unauthorized
- Check API key is valid and active
- Verify API key has required scopes

### 404 Not Found
- Endpoint path may be incorrect
- Resource may not exist (expected for some tests)

### 422 Unprocessable Entity
- Data validation failed
- Check email formats, date formats, etc.

## Test Data

The script generates realistic test data:
- **Emails**: `test{timestamp}@example.com`
- **Campaigns**: `Test Campaign {timestamp}`
- **Dates**: Current year date ranges
- **Names**: Realistic first/last names

## Customization

To add new tests, edit `test-mcp-endpoints.ts`:

```typescript
{
  tool: 'your_new_endpoint',
  description: 'Test description',
  args: {
    // Your test parameters
  },
  expectedToFail: false // Set to true if test should fail
}
```

## CI/CD Integration

Exit codes:
- **0**: All tests passed
- **1**: One or more tests failed

Perfect for automated testing in CI/CD pipelines.
