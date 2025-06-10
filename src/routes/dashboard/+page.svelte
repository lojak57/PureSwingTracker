<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { AuthService } from '../../services/auth';
  import type { AuthUser } from '../../services/auth';
  
  // Import our beautiful new components
  import Header from '../../components/layout/Header.svelte';
  import WelcomeHero from '../../components/golf/WelcomeHero.svelte';
  import SwingCategoryCard from '../../components/golf/SwingCategoryCard.svelte';
  import CoachChatButton from '../../components/golf/CoachChatButton.svelte';
  import CoachChatInterface from '../../components/golf/CoachChatInterface.svelte';
  import Card from '../../components/ui/Card.svelte';
  import Button from '../../components/ui/Button.svelte';
  
  let user: AuthUser | null = null;
  let isLoading = true;
  let recentSwings: any[] = [];
  let showCoachChat = false;

  onMount(async () => {
    user = await AuthService.getCurrentUser();
    
    if (!user) {
      goto('/auth/login');
      return;
    }
    
    // TODO: Load recent swings from Supabase
    recentSwings = []; // Placeholder
    isLoading = false;
  });

  const handleLogout = async () => {
    await AuthService.logout();
  };

  const handleCategorySelect = (event: CustomEvent<{ categoryId: string; mode?: 'record' | 'upload' }>) => {
    const { categoryId, mode = 'record' } = event.detail;
    goto(`/swing/record?category=${categoryId}&mode=${mode}`);
  };

  const handleStartChat = () => {
    showCoachChat = true;
  };

  const handleCloseChat = () => {
    showCoachChat = false;
  };

  const swingCategories = [
    { 
      id: 'wood', 
      name: 'Woods', 
      description: 'Driver, 3-wood, 5-wood',
      icon: '🏌️‍♂️',
      gradient: 'from-primary-400 to-primary-600',
      accent: 'border-primary-400'
    },
    { 
      id: 'iron', 
      name: 'Irons', 
      description: '3-9 iron shots',
      icon: '⚡',
      gradient: 'from-accent-400 to-accent-600', 
      accent: 'border-accent-400'
    },
    { 
      id: 'wedge', 
      name: 'Wedges', 
      description: 'PW, SW, LW full swings',
      icon: '🎯',
      gradient: 'from-primary-500 to-accent-500',
      accent: 'border-accent-500'
    },
    { 
      id: 'chip', 
      name: 'Chipping', 
      description: 'Short game around green',
      icon: '🏟️',
      gradient: 'from-primary-300 to-primary-500',
      accent: 'border-primary-300'
    },
    { 
      id: 'putt', 
      name: 'Putting', 
      description: 'Putting stroke analysis',
      icon: '⛳',
      gradient: 'from-accent-300 to-primary-400',
      accent: 'border-accent-300'
    }
  ];
</script>

<svelte:head>
  <title>Dashboard - Pure Golf</title>
</svelte:head>

