# 🧙‍♂️ Campaign Creation Wizard - v2.5.0

## Overview

The **Campaign Creation Wizard** is a guided workflow that prevents 400 Bad Request errors by ensuring all required information is gathered and validated before creating campaigns. It replaces the error-prone direct `create_campaign` approach with a step-by-step process.

## Why Use the Wizard?

### ❌ **Old Way (Error-Prone)**
```bash
create_campaign {
  "name": "My Campaign",
  "subject": "Hello",
  "body": "Hi there...",
  "email_list": ["unverified@email.com"]  # ❌ Causes 400 error
}
```

### ✅ **New Way (Guided & Safe)**
```bash
# Step 1: Start the wizard
campaign_creation_wizard { "step": "start" }

# Step 2: Provide campaign info (after seeing verified accounts)
campaign_creation_wizard {
  "step": "info_gathered",
  "name": "My Campaign",
  "subject": "Hello", 
  "body": "Hi there...",
  "selected_email": "verified@yourdomain.com"  # ✅ From verified list
}

# Step 3: Create the campaign
campaign_creation_wizard { "step": "create", ... }
```

## Complete Workflow

### **Step 1: Check Verified Accounts**

Start the wizard to see your available sending accounts:

```json
{
  "step": "start"
}
```

**Response:**
```json
{
  "step": "accounts_checked",
  "message": "Found verified sending accounts. Please select one and provide campaign details.",
  "verified_accounts": [
    {
      "index": 1,
      "email": "mike.curry@253paymentpros.com",
      "status": "active",
      "daily_limit": 50
    },
    {
      "index": 2, 
      "email": "support@253paymentpros.com",
      "status": "active",
      "daily_limit": 100
    }
  ],
  "next_step": "Call campaign_creation_wizard with step='info_gathered' and provide: name, subject, body, selected_email"
}
```

### **Step 2: Provide Campaign Information**

Provide required campaign details using a verified email from Step 1:

```json
{
  "step": "info_gathered",
  "name": "Test Campaign - Demo",
  "subject": "Test Email Subject Line",
  "body": "Hi there,\n\nThis is a test email campaign...\n\nBest regards,\nMike Curry",
  "selected_email": "mike.curry@253paymentpros.com"
}
```

**Optional Configuration (with defaults):**
```json
{
  "step": "info_gathered",
  "name": "My Campaign",
  "subject": "Email Subject",
  "body": "Email content...",
  "selected_email": "verified@domain.com",
  
  // Optional settings with defaults
  "timezone": "America/New_York",
  "timing_from": "09:00",
  "timing_to": "17:00", 
  "daily_limit": 50,
  "email_gap_minutes": 10,
  "open_tracking": true,
  "link_tracking": true,
  "stop_on_reply": true,
  "text_only": false,
  "send_weekdays": true,
  "send_weekends": false
}
```

**Response:**
```json
{
  "step": "validated",
  "message": "Campaign information validated successfully. Review the configuration below.",
  "campaign_config": {
    "name": "Test Campaign - Demo",
    "subject": "Test Email Subject Line",
    "body": "Hi there...",
    "selected_email": "mike.curry@253paymentpros.com",
    "timezone": "America/New_York",
    "timing_from": "09:00",
    "timing_to": "17:00",
    "daily_limit": 50,
    "open_tracking": true,
    "link_tracking": true
  },
  "next_step": "If everything looks correct, call campaign_creation_wizard with step='create' and the same parameters"
}
```

### **Step 3: Create the Campaign**

If the configuration looks correct, proceed with creation:

```json
{
  "step": "create",
  "name": "Test Campaign - Demo",
  "subject": "Test Email Subject Line", 
  "body": "Hi there,\n\nThis is a test email campaign...",
  "selected_email": "mike.curry@253paymentpros.com"
  // Include any optional settings from Step 2
}
```

**Success Response:**
```json
{
  "step": "completed",
  "message": "Campaign created successfully!",
  "campaign": {
    "id": "campaign-uuid-here",
    "name": "Test Campaign - Demo",
    "status": 0,
    "email_list": ["mike.curry@253paymentpros.com"]
  },
  "summary": {
    "name": "Test Campaign - Demo",
    "sending_from": "mike.curry@253paymentpros.com",
    "daily_limit": 50,
    "schedule": "09:00-17:00 America/New_York",
    "tracking": {
      "opens": true,
      "links": true
    }
  }
}
```

## Configuration Options

### **Required Fields**
- `name`: Campaign name
- `subject`: Email subject line
- `body`: Email body content
- `selected_email`: Must be from verified accounts list

### **Optional Fields (with defaults)**
- `timezone`: "America/New_York"
- `timing_from`: "09:00"
- `timing_to`: "17:00"
- `daily_limit`: 50
- `email_gap_minutes`: 10
- `open_tracking`: true
- `link_tracking`: true
- `stop_on_reply`: true
- `text_only`: false
- `send_weekdays`: true (Mon-Fri)
- `send_weekends`: false (Sat-Sun)

## Error Handling

The wizard provides clear error messages for common issues:

### **No Verified Accounts**
```json
{
  "step": "error",
  "message": "No verified sending accounts found. You need to add and verify at least one sending account in your Instantly dashboard before creating campaigns.",
  "action_required": "Go to https://app.instantly.ai/app/accounts to add a sending account"
}
```

### **Missing Required Fields**
```json
{
  "step": "error", 
  "message": "Missing required campaign information",
  "missing_fields": ["name", "subject"],
  "action_required": "Please provide all required fields"
}
```

### **Invalid Email Format**
```json
{
  "step": "error",
  "message": "Invalid email format for selected_email",
  "provided_email": "invalid-email",
  "action_required": "Please provide a valid email address"
}
```

## Benefits

✅ **Prevents 400 Bad Request errors**  
✅ **Validates email accounts before use**  
✅ **Provides clear step-by-step guidance**  
✅ **Shows configuration summary before creation**  
✅ **Includes sensible defaults for all optional settings**  
✅ **Clear error messages with actionable solutions**  

## Migration from Direct create_campaign

If you were using `create_campaign` directly, simply replace it with the wizard:

**Old:**
```bash
create_campaign { "name": "...", "email_list": ["..."] }
```

**New:**
```bash
# 1. Start wizard
campaign_creation_wizard { "step": "start" }

# 2. Gather info (using verified email from step 1)
campaign_creation_wizard { "step": "info_gathered", "name": "...", "selected_email": "..." }

# 3. Create campaign
campaign_creation_wizard { "step": "create", "name": "...", "selected_email": "..." }
```

The wizard ensures your campaigns are created successfully every time! 🎉
