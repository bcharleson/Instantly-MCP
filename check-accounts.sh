#!/bin/bash
# Quick script to check your verified accounts
# Replace YOUR_API_KEY with your actual Instantly API key

echo "🔍 Checking your verified sending accounts..."
echo "Usage: ./check-accounts.sh YOUR_API_KEY"

if [ -z "$1" ]; then
    echo "❌ Please provide your API key as the first argument"
    echo "   Get it from: https://app.instantly.ai/app/settings/integrations"
    exit 1
fi

npx instantly-mcp@latest --api-key "$1" <<EOF
list_accounts
EOF
