<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { supabase } from '../../lib/supabase';
  import Button from '../ui/Button.svelte';
  import Card from '../ui/Card.svelte';
  
  export let swingId: string | null = null;
  export let userEmail: string;

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  let messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }> = [];
  
  let newMessage = '';
  let isLoading = false;
  let chatContainer: HTMLElement;

  onMount(() => {
    // Welcome message from Coach Oliver
    const welcomeMessage = swingId 
      ? "Hello! I'm Coach Oliver, your personal golf instructor. I see you've uploaded a swing - let's discuss it! Or feel free to ask me anything about golf."
      : "Hello! I'm Coach Oliver, your personal golf instructor. I'm here to help you improve your game. Feel free to ask about swing fundamentals, course strategy, equipment, or anything golf-related. Ready to get started?";
    
    addMessage('assistant', welcomeMessage);
  });

  function addMessage(role: 'user' | 'assistant', content: string) {
    messages = [...messages, {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date()
    }];
    
    // Scroll to bottom
    setTimeout(() => {
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 100);
  }

  async function sendMessage() {
    if (!newMessage.trim() || isLoading) return;
    
    const userMsg = newMessage.trim();
    newMessage = '';
    
    // Add user message
    addMessage('user', userMsg);
    
    try {
      isLoading = true;
      
      // Get current session token properly
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Not authenticated');
      }

      // Call our chat API
      const response = await fetch(`/api/chat/${swingId || 'general'}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMsg,
          chat_history: messages.slice(-10) // Last 10 messages for context
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response from Coach Oliver');
      }

      const data = await response.json();
      addMessage('assistant', data.response);
      
    } catch (error) {
      console.error('Chat error:', error);
      addMessage('assistant', "I apologize, but I'm having trouble connecting right now. Please try again in a moment.");
    } finally {
      isLoading = false;
    }
  }

  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function handleClose() {
    dispatch('close');
  }
</script>

<div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
  <div class="glass rounded-3xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="glass-gold p-6 border-b border-surface-border/20">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <div class="w-12 h-12 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center">
            <span class="text-2xl" role="img" aria-label="Coach Oliver">🏌️‍♂️</span>
          </div>
          <div>
            <h2 class="text-2xl font-heading font-bold text-onSurface-strong">Coach Oliver</h2>
            <p class="text-sm text-onSurface-medium">Your Personal Golf Instructor</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" on:click={handleClose}>
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Button>
      </div>
    </div>

    <!-- Chat Messages -->
    <div 
      bind:this={chatContainer}
      class="flex-1 overflow-y-auto p-6 space-y-4"
    >
      {#each messages as message (message.id)}
        <div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
          <div class="{message.role === 'user' ? 'user-message' : 'coach-message'} max-w-md">
            <p class="text-sm leading-relaxed">{message.content}</p>
            <span class="text-xs opacity-60 mt-2 block">
              {message.timestamp.toLocaleTimeString()}
            </span>
          </div>
        </div>
      {/each}
      
      {#if isLoading}
        <div class="flex justify-start">
          <div class="coach-message max-w-md">
            <div class="flex items-center space-x-2">
              <div class="w-2 h-2 bg-accent-600 rounded-full animate-bounce"></div>
              <div class="w-2 h-2 bg-accent-600 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
              <div class="w-2 h-2 bg-accent-600 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
              <span class="text-sm text-onSurface-medium">Coach Oliver is thinking...</span>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Message Input -->
    <div class="glass-sage p-6 border-t border-surface-border/20">
      <div class="flex space-x-4">
        <textarea
          bind:value={newMessage}
          on:keypress={handleKeyPress}
          placeholder="Ask Coach Oliver anything about golf..."
          class="flex-1 input-field resize-none h-12 py-3"
          disabled={isLoading}
        ></textarea>
        <Button
          variant="primary"
          on:click={sendMessage}
          disabled={!newMessage.trim() || isLoading}
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </Button>
      </div>
      
      <!-- Quick Suggestions -->
      <div class="mt-4 flex flex-wrap gap-2">
        <button 
          class="px-3 py-1 text-xs glass rounded-full hover:glass-sage transition-all text-onSurface-medium hover:text-onSurface-strong"
          on:click={() => newMessage = "How can I improve my driver accuracy?"}
        >
          Driver tips
        </button>
        <button 
          class="px-3 py-1 text-xs glass rounded-full hover:glass-sage transition-all text-onSurface-medium hover:text-onSurface-strong"
          on:click={() => newMessage = "What should I practice to lower my handicap?"}
        >
          Lower handicap
        </button>
        <button 
          class="px-3 py-1 text-xs glass rounded-full hover:glass-sage transition-all text-onSurface-medium hover:text-onSurface-strong"
          on:click={() => newMessage = "Explain how Pure Golf's video analysis works"}
        >
          How Pure works
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .glass {
    backdrop-filter: blur(12px);
    background: var(--glass-white);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .glass-gold {
    backdrop-filter: blur(8px);
    background: var(--glass-gold);
    border: 1px solid rgba(242, 205, 55, 0.3);
  }
  
  .glass-sage {
    backdrop-filter: blur(12px);
    background: var(--glass-sage);
    border: 1px solid rgba(122, 184, 148, 0.25);
  }

  .coach-message {
    backdrop-filter: blur(8px);
    background: var(--glass-gold);
    border: 1px solid rgba(242, 205, 55, 0.3);
    border-radius: 1rem;
    padding: 1rem;
  }

  .user-message {
    background: var(--sage-500);
    color: var(--augusta-50);
    border-radius: 1rem;
    padding: 1rem;
    margin-left: auto;
  }
</style> 