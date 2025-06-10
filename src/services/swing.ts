import { supabase } from '$lib/supabase';
import type { SwingCategory, VideoUrls } from '$lib/supabase';
import { featureFlags } from '$lib/feature-flags';

export type RecordingState = 'setup' | 'recording' | 'recorded' | 'complete';
export type AngleType = 'down_line' | 'face_on' | 'overhead';

export interface SwingSession {
  category: SwingCategory;
  recordings: Record<AngleType, Blob | File | null>;
  currentAngle: AngleType;
  state: RecordingState;
  uploadProgress: Record<AngleType, number>;
  uploadUrls?: VideoUrls;
  swingId?: string;
  uploadMode: 'record' | 'upload';
}

export interface UploadResponse {
  success: boolean;
  swingId?: string;
  error?: string;
}

export interface PresignedUrlResponse {
  success: boolean;
  urls?: VideoUrls;
  error?: string;
}

/**
 * Swing recording and upload service
 * Handles video capture state management and backend integration
 */
export class SwingService {
  /**
   * Initialize a new swing recording session
   */
  static createSession(category: SwingCategory, mode: 'record' | 'upload' = 'record'): SwingSession {
    return {
      category,
      recordings: {
        down_line: null,
        face_on: null,
        overhead: null
      },
      currentAngle: 'down_line',
      state: 'setup',
      uploadProgress: {
        down_line: 0,
        face_on: 0,
        overhead: 0
      },
      uploadMode: mode
    };
  }

  /**
   * Add a recording to the session
   */
  static addRecording(
    session: SwingSession, 
    angle: AngleType, 
    blob: Blob
  ): SwingSession {
    const updatedSession = {
      ...session,
      recordings: {
        ...session.recordings,
        [angle]: blob
      }
    };

    // Check if all recordings are complete
    const allRecorded = Object.values(updatedSession.recordings).every(r => r !== null);
    if (allRecorded) {
      updatedSession.state = 'complete';
    }

    return updatedSession;
  }

  /**
   * Add a file upload to the session
   */
  static addFileUpload(session: SwingSession, angle: AngleType, file: File): SwingSession {
    const updatedSession = {
      ...session,
      recordings: {
        ...session.recordings,
        [angle]: file
      }
    };

    // Check if all recordings are complete
    const allRecorded = Object.values(updatedSession.recordings).every(r => r !== null);
    if (allRecorded) {
      updatedSession.state = 'complete';
    }

    return updatedSession;
  }

  /**
   * Remove a recording/file from the session
   */
  static removeRecording(session: SwingSession, angle: AngleType): SwingSession {
    const updatedSession = {
      ...session,
      recordings: {
        ...session.recordings,
        [angle]: null
      }
    };

    // Update state based on remaining recordings
    const hasAnyRecording = Object.values(updatedSession.recordings).some(r => r !== null);
    updatedSession.state = hasAnyRecording ? 'recorded' : 'setup';

    return updatedSession;
  }

