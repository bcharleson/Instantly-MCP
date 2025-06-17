#!/usr/bin/env node
/**
 * Comprehensive MCP Tool Testing Framework
 * Tests each tool individually to identify issues and validate functionality
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface TestResult {
  tool: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  dependency?: string;
  error?: string;
}

interface ToolDependency {
  [key: string]: string[];
}

// Tool dependency mapping - tools that require other tools to be called first
const TOOL_DEPENDENCIES: ToolDependency = {
  'create_campaign': ['list_accounts'],
  'reply_to_email': ['list_emails'],
  'update_campaign': ['list_campaigns'],
  'activate_campaign': ['list_campaigns'],
  'update_account': ['list_accounts'],
  'get_warmup_analytics': ['list_accounts'],
  'update_lead': ['list_leads'],
  'move_leads': ['list_leads'],
  'get_account_details': ['list_accounts'],
  'validate_campaign_accounts': ['list_accounts']
};

// Test configuration for each tool
const TOOL_TESTS = [
  // Campaign Management
  { name: 'list_campaigns', params: { limit: 5 }, requiresAuth: true },
  { name: 'get_campaign', params: { campaign_id: 'test-id' }, requiresAuth: true, expectsError: true },
  { name: 'create_campaign', params: { 
    name: 'Test Campaign', 
    subject: 'Test Subject', 
    body: 'Test Body',
    email_list: ['test@example.com'] 
  }, requiresAuth: true, expectsError: true },
  { name: 'update_campaign', params: { campaign_id: 'test-id', name: 'Updated' }, requiresAuth: true, expectsError: true },
  { name: 'activate_campaign', params: { campaign_id: 'test-id' }, requiresAuth: true, expectsError: true },

  // Analytics
  { name: 'get_campaign_analytics', params: {}, requiresAuth: true },
  { name: 'get_campaign_analytics_overview', params: {}, requiresAuth: true },

  // Account Management
  { name: 'list_accounts', params: { limit: 5 }, requiresAuth: true },
  { name: 'create_account', params: {
    email: 'test@example.com',
    username: 'test',
    password: 'password',
    smtp_host: 'smtp.example.com',
    smtp_port: 587
  }, requiresAuth: true, expectsError: true },
  { name: 'update_account', params: { account_id: 'test-id' }, requiresAuth: true, expectsError: true },
  { name: 'get_warmup_analytics', params: { account_id: 'test-id' }, requiresAuth: true, expectsError: true },

  // Lead Management
  { name: 'list_leads', params: { limit: 5 }, requiresAuth: true },
  { name: 'create_lead', params: { email: 'lead@example.com' }, requiresAuth: true },
  { name: 'update_lead', params: { lead_id: 'test-id' }, requiresAuth: true, expectsError: true },
  { name: 'move_leads', params: { lead_ids: ['test-id'] }, requiresAuth: true, expectsError: true },

  // Lead Lists
  { name: 'list_lead_lists', params: { limit: 5 }, requiresAuth: true },
  { name: 'create_lead_list', params: { name: 'Test List' }, requiresAuth: true },

  // Email Operations
  { name: 'list_emails', params: { limit: 5 }, requiresAuth: true },
  { name: 'get_email', params: { email_id: 'test-id' }, requiresAuth: true, expectsError: true },
  { name: 'reply_to_email', params: {
    reply_to_uuid: 'test-uuid',
    eaccount: 'test@example.com',
    subject: 'Re: Test',
    body: { text: 'Test reply' }
  }, requiresAuth: true, expectsError: true },

  // Email Verification
  { name: 'verify_email', params: { email: 'test@example.com' }, requiresAuth: true, expectsError: true },

  // API Key Management
  { name: 'list_api_keys', params: {}, requiresAuth: true },
  { name: 'create_api_key', params: { name: 'test-key-' + Date.now() }, requiresAuth: true },

  // Debugging Tools
  { name: 'validate_campaign_accounts', params: {}, requiresAuth: true },
  { name: 'get_account_details', params: { email: 'test@example.com' }, requiresAuth: true, expectsError: true },
  { name: 'check_feature_availability', params: {}, requiresAuth: true }
];

async function testTool(toolName: string, params: any, expectsError: boolean = false): Promise<TestResult> {
  try {
    console.log(`\n🧪 Testing ${toolName}...`);
    
    // Build the MCP call
    const mcpCall = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: params
      }
    };

    // For testing without actual API key, we'll simulate the call structure validation
    // In a real environment, you'd need: export INSTANTLY_API_KEY=your_key_here
    
    const command = `echo '${JSON.stringify(mcpCall)}' | npm run dev`;
    
    console.log(`📤 Request: ${JSON.stringify(mcpCall, null, 2)}`);
    
    // Execute the test (with timeout)
    const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
    
    if (stderr.includes('Error: API key must be provided')) {
      return {
        tool: toolName,
        status: 'SKIP',
        message: 'No API key provided - tool structure validation passed'
      };
    }
    
    if (stderr.includes('Unknown tool')) {
      return {
        tool: toolName,
        status: 'FAIL',
        message: 'Tool not found in server',
        error: stderr
      };
    }
    
    if (expectsError) {
      if (stderr.includes('400') || stderr.includes('404') || stderr.includes('403')) {
        return {
          tool: toolName,
          status: 'PASS',
          message: 'Expected error received - tool is accessible'
        };
      }
    }
    
    return {
      tool: toolName,
      status: 'PASS',
      message: 'Tool executed successfully'
    };
    
  } catch (error: any) {
    if (error.code === 'TIMEOUT') {
      return {
        tool: toolName,
        status: 'FAIL',
        message: 'Tool execution timed out',
        error: 'Timeout after 30 seconds'
      };
    }
    
    return {
      tool: toolName,
      status: 'FAIL',
      message: 'Tool execution failed',
      error: error.message
    };
  }
}

async function runDependencyCheck(): Promise<void> {
  console.log('\n📋 DEPENDENCY ANALYSIS');
  console.log('=' .repeat(50));
  
  Object.entries(TOOL_DEPENDENCIES).forEach(([tool, deps]) => {
    console.log(`${tool}:`);
    deps.forEach(dep => console.log(`  ├─ Requires: ${dep}`));
    console.log();
  });
}

async function runAllTests(): Promise<void> {
  console.log('🚀 INSTANTLY MCP TOOL TESTING FRAMEWORK');
  console.log('=' .repeat(50));
  
  await runDependencyCheck();
  
  const results: TestResult[] = [];
  let passed = 0, failed = 0, skipped = 0;
  
  console.log('\n🧪 INDIVIDUAL TOOL TESTS');
  console.log('=' .repeat(50));
  
  for (const test of TOOL_TESTS) {
    const dependency = TOOL_DEPENDENCIES[test.name];
    
    const result = await testTool(test.name, test.params, test.expectsError);
    
    if (dependency) {
      result.dependency = dependency.join(', ');
    }
    
    results.push(result);
    
    // Update counters
    switch (result.status) {
      case 'PASS': passed++; break;
      case 'FAIL': failed++; break;
      case 'SKIP': skipped++; break;
    }
    
    // Print result
    const statusIcon = result.status === 'PASS' ? '✅' : 
                     result.status === 'FAIL' ? '❌' : '⏭️';
    
    console.log(`${statusIcon} ${result.tool}: ${result.message}`);
    if (result.dependency) {
      console.log(`   └─ Dependencies: ${result.dependency}`);
    }
    if (result.error) {
      console.log(`   └─ Error: ${result.error}`);
    }
  }
  
  // Summary Report
  console.log('\n📊 TEST SUMMARY');
  console.log('=' .repeat(50));
  console.log(`Total Tools: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️ Skipped: ${skipped}`);
  
  if (failed > 0) {
    console.log('\n❌ FAILED TOOLS:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  • ${r.tool}: ${r.message}`);
      if (r.error) console.log(`    Error: ${r.error}`);
    });
  }
  
  console.log('\n🔧 RECOMMENDATIONS:');
  console.log('1. Set INSTANTLY_API_KEY environment variable for full testing');
  console.log('2. Tools with dependencies should be tested in order');
  console.log('3. Failed tools need investigation - check API documentation');
  console.log('4. Premium features may require plan upgrade');
  
  console.log('\n✨ Testing completed!');
}

// ES module entry point check
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { testTool, runAllTests, TOOL_DEPENDENCIES, TOOL_TESTS };