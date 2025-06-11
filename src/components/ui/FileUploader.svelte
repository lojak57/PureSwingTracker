<!--
  File Upload Component for Single Swing Video
  Supports drag & drop for single video upload with 4MB limit
-->

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { AngleType } from '../../services/swing';
  
  export let angles: Array<{id: string, name: string, description: string, icon: string}>;
  export let existingFiles: Record<AngleType, Blob | File | null> = {
    down_line: null,
    face_on: null,
    overhead: null,
    single: null
  };
  export let disabled = false;

  const dispatch = createEventDispatcher<{
    fileSelected: { angleId: string; file: File };
    fileRemoved: { angleId: string };
    error: { message: string };
  }>();

  let isDragOver = false;

  // File validation - 4MB limit for Vercel compatibility
  function validateVideoFile(file: File): { valid: boolean; error?: string } {
    // Check file type
    if (!file.type.startsWith('video/')) {
      return { valid: false, error: 'File must be a video (MP4, MOV, WebM, etc.)' };
    }

    // Check file size (4MB limit for Vercel backend)
    const maxSize = 4 * 1024 * 1024; // 4MB
    if (file.size > maxSize) {
      return { 
        valid: false, 
        error: `File too large: ${Math.round(file.size / 1024 / 1024)}MB. Maximum 4MB allowed.` 
      };
    }

    return { valid: true };
  }

  // Handle file selection
  function handleFileSelect(file: File) {
    const validation = validateVideoFile(file);
    if (!validation.valid) {
      dispatch('error', { message: validation.error || 'Invalid file' });
      return;
    }

    dispatch('fileSelected', { angleId: 'single', file });
  }

  // Handle drag and drop
  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragOver = true;
  }

  function handleDragLeave() {
    isDragOver = false;
  }

  // Handle input file selection
  function handleInputChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input
    input.value = '';
  }

  // Remove file
  function removeFile() {
    dispatch('fileRemoved', { angleId: 'single' });
  }

  // Format file size
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  $: singleAngle = angles.find(a => a.id === 'single') || angles[0];
  $: hasFile = existingFiles.single;
</script>

<div class="space-y-6">
  <div class="text-center mb-6">
    <h3 class="text-lg font-medium text-gray-900 mb-2">Upload Your Swing Video</h3>
    <p class="text-sm text-gray-600">
      Upload a single swing video from any angle. Max 4MB for quick analysis.
    </p>
  </div>

  <!-- Single Video Upload -->
  <div class="border rounded-lg p-6">
    <div class="flex items-start space-x-4 mb-4">
      <span class="text-3xl">{singleAngle.icon}</span>
      <div>
        <h4 class="font-medium text-gray-900 text-lg">{singleAngle.name}</h4>
        <p class="text-sm text-gray-600">{singleAngle.description}</p>
      </div>
    </div>
            
    {#if hasFile}
      <!-- File Selected State -->
      <div class="bg-green-50 border border-green-200 rounded-lg p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div>
              <p class="text-sm font-medium text-green-900">
                {hasFile instanceof File ? hasFile.name : 'Recorded Video'}
              </p>
              <p class="text-xs text-green-700">{formatFileSize(hasFile.size)}</p>
            </div>
          </div>
          <button
            on:click={removeFile}
            disabled={disabled}
            class="text-green-600 hover:text-green-800 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>
    {:else}
      <!-- Upload Zone -->
      <div
        class="border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 group
          {isDragOver 
            ? 'border-blue-400 bg-blue-50 scale-[1.02]' 
            : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/50 hover:scale-[1.01] hover:shadow-lg'
          }
          {disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}"
        on:drop={handleDrop}
        on:dragover={handleDragOver}
        on:dragleave={handleDragLeave}
      >
        <input
          type="file"
          accept="video/*"
          id="file-single"
          class="hidden"
          {disabled}
          on:change={handleInputChange}
        />
        
        <label for="file-single" class="cursor-pointer block">
          <svg class="mx-auto h-12 w-12 text-gray-400 mb-4 group-hover:text-blue-500 group-hover:scale-110 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
          </svg>
          
          <p class="text-lg font-medium text-gray-900 mb-2 group-hover:text-blue-700 transition-colors">
            {isDragOver ? 'Drop video here' : 'Click to upload or drag & drop'}
          </p>
          <p class="text-sm text-gray-600">
            MP4, MOV, WebM up to 4MB
          </p>
        </label>
      </div>
    {/if}
  </div>

  <!-- Upload Summary -->
  {#if hasFile}
    <div class="bg-gray-50 rounded-lg p-4">
      <div class="flex items-center justify-between text-sm">
        <span class="text-gray-600">Video ready:</span>
        <span class="font-medium text-green-600">
          {formatFileSize(hasFile.size)}
        </span>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Enhanced hover and drag effects */
  .border-dashed {
    transition: all 0.3s ease;
  }
  
  .group:hover svg {
    transform: scale(1.1);
  }
</style> 