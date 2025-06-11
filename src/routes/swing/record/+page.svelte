<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { AuthService } from '../../../services/auth';
  import { SwingService } from '../../../services/swing';
  import VideoRecorder from '../../../components/ui/VideoRecorder.svelte';
  import FileUploader from '../../../components/ui/FileUploader.svelte';
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
  let uploadMode: 'record' | 'upload' = 'record';

  // Recording state using SwingService
  let swingSession: SwingSession | null = null;
  let uploadProgress: Record<AngleType, number> = {
    single: 0,
    down_line: 0,
    face_on: 0,
    overhead: 0
  };

  const angles = [
    {
      id: 'single',
      name: 'Swing Video',
      description: 'Record your swing from your best available angle',
      icon: '🎥',
      instructions: [
        'Choose your best available angle (side, front, or back)',
        'Frame your full body and swing motion',
        'Capture the complete swing from setup to follow-through',
        'Keep camera steady and well-lit'
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
    
    // Check if mode is specified in URL
    const modeParam = $page.url.searchParams.get('mode');
    if (modeParam === 'upload') {
      uploadMode = 'upload';
    }
    
    // Initialize swing session
    swingSession = SwingService.createSession(category, uploadMode);
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
    
    // Update session with new recording for single video
    swingSession = SwingService.addRecording(swingSession, 'single', blob);
    
    // Single video complete, go to review
    setTimeout(() => {
      currentStep = 2;
    }, 1000);
  };

  const handleRetakeVideo = () => {
    if (!swingSession) return;
    swingSession = SwingService.removeRecording(swingSession, 'single');
    currentStep = 1; // Go back to recording/uploading
  };

  const handleFileSelected = (event: CustomEvent<{angleId: string, file: File}>) => {
    if (!swingSession) return;
    
    const { file } = event.detail;
    
    // Validate file
    const validation = SwingService.validateRecording(file);
    if (!validation.valid) {
      error = validation.error || 'Invalid file';
      return;
    }
    
    // Add file to session for single video
    swingSession = SwingService.addFileUpload(swingSession, 'single', file);
    
    // Clear any previous errors
    error = '';
  };

  const handleFileRemoved = (event: CustomEvent<{angleId: string}>) => {
    if (!swingSession) return;
    swingSession = SwingService.removeRecording(swingSession, 'single');
  };

  const handleFileError = (event: CustomEvent<{message: string}>) => {
    error = event.detail.message;
  };

  const switchUploadMode = (mode: 'record' | 'upload') => {
    uploadMode = mode;
    if (swingSession) {
      swingSession = SwingService.createSession(category, mode);
      currentStep = 0; // Reset to setup
      error = '';
    }
  };

  const handleUpload = async () => {
    if (!swingSession) return;
    
    try {
      isUploading = true;
      error = '';
      
      // Determine mode from URL parameters or default to training
      const mode = $page.url.searchParams.get('mode') === 'quick' ? 'quick' : 'training';
      
      const result = await SwingService.uploadSession(swingSession, mode, (angle, progress) => {
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

  $: isAllRecorded = swingSession ? swingSession.recordings.single !== null : false;
</script>

<svelte:head>
  <title>{uploadMode === 'record' ? 'Record' : 'Upload'} {category} Swing - Pure Golf</title>
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
          <h2 class="text-xl font-semibold mb-4">Setup Your Swing Analysis</h2>
          
          <!-- Mode Selection -->
          <div class="mb-6">
            <h3 class="font-medium text-gray-900 mb-3">Choose Your Method</h3>
            <div class="grid grid-cols-2 gap-4">
              <button
                on:click={() => switchUploadMode('record')}
                class="group p-4 border-2 rounded-lg text-left transition-all duration-300 cursor-pointer
                  {uploadMode === 'record' 
                    ? 'border-blue-500 bg-blue-50 shadow-md' 
                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 hover:-translate-y-1 hover:shadow-lg'}"
              >
                <div class="flex items-center space-x-3">
                  <span class="text-2xl group-hover:scale-110 transition-transform duration-200">📹</span>
                  <div>
                    <h4 class="font-medium text-gray-900 group-hover:text-blue-700 transition-colors">Record Now</h4>
                    <p class="text-sm text-gray-600">Use your camera to record live</p>
                  </div>
                </div>
              </button>
              
              <button
                on:click={() => switchUploadMode('upload')}
                class="group p-4 border-2 rounded-lg text-left transition-all duration-300 cursor-pointer
                  {uploadMode === 'upload' 
                    ? 'border-blue-500 bg-blue-50 shadow-md' 
                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 hover:-translate-y-1 hover:shadow-lg'}"
              >
                <div class="flex items-center space-x-3">
                  <span class="text-2xl group-hover:scale-110 transition-transform duration-200">📁</span>
                  <div>
                    <h4 class="font-medium text-gray-900 group-hover:text-blue-700 transition-colors">Upload Files</h4>
                    <p class="text-sm text-gray-600">Choose videos from your device</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
          
          <div class="space-y-4">
            <p class="text-gray-600">
              {uploadMode === 'record' 
                ? "Record a single swing video from your best available angle. Video should be 10-15 seconds long, capturing your complete swing motion."
                : "Upload a single swing video from your device. Maximum 25MB per video for iPhone videos."
              }
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
              class="btn-primary hover:cursor-pointer"
            >
              {uploadMode === 'record' ? 'Start Recording' : 'Start Uploading'}
            </button>
          </div>
        </div>

      {:else if currentStep === 1}
        <!-- Recording/Upload Interface -->
        {#if uploadMode === 'record'}
          <VideoRecorder
            {angles}
            recordings={swingSession?.recordings || {}}
            on:recordingComplete={(e: CustomEvent<{angleId: string, blob: Blob}>) => handleRecordingComplete(e.detail.angleId, e.detail.blob)}
            on:error={(e: CustomEvent<{message: string}>) => error = e.detail.message}
          />
        {:else}
          <div class="bg-white rounded-xl shadow-sm p-6">
            <FileUploader
              {angles}
              existingFiles={swingSession?.recordings || { down_line: null, face_on: null, overhead: null, single: null }}
              disabled={isUploading}
              on:fileSelected={handleFileSelected}
              on:fileRemoved={handleFileRemoved}
              on:error={handleFileError}
            />
            
            <!-- Navigation Buttons -->
            <div class="flex justify-between mt-6">
              <button
                on:click={() => currentStep = 0}
                disabled={isUploading}
                class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Back to Setup
              </button>
              
              <button
                on:click={() => currentStep = 2}
                disabled={!isAllRecorded || isUploading}
                class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Review & Upload
              </button>
            </div>
          </div>
        {/if}

      {:else if currentStep === 2}
        <!-- Review & Upload -->
        <div class="bg-white rounded-xl shadow-sm p-6">
          <h2 class="text-xl font-semibold mb-4">Review Your Recording</h2>
          
          <div class="mb-6">
            <div class="flex items-center justify-between p-4 border rounded-lg">
              <div class="flex items-center space-x-3">
                <span class="text-xl">{angles[0].icon}</span>
                <div>
                  <h3 class="font-medium">{angles[0].name}</h3>
                  <p class="text-sm text-gray-600">
                    {swingSession?.recordings.single ? 'Recorded' : 'Not recorded'}
                  </p>
                </div>
              </div>
              <div class="flex space-x-2">
                {#if swingSession?.recordings.single}
                  <span class="text-green-600">✓</span>
                  <button
                    on:click={handleRetakeVideo}
                    class="text-sm text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    Retake
                  </button>
                {:else}
                  <span class="text-red-600">✗</span>
                {/if}
              </div>
            </div>
          </div>

          <!-- Upload Progress -->
          {#if isUploading}
            <div class="mb-6 space-y-3">
              <h3 class="font-medium text-gray-900">Uploading Video...</h3>
              <div class="flex items-center space-x-3">
                <span class="text-sm w-20">{angles[0].name}:</span>
                <div class="flex-1 bg-gray-200 rounded-full h-2">
                  <div 
                    class="bg-primary-600 h-2 rounded-full transition-all duration-300"
                    style="width: {uploadProgress.single}%"
                  ></div>
                </div>
                <span class="text-sm text-gray-600 w-12">{uploadProgress.single}%</span>
              </div>
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