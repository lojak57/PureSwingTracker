<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { roundActions, type Course, type Round } from '../../stores/roundStore';
  import Button from '../ui/Button.svelte';
  import Card from '../ui/Card.svelte';

  const dispatch = createEventDispatcher<{
    roundStarted: { round: Round };
    cancel: void;
  }>();

  // Component props
  export let selectedCourse: Course | null = null;

  // Component state
  let loading = false;
  let error: string | null = null;
  let searchQuery = '';
  let searchResults: Course[] = [];
  let selectedTeeSet = '';
  let weather = {
    temperature: '',
    wind_speed: '',
    wind_direction: '',
    conditions: 'clear'
  };
  let notes = '';

  // GPS location for course search
  let userLocation: [number, number] | null = null;
  let gpsLoading = false;

  const teeSetOptions = [
    { value: 'black', label: 'Black Tees (Tips)', color: 'bg-gray-900' },
    { value: 'blue', label: 'Blue Tees (Championship)', color: 'bg-blue-600' },
    { value: 'white', label: 'White Tees (Men\'s)', color: 'bg-gray-100' },
    { value: 'gold', label: 'Gold Tees (Senior)', color: 'bg-yellow-500' },
    { value: 'red', label: 'Red Tees (Ladies)', color: 'bg-red-500' }
  ];

  const weatherConditions = [
    { value: 'clear', label: '☀️ Clear' },
    { value: 'partly_cloudy', label: '⛅ Partly Cloudy' },
    { value: 'cloudy', label: '☁️ Cloudy' },
    { value: 'light_rain', label: '🌦️ Light Rain' },
    { value: 'windy', label: '💨 Windy' }
  ];

  const windDirections = [
    'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'
  ];

  onMount(() => {
    // Auto-detect user location for course search
    getCurrentLocation();
    
    // Set default tee set
    if (!selectedTeeSet) {
      selectedTeeSet = 'white';
    }
  });

  async function getCurrentLocation() {
    if (!navigator.geolocation) return;
    
    gpsLoading = true;
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        });
      });
      
      userLocation = [position.coords.latitude, position.coords.longitude];
      
      // Auto-search for nearby courses
      if (!selectedCourse) {
        await searchNearby();
      }
    } catch (error) {
      console.warn('Could not get user location:', error);
    } finally {
      gpsLoading = false;
    }
  }

  async function searchNearby() {
    if (!userLocation) return;
    
    loading = true;
    error = null;
    
    try {
      const response = await fetch(`/api/courses/search?lat=${userLocation[0]}&lng=${userLocation[1]}&radius=25`);
      const data = await response.json();
      
      if (response.ok) {
        searchResults = data.courses;
      } else {
        error = data.error?.message || 'Failed to search courses';
      }
    } catch (err) {
      error = 'Failed to search for courses';
      console.error('Course search error:', err);
    } finally {
      loading = false;
    }
  }

  async function searchCourses() {
    if (!searchQuery.trim() || !userLocation) return;
    
    loading = true;
    error = null;
    
    try {
      const response = await fetch('/api/courses/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: userLocation[0],
          lng: userLocation[1],
          radius: 50,
          query: searchQuery
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        searchResults = data.courses;
      } else {
        error = data.error?.message || 'Failed to search courses';
      }
    } catch (err) {
      error = 'Failed to search for courses';
      console.error('Course search error:', err);
    } finally {
      loading = false;
    }
  }

  function selectCourse(course: Course) {
    selectedCourse = course;
    
    // Set default tee set based on available options
    if (course.holes?.[0]?.yardages) {
      const availableTees = Object.keys(course.holes[0].yardages);
      const preferredOrder = ['white', 'blue', 'red', 'black', 'gold'];
      
      for (const preferred of preferredOrder) {
        if (availableTees.includes(preferred)) {
          selectedTeeSet = preferred;
          break;
        }
      }
      
      if (!selectedTeeSet && availableTees.length > 0) {
        selectedTeeSet = availableTees[0];
      }
    }
  }

  async function startRound() {
    if (!selectedCourse || !selectedTeeSet) {
      error = 'Please select a course and tee set';
      return;
    }

    loading = true;
    error = null;

    try {
      // Call API to start round
      const response = await fetch('/api/rounds/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: selectedCourse.id,
          tee_set: selectedTeeSet,
          weather: {
            temperature: weather.temperature ? parseInt(weather.temperature) : undefined,
            wind_speed: weather.wind_speed ? parseInt(weather.wind_speed) : undefined,
            wind_direction: weather.wind_direction || undefined,
            conditions: weather.conditions
          },
          notes: notes.trim() || undefined
        })
      });

      const data = await response.json();

      if (response.ok) {
        const round: Round = {
          ...data.round,
          course: selectedCourse
        };

        // Update store
        roundActions.startRound(round);
        
        // Dispatch event
        dispatch('roundStarted', { round });
      } else {
        error = data.error?.message || 'Failed to start round';
      }
    } catch (err) {
      error = 'Failed to start round';
      console.error('Start round error:', err);
    } finally {
      loading = false;
    }
  }

  function cancel() {
    dispatch('cancel');
  }