  /**
   * Get presigned upload URLs from the backend
   */
  static async getPresignedUrls(category: SwingCategory): Promise<PresignedUrlResponse> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch('/api/swing/presign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ category })
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.error?.message || 'Failed to get upload URLs' };
      }

      const data = await response.json();
      return { success: true, urls: data.urls };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Network error' 
      };
    }
  }

  /**
   * Upload video blob/file to presigned URL with progress tracking
   */
  static async uploadVideo(
    blob: Blob | File, 
    presignedUrl: string,
    onProgress?: (progress: number) => void
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(true);
        } else {
          reject(new Error(`Upload failed with status: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed due to network error'));
      });

      xhr.open('PUT', presignedUrl);
      xhr.setRequestHeader('Content-Type', blob.type);
      xhr.send(blob);
    });
  }

  /**
   * Upload files using the new backend proxy (Feature Flag)
   */
  static async uploadSessionBackend(
    session: SwingSession,
    mode: 'training' | 'quick' = 'training',
    onProgress?: (progress: number) => void
  ): Promise<UploadResponse> {
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) {
        return { success: false, error: 'Not authenticated' };
      }

      // Prepare FormData
      const formData = new FormData();
      formData.append('category', session.category);
      formData.append('mode', mode);

      // Get the expected angles based on mode
      const expectedAngles = mode === 'quick' ? ['single'] : ['down_line', 'face_on', 'overhead'];
      
      // Add files to FormData
      let hasAllFiles = true;
      for (const angle of expectedAngles) {
        const recording = session.recordings[angle as AngleType];
        if (!recording) {
          hasAllFiles = false;
          break;
        }
        
        // Convert Blob to File if needed
        const file = recording instanceof File 
          ? recording 
          : new File([recording], `${angle}.webm`, { type: recording.type });
          
        formData.append(`file_${angle}`, file);
      }

      if (!hasAllFiles) {
        return { success: false, error: 'Missing required video files' };
      }

      // Upload with progress tracking
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable && onProgress) {
            const progress = Math.round((event.loaded / event.total) * 100);
            onProgress(progress);
          }
        });

        xhr.addEventListener('load', () => {
          try {
            if (xhr.status >= 200 && xhr.status < 300) {
              const response = JSON.parse(xhr.responseText);
              if (response.success) {
                // Use swingId if available, otherwise fall back to uploadSession
                resolve({ success: true, swingId: response.swingId || response.uploadSession });
              } else {
                resolve({ 
                  success: false, 
                  error: response.errors?.join(', ') || 'Upload failed' 
                });
              }
            } else {
              const errorResponse = JSON.parse(xhr.responseText);
              resolve({ 
                success: false, 
                error: errorResponse.error?.message || `Upload failed with status: ${xhr.status}` 
              });
            }
          } catch (error) {
            resolve({ 
              success: false, 
              error: 'Failed to parse server response' 
            });
          }
        });

        xhr.addEventListener('error', () => {
          resolve({ success: false, error: 'Upload failed due to network error' });
        });

        xhr.open('POST', '/api/upload');
        xhr.setRequestHeader('Authorization', `Bearer ${authSession.access_token}`);
        xhr.send(formData);
      });

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload preparation failed' 
      };
    }
  }

  /**
   * Upload all recordings in a session (with feature flag support)
   */
  static async uploadSession(
    session: SwingSession,
    mode: 'training' | 'quick' = 'training',
    onProgress?: (angle: AngleType, progress: number) => void
  ): Promise<UploadResponse> {
    // Use feature flag to determine upload method
    if (featureFlags.useBackendUpload) {
      console.log('🚀 Using backend upload proxy');
      return this.uploadSessionBackend(session, mode, (progress) => {
        // Distribute progress across all angles for backward compatibility
        const angles: AngleType[] = mode === 'quick' ? ['down_line'] : ['down_line', 'face_on', 'overhead'];
        angles.forEach(angle => onProgress?.(angle, progress));
      });
    }

    // Legacy presigned URL upload
    console.log('📋 Using presigned URL upload');
    try {
      // Get presigned URLs
      const urlResponse = await this.getPresignedUrls(session.category);
      if (!urlResponse.success || !urlResponse.urls) {
        return { success: false, error: urlResponse.error };
      }

      const { urls } = urlResponse;

      // Upload all videos in parallel
      const uploadPromises = Object.entries(session.recordings).map(async ([angle, blob]) => {
        if (!blob) throw new Error(`No recording for ${angle}`);
        
        const angleType = angle as AngleType;
        const presignedUrl = urls[angleType];
        
        await this.uploadVideo(blob, presignedUrl, (progress) => {
          onProgress?.(angleType, progress);
        });

        return { angle: angleType, url: presignedUrl.split('?')[0] }; // Remove query params
      });

      await Promise.all(uploadPromises);

      // Submit swing record to backend
      const submitResponse = await this.submitSwing(session.category, urls);
      return submitResponse;

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed' 
      };
    }
  }

  /**
   * Submit swing record to backend after successful upload
   */
  static async submitSwing(
    category: SwingCategory, 
    videoUrls: VideoUrls
  ): Promise<UploadResponse> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch('/api/swing/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          category,
          video_urls: videoUrls
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.error?.message || 'Failed to submit swing' };
      }

      const data = await response.json();
      return { success: true, swingId: data.swing_id };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Submission failed' 
      };
    }
  }

  /**
   * Get swing analysis status
   */
  static async getSwingStatus(swingId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('pure.swings')
        .select('*')
        .eq('id', swingId)
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      console.error('Error fetching swing status:', error);
      return null;
    }
  }

  /**
   * Validate video blob/file constraints
   */
  static validateRecording(blob: Blob | File): { valid: boolean; error?: string } {
    // Check file size (max 200MB)
    const maxSize = 200 * 1024 * 1024; // 200MB in bytes
    if (blob.size > maxSize) {
      return { 
        valid: false, 
        error: `Video too large: ${Math.round(blob.size / 1024 / 1024)}MB. Max size is 200MB.` 
      };
    }

    // Check if it's a video
    if (!blob.type.startsWith('video/')) {
      return { valid: false, error: 'Invalid file type. Must be a video.' };
    }

    return { valid: true };
  }

  /**
   * Clean up blob URLs to prevent memory leaks
   */
  static cleanupBlobs(recordings: Record<AngleType, Blob | null>): void {
    Object.values(recordings).forEach(blob => {
      if (blob) {
        // Note: Only cleanup if we created object URLs (not needed for MediaRecorder blobs)
        // URL.revokeObjectURL(blobUrl);
      }
    });
  }
} 