#!/usr/bin/env node

/**
 * Integration test for HTML paragraph formatting in Instantly MCP
 * Tests the actual MCP tool with HTML paragraph conversion
 */

const { spawn } = require('child_process');
const fs = require('fs');

// Test the MCP tool with HTML paragraph formatting
async function testHTMLParagraphIntegration() {
  console.log('🧪 Testing HTML Paragraph Integration with Instantly MCP\n');

  // Test campaign with paragraph formatting
  const testCampaign = {
    name: 'HTML Paragraph Test Campaign',
    subject: 'Visual Formatting Test',
    body: 'Hi {{firstName}},\n\nWelcome to our newsletter!\n\nWe have exciting updates:\n• Feature 1\n• Feature 2\n• Feature 3\n\nBest regards,\nThe Team',
    email_list: ['test@example.com'],
    stage: 'preview'
  };

  const mcpRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'create_campaign',
      arguments: testCampaign
    }
  };

  console.log('📤 Sending test request to MCP server...');
  console.log('Input body (plain text):');
  console.log(testCampaign.body);
  console.log('\n' + '─'.repeat(50));

  return new Promise((resolve, reject) => {
    const mcp = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    let output = '';
    let errorOutput = '';

    mcp.stdout.on('data', (data) => {
      output += data.toString();
    });

    mcp.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    mcp.on('close', (code) => {
      console.log('📥 MCP server response received\n');
      
      try {
        // Parse the JSON response
        const lines = output.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        const response = JSON.parse(lastLine);

        if (response.result && response.result.content) {
          const content = response.result.content[0];
          
          if (content.type === 'text') {
            const responseData = JSON.parse(content.text);
            
            console.log('✅ MCP Response Analysis:');
            console.log('─'.repeat(30));
            
            if (responseData.campaign_preview && responseData.campaign_preview.sequences) {
              const emailBody = responseData.campaign_preview.sequences[0].steps[0].variants[0].body;
              
              console.log('📧 Converted body (HTML paragraphs):');
              console.log(emailBody);
              console.log('\n' + '─'.repeat(50));
              
              // Verify HTML paragraph conversion
              const hasHTMLParagraphs = emailBody.includes('<p>') && emailBody.includes('</p>');
              const hasLineBreaks = emailBody.includes('<br>');
              const preservesPersonalization = emailBody.includes('{{firstName}}');
              
              console.log('🔍 Validation Results:');
              console.log(`   ✅ Contains HTML paragraphs: ${hasHTMLParagraphs}`);
              console.log(`   ✅ Contains line breaks: ${hasLineBreaks}`);
              console.log(`   ✅ Preserves personalization: ${preservesPersonalization}`);
              
              if (hasHTMLParagraphs && hasLineBreaks && preservesPersonalization) {
                console.log('\n🎉 SUCCESS: HTML paragraph formatting is working correctly!');
                console.log('   - Plain text input was converted to HTML paragraphs');
                console.log('   - Line breaks are properly formatted');
                console.log('   - Personalization variables are preserved');
                resolve(true);
              } else {
                console.log('\n❌ FAILURE: HTML paragraph formatting is not working as expected');
                reject(new Error('HTML paragraph formatting validation failed'));
              }
            } else {
              console.log('❌ No campaign preview found in response');
              reject(new Error('No campaign preview in response'));
            }
          } else {
            console.log('❌ Unexpected response content type');
            reject(new Error('Unexpected response content type'));
          }
        } else {
          console.log('❌ No result content in response');
          console.log('Response:', JSON.stringify(response, null, 2));
          reject(new Error('No result content in response'));
        }
      } catch (error) {
        console.log('❌ Error parsing MCP response:', error.message);
        console.log('Raw output:', output);
        console.log('Error output:', errorOutput);
        reject(error);
      }
    });

    mcp.on('error', (error) => {
      console.log('❌ MCP process error:', error.message);
      reject(error);
    });

    // Send the request
    mcp.stdin.write(JSON.stringify(mcpRequest) + '\n');
    mcp.stdin.end();
  });
}

// Run the test
testHTMLParagraphIntegration()
  .then(() => {
    console.log('\n✅ Integration test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.log('\n❌ Integration test failed:', error.message);
    process.exit(1);
  });
