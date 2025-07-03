#!/bin/bash

# Create minimal DXT package for Instantly MCP Server
set -e

echo "📦 Creating minimal DXT package..."

# Build the TypeScript
echo "Building TypeScript..."
npm run build

# Create temp directory
rm -rf dxt-minimal
mkdir -p dxt-minimal

# Copy only essential files
cp manifest.json dxt-minimal/
cp -r dist dxt-minimal/

# Create a minimal package.json
cat > dxt-minimal/package.json << 'EOF'
{
  "name": "instantly-mcp",
  "version": "1.0.7-beta.2",
  "type": "module",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.13.3",
    "zod": "^3.22.4"
  }
}
EOF

# Install only production dependencies
cd dxt-minimal
npm install --production --no-optional
cd ..

# Update manifest to use correct version
VERSION="1.0.7-beta.2"
DXT_FILENAME="instantly-mcp-${VERSION}.dxt"

# Create the DXT
cd dxt-minimal
zip -r "../$DXT_FILENAME" . -q
cd ..

# Cleanup
rm -rf dxt-minimal

echo "✅ Created $DXT_FILENAME"
ls -lh "$DXT_FILENAME"