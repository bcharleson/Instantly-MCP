#!/bin/bash

# Digital Ocean Deployment Script for Instantly MCP Server
# This script deploys the MCP server to Digital Ocean App Platform

set -e

echo "🚀 Deploying Instantly MCP Server to Digital Ocean..."

# Check if doctl is installed
if ! command -v doctl &> /dev/null; then
    echo "❌ doctl CLI is not installed. Please install it first:"
    echo "   https://docs.digitalocean.com/reference/doctl/how-to/install/"
    exit 1
fi

# Check if user is authenticated
if ! doctl auth list &> /dev/null; then
    echo "❌ Not authenticated with Digital Ocean. Please run:"
    echo "   doctl auth init"
    exit 1
fi

# Verify we're on the correct branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "streamable-http-overhaul" ]; then
    echo "❌ Not on streamable-http-overhaul branch. Current branch: $CURRENT_BRANCH"
    echo "   Please switch to the correct branch:"
    echo "   git checkout streamable-http-overhaul"
    exit 1
fi

# Check if there are uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  You have uncommitted changes. Please commit or stash them first."
    echo "   git add . && git commit -m 'Deploy to Digital Ocean'"
    exit 1
fi

# Build the project locally to verify it works
echo "🔨 Building project locally..."
npm ci
npm run build

# Test the build
echo "🧪 Testing the build..."
timeout 10s npm run start:http &
BUILD_PID=$!
sleep 5

# Check if the server is responding
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Local build test passed"
else
    echo "❌ Local build test failed"
    kill $BUILD_PID 2>/dev/null || true
    exit 1
fi

kill $BUILD_PID 2>/dev/null || true

# Push the latest changes to GitHub
echo "📤 Pushing to GitHub..."
git push origin streamable-http-overhaul

# Deploy to Digital Ocean using the app spec
echo "🌊 Deploying to Digital Ocean App Platform..."

# Check if app already exists
APP_NAME="instantly-mcp-server"
if doctl apps list --format Name --no-header | grep -q "^${APP_NAME}$"; then
    echo "📱 Updating existing app: $APP_NAME"
    APP_ID=$(doctl apps list --format ID,Name --no-header | grep "$APP_NAME" | awk '{print $1}')
    doctl apps update $APP_ID --spec .do/app.yaml
else
    echo "📱 Creating new app: $APP_NAME"
    doctl apps create --spec .do/app.yaml
fi

echo "✅ Deployment initiated!"
echo ""
echo "📋 Next steps:"
echo "1. Monitor deployment: doctl apps list"
echo "2. Check logs: doctl apps logs <app-id> --follow"
echo "3. View app details: doctl apps get <app-id>"
echo ""
echo "🌐 Once deployed, your MCP server will be available at:"
echo "   Header auth: https://mcp.instantly.ai/mcp"
echo "   URL auth: https://mcp.instantly.ai/mcp/{API_KEY}"
echo ""
echo "🔍 Health check: https://mcp.instantly.ai/health"
echo "📊 Server info: https://mcp.instantly.ai/info"
