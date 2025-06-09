import { supabase } from '$lib/supabase';
import { goto } from '$app/navigation';
import type { AuthError, User } from '@supabase/supabase-js';

export interface AuthUser extends User {
  profile?: {
    name?: string;
    handicap?: number;
    goals?: any;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials extends LoginCredentials {
  name: string;
  handicap?: number;
}

export interface AuthResponse {
  success: boolean;
  error?: string;
  user?: AuthUser;
}

/**
 * Authentication service for Pure golf app
 * Handles all auth operations including login, signup, logout, and profile management
 */
export class AuthService {
  /**
   * Sign in with email and password
   */
  static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, user: data.user as AuthUser };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Sign up new user with email and password
   */
  static async signup(credentials: SignupCredentials): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            name: credentials.name,
            handicap: credentials.handicap,
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // Create user profile
      if (data.user) {
        await this.createUserProfile(data.user.id, {
          name: credentials.name,
          handicap: credentials.handicap,
        });
      }

      return { success: true, user: data.user as AuthUser };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Sign out current user
   */
  static async logout(): Promise<AuthResponse> {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        return { success: false, error: error.message };
      }

      goto('/');
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to sign out' };
    }
  }

  /**
   * Get current user session
   */
  static async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.user as AuthUser || null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  /**
   * Sign in with OAuth provider (Google, etc.)
   */
  static async signInWithOAuth(provider: 'google' | 'apple'): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'OAuth sign-in failed' };
    }
  }

  /**
   * Reset password
   */
  static async resetPassword(email: string): Promise<AuthResponse> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to send reset email' };
    }
  }

  /**
   * Update password
   */
  static async updatePassword(newPassword: string): Promise<AuthResponse> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to update password' };
    }
  }

  /**
   * Create user profile in database
   */
  static async createUserProfile(userId: string, profile: { name: string; handicap?: number }): Promise<void> {
    try {
      const { error } = await supabase.from('users').insert({
        id: userId,
        email: '', // Will be updated by trigger
        name: profile.name,
        handicap: profile.handicap,
        goals: null,
      });

      if (error) {
        console.error('Error creating user profile:', error);
      }
    } catch (error) {
      console.error('Error creating user profile:', error);
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(updates: Partial<{ name: string; handicap: number; goals: any }>): Promise<AuthResponse> {
    try {
      const user = await this.getCurrentUser();
      if (!user) {
        return { success: false, error: 'No authenticated user' };
      }

      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to update profile' };
    }
  }

  /**
   * Get user profile from database
   */
  static async getUserProfile(userId?: string): Promise<any> {
    try {
      const targetUserId = userId || (await this.getCurrentUser())?.id;
      if (!targetUserId) return null;

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', targetUserId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }
} 