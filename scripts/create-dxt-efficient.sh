#!/bin/bash

# 📦 Create Efficient DXT Package for Instantly MCP Server
# This script creates a .dxt file with only essential dependencies

set -e

echo "📦 Creating efficient DXT package for Instantly MCP Server..."

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

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "manifest.json" ]; then
    print_error "Must be run from the project root directory"
    exit 1
fi

# Step 1: Build the project
print_status "Building project..."
if npm run build; then
    print_success "Build completed successfully"
else
    print_error "Build failed. Please fix compilation errors."
    exit 1
fi

# Step 2: Create temporary directory for DXT contents
DXT_DIR="dxt-build"
print_status "Creating DXT build directory..."
rm -rf "$DXT_DIR"
mkdir -p "$DXT_DIR"

# Step 3: Copy essential files
print_status "Copying essential files..."

# Copy manifest.json (required)
cp manifest.json "$DXT_DIR/"

# Copy built server files
cp -r dist "$DXT_DIR/"

# Copy package.json for dependency info
cp package.json "$DXT_DIR/"

# Copy README and LICENSE if they exist
if [ -f "README.md" ]; then
    cp README.md "$DXT_DIR/"
fi
if [ -f "LICENSE" ]; then
    cp LICENSE "$DXT_DIR/"
fi

# Step 4: Install only production dependencies in DXT directory
print_status "Installing production dependencies..."
cd "$DXT_DIR"

# Install only production dependencies (no dev dependencies)
npm install --production --no-optional --no-audit --no-fund --silent

cd ..

print_success "Essential files and dependencies copied"

# Step 5: Create the DXT package (zip file)
DXT_FILENAME="instantly-mcp-$(grep '"version"' package.json | cut -d'"' -f4).dxt"
print_status "Creating DXT package: $DXT_FILENAME"

# Remove existing DXT file if it exists
if [ -f "$DXT_FILENAME" ]; then
    rm "$DXT_FILENAME"
fi

# Create the zip file
cd "$DXT_DIR"
zip -r "../$DXT_FILENAME" . -q
cd ..

# Step 6: Verify the DXT package
print_status "Verifying DXT package..."
if [ -f "$DXT_FILENAME" ]; then
    file_size=$(ls -lh "$DXT_FILENAME" | awk '{print $5}')
    print_success "DXT package created: $DXT_FILENAME ($file_size)"
    
    # Show key contents
    print_status "DXT package structure:"
    unzip -l "$DXT_FILENAME" | grep -E "(manifest\.json|dist/|node_modules/@modelcontextprotocol|package\.json)" | head -10
else
    print_error "Failed to create DXT package"
    exit 1
fi

# Step 7: Clean up
print_status "Cleaning up build directory..."
rm -rf "$DXT_DIR"

# Step 8: Test the manifest
print_status "Validating manifest.json..."
if command -v jq >/dev/null 2>&1; then
    if jq empty manifest.json >/dev/null 2>&1; then
        print_success "Manifest JSON is valid"
    else
        print_warning "Manifest JSON may have syntax issues"
    fi
else
    print_warning "jq not available - skipping JSON validation"
fi

# Step 9: Final instructions
echo
print_success "🎉 Efficient DXT package created successfully!"
echo
echo "📋 Installation Instructions:"
echo "1. 📁 Double-click $DXT_FILENAME to install in Claude Desktop"
echo "2. 🔑 Enter your Instantly API key when prompted"
echo "3. ✅ The MCP server will be automatically configured"
echo
echo "📊 Package Details:"
echo "   📦 File: $DXT_FILENAME"
echo "   📏 Size: $file_size"
echo "   🔧 Type: Node.js MCP Server with Zod validation"
echo "   🎯 Compatibility: Claude Desktop (macOS/Windows/Linux)"
echo
echo "🧪 Testing Commands (after installation):"
echo "   ✅ Valid: 'List all my Instantly accounts'"
echo "   ❌ Invalid: 'Verify email address invalid-email-format'"
echo "   🎯 Expected: Clear, specific Zod validation error messages"
echo
echo "🔍 What to Look For:"
echo "   - Specific error messages instead of generic 'validation failed'"
echo "   - Error messages with examples of correct format"
echo "   - No runtime crashes or undefined errors"
echo
print_warning "🔒 Security: Your API key will be stored securely by Claude Desktop"
print_status "🚀 Ready for one-click installation and Zod validation testing!"
