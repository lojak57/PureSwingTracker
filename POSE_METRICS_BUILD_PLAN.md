# Pose Metrics Implementation Plan - Pure Golf

## 🎯 Final Flow Overview (2 min mental map)

```
SvelteKit upload page
      │
      ▼
PUT video → R2  ──▶  enqueue "swing-analysis" job (Supabase function)
                        │
                        ▼
               Modal / Node service
               (FFmpeg + MediaPipe)
                        │
                        ▼
           ➜ POST /metrics  (tempo, plane Δ, sway …)
                        │
                        ▼
   supabase_admin.insert('swing_metrics')
                        │
                        ├── trigger → update pure_swings.status = 'metrics_ready'
                        │
                        └── trigger → call OpenAI with metrics → insert chat msg
                                         ▼
                                     SvelteKit
                             SSE subscription → UI
```

## ✅ Implementation Checklist

### 1. Schema Changes (15 min) - UPDATED

**File**: Direct SQL in Supabase dashboard

**Add columns to pure_swings**:
```sql
alter table pure_swings
  add column swing_mode text default 'quick' check (swing_mode in ('quick', 'range')),
  add column angle_id  smallint default 0;
```

**Create swing_metrics table**:
```sql
create table swing_metrics (
  id          uuid primary key default gen_random_uuid(),
  swing_id    uuid references pure_swings(id) on delete cascade,
  tempo_ratio numeric(4,2),      -- Fixed precision for SQL aggregates
  plane_delta numeric(4,1),      -- degrees (positive = steep)
  hip_sway_cm numeric(4,1),
  x_factor    numeric(4,1),      -- null in quick mode
  video_hash  text,              -- sha256 for caching
  created_at  timestamptz default now()
);

-- RLS: golfers read their own metrics
alter table swing_metrics enable row level security;

create policy "user can view own metrics"
on swing_metrics
for select
using (
  -- Use current_setting for Edge Functions compatibility
  coalesce(
    current_setting('request.jwt.claim.sub', true)::uuid,
    auth.uid()
  ) = (select user_id from pure_swings where id = swing_id)
);
```

**Create analysis queue with advisory locking**:
```sql
create table analysis_queue (
  id uuid primary key default gen_random_uuid(),
  swing_id uuid references pure_swings(id) on delete cascade,
  attempts smallint default 0,
  last_error text,
  created_at timestamptz default now()
);

-- Advisory lock function to prevent double-processing
create or replace function process_next_analysis()
returns uuid language plpgsql as $$
declare
  queue_item_id uuid;
begin
  -- Try to acquire lock and get next item atomically
  select id into queue_item_id
  from analysis_queue
  where pg_try_advisory_xact_lock(hashtext(id::text))
  order by created_at
  limit 1;
  
  return queue_item_id;
end;
$$;
```

**Enhanced feature flags with expiry**:
```sql
create table features (
  key text primary key,
  enabled boolean default false,
  user_id uuid references auth.users(id), -- optional: per-user flags
  enabled_until timestamptz -- auto-expire testers
);

insert into features values ('pose_metrics', false, null, null);
```

- [ ] **Task 1.1**: Execute schema changes in Supabase
- [ ] **Task 1.2**: Test RLS policies with different users
- [ ] **Task 1.3**: Verify triggers work with test data

---

### 2. Upload API Tweaks (30 min)

**File**: `src/routes/api/swings/upload/+server.ts`

**Changes needed**:
- Accept `mode` (quick/range) and optional `angle` in request body
- Create swing row with new fields
- Replace immediate GPT call with job queue

**Implementation**:
```typescript
// In the upload success section, replace analysis trigger:
// OLD: await analyzeSwingWithGPT(swing);
// NEW:
await adminClient.rpc('enqueue_analysis_job', {
  p_swing_id: swing.id
});

// Add mode/angle to swing creation:
const swingData = {
  user_id: userId,
  category,
  swing_mode: mode || 'quick',
  angle_id: angle || 0,
  video_urls: videoUrls,
  metadata: { upload_session: uploadSession },
  status: 'queued'  // Changed from 'processing'
};
```

