#!/usr/bin/env node

/**
 * Production startup script for Instantly MCP Server
 * Handles environment configuration and graceful shutdown
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load production environment variables
function loadProductionEnv() {
  const envFile = join(__dirname, '.env.production');
  if (existsSync(envFile)) {
    const envContent = readFileSync(envFile, 'utf8');
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=');
          envVars[key] = value;
        }
      }
    });
    
    // Apply environment variables if not already set
    Object.entries(envVars).forEach(([key, value]) => {
      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
    
    console.log('✅ Loaded production environment configuration');
  }
}

// Validate required configuration
function validateConfig() {
  const required = ['NODE_ENV', 'TRANSPORT_MODE', 'PORT', 'HOST'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
  
  // Validate values
  if (process.env.NODE_ENV !== 'production') {
    console.warn('⚠️  NODE_ENV is not set to "production"');
  }
  
  if (process.env.TRANSPORT_MODE !== 'http') {
    console.error('❌ TRANSPORT_MODE must be "http" for production deployment');
    process.exit(1);
  }
  
  const port = parseInt(process.env.PORT);
  if (isNaN(port) || port < 1 || port > 65535) {
    console.error('❌ Invalid PORT value:', process.env.PORT);
    process.exit(1);
  }
  
  console.log('✅ Configuration validated');
}

// Start the MCP server
function startServer() {
  console.log('🚀 Starting Instantly MCP Server in production mode...');
  console.log(`📡 Server will run on ${process.env.HOST}:${process.env.PORT}`);
  console.log(`🔐 Authentication: Per-request API keys`);
  console.log(`🌐 Transport: ${process.env.TRANSPORT_MODE}`);
  
  const serverProcess = spawn('node', ['dist/index.js'], {
    stdio: 'inherit',
    env: process.env
  });
  
  // Handle server process events
  serverProcess.on('error', (error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });
  
  serverProcess.on('exit', (code, signal) => {
    if (signal) {
      console.log(`🛑 Server terminated by signal: ${signal}`);
    } else {
      console.log(`🛑 Server exited with code: ${code}`);
    }
    process.exit(code || 0);
  });
  
  // Graceful shutdown handling
  const shutdown = (signal) => {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    serverProcess.kill('SIGTERM');
    
    // Force kill after 10 seconds
    setTimeout(() => {
      console.log('⚠️  Force killing server process...');
      serverProcess.kill('SIGKILL');
      process.exit(1);
    }, 10000);
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  return serverProcess;
}

// Health check function
async function healthCheck() {
  const host = process.env.HOST === '0.0.0.0' ? 'localhost' : process.env.HOST;
  const port = process.env.PORT;
  const url = `http://${host}:${port}/health`;
  
  try {
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Health check passed:', data.status);
      return true;
    } else {
      console.error('❌ Health check failed:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Health check error:', error.message);
    return false;
  }
}

// Main function
async function main() {
  console.log('🏭 Instantly MCP Server - Production Startup');
  console.log('==========================================');
  
  // Load and validate configuration
  loadProductionEnv();
  validateConfig();
  
  // Start the server
  const serverProcess = startServer();
  
  // Wait a moment for server to start, then run health check
  setTimeout(async () => {
    const healthy = await healthCheck();
    if (healthy) {
      console.log('🎉 Server started successfully and is healthy!');
      console.log('');
      console.log('📋 Available endpoints:');
      console.log(`   Health: http://${process.env.HOST}:${process.env.PORT}/health`);
      console.log(`   Info: http://${process.env.HOST}:${process.env.PORT}/info`);
      console.log(`   MCP (Header): http://${process.env.HOST}:${process.env.PORT}/mcp`);
      console.log(`   MCP (URL): http://${process.env.HOST}:${process.env.PORT}/mcp/{API_KEY}`);
    } else {
      console.error('❌ Server failed health check');
      serverProcess.kill('SIGTERM');
    }
  }, 3000);
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

main().catch((error) => {
  console.error('❌ Startup failed:', error);
  process.exit(1);
});
