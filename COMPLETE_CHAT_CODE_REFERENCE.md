# Pure Golf Chat System - Complete Code Reference

## Current Issue
Coach Oliver messages are being saved to database but not appearing in chat interface.

**Status**: Messages ARE being created successfully in `pure_chat_messages` table, but chat API returns empty results.

---

## Database Schema

### Chat Messages Table
```sql
-- Chat messages table (in pure schema)
CREATE TABLE IF NOT EXISTS pure_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swing_id UUID NOT NULL REFERENCES pure_swings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES pure_users(id) ON DELETE CASCADE, 
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policy
CREATE POLICY "Users can view own chat messages" ON pure_chat_messages 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own chat messages" ON pure_chat_messages 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### Related Tables
```sql
-- Swings table
CREATE TABLE IF NOT EXISTS pure_swings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES pure_users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('wood', 'iron', 'wedge', 'chip', 'putt')),
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'error')),
  video_urls JSONB,
  ai_flaws JSONB,
  ai_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table  
CREATE TABLE IF NOT EXISTS pure_users (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  handicap NUMERIC,
  plan TEXT DEFAULT 'starter',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Backend Code

### 1. Chat API - GET Handler
**File**: `src/routes/api/chat/[swing_id]/+server.ts`

```typescript
// Get chat history for a swing
export const GET: RequestHandler = async ({ params, request }) => {
  try {
    const swingId = params.swing_id;
    
    if (!swingId) {
      return json(
        { error: { code: 'MISSING_SWING_ID', message: 'Swing ID is required' } },
        { status: 400 }
      );
    }

    // Validate authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Extract and verify JWT token
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return json(
        { error: { code: 'INVALID_TOKEN', message: 'Invalid authentication token' } },
        { status: 401 }
      );
    }

    // **DEBUG LOGGING ADDED**
    console.log('🔍 Chat API - swing_id:', swingId, 'user_id:', user.id);
    
    // Check what messages exist for this swing (without user filter)
    const { data: allMessages } = await supabase
      .from('pure_chat_messages')
      .select('user_id, role')
      .eq('swing_id', swingId);
    
    console.log('📋 All messages for swing:', allMessages?.map(m => ({ user_id: m.user_id, role: m.role })) || []);
    
    // **MAIN QUERY - This returns empty despite messages existing**
    const { data: messages, error: fetchError } = await supabase
      .from('pure_chat_messages')
      .select('*')
      .eq('swing_id', swingId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    
    console.log('📊 Query result:', { messages: messages?.length || 0, error: fetchError });

    if (fetchError) {
      console.error('Error fetching chat history:', fetchError);
      return json(
        { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch chat history' } },
        { status: 500 }
      );
    }

    return json({
      messages: messages || []
    });

  } catch (error) {
    console.error('Error getting chat history:', error);
    return json(
      { 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to get chat history' 
        } 
      },
      { status: 500 }
    );
  }
};
```

### 2. Analysis API - Coach Message Creation
**File**: `src/routes/api/swings/analyze/+server.ts`

```typescript
export const POST: RequestHandler = async ({ request }) => {
  try {
    // ... swing analysis logic ...

    // Generate Coach Oliver's personalized response
    const coachMessage = await generateCoachOliverResponse(swing, analysis, user?.user, profile);

    // **ENHANCED ERROR HANDLING ADDED**
    console.log(`💬 Inserting chat message for swing ${swing.id} user ${swing.user_id}`);
    const { error: chatError } = await adminClient
      .from('pure_chat_messages')
      .insert({
        swing_id: swing.id,
        user_id: swing.user_id,
        role: 'assistant',
        content: coachMessage,
        created_at: new Date().toISOString()
      });

    if (chatError) {
      console.error('❌ Chat message insert failed:', chatError);
      throw new Error(`Chat message insert failed: ${chatError.message}`);
    }

    console.log(`✅ Completed analysis for swing ${swing.id} and created chat message`);

    return json({ 
      message: 'Analysis completed', 
      swing_id: swing.id,
      processed: 1,
      analysis
    });

  } catch (error) {
    console.error('❌ Analysis worker error:', error);
    return json(
      { error: 'Analysis failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
};

async function generateCoachOliverResponse(swing: any, analysis: any, user: any, profile: any) {
  const model = chooseModel(800);
  
  const prompt = `You are Coach Oliver, an experienced PGA professional with 20+ years of teaching elite golfers. 

A golfer just uploaded a ${swing.category} swing for analysis. Here's the technical analysis:

**Technical Analysis Results:**
- Swing Score: ${analysis.flaws.swing_score}/100
- Primary Issue: ${analysis.flaws.primary_flaw || 'None identified'}
- Secondary Issue: ${analysis.flaws.secondary_flaw || 'None identified'}
- Analysis: ${analysis.summary}

**Golfer Context:**
- Email: ${user?.email || 'Not provided'}
- Handicap: ${profile?.handicap || 'Not specified'}
- Goals: ${profile?.goals || 'Not specified'}
- Name: ${profile?.name || 'there'}

Create a welcoming, encouraging response that:
1. Acknowledges their swing upload
2. Highlights what they did well (be specific if possible)
3. Addresses the main areas for improvement in an encouraging way
4. Provides 1-2 specific, actionable tips
5. Invites them to ask follow-up questions

Keep it conversational, under 150 words, and maintain your warm but authoritative coaching style.`;

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: 'You are Coach Oliver, a warm but authoritative PGA professional. Your responses should be encouraging, specific, and actionable.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 200,
    temperature: 0.7
  });

  return completion.choices[0]?.message?.content || 'Great swing! Let me know if you have any questions about your technique.';
}
```

---

## Frontend Code

### 3. Chat Page Component
**File**: `src/routes/swing/[id]/chat/+page.svelte`

```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  
  let swingId = '';
  let swing: any = null;
  let messages: any[] = [];
  let loading = true;
  let error = '';
  let newMessage = '';
  let sending = false;
  
  onMount(async () => {
    swingId = $page.params.id;
    await loadSwingAndMessages();
  });
  
  async function loadSwingAndMessages() {
    try {
      // Get authentication token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        goto('/auth/login');
        return;
      }
      
      const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      };
      
      // Load swing data
      const swingResponse = await fetch(`/api/swing/${swingId}`, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (swingResponse.ok) {
        swing = await swingResponse.json();
      } else {
        error = 'Failed to load swing data';
        return;
      }
      
      // **MAIN CHAT API CALL - Returns empty despite messages existing**
      const messagesResponse = await fetch(`/api/chat/${swingId}`, {
        headers: authHeaders
      });
      
      if (messagesResponse.ok) {
        const result = await messagesResponse.json();
        messages = result.messages || [];
      }
      
    } catch (err) {
      error = 'Failed to load data';
      console.error('Load error:', err);
    } finally {
      loading = false;
    }
  }

  // ... rest of component logic ...
</script>

<!-- Chat Interface Template -->
<div class="bg-white rounded-xl shadow-sm flex flex-col h-[600px]">
  <div class="p-4 border-b border-gray-200">
    <h2 class="text-lg font-semibold text-augusta-800">Coach Oliver</h2>
    <p class="text-sm text-augusta-600">Your AI Golf Coach</p>
  </div>
  
  <!-- Messages -->
  <div class="flex-1 overflow-y-auto p-4 space-y-4">
    <!-- **CRITICAL LOGIC** - Fixed to check messages.length instead of swing status -->
    {#if messages.length === 0}
      <div class="text-center text-augusta-500 py-8">
        <p>No messages yet.</p>
        <p class="text-sm mt-2">Waiting for analysis to complete...</p>
      </div>
    {:else}
      {#each messages as message}
        <div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
          <div class="max-w-xs lg:max-w-md px-4 py-2 rounded-lg {
            message.role === 'user' 
              ? 'bg-augusta-600 text-white' 
              : 'bg-gray-100 text-augusta-800'
          }">
            {#if message.role === 'assistant'}
              <div class="flex items-center mb-1">
                <div class="w-6 h-6 bg-augusta-100 rounded-full flex items-center justify-center mr-2">
                  🏌️
                </div>
                <span class="text-xs font-medium">Coach Oliver</span>
              </div>
            {/if}
            <div class="whitespace-pre-wrap">{message.content}</div>
            <div class="text-xs opacity-70 mt-1">
              {new Date(message.created_at).toLocaleTimeString()}
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </div>
  
  <!-- Message Input -->
  <div class="p-4 border-t border-gray-200">
    <div class="flex space-x-2">
      <input
        bind:value={newMessage}
        disabled={sending || messages.length === 0}
        placeholder={messages.length > 0 ? "Ask Coach Oliver about your swing..." : "Waiting for analysis..."}
        class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-augusta-500 disabled:bg-gray-100 disabled:text-gray-400"
      />
      <button
        on:click={sendMessage}
        disabled={!newMessage.trim() || sending || messages.length === 0}
        class="px-4 py-2 bg-augusta-600 text-white rounded-lg hover:bg-augusta-700 disabled:opacity-50"
      >
        Send
      </button>
    </div>
  </div>
</div>
```

---

## Key Findings from Database Investigation

### Messages ARE Being Created Successfully
```json
[
  {
    "id": "f8476c14-96c7-45a3-a2ec-4debf56e418d",
    "swing_id": "27fc811c-8e54-4918-b421-73accc9e9886",
    "user_id": "27564b77-ca3d-4f37-8902-580de3c1dc6f", 
    "role": "assistant",
    "content": "Hi there!\n\nThanks for sharing your wedge swing! I appreciate your commitment to improving your game...",
    "created_at": "2025-06-11T19:13:37.468+00:00"
  }
]
```

### Analysis API Logs Show Success
- ✅ `💬 Inserting chat message for swing 27fc811c... user 27564b77...`
- ✅ `Completed analysis for swing 27fc811c... and created chat message`
- ❌ **No error thrown** during insert

### Chat API Logs Show Empty Results  
- 🔍 `Chat API - swing_id: 27fc811c... user_id: 27564b77...`
- 📋 `All messages for swing: []` (Empty!)  
- 📊 `Query result: { messages: 0, error: null }`

---

## Debugging Hypothesis

The issue appears to be either:

1. **RLS Policy Problem**: Row Level Security is blocking the query despite using correct user_id
2. **Schema Mismatch**: Code references wrong table name or schema
3. **Supabase Client Configuration**: Different client configs between analysis and chat APIs
4. **Transaction Issue**: Messages are being rolled back after successful insert
5. **Caching Issue**: Stale cache preventing fresh data retrieval

---

## Immediate Test Commands

```bash
# Test direct database access
curl -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
     "$PUBLIC_SUPABASE_URL/rest/v1/pure_chat_messages?swing_id=eq.27fc811c-8e54-4918-b421-73accc9e9886" \
     -H "apikey: $SUPABASE_SERVICE_ROLE_KEY"

# Test chat API directly  
curl -H "Authorization: Bearer $USER_JWT_TOKEN" \
     "$PUBLIC_SUPABASE_URL/api/chat/27fc811c-8e54-4918-b421-73accc9e9886"
```

---

## Next Steps

1. **Verify RLS Policies**: Check if RLS is blocking authenticated users
2. **Test Service Role**: Try chat API with service role instead of user token
3. **Check Table Names**: Verify exact table names match between APIs
4. **Clear Cache**: Force browser/SvelteKit cache clear
5. **Test Fresh Swing**: Upload new video and check if messages appear immediately 