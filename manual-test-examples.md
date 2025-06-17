# Manual Test Examples for Multi-Step Campaign Improvements

## Test 1: Backward Compatibility - Basic Single Step
**Purpose**: Ensure existing single-step campaigns work exactly as before

```json
{
  "stage": "preview",
  "name": "Test Basic Campaign",
  "subject": "Hello {{firstName}}",
  "body": "Hi {{firstName}},\n\nThis is a test email.\n\nBest regards,\nTest Team",
  "email_list": ["test@example.com"],
  "sequence_steps": 1
}
```

**Expected Result**: Single step with original subject and body, HTML paragraph formatting applied.

## Test 2: Backward Compatibility - Multi-Step with Default Behavior
**Purpose**: Ensure existing multi-step campaigns work with follow-up prefixes

```json
{
  "stage": "preview", 
  "name": "Test Multi-Step Default",
  "subject": "Hello {{firstName}}",
  "body": "Hi {{firstName}},\n\nThis is a test email.\n\nBest regards,\nTest Team",
  "email_list": ["test@example.com"],
  "sequence_steps": 3,
  "step_delay_days": 2
}
```

**Expected Result**: 
- Step 1: "Hello {{firstName}}" + original body
- Step 2: "Follow-up 1: Hello {{firstName}}" + "This is follow-up #1.\n\n" + original body
- Step 3: "Follow-up 2: Hello {{firstName}}" + "This is follow-up #2.\n\n" + original body

## Test 3: New Feature - Custom Sequence Bodies
**Purpose**: Test custom body content for each sequence step

```json
{
  "stage": "preview",
  "name": "Test Custom Bodies",
  "subject": "Hello {{firstName}}",
  "body": "This will be overridden",
  "email_list": ["test@example.com"],
  "sequence_steps": 3,
  "sequence_bodies": [
    "Hi {{firstName}},\n\nI noticed {{companyName}} and wanted to reach out.\n\nBest,\nJohn",
    "Hey {{firstName}},\n\nJust following up on my previous email about {{companyName}}.\n\nThanks,\nJohn",
    "Hi {{firstName}},\n\nI'll keep this brief - still interested in discussing {{companyName}}?\n\nRegards,\nJohn"
  ]
}
```

**Expected Result**: Each step uses the corresponding custom body from the array, not the original body parameter.

## Test 4: New Feature - Custom Sequence Subjects
**Purpose**: Test custom subject lines for each sequence step

```json
{
  "stage": "preview",
  "name": "Test Custom Subjects",
  "subject": "This will be overridden",
  "body": "Hi {{firstName}},\n\nTest email content.\n\nBest,\nTeam",
  "email_list": ["test@example.com"],
  "sequence_steps": 3,
  "sequence_subjects": [
    "Quick question about {{companyName}}",
    "",
    ""
  ]
}
```

**Expected Result**: 
- Step 1: "Quick question about {{companyName}}"
- Step 2: "" (blank for threading)
- Step 3: "" (blank for threading)

## Test 5: New Feature - Continue Thread
**Purpose**: Test automatic thread continuation with blank follow-up subjects

```json
{
  "stage": "preview",
  "name": "Test Thread Continuation", 
  "subject": "Quick question about {{companyName}}",
  "body": "Hi {{firstName}},\n\nTest email content.\n\nBest,\nTeam",
  "email_list": ["test@example.com"],
  "sequence_steps": 3,
  "continue_thread": true
}
```

**Expected Result**:
- Step 1: "Quick question about {{companyName}}"
- Step 2: "" (blank for threading)
- Step 3: "" (blank for threading)

## Test 6: New Feature - Complete Custom Sequence
**Purpose**: Test both custom bodies and subjects together

```json
{
  "stage": "preview",
  "name": "Test Complete Custom",
  "subject": "Will be overridden",
  "body": "Will be overridden", 
  "email_list": ["test@example.com"],
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

## Test 7: Validation Tests
**Purpose**: Test parameter validation

### Invalid sequence_bodies length
```json
{
  "sequence_steps": 3,
  "sequence_bodies": ["Only one body"]
}
```
**Expected**: Error about insufficient array length

### Invalid sequence_subjects length  
```json
{
  "sequence_steps": 3,
  "sequence_subjects": ["Only", "Two"]
}
```
**Expected**: Error about insufficient array length

### Invalid continue_thread type
```json
{
  "continue_thread": "yes"
}
```
**Expected**: Error about boolean type requirement

## Success Criteria

1. **Backward Compatibility**: All existing campaign creation calls work identically
2. **New Parameters Optional**: All new parameters are completely optional
3. **Custom Content**: When new parameters are used, each sequence step has unique content
4. **Thread Continuation**: Follow-up emails can have blank subjects for threading
5. **Validation**: Proper error messages for invalid parameter combinations
6. **HTML Conversion**: Line breaks properly converted to HTML in all scenarios
