#!/bin/bash

# 🧪 Local Testing Setup Script for Zod Integration
# This script sets up safe local testing of the Instantly MCP server with Zod validation

set -e  # Exit on any error

echo "🧪 Setting up local testing environment for Zod integration..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if we're on the feature branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "feature/zod-validation-integration" ]; then
    print_warning "Not on feature/zod-validation-integration branch. Current: $CURRENT_BRANCH"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Step 1: Create safety backup
print_status "Creating safety backup of main branch..."
git fetch origin
git checkout main
git tag -a "v1.0.6-stable-backup-$(date +%Y%m%d-%H%M%S)" -m "Stable backup before Zod integration testing"
git checkout "$CURRENT_BRANCH"
print_success "Safety backup created"

# Step 2: Build the project
print_status "Building project with Zod integration..."
npm run build
if [ $? -eq 0 ]; then
    print_success "Build completed successfully"
else
    print_error "Build failed. Please fix compilation errors before testing."
    exit 1
fi

# Step 3: Create .cursor directory (if it doesn't exist)
if [ ! -d ".cursor" ]; then
    print_status "Creating .cursor directory for local testing..."
    mkdir -p .cursor
    print_success ".cursor directory created"
else
    print_warning ".cursor directory already exists"
fi

# Step 4: Check if API key is provided
if [ -z "$INSTANTLY_API_KEY" ]; then
    print_warning "INSTANTLY_API_KEY environment variable not set"
    read -p "Enter your Instantly API key for testing: " -s API_KEY
    echo
    export INSTANTLY_API_KEY="$API_KEY"
fi

# Step 5: Create local MCP configuration for Cursor
print_status "Creating local MCP configuration..."
cat > .cursor/mcp.json << EOF
{
  "mcpServers": {
    "instantly-local-test": {
      "command": "npx",
      "args": ["instantly-mcp@alpha", "--api-key", "$INSTANTLY_API_KEY"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
EOF
print_success "Local MCP configuration created at .cursor/mcp.json"

# Step 6: Create testing instructions
print_status "Creating testing instructions..."
cat > .cursor/TESTING-INSTRUCTIONS.md << 'EOF'
# 🧪 Local Zod Integration Testing

## Testing Steps

### 1. Alpha Version Testing
```bash
# Publish alpha version
npm version prerelease --preid=alpha
npm publish --tag alpha

# Update .cursor/mcp.json to use the alpha version
# Test in Cursor IDE with this project
```

### 2. Test Commands to Try
- "List all my Instantly accounts"
- "Create a test campaign with invalid email to test validation"
- "Verify an invalid email address to test Zod validation"
- "Get warmup analytics with too many emails (should fail validation)"

### 3. Expected Behavior
- ✅ Valid inputs should work normally
- ✅ Invalid inputs should show clear, specific error messages
- ✅ Error messages should mention the specific validation issue
- ✅ No runtime crashes or undefined errors

### 4. Rollback if Issues Found
```bash
# Immediate rollback
npm dist-tag add instantly-mcp@1.0.6 latest

# Git rollback
git checkout main
```

## Testing Checklist
- [ ] Server starts without errors
- [ ] Tools are listed correctly
- [ ] Valid parameters work as expected
- [ ] Invalid parameters show clear error messages
- [ ] No runtime crashes or undefined errors
- [ ] Error messages are actionable and specific
EOF

print_success "Testing instructions created at .cursor/TESTING-INSTRUCTIONS.md"

# Step 7: Create quick test script
print_status "Creating quick validation test script..."
cat > scripts/test-zod-validation.js << 'EOF'
#!/usr/bin/env node
/**
 * Quick Zod validation test
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Quick Zod validation test...');

// Test the built server
const serverPath = path.join(__dirname, '..', 'dist', 'index.js');
const testApiKey = process.env.INSTANTLY_API_KEY || 'test-key';

console.log('📍 Testing server at:', serverPath);

// Start server and test basic functionality
const server = spawn('node', [serverPath, '--api-key', testApiKey], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
server.stdout.on('data', (data) => {
  output += data.toString();
  console.log('📤 Server output:', data.toString().trim());
});

server.stderr.on('data', (data) => {
  console.log('📋 Server log:', data.toString().trim());
});

// Send a test request after 2 seconds
setTimeout(() => {
  console.log('📤 Sending test validation request...');
  
  const testRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'verify_email',
      arguments: {
        email: 'invalid-email-format'  // Should trigger Zod validation
      }
    }
  };
  
  server.stdin.write(JSON.stringify(testRequest) + '\n');
  
  // Kill server after 5 seconds
  setTimeout(() => {
    server.kill();
    console.log('✅ Test completed');
  }, 5000);
}, 2000);

server.on('close', (code) => {
  console.log(`🔚 Server exited with code: ${code}`);
});
EOF

chmod +x scripts/test-zod-validation.js
print_success "Quick test script created at scripts/test-zod-validation.js"

# Step 8: Final instructions
echo
print_success "🎉 Local testing environment setup complete!"
echo
echo "📋 Next steps:"
echo "1. Publish alpha version: npm version prerelease --preid=alpha && npm publish --tag alpha"
echo "2. Test locally: node scripts/test-zod-validation.js"
echo "3. Test in Cursor: Use the .cursor/mcp.json configuration"
echo "4. Follow instructions in .cursor/TESTING-INSTRUCTIONS.md"
echo
print_warning "Remember: All testing configurations are in .gitignore and won't be committed"
echo
print_status "Ready for safe Zod integration testing! 🚀"
