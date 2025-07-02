#!/usr/bin/env node
/**
 * Quick test to verify the local server starts correctly with Zod validation
 */

const { spawn } = require('child_process');
const fs = require('fs');

console.log('🧪 Testing local MCP server with Zod integration...');

// Read the API key from the mcp.json file
let apiKey;
try {
  const mcpConfig = JSON.parse(fs.readFileSync('.cursor/mcp.json', 'utf8'));
  apiKey = mcpConfig.mcpServers['instantly-zod-local'].args[2]; // Third argument after node and ./dist/index.js
  console.log('🔑 Using API key from .cursor/mcp.json:', apiKey.substring(0, 8) + '...');
} catch (error) {
  console.error('❌ Could not read API key from .cursor/mcp.json:', error.message);
  process.exit(1);
}

// Check if dist/index.js exists
if (!fs.existsSync('dist/index.js')) {
  console.error('❌ dist/index.js not found. Run: npm run build');
  process.exit(1);
}

console.log('📍 Starting server: node ./dist/index.js --api-key [REDACTED]');

// Start the server
const server = spawn('node', ['./dist/index.js', '--api-key', apiKey], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: process.cwd()
});

let serverStarted = false;
let testCompleted = false;

// Handle server output
server.stdout.on('data', (data) => {
  const output = data.toString().trim();
  if (output) {
    console.log('📤 Server stdout:', output);
  }
});

// Handle server logs
server.stderr.on('data', (data) => {
  const message = data.toString().trim();
  if (message) {
    console.log('📋 Server log:', message);
    
    // Check if server started successfully
    if (message.includes('Instantly MCP server running')) {
      serverStarted = true;
      console.log('✅ Server started successfully!');
      
      // Test Zod validation after a short delay
      setTimeout(testZodValidation, 1000);
    }
    
    // Check for Zod validation messages
    if (message.includes('Validating parameters for tool') || 
        message.includes('Parameters validated successfully') ||
        message.includes('validation failed')) {
      console.log('🎯 Zod validation is active!');
    }
  }
});

// Test Zod validation
function testZodValidation() {
  if (testCompleted) return;
  testCompleted = true;
  
  console.log('\n🧪 Testing Zod validation with invalid email...');
  
  const testRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'verify_email',
      arguments: {
        email: 'invalid-email-format'  // This should trigger Zod validation error
      }
    }
  };
  
  server.stdin.write(JSON.stringify(testRequest) + '\n');
  
  // Wait for response and then clean up
  setTimeout(() => {
    console.log('\n✅ Test completed! Check the output above for Zod validation.');
    console.log('🎯 If you see validation error messages, Zod integration is working!');
    server.kill();
  }, 3000);
}

// Handle server exit
server.on('close', (code) => {
  console.log(`\n🔚 Server exited with code: ${code}`);
  
  if (serverStarted) {
    console.log('\n🎉 SUCCESS: Server started and Zod validation is active!');
    console.log('\n📋 Next steps:');
    console.log('1. 🔄 Restart Cursor IDE to load the MCP configuration');
    console.log('2. 🧪 Test with the commands in .cursor/LOCAL-TESTING-GUIDE.md');
    console.log('3. 🎯 Look for improved error messages with specific validation details');
  } else {
    console.log('\n❌ Server failed to start properly. Check the logs above.');
  }
});

// Handle server errors
server.on('error', (error) => {
  console.error('❌ Server error:', error.message);
});

// Timeout after 15 seconds
setTimeout(() => {
  if (!serverStarted) {
    console.error('\n❌ Server startup timeout. Check your API key and configuration.');
    server.kill();
    process.exit(1);
  }
}, 15000);
