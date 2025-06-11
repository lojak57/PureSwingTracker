import { supabase } from '$lib/supabase';
import type { SwingCategory, VideoUrls } from '$lib/supabase';

export type RecordingState = 'setup' | 'recording' | 'recorded' | 'complete';
export type AngleType = 'down_line' | 'face_on' | 'overhead' | 'single';

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
        overhead: null,
        single: null
      },
      currentAngle: 'single',
      state: 'setup',
      uploadProgress: {
        down_line: 0,
        face_on: 0,
        overhead: 0,
        single: 0
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
   * Get presigned upload URLs from the backend (single video mode)
   */
  static async getPresignedUrls(category: SwingCategory, mode: 'training' | 'quick' = 'training'): Promise<PresignedUrlResponse> {
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
        body: JSON.stringify({ category, mode })
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
   * Upload all recordings in a session (with feature flag support)
   */
  static async uploadSession(
    session: SwingSession,
    mode: 'training' | 'quick' = 'training',
    onProgress?: (angle: AngleType, progress: number) => void
  ): Promise<UploadResponse> {
    console.log('✅ FORCING presigned upload - bypassing backend proxy');
    
    try {
      // Get the first available recording (single video)
      let videoFile: File | Blob | null = null;
      for (const [angle, recording] of Object.entries(session.recordings)) {
        if (recording) {
          videoFile = recording;
          break;
        }
      }

      if (!videoFile) {
        return { success: false, error: 'No video file available' };
      }

      // Get presigned URL for single video upload
      const urlResponse = await this.getPresignedUrls(session.category, mode);
      if (!urlResponse.success || !urlResponse.urls) {
        return { success: false, error: urlResponse.error };
      }

      const { urls } = urlResponse;
      const presignedUrl = urls.single || urls.face_on || Object.values(urls)[0];
      
      if (!presignedUrl) {
        return { success: false, error: 'No presigned URL available' };
      }

      console.log('🎯 Direct PUT to R2:', presignedUrl);

      // Upload directly to R2 with progress tracking
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable && onProgress) {
            const progress = Math.round((event.loaded / event.total) * 100);
            onProgress('single', progress);
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
        xhr.setRequestHeader('Content-Type', videoFile.type || 'video/webm');
        xhr.send(videoFile);
      });

      console.log('✅ Video uploaded to R2, now submitting metadata...');

      // Submit swing metadata to trigger GPT analysis
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) {
        return { success: false, error: 'Not authenticated for submission' };
      }

      const submitResponse = await fetch('/api/swing/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession.access_token}`
        },
        body: JSON.stringify({
          category: session.category,
          mode: mode,
          video_urls: {
            single: presignedUrl.split('?')[0] // Remove query params for storage
          }
        })
      });

      if (!submitResponse.ok) {
        const errorData = await submitResponse.json();
        return { 
          success: false, 
          error: errorData.error?.message || 'Failed to submit swing for analysis' 
        };
      }

      const submitData = await submitResponse.json();
      
      return { 
        success: true, 
        swingId: submitData.swing_id || submitData.swingId 
      };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed' 
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
    // Check file size (max 4MB for backend upload)
    const maxSize = 4 * 1024 * 1024; // 4MB in bytes
    if (blob.size > maxSize) {
      return { 
        valid: false, 
        error: `Video too large: ${Math.round(blob.size / 1024 / 1024)}MB. Max size is 4MB.` 
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