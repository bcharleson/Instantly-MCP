# 🧪 Manual Testing Guide - Instantly MCP Server v3.0.1

## **Quick Test Execution**

### **Option 1: Automated Test Script**
```bash
# Make the script executable
chmod +x test-mcp-v3.0.1.sh

# Run comprehensive tests
./test-mcp-v3.0.1.sh YOUR_API_KEY
```

### **Option 2: Manual Step-by-Step Testing**

## **Phase 1: Setup and Connection Test**

### **Test 1.1: MCP Server Installation and Connection**
```bash
# Install/use latest version
npx instantly-mcp@3.0.1 --api-key YOUR_API_KEY

# Expected: Server starts without errors
# Look for: "Instantly MCP server running with comprehensive v2 API support..."
```

### **Test 1.2: Tool Registration Verification**
```bash
# In MCP session, list all available tools
list_tools

# Expected tools to be present:
# ✅ list_accounts
# ✅ create_campaign  
# ✅ reply_to_email (NEW - replaced send_email)
# ✅ list_campaigns
# ✅ create_lead_list
# ✅ create_lead
# ✅ get_campaign_analytics_overview
# ✅ list_api_keys
# ✅ verify_email
# ❌ send_email (should be REMOVED)
# ❌ campaign_creation_wizard (should be REMOVED)
```

**Expected Result**: ✅ All tools listed, `reply_to_email` present, `send_email` and `campaign_creation_wizard` absent

## **Phase 2: Core Functionality Tests (Previously Working)**

### **Test 2.1: List Accounts (High Warmup Scores)**
```bash
list_accounts {"limit": 100}
```

**Expected Result**: ✅ Returns 10 accounts with warmup scores 98-100
**Save Response**: Note exact email addresses for campaign creation test

### **Test 2.2: List Campaigns**
```bash
list_campaigns {"limit": 10}
```

**Expected Result**: ✅ Returns campaign list (may be empty)

### **Test 2.3: Create Lead List**
```bash
create_lead_list {"name": "MCP Test List v3.0.1"}
```

**Expected Result**: ✅ Successfully creates lead list

### **Test 2.4: Create Lead**
```bash
create_lead {
  "email": "test@example.com",
  "first_name": "Test",
  "last_name": "User", 
  "company_name": "Test Company"
}
```

**Expected Result**: ✅ Successfully creates lead

### **Test 2.5: Get Campaign Analytics Overview**
```bash
get_campaign_analytics_overview {}
```

**Expected Result**: ✅ Returns analytics (should show 12 replies, 4 opportunities)

### **Test 2.6: List API Keys**
```bash
list_api_keys {}
```

**Expected Result**: ✅ Returns 8 API keys including MCP integration

## **Phase 3: Previously Failing Endpoints (Now Fixed/Identified)**

### **Test 3.1: Create Campaign (Previously 400 Bad Request)**

**CRITICAL**: Use exact email addresses from Test 2.1 response

```bash
create_campaign {
  "name": "MCP Test Campaign v3.0.1",
  "subject": "Test email from MCP server",
  "body": "This is a test email to verify the MCP server is working correctly.",
  "email_list": ["USE_ACTUAL_EMAIL_FROM_LIST_ACCOUNTS"]
}
```

**Expected Results**:
- ✅ **SUCCESS**: Campaign created successfully
- ❌ **400 Bad Request**: API scope issue - check if API key has `campaigns:create` scope
- ❌ **Other Error**: Document exact error message

### **Test 3.2: Reply to Email (New Implementation)**

**Step 1**: Get existing emails
```bash
list_emails {"limit": 5}
```

**Step 2**: Use email ID from response
```bash
reply_to_email {
  "reply_to_uuid": "EMAIL_ID_FROM_STEP_1",
  "eaccount": "YOUR_ACCOUNT_EMAIL_FROM_LIST_ACCOUNTS",
  "subject": "Re: Test Reply",
  "body": {
    "text": "This is a test reply from MCP server v3.0.1"
  }
}
```

