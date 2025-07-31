#!/usr/bin/env node

/**
 * Comprehensive Debug Script
 * 
 * This script tests the MCP server step by step to identify exactly
 * where the "Cannot read properties of undefined (reading 'get')" error occurs.
 */

const { spawn } = require('child_process');
const fs = require('fs');

console.log('🔍 COMPREHENSIVE MCP SERVER DEBUG\n');

// Test 1: Verify files exist
function verifyFiles() {
  console.log('📁 Step 1: Verifying build files...');
  
  const files = [
    'dist/index.js',
    'dist/rate-limiter.js', 
    'dist/validation.js'
  ];
  
  for (const file of files) {
    if (fs.existsSync(file)) {
      const stats = fs.statSync(file);
      console.log(`   ✅ ${file} (${stats.size} bytes, modified: ${stats.mtime.toISOString()})`);
    } else {
      console.log(`   ❌ ${file} NOT FOUND`);
      return false;
    }
  }
  
  return true;
}

// Test 2: Test tools/list (should work)
function testToolsList() {
  return new Promise((resolve) => {
    console.log('\n📋 Step 2: Testing tools/list...');
    
    const testInput = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    });
    
    const server = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env, 
        INSTANTLY_API_KEY: 'test-key-for-debugging',
        NODE_ENV: 'development'
      }
    });
    
    let stdout = '';
    let stderr = '';
    let hasResult = false;
    
    server.stdout.on('data', (data) => {
      stdout += data.toString();
      
      try {
        const lines = stdout.trim().split('\n');
        for (const line of lines) {
          if (line.trim().startsWith('{')) {
            const response = JSON.parse(line);
            if (response.result && response.result.tools) {
              console.log(`   ✅ tools/list: ${response.result.tools.length} tools found`);
              hasResult = true;
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
      stderr += data.toString();
      console.log(`   📋 Log: ${data.toString().trim()}`);
    });
    
    server.on('close', (code) => {
      if (!hasResult) {
        console.log(`   ❌ tools/list failed (exit code: ${code})`);
        resolve({ success: false, error: `Exit code ${code}`, stderr });
      }
    });
    
    server.on('error', (error) => {
      console.log(`   ❌ tools/list error: ${error.message}`);
      resolve({ success: false, error: error.message });
    });
    
    server.stdin.write(testInput + '\n');
    server.stdin.end();
    
    setTimeout(() => {
      if (!hasResult) {
        server.kill();
        console.log('   ⏰ tools/list timeout');
        resolve({ success: false, error: 'timeout' });
      }
    }, 8000);
  });
}

// Test 3: Test list_api_keys specifically (the failing tool)
function testListApiKeys() {
  return new Promise((resolve) => {
    console.log('\n🔑 Step 3: Testing list_api_keys (the failing tool)...');
    
    const testInput = JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'list_api_keys',
        arguments: {}
      }
    });
    
    const server = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env, 
        INSTANTLY_API_KEY: 'NTc3NDExNTYtYTA1My00NDVkLTlmZmUtYjUwN2UxYzJlYjY4OlBxZ3RLSU9iZGdSTA==',
        NODE_ENV: 'development'
      }
    });
    
    let stdout = '';
    let stderr = '';
    let hasResult = false;
    
    server.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(`   📤 STDOUT: ${data.toString().trim()}`);
      
      try {
        const lines = stdout.trim().split('\n');
        for (const line of lines) {
          if (line.trim().startsWith('{')) {
            const response = JSON.parse(line);
            if (response.result) {
              console.log(`   ✅ list_api_keys: SUCCESS`);
              hasResult = true;
              server.kill();
              resolve({ success: true });
              return;
            } else if (response.error) {
              console.log(`   ❌ list_api_keys: ERROR - ${response.error.message}`);
              hasResult = true;
              server.kill();
              resolve({ success: false, error: response.error.message });
              return;
            }
          }
        }
      } catch (e) {
        // Continue waiting
      }
    });
    
    server.stderr.on('data', (data) => {
      stderr += data.toString();
      const logText = data.toString().trim();
      console.log(`   📋 Log: ${logText}`);
      
      // Check for the specific error
      if (logText.includes('Cannot read properties of undefined')) {
        console.log(`   🎯 FOUND THE ERROR: ${logText}`);
        hasResult = true;
        server.kill();
        resolve({ 
          success: false, 
          error: 'Cannot read properties of undefined',
          errorLocation: 'Found in stderr logs'
        });
      }
    });
    
    server.on('close', (code) => {
      if (!hasResult) {
        console.log(`   ❌ list_api_keys failed (exit code: ${code})`);
        console.log(`   📤 Final STDOUT: ${stdout}`);
        console.log(`   📋 Final STDERR: ${stderr}`);
        resolve({ success: false, error: `Exit code ${code}`, stdout, stderr });
      }
    });
    
    server.on('error', (error) => {
      console.log(`   ❌ list_api_keys process error: ${error.message}`);
      resolve({ success: false, error: error.message });
    });
    
    server.stdin.write(testInput + '\n');
    server.stdin.end();
    
    setTimeout(() => {
      if (!hasResult) {
        server.kill();
        console.log('   ⏰ list_api_keys timeout');
        resolve({ success: false, error: 'timeout' });
      }
    }, 10000);
  });
}

