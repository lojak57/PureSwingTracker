<!--
  Feature Flag Debug Panel
  Only visible in development mode for testing
-->

<script lang="ts">
  import { onMount } from 'svelte';
  import { featureFlags, enableFeatureFlag, disableFeatureFlag, logFeatureFlags } from '$lib/feature-flags';
  import type { FeatureFlags } from '$lib/feature-flags';
  
  let isDev = false;
  let currentFlags: FeatureFlags = featureFlags;
  let showPanel = false;

  onMount(() => {
    isDev = window.location.hostname === 'localhost';
    if (isDev) {
      logFeatureFlags();
    }
  });

  function toggleFlag(flag: keyof FeatureFlags) {
    if (currentFlags[flag]) {
      disableFeatureFlag(flag);
    } else {
      enableFeatureFlag(flag);
    }
  }

  function refreshFlags() {
    window.location.reload();
  }
</script>

{#if isDev}
  <div class="fixed bottom-4 right-4 z-50">
    <button
      on:click={() => showPanel = !showPanel}
      class="bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg hover:bg-blue-700 text-sm font-medium"
    >
      🏳️ Feature Flags
    </button>

    {#if showPanel}
      <div class="absolute bottom-12 right-0 bg-white border border-gray-200 rounded-lg shadow-xl p-4 min-w-80">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold text-gray-900">Feature Flags</h3>
          <button
            on:click={() => showPanel = false}
            class="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div class="space-y-3">
          {#each Object.entries(currentFlags) as [flag, enabled]}
            <div class="flex items-center justify-between">
              <div>
                <div class="text-sm font-medium text-gray-900">
                  {flag.replace(/([A-Z])/g, ' $1').trim()}
                </div>
                <div class="text-xs text-gray-500">
                  {#if flag === 'useBackendUpload'}
                    Switch between presigned URLs and backend proxy uploads
                  {:else if flag === 'enableQuotaEnforcement'}
                    Enable upload quota limits per user plan
                  {:else if flag === 'enableAdvancedAnalytics'}
                    Enable detailed analytics tracking
                  {/if}
                </div>
              </div>
              
              <button
                on:click={() => toggleFlag(flag as keyof FeatureFlags)}
                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {enabled ? 'bg-blue-600' : 'bg-gray-200'}"
              >
                <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {enabled ? 'translate-x-6' : 'translate-x-1'}"></span>
              </button>
            </div>
          {/each}
        </div>

        <div class="mt-4 pt-3 border-t border-gray-200">
          <div class="text-xs text-gray-500 mb-2">
            Current Mode: <span class="font-mono">{currentFlags.useBackendUpload ? 'Backend Upload' : 'Presigned URLs'}</span>
          </div>
          <button
            on:click={refreshFlags}
            class="w-full text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200"
          >
            🔄 Refresh to Apply Changes
          </button>
        </div>

        <div class="mt-2 text-xs text-gray-400">
          Dev Mode Only - Not visible in production
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  /* Ensure panel is above everything */
  .z-50 {
    z-index: 50;
  }
</style> 