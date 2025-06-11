# 🚀 MCP Server Development Guide

**Comprehensive Knowledge Base for Building Production-Ready MCP Servers**

*Based on successful Instantly MCP v1.0.3 development experience*

---

## 📋 Table of Contents

1. [Technical Insights](#-technical-insights)
2. [Development Methodology](#-development-methodology)
3. [Quality Assurance Patterns](#-quality-assurance-patterns)
4. [Architecture Decisions](#-architecture-decisions)
5. [Shipping Best Practices](#-shipping-best-practices)
6. [Reusable Code Patterns](#-reusable-code-patterns)
7. [Quick Reference Checklists](#-quick-reference-checklists)

---

## 🔍 Technical Insights

### API Integration Challenges & Solutions

#### **Parameter Name Mismatches**

**Problem**: API documentation often contains outdated parameter names.

**Example from Instantly MCP**:
- Documentation: `{"account_id": "123"}`
- Actual API: `{"email": "user@example.com"}`

**Solution Pattern**:
```typescript
// Always test API endpoints manually first
const validateApiContract = async (endpoint: string, docParams: any) => {
  const alternatives = [
    docParams,                                    // Try documented format
    { email: docParams.account_id },             // Try common alternatives
    { account_email: docParams.account_id },     // Try variations
    { accountId: docParams.account_id }          // Try camelCase
  ];

  for (const params of alternatives) {
    try {
      const result = await makeApiRequest(endpoint, params);
      console.log(`✅ Working format for ${endpoint}:`, params);
      return params;
    } catch (error) {
      console.log(`❌ Failed format:`, params, error.message);
    }
  }

  throw new Error(`No working parameter format found for ${endpoint}`);
};
```

#### **Array vs String Parameter Issues**

**Problem**: APIs expect arrays but documentation shows strings.

**Example from Instantly MCP**:
- Tool parameter: `email: string`
- API requirement: `emails: string[]`

**Solution Pattern**:
```typescript
// Check API specification examples, not just parameter types
const normalizeApiParameters = (toolParams: any, apiSpec: any) => {
  const normalized = { ...toolParams };

  // Convert single values to arrays where API expects arrays
  if (apiSpec.emails?.type === 'array' && typeof toolParams.email === 'string') {
    normalized.emails = [toolParams.email];
    delete normalized.email;
  }

  // Validate array constraints
  if (normalized.emails && Array.isArray(normalized.emails)) {
    if (normalized.emails.length === 0) {
      throw new Error('emails array cannot be empty');
    }
    if (normalized.emails.length > 100) {
      throw new Error('emails array cannot exceed 100 items');
    }
  }

  return normalized;
};
```

#### **Authentication Scope Issues**

**Problem**: API returns 403 for valid requests due to insufficient scopes.

**Solution Pattern**:
```typescript
const checkFeatureAvailability = async () => {
  const features: Record<string, string> = {};

  const testEndpoints = [
    { name: 'basic_operations', endpoint: '/accounts', method: 'GET' },
    { name: 'premium_features', endpoint: '/warmup-analytics', method: 'POST' },
    { name: 'admin_features', endpoint: '/api-keys', method: 'GET' }
  ];

  for (const test of testEndpoints) {
    try {
      await makeApiRequest(test.endpoint, {}, test.method);
      features[test.name] = 'Available';
    } catch (error: any) {
      if (error.status === 403) {
        features[test.name] = 'Requires premium plan or additional scopes';
      } else if (error.status === 400) {
        features[test.name] = 'Available (400 expected for test data)';
      } else {
        features[test.name] = `Error: ${error.message}`;
      }
    }
  }

  return features;
};
```

---

## ⚡ Development Methodology

### Rapid Development Framework

#### **Phase 1: Foundation (Days 1-2)**

**Step 1: API Discovery**
```bash
# Manual API exploration script
#!/bin/bash
API_BASE="https://api.platform.com/v2"
API_KEY="your_key_here"

echo "🔍 Discovering API endpoints..."

# Test core endpoints
curl -H "Authorization: Bearer $API_KEY" "$API_BASE/accounts" | jq '.'
curl -H "Authorization: Bearer $API_KEY" "$API_BASE/campaigns" | jq '.'

# Test parameter formats
curl -X POST "$API_BASE/test-endpoint" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"test_param": "value"}' | jq '.'

echo "📝 Document findings in api-discovery.md"
```

**Step 2: Project Structure**
```
src/
├── index.ts              # Main server file
├── error-handler.ts      # Centralized error handling
├── rate-limiter.ts       # API rate limiting
├── pagination.ts         # Pagination utilities
└── validation.ts         # Parameter validation
```

**Step 3: Essential Dependencies**
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0"
  },
  "scripts": {
    "build": "tsc",
    "test": "tsx test-all-tools.ts",
    "validate": "tsx validate-tools.ts"
  }
}
```

#### **Phase 2: Core Tools (Days 3-5)**

**Tool Development Priority**:
1. **List Operations** (`list_accounts`, `list_campaigns`) - Foundation for other tools
2. **Get Operations** (`get_account`, `get_campaign`) - Individual record access
3. **Create Operations** (`create_campaign`) - Primary use cases
4. **Update Operations** (`update_campaign`) - Secondary functionality
5. **Delete Operations** - Only if absolutely necessary

**Development Pattern**:
```typescript
// Build one tool at a time, test immediately
const developTool = async (toolName: string) => {
  // 1. Define tool schema
  const toolDefinition = {
    name: toolName,
    description: `Detailed description with prerequisites and examples`,
    inputSchema: { /* comprehensive schema */ }
  };

  // 2. Implement handler
  const handler = async (args: any) => {
    validateParameters(args, toolName);
    const result = await makeApiRequest(`/${toolName}`, args);
    return formatResponse(result);
  };

  // 3. Test immediately with real API
  await testTool(toolName, getValidTestParams(toolName));

  // 4. Document any issues found
  console.log(`✅ ${toolName} working correctly`);
};
```

#### **Phase 3: Enhancement (Days 6-8)**

**Enhancement Checklist**:
- [ ] Add pagination support for list operations
- [ ] Implement comprehensive parameter validation
- [ ] Add tool interdependency checks
- [ ] Create intelligent error messages with next steps
- [ ] Add optional parameters with sensible defaults

#### **Phase 4: Quality Assurance (Days 9-10)**

**QA Process**:
1. **Individual Tool Testing** - Each tool with various parameter combinations
2. **Integration Testing** - Tool chains (e.g., list_accounts → create_campaign)
3. **Error Scenario Testing** - Invalid parameters, missing auth, etc.
4. **Success Rate Calculation** - Aim for >75% working tools

---

## 🔍 Quality Assurance Patterns

### Three-Layer Testing Strategy

#### **Layer 1: Tool Definition Validation**
```typescript
const validateToolDefinitions = () => {
  const tools = server.listTools();
  console.log(`🔍 Validating ${tools.length} tool definitions...`);

  const issues: string[] = [];

  tools.forEach(tool => {
    // Check required fields
    if (!tool.name) issues.push(`Tool missing name`);
    if (!tool.description) issues.push(`${tool.name}: Missing description`);
    if (!tool.inputSchema) issues.push(`${tool.name}: Missing input schema`);

    // Check description quality
    if (tool.description.length < 50) {
      issues.push(`${tool.name}: Description too brief`);
    }

    // Check for prerequisite documentation
    if (tool.name.includes('create') && !tool.description.includes('PREREQUISITE')) {
      issues.push(`${tool.name}: Missing prerequisite documentation`);
    }
  });

  if (issues.length > 0) {
    console.log('❌ Tool definition issues found:');
    issues.forEach(issue => console.log(`  - ${issue}`));
    throw new Error('Tool validation failed');
  }

  console.log('✅ All tool definitions valid');
};
```

#### **Layer 2: Parameter Validation Testing**
```typescript
const testParameterValidation = async () => {
  const testCases = [
    // Valid cases
    { tool: 'list_accounts', params: {}, shouldSucceed: true },
    { tool: 'list_accounts', params: { limit: 10 }, shouldSucceed: true },

    // Invalid cases
    { tool: 'create_campaign', params: {}, shouldSucceed: false }, // Missing required
    { tool: 'get_warmup_analytics', params: { emails: [] }, shouldSucceed: false }, // Empty array
    { tool: 'get_warmup_analytics', params: { emails: ['invalid'] }, shouldSucceed: false }, // Invalid email
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      await callTool(testCase.tool, testCase.params);
      if (testCase.shouldSucceed) {
        console.log(`✅ ${testCase.tool}: Valid params accepted`);
        passed++;
      } else {
        console.log(`❌ ${testCase.tool}: Should have rejected invalid params`);
        failed++;
      }
    } catch (error) {
      if (!testCase.shouldSucceed) {
        console.log(`✅ ${testCase.tool}: Invalid params correctly rejected`);
        passed++;
      } else {
        console.log(`❌ ${testCase.tool}: Valid params incorrectly rejected`);
        failed++;
      }
    }
  }

  console.log(`📊 Parameter validation: ${passed}/${passed + failed} tests passed`);
};
```

#### **Layer 3: End-to-End API Testing**
```typescript
const testRealApiIntegration = async () => {
  console.log('🌐 Testing real API integration...');

  try {
    // Test dependency chain
    const accounts = await callTool('list_accounts', { limit: 3 });
    console.log(`✅ Retrieved ${accounts.data?.length || 0} accounts`);

    if (accounts.data?.length > 0) {
      const testEmail = accounts.data[0].email;

      // Test dependent tool
      const analytics = await callTool('get_warmup_analytics', {
        emails: [testEmail]
      });
      console.log(`✅ Retrieved analytics for ${testEmail}`);

      // Test create operation
      const campaign = await callTool('create_campaign', {
        stage: 'preview',
        name: 'Test Campaign',
        subject: 'Test Subject',
        body: 'Test body content',
        email_list: [testEmail]
      });
      console.log(`✅ Campaign preview generated`);
    }

    console.log('✅ End-to-end testing completed successfully');
  } catch (error) {
    console.log(`❌ End-to-end testing failed: ${error.message}`);
    throw error;
  }
};
```

### Three-Stage Workflow Validation

**Pattern for Complex Operations**:
```typescript
const validateThreeStageWorkflow = async () => {
  console.log('🔄 Testing three-stage workflow...');

  // Stage 1: Prerequisite Check
  const prereq = await callTool('create_campaign', {
    stage: 'prerequisite_check'
  });

  if (prereq.status !== 'prerequisites_ready') {
    throw new Error('Prerequisites not met');
  }
  console.log('✅ Stage 1: Prerequisites validated');

  // Stage 2: Preview
  const preview = await callTool('create_campaign', {
    stage: 'preview',
    name: 'Test Campaign',
    subject: 'Test Subject',
    body: 'Test Body',
    email_list: prereq.eligible_accounts.slice(0, 1).map(a => a.email)
  });

  if (preview.status !== 'configuration_ready') {
    throw new Error('Preview generation failed');
  }
  console.log('✅ Stage 2: Preview generated');

  // Stage 3: Creation (optional - only if safe)
  if (process.env.ENABLE_DESTRUCTIVE_TESTS === 'true') {
    const creation = await callTool('create_campaign', {
      stage: 'create',
      confirm_creation: true,
      ...preview.campaign_preview
    });
    console.log('✅ Stage 3: Campaign created');
  } else {
    console.log('⏭️ Stage 3: Skipped (destructive test)');
  }

  return { prereq, preview };
};
```

### Success Rate Tracking

```typescript
const calculateSuccessRate = async () => {
  const tools = getAllTools();
  const results = {
    working: 0,
    failing: 0,
    total: tools.length,
    details: [] as Array<{name: string, status: string, error?: string}>
  };

  for (const tool of tools) {
    try {
      await testTool(tool.name, getValidTestParams(tool.name));
      results.working++;
      results.details.push({ name: tool.name, status: 'working' });
      console.log(`✅ ${tool.name}`);
    } catch (error) {
      results.failing++;
      results.details.push({
        name: tool.name,
        status: 'failing',
        error: error.message
      });
      console.log(`❌ ${tool.name}: ${error.message}`);
    }
  }

  const successRate = (results.working / results.total * 100).toFixed(1);
  console.log(`\n📊 SUCCESS RATE: ${results.working}/${results.total} (${successRate}%)`);

  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    successRate: parseFloat(successRate),
    ...results
  };

  // Save report for tracking
  require('fs').writeFileSync(
    `test-report-${Date.now()}.json`,
    JSON.stringify(report, null, 2)
  );

  return report;
};
```

---

## 🏗️ Architecture Decisions

### What Worked Well

#### **Incremental Tool Development**

**Decision**: Build and test one tool at a time before moving to the next.

**Implementation**:
```typescript
// Development order that minimizes dependencies
const DEVELOPMENT_ORDER = [
  // Foundation tools (no dependencies)
  'list_accounts',
  'list_campaigns',
  'list_leads',

  // Individual record tools (depend on list tools for IDs)
  'get_account',
  'get_campaign',
  'get_lead',

  // Create tools (depend on list tools for valid parameters)
  'create_campaign',
  'create_lead',

  // Update tools (depend on create tools for test data)
  'update_campaign',
  'update_lead'
];

const developInOrder = async () => {
  for (const toolName of DEVELOPMENT_ORDER) {
    console.log(`🔨 Developing ${toolName}...`);
    await developTool(toolName);
    await testTool(toolName);
    console.log(`✅ ${toolName} completed and tested`);
  }
};
```

**Benefits**:
- Each tool builds on proven foundation
- Issues caught early before they compound
- Clear progress tracking
- Easier debugging and troubleshooting

#### **Centralized Error Handling**

**Decision**: Create unified error handling for consistent user experience.

**Implementation**:
```typescript
// error-handler.ts
export const handleApiError = (error: any, toolName: string, context?: any) => {
  // Log for debugging
  console.error(`[${toolName}] API Error:`, error.message, context);

  // Handle specific error types
  if (error.message?.includes('400')) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `${toolName} failed: Invalid parameters. ${getParameterGuidance(toolName)}`
    );
  }

  if (error.message?.includes('401')) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Authentication failed. Check your API key and permissions.`
    );
  }

  if (error.message?.includes('403')) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Access denied. This feature may require a premium plan or additional API scopes.`
    );
  }

  if (error.message?.includes('404')) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Resource not found. Check that the ID exists and you have access to it.`
    );
  }

  if (error.message?.includes('429')) {
    throw new McpError(
      ErrorCode.InternalError,
      `Rate limit exceeded. Please wait before making more requests.`
    );
  }

  // Generic error
  throw new McpError(
    ErrorCode.InternalError,
    `${toolName} failed: ${error.message}`
  );
};

const getParameterGuidance = (toolName: string): string => {
  const guidance = {
    'create_campaign': 'Use list_accounts first to get valid email addresses for email_list parameter.',
    'get_warmup_analytics': 'Provide emails as an array, e.g., {"emails": ["user@example.com"]}',
    'update_account': 'Use email address instead of account_id parameter.',
  };

  return guidance[toolName] || 'Check the tool documentation for required parameters.';
};
```

