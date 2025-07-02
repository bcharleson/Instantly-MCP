#!/bin/bash

# 📦 Create DXT Package for Instantly MCP Server
# This script creates a .dxt file (zip archive) for one-click installation in Claude Desktop

set -e

echo "📦 Creating DXT package for Instantly MCP Server..."

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

# Step 2: Verify required files exist
print_status "Verifying required files..."
required_files=("manifest.json" "dist/index.js" "package.json")
for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        print_error "Required file missing: $file"
        exit 1
    fi
done
print_success "All required files present"

# Step 3: Create temporary directory for DXT contents
DXT_DIR="dxt-build"
print_status "Creating DXT build directory..."
rm -rf "$DXT_DIR"
mkdir -p "$DXT_DIR"

# Step 4: Copy required files to DXT directory
print_status "Copying files to DXT directory..."

# Copy manifest.json (required)
cp manifest.json "$DXT_DIR/"

# Copy built server files
cp -r dist "$DXT_DIR/"

# Copy package.json and package-lock.json for dependency info
cp package.json "$DXT_DIR/"
if [ -f "package-lock.json" ]; then
    cp package-lock.json "$DXT_DIR/"
fi

# Copy node_modules (required for Node.js DXT)
if [ -d "node_modules" ]; then
    print_status "Copying node_modules (this may take a moment)..."
    cp -r node_modules "$DXT_DIR/"
else
    print_warning "node_modules not found. Installing dependencies..."
    npm install
    cp -r node_modules "$DXT_DIR/"
fi

# Copy README and LICENSE if they exist
if [ -f "README.md" ]; then
    cp README.md "$DXT_DIR/"
fi
if [ -f "LICENSE" ]; then
    cp LICENSE "$DXT_DIR/"
fi

print_success "Files copied to DXT directory"

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
    
    # Show contents
    print_status "DXT package contents:"
    unzip -l "$DXT_FILENAME" | head -20
    if [ $(unzip -l "$DXT_FILENAME" | wc -l) -gt 25 ]; then
        echo "... (truncated, showing first 20 entries)"
    fi
else
    print_error "Failed to create DXT package"
    exit 1
fi

# Step 7: Clean up
print_status "Cleaning up build directory..."
rm -rf "$DXT_DIR"

# Step 8: Final instructions
echo
print_success "🎉 DXT package created successfully!"
echo
echo "📋 Installation Instructions:"
echo "1. 📁 Double-click $DXT_FILENAME to install in Claude Desktop"
echo "2. 🔑 Enter your Instantly API key when prompted"
echo "3. ✅ The MCP server will be automatically configured"
echo
echo "📊 Package Details:"
echo "   📦 File: $DXT_FILENAME"
echo "   📏 Size: $file_size"
echo "   🔧 Type: Node.js MCP Server"
echo "   🎯 Compatibility: Claude Desktop, macOS/Windows/Linux"
echo
echo "🧪 Testing:"
echo "   - Install the DXT in Claude Desktop"
echo "   - Test with: 'List all my Instantly accounts'"
echo "   - Test validation: 'Verify email address invalid-email'"
echo
print_warning "🔒 Security Note: Your API key will be stored securely by Claude Desktop"
print_status "🚀 Ready for one-click installation and testing!"
