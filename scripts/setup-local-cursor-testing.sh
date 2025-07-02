#!/bin/bash

# 🎯 Local Cursor MCP Testing Setup
# This script sets up Cursor IDE to test the Zod integration using the local build

set -e

echo "🎯 Setting up LOCAL Cursor IDE testing for Zod integration..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
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

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if API key is provided
if [ -z "$1" ]; then
    print_error "Usage: $0 <your-instantly-api-key>"
    print_warning "Example: $0 inst_abc123..."
    echo
    print_status "This will set up LOCAL testing using the built files in ./dist/"
    exit 1
fi

API_KEY="$1"

# Validate API key format
if [[ ! "$API_KEY" =~ ^inst_.+ ]]; then
    print_warning "API key should start with 'inst_' - are you sure this is correct?"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

print_status "Setting up local Cursor testing with API key: ${API_KEY:0:8}..."

# Step 1: Build the project
print_status "Building project with Zod integration..."
if npm run build; then
    print_success "Build completed successfully"
else
    print_error "Build failed. Please fix compilation errors before testing."
    exit 1
fi

# Step 2: Verify dist/index.js exists
if [ ! -f "dist/index.js" ]; then
    print_error "dist/index.js not found. Build may have failed."
    exit 1
fi

# Step 3: Create/update the local MCP configuration
print_status "Creating local MCP configuration..."
mkdir -p .cursor

