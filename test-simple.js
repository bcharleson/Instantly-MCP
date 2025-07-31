#!/usr/bin/env node

/**
 * Simple Server Test
 * Tests the MCP server directly to verify it works
 */

const { spawn } = require('child_process');

console.log('🧪 Testing MCP Server...\n');

function testServer() {
  return new Promise((resolve) => {
    const testInput = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    });
    
    console.log('Starting server...');
    
    const server = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env, 
        INSTANTLY_API_KEY: 'test-key',
        NODE_ENV: 'development'
      }
    });
    
    let output = '';
    let hasError = false;
    
    server.stdout.on('data', (data) => {
      output += data.toString();
      console.log('📤 Output:', data.toString().trim());
      
      // Check for valid JSON response
      try {
        const lines = output.trim().split('\n');
        for (const line of lines) {
          if (line.trim().startsWith('{')) {
            const response = JSON.parse(line);
            if (response.result && response.result.tools) {
              console.log(`✅ SUCCESS: Server returned ${response.result.tools.length} tools`);
              server.kill();
              resolve({ success: true, toolCount: response.result.tools.length });
              return;
            }
          }
        }
      } catch (e) {
        // Continue waiting
      }
    });
    
    server.stderr.on('data', (data) => {
      const errorText = data.toString();
      console.log('📋 Server log:', errorText.trim());
      
      if (errorText.includes('Cannot read properties of undefined')) {
        console.log('❌ FOUND ERROR: Cannot read properties of undefined');
        hasError = true;
        server.kill();
        resolve({ success: false, error: 'undefined property error' });
      }
    });
    
    server.on('close', (code) => {
      if (!hasError) {
        console.log(`Server exited with code ${code}`);
        resolve({ success: false, error: `Exit code ${code}` });
      }
    });
    
    server.on('error', (error) => {
      console.log(`❌ Server error: ${error.message}`);
      resolve({ success: false, error: error.message });
    });
    
    // Send test input
    console.log('📨 Sending tools/list request...');
    server.stdin.write(testInput + '\n');
    server.stdin.end();
    
    // Timeout
    setTimeout(() => {
      server.kill();
      console.log('⏰ Test timed out');
      resolve({ success: false, error: 'timeout' });
    }, 8000);
  });
}

async function main() {
  const result = await testServer();
  
  console.log('\n📊 RESULT:');
  if (result.success) {
    console.log(`✅ Server is working! Found ${result.toolCount} tools`);
    console.log('\n🎯 Next steps:');
    console.log('1. The server fix worked');
    console.log('2. Restart Claude Desktop');
    console.log('3. Test with Claude Desktop again');
  } else {
    console.log(`❌ Server failed: ${result.error}`);
    console.log('\n🔧 Need to investigate further');
  }
}

main();
