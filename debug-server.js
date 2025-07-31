#!/usr/bin/env node

/**
 * Debug Server - Test MCP Server Directly
 * 
 * This script tests the MCP server outside of Claude Desktop
 * to isolate whether the issue is with the server or the integration.
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🔍 DEBUGGING MCP SERVER\n');

// Test 1: Check if dist/index.js exists
console.log('📁 Step 1: Checking build files...');
const fs = require('fs');
const distPath = path.join(__dirname, 'dist', 'index.js');

if (fs.existsSync(distPath)) {
  console.log('✅ dist/index.js exists');
  const stats = fs.statSync(distPath);
  console.log(`   File size: ${stats.size} bytes`);
  console.log(`   Modified: ${stats.mtime}`);
} else {
  console.log('❌ dist/index.js NOT FOUND');
  console.log('   Run: npm run build');
  process.exit(1);
}

// Test 2: Test server startup
console.log('\n🚀 Step 2: Testing server startup...');

function testServerStartup() {
  return new Promise((resolve, reject) => {
    const testInput = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    });
    
    console.log('   Starting server with test input...');
    
    const serverProcess = spawn('node', [distPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env, 
        INSTANTLY_API_KEY: 'test-key-for-debugging',
        NODE_ENV: 'development'
      }
    });
    
    let stdout = '';
    let stderr = '';
    let hasResponded = false;
    
    serverProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(`   📤 STDOUT: ${data.toString().trim()}`);
      
      // Try to parse response
      try {
        const lines = stdout.trim().split('\n');
        for (const line of lines) {
          if (line.trim() && line.startsWith('{')) {
            const response = JSON.parse(line);
            if (response.result && response.result.tools) {
              console.log(`   ✅ Server responded with ${response.result.tools.length} tools`);
              hasResponded = true;
              serverProcess.kill();
              resolve({
                success: true,
                toolCount: response.result.tools.length,
                tools: response.result.tools.map(t => t.name)
              });
              return;
            }
          }
        }
      } catch (e) {
        // Continue waiting for valid JSON
      }
    });
    
    serverProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log(`   📋 STDERR: ${data.toString().trim()}`);
    });
    
    serverProcess.on('close', (code) => {
      if (!hasResponded) {
        console.log(`   ❌ Server exited with code ${code}`);
        console.log(`   📤 Final STDOUT: ${stdout}`);
        console.log(`   📋 Final STDERR: ${stderr}`);
        
        // Check for specific errors
        if (stderr.includes('Cannot read properties of undefined')) {
          console.log('   🔍 FOUND THE ERROR: "Cannot read properties of undefined"');
          console.log('   🔧 This suggests a code issue in the server implementation');
        }
        
        resolve({
          success: false,
          error: `Server exited with code ${code}`,
          stdout: stdout,
          stderr: stderr
        });
      }
    });
    
    serverProcess.on('error', (error) => {
      console.log(`   ❌ Server error: ${error.message}`);
      resolve({
        success: false,
        error: error.message
      });
    });
    
    // Send test input
    console.log('   📨 Sending tools/list request...');
    serverProcess.stdin.write(testInput + '\n');
    serverProcess.stdin.end();
    
    // Timeout after 10 seconds
    setTimeout(() => {
      if (!hasResponded) {
        serverProcess.kill();
        console.log('   ⏰ Server test timed out');
        resolve({
          success: false,
          error: 'Timeout'
        });
      }
    }, 10000);
  });
}

// Test 3: Test HTTP mode
function testHttpMode() {
  return new Promise((resolve, reject) => {
    console.log('\n🌐 Step 3: Testing HTTP mode...');
    
    const httpServer = spawn('node', [distPath, '--n8n'], {
      env: { 
        ...process.env, 
        INSTANTLY_API_KEY: 'test-key-for-debugging',
        NODE_ENV: 'development',
        PORT: '3001'  // Use different port to avoid conflicts
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let serverReady = false;
    
    httpServer.stderr.on('data', (data) => {
      const output = data.toString();
      console.log(`   📋 HTTP Server: ${output.trim()}`);
      
      if (output.includes('Ready for n8n automation workflows')) {
        serverReady = true;
        console.log('   ✅ HTTP server started successfully');
        httpServer.kill();
        resolve({ success: true });
      } else if (output.includes('Cannot read properties of undefined')) {
        console.log('   ❌ HTTP server has the same error');
        httpServer.kill();
        resolve({ success: false, error: 'Same undefined error in HTTP mode' });
      }
    });
    
    httpServer.on('error', (error) => {
      console.log(`   ❌ HTTP server error: ${error.message}`);
      resolve({ success: false, error: error.message });
    });
    
    // Timeout
    setTimeout(() => {
      if (!serverReady) {
        httpServer.kill();
        console.log('   ⏰ HTTP server test timed out');
        resolve({ success: false, error: 'HTTP server timeout' });
      }
    }, 8000);
  });
}

// Main execution
async function main() {
  try {
    // Test stdio mode
    const stdioResult = await testServerStartup();
    
    // Test HTTP mode
    const httpResult = await testHttpMode();
    
    // Summary
    console.log('\n📊 DEBUG RESULTS SUMMARY\n');
    
    console.log('📱 stdio Mode:');
    console.log(`   Status: ${stdioResult.success ? '✅ WORKING' : '❌ FAILED'}`);
    if (stdioResult.success) {
      console.log(`   Tools: ${stdioResult.toolCount}`);
      console.log(`   Sample tools: ${stdioResult.tools.slice(0, 3).join(', ')}...`);
    } else {
      console.log(`   Error: ${stdioResult.error}`);
    }
    
    console.log('\n🌐 HTTP Mode:');
    console.log(`   Status: ${httpResult.success ? '✅ WORKING' : '❌ FAILED'}`);
    if (!httpResult.success) {
      console.log(`   Error: ${httpResult.error}`);
    }
    
    console.log('\n🎯 DIAGNOSIS:');
    if (stdioResult.success && httpResult.success) {
      console.log('✅ Server implementation is working correctly');
      console.log('🔧 Issue is likely with Claude Desktop configuration');
      console.log('\n📋 NEXT STEPS:');
      console.log('1. Check Claude Desktop config file path');
      console.log('2. Verify JSON syntax in config');
      console.log('3. Restart Claude Desktop completely');
    } else {
      console.log('❌ Server implementation has issues');
      console.log('🔧 Need to fix server code before testing with Claude Desktop');
      console.log('\n📋 NEXT STEPS:');
      console.log('1. Check the error messages above');
      console.log('2. Fix the "Cannot read properties of undefined" error');
      console.log('3. Rebuild and test again');
    }
    
    process.exit(stdioResult.success ? 0 : 1);
    
  } catch (error) {
    console.error(`\n💥 Debug script failed: ${error.message}`);
    process.exit(1);
  }
}

main();
