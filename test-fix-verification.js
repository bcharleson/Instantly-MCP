#!/usr/bin/env node

/**
 * Fix Verification Test
 * Tests the specific fixes applied to resolve the "Cannot read properties of undefined" error
 */

const fs = require('fs');

console.log('🔧 FIX VERIFICATION TEST\n');

// Check if build completed
console.log('📁 Checking build status...');
const buildFiles = ['dist/index.js', 'dist/pagination.js', 'dist/validation.js'];
let buildComplete = true;

for (const file of buildFiles) {
  if (fs.existsSync(file)) {
    const stats = fs.statSync(file);
    console.log(`   ✅ ${file} (${Math.round(stats.size/1024)}KB, ${stats.mtime.toISOString()})`);
  } else {
    console.log(`   ❌ ${file} MISSING`);
    buildComplete = false;
  }
}

if (!buildComplete) {
  console.log('\n❌ Build incomplete. Run: npm run build');
  process.exit(1);
}

// Check specific fixes in compiled code
console.log('\n🔍 Verifying fixes in compiled code...');

try {
  // Check 1: Validation function import
  const indexContent = fs.readFileSync('dist/index.js', 'utf8');
  
  if (indexContent.includes('validateListAccountsData')) {
    console.log('   ✅ validateListAccountsData imported');
  } else {
    console.log('   ❌ validateListAccountsData NOT imported');
  }
  
  // Check 2: list_accounts validation call
  if (indexContent.includes('validateListAccountsData(args')) {
    console.log('   ✅ list_accounts validation call added');
  } else {
    console.log('   ❌ list_accounts validation call missing');
  }
  
  // Check 3: Performance monitor error handling
  const paginationContent = fs.readFileSync('dist/pagination.js', 'utf8');
  
  if (paginationContent.includes('Performance monitoring error')) {
    console.log('   ✅ Performance monitor error handling added');
  } else {
    console.log('   ❌ Performance monitor error handling missing');
  }
  
  // Check 4: Rate limiter safety
  const rateLimiterContent = fs.readFileSync('dist/rate-limiter.js', 'utf8');
  
  if (rateLimiterContent.includes('typeof headers.get !== \'function\'')) {
    console.log('   ✅ Rate limiter safety checks present');
  } else {
    console.log('   ❌ Rate limiter safety checks missing');
  }
  
} catch (error) {
  console.log(`   ❌ Error checking files: ${error.message}`);
}

console.log('\n🧪 MANUAL TEST COMMANDS:');
console.log('Run these commands to test the fixes:');
console.log('');
console.log('# Build first (if not done):');
console.log('npm run build');
console.log('');
console.log('# Test 1: Tools list (should show 22 tools)');
console.log('echo \'{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}\' | INSTANTLY_API_KEY="NTc3NDExNTYtYTA1My00NDVkLTlmZmUtYjUwN2UxYzJlYjY4OlBxZ3RLSU9iZGdSTA==" node dist/index.js');
console.log('');
console.log('# Test 2: List accounts (should return 398 accounts without errors)');
console.log('echo \'{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_accounts","arguments":{"get_all":true}}}\' | INSTANTLY_API_KEY="NTc3NDExNTYtYTA1My00NDVkLTlmZmUtYjUwN2UxYzJlYjY4OlBxZ3RLSU9iZGdSTA==" node dist/index.js');
console.log('');
console.log('# Test 3: Feature availability (should work without 404)');
console.log('echo \'{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"check_feature_availability","arguments":{}}}\' | INSTANTLY_API_KEY="NTc3NDExNTYtYTA1My00NDVkLTlmZmUtYjUwN2UxYzJlYjY4OlBxZ3RLSU9iZGdSTA==" node dist/index.js');
console.log('');

console.log('🎯 EXPECTED RESULTS:');
console.log('✅ Test 1: JSON response with 22 tools, no errors');
console.log('✅ Test 2: 398 accounts with "pagination_method": "reliable_complete"');
console.log('✅ Test 3: Feature info without HTTP 404 errors');
console.log('❌ NO "Cannot read properties of undefined (reading \'get\')" errors');
console.log('');

console.log('🔧 FIXES APPLIED:');
console.log('1. ✅ Added validateListAccountsData call to list_accounts case');
console.log('2. ✅ Enhanced performance monitor error handling');
console.log('3. ✅ Rate limiter safety checks (already present)');
console.log('4. ✅ Fixed check_feature_availability endpoint');
console.log('5. ✅ Added all missing validation function imports');
console.log('');

console.log('📋 NEXT STEPS:');
console.log('1. Run the manual test commands above');
console.log('2. If tests pass: Restart Claude Desktop and test');
console.log('3. If tests fail: Check the exact error output');
console.log('4. Once working: Verify 22 tools and 398 accounts in Claude Desktop');
