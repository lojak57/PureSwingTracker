<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  
  onMount(() => {
    // Get category from URL params and redirect to record page with upload mode
    const categoryParam = $page.url.searchParams.get('category');
    if (categoryParam && ['wood', 'iron', 'wedge', 'chip', 'putt'].includes(categoryParam)) {
      goto(`/swing/record?category=${categoryParam}&mode=upload`);
    } else {
      goto('/dashboard');
    }
  });
</script>

<svelte:head>
  <title>Upload Swing - Pure Golf</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 flex items-center justify-center">
  <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
</div> 