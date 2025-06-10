# Backend Upload Proxy Implementation Plan

## Executive Summary

This document outlines the complete refactoring of the Pure Golf video upload system from direct browser-to-R2 uploads (using presigned URLs) to a backend proxy architecture. This change eliminates SSL handshake issues, CORS complexities, and provides a more secure, reliable, and scalable solution.

## Current State Analysis

### Problems with Direct Upload Approach
- **SSL/TLS Incompatibility**: `ERR_SSL_VERSION_OR_CIPHER_MISMATCH` across multiple networks
- **Presigned URL Limitations**: Cannot use custom domains due to signature validation
- **Security Exposure**: R2 credentials visible in network traffic
- **No Server-side Validation**: Files uploaded without backend oversight
- **Complex Error Handling**: Browser-dependent error reporting

### Target Architecture Benefits
- ✅ **Universal Compatibility**: No client-side SSL/CORS issues
- ✅ **Enhanced Security**: R2 credentials stay server-side
- ✅ **Robust Validation**: Server-side file type, size, and content checks
- ✅ **Better UX**: Consistent error handling and progress tracking
- ✅ **Observability**: Complete upload metrics and logging

## Architecture Overview

```
┌─────────────┐    ┌─────────────────┐    ┌─────────────┐
│   Browser   │───▶│  Vercel Edge    │───▶│ Cloudflare  │
│             │    │  Function       │    │     R2      │
│   Upload    │    │ /api/upload     │    │   Bucket    │
│   Form      │    │                 │    │             │
└─────────────┘    └─────────────────┘    └─────────────┘
      │                       │                    │
      │                       │                    │
      ▼                       ▼                    ▼
┌─────────────┐    ┌─────────────────┐    ┌─────────────┐
│ Progress    │    │ Authentication  │    │ File        │
│ Tracking    │    │ Validation      │    │ Storage     │
│ Error UI    │    │ Streaming       │    │ Success     │
└─────────────┘    └─────────────────┘    └─────────────┘
```

## Implementation Phases

### Phase 1: Backend Infrastructure (Days 1-2)

#### 1.1 Create Upload Endpoint
**File**: `src/routes/api/upload/+server.ts`

**Core Requirements**:
- Accept multipart/form-data with multiple video files
- Stream files directly to R2 (no local storage)
- Maintain existing key structure for compatibility
- Handle authentication via existing JWT middleware
- Return structured response with upload results

**Technical Specifications**:
```typescript
interface UploadRequest {
  files: Record<string, File>; // angle -> file mapping
  metadata: {
    category: string;
    mode: 'training' | 'quick';
    userId: string;
  }
}

interface UploadResponse {
  success: boolean;
  uploadSession: string;
  results: Record<string, {
    key: string;
    size: number;
    uploaded: boolean;
    error?: string;
  }>;
  errors?: string[];
}
```

#### 1.2 Streaming Implementation
**Strategy**: Use `@aws-sdk/lib-storage` Upload class for robust streaming

```typescript
// Using @aws-sdk/lib-storage for efficient multipart streaming
import { Upload } from "@aws-sdk/lib-storage";
import { S3Client } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// This handles multipart streaming efficiently with automatic error handling
const upload = new Upload({
  client: s3Client,
  params: {
    Bucket: R2_BUCKET_NAME,
    Key: generatedKey,
    Body: fileStreamFromRequest, // The stream from multipart form data
    ContentType: file.type,
  },
});

await upload.done();
```

**Dependencies**: Add `@aws-sdk/lib-storage` to package.json for robust multipart uploads

#### 1.3 Error Handling & Validation
**Pre-upload Validation**:
- File type whitelist: `['video/webm', 'video/mp4', 'video/quicktime']`
- File size limits: 200MB per file, 600MB total
- Required angles validation based on mode
- User authentication & quota checks

**Upload Error Recovery**:
- Retry logic with exponential backoff
- Partial upload cleanup on failure
- Detailed error logging with request IDs

#### 1.4 Security Implementation
**Authentication Flow**:
```typescript
// Extract and validate JWT from Authorization header
const token = request.headers.get('authorization')?.split(' ')[1];
const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
```

**Rate Limiting**:
- Per-user: 10 uploads per minute
- Global: 1000 uploads per minute
- **Must use Vercel KV** (serverless functions are stateless)

### Phase 2: Frontend Refactoring (Days 3-4)

#### 2.1 Remove Presigned URL Logic
**Files to Modify**:
- Remove `/api/swing/presign/+server.ts`
- Update upload components to use direct POST
- Remove presigned URL state management

