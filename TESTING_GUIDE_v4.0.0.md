# 🧪 Testing Guide for Instantly MCP v4.0.0

## 🚀 **Quick Start Testing**

### **1. Install the Latest Version**
```bash
# Fresh installation
npm install -g instantly-mcp@4.0.0

# Or upgrade from previous version
npm update -g instantly-mcp

# Verify installation
instantly-mcp --version  # Should show 4.0.0
```

### **2. Basic Connection Test**
```bash
# Test basic MCP connection
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | instantly-mcp --api-key YOUR_API_KEY
```

---

## 🎯 **Core Feature Testing**

### **Test 1: Enhanced create_campaign with Auto-Discovery**

#### **Test Auto-Discovery (No email_list provided)**
```bash
instantly-mcp --api-key YOUR_API_KEY <<EOF
create_campaign {
  "name": "Auto-Discovery Test Campaign",
  "subject": "Testing Auto-Discovery",
  "body": "This campaign was created using auto-discovery feature."
}
EOF
```

**Expected Result**: ✅ Should automatically discover and select best available account

#### **Test Guided Mode**
```bash
instantly-mcp --api-key YOUR_API_KEY <<EOF
create_campaign {
  "name": "Guided Mode Test",
  "subject": "Testing Guided Mode",
  "body": "This tests the guided mode feature.",
  "guided_mode": true
}
EOF
```

**Expected Result**: ✅ Should show account selection guidance and next steps

### **Test 2: Complete Pagination Validation**

#### **Test Account Discovery with Pagination**
```bash
instantly-mcp --api-key YOUR_API_KEY <<EOF
list_accounts {"limit": 100}
EOF
```

**Expected Result**: ✅ Should return all accounts with campaign creation guidance

#### **Test Email Validation with Complete Account List**
```bash
# First get accounts
instantly-mcp --api-key YOUR_API_KEY <<EOF
list_accounts {"limit": 100}
EOF

# Then use returned emails in campaign creation
instantly-mcp --api-key YOUR_API_KEY <<EOF
create_campaign {
  "name": "Pagination Test Campaign",
  "subject": "Testing Complete Pagination",
  "body": "This tests complete account discovery.",
  "email_list": ["YOUR_ACCOUNT_EMAIL_FROM_ABOVE"]
}
EOF
```

**Expected Result**: ✅ Should validate against complete account list

### **Test 3: Enhanced Response Format**

#### **Test Next-Step Guidance**
```bash
instantly-mcp --api-key YOUR_API_KEY <<EOF
create_campaign {
  "name": "Response Format Test",
  "subject": "Testing Enhanced Response",
  "body": "This tests the enhanced response format.",
  "email_list": ["YOUR_VERIFIED_EMAIL"]
}
EOF
```

**Expected Result**: ✅ Should include workflow_confirmation, next_steps, and success_metrics

---

## 🔍 **Regression Testing**

### **Test 4: Verify Wizard Removal**

#### **Test Wizard Tool Removal**
```bash
instantly-mcp --api-key YOUR_API_KEY <<EOF
campaign_creation_wizard {"step": "start"}
EOF
```

**Expected Result**: ❌ Should return "Unknown tool" error (wizard successfully removed)

### **Test 5: Existing Functionality**

#### **Test Standard Campaign Creation**
```bash
instantly-mcp --api-key YOUR_API_KEY <<EOF
create_campaign {
  "name": "Standard Test Campaign",
  "subject": "Hello {{firstName}}",
  "body": "Hi {{firstName}},\\n\\nThis is a test campaign.\\n\\nBest regards,\\nTest Team",
  "email_list": ["YOUR_VERIFIED_EMAIL"],
  "daily_limit": 50,
  "timing_from": "09:00",
  "timing_to": "17:00"
}
EOF
```

**Expected Result**: ✅ Should create campaign with enhanced response format

#### **Test Campaign Activation**
```bash
# Use campaign_id from previous test
instantly-mcp --api-key YOUR_API_KEY <<EOF
activate_campaign {"campaign_id": "CAMPAIGN_ID_FROM_ABOVE"}
EOF
```

**Expected Result**: ✅ Should activate campaign successfully

---

## 🧪 **Advanced Testing Scenarios**

### **Test 6: Error Handling Enhancement**

#### **Test Invalid Email Validation**
```bash
instantly-mcp --api-key YOUR_API_KEY <<EOF
create_campaign {
  "name": "Error Test Campaign",
  "subject": "Testing Error Handling",
  "body": "This should fail with enhanced error message.",
  "email_list": ["nonexistent@invalid.com"]
}
EOF
```

**Expected Result**: ✅ Should return enhanced error message with specific solutions

#### **Test Empty Account Scenario**
```bash
# Test with account that has no eligible accounts (if applicable)
instantly-mcp --api-key YOUR_API_KEY <<EOF
create_campaign {
  "name": "No Accounts Test",
  "subject": "Testing No Accounts",
  "body": "This tests the no eligible accounts scenario."
}
EOF
```

