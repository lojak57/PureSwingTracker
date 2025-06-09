<script lang="ts">
  export let steps: string[] = [];
  export let currentStep: number = 0;
</script>

<div class="mb-8">
  <div class="flex items-center justify-between">
    {#each steps as step, index}
      <div class="flex items-center {index < steps.length - 1 ? 'flex-1' : ''}">
        <!-- Step Circle -->
        <div class="flex items-center justify-center w-10 h-10 rounded-full border-2 
                    {index <= currentStep 
                      ? 'bg-primary-600 border-primary-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-500'}">
          {#if index < currentStep}
            <!-- Completed step -->
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
          {:else}
            <!-- Step number -->
            <span class="text-sm font-medium">{index + 1}</span>
          {/if}
        </div>
        
        <!-- Step Label -->
        <div class="ml-3 flex-1">
          <h3 class="text-sm font-medium {index <= currentStep ? 'text-primary-600' : 'text-gray-500'}">
            {step}
          </h3>
        </div>
        
        <!-- Connector Line -->
        {#if index < steps.length - 1}
          <div class="flex-1 h-px mx-4 
                      {index < currentStep ? 'bg-primary-600' : 'bg-gray-300'}">
          </div>
        {/if}
      </div>
    {/each}
  </div>
  
  <!-- Mobile Progress Bar -->
  <div class="mt-4 md:hidden">
    <div class="bg-gray-200 rounded-full h-2">
      <div 
        class="bg-primary-600 h-2 rounded-full transition-all duration-300"
        style="width: {((currentStep + 1) / steps.length) * 100}%"
      ></div>
    </div>
    <div class="mt-2 text-center">
      <span class="text-sm text-gray-600">
        Step {currentStep + 1} of {steps.length}: {steps[currentStep]}
      </span>
    </div>
  </div>
</div> 