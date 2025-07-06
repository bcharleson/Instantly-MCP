#!/bin/bash

# 🎯 Cursor MCP Testing Setup
# This script helps set up Cursor IDE testing for the Zod integration

set -e

echo "🎯 Setting up Cursor IDE testing for Zod integration..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if API key is provided
if [ -z "$1" ]; then
    print_warning "Usage: $0 <your-instantly-api-key>"
    print_warning "Example: $0 inst_abc123..."
    exit 1
fi

API_KEY="$1"

# Create .cursor directory if it doesn't exist
mkdir -p .cursor

# Create the MCP configuration
print_status "Creating Cursor MCP configuration..."
cat > .cursor/mcp.json << EOF
{
  "mcpServers": {
    "instantly-zod-test": {
      "command": "npx",
      "args": ["instantly-mcp@alpha", "--api-key", "$API_KEY"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
EOF

print_success "Cursor MCP configuration created at .cursor/mcp.json"

# Create testing instructions
cat > .cursor/CURSOR-TESTING-GUIDE.md << 'EOF'
# 🎯 Cursor IDE Testing Guide for Zod Integration

## Setup Complete! 

Your Cursor IDE is now configured to test the Zod integration locally.

## Testing Commands

### 1. Valid Operations (Should Work)
- "List all my Instantly accounts"
- "Create a campaign named 'Test Campaign' with subject 'Hello {{firstName}}' and body 'Hi {{firstName}}, This is a test. Best regards' for email test@example.com"
- "Verify email address test@example.com"

### 2. Invalid Operations (Should Show Clear Errors)
- "Verify email address invalid-email-format" 
- "Create a campaign with empty name"
- "Get warmup analytics for 101 emails" (over limit)
- "Create campaign with invalid timezone 'Invalid/Zone'"

## Expected Behavior

### ✅ Success Indicators:
- Valid commands work normally
- Invalid commands show specific, clear error messages
- Error messages mention the exact validation issue
- No "undefined" or generic errors

### ❌ Failure Indicators:
- Runtime crashes or undefined errors
- Generic "validation failed" messages
- Commands that should work but don't
- Inconsistent error handling

## Rollback if Issues Found

If you encounter problems:

1. **Immediate NPM rollback:**
   ```bash
   npm dist-tag add instantly-mcp@1.0.6 latest
   ```

2. **Update .cursor/mcp.json to use stable version:**
   ```json
   {
     "mcpServers": {
       "instantly-stable": {
         "command": "npx",
         "args": ["instantly-mcp", "--api-key", "YOUR_API_KEY"]
       }
     }
   }
   ```

## Reporting Issues

If you find issues, please note:
- Exact command that failed
- Error message received
- Expected vs actual behavior
- Environment details (Cursor version, etc.)

Happy testing! 🚀
EOF

print_success "Testing guide created at .cursor/CURSOR-TESTING-GUIDE.md"

echo
print_success "🎉 Cursor testing setup complete!"
echo
echo "📋 Next steps:"
echo "1. Publish alpha version: npm version prerelease --preid=alpha && npm publish --tag alpha"
echo "2. Restart Cursor IDE to load the new MCP configuration"
echo "3. Test the commands listed in .cursor/CURSOR-TESTING-GUIDE.md"
echo "4. Report any issues or confirm success"
echo
print_warning "Remember: This configuration is in .gitignore and won't be committed"
