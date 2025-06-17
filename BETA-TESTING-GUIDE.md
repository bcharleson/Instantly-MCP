# Beta Testing Guide - Multi-Step Campaign Improvements

## 🚀 Quick Start

### Install Beta Version
```bash
npm install -g instantly-mcp@beta
```

### Update Claude Configuration
Update your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "instantly": {
      "command": "npx",
      "args": ["instantly-mcp@beta", "--api-key", "YOUR_INSTANTLY_API_KEY"]
    }
  }
}
```

## 🧪 Test Scenarios

### 1. Backward Compatibility Test
**Purpose**: Ensure existing campaigns work exactly as before

```
create_campaign {
  "name": "Backward Compatibility Test",
  "subject": "Hello {{firstName}}",
  "body": "Hi {{firstName}},\n\nThis is a test email.\n\nBest regards,\nTest Team",
  "email_list": ["your-verified-email@domain.com"],
  "sequence_steps": 3
}
```

**Expected Result**: 
- Step 1: "Hello {{firstName}}" + original body
- Step 2: "Follow-up 1: Hello {{firstName}}" + prefixed body
- Step 3: "Follow-up 2: Hello {{firstName}}" + prefixed body

### 2. Custom Bodies Test
**Purpose**: Test unique content for each step

```
create_campaign {
  "name": "Custom Bodies Test",
  "subject": "Quick question about {{companyName}}",
  "body": "This will be overridden",
  "email_list": ["your-verified-email@domain.com"],
  "sequence_steps": 3,
  "sequence_bodies": [
    "Hi {{firstName}},\n\nI noticed {{companyName}} and wanted to reach out.\n\nBest,\nJohn",
    "Hey {{firstName}},\n\nJust following up on my previous email about {{companyName}}.\n\nThanks,\nJohn",
    "Hi {{firstName}},\n\nI'll keep this brief - still interested in discussing {{companyName}}?\n\nRegards,\nJohn"
  ]
}
```

**Expected Result**: Each step uses the corresponding custom body from the array.

### 3. Thread Continuation Test
**Purpose**: Test automatic blank subjects for threading

```
create_campaign {
  "name": "Thread Continuation Test",
  "subject": "Quick question about {{companyName}}",
  "body": "Hi {{firstName}},\n\nTest email content.\n\nBest,\nTeam",
  "email_list": ["your-verified-email@domain.com"],
  "sequence_steps": 3,
  "continue_thread": true
}
```

**Expected Result**: 
- Step 1: "Quick question about {{companyName}}"
- Step 2: "" (blank)
- Step 3: "" (blank)

### 4. Custom Subjects Test
**Purpose**: Test custom subject lines

```
create_campaign {
  "name": "Custom Subjects Test",
  "subject": "This will be overridden",
  "body": "Hi {{firstName}},\n\nTest email content.\n\nBest,\nTeam",
  "email_list": ["your-verified-email@domain.com"],
  "sequence_steps": 3,
  "sequence_subjects": [
    "Quick question about {{companyName}}",
    "",
    "Final follow-up"
  ]
}
```

**Expected Result**: Each step uses the corresponding custom subject.

### 5. Complete Custom Sequence Test
**Purpose**: Test both custom bodies and subjects together

```
create_campaign {
  "name": "Complete Custom Test",
  "subject": "Will be overridden",
  "body": "Will be overridden",
  "email_list": ["your-verified-email@domain.com"],
  "sequence_steps": 3,
  "sequence_bodies": [
    "Hi {{firstName}},\n\nI noticed {{companyName}} and wanted to reach out.\n\nBest,\nJohn",
    "Hey {{firstName}},\n\nJust following up on my previous email.\n\nThanks,\nJohn",
    "Hi {{firstName}},\n\nLast follow-up - interested in connecting?\n\nRegards,\nJohn"
  ],
  "sequence_subjects": [
    "Quick question about {{companyName}}",
    "",
    "Final follow-up"
  ]
}
```

**Expected Result**: Each step uses the corresponding custom content from both arrays.

## ✅ Validation Tests

### Test Invalid Parameters
These should return clear error messages:

```
// Invalid sequence_bodies length
create_campaign {
  "sequence_steps": 3,
  "sequence_bodies": ["Only one body"]
}

// Invalid sequence_subjects length  
create_campaign {
  "sequence_steps": 3,
  "sequence_subjects": ["Only", "Two"]
}

// Invalid continue_thread type
create_campaign {
  "continue_thread": "yes"
}
```

## 🔍 What to Look For

### Backward Compatibility
- [ ] Existing campaigns work exactly as before
- [ ] No changes to default behavior when new parameters not used
- [ ] Three-stage workflow still works (prerequisite_check → preview → create)
- [ ] HTML paragraph formatting still applied correctly

### New Features
- [ ] Custom bodies replace original content when provided
- [ ] Custom subjects replace default subjects when provided
- [ ] continue_thread creates blank follow-up subjects
- [ ] First step updated when custom content provided
- [ ] Line breaks converted to HTML in custom content

### Error Handling
- [ ] Clear error messages for invalid array lengths
- [ ] Type validation for new parameters
- [ ] Helpful guidance for parameter combinations

### Performance
- [ ] No performance degradation
- [ ] Campaign creation speed unchanged
- [ ] Memory usage stable

## 🐛 Report Issues

If you encounter any issues:

1. **Backward Compatibility Issues**: Any existing campaign that worked before but doesn't work now
2. **New Feature Issues**: New parameters not working as expected
3. **Validation Issues**: Unclear or missing error messages
4. **Performance Issues**: Slower response times or memory problems

## 📊 Success Criteria

The beta is successful if:
- ✅ All existing campaign creation calls work identically
- ✅ New parameters work as documented
- ✅ Error handling is clear and helpful
- ✅ No performance regressions
- ✅ HTML formatting works in all scenarios

## 🎯 Next Steps After Testing

1. **Feedback**: Report any issues or suggestions
2. **Production**: If testing successful, promote to stable version
3. **Documentation**: Update main documentation with new features
4. **Examples**: Add real-world usage examples

---

## 📞 Support

For questions or issues during beta testing:
- Check the `manual-test-examples.md` file for detailed test cases
- Review the `MULTI-STEP-IMPROVEMENTS-SUMMARY.md` for implementation details
- Test with the `test-basic-functionality.cjs` script for core logic verification

Happy testing! 🚀
