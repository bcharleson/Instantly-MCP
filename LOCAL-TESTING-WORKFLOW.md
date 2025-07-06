# 🧪 Local Testing Workflow - Zod v4 Validation

## 📋 **Phase 1: Local Testing with Direct Node Command**

### **Step 1: Start the MCP Server Locally**

```bash
# Navigate to project directory
cd /path/to/instantly-mcp

# Start server with your API key
node ./dist/index.js --api-key YOUR_INSTANTLY_API_KEY
```

**Expected Output:**
```
Instantly MCP server running on stdio
Server initialized with Zod v4 validation
```

### **Step 2: Test Server Startup**

**✅ Success Indicators:**
- Server starts without errors
- No TypeScript compilation issues
- Zod v4 imports working correctly
- API key validation passes

**❌ Failure Indicators:**
- Module resolution errors
- Zod import failures
- TypeScript compilation errors
- Server crashes on startup

### **Step 3: Test Zod v4 Validation Schemas**

Since the MCP server runs on stdio, we'll test validation by examining the built validation module:

```bash
# Test the validation schemas directly
node -e "
const { validateToolParameters } = require('./dist/validation.js');

// Test 1: Valid email validation
try {
  console.log('✅ Testing valid email...');
  const result = validateToolParameters('verify_email', { email: 'test@example.com' });
  console.log('Valid email passed:', result);
} catch (e) {
  console.log('❌ Valid email failed:', e.message);
}

// Test 2: Invalid email validation (should show Zod v4 error)
try {
  console.log('\\n❌ Testing invalid email...');
  validateToolParameters('verify_email', { email: 'invalid-email-format' });
} catch (e) {
  console.log('✅ Invalid email caught with Zod v4 error:');
  console.log('   Error:', e.message);
}

// Test 3: Campaign validation with empty name
try {
  console.log('\\n❌ Testing empty campaign name...');
  validateToolParameters('create_campaign', {
    name: '',
    subject: 'Test',
    body: 'Test body',
    email_list: ['test@example.com']
  });
} catch (e) {
  console.log('✅ Empty name caught with Zod v4 error:');
  console.log('   Error:', e.message);
}

console.log('\\n🎉 Local validation testing complete!');
"
```

### **Step 4: Verify Error Message Quality**

**Expected Zod v4 Error Messages:**

**Email Validation:**
```
verify_email validation failed: email: Invalid email format. Must be a valid email address (e.g., user@domain.com). Please check your input parameters and try again.
```

**Campaign Name Validation:**
```
create_campaign validation failed: name: Campaign name cannot be empty. Please check your input parameters and try again.
```

**Array Limit Validation:**
```
create_campaign validation failed: email_list: Cannot specify more than 100 email addresses. Please check your input parameters and try again.
```

### **Step 5: Performance Testing**

```bash
# Test validation performance
node -e "
const { validateToolParameters } = require('./dist/validation.js');

console.log('⚡ Testing Zod v4 performance...');
const iterations = 1000;
const startTime = performance.now();

for (let i = 0; i < iterations; i++) {
  try {
    validateToolParameters('verify_email', { email: 'test@example.com' });
  } catch (e) {}
}

const endTime = performance.now();
const duration = endTime - startTime;

console.log(\`✅ Validated \${iterations} emails in \${duration.toFixed(2)}ms\`);
console.log(\`✅ Average: \${(duration/iterations).toFixed(4)}ms per validation\`);
console.log('🎯 Zod v4 performance is excellent!');
"
```

## 📊 **Phase 1 Success Criteria**

### **✅ Must Pass:**
- [ ] Server starts without errors
- [ ] Zod v4 validation schemas load correctly
- [ ] Valid inputs pass validation
- [ ] Invalid inputs show specific, actionable error messages
- [ ] Error messages include examples and guidance
- [ ] Performance is sub-millisecond per validation
- [ ] No runtime crashes or undefined errors

### **🎯 Error Message Quality Check:**
- [ ] Errors mention specific field names
- [ ] Errors include examples of correct format
- [ ] Errors are actionable (tell user what to fix)
- [ ] Errors are consistent across different validation types
- [ ] No generic "validation failed" messages

## 🚀 **Phase 2: NPM Publishing (If Phase 1 Passes)**

### **Step 1: Update Version for Release**

```bash
# Update to release candidate version
npm version 1.0.8-rc.1

# Or for stable release
npm version 1.0.8
```

### **Step 2: Publish to NPM**

```bash
# Publish as release candidate first
npm publish --tag rc

# Or publish as latest stable
npm publish
```

### **Step 3: Test NPM Installation**

```bash
# Test global installation
npx instantly-mcp@rc --api-key YOUR_API_KEY

# Or test latest
npx instantly-mcp --api-key YOUR_API_KEY
```

### **Step 4: Environment Testing**

**Claude Desktop:**
- Configure MCP with `npx instantly-mcp --api-key YOUR_KEY`
- Test validation improvements

**Cursor IDE:**
- Update `.cursor/mcp.json` to use NPM version
- Test compatibility improvements

**n8n:**
- Test integration with published NPM version
- Verify compatibility issues are resolved

## 📋 **Testing Commands for All Phases**

### **Valid Operations (Should Work):**
```
List all my Instantly accounts
Create a campaign named "Test Campaign" with subject "Hello {{firstName}}" and body "Test message" for email test@example.com
```

### **Invalid Operations (Should Show Clear Zod v4 Errors):**
```
Verify email address invalid-email-format
Create a campaign with empty name
Create a campaign with timezone "Invalid/Zone"
```

## 🎯 **Success Metrics**

### **Phase 1 (Local) Success:**
- All validation tests pass
- Error messages are specific and helpful
- Performance is excellent
- No runtime issues

### **Phase 2 (NPM) Success:**
- NPM package installs correctly
- Works in Claude Desktop via npx
- Resolves Cursor IDE compatibility issues
- Resolves n8n compatibility issues

---

**🎉 Ready to start Phase 1 local testing!**

This workflow ensures we validate the Zod v4 integration thoroughly before making it publicly available via NPM.
