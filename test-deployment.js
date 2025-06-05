#!/usr/bin/env node

/**
 * Quick deployment test for Instantly MCP v4.0.0
 * Tests core functionality after npm publish
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing Instantly MCP v4.0.0 Deployment...\n');

// Test cases for the streamlined MCP server
const tests = [
  {
    name: 'Version Check',
    description: 'Verify v4.0.0 is installed',
    command: 'instantly-mcp',
    args: ['--version'],
    expectedOutput: '4.0.0',
    timeout: 5000
  },
  {
    name: 'Tool List',
    description: 'Check available tools (wizard should be removed)',
    command: 'echo',
    args: ['{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'],
    pipe: 'instantly-mcp',
    pipeArgs: ['--api-key', 'test-key'],
    expectedOutput: 'create_campaign',
    notExpectedOutput: 'campaign_creation_wizard',
    timeout: 10000
  },
  {
    name: 'Enhanced create_campaign Description',
    description: 'Verify enhanced tool descriptions',
    command: 'echo',
    args: ['{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'],
    pipe: 'instantly-mcp',
    pipeArgs: ['--api-key', 'test-key'],
    expectedOutput: 'Auto-Discovery',
    timeout: 10000
  }
];

async function runTest(test) {
  return new Promise((resolve) => {
    console.log(`🔍 ${test.name}: ${test.description}`);
    
    let command, args;
    
    if (test.pipe) {
      // For piped commands
      const echo = spawn(test.command, test.args);
      const pipe = spawn(test.pipe, test.pipeArgs);
      
      echo.stdout.pipe(pipe.stdin);
      
      let output = '';
      let errorOutput = '';
      
      pipe.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      pipe.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      pipe.on('close', (code) => {
        const success = checkOutput(output, errorOutput, test);
        resolve({ ...test, success, output, errorOutput, code });
      });
      
      // Timeout handling
      setTimeout(() => {
        pipe.kill();
        echo.kill();
        resolve({ ...test, success: false, output: 'TIMEOUT', errorOutput: '', code: -1 });
      }, test.timeout);
      
    } else {
      // For direct commands
      const process = spawn(test.command, test.args);
      
      let output = '';
      let errorOutput = '';
      
      process.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      process.on('close', (code) => {
        const success = checkOutput(output, errorOutput, test);
        resolve({ ...test, success, output, errorOutput, code });
      });
      
      // Timeout handling
      setTimeout(() => {
        process.kill();
        resolve({ ...test, success: false, output: 'TIMEOUT', errorOutput: '', code: -1 });
      }, test.timeout);
    }
  });
}

function checkOutput(output, errorOutput, test) {
  const fullOutput = output + errorOutput;
  
  // Check for expected output
  if (test.expectedOutput && !fullOutput.includes(test.expectedOutput)) {
    return false;
  }
  
  // Check for not expected output (like wizard removal)
  if (test.notExpectedOutput && fullOutput.includes(test.notExpectedOutput)) {
    return false;
  }
  
  return true;
}

async function runAllTests() {
  console.log('🚀 Starting deployment tests...\n');
  
  const results = [];
  
  for (const test of tests) {
    const result = await runTest(test);
    results.push(result);
    
    if (result.success) {
      console.log(`   ✅ PASS\n`);
    } else {
      console.log(`   ❌ FAIL`);
      console.log(`   Output: ${result.output.substring(0, 200)}...`);
      console.log(`   Error: ${result.errorOutput.substring(0, 200)}...\n`);
    }
  }
  
  // Summary
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  const percentage = Math.round((passed / total) * 100);
  
  console.log('📊 Test Results Summary:');
  console.log(`   Tests Passed: ${passed}/${total} (${percentage}%)`);
  
  if (percentage >= 80) {
    console.log('   🎉 DEPLOYMENT SUCCESS: Ready for production use!');
  } else if (percentage >= 60) {
    console.log('   ⚠️  DEPLOYMENT WARNING: Some issues detected');
  } else {
    console.log('   ❌ DEPLOYMENT FAILURE: Critical issues found');
  }
  
  console.log('\n🔍 Detailed Results:');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`   ${status} ${result.name}: ${result.description}`);
  });
  
  console.log('\n📋 Next Steps:');
  if (percentage >= 80) {
    console.log('   1. ✅ Package successfully deployed to npm');
    console.log('   2. ✅ Core functionality verified');
    console.log('   3. 🧪 Run comprehensive tests with real API key');
    console.log('   4. 📖 Share testing guide with users');
    console.log('   5. 🚀 Monitor production usage');
  } else {
    console.log('   1. 🔍 Investigate failed tests');
    console.log('   2. 🛠️ Fix identified issues');
    console.log('   3. 📦 Republish if necessary');
    console.log('   4. 🧪 Rerun deployment tests');
  }
  
  console.log('\n📚 Documentation:');
  console.log('   📖 RELEASE_NOTES_v4.0.0.md - Complete release information');
  console.log('   🧪 TESTING_GUIDE_v4.0.0.md - Comprehensive testing guide');
  console.log('   🎯 STREAMLINED_ENHANCEMENT_COMPLETE.md - Enhancement summary');
  
  console.log('\n🎯 Key Features to Test:');
  console.log('   🤖 Auto-discovery when email_list is empty');
  console.log('   📄 Complete pagination for account discovery');
  console.log('   🎓 Guided mode for beginners');
  console.log('   ❌ Wizard removal verification');
  console.log('   📊 Enhanced response format with next-steps');
  
  return percentage >= 80;
}

// Run the tests
runAllTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Test runner error:', error);
  process.exit(1);
});
