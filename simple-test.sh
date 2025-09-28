#!/bin/bash

# Super simple test
echo "Testing list_accounts..."

curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -d '{"jsonrpc":"2.0","id":123,"method":"tools/call","params":{"name":"list_accounts","arguments":{"limit":3}}}' \
    --max-time 10 \
    https://instantly-mcp-iyjln.ondigitalocean.app/mcp/ODkxZWUzNjEtOWE5MC00ZGM5LWExOWQtNWZhYWUxZDk4ZDNlOnBQdHdjUnh4ZFhNSw== | jq -r '.result.content[0].text' | head -10

echo -e "\n\nTesting list_campaigns..."

curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -d '{"jsonrpc":"2.0","id":124,"method":"tools/call","params":{"name":"list_campaigns","arguments":{"limit":3}}}' \
    --max-time 10 \
    https://instantly-mcp-iyjln.ondigitalocean.app/mcp/ODkxZWUzNjEtOWE5MC00ZGM5LWExOWQtNWZhYWUxZDg4ZDNlOnBQdHdjUnh4ZFhNSw== | jq -r '.result.content[0].text' | head -10

echo -e "\n\nTesting create_campaign (prerequisite check)..."

curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -d '{"jsonrpc":"2.0","id":125,"method":"tools/call","params":{"name":"create_campaign","arguments":{"name":"Test Campaign","subject":"Test","body":"Test body","stage":"prerequisite_check"}}}' \
    --max-time 10 \
    https://instantly-mcp-iyjln.ondigitalocean.app/mcp/ODkxZWUzNjEtOWE5MC00ZGM5LWExOWQtNWZhYWUxZDk4ZDNlOnBQdHdjUnh4ZFhNSw== | jq -r '.result.content[0].text' | head -10

echo -e "\n\nDone!"