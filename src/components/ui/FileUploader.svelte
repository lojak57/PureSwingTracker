<!--
  File Upload Component for Swing Videos
  Supports drag & drop, multiple angles, and integrates with quota system
-->

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { AngleType } from '../../services/swing';
  
  export let angles: Array<{id: string, name: string, description: string, icon: string}>;
  export let existingFiles: Record<AngleType, Blob | File | null> = {
    down_line: null,
    face_on: null,
    overhead: null
  };
  export let disabled = false;

  const dispatch = createEventDispatcher<{
    fileSelected: { angleId: string; file: File };
    fileRemoved: { angleId: string };
    error: { message: string };
  }>();

  let dragOverStates: Record<string, boolean> = {};
  let uploadProgress: Record<string, number> = {};

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
  function handleFileSelect(angleId: string, file: File) {
    const validation = validateVideoFile(file);
    if (!validation.valid) {
      dispatch('error', { message: validation.error || 'Invalid file' });
      return;
    }

    dispatch('fileSelected', { angleId, file });
  }

  // Handle drag and drop
  function handleDrop(event: DragEvent, angleId: string) {
    event.preventDefault();
    dragOverStates[angleId] = false;
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFileSelect(angleId, files[0]);
    }
  }

  function handleDragOver(event: DragEvent, angleId: string) {
    event.preventDefault();
    dragOverStates[angleId] = true;
  }

  function handleDragLeave(angleId: string) {
    dragOverStates[angleId] = false;
  }

  // Handle input file selection
  function handleInputChange(event: Event, angleId: string) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      handleFileSelect(angleId, file);
    }
    // Reset input
    input.value = '';
  }

  // Remove file
  function removeFile(angleId: string) {
    dispatch('fileRemoved', { angleId });
  }

  // Format file size
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
</script>

<div class="space-y-6">
  <div class="text-center mb-6">
    <h3 class="text-lg font-medium text-gray-900 mb-2">Upload Your Swing Video</h3>
    <p class="text-sm text-gray-600">
      Upload a single swing video from any angle. Max 4MB for quick analysis.
    </p>
  </div>

  <div class="grid gap-4">
    {#each angles as angle}
      {@const hasFile = existingFiles[angle.id as AngleType]}
      {@const isDragOver = dragOverStates[angle.id]}
      
      <div class="border rounded-lg p-4">
        <div class="flex items-start space-x-4">
          <!-- Angle Info -->
          <div class="flex-shrink-0">
            <span class="text-2xl">{angle.icon}</span>
          </div>
          
          <div class="flex-1">
            <h4 class="font-medium text-gray-900">{angle.name}</h4>
            <p class="text-sm text-gray-600 mb-3">{angle.description}</p>
            
            {#if hasFile}
              <!-- File Selected State -->
              <div class="bg-green-50 border border-green-200 rounded-lg p-3">
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
                    on:click={() => removeFile(angle.id)}
                    disabled={disabled}
                    class="text-green-600 hover:text-green-800 disabled:opacity-50"
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
                class="border-2 border-dashed rounded-lg p-6 text-center transition-colors duration-200
                  {isDragOver 
                    ? 'border-blue-400 bg-blue-50' 
                    : 'border-gray-300 hover:border-gray-400'
                  }
                  {disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}"
                on:drop={(e) => handleDrop(e, angle.id)}
                on:dragover={(e) => handleDragOver(e, angle.id)}
                on:dragleave={() => handleDragLeave(angle.id)}
              >
                <input
                  type="file"
                  accept="video/*"
                  id="file-{angle.id}"
                  class="hidden"
                  {disabled}
                  on:change={(e) => handleInputChange(e, angle.id)}
                />
                
                <label for="file-{angle.id}" class="cursor-pointer block">
                  <svg class="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                  </svg>
                  
                  <p class="text-sm font-medium text-gray-900">
                    {isDragOver ? 'Drop video here' : 'Click to upload or drag & drop'}
                  </p>
                  <p class="text-xs text-gray-600 mt-1">
                    MP4, MOV, WebM up to 200MB
                  </p>
                </label>
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/each}
  </div>

  <!-- Upload Summary -->
  <div class="bg-gray-50 rounded-lg p-4">
    <div class="flex items-center justify-between text-sm">
      <span class="text-gray-600">Files selected:</span>
      <span class="font-medium">
        {Object.values(existingFiles).filter(f => f !== null).length} of {angles.length}
      </span>
    </div>
    
    {#if Object.values(existingFiles).some(f => f !== null)}
      <div class="mt-2 text-xs text-gray-500">
        Total size: {formatFileSize(
          Object.values(existingFiles)
            .filter(f => f !== null)
            .reduce((sum, file) => sum + (file?.size || 0), 0)
        )}
      </div>
    {/if}
  </div>
</div>

<style>
  /* Smooth drag and drop transitions */
  .border-dashed {
    transition: border-color 0.2s ease, background-color 0.2s ease;
  }
</style> 