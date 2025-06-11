<!-- src/components/golf/SwingMetrics.svelte -->
<script lang="ts">
  export let swing: any;
  export let metrics: any;
  
  $: tempoColor = getTempoColor(metrics?.tempo_ratio);
  $: planeColor = getPlaneColor(metrics?.plane_delta);
  
  function getTempoColor(ratio: number | null | undefined): string {
    if (!ratio) return 'text-gray-400';
    if (ratio >= 2.8 && ratio <= 3.2) return 'text-emerald-500';
    if (ratio >= 2.5 && ratio <= 3.5) return 'text-yellow-500';
    return 'text-red-500';
  }
  
  function getPlaneColor(delta: number | null | undefined): string {
    if (!delta) return 'text-gray-400';
    if (Math.abs(delta) <= 2) return 'text-emerald-500';
    if (Math.abs(delta) <= 5) return 'text-yellow-500';
    return 'text-red-500';
  }

  function getHipColor(sway: number | null | undefined): string {
    if (!sway) return 'text-gray-400';
    if (sway <= 4) return 'text-emerald-500';
    return 'text-red-500';
  }
</script>

<div class="glass p-4 rounded-xl space-y-3">
  <h3 class="text-lg font-semibold mb-3 flex items-center">
    <span class="mr-2">📊</span>
    Swing Metrics
    {#if metrics?.cached}
      <span class="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">Cached</span>
    {/if}
  </h3>
  
  {#if !metrics}
    <div class="animate-pulse space-y-3">
      <div class="h-4 bg-gray-200 rounded w-3/4"></div>
      <div class="grid grid-cols-2 gap-4">
        <div class="h-16 bg-gray-200 rounded"></div>
        <div class="h-16 bg-gray-200 rounded"></div>
        <div class="h-16 bg-gray-200 rounded"></div>
        <div class="h-16 bg-gray-200 rounded"></div>
      </div>
      <p class="text-sm text-gray-500 text-center">Analyzing swing biomechanics...</p>
    </div>
  {:else}
    <div class="grid grid-cols-2 gap-4">
      <!-- Tempo Ratio -->
      <div class="text-center">
        <div class="text-2xl font-bold {tempoColor}">
          {metrics.tempo_ratio?.toFixed(1) || '--'}
        </div>
        <div class="text-sm text-gray-600">Tempo Ratio</div>
        <div class="text-xs text-gray-500">ideal: 3.0</div>
      </div>
      
      <!-- Swing Plane -->
      <div class="text-center">
        <div class="text-2xl font-bold {planeColor}">
          {metrics.plane_delta ? `${metrics.plane_delta > 0 ? '+' : ''}${metrics.plane_delta.toFixed(1)}°` : '--'}
        </div>
        <div class="text-sm text-gray-600">Swing Plane</div>
        <div class="text-xs text-gray-500">{metrics.plane_delta > 0 ? 'steep' : 'shallow'}</div>
      </div>
      
      <!-- Hip Sway -->
      <div class="text-center">
        <div class="text-2xl font-bold {getHipColor(metrics.hip_sway_cm)}">
          {metrics.hip_sway_cm?.toFixed(1) || '--'}cm
        </div>
        <div class="text-sm text-gray-600">Hip Sway</div>
        <div class="text-xs text-gray-500">{metrics.hip_sway_cm > 4 ? 'sliding' : 'stable'}</div>
      </div>
      
      <!-- X-Factor (Range mode only) -->
      {#if swing?.swing_mode === 'range' && metrics?.x_factor}
        <div class="text-center">
          <div class="text-2xl font-bold text-blue-500">
            {metrics.x_factor.toFixed(0)}°
          </div>
          <div class="text-sm text-gray-600">X-Factor</div>
          <div class="text-xs text-gray-500">separation</div>
        </div>
      {:else}
        <!-- Confidence Score -->
        <div class="text-center">
          <div class="text-2xl font-bold text-blue-500">
            {metrics.confidence ? `${(metrics.confidence * 100).toFixed(0)}%` : '--'}
          </div>
          <div class="text-sm text-gray-600">Confidence</div>
          <div class="text-xs text-gray-500">analysis accuracy</div>
        </div>
      {/if}
    </div>
    
    <!-- Processing Info -->
    {#if metrics.processing_time_ms}
      <div class="mt-4 pt-3 border-t border-gray-200">
        <div class="text-xs text-gray-500 text-center">
          Processed in {(metrics.processing_time_ms / 1000).toFixed(1)}s
          {#if metrics.cached}• Retrieved from cache{/if}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .glass {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
</style> 