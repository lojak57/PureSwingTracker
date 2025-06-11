<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';

  export let angles: Array<{id: string, name: string, description: string, icon: string, instructions: string[]}> = [];
  export let recordings: Record<string, Blob | null> = {};

  const dispatch = createEventDispatcher<{
    recordingComplete: { angleId: string; blob: Blob };
    error: { message: string };
  }>();

  let currentAngleIndex = 0;
  let isRecording = false;
  let countdown = 0;
  let recordingTime = 0;
  let stream: MediaStream | null = null;
  let mediaRecorder: MediaRecorder | null = null;
  let videoElement: HTMLVideoElement;
  let recordedChunks: Blob[] = [];

  $: currentAngle = angles[currentAngleIndex];
  $: hasPermission = stream !== null;

  onMount(() => {
    requestCameraPermission();
    return () => {
      stopStream();
    };
  });

  const requestCameraPermission = async () => {
    try {
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment' // Prefer back camera on mobile
        },
        audio: false
      };

      stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoElement) {
        videoElement.srcObject = stream;
      }
    } catch (error) {
      dispatch('error', { 
        message: error instanceof Error ? error.message : 'Camera access denied' 
      });
    }
  };

  const startRecording = () => {
    if (!stream) return;

    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9' // Good compression for mobile
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      dispatch('recordingComplete', { angleId: currentAngle.id, blob });
      
      // Single video mode - no auto-advance needed
    };

    // Countdown before recording
    countdown = 3;
    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdown === 0) {
        clearInterval(countdownInterval);
        actuallyStartRecording();
      }
    }, 1000);
  };

  const actuallyStartRecording = () => {
    if (!mediaRecorder) return;

    isRecording = true;
    recordingTime = 0;
    mediaRecorder.start();

    // Recording timer
    const recordingInterval = setInterval(() => {
      recordingTime++;
      
      // Auto-stop after 15 seconds
      if (recordingTime >= 15) {
        stopRecording();
        clearInterval(recordingInterval);
      }
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      isRecording = false;
      recordingTime = 0;
    }
  };

  const stopStream = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
  };

  // Single video mode - no angle switching needed
</script>

<div class="bg-white rounded-xl shadow-sm p-6">
  <h2 class="text-xl font-semibold mb-4">Record Videos</h2>
  
  <!-- Single Video Info -->
  <div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <h3 class="font-medium text-blue-900 mb-2 flex items-center">
      <span class="mr-2">{currentAngle.icon}</span>
      {currentAngle.name}
      {#if recordings[currentAngle.id]}
        <span class="ml-2 text-green-600">✓ Recorded</span>
      {/if}
    </h3>
    <p class="text-blue-700 mb-3">{currentAngle.description}</p>
  </div>

  {#if currentAngle}
    <!-- Recording Instructions -->
    <div class="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
      <ul class="text-sm text-gray-700 space-y-1">
        {#each currentAngle.instructions as instruction}
          <li>• {instruction}</li>
        {/each}
      </ul>
    </div>

    <!-- Video Preview -->
    <div class="relative mb-6">
      {#if hasPermission}
        <!-- svelte-ignore a11y-media-has-caption -->
        <video
          bind:this={videoElement}
          autoplay
          muted
          playsinline
          class="w-full max-w-md mx-auto rounded-lg bg-black"
        ></video>
        
        <!-- Recording Overlays -->
        {#if countdown > 0}
          <div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
            <div class="text-6xl font-bold text-white animate-pulse">{countdown}</div>
          </div>
        {/if}
        
        {#if isRecording}
          <div class="absolute top-4 left-4 flex items-center space-x-2">
            <div class="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <span class="text-white font-medium">REC {recordingTime}s</span>
          </div>
        {/if}
      {:else}
        <div class="w-full max-w-md mx-auto h-64 bg-gray-100 rounded-lg flex items-center justify-center">
          <div class="text-center">
            <div class="text-4xl mb-2">📹</div>
            <p class="text-gray-600">Camera access required</p>
            <button
              on:click={requestCameraPermission}
              class="mt-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Enable Camera
            </button>
          </div>
        </div>
      {/if}
    </div>

    <!-- Recording Controls -->
    <div class="flex justify-center space-x-4">
      {#if !isRecording && hasPermission}
        <button
          on:click={startRecording}
          class="px-6 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 flex items-center space-x-2"
        >
          <div class="w-4 h-4 bg-white rounded-full"></div>
          <span>Record</span>
        </button>
      {:else if isRecording}
        <button
          on:click={stopRecording}
          class="px-6 py-3 bg-gray-600 text-white rounded-full hover:bg-gray-700"
        >
          Stop Recording
        </button>
      {/if}
    </div>
  {/if}
</div> 