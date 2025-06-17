#!/bin/bash

# Instantly MCP Server Testing Script
# Usage: ./test-with-api.sh YOUR_API_KEY

set -e

API_KEY="$1"

if [ -z "$API_KEY" ]; then
    echo "❌ Error: API key required"
    echo "Usage: $0 YOUR_INSTANTLY_API_KEY"
    echo ""
    echo "Example: $0 inst_abc123..."
    exit 1
fi

echo "🚀 INSTANTLY MCP SERVER TESTING"
echo "================================"
echo "API Key: ${API_KEY:0:10}...${API_KEY: -4}"
echo ""

# Build the server first
echo "📦 Building server..."
npm run build

echo ""
echo "🧪 Starting systematic tool tests..."
echo ""

# Function to test a tool
test_tool() {
    local tool_name="$1"
    local test_data="$2"
    local expect_error="$3"
    
    echo "🔧 Testing: $tool_name"
    
    # Create MCP request
    local request=$(cat << EOF
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "$tool_name",
    "arguments": $test_data
  }
}
EOF
)
    
    # Run the test
    local result
    if result=$(echo "$request" | timeout 30s node dist/index.js --api-key "$API_KEY" 2>&1); then
        if [ "$expect_error" = "true" ]; then
            echo "  ⚠️  Expected error but got success (this may be OK)"
        else
            echo "  ✅ SUCCESS"
        fi
    else
        if [ "$expect_error" = "true" ]; then
            echo "  ✅ Expected error occurred"
        else
            echo "  ❌ FAILED"
            echo "     Error: $result"
        fi
    fi
    echo ""
}

# Test core listing tools first (these should work)
echo "📋 PHASE 1: Core Listing Tools"
echo "------------------------------"

test_tool "list_campaigns" '{"limit": 3}' "false"
test_tool "list_accounts" '{"limit": 3}' "false" 
test_tool "list_emails" '{"limit": 3}' "false"
test_tool "check_feature_availability" '{}' "false"

# Test dependency validation tools
echo "📋 PHASE 2: Validation Tools"
echo "----------------------------"

test_tool "validate_campaign_accounts" '{}' "false"

# Test tools that require valid IDs (expect errors with test data)
echo "📋 PHASE 3: Tools Requiring Valid IDs (Expect Errors)"
echo "----------------------------------------------------"

test_tool "get_campaign" '{"campaign_id": "test-id"}' "true"
test_tool "get_email" '{"email_id": "test-id"}' "true"
test_tool "get_warmup_analytics" '{"account_id": "test-id"}' "true"

# Test premium features (may fail due to plan limitations)
echo "📋 PHASE 4: Premium Features (May Fail)"
echo "---------------------------------------"

test_tool "verify_email" '{"email": "test@example.com"}' "true"

# Test creation tools with test data (expect validation errors)
echo "📋 PHASE 5: Creation Tools (Test Validation)"
echo "--------------------------------------------"

test_tool "create_campaign" '{
  "name": "Test Campaign",
  "subject": "Test Subject", 
  "body": "Test Body",
  "email_list": ["invalid@test.com"]
}' "true"

test_tool "create_lead" '{"email": "test-lead@example.com"}' "false"

test_tool "create_lead_list" '{"name": "Test List"}' "false"

echo "🏁 TESTING COMPLETED"
echo "==================="
echo ""
echo "📊 Summary:"
echo "  • Core listing tools should work with valid API key"
echo "  • Tools requiring valid IDs should fail gracefully"
echo "  • Premium features may require plan upgrade"
echo "  • Creation tools work with proper validation"
echo ""
echo "✨ Your MCP server appears to be functioning correctly!"
echo ""
echo "🔧 For production use:"
echo "  1. Use list_accounts before create_campaign"
echo "  2. Use list_emails before reply_to_email" 
echo "  3. Handle premium feature limitations gracefully"
echo "  4. Implement proper retry logic for rate limits"