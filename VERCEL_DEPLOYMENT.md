# Vercel Deployment Guide - Pure Golf

> **✅ Deployment Fixed**: Latest commits include proper Vercel adapter configuration for seamless deployment.

## 🚀 Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/lojak57/PureSwingTracker)

## 📋 Required Environment Variables

Add these environment variables in your Vercel project dashboard:

### **Supabase Configuration**
```bash
PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

### **Cloudflare R2 Storage**
```bash
R2_ACCESS_KEY=your-r2-access-key
R2_SECRET_KEY=your-r2-secret-key
R2_BUCKET_NAME=pure-golf-videos
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
CLOUDFLARE_API_TOKEN=B6mvKva1Ih9CF5ia2-PYwQ7iU2P3M8l00tFlDzxu
R2_CUSTOM_DOMAIN=cdn.varro-golf.com
```

### **AI Integration**
```bash
OPENAI_API_KEY=sk-your-openai-api-key
```

### **Golf Course Data**
```bash
GOLF_COURSE_API_KEY=your-rapidapi-golf-course-key
```

### **Security**
```bash
JWT_SECRET=your-super-secret-jwt-key-generate-random-string
```

## 🔧 Deployment Steps

### 1. **Fork & Clone Repository**
```bash
git clone https://github.com/your-username/pure-golf.git
cd pure-golf
```

### 2. **Install Vercel CLI** (optional)
```bash
npm i -g vercel
```

### 3. **Deploy to Vercel**

**Option A: Via Vercel Dashboard**
1. Go to [vercel.com](https://vercel.com)
2. Import your repository
3. Add environment variables
4. Deploy

**Option B: Via CLI**
```bash
vercel
# Follow prompts to link project
# Add environment variables via dashboard
vercel --prod
```

### 4. **Configure Custom Domain** (Optional)
1. In Vercel dashboard → Project → Settings → Domains
2. Add your custom domain (e.g., `varro-golf.com`)
3. Configure DNS according to Vercel instructions

## 🔍 Post-Deployment Verification

### Health Check Endpoint
After deployment, verify system health:
```
https://your-app.vercel.app/api/health/video-processing
```

Expected response:
```json
{
  "status": "healthy",
  "health_checks": {
    "database": { "status": "healthy" },
    "cloudflare_api": { "healthy": true },
    "quota_guard": { "status": "healthy" }
  }
}
```

### Test Core Functionality
1. **Authentication**: Sign up/login works
2. **Dashboard**: User can access dashboard
3. **Video Upload**: Presigned URLs generate correctly
4. **AI Chat**: OpenAI integration responds
5. **Course Search**: GPS and search functionality

## 📈 Production Optimizations

### **Performance Settings**
- **Regions**: Configured for `iad1` (US East)
- **Adapter**: Official Vercel adapter with Node.js 18.x runtime
- **Framework**: SvelteKit optimizations enabled
- **Auto-scaling**: Serverless functions scale automatically

### **Monitoring**
- Use Vercel Analytics for performance tracking
- Monitor function execution times
- Set up error alerting for API failures

### **Security Considerations**
- All environment variables are server-side only
- JWT secrets are properly secured
- RLS policies enforce data access control

## 🔧 Troubleshooting

### **Common Issues**

**Build Failures:**
- Ensure all environment variables are set
- Check TypeScript compilation errors
- Verify Node.js version compatibility

**API Timeouts:**
- Increase function timeout in vercel.json
- Optimize database queries
- Check external service response times

**R2 Storage Issues:**
- Verify R2 credentials and bucket permissions
- Ensure custom domain is properly configured
- Check CORS settings in Cloudflare dashboard

**Environment Variable Issues:**
- Double-check all variable names match exactly
- Ensure no trailing spaces or hidden characters
- Verify sensitive values are not exposed client-side

## 📞 Support

For deployment issues:
1. Check the [comprehensive app report](./PURE_GOLF_APP_COMPREHENSIVE_REPORT.md)
2. Review [setup documentation](./SETUP.md)
3. Verify all external services are configured correctly

## 🎯 Production Checklist

- [ ] All environment variables configured
- [ ] Supabase database schema deployed
- [ ] R2 bucket created and configured
- [ ] Custom domain DNS configured (if using)
- [ ] OpenAI API key has sufficient credits
- [ ] Health check endpoint returns "healthy"
- [ ] Authentication flow tested
- [ ] Video upload tested
- [ ] AI chat responses working

---

*This deployment guide ensures your Pure Golf application is production-ready on Vercel with all necessary configurations.* 