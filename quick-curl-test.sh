#!/bin/bash

# Quick Remote MCP Tool Test Script
set -e

# Configuration
MCP_ENDPOINT="https://instantly-mcp-iyjln.ondigitalocean.app/mcp/ODkxZWUzNjEtOWE5MC00ZGM5LWExOWQtNWZhYWUxZDk4ZDNlOnBQdHdjUnh4ZFhNSw=="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
PASSED=0
FAILED=0
TOTAL=0

log_test() {
    echo -e "${BLUE}🧪 Testing: $1${NC}"
}

log_pass() {
    echo -e "${GREEN}✅ PASS: $1${NC}"
    ((PASSED++))
}

log_fail() {
    echo -e "${RED}❌ FAIL: $1${NC}"
    ((FAILED++))
}

test_tool() {
    local tool_name="$1"
    local params="$2"
    local description="${3:-$tool_name}"
    
    ((TOTAL++))
    log_test "$description"
    
    local request='{"jsonrpc":"2.0","id":'$(date +%s)',"method":"tools/call","params":{"name":"'$tool_name'","arguments":'$params'}}'
    
    local response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        -d "$request" \
        --max-time 15 \
        "$MCP_ENDPOINT" 2>/dev/null)
    
    if [[ -z "$response" ]]; then
        log_fail "$tool_name - No response received"
        return
    fi
    
    # Check for error
    local has_error=$(echo "$response" | jq -r '.error // empty' 2>/dev/null)
    if [[ -n "$has_error" ]]; then
        local error_msg=$(echo "$response" | jq -r '.error.message' 2>/dev/null)
        log_fail "$tool_name - Error: $error_msg"
        return
    fi
    
    # Check for result
    local has_result=$(echo "$response" | jq -r '.result // empty' 2>/dev/null)
    if [[ -n "$has_result" ]]; then
        log_pass "$tool_name - Success"
        return
    fi
    
    log_fail "$tool_name - Unexpected response format"
}

echo -e "${BLUE}🚀 Quick MCP Tool Validation${NC}"
echo "Endpoint: $MCP_ENDPOINT"
echo ""

echo -e "${YELLOW}🎯 CRITICAL TOOLS${NC}"
test_tool "list_accounts" '{"limit":5}' "List accounts (critical)"
test_tool "list_campaigns" '{"limit":5}' "List campaigns"  
test_tool "validate_campaign_accounts" '{}' "Validate accounts for campaigns"
test_tool "get_campaign_analytics" '{}' "Get campaign analytics"

echo ""
echo -e "${YELLOW}📊 CAMPAIGN TOOLS${NC}"
test_tool "create_campaign" '{"name":"Test Campaign","subject":"Test","body":"Test body","stage":"prerequisite_check"}' "Create campaign (prerequisite check)"
test_tool "get_campaign" '{"campaign_id":"nonexistent"}' "Get campaign (with invalid ID - should show error handling)"
test_tool "get_campaign_analytics_overview" '{}' "Get analytics overview"

echo ""
echo -e "${YELLOW}👥 ACCOUNT TOOLS${NC}"
test_tool "get_warmup_analytics" '{"emails":["test@example.com"]}' "Get warmup analytics"
test_tool "get_account_details" '{"email":"test@example.com"}' "Get account details"

echo ""
echo -e "${YELLOW}📋 LEAD TOOLS${NC}"
test_tool "list_leads" '{"limit":5}' "List leads"
test_tool "create_lead" '{"email":"test@example.com","firstName":"Test"}' "Create lead"
test_tool "list_lead_lists" '{"limit":5}' "List lead lists"
test_tool "create_lead_list" '{"name":"Test List"}' "Create lead list"

echo ""
echo -e "${YELLOW}✉️ EMAIL TOOLS${NC}"
test_tool "list_emails" '{"limit":5}' "List emails"
test_tool "get_email" '{"email_id":"nonexistent"}' "Get email (invalid ID)"
test_tool "verify_email" '{"email":"test@example.com"}' "Verify email (may need premium)"

echo ""
echo -e "${YELLOW}🔧 UTILITY TOOLS${NC}"
test_tool "list_api_keys" '{}' "List API keys"
test_tool "check_feature_availability" '{}' "Check feature availability"

echo ""
echo -e "${BLUE}📊 RESULTS SUMMARY${NC}"
echo "===================="
echo "Total Tests: $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"

SUCCESS_RATE=$((PASSED * 100 / TOTAL))
echo "Success Rate: ${SUCCESS_RATE}%"

if [[ $SUCCESS_RATE -ge 90 ]]; then
    echo -e "${GREEN}🎉 EXCELLENT - Production Ready!${NC}"
elif [[ $SUCCESS_RATE -ge 75 ]]; then
    echo -e "${YELLOW}⚠️ GOOD - Minor issues to resolve${NC}"
elif [[ $SUCCESS_RATE -ge 50 ]]; then
    echo -e "${YELLOW}⚠️ NEEDS WORK - Several tools need attention${NC}"
else
    echo -e "${RED}🚨 CRITICAL - Major issues prevent production${NC}"
fi