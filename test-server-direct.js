#!/usr/bin/env node

/**
 * Direct Server Test - Bypasses terminal issues
 * Tests the MCP server directly to verify it works
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 DIRECT SERVER TEST\n');

// Check if dist files exist
const distFiles = ['dist/index.js', 'dist/validation.js', 'dist/rate-limiter.js'];
let allFilesExist = true;

console.log('📁 Checking build files...');
for (const file of distFiles) {
  if (fs.existsSync(file)) {
    const stats = fs.statSync(file);
    console.log(`   ✅ ${file} (${Math.round(stats.size/1024)}KB)`);
  } else {
    console.log(`   ❌ ${file} MISSING`);
    allFilesExist = false;
  }
}

if (!allFilesExist) {
  console.log('\n❌ Build files missing. Please run: npx tsc');
  process.exit(1);
}

// Check for the specific error patterns in compiled code
console.log('\n🔍 Checking for potential issues in compiled code...');

try {
  const indexContent = fs.readFileSync('dist/index.js', 'utf8');
  
  // Check for missing imports
  const importLine = indexContent.split('\n').find(line => line.includes('validateCampaignData'));
  if (importLine) {
    console.log('   ✅ Validation imports found');
    
    // Check if all required functions are imported
    const requiredFunctions = [
      'validateGetEmailData',
      'validateReplyToEmailData', 
      'validateCreateLeadData',
      'validateUpdateLeadData'
    ];
    
    let missingFunctions = [];
    for (const func of requiredFunctions) {
      if (!importLine.includes(func)) {
        missingFunctions.push(func);
      }
    }
    
    if (missingFunctions.length > 0) {
      console.log(`   ❌ Missing imports: ${missingFunctions.join(', ')}`);
    } else {
      console.log('   ✅ All validation functions imported');
    }
  } else {
    console.log('   ❌ No validation imports found');
  }
  
  // Check for the problematic endpoint
  if (indexContent.includes('/features/availability')) {
    console.log('   ❌ Still using invalid /features/availability endpoint');
  } else {
    console.log('   ✅ Invalid endpoint removed');
  }
  
  // Check for rate limiter safety
  const rateLimiterContent = fs.readFileSync('dist/rate-limiter.js', 'utf8');
  if (rateLimiterContent.includes('typeof headers.get !== \'function\'')) {
    console.log('   ✅ Rate limiter safety checks present');
  } else {
    console.log('   ❌ Rate limiter safety checks missing');
  }
  
} catch (error) {
  console.log(`   ❌ Error reading files: ${error.message}`);
}

console.log('\n📋 MANUAL TEST COMMANDS:');
console.log('Run these commands in your terminal to test the server:');
console.log('');
console.log('# Test 1: Check if server starts and lists tools');
console.log('echo \'{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}\' | INSTANTLY_API_KEY="NTc3NDExNTYtYTA1My00NDVkLTlmZmUtYjUwN2UxYzJlYjY4OlBxZ3RLSU9iZGdSTA==" node dist/index.js');
console.log('');
console.log('# Test 2: Test list_accounts (should return 398 accounts)');
console.log('echo \'{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_accounts","arguments":{"get_all":true}}}\' | INSTANTLY_API_KEY="NTc3NDExNTYtYTA1My00NDVkLTlmZmUtYjUwN2UxYzJlYjY4OlBxZ3RLSU9iZGdSTA==" node dist/index.js');
console.log('');
console.log('# Test 3: Test check_feature_availability (fixed endpoint)');
console.log('echo \'{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"check_feature_availability","arguments":{}}}\' | INSTANTLY_API_KEY="NTc3NDExNTYtYTA1My00NDVkLTlmZmUtYjUwN2UxYzJlYjY4OlBxZ3RLSU9iZGdSTA==" node dist/index.js');
console.log('');

console.log('🎯 EXPECTED RESULTS:');
console.log('✅ Test 1: Should return JSON with 22 tools, no errors');
console.log('✅ Test 2: Should return 398 accounts with pagination_method: "reliable_complete"');
console.log('✅ Test 3: Should return feature availability without 404 errors');
console.log('');
console.log('❌ If you see "Cannot read properties of undefined", the validation import fix didn\'t work');
console.log('❌ If you see HTTP 404 errors, the endpoint fix didn\'t work');
console.log('');
console.log('📝 After manual tests pass, restart Claude Desktop and test there.');
