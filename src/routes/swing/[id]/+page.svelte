<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  
  let status = 'processing';
  let swingId = '';
  
  let analyzing = false;
  
  onMount(() => {
    swingId = $page.params.id;
    status = $page.url.searchParams.get('status') || 'processing';
    
    // If processing, redirect to dashboard after a moment
    if (status === 'processing') {
      setTimeout(() => {
        goto('/dashboard');
      }, 2000);
    }
  });
  
  async function triggerAnalysis() {
    analyzing = true;
    try {
      const response = await fetch('/api/swings/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Analysis triggered:', result);
        // Redirect to dashboard to see results
        setTimeout(() => goto('/dashboard'), 1000);
      }
    } catch (error) {
      console.error('Failed to trigger analysis:', error);
    } finally {
      analyzing = false;
    }
  }
</script>

<div class="min-h-screen bg-gradient-to-br from-augusta-50 to-augusta-100 flex items-center justify-center">
  <div class="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
    <div class="mb-6">
      <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
      </div>
      <h1 class="text-2xl font-bold text-augusta-800 mb-2">Upload Successful!</h1>
      <p class="text-augusta-600">Your swing video has been uploaded and is being processed.</p>
    </div>
    
    <div class="mb-6">
      <div class="flex items-center justify-center space-x-2 text-sm text-augusta-500">
        <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-augusta-600"></div>
        <span>Processing swing analysis...</span>
      </div>
    </div>
    
    <div class="text-xs text-augusta-400 mb-4">
      Swing ID: {swingId}
    </div>
    
    <p class="text-sm text-augusta-500 mb-4">
      Redirecting to dashboard...
    </p>
    
    <button 
      on:click={triggerAnalysis}
      disabled={analyzing}
      class="px-4 py-2 bg-augusta-600 text-white rounded-lg hover:bg-augusta-700 disabled:opacity-50"
    >
      {analyzing ? 'Analyzing...' : 'Analyze Now'}
    </button>
  </div>
</div> 