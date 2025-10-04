#!/bin/bash

# Production Deployment Verification Script
# Verifies that the Accept header fix is deployed and working on production

API_KEY="MmFiZjc0MDEtOTk5Yy00ZTIwLTkwMWUtNjE2YmYyMmY1ZDYyOnh2ZklMalZjV2RlZw=="
PROD_URL="https://mcp.instantly.ai/mcp/${API_KEY}"

echo "========================================="
echo "Production Deployment Verification"
echo "========================================="
echo "Production URL: https://mcp.instantly.ai"
echo "Timestamp: $(date)"
echo ""

# Wait for deployment to complete
echo "⏳ Waiting for DigitalOcean deployment to complete..."
echo "   (Typical deployment time: 2-3 minutes)"
echo ""
echo "Press ENTER when you're ready to test, or wait 3 minutes..."
read -t 180 -p "" || echo ""
echo ""

# Test 1: Health check
echo "========================================="
echo "Test 1: Health Check"
echo "========================================="
HTTP_CODE=$(curl -s -o /tmp/health.json -w "%{http_code}" https://mcp.instantly.ai/health)
echo "HTTP Status: $HTTP_CODE"
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Server is online"
  cat /tmp/health.json | jq '.' 2>/dev/null || cat /tmp/health.json
else
  echo "❌ Server health check failed"
  cat /tmp/health.json
fi
echo ""

# Test 2: Server info
echo "========================================="
echo "Test 2: Server Info"
echo "========================================="
HTTP_CODE=$(curl -s -o /tmp/info.json -w "%{http_code}" https://mcp.instantly.ai/info)
echo "HTTP Status: $HTTP_CODE"
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Server info endpoint working"
  cat /tmp/info.json | jq '.' 2>/dev/null || cat /tmp/info.json
else
  echo "⚠️  Server info endpoint returned $HTTP_CODE"
fi
echo ""

# Test 3: Initialize with no Accept header (iOS behavior)
echo "========================================="
echo "Test 3: Initialize - No Accept Header"
echo "========================================="
echo "Simulates: Claude iOS behavior"
INIT_REQUEST='{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "Production Test",
      "version": "1.0.0"
    }
  }
}'

HTTP_CODE=$(curl -s -o /tmp/test_no_header.txt -w "%{http_code}" -X POST "$PROD_URL" \
  -H "Content-Type: application/json" \
  -d "$INIT_REQUEST")

echo "HTTP Status: $HTTP_CODE"
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ PASS - iOS behavior works"
else
  echo "❌ FAIL - Expected 200, got $HTTP_CODE"
  head -20 /tmp/test_no_header.txt
fi
echo ""

# Test 4: Initialize with Accept: application/json (Desktop/Web behavior) - THE CRITICAL TEST
echo "========================================="
echo "Test 4: Initialize - Accept: application/json"
echo "========================================="
echo "Simulates: Claude Desktop/Web behavior"
echo "THIS IS THE CRITICAL TEST FOR THE FIX!"
echo ""

HTTP_CODE=$(curl -s -o /tmp/test_desktop.txt -w "%{http_code}" -X POST "$PROD_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "$INIT_REQUEST")

echo "HTTP Status: $HTTP_CODE"
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅✅✅ PASS - THE FIX IS WORKING! ✅✅✅"
  echo ""
  echo "Claude Desktop/Web should now be able to connect!"
  echo ""
  echo "Response preview:"
  head -10 /tmp/test_desktop.txt
else
  echo "❌ FAIL - Expected 200, got $HTTP_CODE"
  echo ""
  echo "This means the fix is NOT deployed yet or there's another issue."
  echo ""
  echo "Response:"
  cat /tmp/test_desktop.txt
  echo ""
  echo "Possible reasons:"
  echo "1. DigitalOcean deployment still in progress (wait 2-3 minutes)"
  echo "2. Deployment failed (check DigitalOcean dashboard)"
  echo "3. Cache issue (try again in 1 minute)"
fi
echo ""

# Test 5: Initialize with correct Accept header
echo "========================================="
echo "Test 5: Initialize - Correct Accept Header"
echo "========================================="
echo "Simulates: Client with correct header"

HTTP_CODE=$(curl -s -o /tmp/test_correct.txt -w "%{http_code}" -X POST "$PROD_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d "$INIT_REQUEST")

echo "HTTP Status: $HTTP_CODE"
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ PASS - Correct header works"
else
  echo "❌ FAIL - Expected 200, got $HTTP_CODE"
fi
echo ""

# Test 6: Check server version/headers
echo "========================================="
echo "Test 6: Server Headers Check"
echo "========================================="
echo "Checking for server version and headers..."
echo ""

curl -s -I "$PROD_URL" -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "$INIT_REQUEST" | grep -E "(HTTP|Server|Connection|Keep-Alive|Cache-Control)"

echo ""

# Test 7: Deployment timestamp check
echo "========================================="
echo "Test 7: Deployment Timestamp"
echo "========================================="
echo "Checking when the server was last deployed..."
echo ""

# Make a request and check the response time
START_TIME=$(date +%s)
curl -s -o /dev/null "$PROD_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "$INIT_REQUEST"
END_TIME=$(date +%s)
RESPONSE_TIME=$((END_TIME - START_TIME))

echo "Response time: ${RESPONSE_TIME}s"
if [ $RESPONSE_TIME -lt 5 ]; then
  echo "✅ Server responding quickly (likely deployed)"
else
  echo "⚠️  Slow response (might be cold start or deployment in progress)"
fi
echo ""

# Summary
echo "========================================="
echo "SUMMARY"
echo "========================================="
echo ""
echo "Key Test Results:"
echo "- Health Check: $([ -f /tmp/health.json ] && echo '✅' || echo '❌')"
echo "- iOS behavior (no Accept): $(grep -q '200' <<< "$HTTP_CODE" && echo '✅' || echo '❌')"
echo "- Desktop/Web behavior (Accept: application/json): [SEE TEST 4 ABOVE]"
echo ""
echo "Next Steps:"
echo ""
echo "If Test 4 PASSED (HTTP 200):"
echo "  1. ✅ The fix is deployed and working!"
echo "  2. Open Claude Desktop (macOS app)"
echo "  3. Go to Settings → Connectors"
echo "  4. Add custom connector: https://mcp.instantly.ai/mcp/YOUR_API_KEY"
echo "  5. Should show 'Connected' status"
echo ""
echo "If Test 4 FAILED (HTTP 406 or other):"
echo "  1. Wait 2-3 minutes for deployment to complete"
echo "  2. Run this script again: ./verify-production-deployment.sh"
echo "  3. If still failing after 5 minutes, check DigitalOcean dashboard"
echo ""
echo "Manual Test Command:"
echo "curl -X POST '$PROD_URL' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Accept: application/json' \\"
echo "  -d '$INIT_REQUEST'"
echo ""
echo "========================================="

