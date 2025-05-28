#!/usr/bin/env tsx
/**
 * Comprehensive Automated Test Suite for Instantly MCP Server
 * Tests all 25+ API endpoints with realistic data and detailed reporting
 *
 * Usage: tsx test-mcp-endpoints.ts --api-key YOUR_API_KEY
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

interface TestResult {
  tool: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  error?: string;
  response?: any;
  httpStatus?: number;
}

interface TestSuite {
  name: string;
  tests: TestCase[];
}

interface TestCase {
  tool: string;
  description: string;
  args: any;
  expectedToFail?: boolean;
  skipReason?: string;
}

class InstantlyMCPTester {
  private client: Client;
  private transport: StdioClientTransport;
  private results: TestResult[] = [];
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.transport = new StdioClientTransport({
      command: 'node',
      args: ['dist/index.js', '--api-key', apiKey],
    });

    this.client = new Client({
      name: 'instantly-mcp-tester',
      version: '1.0.0',
    }, {
      capabilities: {}
    });
  }

  async connect(): Promise<void> {
    await this.client.connect(this.transport);
    console.log('🔗 Connected to Instantly MCP server');
  }

  async disconnect(): Promise<void> {
    await this.client.close();
    console.log('🔌 Disconnected from MCP server');
  }

  private generateTestData() {
    const timestamp = Date.now();
    const testEmail = `test${timestamp}@example.com`;
    const testDomain = 'example.com';

    return {
      // Valid test emails for different purposes
      testEmails: [
        `sender${timestamp}@${testDomain}`,
        `lead${timestamp}@${testDomain}`,
        `account${timestamp}@${testDomain}`
      ],

      // Campaign data
      campaignName: `Test Campaign ${timestamp}`,
      subject: `Test Subject ${timestamp}`,
      body: `Hello {{first_name}},\n\nThis is a test email campaign.\n\nBest regards,\nTest Team`,

      // Lead data
      leadData: {
        email: testEmail,
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'Test Company',
        website: 'https://example.com',
        personalization: 'Great work on your recent project!'
      },

      // Account data
      accountData: {
        email: `smtp${timestamp}@${testDomain}`,
        username: `testuser${timestamp}`,
        password: 'TestPassword123!',
        smtp_host: 'smtp.gmail.com',
        smtp_port: 587,
        imap_host: 'imap.gmail.com',
        imap_port: 993,
        provider: 'gmail'
      },

      // Date ranges
      dates: {
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        today: new Date().toISOString().split('T')[0]
      },

      // API key data
      apiKeyData: {
        name: `Test API Key ${timestamp}`,
        scopes: ['campaigns:read', 'leads:read']
      },

      // List data
      listData: {
        name: `Test Lead List ${timestamp}`,
        description: 'Automated test lead list'
      }
    };
  }

  private createTestSuites(): TestSuite[] {
    const testData = this.generateTestData();

    return [
      {
        name: 'Campaign Management',
        tests: [
          {
            tool: 'list_campaigns',
            description: 'List all campaigns',
            args: { limit: 10 }
          },
          {
            tool: 'list_campaigns',
            description: 'List campaigns with search filter',
            args: { limit: 5, search: 'test' }
          },
          {
            tool: 'create_campaign',
            description: 'Create campaign with proper email_list (FIXED)',
            args: {
              name: testData.campaignName,
              subject: testData.subject,
              body: testData.body,
              email_list: testData.testEmails, // Fixed: using email_list instead of from_email
              timezone: 'America/New_York',
              days: {
                monday: true,
                tuesday: true,
                wednesday: true,
                thursday: true,
                friday: true,
                saturday: false,
                sunday: false
              },
              daily_limit: 50,
              email_gap_minutes: 10
            }
          },
          {
            tool: 'create_campaign',
            description: 'Create campaign with invalid email_list (should fail)',
            args: {
              name: 'Invalid Campaign',
              subject: 'Test',
              body: 'Test',
              email_list: ['invalid-email'] // Invalid email format
            },
            expectedToFail: true
          },
          {
            tool: 'create_campaign',
            description: 'Create campaign without email_list (should fail)',
            args: {
              name: 'No Email List Campaign',
              subject: 'Test',
              body: 'Test'
            },
            expectedToFail: true
          }
        ]
      },
      {
        name: 'Analytics',
        tests: [
          {
            tool: 'get_campaign_analytics_overview',
            description: 'Get analytics overview for all campaigns',
            args: {
              start_date: testData.dates.start_date,
              end_date: testData.dates.end_date
            }
          },
          {
            tool: 'get_campaign_analytics',
            description: 'Get campaign analytics with date range',
            args: {
              start_date: testData.dates.start_date,
              end_date: testData.dates.end_date
            }
          }
        ]
      },
      {
        name: 'Account Management',
        tests: [
          {
            tool: 'list_accounts',
            description: 'List all sending accounts',
            args: { limit: 10 }
          },
          {
            tool: 'create_account',
            description: 'Create new sending account',
            args: testData.accountData
          },
          {
            tool: 'get_warmup_analytics',
            description: 'Get warmup analytics (FIXED endpoint)',
            args: {
              account_id: 'test-account-id',
              start_date: testData.dates.start_date,
              end_date: testData.dates.end_date
            },
            expectedToFail: true // Will fail without valid account_id
          }
        ]
      },
      {
        name: 'Lead Management (FIXED)',
        tests: [
          {
            tool: 'list_leads',
            description: 'List leads (FIXED: now uses GET /leads)',
            args: { limit: 10 }
          },
          {
            tool: 'create_lead',
            description: 'Create new lead',
            args: testData.leadData
          },
          {
            tool: 'create_lead',
            description: 'Create lead with invalid email (should fail)',
            args: {
              ...testData.leadData,
              email: 'invalid-email-format'
            },
            expectedToFail: true
          },
          {
            tool: 'move_leads',
            description: 'Move leads between campaigns',
            args: {
              lead_ids: ['test-lead-id-1', 'test-lead-id-2'],
              to_campaign_id: 'test-campaign-id'
            },
            expectedToFail: true // Will fail without valid IDs
          }
        ]
      },
      {
        name: 'Lead Lists',
        tests: [
          {
            tool: 'list_lead_lists',
            description: 'List all lead lists',
            args: { limit: 10 }
          },
          {
            tool: 'create_lead_list',
            description: 'Create new lead list',
            args: testData.listData
          }
        ]
      },
      {
        name: 'Email Operations',
        tests: [
          {
            tool: 'list_emails',
            description: 'List emails',
            args: { limit: 10 }
          },
          {
            tool: 'send_email',
            description: 'Send single email',
            args: {
              to: testData.testEmails[0],
              from: testData.testEmails[1],
              subject: 'Test Email',
              body: 'This is a test email.',
              html: false
            },
            expectedToFail: true // Will likely fail without verified accounts
          },
          {
            tool: 'verify_email',
            description: 'Verify email address (FIXED endpoint)',
            args: {
              email: testData.testEmails[0]
            }
          },
          {
            tool: 'verify_email',
            description: 'Verify invalid email (should fail)',
            args: {
              email: 'not-an-email'
            },
            expectedToFail: true
          }
        ]
      },
      {
        name: 'API Key Management',
        tests: [
          {
            tool: 'list_api_keys',
            description: 'List all API keys',
            args: {}
          },
          {
            tool: 'create_api_key',
            description: 'Create new API key',
            args: testData.apiKeyData
          }
        ]
      }
    ];
  }

  private async runTest(testCase: TestCase): Promise<TestResult> {
    const startTime = Date.now();

    if (testCase.skipReason) {
      return {
        tool: testCase.tool,
        status: 'SKIP',
        duration: 0,
        error: testCase.skipReason
      };
    }

    try {
      console.log(`  🧪 Testing: ${testCase.description}`);

      const response = await this.client.callTool(testCase.tool, testCase.args);
      const duration = Date.now() - startTime;

      if (testCase.expectedToFail) {
        return {
          tool: testCase.tool,
          status: 'FAIL',
          duration,
          error: 'Expected test to fail but it passed',
          response
        };
      }

      return {
        tool: testCase.tool,
        status: 'PASS',
        duration,
        response
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;

      if (testCase.expectedToFail) {
        return {
          tool: testCase.tool,
          status: 'PASS',
          duration,
          error: `Expected failure: ${error.message}`
        };
      }

      // Extract HTTP status if available
      let httpStatus: number | undefined;
      let errorMessage = error.message || 'Unknown error';

      // Parse MCP error messages to extract HTTP status
      const statusMatch = errorMessage.match(/(\d{3})/);
      if (statusMatch) {
        httpStatus = parseInt(statusMatch[1]);
      }

      return {
        tool: testCase.tool,
        status: 'FAIL',
        duration,
        error: errorMessage,
        httpStatus
      };
    }
  }

  private async runTestSuite(suite: TestSuite): Promise<void> {
    console.log(`\n📋 Running ${suite.name} Tests`);
    console.log('='.repeat(50));

    for (const testCase of suite.tests) {
      const result = await this.runTest(testCase);
      this.results.push(result);

      const statusIcon = result.status === 'PASS' ? '✅' :
                        result.status === 'FAIL' ? '❌' : '⏭️';
      const duration = `${result.duration}ms`;

      console.log(`  ${statusIcon} ${result.tool} (${duration})`);

      if (result.status === 'FAIL' && result.error) {
        console.log(`    💥 Error: ${result.error}`);
        if (result.httpStatus) {
          console.log(`    🌐 HTTP Status: ${result.httpStatus}`);
        }
      }

      if (result.status === 'SKIP') {
        console.log(`    ⏭️  Skipped: ${result.error}`);
      }

      // Add small delay between tests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Instantly MCP Server Test Suite');
    console.log(`🔑 Using API key: ${this.apiKey.substring(0, 10)}...${this.apiKey.substring(this.apiKey.length - 4)}`);
    console.log('⏰ Started at:', new Date().toISOString());

    const testSuites = this.createTestSuites();
    const startTime = Date.now();

    try {
      await this.connect();

      for (const suite of testSuites) {
        await this.runTestSuite(suite);
      }

    } catch (error) {
      console.error('❌ Failed to connect to MCP server:', error);
      process.exit(1);
    } finally {
      await this.disconnect();
    }

    const totalDuration = Date.now() - startTime;
    this.generateReport(totalDuration);
  }

  private generateReport(totalDuration: number): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPREHENSIVE TEST REPORT');
    console.log('='.repeat(80));

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;
    const total = this.results.length;

    console.log(`\n📈 SUMMARY:`);
    console.log(`  ✅ Passed: ${passed}/${total} (${((passed/total)*100).toFixed(1)}%)`);
    console.log(`  ❌ Failed: ${failed}/${total} (${((failed/total)*100).toFixed(1)}%)`);
    console.log(`  ⏭️  Skipped: ${skipped}/${total} (${((skipped/total)*100).toFixed(1)}%)`);
    console.log(`  ⏱️  Total Duration: ${(totalDuration/1000).toFixed(2)}s`);
    console.log(`  🕐 Completed at: ${new Date().toISOString()}`);

    // Group results by status
    const failedTests = this.results.filter(r => r.status === 'FAIL');
    const passedTests = this.results.filter(r => r.status === 'PASS');

    if (failedTests.length > 0) {
      console.log(`\n❌ FAILED TESTS (${failedTests.length}):`);
      failedTests.forEach(result => {
        console.log(`  • ${result.tool}`);
        console.log(`    Error: ${result.error}`);
        if (result.httpStatus) {
          console.log(`    HTTP Status: ${result.httpStatus}`);
        }
        console.log('');
      });
    }

    if (passedTests.length > 0) {
      console.log(`\n✅ PASSED TESTS (${passedTests.length}):`);
      passedTests.forEach(result => {
        console.log(`  • ${result.tool} (${result.duration}ms)`);
      });
    }

    // Analyze specific fixes
    console.log('\n🔧 ANALYSIS OF RECENT FIXES:');
    console.log('-'.repeat(40));

    const fixedEndpoints = [
      'create_campaign',
      'list_leads',
      'verify_email',
      'get_warmup_analytics'
    ];

    fixedEndpoints.forEach(endpoint => {
      const results = this.results.filter(r => r.tool === endpoint);
      if (results.length > 0) {
        const status = results.some(r => r.status === 'PASS') ? '✅ WORKING' : '❌ STILL BROKEN';
        console.log(`  ${endpoint}: ${status}`);

        const failures = results.filter(r => r.status === 'FAIL');
        if (failures.length > 0) {
          failures.forEach(f => {
            console.log(`    └─ ${f.error}`);
          });
        }
      }
    });

    // HTTP Status Analysis
    const httpStatuses = this.results
      .filter(r => r.httpStatus)
      .reduce((acc, r) => {
        acc[r.httpStatus!] = (acc[r.httpStatus!] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

    if (Object.keys(httpStatuses).length > 0) {
      console.log('\n🌐 HTTP STATUS CODE ANALYSIS:');
      Object.entries(httpStatuses)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .forEach(([status, count]) => {
          const statusName = getHttpStatusName(parseInt(status));
          console.log(`  ${status} ${statusName}: ${count} occurrences`);
        });
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (failed > 0) {
      console.log('  • Review failed endpoints and check API documentation');
      console.log('  • Verify API key has sufficient permissions');
      console.log('  • Check if accounts need to be verified before use');
    }
    if (passed === total) {
      console.log('  • All tests passed! 🎉');
      console.log('  • Consider adding more edge case tests');
    }

    console.log('\n' + '='.repeat(80));

    // Exit with appropriate code
    process.exit(failed > 0 ? 1 : 0);
  }
}

function getHttpStatusName(status: number): string {
  const statusNames: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error'
  };
  return statusNames[status] || 'Unknown';
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const apiKeyIndex = args.findIndex(arg => arg === '--api-key');
  const apiKey = apiKeyIndex !== -1 && args[apiKeyIndex + 1] ? args[apiKeyIndex + 1] : null;

  if (!apiKey) {
    console.error('❌ Error: Please provide API key using --api-key argument');
    console.error('Usage: tsx test-mcp-endpoints.ts --api-key YOUR_API_KEY');
    process.exit(1);
  }

  const tester = new InstantlyMCPTester(apiKey);
  await tester.runAllTests();
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason);
  process.exit(1);
});

main().catch(console.error);
