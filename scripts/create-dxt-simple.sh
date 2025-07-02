#!/bin/bash

# 📦 Create Simple DXT Package for Instantly MCP Server
# This script creates a .dxt file using existing dependencies

set -e

echo "📦 Creating DXT package for Instantly MCP Server..."

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
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
npm run build

# Step 2: Create temporary directory for DXT contents
DXT_DIR="dxt-build"
print_status "Creating DXT build directory..."
rm -rf "$DXT_DIR"
mkdir -p "$DXT_DIR"

# Step 3: Copy essential files
print_status "Copying files..."

# Copy manifest.json (required)
cp manifest.json "$DXT_DIR/"

# Copy built server files
cp -r dist "$DXT_DIR/"

# Copy package.json
cp package.json "$DXT_DIR/"

# Copy essential dependencies only
print_status "Copying essential dependencies..."
mkdir -p "$DXT_DIR/node_modules"

# Copy only the MCP SDK and Zod (the main dependencies we need)
if [ -d "node_modules/@modelcontextprotocol" ]; then
    cp -r node_modules/@modelcontextprotocol "$DXT_DIR/node_modules/"
fi

if [ -d "node_modules/zod" ]; then
    cp -r node_modules/zod "$DXT_DIR/node_modules/"
fi

# Copy any other essential runtime dependencies
essential_deps=("content-type" "raw-body")
for dep in "${essential_deps[@]}"; do
    if [ -d "node_modules/$dep" ]; then
        cp -r "node_modules/$dep" "$DXT_DIR/node_modules/"
    fi
done

# Copy README if it exists
if [ -f "README.md" ]; then
    cp README.md "$DXT_DIR/"
fi

print_success "Files copied"

# Step 4: Create the DXT package
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

# Step 5: Verify the DXT package
if [ -f "$DXT_FILENAME" ]; then
    file_size=$(ls -lh "$DXT_FILENAME" | awk '{print $5}')
    print_success "DXT package created: $DXT_FILENAME ($file_size)"
else
    print_error "Failed to create DXT package"
    exit 1
fi

# Step 6: Clean up
print_status "Cleaning up..."
rm -rf "$DXT_DIR"

# Step 7: Final instructions
echo
print_success "🎉 DXT package created successfully!"
echo
echo "📋 Installation Instructions:"
echo "1. 📁 Double-click $DXT_FILENAME to install in Claude Desktop"
echo "2. 🔑 Enter your Instantly API key when prompted"
echo "3. ✅ Test with: 'List all my Instantly accounts'"
echo "4. 🧪 Test validation: 'Verify email address invalid-email'"
echo
echo "📊 Package: $DXT_FILENAME ($file_size)"
echo "🎯 Features: Zod validation, type safety, improved error messages"
echo
print_success "🚀 Ready for one-click installation in Claude Desktop!"