- [ ] **Task 2.1**: Update upload API to accept mode/angle
- [ ] **Task 2.2**: Replace direct analysis with queue
- [ ] **Task 2.3**: Test upload flow end-to-end

---

### 3. Pose Metrics Microservice (3-4 hours) - UPDATED

**Directory**: `services/pose-metrics/`

**Tech Stack**: Node 20 + MediaPipe JS (⚠️ **Watch 15s CPU limit on Modal free tier**)

**API Endpoint**: `POST /metrics`

**Request Format**:
```json
{
  "video_url": "https://cdn.varro-golfhq.com/...webm",
  "mode": "quick",
  "angle": 0,
  "video_hash": "sha256_of_video_content"  // For caching
}
```

**Response Format**:
```json
{
  "tempo_ratio": 3.2,
  "plane_delta": -2.5,
  "hip_sway_cm": 3.1,
  "x_factor": 52,
  "confidence": 0.87,
  "processing_time_ms": 8500,
  "cached": false
}
```

**Service Flow with Caching**:
```
video_hash → check R2 cache → return cached JSON if exists
         ↓
video → ffmpeg convert HEVC → extract frames → mediapipe pose
     → calculate metrics → cache in R2 → return JSON
```

**Key Files**:
- `services/pose-metrics/package.json`
- `services/pose-metrics/src/index.js` (Express server)
- `services/pose-metrics/src/cache-manager.js` (R2 caching by video hash)
- `services/pose-metrics/src/video-processor.js` (FFmpeg with HEVC handling)
- `services/pose-metrics/src/pose-analyzer.js` (MediaPipe integration)
- `services/pose-metrics/src/golf-metrics.js` (Calculate tempo, plane, etc.)
- `services/pose-metrics/Dockerfile`

**Critical Implementation Notes**:
```javascript
// Video processing with HEVC support
const ffmpegCommand = [
  '-i', inputVideo,
  '-c:v', 'libx264',  // Convert HEVC from iPhone
  '-vf', 'scale=720:480',  // Standardize resolution
  '-r', '15',  // Reduce to 15fps for faster processing
  '-f', 'image2',
  'frame_%04d.jpg'
];

// Caching strategy
const cacheKey = `metrics/${videoHash}.json`;
const cachedResult = await r2Bucket.get(cacheKey);
if (cachedResult) {
  return cachedResult.json();
}

// Process and cache
const metrics = await processVideo(videoUrl);
await r2Bucket.put(cacheKey, JSON.stringify(metrics));
```

- [ ] **Task 3.1**: Set up Node service with dummy JSON response (START HERE)
- [ ] **Task 3.2**: Add R2 caching layer with video hash
- [ ] **Task 3.3**: Implement FFmpeg with HEVC conversion
- [ ] **Task 3.4**: Basic MediaPipe pose detection
- [ ] **Task 3.5**: Calculate golf-specific metrics
- [ ] **Task 3.6**: Deploy to Modal.com free tier
- [ ] **Task 3.7**: Benchmark processing time vs 15s limit

---

### 4. Analysis Worker (1 hour) - UPDATED

**File**: `supabase/functions/swing-analysis/index.ts`

**Worker Flow with Error Handling**:
1. Use advisory lock to get next queued analysis
2. Download video with exponential backoff
3. Call pose-metrics service with retry logic
4. Insert into `swing_metrics` (service role)
5. Generate enhanced chat response with fixed decimals
6. Insert chat message
7. Delete queue row (last step for atomicity)