#### **Intelligent Tool Descriptions**

**Decision**: Use tool descriptions to prevent errors through guidance.

**Pattern**:
```typescript
const createIntelligentToolDescription = (toolName: string, baseDescription: string) => {
  const prerequisites = getToolPrerequisites(toolName);
  const commonErrors = getCommonErrors(toolName);
  const examples = getUsageExamples(toolName);

  return [
    baseDescription,
    prerequisites ? `**PREREQUISITE**: ${prerequisites}` : '',
    commonErrors ? `**COMMON ERRORS**: ${commonErrors}` : '',
    examples ? `**EXAMPLE**: ${examples}` : ''
  ].filter(Boolean).join('\n\n');
};

const getToolPrerequisites = (toolName: string): string | null => {
  const prereqs = {
    'create_campaign': 'Call list_accounts first to obtain valid email addresses for the email_list parameter. Campaign creation will fail if you use email addresses not returned by list_accounts.',
    'reply_to_email': 'Use list_emails or get_email to obtain a valid reply_to_uuid before calling this tool.',
    'update_campaign': 'Use list_campaigns to get a valid campaign_id before updating.',
  };

  return prereqs[toolName] || null;
};
```

### What to Avoid

#### **Complex Multi-Step Wizards**

**Problem**: Multi-step wizards create state management complexity and poor user experience.

