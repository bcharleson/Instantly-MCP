#!/bin/bash

# Bundle the MCP server for DXT using esbuild
set -e

echo "📦 Bundling Instantly MCP Server for DXT..."

# Install esbuild if not present
if ! command -v esbuild &> /dev/null; then
    echo "Installing esbuild..."
    npm install --save-dev esbuild
fi

# Clean previous builds
rm -rf dist-bundled
mkdir -p dist-bundled

# Bundle with esbuild
echo "Bundling with esbuild..."
npx esbuild src/index.ts \
  --bundle \
  --platform=node \
  --target=node16 \
  --outfile=dist-bundled/index.js \
  --external:@modelcontextprotocol/sdk \
  --external:zod \
  --format=cjs \
  --minify=false

# Copy manifest
cp manifest.json dist-bundled/

# Create minimal package.json for bundled version
cat > dist-bundled/package.json << 'EOF'
{
  "name": "instantly-mcp",
  "version": "1.0.7-beta.2",
  "type": "commonjs",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.13.3",
    "zod": "^3.22.4"
  }
}
EOF

# Install only production dependencies in bundled directory
echo "Installing production dependencies..."
cd dist-bundled
npm install --production
cd ..

echo "✅ Bundling complete!"