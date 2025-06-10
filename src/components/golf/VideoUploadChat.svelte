<!--
  Video Upload Chat Component
  Integrates with chat interface for Quick Fix mode analysis
-->

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { writable } from 'svelte/store';
  import Button from '../ui/Button.svelte';
  import { camera } from '$lib/camera';
  import type { SwingSubmission } from '$lib/modes/types';
  import { processSwingSubmission } from '$lib/modes';

  export let userId: string;
  export let isProcessing = false;

  const dispatch = createEventDispatcher<{
    uploadStarted: void;
    uploadComplete: { advice: string; confidence: number };
    uploadError: { error: string };
  }>();

  let showUploadOptions = false;
  let videoFile: File | null = null;
  let previewUrl: string | null = null;
  let isRecording = false;
  let isCameraReady = false;

  // Camera stream for live recording
  let videoElement: HTMLVideoElement;
  let canvasElement: HTMLCanvasElement;

  async function handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) return;
    
    if (!file.type.startsWith('video/')) {
      dispatch('uploadError', { error: 'Please select a video file' });
      return;
    }
    
    // Check file size (25MB limit for quick mode)
    if (file.size > 25 * 1024 * 1024) {
      dispatch('uploadError', { error: 'Video file too large. Maximum 25MB for Quick Fix mode.' });
      return;
    }
    
    videoFile = file;
    previewUrl = URL.createObjectURL(file);
    showUploadOptions = false;
    
    // Process the video
    await processVideo(file);
  }

  async function startCameraRecording() {
    try {
      // Start camera stream with environment facing camera (back camera)
      await camera.startStream('environment');
      isCameraReady = true;
      isRecording = true;
      showUploadOptions = false;
    } catch (error) {
      console.error('Camera error:', error);
      dispatch('uploadError', { error: 'Unable to access camera' });
    }
  }

  async function stopCameraRecording() {
    try {
      if (!isCameraReady) return;
      
      // For now, create a mock video file
      // In production, this would use MediaRecorder API to capture actual video
      const mockVideoData = new Uint8Array(1024); // Mock video data
      const blob = new Blob([mockVideoData], { type: 'video/mp4' });
      const file = new File([blob], `quick-swing-${Date.now()}.mp4`, { type: 'video/mp4' });
      
      videoFile = file;
      previewUrl = URL.createObjectURL(file);
      isRecording = false;
      isCameraReady = false;
      
      camera.stopStream();
      
      // Process the video
      await processVideo(file);
    } catch (error) {
      console.error('Recording error:', error);
      dispatch('uploadError', { error: 'Failed to record video' });
    }
  }

  async function processVideo(file: File) {
    if (!file) return;
    
    dispatch('uploadStarted');
    isProcessing = true;
    
    try {
      // Create swing submission for Quick Fix mode
      const submission: SwingSubmission = {
        mode: 'quick',
        videos: [{
          file,
          preview_url: previewUrl || undefined
        }],
        metadata: {
          context: {
            practice_session: false,
            on_course: true,
            lesson: false
          }
        },
        user_id: userId
      };
      
      // Process with our mode system
      const result = await processSwingSubmission(submission);
      
      if (result.errors && result.errors.length > 0) {
        dispatch('uploadError', { error: result.errors[0].message });
        return;
      }
      
      // Generate advice text
      let advice = "Here's what I see in your swing:\n\n";
      
      if (result.analysis.flaws.length > 0) {
        const primaryFlaw = result.analysis.flaws[0];
        advice += `🎯 **${primaryFlaw.name}**: ${primaryFlaw.description}\n\n`;
      }
      
      if (result.caddy_advice) {
        advice += `⛳ **Caddy Advice**: ${result.caddy_advice.reasoning}\n`;
        if (result.caddy_advice.club_recommendation) {
          advice += `**Recommended Club**: ${result.caddy_advice.club_recommendation}\n`;
        }
        advice += `**Confidence**: ${Math.round(result.caddy_advice.confidence * 100)}%`;
      } else {
        advice += `**Swing Score**: ${result.analysis.swing_score}/100\n`;
        advice += `**Confidence**: ${Math.round(result.analysis.confidence * 100)}%`;
      }
      
      dispatch('uploadComplete', { 
        advice, 
        confidence: result.caddy_advice?.confidence || result.analysis.confidence 
      });
      
    } catch (error) {
      console.error('Processing error:', error);
      dispatch('uploadError', { error: 'Failed to analyze swing. Please try again.' });
    } finally {
      isProcessing = false;
      videoFile = null;
      previewUrl = null;
    }
  }

  function cancelUpload() {
    showUploadOptions = false;
    videoFile = null;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
    if (isCameraReady) {
      camera.stopStream();
      isCameraReady = false;
      isRecording = false;
    }
  }
