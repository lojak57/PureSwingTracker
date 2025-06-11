# Cloudflare Worker R2 Proxy - Deployment Guide

## Problem Solved
This Worker bypasses the **SSL handshake failure** between Vercel and R2 by using Cloudflare's native R2 bindings.

## Architecture
```
Browser → Vercel Backend → Cloudflare Worker → R2 Bucket
```

## Deployment Steps

### 1. Install Wrangler (if not installed)
```bash
npm install -g wrangler
```

### 2. Login to Cloudflare
```bash
wrangler login
```

### 3. Deploy the Worker
```bash
cd cloudflare-worker
wrangler deploy
```

### 4. Get Your Worker URL
After deployment, you'll get a URL like:
```
https://pure-golf-r2-proxy.your-account.workers.dev
```

### 5. Update Vercel Environment Variable
Add this to your Vercel environment variables:
```
WORKER_R2_PROXY_URL=https://pure-golf-r2-proxy.your-account.workers.dev
```

### 6. Update the Backend Code
In `src/routes/api/upload/+server.ts`, replace the hardcoded worker URL:
```typescript
// Change this line:
const workerUrl = 'https://pure-golf-r2-proxy.your-subdomain.workers.dev';

// To this:
const workerUrl = env.WORKER_R2_PROXY_URL;
```

### 7. Test Upload
The upload should now work without SSL handshake failures!

## How It Works
- **Vercel → Worker**: Standard HTTPS (always works)
- **Worker → R2**: Native binding (bypasses S3 API entirely)
- **No more SSL errors**: Problem completely eliminated

## Monitoring
Check Worker logs in Cloudflare dashboard:
- Go to Workers & Pages
- Click on your worker
- View "Real-time Logs" 