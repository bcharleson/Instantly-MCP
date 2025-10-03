#!/bin/bash

# Quick MCP Test - Fast pagination and timeout testing
# Usage: INSTANTLY_API_KEY=your-key ./quick-test.sh

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

MCP_URL="${MCP_URL:-https://mcp.instantly.ai}"
API_KEY="${INSTANTLY_API_KEY:-}"

if [ -z "$API_KEY" ]; then
    echo "❌ Error: INSTANTLY_API_KEY not set"
    echo "Usage: INSTANTLY_API_KEY=your-key ./quick-test.sh"
    exit 1
fi

echo -e "${BLUE}🚀 Quick MCP Test${NC}"
echo -e "${YELLOW}Server:${NC} $MCP_URL"
echo ""

# Helper function
mcp_call() {
    local tool=$1
    local args=$2
    local user_agent=${3:-"QuickTest/1.0"}
    
    curl -s -X POST "$MCP_URL/mcp/$API_KEY" \
        -H "Content-Type: application/json" \
        -H "User-Agent: $user_agent" \
        -d "{
            \"jsonrpc\": \"2.0\",
            \"id\": 1,
            \"method\": \"tools/call\",
            \"params\": {
                \"name\": \"$tool\",
                \"arguments\": $args
            }
        }" | jq -r '.result.content[0].text' | jq .
}

# Test 1: Basic pagination
echo -e "${BLUE}1. Testing basic pagination (10 campaigns)${NC}"
mcp_call "list_campaigns" '{"limit": 10}' | jq '{
    count: (.data | length),
    has_more: .pagination.has_more,
    next_cursor: .pagination.next_starting_after
}'

echo ""

# Test 2: Gemini client (strict timeout)
echo -e "${BLUE}2. Testing Gemini client (20s timeout)${NC}"
START=$(date +%s)
mcp_call "list_campaigns" '{"limit": 50}' "Gemini/1.0" | jq '{
    count: (.data | length),
    has_more: .pagination.has_more,
    timeout_warning: (.pagination.note // "none")
}'
END=$(date +%s)
DURATION=$((END - START))
echo -e "${YELLOW}⏱️  Duration: ${DURATION}s${NC}"

echo ""

# Test 3: ChatGPT client (moderate timeout)
echo -e "${BLUE}3. Testing ChatGPT client (30s timeout)${NC}"
START=$(date +%s)
mcp_call "list_campaigns" '{"limit": 100}' "ChatGPT/1.0" | jq '{
    count: (.data | length),
    has_more: .pagination.has_more,
    timeout_warning: (.pagination.note // "none")
}'
END=$(date +%s)
DURATION=$((END - START))
echo -e "${YELLOW}⏱️  Duration: ${DURATION}s${NC}"

echo ""

# Test 4: Date filtering
echo -e "${BLUE}4. Testing date filtering${NC}"
mcp_call "list_campaigns" '{
    "limit": 20,
    "created_after": "2024-09-01"
}' | jq '{
    count: (.data | length),
    has_more: .pagination.has_more
}'

echo ""

# Test 5: Pagination continuation
echo -e "${BLUE}5. Testing pagination continuation${NC}"
FIRST_PAGE=$(mcp_call "list_campaigns" '{"limit": 5}')
CURSOR=$(echo "$FIRST_PAGE" | jq -r '.pagination.next_starting_after // empty')

if [ -n "$CURSOR" ]; then
    echo -e "${GREEN}✅ Got cursor: ${CURSOR:0:30}...${NC}"
    echo -e "${BLUE}   Fetching next page...${NC}"
    mcp_call "list_campaigns" "{\"limit\": 5, \"starting_after\": \"$CURSOR\"}" | jq '{
        count: (.data | length),
        has_more: .pagination.has_more
    }'
else
    echo -e "${YELLOW}⚠️  No cursor (all data in first page)${NC}"
fi

echo ""
echo -e "${GREEN}✅ Quick test complete!${NC}"

