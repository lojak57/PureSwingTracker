<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { currentRound, currentHole, currentHoleData, currentShots, roundActions } from '../../stores/roundStore';
  import { getDistanceToPin, getMockPinPosition, formatDistance, type DistanceResult, type GPSPosition } from '$lib/utils/gps';
  import Button from '../ui/Button.svelte';
  import Card from '../ui/Card.svelte';
  import type { Shot } from '../../stores/roundStore';

  const dispatch = createEventDispatcher<{
    shotRecorded: { shot: Shot };
    requestCaddyAdvice: { distance: number; holeNumber: number };
  }>();

  // Component state
  let distanceToPin: DistanceResult | null = null;
  let gpsLoading = false;
  let gpsError: string | null = null;
  let distanceInterval: ReturnType<typeof setInterval> | null = null;

  // Shot recording state
  let recordingShot = false;
  let selectedClub = '';
  let shotResult = '';
  let shotDistance = '';
  let shotNotes = '';

  // Available clubs (this could come from user preferences later)
  const clubs = [
    'Driver', '3-Wood', '5-Wood', '7-Wood',
    '2-Iron', '3-Iron', '4-Iron', '5-Iron', '6-Iron', '7-Iron', '8-Iron', '9-Iron',
    'PW', 'GW', 'SW', 'LW',
    'Putter'
  ];

  const shotResults = [
    { value: 'green', label: '🎯 Green in Regulation' },
    { value: 'fairway', label: '✅ Fairway' },
    { value: 'rough', label: '🌿 Rough' },
    { value: 'sand', label: '🏖️ Sand/Bunker' },
    { value: 'water', label: '💧 Water Hazard' },
    { value: 'trees', label: '🌲 Trees' },
    { value: 'oob', label: '🚫 Out of Bounds' },
    { value: 'holed', label: '⛳ Holed Out' }
  ];

  onMount(() => {
    updateDistance();
    startDistanceTracking();
  });

  onDestroy(() => {
    if (distanceInterval) {
      clearInterval(distanceInterval);
    }
  });

  async function updateDistance() {
    if (!$currentRound?.course || !$currentHole) return;

    gpsLoading = true;
    gpsError = null;

    try {
      // In production, you'd get actual pin position from course data
      // For now, use mock data
      const pinPosition = getMockPinPosition($currentRound.course.id, $currentHole);
      
      if (pinPosition) {
        const distance = await getDistanceToPin(pinPosition);
        distanceToPin = distance;
      } else {
        gpsError = 'Pin position not available';
      }
    } catch (error) {
      gpsError = error instanceof Error ? error.message : 'GPS error';
      console.error('Error updating distance:', error);
    } finally {
      gpsLoading = false;
    }
  }

  function startDistanceTracking() {
    // Update distance every 10 seconds during active round
    distanceInterval = setInterval(updateDistance, 10000);
  }

  function nextHole() {
    roundActions.nextHole();
    updateDistance();
  }

  function previousHole() {
    roundActions.previousHole();
    updateDistance();
  }

  function startShotRecording() {
    recordingShot = true;
    selectedClub = '';
    shotResult = '';
    shotDistance = '';
    shotNotes = '';
  }

  function cancelShotRecording() {
    recordingShot = false;
  }

  async function recordShot() {
    if (!$currentRound || !selectedClub || !shotResult) return;

    const shotNumber = $currentShots.length + 1;
    
    const shot: Shot = {
      round_id: $currentRound.id,
      hole_number: $currentHole,
      shot_number: shotNumber,
      club_used: selectedClub,
      shot_result: shotResult,
      distance_achieved: shotDistance ? parseInt(shotDistance) : undefined,
      distance_to_target: distanceToPin?.yards
    };

    try {
      // Add to store
      roundActions.addShot(shot);
      
      // Dispatch event for parent to handle API call
      dispatch('shotRecorded', { shot });
      
      // Reset form
      recordingShot = false;
      
      // If shot was holed out, suggest moving to next hole
      if (shotResult === 'holed') {
        setTimeout(() => {
          if (confirm('Great shot! Move to next hole?')) {
            nextHole();
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error recording shot:', error);
    }
  }

  function requestCaddyAdvice() {
    if (!distanceToPin || !$currentHole) return;
    
    dispatch('requestCaddyAdvice', {
      distance: distanceToPin.yards,
      holeNumber: $currentHole
    });
  }

  function formatHoleYardage(hole: any, teeSet: string): string {
    if (!hole?.yardages?.[teeSet]) return 'N/A';
    return `${hole.yardages[teeSet]}y`;
  }

  function getParDisplay(par: number): string {
    const parEmojis = { 3: '🐦', 4: '🎯', 5: '🦅' };
    return `Par ${par} ${parEmojis[par as keyof typeof parEmojis] || '⛳'}`;
  }
</script>

<div class="space-y-6">
  <!-- Hole Header -->
  {#if $currentHoleData && $currentRound}
    <Card variant="glass-sage">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="text-2xl font-display text-augusta-900">
            Hole {$currentHole}
          </h1>
          <p class="text-augusta-600">
            {getParDisplay($currentHoleData.par)} • 
            {formatHoleYardage($currentHoleData, $currentRound.tee_set)}
          </p>
          {#if $currentHoleData.description}
            <p class="text-sm text-augusta-600 mt-1">{$currentHoleData.description}</p>
          {/if}
        </div>
        
        <div class="flex space-x-2">
          <Button 
            variant="secondary" 
            size="sm"
            on:click={previousHole}
            disabled={$currentHole <= 1}
          >
            ← Prev
          </Button>
          <Button 
            variant="secondary" 
            size="sm"
            on:click={nextHole}
            disabled={$currentHole >= ($currentRound.course?.holes?.length || 18)}
          >
            Next →
          </Button>
        </div>
      </div>

      <!-- Distance to Pin -->
      <div class="bg-white bg-opacity-50 rounded-lg p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-augusta-600">Distance to Pin</p>
            {#if gpsLoading}
              <div class="flex items-center space-x-2">
                <div class="animate-spin rounded-full h-4 w-4 border-2 border-augusta-300 border-t-augusta-600"></div>
                <span class="text-lg font-display text-augusta-900">Calculating...</span>
              </div>
            {:else if gpsError}
              <p class="text-red-600 text-sm">{gpsError}</p>
              <Button variant="secondary" size="sm" on:click={updateDistance}>
                Retry GPS
              </Button>
            {:else if distanceToPin}
              <p class="text-2xl font-display text-augusta-900">
                {formatDistance(distanceToPin)}
              </p>
            {:else}
              <p class="text-augusta-600">Distance unavailable</p>
            {/if}
          </div>
          
          <div class="text-right space-y-2">
            <Button 
              variant="primary" 
              on:click={updateDistance}
              disabled={gpsLoading}
            >
              📍 Update GPS
            </Button>
                         {#if distanceToPin}
               <Button 
                 variant="accent" 
                 on:click={requestCaddyAdvice}
               >
                 🤖 Get Caddy Advice
               </Button>
             {/if}
          </div>
        </div>
      </div>
    </Card>
  {/if}

  <!-- Current Shots -->
  {#if $currentShots.length > 0}
    <Card>
      <h2 class="text-lg font-heading text-augusta-900 mb-3">Shots on Hole {$currentHole}</h2>
      <div class="space-y-2">
        {#each $currentShots as shot, index}
          <div class="flex items-center justify-between p-3 bg-augusta-50 rounded-lg">
            <div>
              <span class="font-medium text-augusta-900">Shot {shot.shot_number}</span>
              <span class="text-augusta-600">• {shot.club_used}</span>
              {#if shot.distance_achieved}
                <span class="text-augusta-600">• {shot.distance_achieved}y</span>
              {/if}
            </div>
            <div class="text-sm text-augusta-600">
              {shotResults.find(r => r.value === shot.shot_result)?.label || shot.shot_result}
            </div>
          </div>
        {/each}
      </div>
    </Card>
  {/if}

  <!-- Record Shot -->
  <Card>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-heading text-augusta-900">Record Shot</h2>
      {#if !recordingShot}
        <Button variant="primary" on:click={startShotRecording}>
          + Add Shot
        </Button>
      {/if}
    </div>

    {#if recordingShot}
      <div class="space-y-4">
        <!-- Club Selection -->
        <div>
          <label class="block text-sm font-medium text-augusta-700 mb-2">Club Used</label>
          <div class="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {#each clubs as club}
              <button
                type="button"
                class="p-2 text-sm rounded-lg border transition-all
                  {selectedClub === club 
                    ? 'border-sage-500 bg-sage-50 text-sage-900' 
                    : 'border-augusta-200 hover:border-augusta-300'}"
                on:click={() => selectedClub = club}
              >
                {club}
              </button>
            {/each}
          </div>
        </div>

        <!-- Shot Result -->
        <div>
          <label class="block text-sm font-medium text-augusta-700 mb-2">Shot Result</label>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {#each shotResults as result}
              <button
                type="button"
                class="p-2 text-sm rounded-lg border transition-all text-left
                  {shotResult === result.value 
                    ? 'border-sage-500 bg-sage-50' 
                    : 'border-augusta-200 hover:border-augusta-300'}"
                on:click={() => shotResult = result.value}
              >
                {result.label}
              </button>
            {/each}
          </div>
        </div>

        <!-- Optional Details -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-augusta-700 mb-1">Distance (yards)</label>
            <input
              type="number"
              placeholder="150"
              bind:value={shotDistance}
              class="w-full px-3 py-2 border border-augusta-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500"
            />
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex space-x-3">
          <Button variant="secondary" on:click={cancelShotRecording}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            on:click={recordShot}
            disabled={!selectedClub || !shotResult}
          >
            Record Shot
          </Button>
        </div>
      </div>
    {:else}
      <p class="text-augusta-600 text-center py-4">
        No shots recorded for this hole yet
      </p>
    {/if}
  </Card>
</div> 