<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { AuthService } from '../../../services/auth';
  import { SwingService } from '../../../services/swing';
  import VideoRecorder from '../../../components/ui/VideoRecorder.svelte';
  import ProgressWizard from '../../../components/ui/ProgressWizard.svelte';
  import type { SwingCategory } from '../../../lib/supabase';
  import type { SwingSession, AngleType } from '../../../services/swing';

  // Page state
  let user: any = null;
  let isLoading = true;
  let currentStep = 0;
  let category: SwingCategory;
  let error = '';
  let isUploading = false;

  // Recording state using SwingService
  let swingSession: SwingSession | null = null;
  let uploadProgress: Record<AngleType, number> = {
    down_line: 0,
    face_on: 0,
    overhead: 0
  };

  const angles = [
    {
      id: 'down_line',
      name: 'Down the Line',
      description: 'Position camera behind you, looking down your target line',
      icon: '📹',
      instructions: [
        'Stand behind the golfer',
        'Camera at chest height',
        'Frame includes full swing motion',
        'Keep camera steady'
      ]
    },
    {
      id: 'face_on',
      name: 'Face On',
      description: 'Position camera facing you from the side',
      icon: '🎥',
      instructions: [
        'Stand to the side of golfer',
        'Camera at waist height',
        'Show full body in frame',
        'Capture ball contact clearly'
      ]
    },
    {
      id: 'overhead',
      name: 'Overhead',
      description: 'Position camera above, looking down at setup',
      icon: '📷',
      instructions: [
        'Hold camera overhead',
        'Look straight down at setup',
        'Include ball and stance',
        'Keep hand steady'
      ]
    }
  ];

  const steps = [
    'Setup',
    'Record Videos',
    'Review & Upload'
  ];

  onMount(async () => {
    // Check authentication
    user = await AuthService.getCurrentUser();
    if (!user) {
      goto('/auth/login');
      return;
    }

    // Get category from URL params
    const categoryParam = $page.url.searchParams.get('category');
    if (!categoryParam || !['wood', 'iron', 'wedge', 'chip', 'putt'].includes(categoryParam)) {
      goto('/dashboard');
      return;
    }

    category = categoryParam as SwingCategory;
    
    // Initialize swing session
    swingSession = SwingService.createSession(category);
    isLoading = false;
  });

  const handleRecordingComplete = (angleId: string, blob: Blob) => {
    if (!swingSession) return;
    
    // Validate recording
    const validation = SwingService.validateRecording(blob);
    if (!validation.valid) {
      error = validation.error || 'Invalid recording';
      return;
    }
    
    // Update session with new recording
    swingSession = SwingService.addRecording(swingSession, angleId as AngleType, blob);
    
    // Auto-advance to next angle if not on last one
    const currentAngleIndex = angles.findIndex(a => a.id === angleId);
    if (currentAngleIndex < angles.length - 1) {
      // Move to next angle automatically
      setTimeout(() => {
        currentStep = 1; // Stay on recording step but advance angle
      }, 1000);
    } else {
      // All recordings complete, go to review
      currentStep = 2;
    }
  };

  const handleRetakeVideo = (angleId: string) => {
    if (!swingSession) return;
    swingSession.recordings[angleId as AngleType] = null;
    swingSession.state = 'recording';
    currentStep = 1; // Go back to recording
  };

  const handleUpload = async () => {
    if (!swingSession) return;
    
    try {
      isUploading = true;
      error = '';
      
      const result = await SwingService.uploadSession(swingSession, (angle, progress) => {
        uploadProgress[angle] = progress;
      });
      
      if (result.success && result.swingId) {
        goto(`/swing/${result.swingId}?status=processing`);
      } else {
        error = result.error || 'Upload failed';
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Upload failed';
    } finally {
      isUploading = false;
    }
  };

  $: isAllRecorded = swingSession ? Object.values(swingSession.recordings).every(r => r !== null) : false;
</script>

<svelte:head>
  <title>Record {category} Swing - Pure Golf</title>
</svelte:head>

{#if isLoading}
  <div class="min-h-screen bg-gray-50 flex items-center justify-center">
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
  </div>
{:else}
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-4xl mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">
              Record {category.charAt(0).toUpperCase() + category.slice(1)} Swing
            </h1>
            <p class="text-gray-600">Capture three angles for AI analysis</p>
          </div>
          <button
            on:click={() => goto('/dashboard')}
            class="text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </header>

    <main class="max-w-4xl mx-auto px-4 py-6">
      <!-- Progress Wizard -->
      <ProgressWizard {steps} {currentStep} />

      {#if error}
        <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p class="text-red-600">{error}</p>
        </div>
      {/if}

      <!-- Step Content -->
      {#if currentStep === 0}
        <!-- Setup Instructions -->
        <div class="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 class="text-xl font-semibold mb-4">Recording Setup</h2>
          <div class="space-y-4">
            <p class="text-gray-600">
              You'll record three different camera angles. Each video should be 10-15 seconds long, 
              capturing your complete swing motion.
            </p>
            
            <div class="grid gap-4">
              {#each angles as angle}
                <div class="flex items-start space-x-4 p-4 border rounded-lg">
                  <span class="text-2xl">{angle.icon}</span>
                  <div class="flex-1">
                    <h3 class="font-medium text-gray-900">{angle.name}</h3>
                    <p class="text-sm text-gray-600 mb-2">{angle.description}</p>
                    <ul class="text-xs text-gray-500 space-y-1">
                      {#each angle.instructions as instruction}
                        <li>• {instruction}</li>
                      {/each}
                    </ul>
                  </div>
                </div>
              {/each}
            </div>
          </div>
          
          <div class="mt-6">
            <button
              on:click={() => currentStep = 1}
              class="btn-primary"
            >
              Start Recording
            </button>
          </div>
        </div>

      {:else if currentStep === 1}
        <!-- Recording Interface -->
        <VideoRecorder
          {angles}
          recordings={swingSession?.recordings || {}}
          on:recordingComplete={(e: CustomEvent<{angleId: string, blob: Blob}>) => handleRecordingComplete(e.detail.angleId, e.detail.blob)}
          on:error={(e: CustomEvent<{message: string}>) => error = e.detail.message}
        />

      {:else if currentStep === 2}
        <!-- Review & Upload -->
        <div class="bg-white rounded-xl shadow-sm p-6">
          <h2 class="text-xl font-semibold mb-4">Review Your Recordings</h2>
          
          <div class="grid gap-4 mb-6">
            {#each angles as angle}
              <div class="flex items-center justify-between p-4 border rounded-lg">
                <div class="flex items-center space-x-3">
                  <span class="text-xl">{angle.icon}</span>
                  <div>
                    <h3 class="font-medium">{angle.name}</h3>
                    <p class="text-sm text-gray-600">
                      {swingSession?.recordings[angle.id as AngleType] ? 'Recorded' : 'Not recorded'}
                    </p>
                  </div>
                </div>
                <div class="flex space-x-2">
                  {#if swingSession?.recordings[angle.id as AngleType]}
                    <span class="text-green-600">✓</span>
                    <button
                      on:click={() => handleRetakeVideo(angle.id)}
                      class="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Retake
                    </button>
                  {:else}
                    <span class="text-red-600">✗</span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>

          <!-- Upload Progress -->
          {#if isUploading}
            <div class="mb-6 space-y-3">
              <h3 class="font-medium text-gray-900">Uploading Videos...</h3>
              {#each angles as angle}
                <div class="flex items-center space-x-3">
                  <span class="text-sm w-20">{angle.name}:</span>
                  <div class="flex-1 bg-gray-200 rounded-full h-2">
                    <div 
                      class="bg-primary-600 h-2 rounded-full transition-all duration-300"
                      style="width: {uploadProgress[angle.id as AngleType]}%"
                    ></div>
                  </div>
                  <span class="text-sm text-gray-600 w-12">{uploadProgress[angle.id as AngleType]}%</span>
                </div>
              {/each}
            </div>
          {/if}

          <div class="flex justify-between">
            <button
              on:click={() => currentStep = 1}
              disabled={isUploading}
              class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back to Recording
            </button>
            <button
              on:click={handleUpload}
              disabled={!isAllRecorded || isUploading}
              class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {#if isUploading}
                <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Uploading...</span>
              {:else}
                <span>Upload & Analyze</span>
              {/if}
            </button>
          </div>
        </div>
      {/if}
    </main>
  </div>
{/if} 