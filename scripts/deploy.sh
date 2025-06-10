#!/bin/bash
set -e

# Parse command line arguments
ENV_ONLY=false
if [[ "$1" == "--env-only" ]]; then
    ENV_ONLY=true
fi

echo "🚀 Pure Golf Deployment Script"
echo "================================"

# Check if .env.local exists
if [[ ! -f ".env.local" ]]; then
    echo "❌ .env.local file not found!"
    echo "Please create .env.local with your environment variables"
    exit 1
fi

# Check if vercel CLI is available (try local first, then global)
VERCEL_CMD=""
if [[ -f "node_modules/.bin/vercel" ]]; then
    VERCEL_CMD="node_modules/.bin/vercel"
elif command -v vercel &> /dev/null; then
    VERCEL_CMD="vercel"
else
    echo "❌ Vercel CLI not found!"
    echo "Run: npm install (to install local vercel CLI)"
    echo "Or install globally with: npm i -g vercel"
    exit 1
fi

# Check if vercel is linked to a project
if [[ ! -f ".vercel/project.json" ]]; then
    echo "⚠️  Project not linked to Vercel yet"
    echo "Run: npm run deploy:setup (this will link the project first)"
    exit 1
fi

echo "📋 Reading environment variables from .env.local..."

# Function to set environment variable
set_env_var() {
    local key="$1"
    local value="$2"
    
    echo "🔑 Setting $key..."
    
    # Try to add to production, suppress error if exists
    if $VERCEL_CMD env add "$key" production <<< "$value" >/dev/null 2>&1; then
        echo "   ✅ Added to production"
    else
        echo "   ℹ️  Already exists in production"
    fi
    
    # Try to add to preview, suppress error if exists
    if $VERCEL_CMD env add "$key" preview <<< "$value" >/dev/null 2>&1; then
        echo "   ✅ Added to preview"
    else
        echo "   ℹ️  Already exists in preview"
    fi
}

# Read .env.local and push each variable to Vercel
while IFS='=' read -r key value; do
    # Skip empty lines and comments
    [[ -z "$key" || "$key" =~ ^#.*$ ]] && continue
    
    # Remove quotes from value if present
    value=$(echo "$value" | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\(.*\)'$/\1/")
    
    set_env_var "$key" "$value"
    
done < .env.local

echo ""
echo "✅ Environment variables synced!"

if [[ "$ENV_ONLY" == true ]]; then
    echo "🛑 Environment variables only mode - skipping deployment"
    echo "Run 'npm run deploy' to deploy with these variables"
    exit 0
fi

echo ""
echo "🏗️  Building and deploying to Vercel..."

# Deploy to Vercel
$VERCEL_CMD deploy --prod

echo ""
echo "🎉 Deployment complete!"
echo "Your app should be live at your Vercel domain"
echo ""
echo "💡 Tip: Use 'npm run deploy' for future deployments" 