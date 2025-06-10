<script lang="ts">
  export let variant: 'primary' | 'secondary' | 'accent' | 'glass' | 'gradient' = 'primary';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let disabled = false;
  export let loading = false;
  export let fullWidth = false;
  export let href: string | undefined = undefined;
  export let gradient: string | undefined = undefined;

  $: buttonClass = [
    'inline-flex items-center justify-center font-medium transition-all duration-300',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    // Size variants
    size === 'sm' ? 'px-4 py-2 text-sm rounded-lg' : '',
    size === 'md' ? 'px-6 py-3 text-base rounded-xl' : '',
    size === 'lg' ? 'px-8 py-4 text-lg rounded-xl' : '',
    // Style variants
    variant === 'primary' ? 'btn-primary focus:ring-2 focus:ring-blue-500' : '',
    variant === 'secondary' ? 'btn-secondary focus:ring-2 focus:ring-blue-300' : '',
    variant === 'glass' ? 'glass text-primary-700 hover:glass-sage hover:-translate-y-1 hover:shadow-lg' : '',
    variant === 'gradient' && gradient ? `bg-gradient-to-r ${gradient} text-white hover:-translate-y-1 hover:shadow-lg` : '',
    // State modifiers
    fullWidth ? 'w-full' : '',
    disabled ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5 hover:shadow-lg',
    loading ? 'cursor-wait' : ''
  ].filter(Boolean).join(' ');

  $: tag = href ? 'a' : 'button';
</script>

{#if tag === 'a'}
  <a 
    {href}
    class={buttonClass}
    on:click
    on:keydown
    on:mouseenter
    on:mouseleave
  >
    {#if loading}
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    {/if}
    
    <slot />
    
    {#if $$slots.icon}
      <span class="ml-2">
        <slot name="icon" />
      </span>
    {/if}
  </a>
{:else}
  <button 
    class={buttonClass}
    {disabled}
    on:click
    on:keydown
    on:mouseenter
    on:mouseleave
  >
    {#if loading}
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    {/if}
    
    <slot />
    
    {#if $$slots.icon}
      <span class="ml-2">
        <slot name="icon" />
      </span>
    {/if}
  </button>
{/if}

<style>
  /* Component-specific styles can go here if needed */
</style> 