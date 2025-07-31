#!/bin/bash

# Instantly MCP Server - Staging Deployment Script
# Deploys to Railway for testing before instantly.ai integration

set -e

echo "🚀 INSTANTLY MCP SERVER - STAGING DEPLOYMENT"
echo "============================================="
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

# Check if user is logged in
if ! railway whoami &> /dev/null; then
    echo "🔐 Please login to Railway..."
    railway login
fi

# Check for API key
if [ -z "$INSTANTLY_API_KEY" ]; then
    echo "⚠️  INSTANTLY_API_KEY not set in environment"
    read -p "Enter your Instantly.ai API key: " INSTANTLY_API_KEY
    export INSTANTLY_API_KEY
fi

echo "📋 Pre-deployment checklist:"
echo "   ✅ Railway CLI installed"
echo "   ✅ User logged in"
echo "   ✅ API key provided"
echo ""

# Build the project
echo "🔨 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please fix errors and try again."
    exit 1
fi

echo "✅ Build successful"
echo ""

# Check if project exists
if ! railway status &> /dev/null; then
    echo "🆕 Creating new Railway project..."
    railway new instantly-mcp-staging --template blank
    railway link
fi

echo "⚙️  Setting environment variables..."
railway variables set NODE_ENV=production
railway variables set TRANSPORT_MODE=http
railway variables set INSTANTLY_API_KEY="$INSTANTLY_API_KEY"

echo "🚀 Deploying to Railway..."
railway up --detach

echo ""
echo "⏳ Waiting for deployment to complete..."
sleep 30

# Get the deployment URL
STAGING_URL=$(railway domain)

if [ -z "$STAGING_URL" ]; then
    echo "⚠️  Could not get deployment URL. Checking Railway dashboard..."
    railway open
    echo ""
    echo "Please get your staging URL from the Railway dashboard and run:"
    echo "STAGING_URL=https://your-app.railway.app node test-staging-environment.js"
else
    echo "✅ Deployment complete!"
    echo ""
    echo "🌐 Staging URL: https://$STAGING_URL"
    echo ""
    echo "🧪 Running automated tests..."
    export STAGING_URL="https://$STAGING_URL"
    node test-staging-environment.js
fi

echo ""
echo "📋 Next Steps:"
echo "1. ✅ Review test results above"
echo "2. 🔗 Test with MCP clients (Claude Desktop, Cursor)"
echo "3. 📄 Share staging URL with Instantly.ai team"
echo "4. 🚀 Ready for production deployment!"
echo ""
echo "📖 For detailed testing instructions, see STAGING-DEPLOYMENT.md"
