#!/usr/bin/env node
/**
 * Simple test to verify Zod is working
 */

const { z } = require('zod');

console.log('🧪 Testing basic Zod functionality...');

// Test basic email validation
const EmailSchema = z.string().email();

try {
  EmailSchema.parse('test@example.com');
  console.log('✅ Valid email passed validation');
} catch (error) {
  console.log('❌ Valid email failed validation:', error.message);
}

try {
  EmailSchema.parse('invalid-email');
  console.log('❌ Invalid email incorrectly passed validation');
} catch (error) {
  console.log('✅ Invalid email properly rejected:', error.issues[0].message);
}

console.log('🎉 Basic Zod functionality test complete!');