</script>

<div class="max-w-2xl mx-auto space-y-6">
  <!-- Header -->
  <div class="text-center">
    <h1 class="text-3xl font-display text-augusta-900 mb-2">Start New Round</h1>
    <p class="text-augusta-600">Select your course and tee set to begin tracking your round</p>
  </div>

  {#if error}
    <div class="glass-white border border-red-200 rounded-lg p-4">
      <div class="flex items-center space-x-2">
        <span class="text-red-600">⚠️</span>
        <span class="text-red-800">{error}</span>
      </div>
    </div>
  {/if}

  <!-- Course Selection -->
  <Card>
    <h2 class="text-xl font-heading text-augusta-900 mb-4">Select Course</h2>
    
    {#if !selectedCourse}
      <div class="space-y-4">
        <!-- GPS Status -->
        {#if gpsLoading}
          <div class="flex items-center space-x-2 text-augusta-600">
            <div class="animate-spin rounded-full h-4 w-4 border-2 border-augusta-300 border-t-augusta-600"></div>
            <span>Getting your location...</span>
          </div>
        {:else if userLocation}
          <div class="flex items-center space-x-2 text-green-600 text-sm">
            <span>📍</span>
            <span>Location found - searching nearby courses</span>
          </div>
        {/if}

        <!-- Search Input -->
        <div class="flex space-x-2">
          <input
            type="text"
            placeholder="Search for golf courses..."
            bind:value={searchQuery}
            class="flex-1 px-4 py-2 border border-augusta-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500"
            on:keydown={(e) => e.key === 'Enter' && searchCourses()}
          />
          <Button 
            variant="primary" 
            on:click={searchCourses}
            disabled={!searchQuery.trim() || loading}
          >
            Search
          </Button>
        </div>

        <!-- Search Results -->
        {#if loading}
          <div class="flex items-center justify-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-2 border-augusta-300 border-t-augusta-600"></div>
          </div>
        {:else if searchResults.length > 0}
          <div class="space-y-2">
            <p class="text-sm text-augusta-600">{searchResults.length} courses found</p>
            <div class="max-h-64 overflow-y-auto space-y-2">
              {#each searchResults as course}
                <button
                  type="button"
                  class="w-full text-left p-3 rounded-lg border border-augusta-200 hover:border-sage-300 hover:glass-sage transition-all"
                  on:click={() => selectCourse(course)}
                >
                  <div class="font-medium text-augusta-900">{course.name}</div>
                  <div class="text-sm text-augusta-600">
                    {course.holes?.length || 18} holes
                    {#if course.location}
                      • {course.location[0].toFixed(4)}, {course.location[1].toFixed(4)}
                    {/if}
                  </div>
                </button>
              {/each}
            </div>
          </div>
        {:else if !gpsLoading}
          <div class="text-center py-8 text-augusta-600">
            <p>🔍 No courses found</p>
            <p class="text-sm">Try adjusting your search or enabling location access</p>
          </div>
        {/if}
      </div>
    {:else}
      <!-- Selected Course -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="font-medium text-augusta-900">{selectedCourse.name}</h3>
            <p class="text-sm text-augusta-600">{selectedCourse.holes?.length || 18} holes</p>
          </div>
          <Button variant="secondary" on:click={() => selectedCourse = null}>
            Change Course
          </Button>
        </div>
      </div>
    {/if}
  </Card>

  <!-- Tee Set Selection -->
  {#if selectedCourse}
    <Card>
      <h2 class="text-xl font-heading text-augusta-900 mb-4">Select Tee Set</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {#each teeSetOptions as tee}
          {@const isAvailable = selectedCourse.holes?.[0]?.yardages?.[tee.value]}
          <button
            type="button"
            disabled={!isAvailable}
            class="flex items-center space-x-3 p-3 rounded-lg border transition-all
              {selectedTeeSet === tee.value 
                ? 'border-sage-500 glass-sage' 
                : isAvailable 
                  ? 'border-augusta-200 hover:border-augusta-300' 
                  : 'border-augusta-100 opacity-50 cursor-not-allowed'}"
            on:click={() => isAvailable && (selectedTeeSet = tee.value)}
          >
            <div class="w-4 h-4 rounded-full {tee.color}"></div>
            <span class="text-augusta-900 {!isAvailable ? 'opacity-50' : ''}">{tee.label}</span>
          </button>
        {/each}
      </div>
    </Card>

    <!-- Weather Conditions -->
    <Card>
      <h2 class="text-xl font-heading text-augusta-900 mb-4">Weather Conditions</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-augusta-700 mb-1">Temperature (°F)</label>
          <input
            type="number"
            placeholder="72"
            bind:value={weather.temperature}
            class="w-full px-3 py-2 border border-augusta-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-augusta-700 mb-1">Conditions</label>
          <select
            bind:value={weather.conditions}
            class="w-full px-3 py-2 border border-augusta-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500"
          >
            {#each weatherConditions as condition}
              <option value={condition.value}>{condition.label}</option>
            {/each}
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-augusta-700 mb-1">Wind Speed (mph)</label>
          <input
            type="number"
            placeholder="5"
            bind:value={weather.wind_speed}
            class="w-full px-3 py-2 border border-augusta-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-augusta-700 mb-1">Wind Direction</label>
          <select
            bind:value={weather.wind_direction}
            class="w-full px-3 py-2 border border-augusta-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500"
          >
            <option value="">Select direction</option>
            {#each windDirections as direction}
              <option value={direction}>{direction}</option>
            {/each}
          </select>
        </div>
      </div>
    </Card>

    <!-- Notes -->
    <Card>
      <h2 class="text-xl font-heading text-augusta-900 mb-4">Round Notes</h2>
      <textarea
        placeholder="Any notes about today's round... playing conditions, goals, etc."
        bind:value={notes}
        rows="3"
        class="w-full px-3 py-2 border border-augusta-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500 resize-none"
      ></textarea>
    </Card>

    <!-- Action Buttons -->
    <div class="flex space-x-4">
      <Button variant="secondary" on:click={cancel} class="flex-1">
        Cancel
      </Button>
      <Button 
        variant="primary" 
        on:click={startRound}
        disabled={!selectedCourse || !selectedTeeSet || loading}
        class="flex-1"
      >
        {#if loading}
          <div class="flex items-center space-x-2">
            <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            <span>Starting Round...</span>
          </div>
        {:else}
          Start Round
        {/if}
      </Button>
    </div>
  {/if}
</div> 