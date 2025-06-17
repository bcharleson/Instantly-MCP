#!/bin/bash

# Test script for published instantly-mcp@1.0.4 package
# Validates the enhanced pagination system works from npm

set -e

echo "🚀 Testing Published instantly-mcp@1.0.4 Package"
echo "=================================================="

# Check if API key is provided
if [ -z "$1" ]; then
    echo "❌ Usage: ./test-published-v1.0.4.sh YOUR_API_KEY"
    exit 1
fi

API_KEY="$1"

# Create temporary test directory
TEST_DIR="/tmp/instantly-mcp-test-$(date +%s)"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

echo "📦 Installing instantly-mcp@1.0.4 from npm..."
npm init -y > /dev/null 2>&1
npm install instantly-mcp@1.0.4 > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Package installed successfully"
else
    echo "❌ Package installation failed"
    exit 1
fi

echo ""
echo "🔍 Testing Enhanced Pagination Features..."
echo "----------------------------------------"

# Test 1: Complete Account Pagination
echo "📋 Test 1: Complete Account Pagination (limit=100)"
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "list_accounts", "arguments": {"limit": 100}}}' | \
npx instantly-mcp --api-key "$API_KEY" > test1_output.json 2> test1_stderr.log

if grep -q "pagination_info\|total_retrieved\|complete pagination" test1_output.json; then
    echo "✅ Complete pagination detected in response"
    
    # Extract metrics
    TOTAL=$(grep -o '"total_retrieved":[0-9]*' test1_output.json | cut -d':' -f2 || echo "unknown")
    echo "   📊 Total accounts retrieved: $TOTAL"
    
    # Check for progress messages in stderr
    if grep -q "Retrieved.*accounts so far" test1_stderr.log; then
        echo "   🔄 Progress reporting working"
    fi
else
    echo "⚠️  Pagination features not detected (may be single page)"
fi

echo ""

# Test 2: Campaign Pagination with get_all flag
echo "📋 Test 2: Campaign Pagination (get_all=true)"
echo '{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "list_campaigns", "arguments": {"get_all": true}}}' | \
npx instantly-mcp --api-key "$API_KEY" > test2_output.json 2> test2_stderr.log

if grep -q "pagination_info\|total_retrieved\|pages_used" test2_output.json; then
    echo "✅ Complete pagination detected in response"
    
    # Extract metrics
    TOTAL=$(grep -o '"total_retrieved":[0-9]*' test2_output.json | cut -d':' -f2 || echo "unknown")
    PAGES=$(grep -o '"pages_used":[0-9]*' test2_output.json | cut -d':' -f2 || echo "unknown")
    echo "   📊 Total campaigns retrieved: $TOTAL"
    echo "   📄 Pages used: $PAGES"
else
    echo "⚠️  Pagination features not detected (may be single page)"
fi

echo ""

# Test 3: Standard single-page request (should not trigger pagination)
echo "📋 Test 3: Standard Single-Page Request (limit=20)"
echo '{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "list_accounts", "arguments": {"limit": 20}}}' | \
npx instantly-mcp --api-key "$API_KEY" > test3_output.json 2> test3_stderr.log

if grep -q "Use limit=100 or get_all=true for complete pagination" test3_output.json; then
    echo "✅ Single-page mode with pagination guidance detected"
else
    echo "⚠️  Single-page guidance not found"
fi

echo ""
echo "📊 SUMMARY"
echo "=========="

# Count successful tests
SUCCESS_COUNT=0

if grep -q "pagination_info\|total_retrieved" test1_output.json; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
fi

if grep -q "pagination_info\|total_retrieved" test2_output.json; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
fi

if grep -q "Use limit=100 or get_all=true" test3_output.json; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
fi

echo "✅ Successful tests: $SUCCESS_COUNT/3"

if [ $SUCCESS_COUNT -eq 3 ]; then
    echo "🎉 Enhanced Pagination System is working perfectly!"
    echo "✅ instantly-mcp@1.0.4 ready for production use"
elif [ $SUCCESS_COUNT -ge 2 ]; then
    echo "✅ Pagination system mostly working"
    echo "⚠️  Some features may need fine-tuning"
else
    echo "⚠️  Pagination system needs attention"
fi

echo ""
echo "📋 Test files created in: $TEST_DIR"
echo "   - test1_output.json (complete account pagination)"
echo "   - test2_output.json (complete campaign pagination)"  
echo "   - test3_output.json (single-page request)"
echo ""
echo "🧹 To clean up: rm -rf $TEST_DIR"

# Check package version
INSTALLED_VERSION=$(npm list instantly-mcp --depth=0 2>/dev/null | grep instantly-mcp | cut -d'@' -f2 || echo "unknown")
echo "📦 Installed version: instantly-mcp@$INSTALLED_VERSION"
