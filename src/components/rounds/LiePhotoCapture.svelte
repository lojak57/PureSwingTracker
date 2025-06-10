<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { camera, type PhotoResult } from '$lib/camera';
  import Button from '../ui/Button.svelte';
  import Card from '../ui/Card.svelte';

  export let roundId: string;
  export let holeNumber: number;
  export let shotNumber: number;
  export let disabled = false;

  const dispatch = createEventDispatcher<{
    photoTaken: { photo: PhotoResult; filename: string };
    cancel: void;
  }>();

  // Component state
  let videoElement: HTMLVideoElement;
  let stream: MediaStream | null = null;
  let capturedPhoto: PhotoResult | null = null;
  let isCapturing = false;
  let error: string | null = null;
  let showFileUpload = false;

  onMount(async () => {
    if (!camera.isSupported()) {
      error = 'Camera not supported on this device';
      showFileUpload = true;
      return;
    }

    await startCamera();
  });

  onDestroy(() => {
    camera.stopStream();
  });

  async function startCamera() {
    try {
      error = null;
      stream = await camera.startStream('environment');
      
      if (videoElement) {
        videoElement.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera error:', err);
      error = err instanceof Error ? err.message : 'Failed to access camera';
      showFileUpload = true;
    }
  }

  async function capturePhoto() {
    if (!videoElement || isCapturing) return;

    try {
      isCapturing = true;
      error = null;
      
      const photo = await camera.capturePhoto(videoElement);
      const filename = camera.generateFilename(roundId, holeNumber, shotNumber);
      
      capturedPhoto = photo;
      
      // Auto-confirm after 2 seconds or user can confirm manually
      setTimeout(() => {
        if (capturedPhoto) {
          confirmPhoto();
        }
      }, 2000);

    } catch (err) {
      console.error('Capture error:', err);
      error = err instanceof Error ? err.message : 'Failed to capture photo';
    } finally {
      isCapturing = false;
    }
  }

  async function handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) return;

    try {
      error = null;
      isCapturing = true;
      
      const photo = await camera.processFile(file);
      const filename = camera.generateFilename(roundId, holeNumber, shotNumber);
      
      capturedPhoto = photo;
      
    } catch (err) {
      console.error('File processing error:', err);
      error = err instanceof Error ? err.message : 'Failed to process file';
    } finally {
      isCapturing = false;
    }
  }

  function confirmPhoto() {
    if (!capturedPhoto) return;
    
    const filename = camera.generateFilename(roundId, holeNumber, shotNumber);
    dispatch('photoTaken', { 
      photo: capturedPhoto, 
      filename 
    });
  }

  function retakePhoto() {
    capturedPhoto = null;
    error = null;
  }

  function cancel() {
    dispatch('cancel');
  }

  function toggleFileUpload() {
    showFileUpload = !showFileUpload;
  }
</script>

<Card>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-heading text-augusta-900">
        Capture Lie Photo
      </h3>
      <div class="flex space-x-2">
        <Button variant="secondary" size="sm" on:click={toggleFileUpload}>
          {showFileUpload ? '📷 Camera' : '📁 Upload'}
        </Button>
        <Button variant="secondary" size="sm" on:click={cancel}>
          Cancel
        </Button>
      </div>
    </div>

    {#if error}
      <div class="p-3 bg-red-50 border border-red-200 rounded-lg">
        <p class="text-red-800 text-sm">{error}</p>
      </div>
    {/if}

    {#if capturedPhoto}
      <!-- Photo Preview -->
      <div class="space-y-4">
        <div class="relative">
          <img 
            src={capturedPhoto.dataUrl} 
            alt="Captured lie photo"
            class="w-full h-64 object-cover rounded-lg border border-augusta-200"
          />
          <div class="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
            {capturedPhoto.width}×{capturedPhoto.height} • {Math.round(capturedPhoto.sizeBytes / 1024)}KB
          </div>
        </div>
        
                 <div class="flex space-x-3">
           <Button variant="primary" on:click={confirmPhoto}>
             ✅ Use This Photo
           </Button>
           <Button variant="secondary" on:click={retakePhoto}>
             🔄 Retake
           </Button>
         </div>
      </div>

    {:else if showFileUpload}
      <!-- File Upload -->
      <div class="space-y-4">
        <div class="border-2 border-dashed border-augusta-300 rounded-lg p-6 text-center">
          <div class="text-4xl mb-2">📁</div>
          <p class="text-augusta-600 mb-4">Upload a photo of your lie</p>
          <input
            type="file"
            accept="image/*"
            on:change={handleFileUpload}
            class="block w-full text-sm text-augusta-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-sage-50 file:text-sage-700 hover:file:bg-sage-100"
            {disabled}
          />
        </div>
        <p class="text-xs text-augusta-500 text-center">
          Max size: 2MB • Formats: JPG, PNG, WebP
        </p>
      </div>

    {:else}
      <!-- Camera View -->
      <div class="space-y-4">
        <div class="relative bg-black rounded-lg overflow-hidden">
          <video
            bind:this={videoElement}
            autoplay
            playsinline
            muted
            class="w-full h-64 object-cover"
          ></video>
          
          {#if isCapturing}
            <div class="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
              <div class="text-center">
                <div class="animate-spin rounded-full h-8 w-8 border-2 border-augusta-300 border-t-augusta-600 mx-auto mb-2"></div>
                <p class="text-augusta-700">Processing...</p>
              </div>
            </div>
          {/if}
        </div>

                 <div class="flex justify-center">
           <Button 
             variant="primary" 
             size="lg"
             on:click={capturePhoto}
             disabled={isCapturing || disabled}
           >
             📸 Capture Photo
           </Button>
         </div>

        <p class="text-xs text-augusta-500 text-center">
          Position your phone over the ball to show the lie conditions
        </p>
      </div>
    {/if}
  </div>
</Card> 