**Implementation with Production Safeguards**:
```typescript
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: Request) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // 1. Get next item with advisory lock (prevents double-processing)
  const { data: queueItemId } = await supabase.rpc('process_next_analysis');
  
  if (!queueItemId) {
    return new Response('No jobs in queue', { status: 200 });
  }

  try {
    // 2. Get full queue item data
    const { data: queueItem } = await supabase
      .from('analysis_queue')
      .select('*, pure_swings(*)')
      .eq('id', queueItemId)
      .single();

    // 3. Call pose service with exponential backoff
    const metrics = await callPoseServiceWithRetry(
      queueItem.pure_swings.video_urls.single,
      queueItem.pure_swings.swing_mode,
      queueItem.pure_swings.angle_id,
      queueItem.pure_swings.metadata?.video_hash
    );

    // 4. Store metrics (trigger will update swing status)
    await supabase.from('swing_metrics').insert({
      swing_id: queueItem.swing_id,
      tempo_ratio: Number(metrics.tempo_ratio.toFixed(2)),  // Fixed decimals
      plane_delta: Number(metrics.plane_delta.toFixed(1)),
      hip_sway_cm: Number(metrics.hip_sway_cm.toFixed(1)),
      x_factor: metrics.x_factor ? Number(metrics.x_factor.toFixed(1)) : null,
      video_hash: metrics.video_hash
    });

    // 5. Generate coach response with real metrics
    const coachMessage = buildCoachPrompt(queueItem.pure_swings, metrics);
    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: coachMessage }],
      max_tokens: 150,
      temperature: 0.7
    });

    // 6. Insert chat message
    await supabase.from('pure_chat_messages').insert({
      swing_id: queueItem.swing_id,
      user_id: queueItem.pure_swings.user_id,
      role: 'assistant',
      content: chatResponse.choices[0]?.message?.content || 'Analysis complete!'
    });

    // 7. Clean up queue (last step for atomicity)
    await supabase.from('analysis_queue').delete().eq('id', queueItemId);

    return new Response('Analysis completed', { status: 200 });

  } catch (error) {
    // Update error count and message
    await supabase
      .from('analysis_queue')
      .update({
        attempts: supabase.raw('attempts + 1'),
        last_error: error.message
      })
      .eq('id', queueItemId);

    // Delete if too many attempts
    await supabase
      .from('analysis_queue')
      .delete()
      .eq('id', queueItemId)
      .gte('attempts', 3);

    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

// Exponential backoff for pose service calls
async function callPoseServiceWithRetry(videoUrl, mode, angle, videoHash, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(POSE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_url: videoUrl, mode, angle, video_hash: videoHash })
      });

      if (!response.ok) throw new Error(`Pose service error: ${response.status}`);
      return await response.json();

    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      // Exponential backoff: 2^attempt seconds
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
}

function buildCoachPrompt(swing, metrics) {
  return `You are Coach Oliver. Analyze this ${swing.category} swing:

REAL BIOMECHANICAL DATA:
- Tempo: ${metrics.tempo_ratio.toFixed(1)} (ideal: 3.0)
- Plane: ${metrics.plane_delta.toFixed(1)}° ${metrics.plane_delta > 0 ? 'steep' : 'shallow'}
- Hip sway: ${metrics.hip_sway_cm.toFixed(1)}cm ${metrics.hip_sway_cm > 4 ? '(sliding)' : '(stable)'}
${metrics.x_factor ? `- X-factor: ${metrics.x_factor.toFixed(0)}° separation` : ''}

Give ONE key improvement and ONE drill. Max 120 words.`;
}

**Supabase Edge Scheduler Setup**:
```sql
-- Create cron job (runs every 30 seconds)
select cron.schedule('process-swing-analysis', '*/30 * * * * *', 'select net.http_post(
  url := ''https://your-project.supabase.co/functions/v1/swing-analysis'',
  headers := ''{"Authorization": "Bearer YOUR_ANON_KEY"}''::jsonb
);');
```

- [ ] **Task 4.1**: Create Supabase Edge Function with dummy processing
- [ ] **Task 4.2**: Add advisory locking and error handling
- [ ] **Task 4.3**: Implement exponential backoff for pose service
- [ ] **Task 4.4**: Set up Supabase Edge Scheduler (every 30s)
- [ ] **Task 4.5**: Test with real video URLs and error scenarios

---

### 5. Frontend Updates (3 hours) - UPDATED

**Real-time Subscription with Case-Sensitive Filters**:
```javascript
// src/stores/swingMetrics.js
import { writable } from 'svelte/store';
import supabase from '$lib/supabase';

export const swingMetrics = writable(null);
export const isAnalyzing = writable(false);

