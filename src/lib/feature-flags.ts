/**
 * Feature Flag System for Pure Golf
 * Enables gradual rollout of new features
 */

export interface FeatureFlags {
  useBackendUpload: boolean;
  enableQuotaEnforcement: boolean;
  enableAdvancedAnalytics: boolean;
}

// Environment-based feature flags with defaults
const getFeatureFlags = (): FeatureFlags => {
  // Check if we're in development mode
  const isDev = typeof window !== 'undefined' 
    ? window.location.hostname === 'localhost' 
    : process.env.NODE_ENV === 'development';

  return {
    // Temporarily use presigned URLs due to Vercel 4.5MB body limit
    useBackendUpload: false,
    enableQuotaEnforcement: true,
    enableAdvancedAnalytics: false,
  };
};

export const featureFlags = getFeatureFlags();

// Admin override for testing (only in browser)
export const enableFeatureFlag = (flag: keyof FeatureFlags): void => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(`ff_${flag.replace(/([A-Z])/g, '_$1').toLowerCase()}`, 'true');
    window.location.reload(); // Reload to apply changes
  }
};

export const disableFeatureFlag = (flag: keyof FeatureFlags): void => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(`ff_${flag.replace(/([A-Z])/g, '_$1').toLowerCase()}`);
    window.location.reload(); // Reload to apply changes
  }
};

// Debug helper
export const logFeatureFlags = (): void => {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('🏳️ Feature Flags:', featureFlags);
  }
}; 