#### 2.2 New Upload Implementation
**Component**: `src/components/ui/FileUploader.svelte`

**New Upload Flow**:
```typescript
async function uploadFiles(files: Record<string, File>, metadata: UploadMetadata) {
  const formData = new FormData();
  
  // Add metadata
  formData.append('category', metadata.category);
  formData.append('mode', metadata.mode);
  
  // Add files with angle prefixes
  Object.entries(files).forEach(([angle, file]) => {
    formData.append(`file_${angle}`, file);
  });

  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  return await response.json();
}
```

#### 2.3 Progress Tracking
**Implementation Strategy**:
- Use native `XMLHttpRequest.upload.onprogress` 
- Aggregate progress across multiple files
- Real-time UI updates with file-specific progress

```typescript
function uploadWithProgress(formData: FormData, onProgress: (progress: number) => void) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = (event.loaded / event.total) * 100;
        onProgress(progress);
      }
    };
    
    xhr.onload = () => resolve(JSON.parse(xhr.responseText));
    xhr.onerror = () => reject(new Error('Upload failed'));
    
    xhr.open('POST', '/api/upload');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
}
```

### Phase 3: Performance & Scalability (Days 5-6)

#### 3.1 Memory Optimization
**Vercel Function Limits**:
- Memory: 1024MB max (Pro plan)
- Execution time: 60s max
- Request size: 5MB max (increased via config)

**Configuration Updates**:
```typescript
// vercel.json
{
  "functions": {
    "src/routes/api/upload/+server.ts": {
      "memory": 1024,
      "maxDuration": 60
    }
  }
}
```

#### 3.2 Concurrent Upload Strategy
**Parallel Processing**:
- Upload files concurrently to R2
- Use `Promise.allSettled()` for graceful error handling
- Implement per-file success/failure tracking

```typescript
const uploadPromises = Object.entries(files).map(async ([angle, file]) => {
  try {
    const key = generateKey(angle, metadata);
    await uploadToR2(file, key);
    return { angle, success: true, key };
  } catch (error) {
    return { angle, success: false, error: error.message };
  }
});

const results = await Promise.allSettled(uploadPromises);
```

#### 3.3 Request Size Handling
**Large File Strategy**:
- Client-side chunk size validation
- Server-side streaming (no buffering)
- Early termination on oversized requests

### Phase 4: Monitoring & Observability (Day 7)

#### 4.1 Logging Implementation
**Structured Logging**:
```typescript
interface UploadLog {
  requestId: string;
  userId: string;
  sessionId: string;
  files: Array<{
    angle: string;
    size: number;
    contentType: string;
  }>;
  duration: number;
  success: boolean;
  errors?: string[];
}
```

**Log Destinations**:
- Console (Vercel logs)
- Optional: External service (DataDog, LogRocket)

#### 4.2 Metrics Collection
**Key Metrics**:
- Upload success rate by user/time
- Average upload duration
- File size distribution
- Error frequency by type
- Peak concurrent uploads

#### 4.3 Health Monitoring
**Endpoint**: `/api/upload/health`
**Checks**:
- R2 connectivity
- Authentication service status
- Available memory/CPU
- Recent error rates

### Phase 5: Testing Strategy (Day 8)

#### 5.1 Unit Tests
**Test Files**:
- `src/routes/api/upload/+server.test.ts`
- `src/lib/upload/streaming.test.ts`
- `src/components/ui/FileUploader.test.ts`

**Test Coverage**:
- File validation logic
- Streaming upload mechanics
- Error handling paths
- Authentication flows

#### 5.2 Integration Tests
**Scenarios**:
- End-to-end upload flow
- Large file handling
- Network interruption recovery
- Concurrent upload stress testing

#### 5.3 Load Testing
**Tools**: Artillery.js or k6
**Scenarios**:
- 100 concurrent uploads
- Large file uploads (200MB each)
- Extended duration testing (1 hour)

### Phase 6: Migration & Rollout (Days 9-10)

#### 6.1 Feature Flag Implementation
```typescript
const USE_BACKEND_UPLOAD = process.env.USE_BACKEND_UPLOAD === 'true';

// Gradual rollout strategy
if (USE_BACKEND_UPLOAD) {
  return await backendUpload(files, metadata);
} else {
  return await presignedUpload(files, metadata);
}
```

#### 6.2 Cleanup Phase
**Remove Old Code**:
- Delete presigned URL endpoints
- Remove related utilities and types
- Update documentation
- Clean up environment variables

