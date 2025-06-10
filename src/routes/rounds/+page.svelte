<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { currentRound, isRoundActive, roundActions, currentHole } from '../../stores/roundStore';
  import RoundSetup from '../../components/rounds/RoundSetup.svelte';
  import HoleView from '../../components/rounds/HoleView.svelte';
  import Button from '../../components/ui/Button.svelte';
  import Card from '../../components/ui/Card.svelte';
  import type { Round, Shot } from '../../stores/roundStore';

  let showSetup = false;
  let showHoleView = false;
  let loading = false;
  let rounds: Round[] = [];
  let error: string | null = null;

  onMount(() => {
    loadRounds();
  });

  async function loadRounds() {
    loading = true;
    error = null;

    try {
      // This would be an API call to get user's rounds
      // For now, we'll just initialize empty
      rounds = [];
    } catch (err) {
      error = 'Failed to load rounds';
      console.error('Error loading rounds:', err);
    } finally {
      loading = false;
    }
  }

  function handleRoundStarted(event: CustomEvent<{ round: Round }>) {
    const { round } = event.detail;
    
    // Hide setup modal
    showSetup = false;
    
    // Navigate to active round
    goto(`/rounds/${round.id}`);
  }

  function handleSetupCancel() {
    showSetup = false;
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'abandoned':
        return 'bg-gray-100 text-gray-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function continueRound(round: Round) {
    roundActions.setRound(round);
    showHoleView = true;
  }

  async function handleShotRecorded(event: CustomEvent<{ shot: Shot }>) {
    const { shot } = event.detail;
    
    try {
      // Call API to persist the shot
      const response = await fetch('/api/shots/record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        },
        body: JSON.stringify(shot)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to record shot');
      }

      console.log('Shot recorded successfully');
    } catch (err) {
      console.error('Error recording shot:', err);
      error = 'Failed to save shot. Please try again.';
    }
  }

  function handleCaddyAdvice(event: CustomEvent<{ distance: number; holeNumber: number }>) {
    const { distance, holeNumber } = event.detail;
    
    // This would call the AI caddy endpoint
    console.log(`Caddy advice requested for hole ${holeNumber}, distance ${distance}y`);
    
    // For now, just show a mock recommendation
    alert(`AI Caddy Recommendation for ${distance}y:\n\nRecommended club: 7-Iron\nAim for center of green\nConsider wind conditions`);
  }
</script>

<svelte:head>
  <title>Rounds - Pure Golf</title>
</svelte:head>

