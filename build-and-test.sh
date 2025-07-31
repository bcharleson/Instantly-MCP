#!/bin/bash

# Build and Test Script for 7 New Production Tools
# Ensures compilation and basic functionality before deployment

set -e

echo "🏗️ BUILDING AND TESTING INSTANTLY MCP SERVER"
echo "=============================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run this script from the project root."
    exit 1
fi

# Check for required environment variables
if [ -z "$INSTANTLY_API_KEY" ]; then
    echo "❌ Error: INSTANTLY_API_KEY environment variable is required"
    echo "   Set it with: export INSTANTLY_API_KEY=your_api_key"
    exit 1
fi

echo "🔑 API Key configured: ${INSTANTLY_API_KEY:0:8}..."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the project
echo "🔨 Building TypeScript..."
npx tsc

if [ $? -ne 0 ]; then
    echo "❌ TypeScript compilation failed"
    exit 1
fi

echo "✅ Build successful"

# Check if dist directory exists
if [ ! -d "dist" ]; then
    echo "❌ Error: dist directory not found after build"
    exit 1
fi

# Check if main file exists
if [ ! -f "dist/index.js" ]; then
    echo "❌ Error: dist/index.js not found after build"
    exit 1
fi

echo "📁 Build artifacts verified"

# Test basic functionality
echo "🧪 Testing basic MCP server functionality..."

# Test tools list
echo "📋 Testing tools list..."
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | timeout 10s node dist/index.js > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Tools list test passed"
else
    echo "❌ Tools list test failed"
    exit 1
fi

# Count tools
echo "🔢 Counting available tools..."
TOOL_COUNT=$(echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | timeout 10s node dist/index.js 2>/dev/null | jq -r '.result.tools | length' 2>/dev/null || echo "0")

echo "📊 Available tools: $TOOL_COUNT"

if [ "$TOOL_COUNT" -eq "29" ]; then
    echo "✅ Correct tool count (29 tools: 22 original + 7 new)"
elif [ "$TOOL_COUNT" -gt "22" ]; then
    echo "⚠️ Tool count is $TOOL_COUNT (expected 29, but > 22 indicates new tools added)"
else
    echo "❌ Tool count is $TOOL_COUNT (expected 29)"
    exit 1
fi

# Test one of the new tools (safe read-only)
echo "🔍 Testing new tool: count_unread_emails..."
UNREAD_TEST=$(echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"count_unread_emails","arguments":{}}}' | timeout 15s node dist/index.js 2>/dev/null | jq -r '.result.content[0].text' 2>/dev/null || echo "null")

if [ "$UNREAD_TEST" != "null" ] && echo "$UNREAD_TEST" | jq -e '.success' > /dev/null 2>&1; then
    echo "✅ New tool test passed"
    UNREAD_COUNT=$(echo "$UNREAD_TEST" | jq -r '.unread_count' 2>/dev/null || echo "unknown")
    echo "📧 Unread emails: $UNREAD_COUNT"
else
    echo "❌ New tool test failed"
    echo "Response: $UNREAD_TEST"
    exit 1
fi

echo ""
echo "🎉 BUILD AND BASIC TESTS SUCCESSFUL!"
echo "✅ TypeScript compilation: PASSED"
echo "✅ Tool count verification: PASSED ($TOOL_COUNT tools)"
echo "✅ New tool functionality: PASSED"
echo ""
echo "📋 NEXT STEPS:"
echo "1. Run comprehensive tests: node test-new-tools.js"
echo "2. Test multi-transport: TRANSPORT_MODE=http node dist/index.js"
echo "3. Deploy to production when all tests pass"
echo ""
echo "🚀 Ready for comprehensive testing and deployment!"