{#if isLoading}
  <div class="min-h-screen bg-gradient-to-br from-surface to-primary-50 flex items-center justify-center">
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
  </div>
{:else if user}
  <div class="min-h-screen bg-gradient-to-br from-surface via-primary-50 to-accent-50">
    <!-- Beautiful Componentized Header -->
    <Header 
      userEmail={user.user_metadata?.name || user.email}
      on:logout={handleLogout}
    />

    <main class="container py-12">
      <!-- Welcome Hero Component -->
      <div class="mb-16">
        <WelcomeHero 
          title="Ready to improve your swing?"
          subtitle="Choose a club category to start recording your three-angle swing analysis."
        />
      </div>

      <!-- Coach Oliver Chat Button -->
      <div class="mb-16">
        <CoachChatButton on:startChat={handleStartChat} />
      </div>

      <!-- Swing Categories - Now Componentized! -->
      <div class="mb-20">
        <h3 class="text-3xl font-heading font-bold text-onSurface-strong mb-8 text-center">Record New Swing</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {#each swingCategories as category}
            <SwingCategoryCard 
              id={category.id}
              name={category.name}
              description={category.description}
              icon={category.icon}
              gradient={category.gradient}
              accent={category.accent}
              showBothOptions={true}
              on:select={handleCategorySelect}
            />
          {/each}
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="mb-16">
        <div class="flex items-center justify-between mb-8">
          <h3 class="text-3xl font-heading font-bold text-onSurface-strong">Recent Swings</h3>
          <a href="/history" class="text-primary-600 hover:text-primary-700 font-medium transition-colors flex items-center space-x-2">
            <span>View all</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
        
        {#if recentSwings.length === 0}
          <div class="glass-gold rounded-3xl p-12 text-center border-2 border-accent-200/40">
            <div class="w-20 h-20 glass-sage rounded-3xl flex items-center justify-center mx-auto mb-6">
              <svg class="w-10 h-10 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h4 class="text-2xl font-heading font-bold text-onSurface-strong mb-4">No swings recorded yet</h4>
            <p class="text-lg text-onSurface-medium font-body mb-8 max-w-md mx-auto leading-relaxed">
              Start by recording your first swing analysis above. Choose your club category and we'll guide you through the process.
            </p>
            <Button 
              variant="primary"
              size="lg"
              on:click={() => goto('/swing/record?category=iron')}
            >
              Record Your First Swing
            </Button>
          </div>
        {:else}
          <div class="grid gap-6">
            {#each recentSwings as swing}
              <div class="glass rounded-2xl p-6 hover:glass-sage hover:-translate-y-1 transition-all duration-normal group">
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-4">
                    <div class="w-16 h-16 glass-gold rounded-2xl flex items-center justify-center">
                      <span class="text-primary-700 font-bold text-sm">{swing.category.toUpperCase()}</span>
                    </div>
                    <div>
                      <h4 class="text-xl font-heading font-bold text-onSurface-strong">{swing.category} Swing</h4>
                      <p class="text-onSurface-medium font-body">{swing.created_at}</p>
                    </div>
                  </div>
                  <div class="flex items-center space-x-4">
                    {#if swing.ai_summary}
                      <span class="status-badge status-success">
                        Analyzed
                      </span>
                    {:else}
                      <span class="status-badge status-warning">
                        Processing
                      </span>
                    {/if}
                    <button class="text-primary-600 hover:text-primary-700 font-medium transition-colors flex items-center space-x-2">
                      <span>View Details</span>
                      <svg class="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Augusta-Style Quick Navigation -->
      <div class="mt-20">
        <h3 class="text-3xl font-heading font-bold text-onSurface-strong mb-8 text-center">Your Golf Journey</h3>
        <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <!-- Round Tracker - NEW! -->
          <a href="/rounds" class="drill-card group">
            <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-slow">
              <svg class="w-8 h-8 text-surface" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m-6 3l6-3" />
              </svg>
            </div>
            <h4 class="text-2xl font-heading font-bold text-onSurface-strong mb-3 group-hover:text-primary-700 transition-colors">Track Rounds</h4>
            <p class="text-onSurface-medium font-body leading-relaxed">GPS-powered round tracking with AI caddy recommendations</p>
          </a>

          <a href="/drills" class="drill-card group">
            <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-slow">
              <svg class="w-8 h-8 text-surface" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h4 class="text-2xl font-heading font-bold text-onSurface-strong mb-3 group-hover:text-primary-700 transition-colors">Practice Drills</h4>
            <p class="text-onSurface-medium font-body leading-relaxed">Browse personalized drills to improve your swing mechanics</p>
          </a>

          <a href="/progress" class="drill-card group">
            <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-slow">
              <svg class="w-8 h-8 text-surface" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h4 class="text-2xl font-heading font-bold text-onSurface-strong mb-3 group-hover:text-primary-700 transition-colors">Track Progress</h4>
            <p class="text-onSurface-medium font-body leading-relaxed">View your improvement journey over time with detailed analytics</p>
          </a>

          <a href="/profile" class="drill-card group">
            <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-300 to-primary-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-slow">
              <svg class="w-8 h-8 text-surface" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h4 class="text-2xl font-heading font-bold text-onSurface-strong mb-3 group-hover:text-primary-700 transition-colors">Profile Settings</h4>
            <p class="text-onSurface-medium font-body leading-relaxed">Update your handicap, goals, and personalization preferences</p>
          </a>
        </div>
      </div>
    </main>
  </div>

  <!-- Coach Oliver Chat Interface -->
  {#if showCoachChat && user}
    <CoachChatInterface 
      swingId={null}
      userEmail={user.user_metadata?.name || user.email}
      on:close={handleCloseChat}
    />
  {/if}
{/if} 