**Anti-Pattern**:
```typescript
// DON'T DO THIS - Complex wizard with state
class CampaignWizard {
  private state: any = {};

  async step1_collectAccounts() { /* ... */ }
  async step2_validateInputs() { /* ... */ }
  async step3_generatePreview() { /* ... */ }
  async step4_confirmCreation() { /* ... */ }
}
```

**Better Approach**:
```typescript
// DO THIS - Simple tools with intelligent stage detection
const createCampaign = async (args: any) => {
  const stage = determineStage(args);

  switch (stage) {
    case 'prerequisite_check':
      return await checkPrerequisites();
    case 'preview':
      return await generatePreview(args);
    case 'create':
      return await createCampaign(args);
  }
};

const determineStage = (args: any): string => {
  if (args.stage) return args.stage;
  if (hasAllRequiredFields(args)) return 'create';
  if (hasSomeFields(args)) return 'preview';
  return 'prerequisite_check';
};
```

#### **Keeping Broken Tools**

**Decision**: Remove non-working tools rather than shipping broken functionality.

**Rationale**:
- Better to have 22 working tools than 28 tools with 6 broken
- Users prefer reliable subset over unreliable full set
- Easier to maintain and support
- Clear success metrics (78.6% vs unclear mixed results)

**Implementation**:
```typescript
// Remove tools that consistently fail
const REMOVED_TOOLS = [
  'activate_campaign',  // 400 Bad Request - needs prerequisites
  'move_leads',         // 400 Bad Request - unclear parameters
  'create_api_key',     // 400 Bad Request - scope handling issues
  'create_account'      // 400 Bad Request - complex IMAP/SMTP requirements
];

// Document removal reasons for future reference
const REMOVAL_REASONS = {
  'activate_campaign': 'Requires leads to be attached first, complex prerequisites',
  'move_leads': 'Unclear required parameters, API documentation insufficient',
  'create_api_key': 'Scope parameter handling varies by plan, unreliable',
  'create_account': 'Complex IMAP/SMTP configuration requirements'
};
```

