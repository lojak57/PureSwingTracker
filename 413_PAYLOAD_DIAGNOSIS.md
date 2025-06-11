# 🚨 413 Payload Too Large - Diagnostic Report

## Current Situation

You're experiencing a **413 Payload Too Large** error when uploading videos, and your app shows "Failed to parse server response" to be polite about it.

## 🔍 Root Cause Analysis

### 1. **Are you using signed URLs for direct upload to R2?**

**Answer: PARTIALLY YES, but with a feature flag override**

Based on the code analysis:

- **Current Feature Flag Setting**: `useBackendUpload: false` (line 22 in `src/lib/feature-flags.ts`)
- **This means**: You should be using presigned URLs for direct R2 upload
- **But the upload is still hitting a 413 error**, which suggests the request is going through your backend

### 2. **Upload Flow Analysis**

```typescript
// From src/services/swing.ts line 290
static async uploadSession(session: SwingSession, mode: 'training' | 'quick' = 'training') {
  // Feature flag check
  if (featureFlags.useBackendUpload) {
    console.log('🚀 Using backend upload proxy');
    return this.uploadSessionBackend(session, mode);
  }

  // Should be using this path (presigned URLs)
  console.log('📋 Using presigned URL upload');
  const urlResponse = await this.getPresignedUrls(session.category);
  // Direct upload to R2 via presigned URLs
}
```

### 3. **The Problem**

Even though `useBackendUpload: false`, your **413 error suggests** the request is still going through your Vercel backend at `/api/upload`. This could happen if:

1. **Frontend is incorrectly calling the backend endpoint**
2. **Feature flag isn't being read properly**
3. **There's a fallback mechanism routing through backend**

## 📋 Current Upload Endpoints

### Backend Upload Proxy (Should be DISABLED)
```typescript
// /api/upload - Vercel serverless function
// File: src/routes/api/upload/+server.ts
// Limitation: Vercel has ~4.5MB body size limit
// Your 413 error is likely coming from here
```

### Presigned URL Generation (Should be ACTIVE)
```typescript
// /api/swing/presign - Generates R2 presigned URLs
// File: src/routes/api/swing/presign/+server.ts
// This creates URLs for direct browser → R2 upload
```

## 🚨 Immediate Diagnosis Questions

### Q1: What's the actual failed request path?

Check your browser Network tab - is the failing request going to:
- ❌ `/api/upload` (This would cause 413 - backend proxy)
- ✅ `https://[account].r2.cloudflarestorage.com/[bucket]/...` (Direct R2 - should work)

### Q2: Feature Flag Status

Check in your browser console:
```javascript
// In browser dev tools
localStorage.getItem('ff_backend_upload')
// Should return 'false' or null
```

### Q3: Upload Method Being Used

```typescript
// From src/services/swing.ts
// Check which log appears in browser console:
console.log('🚀 Using backend upload proxy');     // ❌ BAD - causes 413
console.log('📋 Using presigned URL upload');      // ✅ GOOD - direct R2
```

## 🛠️ Recommended Fix

### Option 1: Verify Presigned URL Flow (Recommended)

1. **Check the actual request URL in Network tab**
2. **Ensure feature flag is properly disabled**:

```typescript
// In src/lib/feature-flags.ts (line 22)
export const getFeatureFlags = (): FeatureFlags => {
  return {
    useBackendUpload: false,  // ✅ Confirmed disabled
    enableQuotaEnforcement: true,
    enableAdvancedAnalytics: false,
  };
};
```

3. **Verify the upload service routing**:

```typescript
// From src/services/swing.ts line 290
// This should take the ELSE branch (presigned URLs)
if (featureFlags.useBackendUpload) {
  // ❌ Should NOT execute this
  return this.uploadSessionBackend(session, mode);
}
// ✅ Should execute this path
console.log('📋 Using presigned URL upload');
```

### Option 2: If You Must Use Backend Upload

If for some reason you need the backend proxy (not recommended for large files):

```typescript
// In vercel.json
{
  "functions": {
    "src/routes/api/upload/+server.ts": {
      "maxDuration": 30
    }
  },
  "limits": {
    "duration": 30000
  }
}
```

But **Vercel has hard limits** that can't be overridden:
- **Body size limit**: ~4.5MB for serverless functions
- **Your videos are likely larger than this**

## 📊 Code Evidence Summary

| Component | Status | Evidence |
|-----------|--------|----------|
| **Feature Flag** | ✅ Disabled | `useBackendUpload: false` |
| **Presigned URLs** | ✅ Available | `/api/swing/presign` endpoint exists |
| **Direct R2 Upload** | ✅ Implemented | `uploadVideo()` method with XHR PUT |
| **Backend Proxy** | ❌ Should be unused | `/api/upload` exists but flagged off |

## 🎯 Next Steps

1. **Check browser Network tab** - confirm which endpoint is actually being called
2. **Look for console logs** - see which upload method is being used
3. **Verify feature flag** - ensure `useBackendUpload: false` is active
4. **Test direct R2 upload** - presigned URLs should bypass the 413 entirely

## 💡 Expected Working Flow

```
Browser → GET /api/swing/presign → Receive presigned R2 URLs
Browser → PUT directly to R2 URLs → Success (no 413 possible)
Browser → POST /api/swing/submit → Record successful upload
```

The 413 error should be **impossible** with proper presigned URL flow since the video never touches your Vercel backend. 