<script lang="ts">
  export let variant: 'glass' | 'glass-sage' | 'glass-gold' | 'feature' | 'stat' = 'glass';
  export let padding: 'sm' | 'md' | 'lg' = 'md';
  export let hover = false;
  export let clickable = false;
  export let accent: string | undefined = undefined;

  $: cardClass = [
    'rounded-2xl transition-all duration-300',
    // Variant styles
    variant === 'glass' ? 'glass' : '',
    variant === 'glass-sage' ? 'glass-sage' : '',
    variant === 'glass-gold' ? 'glass-gold' : '',
    variant === 'feature' ? 'glass shadow-md' : '',
    variant === 'stat' ? 'glass-sage border border-primary-200/30' : '',
    // Padding variants
    padding === 'sm' ? 'p-4' : '',
    padding === 'md' ? 'p-6' : '',
    padding === 'lg' ? 'p-8' : '',
    // Interactive states
    hover ? 'hover:glass-sage hover:-translate-y-1 hover:shadow-xl' : '',
    clickable ? 'cursor-pointer' : '',
    // Border accent
    accent ? `border-l-4 ${accent}` : ''
  ].filter(Boolean).join(' ');
</script>

{#if clickable}
  <button 
    class={cardClass}
    on:click
    on:keydown
    on:mouseenter
    on:mouseleave
  >
    {#if $$slots.header}
      <div class="mb-4">
        <slot name="header" />
      </div>
    {/if}

    <slot />

    {#if $$slots.footer}
      <div class="mt-4 pt-4 border-t border-surface-border/20">
        <slot name="footer" />
      </div>
    {/if}
  </button>
{:else}
  <div 
    class={cardClass}
    on:mouseenter
    on:mouseleave
  >
    {#if $$slots.header}
      <div class="mb-4">
        <slot name="header" />
      </div>
    {/if}

    <slot />

    {#if $$slots.footer}
      <div class="mt-4 pt-4 border-t border-surface-border/20">
        <slot name="footer" />
      </div>
    {/if}
  </div>
{/if}

<style>
  /* Component-specific styles */
</style> 