#### 6.3 Performance Comparison
**Metrics to Track**:
- Upload success rate: Target >99%
- Average upload time: Target <30s for 3x50MB files
- Error reduction: Target >95% reduction in SSL errors

## Risk Assessment & Mitigation

### High-Risk Areas
1. **Memory Usage**: Large files could exhaust function memory
   - **Mitigation**: Streaming implementation + memory monitoring
   
2. **Timeout Issues**: Long uploads might exceed function limits
   - **Mitigation**: File size limits + timeout handling
   
3. **Concurrent Load**: Multiple users uploading simultaneously
   - **Mitigation**: Rate limiting + horizontal scaling

### Rollback Strategy
1. **Immediate**: Toggle feature flag to revert to presigned URLs
2. **Emergency**: Deploy previous commit via Vercel dashboard
3. **Data Recovery**: No data loss risk (uploads are atomic)

## Security Considerations

### Data Protection
- **In-Transit**: HTTPS for all communications
- **At-Rest**: R2 encryption enabled
- **Access Control**: JWT validation for all uploads

### Input Validation
```typescript
const validateUpload = (files: FileList, metadata: UploadMetadata) => {
  // File type validation
  const allowedTypes = ['video/webm', 'video/mp4', 'video/quicktime'];
  
  // Size validation
  const maxFileSize = 200 * 1024 * 1024; // 200MB
  const maxTotalSize = 600 * 1024 * 1024; // 600MB
  
  // Content validation
  for (const file of files) {
    if (!allowedTypes.includes(file.type)) {
      throw new Error(`Invalid file type: ${file.type}`);
    }
    if (file.size > maxFileSize) {
      throw new Error(`File too large: ${file.size}`);
    }
  }
};
```

### Rate Limiting Implementation
```typescript
import { kv } from '@vercel/kv';

const checkRateLimit = async (userId: string) => {
  const now = Date.now();
  const key = `rate_limit:${userId}`;
  
  // Get current rate limit data from Vercel KV
  const userLimit = await kv.get<{ count: number; resetTime: number }>(key);
  
  if (!userLimit || now > userLimit.resetTime) {
    // Reset or initialize rate limit window
    await kv.set(key, { count: 1, resetTime: now + 60000 }, { ex: 60 });
    return true;
  }
  
  if (userLimit.count >= 10) {
    throw new Error('Rate limit exceeded');
  }
  
  // Increment counter in distributed store
  userLimit.count++;
  await kv.set(key, userLimit, { ex: 60 });
  return true;
};
```

**Dependencies**: Add `@vercel/kv` to package.json
**Configuration**: Set `KV_REST_API_URL` and `KV_REST_API_TOKEN` in Vercel environment variables

## Success Metrics

### Technical KPIs
- **Upload Success Rate**: >99%
- **Average Upload Time**: <30 seconds for typical session
- **Error Rate**: <1% of total uploads
- **99th Percentile Latency**: <60 seconds

### User Experience KPIs
- **User Satisfaction**: Survey feedback on upload reliability
- **Support Tickets**: Reduction in upload-related issues
- **Conversion Rate**: Upload-to-analysis completion rate

## Timeline Summary

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| 1 | 2 days | Backend upload endpoint, streaming, validation |
| 2 | 2 days | Frontend refactor, progress tracking |
| 3 | 2 days | Performance optimization, scaling |
| 4 | 1 day | Monitoring, logging, metrics |
| 5 | 1 day | Testing suite, load testing |
| 6 | 2 days | Migration, cleanup, performance validation |

**Total Timeline**: 10 business days

## Post-Implementation Monitoring

### Week 1: Intensive Monitoring
- Daily review of upload metrics
- User feedback collection
- Performance optimization based on real data

### Month 1: Stability Assessment
- Monthly performance reports
- Capacity planning based on usage patterns
- Feature enhancement based on user feedback

### Ongoing: Maintenance
- Quarterly security audits
- Performance trend analysis
- Scalability planning

## Conclusion

This backend upload proxy implementation eliminates the fundamental compatibility issues with direct browser-to-R2 uploads while providing enhanced security, reliability, and observability. The phased approach ensures minimal risk during migration while establishing a robust foundation for future scaling.

The architecture aligns with industry best practices for file upload systems and provides the flexibility to add advanced features like resumable uploads, virus scanning, and advanced analytics in the future.

## Next Steps

Ready to begin implementation with Phase 1: Backend Infrastructure. The first deliverable will be the `/api/upload` endpoint with streaming capabilities and proper authentication. 