---

## 🚢 Shipping Best Practices

### Version Management Strategy

#### **Semantic Versioning Approach**

**Pattern**: Start with 1.0.0 and increment logically.

```json
{
  "version": "1.0.0",  // Initial release with core functionality
  "version": "1.0.1",  // Bug fixes and minor improvements
  "version": "1.0.2",  // Additional fixes, tool removals
  "version": "1.0.3"   // Parameter fixes, enhanced validation
}
```

**Version Alignment Checklist**:
- [ ] package.json version updated
- [ ] Server definition version updated
- [ ] README.md version references updated
- [ ] CHANGELOG.md entry added
- [ ] Git tag created for release

#### **Tool Removal Strategy**

**Decision Matrix**:
```typescript
const evaluateToolForRemoval = (tool: any, testResults: any) => {
  const criteria = {
    successRate: testResults.successRate < 50,           // Less than 50% success
    userImpact: tool.usage === 'low',                    // Low usage feature
    fixComplexity: tool.fixEffort > 'medium',            // High effort to fix
    workaround: tool.hasManualWorkaround === true,       // Can be done manually
    coreFeature: tool.isCoreFeature === false            // Not essential
  };

  const removalScore = Object.values(criteria).filter(Boolean).length;

  if (removalScore >= 3) {
    return {
      action: 'remove',
      reason: `Tool meets ${removalScore}/5 removal criteria`,
      criteria: criteria
    };
  }

  return {
    action: 'keep',
    reason: 'Tool meets retention criteria',
    criteria: criteria
  };
};
```