// Test 4: Test list_accounts (should work with pagination fix)
function testListAccounts() {
  return new Promise((resolve) => {
    console.log('\n👥 Step 4: Testing list_accounts (pagination fix)...');
    
    const testInput = JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'list_accounts',
        arguments: { get_all: true }
      }
    });
    
    const server = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env, 
        INSTANTLY_API_KEY: 'NTc3NDExNTYtYTA1My00NDVkLTlmZmUtYjUwN2UxYzJlYjY4OlBxZ3RLSU9iZGdSTA==',
        NODE_ENV: 'development'
      }
    });
    
    let stdout = '';
    let stderr = '';
    let hasResult = false;
    
    server.stdout.on('data', (data) => {
      stdout += data.toString();
      
      try {
        const lines = stdout.trim().split('\n');
        for (const line of lines) {
          if (line.trim().startsWith('{')) {
            const response = JSON.parse(line);
            if (response.result && response.result.content) {
              const content = JSON.parse(response.result.content[0].text);
              const accountCount = content.total_retrieved || 0;
              console.log(`   ✅ list_accounts: ${accountCount} accounts retrieved`);
              hasResult = true;
              server.kill();
              resolve({ success: true, accountCount });
              return;
            } else if (response.error) {
              console.log(`   ❌ list_accounts: ERROR - ${response.error.message}`);
              hasResult = true;
              server.kill();
              resolve({ success: false, error: response.error.message });
              return;
            }
          }
        }
      } catch (e) {
        // Continue waiting
      }
    });
    
    server.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log(`   📋 Log: ${data.toString().trim()}`);
    });
    
    server.on('close', (code) => {
      if (!hasResult) {
        console.log(`   ❌ list_accounts failed (exit code: ${code})`);
        resolve({ success: false, error: `Exit code ${code}` });
      }
    });
    
    server.on('error', (error) => {
      console.log(`   ❌ list_accounts error: ${error.message}`);
      resolve({ success: false, error: error.message });
    });
    
    server.stdin.write(testInput + '\n');
    server.stdin.end();
    
    setTimeout(() => {
      if (!hasResult) {
        server.kill();
        console.log('   ⏰ list_accounts timeout');
        resolve({ success: false, error: 'timeout' });
      }
    }, 15000);
  });
}

// Main execution
async function main() {
  try {
    // Step 1: Verify files
    if (!verifyFiles()) {
      console.log('\n❌ Build files missing. Run: npm run build');
      process.exit(1);
    }
    
    // Step 2: Test tools/list
    const toolsResult = await testToolsList();
    
    // Step 3: Test list_api_keys (the failing one)
    const apiKeysResult = await testListApiKeys();
    
    // Step 4: Test list_accounts (should work)
    const accountsResult = await testListAccounts();
    
    // Summary
    console.log('\n📊 COMPREHENSIVE DEBUG RESULTS\n');
    
    console.log('📋 tools/list:');
    console.log(`   Status: ${toolsResult.success ? '✅ WORKING' : '❌ FAILED'}`);
    if (toolsResult.success) {
      console.log(`   Tools found: ${toolsResult.toolCount}`);
    } else {
      console.log(`   Error: ${toolsResult.error}`);
    }
    
    console.log('\n🔑 list_api_keys:');
    console.log(`   Status: ${apiKeysResult.success ? '✅ WORKING' : '❌ FAILED'}`);
    if (!apiKeysResult.success) {
      console.log(`   Error: ${apiKeysResult.error}`);
      if (apiKeysResult.errorLocation) {
        console.log(`   Location: ${apiKeysResult.errorLocation}`);
      }
    }
    
    console.log('\n👥 list_accounts:');
    console.log(`   Status: ${accountsResult.success ? '✅ WORKING' : '❌ FAILED'}`);
    if (accountsResult.success) {
      console.log(`   Accounts: ${accountsResult.accountCount} (should be 398)`);
    } else {
      console.log(`   Error: ${accountsResult.error}`);
    }
    
    console.log('\n🎯 DIAGNOSIS:');
    if (toolsResult.success && !apiKeysResult.success) {
      console.log('❌ Server starts correctly but list_api_keys tool has issues');
      console.log('🔧 The error is specific to the list_api_keys implementation');
      console.log('📍 Check the makeInstantlyRequest call in list_api_keys case');
    } else if (!toolsResult.success) {
      console.log('❌ Server has fundamental startup issues');
      console.log('🔧 Need to fix basic server functionality first');
    } else {
      console.log('✅ All tests passed - issue might be with Claude Desktop integration');
    }
    
    process.exit(apiKeysResult.success ? 0 : 1);
    
  } catch (error) {
    console.error(`\n💥 Debug script failed: ${error.message}`);
    process.exit(1);
  }
}

main();
