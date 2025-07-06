#!/bin/bash

# Create clean DXT package following official structure
set -e

echo "📦 Creating clean DXT package..."

# Build the TypeScript
echo "Building TypeScript..."
npm run build

# Create temp directory with proper structure
rm -rf dxt-clean
mkdir -p dxt-clean/server

# Create a clean manifest for DXT
cat > dxt-clean/manifest.json << 'EOF'
{
  "dxt_version": "0.1",
  "name": "instantly-mcp",
  "display_name": "Instantly MCP Server",
  "version": "1.0.7-beta.3",
  "description": "MCP server for Instantly.ai v2 API",
  "author": {
    "name": "Brandon Charleson",
    "email": "170791+bcharleson@users.noreply.github.com"
  },
  "license": "MIT",
  "server": {
    "type": "node",
    "entry_point": "server/index.js",
    "mcp_config": {
      "command": "node",
      "args": ["server/index.js", "--api-key", "${user_config.api_key}"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  },
  "user_config": {
    "api_key": {
      "type": "string",
      "title": "Instantly API Key",
      "description": "Your Instantly.ai API key",
      "sensitive": true,
      "required": true
    }
  }
}
EOF

# Copy all dist files to server directory
cp -r dist/* dxt-clean/server/

# Create minimal package.json in root
cat > dxt-clean/package.json << 'EOF'
{
  "name": "instantly-mcp",
  "version": "1.0.7-beta.3",
  "type": "module",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.13.3",
    "zod": "^3.22.4"
  }
}
EOF

# Copy existing node_modules instead of reinstalling
if [ -d "node_modules" ]; then
    echo "Copying existing node_modules..."
    cp -r node_modules dxt-clean/
else
    echo "Warning: node_modules not found"
fi

# Create the DXT
VERSION="1.0.7-beta.3"
DXT_FILENAME="instantly-mcp-${VERSION}.dxt"

cd dxt-clean
zip -r "../$DXT_FILENAME" . -q
cd ..

# Cleanup
rm -rf dxt-clean

echo "✅ Created $DXT_FILENAME"
ls -lh "$DXT_FILENAME"