cat > .cursor/mcp.json << EOF
{
  "mcpServers": {
    "instantly-zod-local": {
      "command": "node",
      "args": ["./dist/index.js", "--api-key", "$API_KEY"],
      "cwd": ".",
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
EOF

print_success "Local MCP configuration created at .cursor/mcp.json"

# Step 4: Test the server can start
print_status "Testing server startup..."
timeout 10s node ./dist/index.js --api-key "$API_KEY" > /dev/null 2>&1 &
SERVER_PID=$!
sleep 2

if kill -0 $SERVER_PID 2>/dev/null; then
    print_success "Server starts successfully"
    kill $SERVER_PID 2>/dev/null || true
else
    print_error "Server failed to start. Check your API key and build."
    exit 1
fi

# Step 5: Create testing guide
cat > .cursor/LOCAL-TESTING-GUIDE.md << 'EOF'
# 🎯 LOCAL Cursor IDE Testing Guide

## ✅ Setup Complete!

Your Cursor IDE is now configured to test the Zod integration using the LOCAL build in `./dist/index.js`.

## 🔄 How This Works

- **Local Build**: Uses `./dist/index.js` (your built code with Zod integration)
- **Project MCP**: Only active in this project, not globally
- **Safe Testing**: No impact on other projects or global MCP installations

## 🧪 Test Commands

### 1. ✅ Valid Operations (Should Work Normally)

**List Accounts:**
```
List all my Instantly accounts
```

**Valid Campaign Creation:**
```
Create a campaign named "Zod Test Campaign" with subject "Hello {{firstName}}" and body "Hi {{firstName}},

This is a test of our new Zod validation system.

Best regards,
The Team" for email test@example.com
```

**Valid Email Verification:**
```
Verify email address test@example.com
```

### 2. ❌ Invalid Operations (Should Show CLEAR Zod Error Messages)

**Invalid Email Format:**
```
Verify email address invalid-email-format
```
*Expected: Clear error about invalid email format*

**Invalid Timezone:**
```
Create a campaign named "Test" with subject "Test" and body "Test message" for email test@example.com with timezone "Invalid/Timezone"
```
*Expected: Clear error listing valid timezones*

**Too Many Emails:**
```
Get warmup analytics for emails: test1@example.com, test2@example.com, [... continue with 99+ emails]
```
*Expected: Clear error about email limit (max 100)*

**Invalid Time Format:**
```
Create a campaign with timing from "25:00" to "17:00"
```
*Expected: Clear error about time format (must be HH:MM)*

**Empty Required Fields:**
```
Create a campaign with empty name
```
*Expected: Clear error about required fields*

## 🎯 What to Look For

### ✅ SUCCESS Indicators:
- Valid commands work exactly as before
- Invalid commands show **specific, clear error messages**
- Error messages mention the **exact validation issue**
- Error messages include **examples of correct format**
- No "undefined" errors or crashes
- Consistent behavior across all commands

### ❌ FAILURE Indicators:
- Runtime crashes or "undefined" errors
- Generic "validation failed" messages without specifics
- Valid commands that don't work
- Inconsistent error handling
- Server crashes or hangs

## 📊 Expected Improvements

**Before Zod (Old Behavior):**
- Generic error: "Invalid email address in email_list: invalid-email"
- Basic error: "Invalid timezone: Invalid/Timezone"

**After Zod (New Behavior):**
- Specific error: "verify_email validation failed: Invalid email format. Must be a valid email address (e.g., user@domain.com)"
- Detailed error: "create_campaign validation failed: Invalid timezone: Invalid/Timezone. Must be one of the supported Instantly API timezones."

## 🔄 Rebuilding After Changes

If you make changes to the code:

```bash
# Rebuild
npm run build

# Restart Cursor IDE to reload the MCP server
# Or use Cmd+Shift+P -> "Reload Window"
```

## 🚨 Rollback if Issues

If you encounter problems:

1. **Switch back to stable version:**
   ```bash
   git checkout main
   npm run build
   # Restart Cursor IDE
   ```

2. **Or disable MCP temporarily:**
   - Rename `.cursor/mcp.json` to `.cursor/mcp.json.disabled`
   - Restart Cursor IDE

## 📋 Testing Checklist

- [ ] Server starts without errors
- [ ] Valid email verification works
- [ ] Invalid email shows clear Zod error message
- [ ] Valid campaign creation works
- [ ] Invalid timezone shows clear error with valid options
- [ ] Invalid time format shows clear error with format example
- [ ] Array limits are enforced with clear messages
- [ ] Required field validation works with specific errors
- [ ] No runtime crashes or undefined errors
- [ ] Error messages are actionable and helpful

## 🎉 Success Criteria

If all the above tests pass with clear, specific error messages, then the Zod integration is working correctly and should resolve the compatibility issues in Cursor IDE and n8n!

Happy testing! 🚀
EOF

print_success "Testing guide created at .cursor/LOCAL-TESTING-GUIDE.md"

# Step 6: Create quick validation test
cat > scripts/quick-zod-test.js << 'EOF'
#!/usr/bin/env node
/**
 * Quick test to verify Zod validation is working in the built server
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Quick Zod validation test for LOCAL build...');

const serverPath = path.join(__dirname, '..', 'dist', 'index.js');
const apiKey = process.argv[2] || 'test-key';

if (!require('fs').existsSync(serverPath)) {
  console.error('❌ dist/index.js not found. Run: npm run build');
  process.exit(1);
}

console.log('📍 Testing server:', serverPath);
console.log('🔑 Using API key:', apiKey.substring(0, 8) + '...');

const server = spawn('node', [serverPath, '--api-key', apiKey], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let hasOutput = false;

server.stdout.on('data', (data) => {
  hasOutput = true;
  console.log('📤 Server output:', data.toString().trim());
});

server.stderr.on('data', (data) => {
  hasOutput = true;
  const message = data.toString().trim();
  console.log('📋 Server log:', message);
  
  if (message.includes('Instantly MCP server running')) {
    console.log('✅ Server started successfully!');
    
    // Test validation
    setTimeout(() => {
      console.log('📤 Testing Zod validation...');
      
      const testRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'verify_email',
          arguments: { email: 'invalid-email-format' }
        }
      };
      
      server.stdin.write(JSON.stringify(testRequest) + '\n');
      
      setTimeout(() => {
        server.kill();
        console.log('✅ Test completed - check output above for Zod validation errors');
      }, 3000);
    }, 1000);
  }
});

server.on('close', (code) => {
  if (!hasOutput) {
    console.error('❌ No output from server. Check your API key and build.');
  }
  console.log(`🔚 Server exited with code: ${code}`);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error.message);
});

// Timeout
setTimeout(() => {
  if (!hasOutput) {
    server.kill();
    console.error('❌ Server startup timeout. Check your configuration.');
  }
}, 10000);
EOF

chmod +x scripts/quick-zod-test.js
print_success "Quick test script created: scripts/quick-zod-test.js"

# Final instructions
echo
print_success "🎉 LOCAL Cursor testing setup complete!"
echo
echo "📋 Next steps:"
echo "1. 🔄 Restart Cursor IDE to load the new MCP configuration"
echo "2. 🧪 Test with commands from .cursor/LOCAL-TESTING-GUIDE.md"
echo "3. 📊 Look for improved error messages with specific validation details"
echo "4. ✅ Confirm valid operations still work normally"
echo
echo "🧪 Quick test (optional):"
echo "   node scripts/quick-zod-test.js $API_KEY"
echo
print_warning "🔒 Remember: This configuration is local to this project only"
print_status "🎯 Ready for LOCAL Zod integration testing!"