**Expected Result**: ✅ Should return detailed guidance on account setup requirements

### **Test 7: Performance Testing**

#### **Test Large Account List Handling**
```bash
# Test with high limit to verify pagination performance
instantly-mcp --api-key YOUR_API_KEY <<EOF
list_accounts {"limit": 100}
EOF
```

**Expected Result**: ✅ Should handle large account lists efficiently

---

## 📊 **Validation Checklist**

### **✅ Core Functionality**
- [ ] Auto-discovery works when email_list is empty
- [ ] Guided mode provides account selection guidance
- [ ] Complete pagination discovers all accounts
- [ ] Enhanced error messages provide actionable solutions
- [ ] Response format includes next-step guidance

### **✅ Wizard Removal Verification**
- [ ] campaign_creation_wizard tool returns "Unknown tool" error
- [ ] No wizard-related code in responses
- [ ] Single code path for campaign creation confirmed

### **✅ Enhanced Features**
- [ ] getAllAccountsWithPagination() retrieves all accounts
- [ ] Auto-discovery selects best account (highest warmup score)
- [ ] Guided mode shows eligible accounts and instructions
- [ ] Enhanced response includes workflow_confirmation
- [ ] Next-steps array provides actionable tool calls

### **✅ Backward Compatibility**
- [ ] All existing tools work as expected
- [ ] Standard campaign creation workflow unchanged
- [ ] API response format enhanced but compatible
- [ ] No breaking changes for existing users (except wizard removal)

---

## 🐛 **Common Issues & Solutions**

### **Issue 1: Auto-Discovery Fails**
```
Error: "No eligible sending accounts found"
```
**Solution**: 
1. Run `list_accounts` to check account statuses
2. Ensure accounts have status=1, setup_pending=false, warmup_status=1
3. Manually provide email_list if auto-discovery fails

### **Issue 2: Pagination Not Working**
```
Error: "Unable to retrieve accounts"
```
**Solution**:
1. Check API key permissions
2. Verify account has access to accounts endpoint
3. Try with smaller limit first (e.g., limit: 20)

### **Issue 3: Enhanced Response Not Showing**
```
Response missing workflow_confirmation or next_steps
```
**Solution**:
1. Ensure using v4.0.0 (check `instantly-mcp --version`)
2. Verify campaign creation was successful
3. Check for any API errors in the response

---

## 📈 **Performance Benchmarks**

### **Expected Performance**
- **Account Discovery**: < 5 seconds for 100+ accounts
- **Campaign Creation**: < 3 seconds with validation
- **Auto-Discovery**: < 2 seconds for account selection
- **Error Response**: < 1 second with detailed guidance

### **Memory Usage**
- **Base Memory**: ~50MB for MCP server
- **Peak Memory**: ~100MB during large account discovery
- **Pagination Buffer**: Handles 10,000+ accounts safely

---

## 🎯 **Success Criteria**

### **✅ Must Pass**
1. **Auto-discovery works** when email_list is empty
2. **Complete pagination** discovers all accounts (no missed accounts)
3. **Enhanced error messages** provide specific solutions
4. **Wizard removal** confirmed (returns "Unknown tool" error)
5. **Response format** includes next-step guidance

### **✅ Should Pass**
1. **Guided mode** provides helpful account selection
2. **Performance** meets benchmarks above
3. **Backward compatibility** maintained for existing workflows
4. **Error handling** graceful for all edge cases

### **✅ Nice to Have**
1. **Smart account selection** chooses best warmup scores
2. **Detailed metrics** in success responses
3. **Comprehensive guidance** for troubleshooting

---

## 🚀 **Production Readiness Checklist**

### **Before Production Deployment**
- [ ] All core tests pass
- [ ] Performance benchmarks met
- [ ] Error handling verified
- [ ] Documentation updated
- [ ] User feedback collected

### **Production Monitoring**
- [ ] Monitor auto-discovery success rates
- [ ] Track pagination performance
- [ ] Watch for error patterns
- [ ] Collect user feedback on enhanced features

---

## 📞 **Support & Feedback**

### **Getting Help**
- 📖 **Documentation**: Check RELEASE_NOTES_v4.0.0.md
- 🐛 **Issues**: Report on GitHub with test results
- 💡 **Feature Requests**: Submit enhancement ideas
- 📧 **Direct Support**: Contact maintainers with test logs

### **Providing Feedback**
- ✅ **What works well**: Share successful test results
- ❌ **What needs improvement**: Report issues with specific test cases
- 💡 **Enhancement ideas**: Suggest improvements based on testing experience

---

## 🎉 **Happy Testing!**

The streamlined Instantly MCP v4.0.0 is designed for bulletproof campaign creation with enhanced user experience. Your testing helps ensure reliability and success for all users.

**Test thoroughly and enjoy the enhanced features!** 🚀
