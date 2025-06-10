# Pure Golf - Automated Deployment Guide

This guide explains how to deploy Pure Golf to Vercel with automated environment variable management.

## Prerequisites

1. **Vercel CLI**: Install globally
   ```bash
   npm install -g vercel
   ```

2. **Environment Variables**: Ensure your `.env.local` file contains all required variables:
   ```bash
   # Database
   PUBLIC_SUPABASE_URL=your_supabase_url
   PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   
   # R2 Storage
   R2_ACCOUNT_ID=your_account_id
   R2_ACCESS_KEY_ID=your_access_key
   R2_SECRET_ACCESS_KEY=your_secret_key
   R2_BUCKET_NAME=your_bucket_name
   R2_CUSTOM_DOMAIN=your_custom_domain  # optional
   
   # Cloudflare API
   CLOUDFLARE_API_TOKEN=your_api_token
   
   # AI Services
   OPENAI_API_KEY=your_openai_key
   ANTHROPIC_API_KEY=your_anthropic_key
   ```

## Deployment Commands

### First-Time Setup
```bash
npm run deploy:setup
```
This will:
1. Link your project to Vercel (creates team/project)
2. Sync all environment variables from `.env.local`
3. Deploy to production

### Regular Deployments
```bash
npm run deploy
```
This will:
1. Sync any new/changed environment variables
2. Build and deploy to production

### Environment Variables Only
```bash
npm run deploy -- --env-only
```
This will:
1. Sync environment variables to Vercel
2. Skip the actual deployment

## How It Works

The deployment script (`scripts/deploy.sh`) automatically:

1. **Reads `.env.local`**: Parses your local environment file
2. **Syncs to Vercel**: Pushes each variable to both production and preview environments
3. **Handles Duplicates**: Safely skips variables that already exist
4. **Deploys**: Runs `vercel deploy --prod` to build and deploy

## Manual Environment Variables (Not Recommended)

If you prefer to set environment variables manually in the Vercel dashboard:

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add each variable for both Production and Preview environments

But the automated script is much faster and less error-prone!

## Troubleshooting

### "Project not linked to Vercel"
```bash
npm run deploy:setup
```

### "Vercel CLI not found"
```bash
npm install -g vercel
npm run deploy:setup
```

### Environment Variable Issues
- Check that `.env.local` exists and has valid `KEY=VALUE` format
- Ensure no spaces around the `=` sign
- Quote values with spaces: `KEY="value with spaces"`

### Build Failures
- Run `npm run build` locally first to check for issues
- Check Vercel function logs in the dashboard
- Ensure all dependencies are in `package.json` (not just devDependencies)

## Production URLs

Once deployed, your app will be available at:
- **Production**: `https://your-project.vercel.app`
- **Custom Domain**: Configure in Vercel dashboard → Settings → Domains

The deployment script will show you the final URL after successful deployment. 