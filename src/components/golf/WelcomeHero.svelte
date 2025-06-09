<script lang="ts">
  export let title: string;
  export let subtitle: string;
  export let centered = true;
</script>

<div class="glass-sage rounded-3xl p-12 border-2 border-primary-200/30 {centered ? 'text-center' : ''}">
  <h2 class="text-5xl font-display font-bold text-gradient-primary mb-6">
    {title}
  </h2>
  <p class="text-xl text-onSurface-medium font-body max-w-2xl {centered ? 'mx-auto' : ''} leading-relaxed">
    {subtitle}
  </p>
  
  {#if $$slots.default}
    <div class="mt-8">
      <slot />
    </div>
  {/if}
</div>

<style>
  .glass-sage {
    backdrop-filter: blur(12px);
    background: var(--glass-sage);
    border: 1px solid rgba(122, 184, 148, 0.25);
  }
</style> 