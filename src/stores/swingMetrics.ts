import { writable } from 'svelte/store';
import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

export interface SwingMetrics {
  id: string;
  swing_id: string;
  tempo_ratio: number;
  plane_delta: number;
  hip_sway_cm: number;
  x_factor?: number;
  video_hash?: string;
  confidence?: number;
  processing_time_ms?: number;
  cached?: boolean;
  created_at: string;
}

export const swingMetrics = writable<SwingMetrics | null>(null);
export const isAnalyzing = writable<boolean>(false);

let currentChannel: RealtimeChannel | null = null;

export function subscribeToMetrics(swingId: string, userToken: string) {
  // Clean up existing subscription
  if (currentChannel) {
    supabase.removeChannel(currentChannel);
  }

  isAnalyzing.set(true);
  swingMetrics.set(null);

  // Case-sensitive table name in filter!
  currentChannel = supabase
    .channel(`swing_metrics:swing_id=${swingId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'pure',  
      table: 'swing_metrics',  // lowercase table name
      filter: `swing_id=eq.${swingId}`
    }, (payload) => {
      console.log('📊 Received metrics update:', payload.new);
      swingMetrics.set(payload.new as SwingMetrics);
      isAnalyzing.set(false);
    })
    .subscribe();

  console.log(`🔗 Subscribed to metrics for swing: ${swingId}`);

  // Return cleanup function
  return () => {
    if (currentChannel) {
      supabase.removeChannel(currentChannel);
      currentChannel = null;
    }
    isAnalyzing.set(false);
  };
}

// Check if metrics already exist for a swing
export async function getExistingMetrics(swingId: string, userToken: string): Promise<SwingMetrics | null> {
  try {
    // Create user-specific client with JWT
    const userClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${userToken}`
        }
      }
    });

    const { data, error } = await userClient
      .from('swing_metrics')
      .select('*')
      .eq('swing_id', swingId)
      .single();

    if (error && error.code !== 'PGRST116') { // Not found is OK
      console.error('Error fetching existing metrics:', error);
      return null;
    }

    if (data) {
      console.log('📊 Found existing metrics:', data);
      const metrics = data as SwingMetrics;
      swingMetrics.set(metrics);
      isAnalyzing.set(false);
      return metrics;
    }

    return null;
  } catch (error) {
    console.error('Error checking existing metrics:', error);
    return null;
  }
} 