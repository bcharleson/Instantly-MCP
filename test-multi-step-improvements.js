#!/usr/bin/env node

/**
 * Test script for create_campaign multi-step improvements
 * Tests both backward compatibility and new features
 */

const { spawn } = require('child_process');
const path = require('path');

// Test configurations
const TESTS = [
  {
    name: 'Backward Compatibility - Basic Campaign',
    description: 'Test that existing single-step campaigns work exactly as before',
    params: {
      stage: 'preview',
      name: 'Test Basic Campaign',
      subject: 'Hello {{firstName}}',
      body: 'Hi {{firstName}},\n\nThis is a test email.\n\nBest regards,\nTest Team',
      email_list: ['test@example.com'],
      sequence_steps: 1
    },
    expectedBehavior: 'Should create single step with original subject and body'
  },
  {
    name: 'Backward Compatibility - Multi-Step Default',
    description: 'Test that existing multi-step campaigns work with follow-up prefixes',
    params: {
      stage: 'preview',
      name: 'Test Multi-Step Default',
      subject: 'Hello {{firstName}}',
      body: 'Hi {{firstName}},\n\nThis is a test email.\n\nBest regards,\nTest Team',
      email_list: ['test@example.com'],
      sequence_steps: 3,
      step_delay_days: 2
    },
    expectedBehavior: 'Should create 3 steps with "Follow-up 1:", "Follow-up 2:" prefixes'
  },
  {
    name: 'New Feature - Custom Sequence Bodies',
    description: 'Test custom body content for each sequence step',
    params: {
      stage: 'preview',
      name: 'Test Custom Bodies',
      subject: 'Hello {{firstName}}',
      body: 'This will be overridden',
      email_list: ['test@example.com'],
      sequence_steps: 3,
      sequence_bodies: [
        'Hi {{firstName}},\n\nI noticed {{companyName}} and wanted to reach out.\n\nBest,\nJohn',
        'Hey {{firstName}},\n\nJust following up on my previous email about {{companyName}}.\n\nThanks,\nJohn',
        'Hi {{firstName}},\n\nI\'ll keep this brief - still interested in discussing {{companyName}}?\n\nRegards,\nJohn'
      ]
    },
    expectedBehavior: 'Should use custom bodies for each step, not duplicate original'
  },
  {
    name: 'New Feature - Custom Sequence Subjects',
    description: 'Test custom subject lines for each sequence step',
    params: {
      stage: 'preview',
      name: 'Test Custom Subjects',
      subject: 'This will be overridden',
      body: 'Hi {{firstName}},\n\nTest email content.\n\nBest,\nTeam',
      email_list: ['test@example.com'],
      sequence_steps: 3,
      sequence_subjects: [
        'Quick question about {{companyName}}',
        '',  // Blank for threading
        ''   // Blank for threading
      ]
    },
    expectedBehavior: 'Should use custom subjects, with blanks for follow-ups'
  },
  {
    name: 'New Feature - Continue Thread',
    description: 'Test automatic thread continuation with blank follow-up subjects',
    params: {
      stage: 'preview',
      name: 'Test Thread Continuation',
      subject: 'Quick question about {{companyName}}',
      body: 'Hi {{firstName}},\n\nTest email content.\n\nBest,\nTeam',
      email_list: ['test@example.com'],
      sequence_steps: 3,
      continue_thread: true
    },
    expectedBehavior: 'First email has subject, follow-ups have blank subjects'
  },
  {
    name: 'New Feature - Complete Custom Sequence',
    description: 'Test both custom bodies and subjects together',
    params: {
      stage: 'preview',
      name: 'Test Complete Custom',
      subject: 'Will be overridden',
      body: 'Will be overridden',
      email_list: ['test@example.com'],
      sequence_steps: 3,
      sequence_bodies: [
        'Hi {{firstName}},\n\nI noticed {{companyName}} and wanted to reach out.\n\nBest,\nJohn',
        'Hey {{firstName}},\n\nJust following up on my previous email.\n\nThanks,\nJohn',
        'Hi {{firstName}},\n\nLast follow-up - interested in connecting?\n\nRegards,\nJohn'
      ],
      sequence_subjects: [
        'Quick question about {{companyName}}',
        '',  // Thread continuation
        'Final follow-up'
      ]
    },
    expectedBehavior: 'Should use all custom content as specified'
  }
];

async function runTest(test) {
  console.log(`\n🧪 Running Test: ${test.name}`);
  console.log(`📝 Description: ${test.description}`);
  console.log(`🎯 Expected: ${test.expectedBehavior}`);
  
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Test completed successfully');
        resolve({ success: true, output, errorOutput });
      } else {
        console.log('❌ Test failed');
        reject({ success: false, output, errorOutput, code });
      }
    });

    // Send MCP request
    const mcpRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'create_campaign',
        arguments: test.params
      }
    };

    child.stdin.write(JSON.stringify(mcpRequest) + '\n');
    child.stdin.end();
  });
}

async function runAllTests() {
  console.log('🚀 Starting Multi-Step Campaign Improvements Tests');
  console.log('=' .repeat(60));
  
  const results = [];
  
  for (const test of TESTS) {
    try {
      const result = await runTest(test);
      results.push({ test: test.name, success: true, result });
    } catch (error) {
      results.push({ test: test.name, success: false, error });
      console.log(`❌ Error in ${test.name}:`, error.errorOutput || error.message);
    }
  }
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 Test Results Summary');
  console.log('=' .repeat(60));
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Ready for beta release.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review before release.');
  }
  
  return results;
}

// Run tests if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests, TESTS };
