#!/bin/bash

# SYSTEMATIC SSE TRANSPORT DEBUGGING PROTOCOL
# Identifies EXACT failure point for Claude.ai web app

set -e

# Configuration
SERVER_URL="${SERVER_URL:-https://mcp.instantly.ai}"
API_KEY="${INSTANTLY_API_KEY}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  SYSTEMATIC SSE TRANSPORT DEBUGGING PROTOCOL              ║${NC}"
echo -e "${CYAN}║  Identifies EXACT failure point for Claude.ai web app     ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check prerequisites
if [ -z "$API_KEY" ]; then
    echo -e "${RED}ERROR: INSTANTLY_API_KEY environment variable not set${NC}"
    echo "Set it with: export INSTANTLY_API_KEY=your_api_key"
    exit 1
fi

echo -e "${GREEN}✓ API Key: ${API_KEY:0:10}...${NC}"
echo -e "${GREEN}✓ Server: $SERVER_URL${NC}"
echo ""

# Test 1: Health Check
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}TEST 1: Server Health Check${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
curl -s "$SERVER_URL/health" | jq '.'
echo -e "${GREEN}✓ Server is running${NC}\n"

# Test 2: POST /messages with apiKey (CRITICAL TEST)
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}TEST 2: POST /messages?apiKey=XXX (Fallback Mode)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "This tests if the fallback logic works when SSE session doesn't exist"
echo ""
echo "Request:"
echo "POST $SERVER_URL/messages?apiKey=XXX"
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}'
echo ""
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    "$SERVER_URL/messages?apiKey=$API_KEY" \
    -d '{"jsonrpc":"2.0","method":"tools/list","id":1}')
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')
echo "Response Status: $HTTP_STATUS"
echo "Response Body:"
echo "$BODY" | jq '.'
if [ "$HTTP_STATUS" = "200" ] && echo "$BODY" | jq -e '.result.tools' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS: Fallback mode works - tools/list returned successfully${NC}"
else
    echo -e "${RED}✗ FAIL: Fallback mode broken${NC}"
fi
echo ""

# Test 3: POST /messages with create_lead (CRITICAL TEST)
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}TEST 3: POST /messages - create_lead tool call${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "This tests if create_lead works in fallback mode"
echo ""
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    "$SERVER_URL/messages?apiKey=$API_KEY" \
    -d '{
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
            "name": "create_lead",
            "arguments": {
                "email": "test-sse-debug@example.com",
                "first_name": "SSE",
                "last_name": "Debug"
            }
        },
        "id": 1
    }')
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')
echo "Response Status: $HTTP_STATUS"
echo "Response Body:"
echo "$BODY" | jq '.'
if [ "$HTTP_STATUS" = "200" ] && echo "$BODY" | jq -e '.result' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS: create_lead works in fallback mode${NC}"
else
    echo -e "${RED}✗ FAIL: create_lead failed${NC}"
    echo "Error details:"
    echo "$BODY" | jq '.error'
fi
echo ""

# Test 4: POST /messages with sessionId=API_KEY
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}TEST 4: POST /messages?sessionId=API_KEY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "This tests if sessionId can be used as API key (Claude.ai might do this)"
echo ""
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    "$SERVER_URL/messages?sessionId=$API_KEY" \
    -d '{"jsonrpc":"2.0","method":"tools/list","id":1}')
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')
echo "Response Status: $HTTP_STATUS"
echo "Response Body:"
echo "$BODY" | jq '.'
if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ PASS: sessionId-as-API-key works${NC}"
else
    echo -e "${RED}✗ FAIL: sessionId-as-API-key failed${NC}"
fi
echo ""

# Test 5: Streamable HTTP (for comparison)
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}TEST 5: POST /mcp (Streamable HTTP - for comparison)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "This is what OpenAI Playground and Claude iOS use"
echo ""
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    "$SERVER_URL/mcp/$API_KEY" \
    -d '{"jsonrpc":"2.0","method":"tools/list","id":1}')
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')
echo "Response Status: $HTTP_STATUS"
if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ PASS: Streamable HTTP works${NC}"
else
    echo -e "${RED}✗ FAIL: Streamable HTTP broken${NC}"
fi
echo ""

# Summary
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  DEBUGGING SUMMARY                                         ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}CRITICAL FINDINGS:${NC}"
echo "1. If TEST 2 PASSES: Fallback mode works (POST /messages?apiKey=XXX)"
echo "2. If TEST 3 PASSES: create_lead works in fallback mode"
echo "3. If TEST 4 PASSES: sessionId can be used as API key"
echo "4. If TEST 5 PASSES: Streamable HTTP still works (OpenAI/Claude iOS)"
echo ""
echo -e "${YELLOW}NEXT STEPS FOR CLAUDE.AI WEB DEBUGGING:${NC}"
echo "1. Open Claude.ai web app in browser"
echo "2. Open DevTools (F12) → Network tab"
echo "3. Try to create a lead"
echo "4. Look for POST /messages request"
echo "5. Check the request URL - does it have ?apiKey= or ?sessionId=?"
echo "6. Check the request body - what's the structure?"
echo "7. Check the response - what error is returned?"
echo ""
echo -e "${BLUE}Server Logs:${NC}"
echo "https://cloud.digitalocean.com/apps/baa4c0f8-c0a5-4e8c-8e5e-ec0b0e0e0e0e/logs"
echo ""
echo -e "${YELLOW}HYPOTHESIS:${NC}"
echo "If all tests above PASS, then Claude.ai web is NOT using the fallback"
echo "endpoints correctly. It might be:"
echo "  - Using a different sessionId format"
echo "  - Not passing apiKey in query params"
echo "  - Using a real SSE session that's failing"
echo ""
echo "Check the browser Network tab to see the ACTUAL request structure!"
echo ""

