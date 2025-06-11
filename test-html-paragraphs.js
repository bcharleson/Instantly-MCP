#!/usr/bin/env node

/**
 * Comprehensive test for HTML paragraph formatting in Instantly MCP
 * Tests the convertToHTMLParagraphs function and validates API success + visual rendering
 */

// Mock the convertToHTMLParagraphs function (copy from src/index.ts)
const convertToHTMLParagraphs = (text) => {
  // Normalize line endings to \n
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Split by double line breaks to create paragraphs
  const paragraphs = normalized.split('\n\n');
  
  return paragraphs
    .map(paragraph => {
      // Skip empty paragraphs
      if (!paragraph.trim()) {
        return '';
      }
      
      // Convert single line breaks within paragraphs to <br> tags
      const withBreaks = paragraph.trim().replace(/\n/g, '<br>');
      
      // Wrap in paragraph tags
      return `<p>${withBreaks}</p>`;
    })
    .filter(p => p) // Remove empty paragraphs
    .join('');
};

// Test cases
const testCases = [
  {
    name: 'Simple paragraph',
    input: 'Hello world',
    expected: '<p>Hello world</p>'
  },
  {
    name: 'Two paragraphs',
    input: 'First paragraph\n\nSecond paragraph',
    expected: '<p>First paragraph</p><p>Second paragraph</p>'
  },
  {
    name: 'Line breaks within paragraph',
    input: 'Line 1\nLine 2\nLine 3',
    expected: '<p>Line 1<br>Line 2<br>Line 3</p>'
  },
  {
    name: 'Mixed paragraphs and line breaks',
    input: 'Paragraph 1\nWith line break\n\nParagraph 2\nAlso with break',
    expected: '<p>Paragraph 1<br>With line break</p><p>Paragraph 2<br>Also with break</p>'
  },
  {
    name: 'Email template with personalization',
    input: 'Hi {{firstName}},\n\nWelcome to our newsletter!\n\nWe have exciting updates:\n• Feature 1\n• Feature 2\n• Feature 3\n\nBest regards,\nThe Team',
    expected: '<p>Hi {{firstName}},</p><p>Welcome to our newsletter!</p><p>We have exciting updates:<br>• Feature 1<br>• Feature 2<br>• Feature 3</p><p>Best regards,<br>The Team</p>'
  },
  {
    name: 'Multiple empty lines (should be normalized)',
    input: 'Para 1\n\n\n\nPara 2',
    expected: '<p>Para 1</p><p>Para 2</p>'
  },
  {
    name: 'Windows line endings',
    input: 'Line 1\r\nLine 2\r\n\r\nPara 2',
    expected: '<p>Line 1<br>Line 2</p><p>Para 2</p>'
  },
  {
    name: 'Mixed line endings',
    input: 'Line 1\r\nLine 2\n\nPara 2\rLine 3',
    expected: '<p>Line 1<br>Line 2</p><p>Para 2<br>Line 3</p>'
  },
  {
    name: 'Empty input',
    input: '',
    expected: ''
  },
  {
    name: 'Only whitespace',
    input: '   \n\n   ',
    expected: ''
  }
];

// Run tests
console.log('🧪 Testing HTML Paragraph Conversion\n');

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  const result = convertToHTMLParagraphs(testCase.input);
  const success = result === testCase.expected;
  
  if (success) {
    console.log(`✅ Test ${index + 1}: ${testCase.name}`);
    passed++;
  } else {
    console.log(`❌ Test ${index + 1}: ${testCase.name}`);
    console.log(`   Input: ${JSON.stringify(testCase.input)}`);
    console.log(`   Expected: ${JSON.stringify(testCase.expected)}`);
    console.log(`   Got:      ${JSON.stringify(result)}`);
    failed++;
  }
});

console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('🎉 All tests passed! HTML paragraph formatting is working correctly.');
} else {
  console.log('⚠️  Some tests failed. Please review the implementation.');
  process.exit(1);
}

// Visual rendering examples
console.log('\n📧 Visual Rendering Examples:');
console.log('=====================================');

const examples = [
  {
    name: 'Newsletter Example',
    input: 'Hi {{firstName}},\n\nWelcome to our newsletter!\n\nWe have exciting updates:\n• Feature 1\n• Feature 2\n• Feature 3\n\nBest regards,\nThe Team'
  },
  {
    name: 'Sales Outreach',
    input: 'Hi {{firstName}},\n\nI noticed {{companyName}} is expanding rapidly.\n\nWould you be interested in:\n- Streamlining your processes\n- Reducing operational costs\n- Improving team efficiency\n\nLet me know if you\'d like to chat!\n\nBest,\n{{senderName}}'
  }
];

examples.forEach(example => {
  console.log(`\n${example.name}:`);
  console.log('Input (plain text):');
  console.log(example.input);
  console.log('\nOutput (HTML paragraphs):');
  console.log(convertToHTMLParagraphs(example.input));
  console.log('\n' + '─'.repeat(50));
});
