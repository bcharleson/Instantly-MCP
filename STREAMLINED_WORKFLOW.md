# Streamlined Campaign Creation Workflow

## Overview

The Instantly MCP server v3.0.0 has been streamlined to remove custom wizard tools in favor of intelligent tool descriptions that guide LLMs through the proper workflow. This approach is more maintainable, flexible, and relies on well-designed API tools rather than custom logic.

## Key Changes in v3.0.0

### ✅ **Removed**
- `campaign_creation_wizard` tool (custom workflow logic)
- Complex multi-step wizard implementation
- Custom validation and error handling

### ✅ **Enhanced**
- `list_accounts` tool with clear prerequisite guidance
- `create_campaign` tool with comprehensive parameter documentation
- Intelligent tool descriptions that prevent common errors
- Clear workflow guidance for LLMs

## Recommended Workflow

### Step 1: Check Available Sending Accounts

**Tool**: `list_accounts`

**Purpose**: Get valid email addresses for campaign creation

```json
{
  "limit": 100
}
```

**Expected Response**:
```json
{
  "data": [
    {
      "email": "sender1@company.com",
      "status": "active",
      "daily_limit": 50
    },
    {
      "email": "sender2@company.com", 
      "status": "verified",
      "daily_limit": 100
    }
  ]
}
```

### Step 2: Create Campaign with Valid Accounts

**Tool**: `create_campaign`

**Purpose**: Create email campaign using accounts from Step 1

```json
{
  "name": "Q2 2025 Outreach Campaign",
  "subject": "Quick question about {{companyName}}",
  "body": "Hi {{firstName}},\n\nI noticed {{companyName}} has been making some impressive moves lately. I'd love to learn more about your growth plans for Q2.\n\nWould you be open to a brief 15-minute call this week?\n\nBest regards,\nJohn",
  "email_list": ["sender1@company.com", "sender2@company.com"],
  
  // Optional configuration with sensible defaults
  "timezone": "America/New_York",
  "timing_from": "09:00",
  "timing_to": "17:00",
  "daily_limit": 50,
  "sequence_steps": 3,
  "step_delay_days": 3,
  "days": {
    "monday": true,
    "tuesday": true,
    "wednesday": true,
    "thursday": true,
    "friday": true,
    "saturday": false,
    "sunday": false
  }
}
```

## Tool Description Strategy

### Enhanced `list_accounts` Description

The tool description now includes:
- **Clear prerequisite role**: "PREREQUISITE FOR CAMPAIGN CREATION"
- **Explicit guidance**: "You MUST call this tool first before creating campaigns"
- **Pagination handling**: Instructions for getting all accounts
- **Error prevention**: Explains what happens if no accounts exist

### Enhanced `create_campaign` Description

The tool description now includes:
- **Critical workflow**: "Before calling this tool, you MUST first call list_accounts"
- **Parameter validation**: Clear explanations of required vs optional fields
- **Data format examples**: Proper structure for complex objects
- **Default value guidance**: Sensible defaults for all optional parameters
- **Error prevention**: Explains common failure scenarios

## Benefits of This Approach

### 🎯 **Simplicity**
- No custom workflow logic to maintain
- Standard MCP tool pattern
- Easier to debug and extend

### 🧠 **LLM-Friendly**
- Rich tool descriptions guide proper usage
- Clear prerequisite relationships
- Comprehensive parameter documentation
- Error prevention through guidance

### 🔧 **Maintainability**
- Single source of truth for each API endpoint
- No duplicate logic between wizard and direct tools
- Easier to add new features
- Standard error handling

### 📈 **Flexibility**
- LLMs can adapt the workflow as needed
- No rigid step-by-step constraints
- Can handle edge cases naturally
- Supports advanced use cases

## Testing the Streamlined Workflow

### Test 1: Basic Campaign Creation
```bash
npx instantly-mcp@3.0.0 --api-key YOUR_API_KEY

# First, get accounts
list_accounts {"limit": 100}

# Then create campaign with returned emails
create_campaign {
  "name": "Test Campaign",
  "subject": "Hello {{firstName}}",
  "body": "This is a test email.",
  "email_list": ["account@domain.com"]
}
```

### Test 2: Advanced Campaign with Sequences
```bash
# Create multi-step campaign
create_campaign {
  "name": "Advanced Outreach",
  "subject": "Partnership opportunity",
  "body": "Hi {{firstName}}, interested in exploring a partnership?",
  "email_list": ["sender@company.com"],
  "sequence_steps": 3,
  "step_delay_days": 5,
  "daily_limit": 25,
  "open_tracking": true,
  "link_tracking": true
}
```

## Migration from v2.x

### If you were using `campaign_creation_wizard`:

**Old approach (v2.x)**:
```json
// Step 1
{"step": "start"}

// Step 2  
{"step": "info_gathered", "name": "...", "subject": "...", "body": "...", "selected_email": "..."}

// Step 3
{"step": "create", ...}
```

**New approach (v3.0)**:
```json
// Step 1: Get accounts
list_accounts {"limit": 100}

// Step 2: Create campaign directly
create_campaign {
  "name": "...",
  "subject": "...", 
  "body": "...",
  "email_list": ["account1@domain.com", "account2@domain.com"]
}
```

### Benefits of Migration:
- ✅ **Fewer API calls** (2 instead of 3)
- ✅ **More flexible** (can use multiple sending accounts)
- ✅ **Better error handling** (standard MCP error responses)
- ✅ **Easier to understand** (standard tool pattern)

## Conclusion

The streamlined v3.0.0 approach provides a cleaner, more maintainable solution that leverages intelligent tool descriptions rather than custom workflow logic. This makes the MCP server more robust, easier to extend, and better aligned with MCP best practices.