**Expected Results**:
- ✅ **SUCCESS**: Reply sent successfully
- ❌ **404 Not Found**: Fixed from previous version
- ❌ **Other Error**: Document exact error message

### **Test 3.3: Verify Email (Previously 403 Forbidden)**
```bash
verify_email {"email": "test@example.com"}
```

**Expected Results**:
- ✅ **SUCCESS**: Email verification completed
- ❌ **403 Forbidden**: Still requires premium plan or specific API scopes
- ❌ **Other Error**: Document exact error message

## **Phase 4: Error Handling and Edge Cases**

### **Test 4.1: Missing Required Parameters**
```bash
create_campaign {"name": "Test"}
```

**Expected Result**: ❌ Clear error message about missing required fields

### **Test 4.2: Invalid Email Addresses**
```bash
create_campaign {
  "name": "Test",
  "subject": "Test", 
  "body": "Test",
  "email_list": ["invalid-email"]
}
```

**Expected Result**: ❌ Validation error about invalid email format

### **Test 4.3: Pagination Test**
```bash
list_accounts {"limit": 5}
```

**Expected Result**: ✅ Returns 5 accounts with pagination info

## **Detailed Reporting Template**

### **Test Results Summary**

| Test | Status | Notes |
|------|--------|-------|
| 1.1 MCP Connection | ✅/❌ | |
| 1.2 Tool Registration | ✅/❌ | reply_to_email present? send_email absent? |
| 2.1 list_accounts | ✅/❌ | 10 accounts with 98-100 warmup scores? |
| 2.2 list_campaigns | ✅/❌ | |
| 2.3 create_lead_list | ✅/❌ | |
| 2.4 create_lead | ✅/❌ | |
| 2.5 analytics_overview | ✅/❌ | Shows 12 replies, 4 opportunities? |
| 2.6 list_api_keys | ✅/❌ | Shows 8 API keys? |
| 3.1 create_campaign | ✅/❌ | **CRITICAL TEST** - 400 error resolved? |
| 3.2 reply_to_email | ✅/❌ | **NEW FEATURE** - works correctly? |
| 3.3 verify_email | ✅/❌ | Still 403 or resolved? |
| 4.1 Error Handling | ✅/❌ | Clear error messages? |
| 4.2 Validation | ✅/❌ | Proper input validation? |
| 4.3 Pagination | ✅/❌ | |

### **Critical Issues to Document**

1. **create_campaign 400 Error**: 
   - Still occurring? ✅/❌
   - Exact error message: ________________
   - API key scopes verified? ✅/❌

2. **reply_to_email Implementation**:
   - Tool properly registered? ✅/❌
   - Functionality working? ✅/❌
   - Replaces send_email correctly? ✅/❌

3. **verify_email 403 Error**:
   - Still occurring? ✅/❌
   - Premium feature confirmed? ✅/❌
   - API scope issue? ✅/❌

### **Performance Observations**

- **Response Times**: Fast/Slow/Timeout
- **Error Messages**: Clear/Confusing/Missing
- **Tool Descriptions**: Helpful/Unclear
- **Workflow**: Smooth/Problematic

### **Recommendations Based on Results**

**If All Tests Pass**: ✅ MCP Server v3.0.1 is production-ready

**If create_campaign Still Fails**: 
- Check API key scopes in Instantly dashboard
- Verify account permissions
- Test with different email addresses

**If reply_to_email Fails**:
- Verify email IDs are valid
- Check account permissions
- Test with different email accounts

**If verify_email Still 403**:
- Confirm premium plan requirement
- Check API scope configuration
- Consider removing from critical workflow

## **Next Steps After Testing**

1. **Document all findings** using the template above
2. **Report specific error messages** for any failures
3. **Verify API scopes** if permission errors occur
4. **Test optimization recommendations** from TROUBLESHOOTING_GUIDE.md
5. **Scale testing** with actual campaign volumes if basic tests pass
