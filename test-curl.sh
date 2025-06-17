#!/bin/bash

# Direct curl test of the campaign creation API
# Usage: ./test-curl.sh YOUR_API_KEY

if [ -z "$1" ]; then
    echo "❌ Usage: ./test-curl.sh YOUR_API_KEY"
    exit 1
fi

API_KEY="$1"

echo "🧪 Testing Instantly API v2 directly with curl..."

# Create the JSON payload (same structure as MCP server v3.1.3)
cat > payload.json << 'EOF'
{
  "name": "Test Campaign Tool",
  "email_list": ["brandon@onlinetopoffunnel.org"],
  "daily_limit": 50,
  "email_gap": 10,
  "link_tracking": false,
  "open_tracking": false,
  "stop_on_reply": true,
  "stop_on_auto_reply": true,
  "text_only": false,
  "campaign_schedule": {
    "schedules": [{
      "name": "Default Schedule",
      "timing": {
        "from": "09:00",
        "to": "17:00"
      },
      "days": {
        "1": true,
        "2": true,
        "3": true,
        "4": true,
        "5": true
      },
      "timezone": "America/New_York"
    }]
  },
  "sequences": [{
    "steps": [{
      "type": "email",
      "delay": 0,
      "variants": [{
        "subject": "Test Subject",
        "body": "This is a test email body.\\n\\nBest regards,\\n{{firstName}}",
        "v_disabled": false
      }]
    }]
  }]
}
EOF

echo "📝 Payload to send:"
cat payload.json | jq .

echo ""
echo "🚀 Making API call..."

curl -X POST "https://api.instantly.ai/api/v2/campaigns" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d @payload.json \
  -w "\n📊 Response Code: %{http_code}\n" \
  -v

# Clean up
rm payload.json

echo ""
echo "✅ Test complete!"