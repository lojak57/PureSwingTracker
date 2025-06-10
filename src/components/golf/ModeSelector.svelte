<!--
  Mode Selector Component - Training vs Quick Fix
  Intelligent mode selection with context-aware recommendations
-->

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { SwingMode } from '$lib/modes/types';
  import { MODE_DISPLAY, MODE_CONFIGS } from '$lib/modes/types';
  import { getRecommendedMode } from '$lib/modes';
  import Button from '../ui/Button.svelte';
  import Card from '../ui/Card.svelte';

  export let selectedMode: SwingMode = 'quick';
  export let context: {
    location?: 'course' | 'range' | 'home';
    hasTriPod?: boolean;
    timeAvailable?: 'quick' | 'normal' | 'extended';
    purpose?: 'practice' | 'lesson' | 'round' | 'social';
  } = {};

  const dispatch = createEventDispatcher<{ modeSelected: { mode: SwingMode } }>();

  // Get intelligent recommendation
  $: recommendedMode = getRecommendedMode(context);
  $: isRecommended = (mode: SwingMode) => mode === recommendedMode;

  function selectMode(mode: SwingMode) {
    selectedMode = mode;
    dispatch('modeSelected', { mode });
  }

  // Context-aware messaging
  $: contextMessage = getContextMessage(context);

  function getContextMessage(ctx: typeof context): string {
    if (ctx.location === 'course') return "On the course? Quick Fix gets you advice in seconds.";
    if (ctx.location === 'range' && ctx.hasTriPod) return "Perfect setup for Training Mode analysis!";
    if (ctx.purpose === 'lesson') return "Training Mode recommended for detailed lesson analysis.";
    if (ctx.timeAvailable === 'quick') return "Short on time? Quick Fix is perfect.";
    return "Choose your analysis style:";
  }
</script>

<div class="space-y-4">
  <!-- Context Message -->
  {#if contextMessage}
    <div class="text-center text-sm text-muted-foreground">
      {contextMessage}
    </div>
  {/if}

  <!-- Mode Selection Grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    
    <!-- Training Mode Card -->
    <Card 
      variant="feature"
      clickable={true}
      hover={true}
      on:click={() => selectMode('training')}
    >
      <div class="p-6">
        <!-- Header with Icon and Recommendation Badge -->
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center space-x-3">
            <span class="text-2xl">{MODE_DISPLAY.training.icon}</span>
            <div>
              <h3 class="font-semibold text-lg">{MODE_DISPLAY.training.name}</h3>
              <p class="text-sm text-muted-foreground">{MODE_DISPLAY.training.subtitle}</p>
            </div>
          </div>
          {#if isRecommended('training')}
            <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
              Recommended
            </span>
          {/if}
        </div>

        <!-- Use Case -->
        <p class="text-sm text-muted-foreground mb-4">
          {MODE_DISPLAY.training.use_case}
        </p>

        <!-- Features List -->
        <ul class="space-y-2 text-sm">
          <li class="flex items-center space-x-2">
            <span class="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
            <span>3-angle deep analysis</span>
          </li>
          <li class="flex items-center space-x-2">
            <span class="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
            <span>Personalized drill recommendations</span>
          </li>
          <li class="flex items-center space-x-2">
            <span class="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
            <span>Updates your long-term stats</span>
          </li>
          <li class="flex items-center space-x-2">
            <span class="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
            <span>~{MODE_CONFIGS.training.processing_time_target}s processing</span>
          </li>
        </ul>

        <!-- Selection Indicator -->
        {#if selectedMode === 'training'}
          <div class="absolute top-4 right-4">
            <div class="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
              <svg class="w-4 h-4 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
            </div>
          </div>
        {/if}
      </div>
    </Card>

    <!-- Quick Fix Mode Card -->
    <Card 
      variant="feature"
      clickable={true}
      hover={true}
      on:click={() => selectMode('quick')}
    >
      <div class="p-6">
        <!-- Header with Icon and Recommendation Badge -->
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center space-x-3">
            <span class="text-2xl">{MODE_DISPLAY.quick.icon}</span>
            <div>
              <h3 class="font-semibold text-lg">{MODE_DISPLAY.quick.name}</h3>
              <p class="text-sm text-muted-foreground">{MODE_DISPLAY.quick.subtitle}</p>
            </div>
          </div>
          {#if isRecommended('quick')}
            <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
              Recommended
            </span>
          {/if}
        </div>

        <!-- Use Case -->
        <p class="text-sm text-muted-foreground mb-4">
          {MODE_DISPLAY.quick.use_case}
        </p>

        <!-- Features List -->
        <ul class="space-y-2 text-sm">
          <li class="flex items-center space-x-2">
            <span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
            <span>Single-angle instant analysis</span>
          </li>
          <li class="flex items-center space-x-2">
            <span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
            <span>Personalized caddy advice</span>
          </li>
          <li class="flex items-center space-x-2">
            <span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
            <span>Perfect for on-course use</span>
          </li>
          <li class="flex items-center space-x-2">
            <span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
            <span>~{MODE_CONFIGS.quick.processing_time_target}s processing</span>
          </li>
        </ul>

        <!-- Selection Indicator -->
        {#if selectedMode === 'quick'}
          <div class="absolute top-4 right-4">
            <div class="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
              <svg class="w-4 h-4 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
            </div>
          </div>
        {/if}
      </div>
    </Card>
  </div>

  <!-- Mode Details -->
  <div class="bg-muted/50 rounded-lg p-4 text-sm">
    <div class="flex items-start space-x-3">
      <span class="text-lg">{MODE_DISPLAY[selectedMode].icon}</span>
      <div>
        <p class="font-medium">{MODE_DISPLAY[selectedMode].name} Selected</p>
        <p class="text-muted-foreground mt-1">
          {#if selectedMode === 'training'}
            Record 3 angles with your tripod for the most detailed analysis and personalized drill recommendations.
          {:else}
            Record a quick swing from any angle to get instant personalized advice - perfect for on-course situations.
          {/if}
        </p>
      </div>
    </div>
  </div>

  <!-- Continue Button -->
  <div class="flex justify-center pt-4">
    <Button 
      variant="primary"
      size="md"
      on:click={() => dispatch('modeSelected', { mode: selectedMode })}
    >
      Continue with {MODE_DISPLAY[selectedMode].name}
      <span class="ml-2">{MODE_DISPLAY[selectedMode].icon}</span>
    </Button>
  </div>
</div>

<style>
  /* Custom styles for selection state */
  :global(.mode-card-selected) {
    @apply ring-2 ring-blue-500 border-blue-500 bg-blue-50;
  }
  
  :global(.mode-card-hover) {
    @apply hover:border-blue-300 hover:shadow-md;
  }
</style> 