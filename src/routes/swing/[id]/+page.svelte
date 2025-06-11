<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  
  let swingId = '';
  let status = 'processing';
  let analyzing = false;
  let progress = 0;
  let analysisComplete = false;
  
  onMount(async () => {
    swingId = $page.params.id;
    status = $page.url.searchParams.get('status') || 'processing';
    
    // Start analysis immediately for uploaded swings
    if (status === 'processing') {
      await startAnalysis();
    }
  });
  
  async function startAnalysis() {
    analyzing = true;
    progress = 0;
    
    // Simulate progress while analysis runs
    const progressInterval = setInterval(() => {
      if (progress < 90) {
        progress += Math.random() * 10;
      }
    }, 500);
    
    try {
      console.log('🤖 Starting automatic swing analysis...');
      
      const response = await fetch('/api/swings/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ swing_id: swingId })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Analysis result:', result);
        
        clearInterval(progressInterval);
        progress = 100;
        analysisComplete = true;
        
        // Wait a moment to show completion, then redirect to chat
        setTimeout(() => {
          goto(`/swing/${swingId}/chat`);
        }, 1500);
      } else {
        throw new Error('Analysis failed');
      }
    } catch (error) {
      console.error('❌ Analysis error:', error);
      clearInterval(progressInterval);
      analyzing = false;
      // Show error state but allow manual retry
    }
  }
</script>

<div class="min-h-screen bg-gradient-to-br from-augusta-50 to-augusta-100 flex items-center justify-center p-4">
  <div class="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
    
    {#if analyzing}
      <!-- Analysis Progress -->
      <div class="mb-6">
        <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <div class="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <h1 class="text-2xl font-bold text-augusta-800 mb-2">
          Analyzing Your Swing
        </h1>
        <p class="text-augusta-600 mb-4">
          Coach Oliver is reviewing your technique...
        </p>
        
        <!-- Progress Bar -->
        <div class="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div 
            class="bg-blue-600 h-2 rounded-full transition-all duration-500"
            style="width: {progress}%"
          ></div>
        </div>
        <p class="text-sm text-augusta-500">
          {Math.round(progress)}% complete
        </p>
      </div>
      
    {:else if analysisComplete}
      <!-- Analysis Complete -->
      <div class="mb-6">
        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-augusta-800 mb-2">
          Analysis Complete!
        </h1>
        <p class="text-augusta-600">
          Redirecting to your coaching session...
        </p>
      </div>
      
    {:else}
      <!-- Upload Success -->
      <div class="mb-6">
        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-augusta-800 mb-2">
          Upload Successful!
        </h1>
        <p class="text-augusta-600 mb-4">
          Your swing video has been uploaded successfully.
        </p>
        
        <button 
          on:click={startAnalysis}
          class="px-6 py-3 bg-augusta-600 text-white rounded-lg hover:bg-augusta-700 transition-colors"
        >
          Start Analysis
        </button>
      </div>
    {/if}
    
  </div>
</div> 