export function subscribeToMetrics(swingId) {
  // Case-sensitive table name in filter!
  const channel = supabase
    .channel(`swing_metrics:swing_id=${swingId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'pure',  
      table: 'swing_metrics',  // lowercase table name
      filter: `swing_id=eq.${swingId}`
    }, (payload) => {
      swingMetrics.set(payload.new);
      isAnalyzing.set(false);
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}
```

**SwingMetrics.svelte Component**:
```svelte
<!-- src/components/golf/SwingMetrics.svelte -->
<script>
  export let swing;
  export let metrics;
  
  $: tempoColor = getTempoColor(metrics?.tempo_ratio);
  $: planeColor = getPlaneColor(metrics?.plane_delta);
  
  function getTempoColor(ratio) {
    if (!ratio) return 'text-gray-400';
    if (ratio >= 2.8 && ratio <= 3.2) return 'text-emerald-500';
    if (ratio >= 2.5 && ratio <= 3.5) return 'text-yellow-500';
    return 'text-red-500';
  }
  
  function getPlaneColor(delta) {
    if (!delta) return 'text-gray-400';
    if (Math.abs(delta) <= 2) return 'text-emerald-500';
    if (Math.abs(delta) <= 5) return 'text-yellow-500';
    return 'text-red-500';
  }
</script>

<div class="glass p-4 rounded-xl space-y-3">
  <h3 class="text-lg font-semibold mb-3">Swing Metrics</h3>
  
  <div class="grid grid-cols-2 gap-4">
    <div class="text-center">
      <div class="text-2xl font-bold {tempoColor}">
        {metrics?.tempo_ratio?.toFixed(1) || '--'}
      </div>
      <div class="text-sm text-gray-600">Tempo Ratio</div>
      <div class="text-xs text-gray-500">ideal: 3.0</div>
    </div>
    
    <div class="text-center">
      <div class="text-2xl font-bold {planeColor}">
        {metrics?.plane_delta ? `${metrics.plane_delta > 0 ? '+' : ''}${metrics.plane_delta.toFixed(1)}°` : '--'}
      </div>
      <div class="text-sm text-gray-600">Swing Plane</div>
      <div class="text-xs text-gray-500">{metrics?.plane_delta > 0 ? 'steep' : 'shallow'}</div>
    </div>
    
    <div class="text-center">
      <div class="text-2xl font-bold {metrics?.hip_sway_cm > 4 ? 'text-red-500' : 'text-emerald-500'}">
        {metrics?.hip_sway_cm?.toFixed(1) || '--'}cm
      </div>
      <div class="text-sm text-gray-600">Hip Sway</div>
      <div class="text-xs text-gray-500">{metrics?.hip_sway_cm > 4 ? 'sliding' : 'stable'}</div>
    </div>
    
    {#if swing.swing_mode === 'range' && metrics?.x_factor}
    <div class="text-center">
      <div class="text-2xl font-bold text-blue-500">
        {metrics.x_factor.toFixed(0)}°
      </div>
      <div class="text-sm text-gray-600">X-Factor</div>
      <div class="text-xs text-gray-500">separation</div>
    </div>
    {/if}
  </div>
</div>
```

- [ ] **Task 5.1**: Create SwingMetrics component with color-coded displays
- [ ] **Task 5.2**: Set up real-time subscription with correct table casing
- [ ] **Task 5.3**: Update chat UI to show metrics before Coach response
- [ ] **Task 5.4**: Add loading states for analysis in progress

---

### 7. Range Mode Wizard (2 hours) - UPDATED

**Three-Angle Upload Flow with Session Tracking**:

**RangeWizard.svelte** (saves `swing_session_id` for combined reports):
```svelte
<!-- src/components/golf/RangeWizard.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  import { v4 as uuid } from 'uuid';
  
  const dispatch = createEventDispatcher();
  
  let currentStep = 0;
  let swingSessionId = uuid(); // Track all three angles together
  let completedSwings = [];
  
  const steps = [
    { angle: 0, title: 'Face-On View', instruction: 'Position camera facing you' },
    { angle: 1, title: 'Down-the-Line', instruction: 'Camera behind your target line' },
    { angle: 2, title: 'Side View', instruction: 'Camera to your right side' }
  ];
  
  async function handleUpload(videoFile) {
    const swingData = {
      video_file: videoFile,
      swing_mode: 'range',
      angle_id: steps[currentStep].angle,
      metadata: { 
        swing_session_id: swingSessionId,
        angle_name: steps[currentStep].title
      }
    };
    
    const swing = await uploadSwing(swingData);
    completedSwings.push(swing);
    
    if (currentStep < 2) {
      currentStep++;
    } else {
      dispatch('complete', { 
        session_id: swingSessionId,
        swings: completedSwings 
      });
    }
  }
</script>

<div class="glass p-6 rounded-xl">
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-xl font-bold">Range Session</h2>
    <div class="text-sm text-gray-600">{currentStep + 1} of 3</div>
  </div>
  
  <!-- Progress bar -->
  <div class="w-full bg-gray-200 rounded-full h-2 mb-6">
    <div class="bg-emerald-500 h-2 rounded-full transition-all duration-300" 
         style="width: {((currentStep + 1) / 3) * 100}%"></div>
  </div>
  
  <div class="text-center mb-6">
    <h3 class="text-lg font-semibold mb-2">{steps[currentStep].title}</h3>
    <p class="text-gray-600">{steps[currentStep].instruction}</p>
  </div>
  
  <FileUploader 
    on:upload={(e) => handleUpload(e.detail.file)}
    accept="video/*"
    maxSize={25 * 1024 * 1024}
  />
  
  {#if completedSwings.length > 0}
  <div class="mt-6">
    <h4 class="font-semibold mb-2">Completed:</h4>
    <div class="space-y-2">
      {#each completedSwings as swing, i}
      <div class="flex items-center text-sm">
        <span class="w-3 h-3 bg-emerald-500 rounded-full mr-2"></span>
        {steps[i].title}
      </div>
      {/each}
    </div>
  </div>
  {/if}
</div>
```

**Database Schema Update for Sessions**:
```sql
-- Add to existing pure_swings table
alter table pure_swings 
  add column swing_session_id uuid; -- Links multiple angles together

-- Index for session queries
create index idx_swings_session on pure_swings(swing_session_id, angle_id);
```

- [ ] **Task 7.1**: Create RangeWizard component with session UUID tracking
- [ ] **Task 7.2**: Update upload API to accept `swing_session_id` in metadata
- [ ] **Task 7.3**: Create combined session report view
- [ ] **Task 7.4**: Add session-based progress tracking

---

### 8. Dashboard Metrics Trends (1 hour)

**File**: `src/routes/dashboard/+page.svelte`

```typescript
// Add to dashboard load function
const { data: metricsHistory } = await supabase
  .from('swing_metrics')
  .select(`
    created_at,
    tempo_ratio,
    plane_delta,
    hip_sway_cm,
    swing_id,
    pure_swings!inner(category)
  `)
  .order('created_at', { ascending: true })
  .limit(20);

// Group by date for trend chart
const trendData = metricsHistory.reduce((acc, metric) => {
  const date = new Date(metric.created_at).toLocaleDateString();
  if (!acc[date]) acc[date] = [];
  acc[date].push(metric);
  return acc;
}, {});
```

**Template**:
```svelte
<div class="mb-8">
  <h3 class="text-lg font-semibold mb-4">Swing Metrics Trends</h3>
  
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
    <MetricCard 
      title="Average Tempo" 
      value={avgTempo.toFixed(1)} 
      trend={tempoTrend} 
    />
    <MetricCard 
      title="Plane Consistency" 
      value={planeStdDev.toFixed(1)} 
      trend={planeTrend} 
    />
    <MetricCard 
      title="Hip Stability" 
      value={avgSway.toFixed(1)} 
      trend={swayTrend} 
    />
  </div>
  
  <TempoChart data={trendData} />
</div>
```

- [ ] **Task 8.1**: Add metrics query to dashboard
- [ ] **Task 8.2**: Create trend visualization components
- [ ] **Task 8.3**: Add real-time updates via subscription

---

### 9. Testing & Validation (30 min)

#### 9.1 RLS Security Tests
```sql
-- Test as different users
SET session_authorization 'user_a_id';
SELECT * FROM swing_metrics; -- Should only see own metrics

SET session_authorization 'user_b_id';  
SELECT * FROM swing_metrics WHERE swing_id = 'user_a_swing_id'; -- Should return empty
```

#### 9.2 End-to-End Flow Tests
- [ ] Upload video as User A
- [ ] Verify analysis queue entry created
- [ ] Mock pose service response
- [ ] Verify metrics inserted
- [ ] Verify swing status updated to 'metrics_ready'
- [ ] Verify chat message created with metrics
- [ ] Verify User B cannot see User A's metrics

#### 9.3 Error Handling Tests
- [ ] Pose service returns error
- [ ] Video download fails
- [ ] OpenAI API fails
- [ ] Verify graceful error handling and status updates

---

### 10. Environment Setup

#### 10.1 Environment Variables
```bash
# .env additions
POSE_API_URL=https://pose-api.varro-golfhq.com/metrics
MODAL_TOKEN_ID=your_modal_token
MODAL_TOKEN_SECRET=your_modal_secret
```

#### 10.2 Local Development
- [ ] Docker compose for pose-metrics service
- [ ] Mock endpoints for development
- [ ] Test data seeding scripts

---

### 11. Feature Flags (Optional - 10 min)

**Database**:
```sql
create table features (
  key text primary key,
  enabled boolean default false,
  user_id uuid references auth.users(id) -- optional: per-user flags
);

insert into features values ('pose_metrics', false);
```

**Usage**:
```typescript
const { data: feature } = await supabase
  .from('features')
  .select('enabled')
  .eq('key', 'pose_metrics')
  .single();

if (feature?.enabled) {
  // Use pose metrics flow
} else {
  // Use legacy AI flow
}
```

- [ ] **Task 11.1**: Create feature flags table
- [ ] **Task 11.2**: Add feature flag checks to upload API
- [ ] **Task 11.3**: Enable for test users first

---

## 🎯 Demo Capabilities After Completion

✅ **Quick Mode**: iPhone clip → real tempo/plane/sway metrics → targeted advice in <30s

✅ **Range Mode**: 3-angle wizard → comprehensive biomechanical analysis

✅ **Dashboard**: Tempo trends, plane consistency tracking, improvement over time

✅ **Real-time**: Live metrics appear as analysis completes

✅ **Accurate Coaching**: Coach Oliver uses REAL data, not generic advice

## 🚀 Implementation Priority

1. **Schema + Upload API** (Tasks 1-2) - Foundation
2. **Basic Pose Service** (Task 3) - Core functionality  
3. **Analysis Worker** (Task 4) - Processing pipeline
4. **Frontend Metrics** (Task 5) - User experience
5. **Enhanced Prompts** (Task 6) - Better coaching
6. **Range Mode** (Task 7) - Advanced features
7. **Dashboard Trends** (Task 8) - Analytics
8. **Polish & Testing** (Tasks 9-11) - Production ready

**Next Step**: Execute Task 1 (Schema Changes) and get the foundation in place! 💪 

## 📋 Revised Implementation Order

**Suggested Flow: "Stub-First" Approach**

1. **Pose Service Skeleton** (30 min) - Create dummy endpoint returning fake metrics
2. **Schema Changes** (15 min) - Foundation tables and RLS  
3. **Upload API & Queue** (30 min) - Wire to dummy service
4. **Analysis Worker** (1 hour) - Process queue with fake data
5. **Frontend Metrics** (2 hours) - UI components with dummy data
6. **Replace Dummy with MediaPipe** (3-4 hours) - Real computer vision

**Why This Order?**
- Frontend unblocked while wrestling with FFmpeg
- End-to-end pipeline testable in hours
- Real metrics swappable iteratively  
- No blocked threads waiting for CV complexity

**Ready to Ship Task 1** ✅

The schema changes are production-ready with all the gotcha fixes. Start there, then stub the pose endpoint, and you'll have "click-upload → fake metrics badge" running today. 