**Removal Documentation**:
```typescript
// Document removed tools for future reference
const REMOVED_TOOLS_MANIFEST = {
  version: '1.0.3',
  removedTools: [
    {
      name: 'activate_campaign',
      reason: 'API requires complex prerequisites not documented',
      workaround: 'Activate campaigns manually in platform dashboard',
      futureConsideration: 'Add back when prerequisite workflow is understood'
    }
  ],
  retainedTools: 22,
  successRate: '78.6%'
};
```

### Production Deployment Process

#### **Pre-Release Checklist**

```typescript
const preReleaseChecklist = async () => {
  const checks = [
    { name: 'Build passes', test: () => runBuild() },
    { name: 'All tests pass', test: () => runTests() },
    { name: 'Success rate >75%', test: () => checkSuccessRate() },
    { name: 'No hardcoded secrets', test: () => scanForSecrets() },
    { name: 'Documentation updated', test: () => validateDocs() },
    { name: 'Version aligned', test: () => checkVersionAlignment() }
  ];

  console.log('🔍 Running pre-release checks...');

  for (const check of checks) {
    try {
      await check.test();
      console.log(`✅ ${check.name}`);
    } catch (error) {
      console.log(`❌ ${check.name}: ${error.message}`);
      throw new Error(`Pre-release check failed: ${check.name}`);
    }
  }

  console.log('✅ All pre-release checks passed');
};
```

#### **Release Process**

```bash
#!/bin/bash
# release.sh - Automated release script

set -e

echo "🚀 Starting release process..."

# 1. Run pre-release checks
npm run test
npm run validate
npm run build

# 2. Update version
npm version patch --no-git-tag-version

# 3. Commit changes
git add .
git commit -m "Release v$(node -p "require('./package.json').version")"

# 4. Create tag
git tag "v$(node -p "require('./package.json').version")"

# 5. Push to repository
git push origin main
git push origin --tags

# 6. Publish to npm
npm publish

echo "✅ Release completed successfully"
```

#### **Post-Release Validation**

