/**
 * Camera utility functions
 */

/**
 * Generate unique filename for lie photos
 */
export function generateLiePhotoFilename(
  roundId: string, 
  holeNumber: number, 
  shotNumber: number
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `lie-photo-${roundId}-h${holeNumber}-s${shotNumber}-${timestamp}.webp`;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Format dimensions for display
 */
export function formatDimensions(width: number, height: number): string {
  return `${width} × ${height}`;
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string | null {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || null : null;
}

/**
 * Create a download link for photo
 */
export function createDownloadLink(blob: Blob, filename: string): string {
  return URL.createObjectURL(blob);
}

/**
 * Clean up object URL
 */
export function revokeObjectUrl(url: string): void {
  URL.revokeObjectURL(url);
}

/**
 * Convert blob to base64 string
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix to get just the base64
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to convert blob to base64'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Get MIME type from file extension
 */
export function getMimeTypeFromExtension(extension: string): string | null {
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp'
  };

  return mimeTypes[extension.toLowerCase()] || null;
}

/**
 * Check if device likely has a back camera (mobile detection)
 */
export function isLikelyMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Get recommended facing mode based on device
 */
export function getRecommendedFacingMode(): 'environment' | 'user' {
  // For mobile devices, prefer back camera for lie photos
  // For desktop, front camera is usually the only option
  return isLikelyMobileDevice() ? 'environment' : 'user';
}

/**
 * Constants for golf-specific camera settings
 */
export const GOLF_CAMERA_SETTINGS = {
  // Optimal settings for lie photos
  LIE_PHOTO: {
    maxWidth: 1280,
    maxHeight: 1280,
    quality: 0.85,
    format: 'webp' as const,
    maxSizeBytes: 2 * 1024 * 1024 // 2MB
  },
  
  // High quality settings for detailed analysis
  HIGH_QUALITY: {
    maxWidth: 1920,
    maxHeight: 1920,
    quality: 0.9,
    format: 'webp' as const,
    maxSizeBytes: 5 * 1024 * 1024 // 5MB
  },
  
  // Quick preview settings
  PREVIEW: {
    maxWidth: 640,
    maxHeight: 640,
    quality: 0.7,
    format: 'webp' as const,
    maxSizeBytes: 500 * 1024 // 500KB
  }
} as const; 