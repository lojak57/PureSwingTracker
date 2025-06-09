<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { goto } from '$app/navigation';
  
  let user: any = null;
  let isLoading = true;

  onMount(() => {
    let subscription: any;
    
    // Initialize auth state
    const initAuth = async () => {
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      user = session?.user || null;
      isLoading = false;
    };
    
    initAuth();

    // Listen for auth changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        user = session?.user || null;
      }
    );
    
    subscription = authSubscription;

    return () => {
      subscription?.unsubscribe();
    };
  });

  const handleGetStarted = () => {
    if (user) {
      goto('/dashboard');
    } else {
      goto('/auth/login');
    }
  };
</script>

<svelte:head>
  <title>Pure - AI-Powered Golf Swing Analysis</title>
  <meta name="description" content="Improve your golf swing with AI-powered video analysis and personalized coaching from Coach Sarah." />
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
  <!-- Hero Section -->
  <div class="container mx-auto px-4 py-12">
    <div class="text-center mb-16">
      <h1 class="text-5xl font-bold text-gray-900 mb-6">
        Perfect Your Golf Swing with
        <span class="text-primary-600">AI-Powered Analysis</span>
      </h1>
      <p class="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
        Record three video angles, get instant feedback from Coach Sarah, and improve your game with personalized drill recommendations.
      </p>
      
      {#if isLoading}
        <div class="flex justify-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      {:else}
        <button 
          class="btn-primary text-lg px-8 py-4"
          on:click={handleGetStarted}
        >
          {user ? 'Go to Dashboard' : 'Get Started Free'}
        </button>
      {/if}
    </div>

    <!-- Features Grid -->
    <div class="grid md:grid-cols-3 gap-8 mb-16">
      <div class="card p-8 text-center">
        <div class="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 class="text-xl font-semibold mb-3">3-Angle Video Analysis</h3>
        <p class="text-gray-600">Record down-the-line, face-on, and overhead angles for comprehensive swing analysis.</p>
      </div>

      <div class="card p-8 text-center">
        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <h3 class="text-xl font-semibold mb-3">AI-Powered Insights</h3>
        <p class="text-gray-600">Get instant feedback on your swing mechanics with detailed flaw detection and scoring.</p>
      </div>

      <div class="card p-8 text-center">
        <div class="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h3 class="text-xl font-semibold mb-3">Personalized Drills</h3>
        <p class="text-gray-600">Receive customized practice drills from Coach Sarah to improve your specific weaknesses.</p>
      </div>
    </div>

    <!-- How It Works -->
    <div class="text-center mb-16">
      <h2 class="text-3xl font-bold text-gray-900 mb-12">How Pure Works</h2>
      <div class="grid md:grid-cols-4 gap-6">
        <div class="text-center">
          <div class="w-12 h-12 bg-primary-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 font-bold">1</div>
          <h4 class="font-semibold mb-2">Choose Club Type</h4>
          <p class="text-sm text-gray-600">Select Woods, Irons, Wedges, Chipping, or Putting</p>
        </div>
        <div class="text-center">
          <div class="w-12 h-12 bg-primary-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 font-bold">2</div>
          <h4 class="font-semibold mb-2">Record 3 Angles</h4>
          <p class="text-sm text-gray-600">Capture down-the-line, face-on, and overhead views</p>
        </div>
        <div class="text-center">
          <div class="w-12 h-12 bg-primary-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 font-bold">3</div>
          <h4 class="font-semibold mb-2">AI Analysis</h4>
          <p class="text-sm text-gray-600">Our AI analyzes your swing mechanics and identifies flaws</p>
        </div>
        <div class="text-center">
          <div class="w-12 h-12 bg-primary-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 font-bold">4</div>
          <h4 class="font-semibold mb-2">Get Coaching</h4>
          <p class="text-sm text-gray-600">Receive personalized feedback and drill recommendations</p>
        </div>
      </div>
    </div>

    <!-- CTA Section -->
    <div class="card p-12 text-center bg-gradient-to-r from-primary-600 to-primary-700 text-white">
      <h2 class="text-3xl font-bold mb-4">Ready to Improve Your Golf Game?</h2>
      <p class="text-xl mb-8 opacity-90">Join beta users and start your journey to better golf today.</p>
      <button 
        class="bg-white text-primary-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors"
        on:click={handleGetStarted}
      >
        {user ? 'Go to Dashboard' : 'Start Free Trial'}
      </button>
    </div>
  </div>
</div>