```typescript
const validateRelease = async (version: string) => {
  console.log(`🔍 Validating release ${version}...`);

  // Check npm package
  const npmInfo = await exec(`npm info instantly-mcp@${version}`);
  if (!npmInfo.includes(version)) {
    throw new Error('Package not found on npm');
  }

  // Test installation
  await exec(`npm install -g instantly-mcp@${version}`);

  // Test basic functionality
  const testResult = await exec('instantly-mcp --version');
  if (!testResult.includes(version)) {
    throw new Error('Installed version mismatch');
  }

  console.log('✅ Release validation completed');
};
```

---

## 🧩 Reusable Code Patterns

### Parameter Validation Patterns

#### **Comprehensive Validation Function**

```typescript
// validation.ts
export const validateToolParameters = (args: any, toolName: string) => {
  const schema = getToolSchema(toolName);
  const errors: string[] = [];

  // Check required parameters
  for (const required of schema.required || []) {
    if (!args?.[required]) {
      errors.push(`${required} is required`);
    }
  }

  // Validate parameter types and formats
  for (const [key, value] of Object.entries(args || {})) {
    const paramSchema = schema.properties?.[key];
    if (!paramSchema) continue;

    // Type validation
    if (paramSchema.type === 'array' && !Array.isArray(value)) {
      errors.push(`${key} must be an array`);
    }

    if (paramSchema.type === 'string' && typeof value !== 'string') {
      errors.push(`${key} must be a string`);
    }

    // Format validation
    if (key.includes('email') && !isValidEmail(value as string)) {
      errors.push(`${key} must be a valid email address`);
    }

    // Array constraints
    if (Array.isArray(value)) {
      if (paramSchema.minItems && value.length < paramSchema.minItems) {
        errors.push(`${key} must have at least ${paramSchema.minItems} items`);
      }
      if (paramSchema.maxItems && value.length > paramSchema.maxItems) {
        errors.push(`${key} cannot have more than ${paramSchema.maxItems} items`);
      }
    }
  }

  if (errors.length > 0) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `${toolName} validation failed: ${errors.join(', ')}. ${getParameterGuidance(toolName)}`
    );
  }
};

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};
```

#### **Tool Schema Definitions**

```typescript
// schemas.ts
export const TOOL_SCHEMAS = {
  list_accounts: {
    properties: {
      limit: { type: 'number', minimum: 1, maximum: 100 },
      starting_after: { type: 'string' }
    },
    required: []
  },

  get_warmup_analytics: {
    properties: {
      emails: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: 100
      },
      start_date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      end_date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }
    },
    required: ['emails']
  },

  create_campaign: {
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      subject: { type: 'string', minLength: 1, maxLength: 255 },
      body: { type: 'string', minLength: 1 },
      email_list: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: 100
      },
      stage: {
        type: 'string',
        enum: ['prerequisite_check', 'preview', 'create']
      },
      confirm_creation: { type: 'boolean' }
    },
    required: ['name', 'subject', 'body', 'email_list']
  }
};

export const getToolSchema = (toolName: string) => {
  return TOOL_SCHEMAS[toolName] || { properties: {}, required: [] };
};
```

### Error Handling Patterns

#### **Centralized Error Handler**

```typescript
// error-handler.ts
export const createErrorHandler = (apiName: string) => {
  return (error: any, toolName: string, context?: any) => {
    // Log for debugging
    console.error(`[${apiName}:${toolName}] Error:`, {
      message: error.message,
      status: error.status,
      context
    });

    // Extract status code
    const status = error.status || extractStatusFromMessage(error.message);

    // Handle by status code
    switch (status) {
      case 400:
        throw new McpError(
          ErrorCode.InvalidParams,
          `${toolName} failed: Invalid parameters. ${getParameterGuidance(toolName, apiName)}`
        );

      case 401:
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Authentication failed. Check your ${apiName} API key.`
        );

      case 403:
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Access denied. This feature may require a premium ${apiName} plan or additional API scopes.`
        );

      case 404:
        throw new McpError(
          ErrorCode.InvalidParams,
          `Resource not found. Check that the ID exists and you have access to it.`
        );

      case 429:
        throw new McpError(
          ErrorCode.InternalError,
          `Rate limit exceeded. Please wait before making more requests to ${apiName}.`
        );

      default:
        throw new McpError(
          ErrorCode.InternalError,
          `${toolName} failed: ${error.message}`
        );
    }
  };
};

const extractStatusFromMessage = (message: string): number | null => {
  const statusMatch = message.match(/(\d{3})/);
  return statusMatch ? parseInt(statusMatch[1]) : null;
};
```

### Tool Definition Patterns

#### **Intelligent Tool Factory**

