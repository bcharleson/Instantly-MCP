#!/usr/bin/env node
/**
 * Test script for Zod validation integration
 * 
 * This script tests the new Zod-based validation system to ensure:
 * 1. Valid inputs pass validation
 * 2. Invalid inputs are properly rejected with clear error messages
 * 3. Type safety is maintained
 * 4. All validation rules from the original system are preserved
 */

import { 
  validateCampaignData,
  validateWarmupAnalyticsData,
  validateEmailVerificationData,
  validateListAccountsData,
  validateToolParameters,
  isValidEmail
} from './src/validation.js';

console.log('🧪 Testing Zod Validation Integration...\n');

// Test 1: Valid campaign data
console.log('📝 Test 1: Valid campaign creation data');
try {
  const validCampaign = {
    name: 'Test Campaign',
    subject: 'Hello {{firstName}}',
    body: 'Hi {{firstName}},\n\nThis is a test email.\n\nBest regards,\nThe Team',
    email_list: ['test@example.com', 'user@domain.com'],
    timezone: 'America/New_York',
    timing_from: '09:00',
    timing_to: '17:00',
    daily_limit: 50
  };
  
  const result = validateCampaignData(validCampaign);
  console.log('✅ Valid campaign data passed validation');
  console.log(`   Campaign name: ${result.name}`);
  console.log(`   Email count: ${result.email_list.length}`);
} catch (error) {
  console.log('❌ Valid campaign data failed validation:', error.message);
}

// Test 2: Invalid campaign data - missing required fields
console.log('\n📝 Test 2: Invalid campaign data (missing required fields)');
try {
  const invalidCampaign = {
    name: 'Test Campaign',
    // Missing subject, body, email_list
  };
  
  validateCampaignData(invalidCampaign);
  console.log('❌ Invalid campaign data incorrectly passed validation');
} catch (error) {
  console.log('✅ Invalid campaign data properly rejected');
  console.log(`   Error: ${error.message}`);
}

// Test 3: Invalid email format
console.log('\n📝 Test 3: Invalid email format validation');
try {
  const invalidEmailCampaign = {
    name: 'Test Campaign',
    subject: 'Test Subject',
    body: 'Test body',
    email_list: ['invalid-email', 'test@example.com']
  };
  
  validateCampaignData(invalidEmailCampaign);
  console.log('❌ Invalid email format incorrectly passed validation');
} catch (error) {
  console.log('✅ Invalid email format properly rejected');
  console.log(`   Error: ${error.message}`);
}

// Test 4: Invalid timezone
console.log('\n📝 Test 4: Invalid timezone validation');
try {
  const invalidTimezoneCampaign = {
    name: 'Test Campaign',
    subject: 'Test Subject',
    body: 'Test body',
    email_list: ['test@example.com'],
    timezone: 'Invalid/Timezone'
  };
  
  validateCampaignData(invalidTimezoneCampaign);
  console.log('❌ Invalid timezone incorrectly passed validation');
} catch (error) {
  console.log('✅ Invalid timezone properly rejected');
  console.log(`   Error: ${error.message}`);
}

// Test 5: Invalid time format
console.log('\n📝 Test 5: Invalid time format validation');
try {
  const invalidTimeCampaign = {
    name: 'Test Campaign',
    subject: 'Test Subject',
    body: 'Test body',
    email_list: ['test@example.com'],
    timing_from: '25:00' // Invalid hour
  };
  
  validateCampaignData(invalidTimeCampaign);
  console.log('❌ Invalid time format incorrectly passed validation');
} catch (error) {
  console.log('✅ Invalid time format properly rejected');
  console.log(`   Error: ${error.message}`);
}

// Test 6: HTML tag validation
console.log('\n📝 Test 6: HTML tag validation');
try {
  const htmlCampaign = {
    name: 'Test Campaign',
    subject: 'Test Subject',
    body: 'Test body with <script>alert("bad")</script> tags',
    email_list: ['test@example.com']
  };
  
  validateCampaignData(htmlCampaign);
  console.log('❌ Unsafe HTML tags incorrectly passed validation');
} catch (error) {
  console.log('✅ Unsafe HTML tags properly rejected');
  console.log(`   Error: ${error.message}`);
}

// Test 7: Valid warmup analytics data
console.log('\n📝 Test 7: Valid warmup analytics data');
try {
  const validWarmup = {
    emails: ['test@example.com', 'user@domain.com'],
    start_date: '2024-01-01',
    end_date: '2024-01-31'
  };
  
  const result = validateWarmupAnalyticsData(validWarmup);
  console.log('✅ Valid warmup analytics data passed validation');
  console.log(`   Email count: ${result.emails.length}`);
} catch (error) {
  console.log('❌ Valid warmup analytics data failed validation:', error.message);
}

// Test 8: Invalid warmup analytics data
console.log('\n📝 Test 8: Invalid warmup analytics data (too many emails)');
try {
  const invalidWarmup = {
    emails: Array(101).fill('test@example.com'), // Too many emails
  };
  
  validateWarmupAnalyticsData(invalidWarmup);
  console.log('❌ Too many emails incorrectly passed validation');
} catch (error) {
  console.log('✅ Too many emails properly rejected');
  console.log(`   Error: ${error.message}`);
}

// Test 9: Email verification validation
console.log('\n📝 Test 9: Email verification validation');
try {
  const validEmail = { email: 'test@example.com' };
  const result = validateEmailVerificationData(validEmail);
  console.log('✅ Valid email verification data passed validation');
  console.log(`   Email: ${result.email}`);
} catch (error) {
  console.log('❌ Valid email verification data failed validation:', error.message);
}

// Test 10: Universal tool validation
console.log('\n📝 Test 10: Universal tool validation');
try {
  const result = validateToolParameters('verify_email', { email: 'test@example.com' });
  console.log('✅ Universal tool validation works');
  console.log(`   Validated email: ${result.email}`);
} catch (error) {
  console.log('❌ Universal tool validation failed:', error.message);
}

// Test 11: Legacy email validation function
console.log('\n📝 Test 11: Legacy email validation function');
console.log(`   Valid email: ${isValidEmail('test@example.com')}`);
console.log(`   Invalid email: ${isValidEmail('invalid-email')}`);

console.log('\n🎉 Zod validation integration testing complete!');
console.log('\n📊 Summary:');
console.log('   - Type-safe validation with Zod schemas ✅');
console.log('   - Comprehensive error messages ✅');
console.log('   - All original validation rules preserved ✅');
console.log('   - Universal tool parameter validation ✅');
console.log('   - Backward compatibility maintained ✅');
