<script lang="ts">
  import FileUploader from '../../components/ui/FileUploader.svelte';
  import type { AngleType } from '../../services/swing';

  let files: Record<AngleType, File | null> = {
    down_line: null,
    face_on: null,
    overhead: null
  };

  const angles = [
    {
      id: 'down_line',
      name: 'Down the Line',
      description: 'Position camera behind you, looking down your target line',
      icon: '📹'
    },
    {
      id: 'face_on',
      name: 'Face On', 
      description: 'Position camera facing you from the side',
      icon: '🎥'
    },
    {
      id: 'overhead',
      name: 'Overhead',
      description: 'Position camera above, looking down at setup', 
      icon: '📷'
    }
  ];

  function handleFileSelected(event: CustomEvent<{angleId: string, file: File}>) {
    const { angleId, file } = event.detail;
    files[angleId as AngleType] = file;
    console.log('File selected:', angleId, file.name, file.size);
  }

  function handleFileRemoved(event: CustomEvent<{angleId: string}>) {
    const { angleId } = event.detail;
    files[angleId as AngleType] = null;
    console.log('File removed:', angleId);
  }

  function handleError(event: CustomEvent<{message: string}>) {
    console.error('Upload error:', event.detail.message);
    alert('Error: ' + event.detail.message);
  }

  $: totalFiles = Object.values(files).filter(f => f !== null).length;
</script>

<svelte:head>
  <title>Test File Upload - Pure Golf</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <div class="max-w-4xl mx-auto px-4 py-6">
    <h1 class="text-3xl font-bold text-gray-900 mb-6">File Upload Test</h1>
    
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <FileUploader
        {angles}
        existingFiles={files}
        on:fileSelected={handleFileSelected}
        on:fileRemoved={handleFileRemoved}
        on:error={handleError}
      />
    </div>

    <!-- Test Results -->
    <div class="bg-white rounded-lg shadow p-6">
      <h2 class="text-xl font-semibold mb-4">Test Results</h2>
      <div class="space-y-2">
        <p><strong>Files Selected:</strong> {totalFiles} of {angles.length}</p>
        
        {#each angles as angle}
          {@const file = files[angle.id as AngleType]}
          <div class="flex items-center justify-between py-2 border-b">
            <span>{angle.name}:</span>
            <span class="text-sm {file ? 'text-green-600' : 'text-gray-400'}">
              {file ? `${file.name} (${Math.round(file.size / 1024)}KB)` : 'No file selected'}
            </span>
          </div>
        {/each}
      </div>

      <!-- Test Complete Indicator -->
      {#if totalFiles === angles.length}
        <div class="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div class="flex items-center space-x-2">
            <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span class="text-green-800 font-medium">✅ Upload component working correctly!</span>
          </div>
        </div>
      {/if}
    </div>

    <!-- Instructions -->
    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
      <h3 class="font-medium text-blue-900 mb-2">Test Instructions:</h3>
      <ol class="text-sm text-blue-800 space-y-1">
        <li>1. Try uploading video files (MP4, MOV, WebM)</li>
        <li>2. Test drag & drop functionality</li>
        <li>3. Verify file validation (200MB limit)</li>
        <li>4. Check remove file functionality</li>
        <li>5. Confirm all three angles can be uploaded</li>
      </ol>
    </div>
  </div>
</div> 