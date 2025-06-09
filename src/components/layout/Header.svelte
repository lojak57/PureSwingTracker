<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '../ui/Button.svelte';
  
  export let title = 'Pure';
  export let subtitle: string | undefined = undefined;
  export let userEmail: string | undefined = undefined;
  export let showBackButton = false;
  export let backLabel = 'Back';

  const dispatch = createEventDispatcher<{
    logout: void;
    back: void;
  }>();

  function handleLogout() {
    dispatch('logout');
  }

  function handleBack() {
    dispatch('back');
  }

  function handleKeydown(event: KeyboardEvent) {
    if ((event.key === 'Enter' || event.key === ' ') && showBackButton) {
      event.preventDefault();
      handleBack();
    }
  }
</script>

<header class="glass-nav sticky top-0 z-50 border-b border-surface-border/30">
  <div class="container">
    <div class="flex justify-between items-center h-20">
      <!-- Left side - Title and subtitle -->
      <div class="flex items-center space-x-4">
        {#if showBackButton}
          <button
            class="text-onSurface-medium hover:text-primary-600 transition-colors p-2 rounded-lg hover:bg-primary-100/20"
            on:click={handleBack}
            on:keydown={handleKeydown}
            aria-label={backLabel}
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        {/if}
        
        <h1 class="text-3xl font-display font-bold text-gradient-primary">{title}</h1>
        
        {#if subtitle}
          <div class="hidden sm:block h-6 w-px bg-surface-border/50"></div>
          <p class="hidden sm:block text-onSurface font-body">{subtitle}</p>
        {/if}
      </div>
      
      <!-- Right side - User info and actions -->
      <div class="flex items-center space-x-4">
        {#if userEmail}
          <div class="hidden md:block text-right">
            <p class="text-sm text-onSurface-medium">Welcome,</p>
            <p class="text-sm text-onSurface font-medium">{userEmail}</p>
          </div>
        {/if}
        
        <div class="flex items-center space-x-2">
          <slot name="actions" />
          
          {#if userEmail}
            <Button
              variant="secondary"
              size="sm"
              on:click={handleLogout}
            >
              Sign out
            </Button>
          {/if}
        </div>
      </div>
    </div>
    
    <!-- Mobile subtitle -->
    {#if subtitle}
      <div class="sm:hidden pb-3">
        <p class="text-onSurface-medium font-body text-sm">{subtitle}</p>
      </div>
    {/if}
  </div>
</header>

<style>
  .glass-nav {
    backdrop-filter: blur(20px);
    background: rgba(255, 255, 255, 0.8);
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  /* Responsive design for smaller screens */
  @media (max-width: 640px) {
    .container {
      padding-left: 1rem;
      padding-right: 1rem;
    }
  }
</style> 