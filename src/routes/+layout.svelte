<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import FeatureFlagDebug from '../components/ui/FeatureFlagDebug.svelte';
  
  // Initialize app
  onMount(() => {
    if (browser) {
      console.log('Pure Golf App initialized');
    }
  });
</script>

<main class="min-h-screen bg-gradient-to-br from-surface via-primary-50 to-accent-50">
  <slot />
</main>

<!-- Feature Flag Debug Panel (dev only) -->
<FeatureFlagDebug />

<style>
  :global(body) {
    font-family: var(--font-body), 'Inter', system-ui, sans-serif;
  }
</style> 