```typescript
// tool-factory.ts
export const createTool = (config: ToolConfig) => {
  return {
    name: config.name,
    description: buildIntelligentDescription(config),
    inputSchema: {
      type: 'object',
      properties: config.parameters,
      required: config.required || []
    }
  };
};

interface ToolConfig {
  name: string;
  baseDescription: string;
  parameters: Record<string, any>;
  required?: string[];
  prerequisites?: string[];
  examples?: string[];
  commonErrors?: string[];
}

const buildIntelligentDescription = (config: ToolConfig): string => {
  const parts = [config.baseDescription];

  if (config.prerequisites?.length) {
    parts.push(`**PREREQUISITES**: ${config.prerequisites.join(', ')}`);
  }

  if (config.commonErrors?.length) {
    parts.push(`**COMMON ERRORS**: ${config.commonErrors.join(', ')}`);
  }

  if (config.examples?.length) {
    parts.push(`**EXAMPLES**: ${config.examples.join(', ')}`);
  }

  return parts.join('\n\n');
};

// Usage example
const campaignTool = createTool({
  name: 'create_campaign',
  baseDescription: 'Create a new email campaign with automatic HTML paragraph formatting.',
  parameters: {
    name: { type: 'string', description: 'Campaign name' },
    subject: { type: 'string', description: 'Email subject line' },
    body: { type: 'string', description: 'Email body content' },
    email_list: {
      type: 'array',
      items: { type: 'string' },
      description: 'Array of sender email addresses'
    }
  },
  required: ['name', 'subject', 'body', 'email_list'],
  prerequisites: [
    'Call list_accounts first to obtain valid email addresses',
    'Ensure accounts are verified and active'
  ],
  examples: [
    '{"name": "Q2 Outreach", "subject": "Partnership opportunity", "body": "Hi {{firstName}},\\n\\nInterested in exploring a partnership?", "email_list": ["sender@company.com"]}'
  ],
  commonErrors: [
    'Using email addresses not returned by list_accounts',
    'Missing required personalization variables'
  ]
});
```

### API Request Patterns

#### **Robust API Client**

```typescript
// api-client.ts
export const createApiClient = (baseUrl: string, apiKey: string) => {
  const makeRequest = async (
    endpoint: string,
    method: string = 'GET',
    data?: any,
    options: RequestOptions = {}
  ) => {
    const url = `${baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Rate limiting
    await rateLimiter.checkLimit();

    // Log request for debugging
    console.log(`[API] ${method} ${endpoint}`, data ? { data } : '');

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        ...options
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`[API] ${method} ${endpoint} - Success`);

      return result;
    } catch (error) {
      console.error(`[API] ${method} ${endpoint} - Error:`, error.message);
      throw error;
    }
  };

  return {
    get: (endpoint: string, options?: RequestOptions) =>
      makeRequest(endpoint, 'GET', undefined, options),
    post: (endpoint: string, data: any, options?: RequestOptions) =>
      makeRequest(endpoint, 'POST', data, options),
    patch: (endpoint: string, data: any, options?: RequestOptions) =>
      makeRequest(endpoint, 'PATCH', data, options),
    delete: (endpoint: string, options?: RequestOptions) =>
      makeRequest(endpoint, 'DELETE', undefined, options)
  };
};

interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
}
```

#### **Pagination Handler**

```typescript
// pagination.ts
export const handlePagination = async <T>(
  apiCall: (params: any) => Promise<any>,
  initialParams: any = {},
  options: PaginationOptions = {}
): Promise<T[]> => {
  const {
    maxItems = 1000,
    pageSize = 100,
    startingAfterKey = 'starting_after',
    dataKey = 'data',
    hasMoreKey = 'has_more'
  } = options;

  const allItems: T[] = [];
  let params = { ...initialParams, limit: pageSize };
  let hasMore = true;

  while (hasMore && allItems.length < maxItems) {
    const response = await apiCall(params);
    const items = response[dataKey] || [];

    allItems.push(...items);

    // Check if there are more items
    hasMore = response[hasMoreKey] === true && items.length === pageSize;

    if (hasMore && items.length > 0) {
      // Set up next page parameters
      const lastItem = items[items.length - 1];
      params[startingAfterKey] = lastItem.id;
    }

    // Safety break
    if (allItems.length >= maxItems) {
      console.warn(`Pagination stopped at ${maxItems} items limit`);
      break;
    }
  }

  return allItems.slice(0, maxItems);
};

