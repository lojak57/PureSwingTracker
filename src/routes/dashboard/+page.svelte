<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { AuthService } from '../../services/auth';
  import type { AuthUser } from '../../services/auth';
  
  let user: AuthUser | null = null;
  let isLoading = true;
  let recentSwings: any[] = [];

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

  const startNewSwing = (category: string) => {
    goto(`/swing/record?category=${category}`);
  };

  const swingCategories = [
    { 
      id: 'wood', 
      name: 'Woods', 
      description: 'Driver, 3-wood, 5-wood',
      icon: '🏌️‍♂️',
      color: 'bg-blue-100 text-blue-700'
    },
    { 
      id: 'iron', 
      name: 'Irons', 
      description: '3-9 iron shots',
      icon: '⚡',
      color: 'bg-green-100 text-green-700'
    },
    { 
      id: 'wedge', 
      name: 'Wedges', 
      description: 'PW, SW, LW full swings',
      icon: '🎯',
      color: 'bg-yellow-100 text-yellow-700'
    },
    { 
      id: 'chip', 
      name: 'Chipping', 
      description: 'Short game around green',
      icon: '🏟️',
      color: 'bg-purple-100 text-purple-700'
    },
    { 
      id: 'putt', 
      name: 'Putting', 
      description: 'Putting stroke analysis',
      icon: '⛳',
      color: 'bg-pink-100 text-pink-700'
    }
  ];
</script>

<svelte:head>
  <title>Dashboard - Pure Golf</title>
</svelte:head>

{#if isLoading}
  <div class="min-h-screen bg-gray-50 flex items-center justify-center">
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
  </div>
{:else if user}
  <div class="min-h-screen bg-gray-50">
    <!-- Navigation Header -->
    <header class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center">
            <h1 class="text-2xl font-bold text-primary-600">Pure</h1>
          </div>
          
          <div class="flex items-center space-x-4">
            <span class="text-sm text-gray-700">Welcome, {user.user_metadata?.name || user.email}</span>
            <button
              on:click={handleLogout}
              class="text-sm text-gray-500 hover:text-gray-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <!-- Welcome Section -->
      <div class="mb-8">
        <h2 class="text-3xl font-bold text-gray-900 mb-2">
          Ready to improve your swing?
        </h2>
        <p class="text-gray-600">
          Choose a club category to start recording your three-angle swing analysis.
        </p>
      </div>

      <!-- Quick Actions - Club Categories -->
      <div class="mb-12">
        <h3 class="text-lg font-semibold text-gray-900 mb-6">Record New Swing</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {#each swingCategories as category}
            <button
              on:click={() => startNewSwing(category.id)}
              class="card p-6 hover:shadow-lg transition-shadow cursor-pointer text-left group"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center mb-3">
                    <span class="text-2xl mr-3">{category.icon}</span>
                    <h4 class="text-lg font-semibold text-gray-900 group-hover:text-primary-600">
                      {category.name}
                    </h4>
                  </div>
                  <p class="text-sm text-gray-600 mb-4">{category.description}</p>
                  <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium {category.color}">
                    Start Recording
                  </span>
                </div>
                <svg class="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          {/each}
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-semibold text-gray-900">Recent Swings</h3>
          <a href="/history" class="text-sm text-primary-600 hover:text-primary-500">
            View all →
          </a>
        </div>
        
        {#if recentSwings.length === 0}
          <div class="card p-8 text-center">
            <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h4 class="text-lg font-medium text-gray-900 mb-2">No swings recorded yet</h4>
            <p class="text-gray-600 mb-6">
              Start by recording your first swing analysis above. Choose your club category and we'll guide you through the process.
            </p>
            <button 
              on:click={() => startNewSwing('iron')}
              class="btn-primary"
            >
              Record Your First Swing
            </button>
          </div>
        {:else}
          <div class="grid gap-4">
            {#each recentSwings as swing}
              <div class="card p-4 flex items-center justify-between">
                <div class="flex items-center">
                  <div class="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mr-4">
                    <span class="text-primary-600 font-semibold">{swing.category.toUpperCase()}</span>
                  </div>
                  <div>
                    <h4 class="font-medium text-gray-900">{swing.category} Swing</h4>
                    <p class="text-sm text-gray-500">{swing.created_at}</p>
                  </div>
                </div>
                <div class="flex items-center space-x-4">
                  {#if swing.ai_summary}
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Analyzed
                    </span>
                  {:else}
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Processing
                    </span>
                  {/if}
                  <button class="text-primary-600 hover:text-primary-500 text-sm">
                    View Details →
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Quick Links -->
      <div class="grid md:grid-cols-3 gap-6">
        <a href="/drills" class="card p-6 hover:shadow-lg transition-shadow">
          <div class="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
            <svg class="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h4 class="text-lg font-semibold text-gray-900 mb-2">Practice Drills</h4>
          <p class="text-gray-600">Browse personalized drills to improve your swing</p>
        </a>

        <a href="/progress" class="card p-6 hover:shadow-lg transition-shadow">
          <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h4 class="text-lg font-semibold text-gray-900 mb-2">Track Progress</h4>
          <p class="text-gray-600">View your improvement over time</p>
        </a>

        <a href="/profile" class="card p-6 hover:shadow-lg transition-shadow">
          <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h4 class="text-lg font-semibold text-gray-900 mb-2">Profile Settings</h4>
          <p class="text-gray-600">Update your handicap and goals</p>
        </a>
      </div>
    </main>
  </div>
{/if} 