#!/usr/bin/env node

const { spawn } = require('child_process');

console.log('🧪 Minimal Server Test\n');

// Test just server startup
const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { 
    ...process.env, 
    INSTANTLY_API_KEY: 'test-key',
    NODE_ENV: 'development'
  }
});

let hasOutput = false;

server.stdout.on('data', (data) => {
  hasOutput = true;
  console.log('📤 STDOUT:', data.toString().trim());
});

server.stderr.on('data', (data) => {
  hasOutput = true;
  const text = data.toString().trim();
  console.log('📋 STDERR:', text);
  
  if (text.includes('Cannot read properties of undefined')) {
    console.log('🎯 FOUND ERROR: Cannot read properties of undefined');
    console.log('🔍 This confirms the error is in server startup, not tool execution');
  }
  
  if (text.includes('Initializing server')) {
    console.log('✅ Server is starting...');
    
    // Send a simple test after server starts
    setTimeout(() => {
      console.log('📨 Sending tools/list test...');
      const testInput = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      });
      server.stdin.write(testInput + '\n');
      server.stdin.end();
    }, 1000);
  }
});

server.on('close', (code) => {
  console.log(`\n📊 Server exited with code: ${code}`);
  if (!hasOutput) {
    console.log('❌ No output received - server failed to start');
  }
});

server.on('error', (error) => {
  console.log(`❌ Server error: ${error.message}`);
});

// Timeout
setTimeout(() => {
  server.kill();
  console.log('\n⏰ Test completed');
}, 8000);
