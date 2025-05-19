# Instantly MCP Integration Bug Report

## Executive Summary

Testing of the Instantly MCP integration revealed several inconsistencies in API behavior. While some endpoints return valid data (campaigns analytics, API keys), critical functionalities like account listing show empty results despite evidence of active accounts in the system (221,129 emails sent according to analytics). These findings suggest issues with API version compatibility, permission scopes, or endpoint configuration.

## Test Results Summary

| Tool/Endpoint | Status | Error/Issue |
|---------------|--------|-------------|
| list_campaigns | ✅ Working (Empty) | No campaigns found |
| list_accounts | ❌ Issue | Returns empty while 398 accounts should exist |
| create_account | ❌ Error | 400: Bad Request |
| create_campaign | ❌ Error | 400: Bad Request (missing valid account) |
| create_lead_list | ❌ Error | Resource not found |
| create_lead | ✅ Success | Created successfully |
| list_leads | ❌ Error | Resource not found |
| verify_email | ❌ Error | Resource not found |
| list_api_keys | ✅ Success | Returns multiple API keys |
| create_api_key | ✅ Success | Created successfully |
| send_email | ❌ Error | Resource not found |
| list_emails | ✅ Working (Empty) | No emails found |
| get_campaign_analytics_overview | ✅ Success | Returns analytics data |

## Detailed Analysis

### API Inconsistency Evidence

The most notable inconsistency is between the account listing and analytics data:

- `list_accounts` returns an empty dataset:
```json
{
  "data": [],
  "total": 0,
  "page": 1,
  "limit": 0,
  "hasMore": false
}
```

- `get_campaign_analytics_overview` shows substantial activity:
```json
{
  "open_count": 0,
  "open_count_unique": 0,
  "open_count_unique_by_step": 0,
  "link_click_count": 0,
  "link_click_count_unique": 0,
  "link_click_count_unique_by_step": 0,
  "reply_count": 2693,
  "reply_count_unique": 2692,
  "reply_count_unique_by_step": 2696,
  "bounced_count": 5417,
  "unsubscribed_count": 0,
  "emails_sent_count": 221129,
  "new_leads_contacted_count": 118100,
  "total_opportunities": 743,
  "total_opportunity_value": 743000,
  "total_interested": 757,
  "total_meeting_booked": 0,
  "total_meeting_completed": 0,
  "total_closed": 0
}
```

### API Documentation Findings

1. The Instantly API has two versions, with v1 being deprecated (planned for 2025):
   - Current integration may be using a mix of v1 and v2 endpoints

2. API documentation indicates proper endpoint for accounts should be:
   - `https://api.instantly.ai/api/v2/accounts` (v2)
   - The MCP integration might be using a different path

3. API Keys require specific permission scopes:
   - The current API key might lack `accounts:read` or `all:read` scopes

## Failed API Calls

### Create Account
```
Error executing code: MCP error -32603: MCP error -32603: Instantly API error (400): Bad Request
```

### List Leads
```
Error executing code: MCP error -32600: MCP error -32600: Resource not found: Not Found
```

### Verify Email
```
Error executing code: MCP error -32600: MCP error -32600: Resource not found: Not Found
```

### Send Email
```
Error executing code: MCP error -32600: MCP error -32600: Resource not found: Not Found
```

## Successful API Calls

### Create Lead
```json
{
  "id": "ba43e512-64aa-4f42-8bbf-316f29f37285",
  "timestamp_created": "2025-05-18T20:38:56.237Z",
  "timestamp_updated": "2025-05-18T20:38:56.237Z",
  "organization": "57741156-a053-445d-9ffe-b507e1c2eb68",
  "status": 1,
  "email_open_count": 0,
  "email_reply_count": 0,
  "email_click_count": 0,
  "company_domain": "example.com",
  "status_summary": {},
  "email": "lead@example.com",
  "personalization": "",
  "website": "",
  "last_name": "Doe",
  "first_name": "John",
  "company_name": "",
  "payload": {
    "firstName": "John",
    "lastName": "Doe",
    "companyName": "",
    "website": "",
    "personalization": "",
    "email": "lead@example.com"
  },
  "upload_method": "api"
}
```

### List API Keys
```json
{
  "items": [
    {
      "id": "70d80f3f-3585-441c-8ef6-158149182cc4",
      "name": "Test API Key",
      "scopes": [
        "all:read"
      ],
      "key": "",
      "organization_id": "57741156-a053-445d-9ffe-b507e1c2eb68",
      "timestamp_created": "2025-05-18T20:26:57.056Z",
      "timestamp_updated": "2025-05-18T20:26:57.056Z"
    },
    {
      "id": "2c02e8c7-f3a7-4a6c-b1b5-158c4f32d7a2",
      "name": "mcp2.0",
      "scopes": [
        "all:all"
      ],
      "key": "",
      "organization_id": "57741156-a053-445d-9ffe-b507e1c2eb68",
      "timestamp_created": "2025-05-18T20:17:08.424Z",
      "timestamp_updated": "2025-05-18T20:17:08.424Z"
    },
    {
      "id": "c1a4b318-ab50-4ab7-9c01-c9519b896359",
      "name": "n8n community node",
      "scopes": [
        "all:all"
      ],
      "key": "",
      "organization_id": "57741156-a053-445d-9ffe-b507e1c2eb68",
      "timestamp_created": "2025-04-15T23:25:23.512Z",
      "timestamp_updated": "2025-04-15T23:25:23.51