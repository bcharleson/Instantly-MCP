#!/bin/bash

# Remote MCP Tool Validation Script
# Tests all 22 Instantly MCP tools against the deployed remote server
# URL: https://instantly-mcp-iyjln.ondigitalocean.app/mcp/ODkxZWUzNjEtOWE5MC00ZGM5LWExOWQtNWZhYWUxZDk4ZDNlOnBQdHdjUnh4ZFhNSw==

set -euo pipefail

# Configuration
MCP_ENDPOINT="https://instantly-mcp-iyjln.ondigitalocean.app/mcp/ODkxZWUzNjEtOWE5MC00ZGM5LWExOWQtNWZhYWUxZDk4ZDNlOnBQdHdjUnh4ZFhNSw=="
TIMEOUT=30
TEMP_DIR="/tmp/mcp_test_$$"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Create temp directory
mkdir -p "$TEMP_DIR"

# Cleanup function
cleanup() {
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED_TESTS++))
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED_TESTS++))
}

log_skip() {
    echo -e "${YELLOW}⏭️  $1${NC}"
    ((SKIPPED_TESTS++))
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function to test a tool with curl
test_tool() {
    local tool_name="$1"
    local params="$2"
    local expect_error="${3:-false}"
    local description="${4:-Testing $tool_name}"
    
    ((TOTAL_TESTS++))
    
    log_info "Testing $tool_name: $description"
    
    # Build MCP request
    local request_id=$(date +%s%N | cut -b1-13)  # Unix timestamp in milliseconds
    local mcp_request=$(cat << EOF
{
    "jsonrpc": "2.0",
    "id": $request_id,
    "method": "tools/call",
    "params": {
        "name": "$tool_name",
        "arguments": $params
    }
}
EOF
)
    
    # Save request to file for debugging
    local request_file="$TEMP_DIR/request_${tool_name}.json"
    echo "$mcp_request" > "$request_file"
    
    # Execute curl request
    local response_file="$TEMP_DIR/response_${tool_name}.json"
    local error_file="$TEMP_DIR/error_${tool_name}.txt"
    
    local http_code
    http_code=$(curl -s -w "%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        -d "@$request_file" \
        --max-time $TIMEOUT \
        -o "$response_file" \
        "$MCP_ENDPOINT" 2>"$error_file")
    
    local curl_exit_code=$?
    
    # Analyze results
    if [[ $curl_exit_code -ne 0 ]]; then
        local error_msg=$(cat "$error_file" 2>/dev/null || echo "Unknown curl error")
        if [[ $curl_exit_code -eq 28 ]]; then
            log_error "$tool_name: Timeout after ${TIMEOUT}s - $error_msg"
        else
            log_error "$tool_name: Curl failed (exit $curl_exit_code) - $error_msg"
        fi
        return 1
    fi
    
    # Check HTTP status
    if [[ "$http_code" != "200" ]]; then
        local response_content=$(cat "$response_file" 2>/dev/null || echo "{}")
        log_error "$tool_name: HTTP $http_code - Response: $(echo "$response_content" | head -c 200)..."
        return 1
    fi
    
    # Parse JSON response
    local response_content=$(cat "$response_file")
    
    # Check for JSON-RPC errors
    local has_error=$(echo "$response_content" | jq -r '.error // empty' 2>/dev/null)
    if [[ -n "$has_error" ]]; then
        local error_message=$(echo "$response_content" | jq -r '.error.message // "Unknown error"' 2>/dev/null)
        local error_code=$(echo "$response_content" | jq -r '.error.code // "N/A"' 2>/dev/null)
        
        if [[ "$expect_error" == "true" ]]; then
            log_success "$tool_name: Expected error received - Code: $error_code, Message: $error_message"
            return 0
        else
            log_error "$tool_name: MCP Error ($error_code): $error_message"
            return 1
        fi
    fi
    
    # Check for successful result
    local has_result=$(echo "$response_content" | jq -r '.result // empty' 2>/dev/null)
    if [[ -n "$has_result" ]]; then
        local result_preview=$(echo "$response_content" | jq -r '.result.content[0].text // .result // "Success"' 2>/dev/null | head -c 100)
        log_success "$tool_name: Success - ${result_preview}..."
        return 0
    fi
    
    # Unexpected response format
    log_error "$tool_name: Unexpected response format - $(echo "$response_content" | head -c 100)..."
    return 1
}

# Test definitions with parameters
run_all_tests() {
    echo -e "${PURPLE}🚀 INSTANTLY MCP REMOTE SERVER TOOL VALIDATION${NC}"
    echo -e "${PURPLE}================================================${NC}"
    echo "Endpoint: $MCP_ENDPOINT"
    echo "Timeout: ${TIMEOUT}s per test"
    echo ""
    
    # CRITICAL TOOLS - Test these first as they're required for campaign creation
    echo -e "${PURPLE}🎯 CRITICAL TOOLS${NC}"
    echo "----------------"
    
    test_tool "list_accounts" '{"limit": 5}' false "List first 5 accounts"
    test_tool "list_campaigns" '{"limit": 5}' false "List first 5 campaigns"
    test_tool "get_campaign_analytics" '{}' false "Get analytics overview"
    test_tool "validate_campaign_accounts" '{}' false "Validate account eligibility"
    
    echo ""
    echo -e "${PURPLE}📊 CAMPAIGN MANAGEMENT${NC}"
    echo "----------------------"
    
    test_tool "get_campaign" '{"campaign_id": "test-nonexistent-id"}' true "Get non-existent campaign"
    test_tool "create_campaign" '{"name": "Test Campaign", "subject": "Test Subject", "body": "Test body content", "stage": "prerequisite_check"}' false "Create campaign - prerequisite check"
    test_tool "update_campaign" '{"campaign_id": "test-nonexistent-id", "name": "Updated Test"}' true "Update non-existent campaign"
    test_tool "get_campaign_analytics_overview" '{}' false "Get campaign analytics overview"
    
    echo ""
    echo -e "${PURPLE}👥 ACCOUNT MANAGEMENT${NC}"
    echo "---------------------"
    
    test_tool "update_account" '{"email": "nonexistent@test.com", "daily_limit": 50}' true "Update non-existent account"
    test_tool "get_warmup_analytics" '{"emails": ["test@example.com"]}' true "Get warmup analytics for test email"
    test_tool "get_account_details" '{"email": "nonexistent@test.com"}' true "Get details for non-existent account"
    
    echo ""
    echo -e "${PURPLE}📋 LEAD MANAGEMENT${NC}"
    echo "------------------"
    
    test_tool "list_leads" '{"limit": 5}' false "List first 5 leads"
    test_tool "create_lead" '{"email": "testlead@example.com", "firstName": "Test", "lastName": "Lead"}' false "Create test lead"
    test_tool "update_lead" '{"lead_id": "test-nonexistent-id", "first_name": "Updated"}' true "Update non-existent lead"
    test_tool "list_lead_lists" '{"limit": 5}' false "List first 5 lead lists"
    test_tool "create_lead_list" '{"name": "Test List ' $(date +%s) '", "description": "Automated test list"}' false "Create test lead list"
    
    echo ""
    echo -e "${PURPLE}✉️ EMAIL OPERATIONS${NC}"
    echo "-------------------"
    
    test_tool "list_emails" '{"limit": 5}' false "List first 5 emails"
    test_tool "get_email" '{"email_id": "test-nonexistent-id"}' true "Get non-existent email"
    test_tool "reply_to_email" '{"reply_to_uuid": "test-uuid", "eaccount": "test@example.com", "subject": "Re: Test", "body": {"text": "Test reply"}}' true "Reply to non-existent email"
    test_tool "verify_email" '{"email": "test@example.com"}' true "Verify test email (may require premium)"
    
    echo ""
    echo -e "${PURPLE}🔧 UTILITY TOOLS${NC}"
    echo "----------------"
    
    test_tool "list_api_keys" '{}' false "List API keys"
    test_tool "check_feature_availability" '{}' false "Check feature availability"
    
    echo ""
    echo -e "${PURPLE}📋 TEST SUMMARY${NC}"
    echo "==============="
    echo "Total Tests: $TOTAL_TESTS"
    echo -e "${GREEN}✅ Passed: $PASSED_TESTS${NC}"
    echo -e "${RED}❌ Failed: $FAILED_TESTS${NC}"  
    echo -e "${YELLOW}⏭️ Skipped: $SKIPPED_TESTS${NC}"
    
    local success_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo "Success Rate: ${success_rate}%"
    
    if [[ $success_rate -ge 90 ]]; then
        echo -e "${GREEN}🎉 EXCELLENT: Server is production ready!${NC}"
    elif [[ $success_rate -ge 75 ]]; then
        echo -e "${YELLOW}⚠️ GOOD: Minor issues to address before production${NC}"
    elif [[ $success_rate -ge 50 ]]; then
        echo -e "${YELLOW}⚠️ NEEDS WORK: Several tools need fixing${NC}"
    else
        echo -e "${RED}🚨 CRITICAL: Major issues prevent production deployment${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}💡 NEXT STEPS:${NC}"
    echo "1. Review failed tests in detail"
    echo "2. Check server logs for error details"
    echo "3. Test with valid data from your Instantly workspace"
    echo "4. Verify API key permissions for premium features"
    echo ""
    
    # Return appropriate exit code
    if [[ $FAILED_TESTS -eq 0 ]]; then
        return 0
    else
        return 1
    fi
}

# Validate dependencies
check_dependencies() {
    if ! command -v curl &> /dev/null; then
        echo -e "${RED}Error: curl is not installed${NC}"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        echo -e "${YELLOW}Warning: jq is not installed - JSON parsing will be limited${NC}"
        # Install jq as a simple alternative for basic JSON parsing
        return 0
    fi
}

# Individual tool test function for manual testing
test_single_tool() {
    local tool_name="$1"
    local params="${2:-{}}"
    
    echo -e "${BLUE}🔍 Testing single tool: $tool_name${NC}"
    test_tool "$tool_name" "$params"
}

# Main execution
main() {
    check_dependencies
    
    if [[ $# -eq 0 ]]; then
        # Run all tests
        run_all_tests
    else
        # Test specific tool
        test_single_tool "$1" "$2"
    fi
}

# Help function
show_help() {
    cat << EOF
Remote MCP Tool Validation Script

Usage:
    $0                          # Run all tests
    $0 TOOL_NAME [PARAMS_JSON]  # Test specific tool
    $0 --help                   # Show this help

Examples:
    $0                                              # Test all tools
    $0 list_accounts '{"limit": 10}'               # Test list_accounts with custom params
    $0 create_campaign '{"name": "My Campaign"}'   # Test create_campaign

Available Tools:
    Campaign: list_campaigns, get_campaign, create_campaign, update_campaign
    Analytics: get_campaign_analytics, get_campaign_analytics_overview  
    Accounts: list_accounts, update_account, get_warmup_analytics
    Leads: list_leads, create_lead, update_lead, list_lead_lists, create_lead_list
    Email: list_emails, get_email, reply_to_email, verify_email
    Utility: list_api_keys, validate_campaign_accounts, get_account_details, check_feature_availability

EOF
}

# Handle help
if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
    show_help
    exit 0
fi

# Run main function
main "$@"