{#if showSetup}
  <!-- Round Setup Modal Overlay -->
  <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-lg max-w-4xl w-full max-h-screen overflow-y-auto">
      <div class="p-6">
        <RoundSetup 
          on:roundStarted={handleRoundStarted}
          on:cancel={handleSetupCancel}
        />
      </div>
    </div>
  </div>
{/if}

<div class="max-w-4xl mx-auto space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-display text-augusta-900">Golf Rounds</h1>
      <p class="text-augusta-600 mt-1">Track your rounds and improve your game</p>
    </div>
    <Button variant="primary" on:click={() => showSetup = true}>
      Start New Round
    </Button>
  </div>

  {#if error}
    <div class="glass-white border border-red-200 rounded-lg p-4">
      <div class="flex items-center space-x-2">
        <span class="text-red-600">⚠️</span>
        <span class="text-red-800">{error}</span>
      </div>
    </div>
  {/if}

  <!-- Active Round -->
  {#if $isRoundActive && $currentRound}
    {#if showHoleView}
      <!-- Hole View for Active Round -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h1 class="text-3xl font-display text-augusta-900">
              {$currentRound.course?.name || 'Unknown Course'}
            </h1>
            <p class="text-augusta-600">Hole {$currentHole} • {$currentRound.tee_set} tees</p>
          </div>
          <Button variant="secondary" on:click={() => showHoleView = false}>
            ← Round Overview
          </Button>
        </div>
        <HoleView 
          on:shotRecorded={handleShotRecorded}
          on:requestCaddyAdvice={handleCaddyAdvice}
        />
      </div>
    {:else}
      <!-- Round Overview -->
      <Card variant="glass-sage">
        <div class="flex items-center justify-between">
          <div>
            <div class="flex items-center space-x-2 mb-2">
              <h2 class="text-xl font-heading text-augusta-900">Current Round</h2>
              <span class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                In Progress
              </span>
            </div>
            <p class="text-augusta-700 font-medium">{$currentRound.course?.name || 'Course'}</p>
            <p class="text-sm text-augusta-600">
              Started {formatDate($currentRound.started_at)} • {$currentRound.tee_set} tees • Hole {$currentHole}
            </p>
          </div>
          <div class="text-right">
            <Button variant="primary" on:click={() => continueRound($currentRound)}>
              Continue Round
            </Button>
          </div>
        </div>
      </Card>
    {/if}
  {/if}

  <!-- Quick Stats -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <Card>
      <div class="text-center">
        <div class="text-2xl font-display text-augusta-900">12</div>
        <div class="text-sm text-augusta-600">Rounds Played</div>
      </div>
    </Card>
    <Card>
      <div class="text-center">
        <div class="text-2xl font-display text-augusta-900">85.2</div>
        <div class="text-sm text-augusta-600">Average Score</div>
      </div>
    </Card>
    <Card>
      <div class="text-center">
        <div class="text-2xl font-display text-augusta-900">14.5</div>
        <div class="text-sm text-augusta-600">Current Handicap</div>
      </div>
    </Card>
  </div>

  <!-- Recent Rounds -->
  <Card>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-heading text-augusta-900">Recent Rounds</h2>
      <Button variant="secondary" size="sm">
        View All
      </Button>
    </div>

    {#if loading}
      <div class="flex items-center justify-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-2 border-augusta-300 border-t-augusta-600"></div>
      </div>
    {:else if rounds.length === 0}
      <div class="text-center py-8">
        <div class="text-4xl mb-4">🏌️‍♂️</div>
        <h3 class="text-lg font-medium text-augusta-900 mb-2">No rounds yet</h3>
        <p class="text-augusta-600 mb-4">Start tracking your golf rounds to see insights and improvement</p>
        <Button variant="primary" on:click={() => showSetup = true}>
          Play Your First Round
        </Button>
      </div>
    {:else}
      <div class="space-y-3">
        {#each rounds as round}
          <div class="flex items-center justify-between p-3 rounded-lg border border-augusta-200 hover:border-augusta-300 transition-colors">
            <div class="flex-1">
              <div class="flex items-center space-x-3">
                <div>
                  <h3 class="font-medium text-augusta-900">{round.course?.name || 'Unknown Course'}</h3>
                  <div class="flex items-center space-x-2 text-sm text-augusta-600">
                    <span>{formatDate(round.started_at)}</span>
                    <span>•</span>
                    <span>{round.tee_set} tees</span>
                    {#if round.total_score}
                      <span>•</span>
                      <span>Score: {round.total_score}</span>
                    {/if}
                  </div>
                </div>
              </div>
            </div>
            <div class="flex items-center space-x-3">
              <span class="px-2 py-1 text-xs rounded-full {getStatusBadgeClass(round.status)}">
                {round.status.replace('_', ' ')}
              </span>
              <Button variant="secondary" size="sm" on:click={() => goto(`/rounds/${round.id}`)}>
                View
              </Button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </Card>

  <!-- Getting Started -->
  {#if rounds.length === 0 && !$isRoundActive}
    <Card variant="glass-gold">
      <div class="flex items-start space-x-4">
        <div class="text-4xl">🚀</div>
        <div class="flex-1">
          <h3 class="text-lg font-heading text-augusta-900 mb-2">Ready to improve your game?</h3>
          <p class="text-augusta-700 mb-4">
            Pure Golf's Round Tracker with AI Caddy helps you make smarter decisions on every shot. 
            Get personalized club recommendations based on your swing tendencies and course conditions.
          </p>
          <div class="space-y-2 text-sm text-augusta-600">
            <div class="flex items-center space-x-2">
              <span>📱</span>
              <span>GPS-powered distance measurement</span>
            </div>
            <div class="flex items-center space-x-2">
              <span>🤖</span>
              <span>AI club recommendations for every lie</span>
            </div>
            <div class="flex items-center space-x-2">
              <span>📊</span>
              <span>Track your progress over time</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  {/if}
</div> 