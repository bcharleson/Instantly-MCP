#!/usr/bin/env node

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

const API_KEY = process.argv[2];

if (!API_KEY) {
  console.error('Usage: tsx test-direct.ts API_KEY');
  process.exit(1);
}

interface TestCase {
  name: string;
  params: any;
  expectError?: boolean;
  description: string;
}

const TEST_CASES: TestCase[] = [
  // Core listing tools
  { name: 'list_campaigns', params: { limit: 3 }, description: 'List existing campaigns' },
  { name: 'list_accounts', params: { limit: 3 }, description: 'List sending accounts' },
  { name: 'list_emails', params: { limit: 3 }, description: 'List sent emails' },
  { name: 'check_feature_availability', params: {}, description: 'Check available features' },
  
  // Validation tools
  { name: 'validate_campaign_accounts', params: {}, description: 'Validate account eligibility' },
  
  // Tools requiring valid IDs (should fail gracefully)
  { name: 'get_campaign', params: { campaign_id: 'test-invalid-id' }, expectError: true, description: 'Get specific campaign (invalid ID)' },
  { name: 'get_email', params: { email_id: 'test-invalid-id' }, expectError: true, description: 'Get specific email (invalid ID)' },
  
  // Premium features
  { name: 'verify_email', params: { email: 'test@example.com' }, expectError: true, description: 'Verify email address (premium)' },
  
  // Creation tools
  { name: 'create_lead', params: { email: 'test-lead@example.com' }, description: 'Create new lead' },
  { name: 'create_lead_list', params: { name: 'Test List ' + Date.now() }, description: 'Create new lead list' },
];

async function testTool(testCase: TestCase): Promise<void> {
  return new Promise((resolve) => {
    console.log(`\n🔧 Testing: ${testCase.name}`);
    console.log(`   ${testCase.description}`);
    
    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: testCase.name,
        arguments: testCase.params
      }
    };
    
    const child = spawn('node', ['dist/index.js', '--api-key', API_KEY], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    // Send the request
    child.stdin.write(JSON.stringify(request) + '\n');
    child.stdin.end();
    
    // Set timeout
    const timeout = setTimeout(() => {
      child.kill();
      console.log('  ⏱️  TIMEOUT (30s)');
      resolve();
    }, 30000);
    
    child.on('close', (code) => {
      clearTimeout(timeout);
      
      if (stdout.trim()) {
        try {
          const response = JSON.parse(stdout.trim());
          if (response.error) {
            if (testCase.expectError) {
              console.log(`  ✅ Expected error: ${response.error.message}`);
            } else {
              console.log(`  ❌ Unexpected error: ${response.error.message}`);
            }
          } else {
            console.log(`  ✅ SUCCESS`);
            if (testCase.name === 'list_accounts' && response.result?.content?.[0]?.text) {
              // Parse and show account info for create_campaign testing
              try {
                const accounts = JSON.parse(response.result.content[0].text);
                console.log(`     📧 Found accounts for campaign creation:`);
                if (Array.isArray(accounts)) {
                  accounts.slice(0, 3).forEach((acc: any) => {
                    console.log(`       • ${acc.email} (status: ${acc.status})`);
                  });
                } else if (accounts.data) {
                  accounts.data.slice(0, 3).forEach((acc: any) => {
                    console.log(`       • ${acc.email} (status: ${acc.status})`);
                  });
                }
              } catch (e) {
                console.log(`     📧 Accounts data format: ${typeof accounts}`);
              }
            }
          }
        } catch (e) {
          console.log(`  ❌ Invalid JSON response`);
        }
      } else if (stderr.includes('Error: API key must be provided')) {
        console.log(`  ❌ API key issue`);
      } else if (stderr.includes('Unknown tool')) {
        console.log(`  ❌ Tool not found`);
      } else {
        if (testCase.expectError) {
          console.log(`  ✅ Expected error occurred`);
        } else {
          console.log(`  ❌ No response (exit code: ${code})`);
          if (stderr) console.log(`     Error: ${stderr.slice(0, 200)}...`);
        }
      }
      
      resolve();
    });
  });
}

async function runTests(): Promise<void> {
  console.log('🚀 INSTANTLY MCP DIRECT TESTING');
  console.log('================================');
  console.log(`API Key: ${API_KEY.slice(0, 10)}...${API_KEY.slice(-4)}\n`);
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of TEST_CASES) {
    await testCase;
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n🏁 TESTING COMPLETED');
  console.log('===================');
  console.log('Check the results above for detailed tool functionality.');
  console.log('\n🔧 Next steps:');
  console.log('1. If list_accounts works, use those emails for create_campaign');
  console.log('2. If list_emails works, use email IDs for reply_to_email');
  console.log('3. Premium features (verify_email) may require plan upgrade');
}

runTests().catch(console.error);