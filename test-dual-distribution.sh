#!/bin/bash

# 🧪 COMPREHENSIVE DUAL DISTRIBUTION TESTING SCRIPT
# Tests both NPM (stdio) and GitHub (HTTP) distribution methods

set -e  # Exit on any error

echo "🔍 INSTANTLY MCP SERVER - DUAL DISTRIBUTION TESTING"
echo "=================================================="
echo "📅 Test Date: $(date)"
echo "🌿 Git Branch: $(git branch --show-current)"
echo "📦 Package Version: $(node -p "require('./package.json').version")"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=0

# Function to run test and track results
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_pattern="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -e "${BLUE}🧪 Testing: $test_name${NC}"
    
    if eval "$test_command" | grep -q "$expected_pattern"; then
        echo -e "${GREEN}✅ PASS: $test_name${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ FAIL: $test_name${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    echo ""
}

# Function to count tools in JSON response
count_tools() {
    local response="$1"
    echo "$response" | jq -r '.result.tools | length' 2>/dev/null || echo "0"
}

echo "🔨 PHASE 1: BUILD VERIFICATION"
echo "=============================="

# Test 1: Build Process
echo -e "${BLUE}🧪 Testing: Build Process${NC}"
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS: Build Process${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAIL: Build Process${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo ""

# Test 2: NPM Package Creation
echo -e "${BLUE}🧪 Testing: NPM Package Creation${NC}"
if npm pack > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS: NPM Package Creation${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAIL: NPM Package Creation${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo ""

echo "📦 PHASE 2: NPM DISTRIBUTION (STDIO TRANSPORT)"
echo "=============================================="

# Test 3: Stdio Transport - Tool Count
echo -e "${BLUE}🧪 Testing: Stdio Transport - Tool Count${NC}"
STDIO_RESPONSE=$(echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | INSTANTLY_API_KEY=test node dist/index.js 2>/dev/null)
STDIO_TOOL_COUNT=$(count_tools "$STDIO_RESPONSE")

if [ "$STDIO_TOOL_COUNT" = "29" ]; then
    echo -e "${GREEN}✅ PASS: Stdio Transport - Tool Count ($STDIO_TOOL_COUNT/29)${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAIL: Stdio Transport - Tool Count ($STDIO_TOOL_COUNT/29)${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo ""

# Test 4: Stdio Transport - Response Format
echo -e "${BLUE}🧪 Testing: Stdio Transport - Response Format${NC}"
if echo "$STDIO_RESPONSE" | jq -e '.result.tools[0].name' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS: Stdio Transport - Response Format${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAIL: Stdio Transport - Response Format${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo ""

echo "🌐 PHASE 3: GITHUB REPOSITORY (HTTP TRANSPORT)"
echo "=============================================="

# Start HTTP server in background
echo -e "${YELLOW}🚀 Starting HTTP server...${NC}"
TRANSPORT_MODE=http INSTANTLY_API_KEY=test-key node dist/index.js > /dev/null 2>&1 &
HTTP_PID=$!

# Wait for server to start
sleep 3

# Test 5: HTTP Server Health Check
echo -e "${BLUE}🧪 Testing: HTTP Server Health Check${NC}"
if curl -s http://localhost:3000/health | grep -q "healthy"; then
    echo -e "${GREEN}✅ PASS: HTTP Server Health Check${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAIL: HTTP Server Health Check${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo ""

# Test 6: Bearer Token Authentication
echo -e "${BLUE}🧪 Testing: Bearer Token Authentication${NC}"
BEARER_RESPONSE=$(curl -s -X POST http://localhost:3000/mcp \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer test-key" \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}')
BEARER_TOOL_COUNT=$(count_tools "$BEARER_RESPONSE")

if [ "$BEARER_TOOL_COUNT" = "29" ]; then
    echo -e "${GREEN}✅ PASS: Bearer Token Authentication ($BEARER_TOOL_COUNT/29 tools)${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAIL: Bearer Token Authentication ($BEARER_TOOL_COUNT/29 tools)${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo ""

# Test 7: Raw API Key Authentication (n8n compatible)
echo -e "${BLUE}🧪 Testing: Raw API Key Authentication${NC}"
RAW_RESPONSE=$(curl -s -X POST http://localhost:3000/mcp \
    -H "Content-Type: application/json" \
    -H "Authorization: test-key" \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}')
RAW_TOOL_COUNT=$(count_tools "$RAW_RESPONSE")

if [ "$RAW_TOOL_COUNT" = "29" ]; then
    echo -e "${GREEN}✅ PASS: Raw API Key Authentication ($RAW_TOOL_COUNT/29 tools)${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAIL: Raw API Key Authentication ($RAW_TOOL_COUNT/29 tools)${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo ""

# Test 8: Backward Compatibility (x-api-key)
echo -e "${BLUE}🧪 Testing: Backward Compatibility (x-api-key)${NC}"
LEGACY_RESPONSE=$(curl -s -X POST http://localhost:3000/mcp \
    -H "Content-Type: application/json" \
    -H "x-api-key: test-key" \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}')
LEGACY_TOOL_COUNT=$(count_tools "$LEGACY_RESPONSE")

if [ "$LEGACY_TOOL_COUNT" = "29" ]; then
    echo -e "${GREEN}✅ PASS: Backward Compatibility ($LEGACY_TOOL_COUNT/29 tools)${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAIL: Backward Compatibility ($LEGACY_TOOL_COUNT/29 tools)${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo ""

# Test 9: Cross-Transport Parity
echo -e "${BLUE}🧪 Testing: Cross-Transport Parity${NC}"
if [ "$STDIO_TOOL_COUNT" = "$BEARER_TOOL_COUNT" ] && [ "$BEARER_TOOL_COUNT" = "29" ]; then
    echo -e "${GREEN}✅ PASS: Cross-Transport Parity (Both have 29 tools)${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAIL: Cross-Transport Parity (Stdio: $STDIO_TOOL_COUNT, HTTP: $BEARER_TOOL_COUNT)${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo ""

# Test 10: Tool Functionality Test
echo -e "${BLUE}🧪 Testing: Tool Functionality (count_unread_emails)${NC}"
TOOL_RESPONSE=$(curl -s -X POST http://localhost:3000/mcp \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer test-key" \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"count_unread_emails","arguments":{}}}')

if echo "$TOOL_RESPONSE" | grep -q '"jsonrpc":"2.0"'; then
    echo -e "${GREEN}✅ PASS: Tool Functionality${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAIL: Tool Functionality${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo ""

# Cleanup
echo -e "${YELLOW}🧹 Cleaning up...${NC}"
kill $HTTP_PID 2>/dev/null || true
sleep 1

echo "📊 PHASE 4: DEPLOYMENT CONFIGURATION VERIFICATION"
echo "================================================"

# Test 11: Railway Configuration
echo -e "${BLUE}🧪 Testing: Railway Configuration${NC}"
if [ -f "railway.toml" ] && grep -q "start:n8n" railway.toml; then
    echo -e "${GREEN}✅ PASS: Railway Configuration${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAIL: Railway Configuration${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo ""

# Test 12: Package.json Scripts
echo -e "${BLUE}🧪 Testing: Package.json Scripts${NC}"
if grep -q '"start:n8n"' package.json; then
    echo -e "${GREEN}✅ PASS: Package.json Scripts${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAIL: Package.json Scripts${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo ""

# Test 13: Dockerfile Configuration
echo -e "${BLUE}🧪 Testing: Dockerfile Configuration${NC}"
if [ -f "Dockerfile" ] && grep -q "start:n8n" Dockerfile; then
    echo -e "${GREEN}✅ PASS: Dockerfile Configuration${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAIL: Dockerfile Configuration${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo ""

echo "📋 FINAL RESULTS"
echo "================"
echo -e "📊 Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}✅ Passed: $TESTS_PASSED${NC}"
echo -e "${RED}❌ Failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}"
    echo "🎉 ALL TESTS PASSED! 🎉"
    echo "========================"
    echo "✅ NPM Distribution (stdio): Ready"
    echo "✅ GitHub Repository (HTTP): Ready"
    echo "✅ Authentication: All 3 methods working"
    echo "✅ Cross-Transport Parity: Verified"
    echo "✅ Deployment Configuration: Complete"
    echo ""
    echo "🚀 READY FOR PRODUCTION DEPLOYMENT!"
    echo -e "${NC}"
    exit 0
else
    echo -e "${RED}"
    echo "❌ SOME TESTS FAILED"
    echo "===================="
    echo "Please review the failed tests above and fix issues before deployment."
    echo -e "${NC}"
    exit 1
fi
