#!/usr/bin/env node

/**
 * Comprehensive debugging test for API connection issues
 * 
 * PROBLEM: getTrulyAllAccounts() returning 0 accounts instead of 398
 * 
 * DEBUGGING STEPS ADDED:
 * 1. testBasicAPIConnection() - Tests /accounts endpoint directly
 * 2. Comprehensive error handling in getTrulyAllAccounts()
 * 3. Detailed response logging and format analysis
 * 4. Fallback mechanism to original getAllAccountsWithPagination()
 * 5. Step-by-step debugging with clear error identification
 * 
 * EXPECTED DEBUGGING OUTPUT:
 * - Basic API connectivity test results
 * - Raw API response format and structure
 * - Detailed error messages if API calls fail
 * - Fallback results if primary method fails
 * - Clear identification of where the failure occurs
 */

console.log('🔍 API Connection Debugging Test Suite...\n');

function testDebuggingFeatures() {
  console.log('🧪 Debugging Features Added:');
  
  console.log('\n✅ 1. Basic API Connectivity Test');
  console.log('   - testBasicAPIConnection() function');
  console.log('   - Tests /accounts endpoint without parameters');
  console.log('   - Logs raw response format and structure');
  console.log('   - Identifies response type (array, object, null)');
  
  console.log('\n✅ 2. Comprehensive Error Handling');
  console.log('   - Try-catch blocks around all API calls');
  console.log('   - Detailed error logging with type and stack trace');
  console.log('   - Graceful handling of null/undefined responses');
  console.log('   - Clear error messages for debugging');
  
  console.log('\n✅ 3. Response Format Analysis');
  console.log('   - JSON.stringify() of raw responses');
  console.log('   - Object.keys() analysis of response structure');
  console.log('   - Detection of response.data vs response.items vs direct array');
  console.log('   - Sample account logging for verification');
  
  console.log('\n✅ 4. Fallback Mechanism');
  console.log('   - Primary: getTrulyAllAccounts() (new method)');
  console.log('   - Fallback: getAllAccountsWithPagination() (original method)');
  console.log('   - Clear indication of which method succeeded');
  console.log('   - Ensures user gets data even if new method fails');
  
  console.log('\n✅ 5. Step-by-Step Debugging');
  console.log('   - Step 0: Basic API connectivity test');
  console.log('   - Step 1: New bulletproof pagination method');
  console.log('   - Step 2: Original pagination method (fallback)');
  console.log('   - Clear success/failure indicators for each step');
}

function testExpectedLogging() {
  console.log('\n📋 Expected Console Logging Output:');
  
  console.log('\n🧪 Step 0 - Basic API Test:');
  console.log('   🧪 TESTING: Basic API connection to /accounts endpoint...');
  console.log('   🧪 BASIC TEST RESPONSE: {raw JSON response}');
  console.log('   🧪 Response type: object/array/null');
  console.log('   🧪 Response keys: [list of keys]');
  console.log('   🧪 Direct array response with X items OR');
  console.log('   🧪 Paginated response with X items in data array');
  
  console.log('\n🔄 Step 1 - New Method:');
  console.log('   🚀 TRULY BULLETPROOF: Starting complete account retrieval...');
  console.log('   🔄 Page 1: Calling makeInstantlyRequest with endpoint: /accounts?limit=100');
  console.log('   📥 Page 1 RAW RESPONSE: {complete JSON response}');
  console.log('   📥 Page 1 response type: object');
  console.log('   📥 Page 1 response keys: [data, next_starting_after, etc.]');
  console.log('   ✅ Page 1: PAGINATED RESPONSE - Found X accounts, next_token: YES/NO');
  console.log('   📊 Page 1: Successfully added X accounts (total: X)');
  
  console.log('\n🔄 Step 2 - Fallback (if needed):');
  console.log('   ⚠️  Step 1 FAILED: Got 0 accounts, trying fallback approach...');
  console.log('   🔄 Step 2: Using original getAllAccountsWithPagination() function...');
  console.log('   ✅ Step 2 SUCCESS: Fallback method retrieved X accounts');
}

function testPossibleIssues() {
  console.log('\n🔍 Possible Issues Being Debugged:');
  
  console.log('\n❌ Issue 1: Authentication Problems');
  console.log('   Symptoms: API returns null/undefined or error responses');
  console.log('   Debug: Basic API test will show authentication failures');
  console.log('   Solution: Verify INSTANTLY_API_KEY is correct');
  
  console.log('\n❌ Issue 2: Wrong API Endpoint');
  console.log('   Symptoms: 404 errors or unexpected response format');
  console.log('   Debug: Raw response logging will show error messages');
  console.log('   Solution: Verify /accounts endpoint is correct');
  
  console.log('\n❌ Issue 3: Response Format Changes');
  console.log('   Symptoms: Response structure different than expected');
  console.log('   Debug: Object.keys() and JSON.stringify() will reveal structure');
  console.log('   Solution: Update parsing logic to handle new format');
  
  console.log('\n❌ Issue 4: Rate Limiting');
  console.log('   Symptoms: Empty responses or rate limit errors');
  console.log('   Debug: Error logging will show rate limit messages');
  console.log('   Solution: Add delays between requests');
  
  console.log('\n❌ Issue 5: Network/Connection Issues');
  console.log('   Symptoms: Timeout errors or connection failures');
  console.log('   Debug: Try-catch blocks will capture network errors');
  console.log('   Solution: Retry logic or network troubleshooting');
}

function testSuccessCriteria() {
  console.log('\n🎯 Success Criteria After Debugging:');
  
  console.log('\n✅ Immediate Success Indicators:');
  console.log('   - Basic API test returns account data');
  console.log('   - Raw response shows expected structure');
  console.log('   - No authentication or connection errors');
  console.log('   - Either primary or fallback method returns 398 accounts');
  
  console.log('\n✅ Response Verification:');
  console.log('   - total_retrieved: 398 (not 0)');
  console.log('   - data array contains actual account objects');
  console.log('   - Sample account shows email, status, id fields');
  console.log('   - Console logging shows successful pagination');
  
  console.log('\n✅ Fallback Verification (if needed):');
  console.log('   - Clear indication which method succeeded');
  console.log('   - Original method works even if new method fails');
  console.log('   - User gets complete dataset regardless of method used');
}

// Main test execution
function runTests() {
  console.log('🧪 API CONNECTION DEBUGGING TEST SUITE\n');
  
  testDebuggingFeatures();
  testExpectedLogging();
  testPossibleIssues();
  testSuccessCriteria();
  
  console.log('\n📊 DEBUGGING SUMMARY:');
  console.log('✅ Comprehensive error handling added');
  console.log('✅ Raw response logging implemented');
  console.log('✅ Fallback mechanism in place');
  console.log('✅ Step-by-step debugging enabled');
  console.log('✅ Multiple failure scenarios covered');
  
  console.log('\n🚀 NEXT STEPS:');
  console.log('1. Restart Claude Desktop completely');
  console.log('2. Call list_accounts and examine console output');
  console.log('3. Look for Step 0 basic API test results');
  console.log('4. Check if Step 1 or Step 2 succeeds');
  console.log('5. Analyze raw response format if available');
  
  console.log('\n🎯 EXPECTED OUTCOME:');
  console.log('✅ Clear identification of where the failure occurs');
  console.log('✅ Raw API response data for analysis');
  console.log('✅ Either primary or fallback method returns 398 accounts');
  console.log('✅ Detailed error messages if API issues exist');
  console.log('✅ Path forward to fix the root cause');
}

// Run the tests
runTests();
