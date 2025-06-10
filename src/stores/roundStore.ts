import { writable, derived } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';

export interface Course {
  id: string;
  name: string;
  location: [number, number];
  holes: Hole[];
}

export interface Hole {
  id: string;
  hole_number: number;
  par: number;
  handicap?: number;
  yardages: Record<string, number>;
  description?: string;
}

export interface Round {
  id: string;
  course_id: string;
  course?: Course;
  tee_set: string;
  started_at: string;
  finished_at?: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  total_score?: number;
  weather?: {
    temperature?: number;
    wind_speed?: number;
    wind_direction?: string;
    conditions?: string;
  };
  notes?: string;
}

export interface Shot {
  id?: string;
  round_id: string;
  hole_number: number;
  shot_number: number;
  distance_to_target?: number;
  lie_type?: string;
  lie_photo_url?: string;
  club_recommended?: string;
  club_used?: string;
  shot_result?: string;
  distance_achieved?: number;
  accuracy_rating?: number;
  gps_location?: [number, number];
  ai_confidence?: number;
}

export interface RoundState {
  currentRound: Round | null;
  currentHole: number;
  currentShots: Shot[];
  isLoading: boolean;
  error: string | null;
}

// Initial state
const initialState: RoundState = {
  currentRound: null,
  currentHole: 1,
  currentShots: [],
  isLoading: false,
  error: null
};

// Main round store
export const roundStore: Writable<RoundState> = writable(initialState);

// Derived stores for convenience
export const currentRound: Readable<Round | null> = derived(
  roundStore,
  ($roundStore) => $roundStore.currentRound
);

export const currentHole: Readable<number> = derived(
  roundStore,
  ($roundStore) => $roundStore.currentHole
);

export const currentHoleData: Readable<Hole | null> = derived(
  roundStore,
  ($roundStore) => {
    if (!$roundStore.currentRound?.course?.holes) return null;
    return $roundStore.currentRound.course.holes.find(
      h => h.hole_number === $roundStore.currentHole
    ) || null;
  }
);

export const currentShots: Readable<Shot[]> = derived(
  roundStore,
  ($roundStore) => $roundStore.currentShots.filter(
    shot => shot.hole_number === $roundStore.currentHole
  )
);

export const totalScore: Readable<number> = derived(
  roundStore,
  ($roundStore) => {
    // Calculate current total score based on completed holes
    // This is a simplified calculation - in a real app you'd want more sophisticated scoring
    return $roundStore.currentShots.reduce((total, shot) => {
      if (shot.shot_result === 'holed') {
        return total + shot.shot_number;
      }
      return total;
    }, 0);
  }
);

export const isRoundActive: Readable<boolean> = derived(
  roundStore,
  ($roundStore) => $roundStore.currentRound?.status === 'in_progress'
);

// Round actions
export const roundActions = {
  // Start a new round
  startRound: (round: Round) => {
    roundStore.update(state => ({
      ...state,
      currentRound: round,
      currentHole: 1,
      currentShots: [],
      error: null
    }));
  },

  // Set current round (for loading existing rounds)
  setRound: (round: Round, shots: Shot[] = []) => {
    roundStore.update(state => ({
      ...state,
      currentRound: round,
      currentShots: shots,
      error: null
    }));
  },

  // Move to next hole
  nextHole: () => {
    roundStore.update(state => {
      if (!state.currentRound?.course?.holes) return state;
      
      const maxHoles = state.currentRound.course.holes.length;
      const nextHole = Math.min(state.currentHole + 1, maxHoles);
      
      return {
        ...state,
        currentHole: nextHole
      };
    });
  },

  // Move to previous hole
  previousHole: () => {
    roundStore.update(state => ({
      ...state,
      currentHole: Math.max(state.currentHole - 1, 1)
    }));
  },

  // Go to specific hole
  goToHole: (holeNumber: number) => {
    roundStore.update(state => {
      if (!state.currentRound?.course?.holes) return state;
      
      const maxHoles = state.currentRound.course.holes.length;
      const validHole = Math.max(1, Math.min(holeNumber, maxHoles));
      
      return {
        ...state,
        currentHole: validHole
      };
    });
  },

  // Add a shot
  addShot: (shot: Shot) => {
    roundStore.update(state => ({
      ...state,
      currentShots: [...state.currentShots, shot]
    }));
  },

  // Update a shot
  updateShot: (shotId: string, updates: Partial<Shot>) => {
    roundStore.update(state => ({
      ...state,
      currentShots: state.currentShots.map(shot =>
        shot.id === shotId ? { ...shot, ...updates } : shot
      )
    }));
  },

  // Remove a shot
  removeShot: (shotId: string) => {
    roundStore.update(state => ({
      ...state,
      currentShots: state.currentShots.filter(shot => shot.id !== shotId)
    }));
  },

  // Update round metadata
  updateRound: (updates: Partial<Round>) => {
    roundStore.update(state => ({
      ...state,
      currentRound: state.currentRound ? {
        ...state.currentRound,
        ...updates
      } : null
    }));
  },

  // Finish the round
  finishRound: () => {
    roundStore.update(state => ({
      ...state,
      currentRound: state.currentRound ? {
        ...state.currentRound,
        status: 'completed' as const,
        finished_at: new Date().toISOString()
      } : null
    }));
  },

  // Abandon the round
  abandonRound: () => {
    roundStore.update(state => ({
      ...state,
      currentRound: state.currentRound ? {
        ...state.currentRound,
        status: 'abandoned' as const,
        finished_at: new Date().toISOString()
      } : null
    }));
  },

  // Set loading state
  setLoading: (loading: boolean) => {
    roundStore.update(state => ({
      ...state,
      isLoading: loading
    }));
  },

  // Set error
  setError: (error: string | null) => {
    roundStore.update(state => ({
      ...state,
      error
    }));
  },

  // Clear round (for ending/resetting)
  clearRound: () => {
    roundStore.set(initialState);
  },

  // Get current round data (for API calls)
  getCurrentRound: (): Round | null => {
    let current: Round | null = null;
    roundStore.subscribe(state => {
      current = state.currentRound;
    })();
    return current;
  }
};

// Persistence helpers
export const roundPersistence = {
  // Save round state to localStorage
  saveToStorage: () => {
    roundStore.subscribe(state => {
      if (state.currentRound) {
        localStorage.setItem('pure-current-round', JSON.stringify({
          round: state.currentRound,
          currentHole: state.currentHole,
          shots: state.currentShots
        }));
      }
    })();
  },

  // Load round state from localStorage
  loadFromStorage: () => {
    if (typeof window === 'undefined') return;
    
    const saved = localStorage.getItem('pure-current-round');
    if (saved) {
      try {
        const { round, currentHole, shots } = JSON.parse(saved);
        roundStore.update(state => ({
          ...state,
          currentRound: round,
          currentHole,
          currentShots: shots
        }));
      } catch (error) {
        console.error('Failed to load round from storage:', error);
      }
    }
  },

  // Clear saved round
  clearStorage: () => {
    localStorage.removeItem('pure-current-round');
  }
}; 