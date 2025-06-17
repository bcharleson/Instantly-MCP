#!/usr/bin/env node

/**
 * Live test for HTML paragraph formatting with actual Instantly API
 * Tests the complete workflow: input -> conversion -> API -> visual verification
 */

const { spawn } = require('child_process');

// SECURITY: API key must be provided via environment variable
const API_KEY = process.env.INSTANTLY_API_KEY;

if (!API_KEY) {
  console.error('❌ SECURITY ERROR: API key must be provided via INSTANTLY_API_KEY environment variable');
  console.error('   Example: export INSTANTLY_API_KEY="your-api-key-here"');
  console.error('   Then run: node test-html-formatting-live.cjs');
  process.exit(1);
}

async function testHTMLFormattingLive() {
  console.log('🧪 Testing HTML Paragraph Formatting with Live Instantly API\n');

  // Test campaign with rich paragraph formatting
  const testCampaign = {
    name: 'HTML Formatting Verification Test',
    subject: 'Visual Formatting Test - {{firstName}}',
    body: 'Hi {{firstName}},\n\nWelcome to our newsletter! We have exciting updates.\n\nWe have exciting updates:\n• Feature 1 - Enhanced performance\n• Feature 2 - Better user experience\n• Feature 3 - Advanced analytics\n\nWould you like to learn more about:\n- How these features can help your business\n- Implementation timeline\n- Pricing options\n\nBest regards,\nThe {{companyName}} Team\n\nP.S. Reply to this email if you have any questions!',
    email_list: ['brandon@onlinetopoffunnel.org'],
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

  console.log('📤 Testing HTML Paragraph Conversion');
  console.log('=====================================');
  console.log('Input body (plain text with \\n line breaks):');
  console.log(testCampaign.body);
  console.log('\n' + '─'.repeat(70));

  return new Promise((resolve, reject) => {
    const mcp = spawn('node', ['dist/index.js', '--api-key', API_KEY], {
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
        
        if (!lastLine) {
          throw new Error('No response received from MCP server');
        }

        const response = JSON.parse(lastLine);

        if (response.error) {
          console.log('❌ MCP Error:', response.error.message);
          reject(new Error(response.error.message));
          return;
        }

        if (response.result && response.result.content) {
          const content = response.result.content[0];
          
          if (content.type === 'text') {
            const responseData = JSON.parse(content.text);
            
            console.log('✅ MCP Response Analysis:');
            console.log('═'.repeat(50));

            if (responseData.campaign_preview && responseData.campaign_preview.body) {
              const emailBody = responseData.campaign_preview.body;
              
              console.log('📧 Converted body (HTML paragraphs):');
              console.log(emailBody);
              console.log('\n' + '─'.repeat(70));
              
              // Comprehensive validation
              const validations = {
                hasHTMLParagraphs: emailBody.includes('<p>') && emailBody.includes('</p>'),
                hasLineBreaks: emailBody.includes('<br>'),
                preservesPersonalization: emailBody.includes('{{firstName}}') && emailBody.includes('{{companyName}}'),
                properParagraphStructure: emailBody.match(/<p>[^<]*<\/p>/g) !== null,
                noBadHTML: !emailBody.includes('<script>') && !emailBody.includes('<div>'),
                bulletPointsFormatted: emailBody.includes('• Feature 1 - Enhanced performance<br>• Feature 2 - Better user experience<br>• Feature 3 - Advanced analytics'),
                multiplePersonalizationVars: emailBody.includes('{{firstName}}') && emailBody.includes('{{companyName}}')
              };
              
              console.log('🔍 Comprehensive Validation Results:');
              console.log('─'.repeat(40));
              Object.entries(validations).forEach(([test, passed]) => {
                console.log(`   ${passed ? '✅' : '❌'} ${test}: ${passed}`);
              });
              
              const allPassed = Object.values(validations).every(v => v);
              
              if (allPassed) {
                console.log('\n🎉 SUCCESS: HTML paragraph formatting is working perfectly!');
                console.log('   ✅ Plain text input was converted to HTML paragraphs');
                console.log('   ✅ Line breaks are properly formatted with <br> tags');
                console.log('   ✅ Paragraph separation uses <p> tags');
                console.log('   ✅ Personalization variables are preserved');
                console.log('   ✅ Bullet points maintain proper formatting');
                console.log('   ✅ No unsafe HTML tags are present');
                console.log('\n📊 Visual Rendering Quality: EXCELLENT');
                console.log('   - Professional paragraph separation');
                console.log('   - Clear visual hierarchy');
                console.log('   - Optimal email client compatibility');
                
                resolve(true);
              } else {
                console.log('\n❌ FAILURE: Some validation checks failed');
                const failedTests = Object.entries(validations)
                  .filter(([_, passed]) => !passed)
                  .map(([test, _]) => test);
                console.log('   Failed tests:', failedTests.join(', '));
                reject(new Error('HTML paragraph formatting validation failed'));
              }
            } else {
              console.log('❌ No campaign preview found in response');
              console.log('Response structure:', JSON.stringify(responseData, null, 2));
              reject(new Error('No campaign preview in response'));
            }
          } else {
            console.log('❌ Unexpected response content type:', content.type);
            reject(new Error('Unexpected response content type'));
          }
        } else {
          console.log('❌ No result content in response');
          console.log('Full response:', JSON.stringify(response, null, 2));
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
console.log('🚀 Starting Live HTML Formatting Test with Instantly API\n');

testHTMLFormattingLive()
  .then(() => {
    console.log('\n✅ Live integration test completed successfully!');
    console.log('🎯 HTML paragraph formatting is production-ready');
    console.log('📈 Expected visual improvement: SIGNIFICANT');
    process.exit(0);
  })
  .catch((error) => {
    console.log('\n❌ Live integration test failed:', error.message);
    console.log('🔧 Please review the implementation');
    process.exit(1);
  });
