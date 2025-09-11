#!/bin/bash
# Quick script to check your verified accounts
#
# Secure Usage (Recommended):
#   export INSTANTLY_API_KEY="your-api-key-here"
#   ./check-accounts.sh
#
# Alternative (Less Secure):
#   ./check-accounts.sh YOUR_API_KEY

echo "🔍 Checking your verified sending accounts..."
echo ""
echo "💡 For security, set INSTANTLY_API_KEY environment variable instead of using command-line arguments"

# Check for API key in environment variable first
if [ -n "$INSTANTLY_API_KEY" ]; then
    API_KEY="$INSTANTLY_API_KEY"
    echo "✅ Using API key from INSTANTLY_API_KEY environment variable"
elif [ -n "$1" ]; then
    echo "⚠️  WARNING: Passing API keys as command-line arguments is insecure!"
    echo "   Consider setting INSTANTLY_API_KEY environment variable instead"
    echo "   Example: export INSTANTLY_API_KEY='your-key-here'"
    echo ""
    API_KEY="$1"
else
    echo "🔐 Please provide your Instantly API key"
    echo "   Get it from: https://app.instantly.ai/app/settings/integrations"
    echo ""
    echo "Choose one of these secure methods:"
    echo "1. Set environment variable: export INSTANTLY_API_KEY='your-key-here'"
    echo "2. Enter it securely when prompted below"
    echo ""
    printf "Enter API key (input will be hidden): "

    # Read API key securely without echoing to terminal
    if command -v stty >/dev/null 2>&1; then
        # Use stty if available (most Unix systems)
        stty -echo
        read API_KEY
        stty echo
        echo ""
    else
        # Fallback for systems without stty
        read -s API_KEY 2>/dev/null || read API_KEY
        echo ""
    fi

    if [ -z "$API_KEY" ]; then
        echo "❌ No API key provided"
        exit 1
    fi
fi

# Export the API key as an environment variable for the child process
export INSTANTLY_API_KEY="$API_KEY"

# Use the environment variable instead of command-line argument
npx instantly-mcp@latest <<EOF
list_accounts
EOF
