# 🧪 Zod Integration Testing Workflow

## 🎯 Overview

This document provides a step-by-step workflow for safely testing the Zod validation integration across all environments while maintaining complete rollback capabilities.

## 🛡️ Safety First - Pre-Testing Checklist

### ✅ **Backup Creation**
```bash
# 1. Create stable backup tag
git checkout main
git tag -a v1.0.6-stable-backup -m "Stable backup before Zod testing"
git push origin v1.0.6-stable-backup

# 2. Create backup branch
git checkout -b backup/pre-zod-stable
git push origin backup/pre-zod-stable

# 3. Return to feature branch
git checkout feature/zod-validation-integration
```

### ✅ **Environment Preparation**
```bash
# 1. Run setup script
./scripts/setup-local-testing.sh

# 2. Verify build works
npm run build

# 3. Set API key
export INSTANTLY_API_KEY="your-api-key-here"
```

## 🚀 Phase 1: Local Testing

### **Step 1: Build and Basic Validation**
```bash
# Build the project
npm run build

# Quick validation test
node scripts/test-zod-validation.js
```

**Expected Results:**
- ✅ Server starts without errors
- ✅ Invalid email triggers Zod validation error
- ✅ Error message is clear and specific

### **Step 2: MCP Inspector Testing**
```bash
# Test with MCP Inspector
npx @modelcontextprotocol/inspector dist/index.js -- --api-key $INSTANTLY_API_KEY
```

**Test Cases:**
1. **Valid campaign creation:**
   ```json
   {
     "name": "Test Campaign",
     "subject": "Hello {{firstName}}",
     "body": "Hi {{firstName}},\n\nTest message.\n\nBest regards",
     "email_list": ["test@example.com"]
   }
   ```

2. **Invalid email validation:**
   ```json
   {
     "email": "invalid-email-format"
   }
   ```

3. **Invalid timezone:**
   ```json
   {
     "name": "Test",
     "subject": "Test",
     "body": "Test",
     "email_list": ["test@example.com"],
     "timezone": "Invalid/Timezone"
   }
   ```

## 🚀 Phase 2: Alpha NPM Testing

### **Step 1: Publish Alpha Version**
```bash
# Version bump for alpha
npm version prerelease --preid=alpha
# This creates: 1.0.7-alpha.1

# Publish to alpha tag
npm publish --tag alpha

# Verify publication
npm view instantly-mcp dist-tags
```

### **Step 2: Local Cursor Testing**
```bash
# Update .cursor/mcp.json to use alpha version
# The setup script already created this configuration

# Test in Cursor IDE within this project
```

**Cursor Test Commands:**
- "List all my Instantly accounts"
- "Create a campaign with invalid email: test@invalid"
- "Verify email address: not-an-email"
- "Get warmup analytics for 101 emails" (should fail validation)

### **Step 3: Isolated Claude Desktop Testing**
```json
// Create temporary Claude Desktop config
{
  "mcpServers": {
    "instantly-alpha-test": {
      "command": "npx",
      "args": ["instantly-mcp@alpha", "--api-key", "YOUR_API_KEY"]
    }
  }
}
```

## 🚀 Phase 3: Beta NPM Testing

### **Step 1: Promote to Beta**
```bash
# Only if alpha testing passes
npm version prerelease --preid=beta
npm publish --tag beta
```

### **Step 2: Broader Testing**
- Test in multiple environments
- Test with different API keys
- Test edge cases and error scenarios

### **Step 3: Community Beta Testing**
- Share beta version with trusted users
- Gather feedback on error messages
- Monitor for compatibility issues

## 🚀 Phase 4: Production Release

### **Step 1: Final Validation**
```bash
# Comprehensive testing checklist
- [ ] All local tests pass
- [ ] Alpha testing successful
- [ ] Beta testing successful
- [ ] No compatibility issues reported
- [ ] Error messages are clear and actionable
```

### **Step 2: Production Release**
```bash
# Final version bump
npm version minor  # 1.0.6 -> 1.0.7

# Publish to latest
npm publish

# Create release tag
git tag -a v1.0.7 -m "Release: Zod validation integration"
git push origin v1.0.7
```

## 🚨 Rollback Procedures

### **Immediate Rollback (Any Phase)**
```bash
# NPM rollback
npm dist-tag add instantly-mcp@1.0.6 latest

# Git rollback
git checkout backup/pre-zod-stable
```

### **Alpha/Beta Rollback**
```bash
# Remove problematic version
npm unpublish instantly-mcp@1.0.7-alpha.1 --force

# Reset tags
npm dist-tag add instantly-mcp@1.0.6 latest
```

### **Production Rollback**
```bash
# Revert to previous stable
npm dist-tag add instantly-mcp@1.0.6 latest

# Git revert
git revert -m 1 <merge-commit-hash>
git push origin main
```

## 📊 Testing Checklist

### **Validation Testing**
- [ ] Valid inputs work correctly
- [ ] Invalid emails trigger clear errors
- [ ] Invalid timezones are rejected
- [ ] Invalid time formats are rejected
- [ ] HTML tag validation works
- [ ] Array length limits are enforced
- [ ] Required fields are validated

### **Compatibility Testing**
- [ ] Claude Desktop works correctly
- [ ] Cursor IDE integration works
- [ ] n8n integration works
- [ ] Error messages are consistent across environments

### **Performance Testing**
- [ ] No performance regression
- [ ] Validation doesn't slow down requests
- [ ] Memory usage is stable

### **Error Handling Testing**
- [ ] Error messages are actionable
- [ ] Error codes are appropriate
- [ ] No undefined errors or crashes

## 🎯 Success Criteria

### **Phase 1 (Local) Success:**
- ✅ All validation tests pass
- ✅ Error messages are clear
- ✅ No compilation errors

### **Phase 2 (Alpha) Success:**
- ✅ Works in Cursor IDE
- ✅ Works in Claude Desktop
- ✅ No runtime errors

### **Phase 3 (Beta) Success:**
- ✅ Community feedback positive
- ✅ No compatibility issues
- ✅ Performance is acceptable

### **Phase 4 (Production) Success:**
- ✅ All environments working
- ✅ User feedback positive
- ✅ No rollback needed

## 📋 Emergency Contacts

- **Immediate Issues:** Use rollback procedures above
- **GitHub Issues:** Document problems for future fixes
- **NPM Issues:** Contact npm support if needed

This workflow ensures safe, gradual testing with complete rollback capabilities at every stage.