</script>

<!-- Upload Trigger Button -->
{#if !showUploadOptions && !isProcessing && !videoFile}
  <Button
    variant="accent"
    size="sm"
    on:click={() => showUploadOptions = true}
    disabled={isProcessing}
  >
    📎 Upload Swing Video
  </Button>
{/if}

<!-- Upload Options Modal -->
{#if showUploadOptions}
  <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div class="bg-background rounded-lg max-w-md w-full p-6 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold">Upload Swing Video</h3>
        <button
          on:click={cancelUpload}
          class="text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      </div>
      
      <p class="text-sm text-muted-foreground">
        Get instant personalized advice from any swing angle. Perfect for on-course quick fixes!
      </p>
      
      <div class="space-y-3">
        <!-- File Upload Option -->
        <label class="block">
          <input
            type="file"
            accept="video/*"
            on:change={handleFileUpload}
            class="hidden"
          />
          <div class="border-2 border-dashed border-primary/20 rounded-lg p-6 text-center cursor-pointer hover:border-primary/40 transition-colors">
            <div class="space-y-2">
              <div class="text-2xl">📁</div>
              <div class="text-sm font-medium">Choose Video File</div>
              <div class="text-xs text-muted-foreground">
                MP4, MOV, WebM • Max 25MB
              </div>
            </div>
          </div>
        </label>
        
        <!-- Camera Recording Option -->
        <button
          on:click={startCameraRecording}
          class="w-full border-2 border-dashed border-primary/20 rounded-lg p-6 text-center hover:border-primary/40 transition-colors"
        >
          <div class="space-y-2">
            <div class="text-2xl">📹</div>
            <div class="text-sm font-medium">Record Now</div>
            <div class="text-xs text-muted-foreground">
              Record a new swing video
            </div>
          </div>
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Camera Recording Interface -->
{#if isRecording}
  <div class="fixed inset-0 bg-black z-50 flex flex-col">
    <!-- Camera Preview -->
    <div class="flex-1 relative">
      <video
        bind:this={videoElement}
        autoplay
        muted
        playsinline
        class="w-full h-full object-cover"
      ></video>
      
      <!-- Recording Indicator -->
      <div class="absolute top-4 left-4 flex items-center space-x-2 bg-red-500 text-white px-3 py-1 rounded-full">
        <div class="w-2 h-2 bg-white rounded-full animate-pulse"></div>
        <span class="text-sm font-medium">Recording</span>
      </div>
      
      <!-- Instructions -->
      <div class="absolute bottom-20 left-4 right-4 text-center">
        <div class="bg-black/70 text-white rounded-lg p-4">
          <p class="text-sm">
            🏌️‍♂️ Record your swing from any angle
          </p>
          <p class="text-xs mt-1 opacity-80">
            Keep the camera steady and capture the full swing
          </p>
        </div>
      </div>
    </div>
    
    <!-- Camera Controls -->
    <div class="bg-black p-6 flex justify-center space-x-4">
      <Button
        variant="secondary"
        on:click={cancelUpload}
      >
        Cancel
      </Button>
      
      <Button
        variant="primary"
        on:click={stopCameraRecording}
      >
        ⏹️ Stop & Analyze
      </Button>
    </div>
  </div>
{/if}

<!-- Processing State -->
{#if isProcessing}
  <div class="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
    <div class="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full"></div>
    <div class="space-y-1">
      <p class="text-sm font-medium">Analyzing your swing...</p>
      <p class="text-xs text-muted-foreground">
        ⚡ Quick Fix mode • Getting personalized advice
      </p>
    </div>
  </div>
{/if}

<!-- Video Preview (if uploaded but not processed) -->
{#if videoFile && previewUrl && !isProcessing}
  <div class="space-y-3">
    <div class="relative rounded-lg overflow-hidden bg-black">
      <video
        src={previewUrl}
        controls
        class="w-full max-h-48 object-contain"
      ></video>
    </div>
    
    <div class="flex justify-between items-center">
      <span class="text-sm text-muted-foreground">
        Ready to analyze • {(videoFile.size / (1024 * 1024)).toFixed(1)}MB
      </span>
      <Button
        variant="secondary"
        size="sm"
        on:click={cancelUpload}
      >
        Cancel
      </Button>
    </div>
  </div>
{/if}

<style>
  /* Custom styles for video elements */
  video {
    background: #000;
  }
  
  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: .5;
    }
  }
</style> 