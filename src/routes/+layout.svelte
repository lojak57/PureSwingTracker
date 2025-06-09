<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  // Initialize app
  onMount(() => {
    if (browser) {
      console.log('Pure Golf App initialized');
    }
  });
</script>

<main class="min-h-screen bg-gray-50">
  <slot />
</main>

<style>
  :global(body) {
    font-family: 'Inter', system-ui, sans-serif;
  }
</style> 