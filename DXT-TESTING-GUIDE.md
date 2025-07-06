# 🎉 DXT One-Click Installation & Testing Guide - Zod v4

## ✅ **DXT Package Ready with Zod v4!**

Your Instantly MCP Server with **Zod v4 validation** is now packaged as a **Desktop Extension (DXT)** for one-click installation in Claude Desktop.

### 📦 **Package Details:**
- **File**: `instantly-mcp-1.0.8-beta.1.dxt`
- **Size**: 2.2M
- **Type**: Node.js MCP Server with Zod v4 validation
- **Compatibility**: Claude Desktop (macOS, Windows, Linux)
- **MCP SDK**: Latest version 1.13.3
- **Zod**: Latest v4 with dramatic performance improvements

## 🚀 **Installation Instructions**

### **Step 1: Install in Claude Desktop**
1. **📁 Double-click** `instantly-mcp-1.0.8-beta.1.dxt`
2. **🔑 Enter your Instantly API key** when prompted
   - Your API key should start with `inst_`
   - Find it in Instantly Dashboard → Settings → API Keys
3. **✅ Confirm installation** when Claude Desktop prompts
4. **🔄 Restart Claude Desktop** if required

### **Step 2: Verify Installation**
- Look for "Instantly MCP Server" in Claude Desktop's MCP settings
- The server should show as "Connected" or "Active"

## 🧪 **Testing the Zod v4 Integration**

The main goal is to verify that the **Zod v4 validation integration** resolves compatibility issues and provides dramatically improved error messages and performance.

### 🚀 **Zod v4 Improvements to Test:**

1. **⚡ Performance**: Dramatic performance improvements for faster validation
2. **🎯 Error Quality**: Unified `error` parameter for cleaner, more specific messages
3. **📦 Bundle Size**: Better tree-shaking with top-level functions like `z.email()`
4. **🔧 API Cleanliness**: Simplified error customization and consistent behavior
5. **🌍 Compatibility**: Enhanced compatibility across different JavaScript environments

### **✅ Valid Operations (Should Work Normally)**

**Test 1: List Accounts**
```
List all my Instantly accounts
```
*Expected: Normal account listing as before*

**Test 2: Valid Campaign Creation**
```
Create a campaign named "DXT Test Campaign" with subject "Hello {{firstName}}" and body "Hi {{firstName}},

This is a test of the DXT installation with Zod validation.

Best regards,
The Team" for email test@example.com
```
*Expected: Campaign creation works normally*

### **❌ Invalid Operations (Should Show CLEAR Zod Error Messages)**

**Test 3: Invalid Email Format**
```
Verify email address invalid-email-format
```
*Expected: Clear error like "Invalid email format. Must be a valid email address (e.g., user@domain.com)"*

**Test 4: Invalid Timezone**
```
Create a campaign named "Test" with subject "Test" and body "Test message" for email test@example.com with timezone "Invalid/Timezone"
```
*Expected: Clear error listing valid timezones*

**Test 5: Empty Required Fields**
```
Create a campaign with empty name
```
*Expected: Clear error about required fields*

**Test 6: Invalid Time Format**
```
Create a campaign with timing from "25:00" to "17:00"
```
*Expected: Clear error about HH:MM format requirement*

## 🎯 **Success Criteria**

### **✅ Before vs After Comparison**

**❌ Before Zod (Old Behavior):**
- Generic: "Invalid email address: invalid-email"
- Vague: "Validation failed"
- Inconsistent: Different errors in different environments

**✅ After Zod (New Behavior):**
- Specific: "verify_email validation failed: Invalid email format. Must be a valid email address (e.g., user@domain.com)"
- Actionable: "create_campaign validation failed: Invalid timezone: Invalid/Timezone. Must be one of the supported Instantly API timezones."
- Consistent: Same clear errors across all environments

### **🎉 Success Indicators:**
- ✅ Valid commands work exactly as before
- ✅ Invalid commands show **specific, clear error messages**
- ✅ Error messages include **examples of correct format**
- ✅ No "undefined" errors or crashes
- ✅ Consistent behavior (no environment-specific issues)

### **❌ Failure Indicators:**
- ❌ Runtime crashes or "undefined" errors
- ❌ Generic "validation failed" messages
- ❌ Valid commands that don't work
- ❌ Inconsistent error handling

## 🔍 **Detailed Testing Checklist**

### **Core Functionality**
- [ ] **Server Connection**: MCP server connects successfully
- [ ] **Tool Listing**: All tools are available and listed
- [ ] **Valid Operations**: Normal operations work as expected

### **Zod Validation Testing**
- [ ] **Email Validation**: Invalid emails show clear format errors
- [ ] **Timezone Validation**: Invalid timezones show supported options
- [ ] **Time Format**: Invalid times show HH:MM format requirement
- [ ] **Required Fields**: Missing fields show specific field names
- [ ] **Array Limits**: Email limits enforced with clear messages
- [ ] **Type Safety**: No runtime type errors or crashes

### **Error Message Quality**
- [ ] **Specific**: Errors mention exact validation issue
- [ ] **Actionable**: Errors include examples of correct format
- [ ] **Consistent**: Same errors across different commands
- [ ] **Professional**: Error messages are user-friendly

## 🚨 **Troubleshooting**

### **Installation Issues**
- **DXT won't install**: Ensure Claude Desktop is updated to latest version
- **API key rejected**: Verify key starts with `inst_` and is active
- **Server won't start**: Check Claude Desktop logs for error details

### **Testing Issues**
- **No error messages**: Server might not be using Zod validation
- **Generic errors**: Installation might have failed partially
- **Crashes**: Report specific commands that cause issues

### **Rollback if Needed**
1. **Remove from Claude Desktop**: Go to MCP settings and remove server
2. **Use stable NPM version**: `npx instantly-mcp --api-key YOUR_KEY`
3. **Report issues**: Document specific problems for debugging

## 📊 **Expected Results**

If the DXT installation and Zod integration are working correctly:

### **✅ Problem Resolution:**
- **Before**: Runtime errors in different environments
- **After**: Consistent validation across all environments

### **✅ Error Quality Improvement:**
- **Before**: Generic "validation failed" messages
- **After**: Specific, actionable error messages with examples

### **✅ Compatibility Success:**
- **Before**: Issues in Cursor IDE and n8n
- **After**: Consistent behavior across all environments

## 🎯 **Next Steps After Successful Testing**

If DXT testing is successful:

1. **✅ Zod integration confirmed working**
2. **🚀 Ready for broader deployment**
3. **📦 Can publish stable NPM version**
4. **🔄 Can test in other environments (Cursor IDE, n8n)**

## 📞 **Support**

If you encounter issues:
- Note specific commands that failed
- Document expected vs actual behavior
- Check Claude Desktop logs for error details
- Report back with findings for debugging

---

**🎉 You're now ready to test the Zod integration via one-click DXT installation!**

This should resolve the compatibility issues you experienced while providing a much better user experience with clear, actionable error messages.
