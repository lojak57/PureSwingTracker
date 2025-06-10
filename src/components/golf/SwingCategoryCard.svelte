<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let id: string;
  export let name: string;
  export let description: string;
  export let icon: string;
  export let gradient: string;
  export let accent: string;
  export let showBothOptions = false;
  export let disabled = false;

  const dispatch = createEventDispatcher<{
    select: { categoryId: string; mode?: 'record' | 'upload' };
  }>();

  function handleClick() {
    if (!disabled) {
      dispatch('select', { categoryId: id });
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if ((event.key === 'Enter' || event.key === ' ') && !disabled) {
      event.preventDefault();
      handleClick();
    }
  }
</script>

<button
  class="swing-category-card glass group hover:glass-sage hover:-translate-y-2 hover:shadow-xl transition-all duration-500 {accent} text-center p-6 w-full {disabled ? 'opacity-50 cursor-not-allowed' : ''}"
  on:click={handleClick}
  on:keydown={handleKeydown}
  {disabled}
>
  <div class="relative">
    <!-- Icon with gradient background -->
    <div class="w-16 h-16 rounded-2xl bg-gradient-to-br {gradient} flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-500">
      <span class="text-3xl" role="img" aria-label={`${name} icon`}>{icon}</span>
    </div>
    
    <!-- Category content -->
    <div class="text-center mb-6">
      <h3 class="text-2xl font-heading font-bold text-onSurface-strong mb-3 group-hover:text-primary-700 transition-colors">
        {name}
      </h3>
      <p class="text-onSurface-medium font-body leading-relaxed">{description}</p>
    </div>
    
    <!-- Call to action -->
    {#if showBothOptions}
      <div class="space-y-3">
        <button
          on:click|stopPropagation={() => dispatch('select', { categoryId: id, mode: 'record' })}
          class="w-full btn-gradient text-sm px-4 py-2 rounded-lg bg-gradient-to-r {gradient} text-white font-semibold shadow-lg hover:shadow-xl transition-shadow"
        >
          📹 Record Now
        </button>
        <button
          on:click|stopPropagation={() => dispatch('select', { categoryId: id, mode: 'upload' })}
          class="w-full btn-gradient text-sm px-4 py-2 rounded-lg bg-gradient-to-r from-gray-500 to-gray-600 text-white font-semibold shadow-lg hover:shadow-xl transition-shadow"
        >
          📁 Upload Files
        </button>
      </div>
    {:else}
      <div class="btn-gradient text-sm px-6 py-3 rounded-xl bg-gradient-to-r {gradient} text-white font-semibold shadow-lg group-hover:shadow-xl transition-shadow">
        Start Recording
      </div>
    {/if}
    
    <!-- Arrow indicator -->
    <svg 
      class="absolute top-6 right-6 w-6 h-6 text-onSurface-light group-hover:text-primary-600 group-hover:translate-x-1 transition-all duration-300" 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
    </svg>
  </div>
</button>

<style>
  .swing-category-card {
    position: relative;
    backdrop-filter: blur(12px);
    background: var(--glass-white);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 1rem;
  }
  
  .swing-category-card:hover {
    backdrop-filter: blur(16px);
    background: var(--glass-sage);
  }
  
  .swing-category-card:focus {
    outline: none;
    ring: 2px;
    ring-color: var(--sage-500);
    ring-offset: 2px;
  }
</style> 