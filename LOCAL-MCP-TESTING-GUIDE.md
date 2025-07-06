# 🧪 Local MCP Server Testing - Claude Desktop & Cursor IDE

## 🎯 **Goal: Test Zod v4 Compatibility Improvements Locally**

Test the enhanced MCP server with Zod v4 validation in both Claude Desktop and Cursor IDE to verify that the compatibility issues are resolved before publishing to NPM.

---

## 📋 **Claude Desktop Local Testing**

### **Step 1: Configure Claude Desktop MCP Settings**

1. **Open Claude Desktop Settings**
   - Click the gear icon in Claude Desktop
   - Navigate to "Developer" → "MCP Servers"

2. **Add Local MCP Server Configuration**
   ```json
   {
     "mcpServers": {
       "instantly-mcp-local": {
         "command": "node",
         "args": [
           "/Users/brandoncharleson/Documents/DeveloperProjects/instantly-mcp/dist/index.js",
           "--api-key",
           "YOUR_INSTANTLY_API_KEY"
         ],
         "env": {
           "NODE_ENV": "development"
         }
       }
     }
   }
   ```

3. **Replace with Your Actual Paths**
   - Update the path to match your project location
   - Replace `YOUR_INSTANTLY_API_KEY` with your actual API key

4. **Save and Restart Claude Desktop**

### **Step 2: Test Zod v4 Validation in Claude Desktop**

**✅ Valid Operations (Should Work Smoothly):**
```
List all my Instantly accounts
```

```
Create a campaign named "Zod v4 Test Campaign" with subject "Hello {{firstName}}" and body "Testing Zod v4 validation improvements" for email test@example.com
```

**❌ Invalid Operations (Should Show Clear Zod v4 Errors):**
```
Verify email address invalid-email-format
```

```
Create a campaign with empty name and subject for email test@example.com
```

**Expected Zod v4 Error Messages:**
- Specific field names mentioned
- Actionable guidance provided
- Examples of correct format included
- No generic "validation failed" messages

---

## 🎯 **Cursor IDE Local Testing**

### **Step 1: Configure Cursor IDE MCP Settings**

1. **Create/Update `.cursor/mcp.json`**
   ```json
   {
     "mcpServers": {
       "instantly-mcp-local": {
         "command": "node",
         "args": [
           "/Users/brandoncharleson/Documents/DeveloperProjects/instantly-mcp/dist/index.js",
           "--api-key",
           "YOUR_INSTANTLY_API_KEY"
         ],
         "env": {
           "NODE_ENV": "development"
         }
       }
     }
   }
   ```

2. **Update Paths for Your System**
   - Adjust the absolute path to your project
   - Add your Instantly API key

3. **Restart Cursor IDE**

### **Step 2: Test Zod v4 Validation in Cursor IDE**

**✅ Valid Operations:**
```
@instantly-mcp-local List all my Instantly accounts
```

```
@instantly-mcp-local Create a campaign named "Cursor Test" with subject "Testing {{firstName}}" and body "Zod v4 compatibility test" for email user@domain.com
```

**❌ Invalid Operations (Test Error Handling):**
```
@instantly-mcp-local Verify email address not-an-email
```

```
@instantly-mcp-local Create a campaign with name "" and subject "" for email invalid-format
```

---

## 🔍 **What to Look For During Testing**

### **✅ Success Indicators:**

**Claude Desktop:**
- MCP server connects without errors
- Valid operations execute successfully
- Invalid operations show specific, helpful error messages
- No "undefined" or generic errors
- Consistent behavior across multiple requests

**Cursor IDE:**
- MCP server loads and connects properly
- Commands execute without runtime crashes
- Error messages are clear and actionable
- No compatibility issues or execution failures

### **❌ Failure Indicators:**

**Claude Desktop:**
- Server fails to connect or crashes
- Generic error messages without specifics
- "Validation failed" without details
- Runtime errors or undefined behavior

**Cursor IDE:**
- MCP server fails to load
- Commands result in execution errors
- Compatibility issues or crashes
- Unclear or unhelpful error messages

---

## 📊 **Testing Checklist**

### **Claude Desktop Testing:**
- [ ] MCP server connects successfully
- [ ] Valid email validation works
- [ ] Invalid email shows specific Zod v4 error
- [ ] Campaign creation with valid data works
- [ ] Campaign creation with invalid data shows clear errors
- [ ] Multiple field errors are handled properly
- [ ] Performance feels responsive
- [ ] No runtime crashes or undefined errors

### **Cursor IDE Testing:**
- [ ] MCP server loads without issues
- [ ] Valid operations execute successfully
- [ ] Invalid operations show specific error messages
- [ ] No compatibility errors or execution failures
- [ ] Error messages include field names and guidance
- [ ] Consistent behavior across multiple requests
- [ ] No "undefined" or generic error messages

---

## 🎯 **Expected Zod v4 Improvements**

### **Before (Potential Issues):**
- Generic error messages
- Compatibility issues in Cursor IDE
- Runtime errors with validation
- Unclear guidance for users

### **After (Zod v4 Benefits):**
- Specific field-level error messages
- Enhanced compatibility across environments
- Improved performance and reliability
- Clear, actionable error guidance

### **Sample Expected Error Messages:**
```
verify_email validation failed: email: Invalid email format. Must be a valid email address (e.g., user@domain.com). Please check your input parameters and try again.
```

```
create_campaign validation failed: name: Campaign name cannot be empty; subject: Subject line cannot be empty. Please check your input parameters and try again.
```

---

## 🚀 **Next Steps After Local Testing**

### **If Testing is Successful:**
1. ✅ Document any improvements observed
2. ✅ Note specific compatibility fixes
3. ✅ Prepare for NPM publishing
4. ✅ Update documentation with findings

### **If Issues are Found:**
1. 🔧 Document specific problems
2. 🔧 Debug and fix issues
3. 🔧 Re-test locally
4. 🔧 Iterate until stable

---

## 📝 **Testing Commands Summary**

**Valid Test Commands:**
```
List all my Instantly accounts
Create a campaign named "Test Campaign" with subject "Hello {{firstName}}" and body "Test message" for email test@example.com
```

**Invalid Test Commands (Should Show Clear Errors):**
```
Verify email address invalid-email-format
Create a campaign with empty name
Create a campaign with timezone "Invalid/Zone"
```

**🎉 Ready to test Zod v4 improvements in real MCP environments!**
