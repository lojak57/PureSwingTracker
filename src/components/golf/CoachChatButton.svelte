<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '../ui/Button.svelte';
  
  export let disabled = false;
  export let variant: 'primary' | 'feature' = 'feature';

  const dispatch = createEventDispatcher<{
    startChat: void;
  }>();

  function handleChatClick() {
    if (!disabled) {
      dispatch('startChat');
    }
  }
</script>

<div class="glass-gold rounded-3xl p-8 text-center border-2 border-accent-200/40 group hover:glass-sage hover:-translate-y-1 transition-all duration-500">
  <!-- Coach Oliver Avatar -->
  <div class="w-20 h-20 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-500">
    <span class="text-4xl" role="img" aria-label="Coach Oliver">🏌️‍♂️</span>
  </div>
  
  <!-- Title & Description -->
  <h3 class="text-3xl font-heading font-bold text-onSurface-strong mb-4">
    Chat with Coach Oliver
  </h3>
  <p class="text-lg text-onSurface-medium font-body mb-6 max-w-md mx-auto leading-relaxed">
    Get personalized golf advice, discuss your game, or learn about swing fundamentals. Available 24/7.
  </p>
  
  <!-- Features List -->
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8 text-sm text-onSurface-medium">
    <div class="flex items-center justify-center space-x-2">
      <svg class="w-4 h-4 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      <span>Swing Analysis</span>
    </div>
    <div class="flex items-center justify-center space-x-2">
      <svg class="w-4 h-4 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      <span>Practice Drills</span>
    </div>
    <div class="flex items-center justify-center space-x-2">
      <svg class="w-4 h-4 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      <span>Course Strategy</span>
    </div>
    <div class="flex items-center justify-center space-x-2">
      <svg class="w-4 h-4 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      <span>Equipment Tips</span>
    </div>
  </div>
  
  <!-- Chat Button -->
  <Button
    variant="gradient"
    gradient="from-accent-400 to-accent-600"
    size="lg"
    {disabled}
    on:click={handleChatClick}
  >
    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
    Start Conversation
  </Button>
  
  <!-- Availability Badge -->
  <div class="mt-4 flex items-center justify-center space-x-2 text-xs text-onSurface-light">
    <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
    <span>Available Now</span>
  </div>
</div>

<style>
  .glass-gold {
    backdrop-filter: blur(8px);
    background: var(--glass-gold);
    border: 1px solid rgba(242, 205, 55, 0.3);
  }
  
  .glass-gold:hover {
    backdrop-filter: blur(12px);
    background: var(--glass-sage);
  }
</style> 