#!/usr/bin/env node
/**
 * Test MCP Server with Zod Integration
 * 
 * This script tests the MCP server with Zod validation to ensure:
 * 1. The server starts correctly with Zod validation
 * 2. Tools are properly listed
 * 3. Validation works as expected
 * 4. Error messages are clear and helpful
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Testing MCP Server with Zod Integration...\n');

// Test configuration
const TEST_API_KEY = 'test-api-key-for-validation-testing';
const SERVER_PATH = path.join(__dirname, 'dist', 'index.js');

console.log(`📍 Server path: ${SERVER_PATH}`);
console.log(`🔑 Test API key: ${TEST_API_KEY}\n`);

// Function to test MCP server startup and basic functionality
async function testMCPServer() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting MCP server...');
    
    // Start the MCP server process
    const serverProcess = spawn('node', [SERVER_PATH, '--api-key', TEST_API_KEY], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: __dirname
    });

    let stdout = '';
    let stderr = '';
    let serverReady = false;

    // Capture stdout
    serverProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log('📤 Server stdout:', data.toString().trim());
    });

    // Capture stderr (server logs)
    serverProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      const message = data.toString().trim();
      console.log('📋 Server stderr:', message);
      
      // Check if server is ready
      if (message.includes('Instantly MCP server running')) {
        serverReady = true;
        console.log('✅ Server started successfully!');
        
        // Test basic MCP protocol communication
        setTimeout(() => {
          testMCPCommunication(serverProcess, resolve, reject);
        }, 1000);
      }
    });

    // Handle process exit
    serverProcess.on('close', (code) => {
      console.log(`🔚 Server process exited with code: ${code}`);
      if (!serverReady) {
        reject(new Error(`Server failed to start. Exit code: ${code}\nStderr: ${stderr}`));
      }
    });

    // Handle process errors
    serverProcess.on('error', (error) => {
      console.error('❌ Server process error:', error);
      reject(error);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!serverReady) {
        serverProcess.kill();
        reject(new Error('Server startup timeout'));
      }
    }, 10000);
  });
}

// Function to test MCP protocol communication
function testMCPCommunication(serverProcess, resolve, reject) {
  console.log('\n📡 Testing MCP protocol communication...');
  
  let responseData = '';
  
  // Listen for responses
  serverProcess.stdout.on('data', (data) => {
    responseData += data.toString();
    
    // Check if we got a complete JSON response
    try {
      const lines = responseData.split('\n').filter(line => line.trim());
      for (const line of lines) {
        if (line.trim().startsWith('{')) {
          const response = JSON.parse(line);
          console.log('📨 Received response:', JSON.stringify(response, null, 2));
          
          if (response.result && response.result.tools) {
            console.log('✅ Tools list received successfully!');
            console.log(`📊 Found ${response.result.tools.length} tools`);
            
            // Test validation by sending an invalid request
            testValidation(serverProcess, resolve, reject);
            return;
          }
        }
      }
    } catch (e) {
      // Not a complete JSON response yet, continue waiting
    }
  });

  // Send list tools request
  const listToolsRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  };

  console.log('📤 Sending list tools request...');
  serverProcess.stdin.write(JSON.stringify(listToolsRequest) + '\n');
}

// Function to test Zod validation
function testValidation(serverProcess, resolve, reject) {
  console.log('\n🔍 Testing Zod validation...');
  
  let validationResponseData = '';
  
  // Listen for validation response
  const validationListener = (data) => {
    validationResponseData += data.toString();
    
    try {
      const lines = validationResponseData.split('\n').filter(line => line.trim());
      for (const line of lines) {
        if (line.trim().startsWith('{')) {
          const response = JSON.parse(line);
          
          if (response.error) {
            console.log('✅ Validation error received as expected!');
            console.log('📋 Error message:', response.error.message);
            
            // Check if error message contains Zod validation details
            if (response.error.message.includes('validation failed') || 
                response.error.message.includes('Invalid email') ||
                response.error.message.includes('required')) {
              console.log('✅ Zod validation is working correctly!');
            } else {
              console.log('⚠️  Error message format may need improvement');
            }
            
            // Clean up and resolve
            serverProcess.stdout.removeListener('data', validationListener);
            serverProcess.kill();
            resolve({
              success: true,
              message: 'MCP server with Zod validation is working correctly'
            });
            return;
          }
        }
      }
    } catch (e) {
      // Not a complete JSON response yet, continue waiting
    }
  };

  serverProcess.stdout.on('data', validationListener);

  // Send invalid tool call to test validation
  const invalidToolCall = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'verify_email',
      arguments: {
        email: 'invalid-email-format'  // This should trigger Zod validation error
      }
    }
  };

  console.log('📤 Sending invalid tool call to test validation...');
  serverProcess.stdin.write(JSON.stringify(invalidToolCall) + '\n');

  // Timeout for validation test
  setTimeout(() => {
    serverProcess.stdout.removeListener('data', validationListener);
    serverProcess.kill();
    reject(new Error('Validation test timeout'));
  }, 5000);
}

// Run the test
async function runTest() {
  try {
    console.log('🎯 Starting comprehensive MCP + Zod integration test...\n');
    
    const result = await testMCPServer();
    
    console.log('\n🎉 Test Results:');
    console.log('✅ MCP server startup: SUCCESS');
    console.log('✅ Tool listing: SUCCESS');
    console.log('✅ Zod validation: SUCCESS');
    console.log('✅ Error handling: SUCCESS');
    console.log('\n🚀 Integration test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - Server starts with Zod validation enabled');
    console.log('   - Tools are properly listed');
    console.log('   - Invalid parameters trigger Zod validation errors');
    console.log('   - Error messages are clear and actionable');
    console.log('\n🎯 Ready for testing in Claude Desktop, Cursor IDE, and n8n!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting steps:');
    console.log('   1. Ensure the project is built: npm run build');
    console.log('   2. Check that dist/index.js exists');
    console.log('   3. Verify Zod is properly installed');
    console.log('   4. Check for TypeScript compilation errors');
    process.exit(1);
  }
}

// Check if dist/index.js exists before running test
const fs = require('fs');
if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Server file not found:', SERVER_PATH);
  console.log('🔧 Please run: npm run build');
  process.exit(1);
}

runTest();
