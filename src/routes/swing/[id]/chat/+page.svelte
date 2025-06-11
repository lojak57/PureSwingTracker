<script lang="ts">
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import SwingMetrics from '../../../../components/golf/SwingMetrics.svelte';
  import { swingMetrics, isAnalyzing, subscribeToMetrics, getExistingMetrics } from '../../../../stores/swingMetrics';
  
  let swingId = '';
  let swing: any = null;
  let messages: any[] = [];
  let loading = true;
  let error = '';
  let newMessage = '';
  let sending = false;
  let unsubscribeMetrics: (() => void) | null = null;
  
  onMount(async () => {
    // Debug: Track all fetch calls to swing_metrics
    if (typeof window !== 'undefined') {
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        if (args[0] && args[0].toString().includes('/swing_metrics')) {
          console.trace('🔍 RAW FETCH to swing_metrics:', ...args);
        }
        return originalFetch.apply(this, args);
      };
    }
    
    swingId = $page.params.id;
    await loadSwingAndMessages();
  });
  
  onDestroy(() => {
    if (unsubscribeMetrics) {
      unsubscribeMetrics();
    }
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
        
        // Set up metrics subscription and check for existing metrics
        if (swing && session.access_token) {
          // Check for existing metrics first using authenticated client
          try {
            const { data: existingMetrics, error } = await supabase
              .from('swing_metrics')
              .select('*')
              .eq('swing_id', swingId)
              .single();
            
            if (existingMetrics) {
              console.log('📊 Found existing metrics:', existingMetrics);
              swingMetrics.set(existingMetrics);
              isAnalyzing.set(false);
            } else if (error && error.code !== 'PGRST116') {
              console.error('Error fetching existing metrics:', error);
            }
          } catch (err) {
            console.error('Error checking existing metrics:', err);
          }
          
          // Subscribe to real-time updates
          unsubscribeMetrics = subscribeToMetrics(swingId, session.access_token);
        }
      } else {
        error = 'Failed to load swing data';
        return;
      }
      
      // Load chat messages
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
  
  async function sendMessage() {
    if (!newMessage.trim() || sending) return;
    
    const userMessage = newMessage.trim();
    newMessage = '';
    sending = true;
    
    // Add user message to UI immediately
    messages = [...messages, {
      id: Date.now(),
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString()
    }];
    
    try {
      // Get authentication token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        goto('/auth/login');
        return;
      }
      
      const response = await fetch(`/api/chat/${swingId}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ message: userMessage })
      });
      
      if (response.ok) {
        const result = await response.json();
        // Add coach response
        messages = [...messages, {
          id: Date.now() + 1,
          role: 'assistant',
          content: result.message,
          created_at: new Date().toISOString()
        }];
      } else {
        throw new Error('Failed to send message');
      }
    } catch (err) {
      console.error('Send message error:', err);
      // Remove the user message on error
      messages = messages.slice(0, -1);
    } finally {
      sending = false;
    }
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }
</script>

<div class="min-h-screen bg-gray-50">
  {#if loading}
    <!-- Loading State -->
    <div class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-augusta-600 mx-auto mb-4"></div>
        <p class="text-augusta-600">Loading your coaching session...</p>
      </div>
    </div>
    
  {:else if error}
    <!-- Error State -->
    <div class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <p class="text-red-600 mb-4">{error}</p>
        <button 
          on:click={() => goto('/dashboard')}
          class="px-4 py-2 bg-augusta-600 text-white rounded-lg hover:bg-augusta-700"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
    
  {:else}
    <!-- Main Chat Interface -->
    <div class="container mx-auto px-4 py-6 max-w-6xl">
      
      <!-- Header -->
      <div class="mb-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-augusta-800">Coaching Session</h1>
            <p class="text-augusta-600">
              {swing?.category?.toUpperCase()} • {swing?.status === 'completed' ? 'Analysis Complete' : 'Processing...'}
            </p>
          </div>
          <button 
            on:click={() => goto('/dashboard')}
            class="px-4 py-2 bg-gray-100 text-augusta-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            ← Dashboard
          </button>
        </div>
      </div>
      
      <!-- Video + Metrics + Chat Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- Left Column: Video + Metrics -->
        <div class="space-y-6">
          
          <!-- Video Player -->
          <div class="bg-white rounded-xl shadow-sm p-4">
            <h2 class="text-lg font-semibold text-augusta-800 mb-4">Your Swing</h2>
            
            {#if swing?.video_urls?.single}
              <div class="relative rounded-lg overflow-hidden bg-black">
                <video 
                  controls 
                  class="w-full h-auto"
                >
                  <source src={swing.video_urls.single} type="video/webm">
                  <source src={swing.video_urls.single} type="video/mp4">
                  Your browser does not support the video tag.
                </video>
              </div>
              
              <!-- Video Info -->
              <div class="mt-4 text-sm text-augusta-600">
                <div class="flex justify-between items-center">
                  <span>Category: <strong>{swing.category}</strong></span>
                  <span>Mode: <strong>{swing.upload_mode}</strong></span>
                </div>
                {#if swing.created_at}
                  <div class="mt-1">
                    Uploaded: {new Date(swing.created_at).toLocaleDateString()}
                  </div>
                {/if}
              </div>
            {:else}
              <div class="bg-gray-100 rounded-lg p-8 text-center">
                <p class="text-augusta-500">Video not available</p>
              </div>
            {/if}
          </div>
          
          <!-- Swing Metrics -->
          <div class="bg-white rounded-xl shadow-sm">
            <SwingMetrics swing={swing} metrics={$swingMetrics} />
          </div>
          
        </div>
        
        <!-- Right Column: Chat Interface -->
        <div class="bg-white rounded-xl shadow-sm flex flex-col h-[700px]">
          <div class="p-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-augusta-800">Coach Oliver</h2>
            <p class="text-sm text-augusta-600">Your AI Golf Coach</p>
            {#if $isAnalyzing}
              <div class="mt-2 flex items-center text-sm text-blue-600">
                <div class="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2"></div>
                Analyzing biomechanics...
              </div>
            {/if}
          </div>
          
          <!-- Messages -->
          <div class="flex-1 overflow-y-auto p-4 space-y-4">
            {#if messages.length === 0}
              <div class="text-center text-augusta-500 py-8">
                <p>No messages yet.</p>
                <p class="text-sm mt-2">
                  {#if $isAnalyzing}
                    Analyzing your swing biomechanics...
                  {:else}
                    Waiting for analysis to complete...
                  {/if}
                </p>
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
                on:keydown={handleKeydown}
                disabled={sending || messages.length === 0}
                placeholder={messages.length > 0 ? "Ask Coach Oliver about your swing..." : "Waiting for analysis..."}
                class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-augusta-500 disabled:bg-gray-100 disabled:text-gray-400"
              />
              <button
                on:click={sendMessage}
                disabled={!newMessage.trim() || sending || messages.length === 0}
                class="px-4 py-2 bg-augusta-600 text-white rounded-lg hover:bg-augusta-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {#if sending}
                  <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {:else}
                  Send
                {/if}
              </button>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  {/if}
</div> 