interface PaginationOptions {
  maxItems?: number;
  pageSize?: number;
  startingAfterKey?: string;
  dataKey?: string;
  hasMoreKey?: string;
}
```

---

## 📋 Quick Reference Checklists

### 🚀 New MCP Server Setup Checklist

#### **Day 1: Foundation**
- [ ] Research API documentation thoroughly
- [ ] Test core endpoints manually with curl/Postman
- [ ] Document parameter mismatches and quirks
- [ ] Set up project structure with proven patterns
- [ ] Install essential dependencies
- [ ] Create basic error handling infrastructure

#### **Day 2-3: Core Tools**
- [ ] Implement list operations first (accounts, campaigns, etc.)
- [ ] Test each tool individually with real API key
- [ ] Add parameter validation for each tool
- [ ] Create intelligent tool descriptions with prerequisites
- [ ] Document any API issues discovered

#### **Day 4-5: Enhancement**
- [ ] Add pagination support for list operations
- [ ] Implement tool interdependency checks
- [ ] Create comprehensive error messages
- [ ] Add optional parameters with defaults
- [ ] Test tool chains (e.g., list → create workflows)

#### **Day 6-7: Quality Assurance**
- [ ] Run three-layer testing strategy
- [ ] Calculate and document success rate
- [ ] Test error scenarios and edge cases
- [ ] Validate tool descriptions accuracy
- [ ] Remove or fix consistently failing tools

#### **Day 8-9: Preparation**
- [ ] Update documentation with working examples
- [ ] Align all version numbers
- [ ] Create release notes and changelog
- [ ] Run pre-release checklist
- [ ] Test installation and basic functionality

#### **Day 10: Release**
- [ ] Build and test distribution files
- [ ] Publish to npm registry
- [ ] Create git tag and push to repository
- [ ] Validate release installation
- [ ] Document known limitations and roadmap

### 🔍 Tool Development Checklist

#### **For Each New Tool**
- [ ] Research API endpoint documentation
- [ ] Test endpoint manually with valid parameters
- [ ] Identify parameter name mismatches
- [ ] Check for array vs string requirements
- [ ] Implement parameter validation
- [ ] Create intelligent tool description
- [ ] Add prerequisite documentation
- [ ] Test with real API key
- [ ] Document any limitations or quirks
- [ ] Add to integration test suite

### 🧪 Quality Assurance Checklist

#### **Before Each Release**
- [ ] All tools pass individual testing
- [ ] Success rate calculated and documented
- [ ] Error handling tested for all scenarios
- [ ] Tool descriptions accurate and helpful
- [ ] No hardcoded secrets or API keys
- [ ] Documentation updated with examples
- [ ] Version numbers aligned across all files
- [ ] Build process completes without errors
- [ ] Installation test passes
- [ ] Basic functionality test passes

### 🚢 Release Checklist

#### **Pre-Release**
- [ ] Run comprehensive test suite
- [ ] Verify success rate meets target (>75%)
- [ ] Update CHANGELOG.md with changes
- [ ] Update README.md with new features
- [ ] Bump version number in all locations
- [ ] Create release commit with descriptive message

#### **Release**
- [ ] Create and push git tag
- [ ] Publish to npm registry
- [ ] Verify package appears on npm
- [ ] Test installation from npm
- [ ] Update repository documentation

#### **Post-Release**
- [ ] Monitor for installation issues
- [ ] Respond to user feedback
- [ ] Document any discovered issues
- [ ] Plan next iteration improvements

---

## 🎯 Success Metrics

### Key Performance Indicators

- **Tool Success Rate**: >75% of tools working correctly
- **API Coverage**: Core operations (list, get, create, update) implemented
- **Error Handling**: Comprehensive validation and helpful error messages
- **Documentation Quality**: Prerequisites and examples for all tools
- **User Experience**: Clear guidance and predictable behavior
- **Maintainability**: Clean code structure and comprehensive testing

### Lessons Learned Summary

1. **API Documentation is Often Wrong** - Always verify with manual testing
2. **Remove Rather Than Fix** - Better to ship working subset than broken full set
3. **Test Early and Often** - Real API testing catches issues mock testing misses
4. **Intelligent Descriptions Prevent Errors** - Guide users to success through tool descriptions
5. **Incremental Development Works** - Build one tool at a time, test immediately
6. **Centralized Error Handling** - Consistent user experience across all tools
7. **Version Management Matters** - Start with 1.0.0 and increment logically

---

*This guide represents battle-tested patterns from successful MCP server development. Use these patterns to accelerate your next MCP integration project.*
```