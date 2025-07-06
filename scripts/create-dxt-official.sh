#!/bin/bash

# Create DXT package following official DXT structure
set -e

echo "📦 Creating DXT package following official structure..."

# Build the TypeScript
echo "Building TypeScript..."
npm run build

# Create temp directory with proper structure
rm -rf dxt-official
mkdir -p dxt-official/server

# Copy manifest (update entry point to server/index.js)
cp manifest.json dxt-official/

# Update manifest to use server/index.js
sed -i '' 's|"entry_point": "dist/index.js"|"entry_point": "server/index.js"|' dxt-official/manifest.json
sed -i '' 's|"args": \["dist/index.js"|"args": ["server/index.js"|' dxt-official/manifest.json

# Copy all dist files to server directory
cp -r dist/* dxt-official/server/

# Copy package.json to root
cp package.json dxt-official/

# Install production dependencies
cd dxt-official
npm install --production --no-optional
cd ..

# Create the DXT
VERSION="1.0.7-beta.3"
DXT_FILENAME="instantly-mcp-${VERSION}.dxt"

cd dxt-official
zip -r "../$DXT_FILENAME" . -q
cd ..

# Cleanup
rm -rf dxt-official

echo "✅ Created $DXT_FILENAME with official DXT structure"
ls -lh "$DXT_FILENAME"
echo ""
echo "📁 Package structure:"
echo "   extension.dxt"
echo "   ├── manifest.json"
echo "   ├── server/"
echo "   │   └── [compiled JS files]"
echo "   ├── node_modules/"
echo "   └── package.json"