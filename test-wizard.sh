#!/bin/bash
# Quick test script for the Campaign Creation Wizard v2.5.1
# Usage: ./test-wizard.sh YOUR_API_KEY

echo "🧙‍♂️ Testing Campaign Creation Wizard v2.5.1"
echo "=============================================="

if [ -z "$1" ]; then
    echo "❌ Usage: ./test-wizard.sh YOUR_API_KEY"
    echo "   Get your API key from: https://app.instantly.ai/app/settings/integrations"
    exit 1
fi

API_KEY="$1"

echo ""
echo "🔍 Step 1: Checking verified sending accounts..."
echo "Command: npx instantly-mcp@2.5.1 --api-key YOUR_API_KEY"
echo ""

# Test Step 1: Check accounts
npx instantly-mcp@2.5.1 --api-key "$API_KEY" <<EOF
campaign_creation_wizard {"step": "start"}
EOF

echo ""
echo "📝 Step 2: Test validation with missing fields..."
echo ""

# Test Step 2: Missing fields validation
npx instantly-mcp@2.5.1 --api-key "$API_KEY" <<EOF
campaign_creation_wizard {"step": "info_gathered", "name": "Test Campaign"}
EOF

echo ""
echo "✅ Campaign Creation Wizard basic test completed!"
echo ""
echo "🚀 For complete workflow test, run:"
echo "   tsx test-complete-wizard.ts YOUR_API_KEY"
echo ""
echo "💡 Next Steps:"
echo "1. Use a verified email from Step 1 in your actual campaign creation"
echo "2. Follow the 3-step wizard process: start → info_gathered → create"
echo "3. The wizard prevents 400 Bad Request errors by validating everything first"
echo ""
echo "📚 See CAMPAIGN_CREATION_WIZARD.md for the complete guide"
