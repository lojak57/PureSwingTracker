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
   * Upload all recordings in a session (conditional strategy based on file size)
   */
  static async uploadSession(
    session: SwingSession,
    mode: 'training' | 'quick' = 'training',
    onProgress?: (angle: AngleType, progress: number) => void
  ): Promise<UploadResponse> {
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) {
        return { success: false, error: 'Not authenticated' };
      }

      // Get the first available recording (single video)
      let videoFile: File | null = null;
      for (const [angle, recording] of Object.entries(session.recordings)) {
        if (recording) {
          videoFile = recording instanceof File 
            ? recording 
            : new File([recording], `swing-video.webm`, { type: recording.type });
          break;
        }
      }

      if (!videoFile) {
        return { success: false, error: 'No video file available' };
      }

      const fileSizeMB = (videoFile.size / 1024 / 1024);
      console.log('📹 Video file details:', {
        name: videoFile.name,
        size: videoFile.size,
        type: videoFile.type,
        sizeMB: fileSizeMB.toFixed(2)
      });

      // Conditional upload strategy based on file size
      const VERCEL_LIMIT_MB = 4;
      
      if (fileSizeMB > VERCEL_LIMIT_MB) {
        console.log(`🚀 LARGE FILE (${fileSizeMB.toFixed(2)}MB): Using direct Worker upload to bypass Vercel 4MB limit`);
        return await this.uploadLargeFileToWorker(
          videoFile, 
          session.category, 
          mode, 
          onProgress ? (progress) => onProgress('single', progress) : undefined
        );
      } else {
        console.log(`📤 SMALL FILE (${fileSizeMB.toFixed(2)}MB): Using Vercel backend upload`);
        return await this.uploadViaBackend(videoFile, session.category, mode, onProgress);
      }

    } catch (error) {
      console.error('❌ Upload preparation failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload preparation failed' 
      };
    }
  }

  /**
   * Upload via Vercel backend (for files <4MB)
   */
  static async uploadViaBackend(
    videoFile: File,
    category: string,
    mode: 'training' | 'quick',
    onProgress?: (angle: AngleType, progress: number) => void
  ): Promise<UploadResponse> {
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) {
        return { success: false, error: 'Not authenticated' };
      }

      // Prepare FormData with single video
      const formData = new FormData();
      formData.append('category', category);
      formData.append('mode', mode);
      formData.append('video', videoFile);

      console.log('📤 Uploading to backend proxy...');

      // Upload with progress tracking and detailed error handling
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable && onProgress) {
            const progress = Math.round((event.loaded / event.total) * 100);
            console.log(`📊 Upload progress: ${progress}%`);
            onProgress('single', progress);
          }
        });

        xhr.addEventListener('load', () => {
          try {
            console.log('📡 Backend response status:', xhr.status);
            console.log('📡 Backend response text:', xhr.responseText);
            
            if (xhr.status >= 200 && xhr.status < 300) {
              const response = JSON.parse(xhr.responseText);
              console.log('✅ Backend response parsed:', response);
              
              if (response.success) {
                resolve({ success: true, swingId: response.swingId || response.uploadSession });
              } else {
                resolve({ 
                  success: false, 
                  error: response.errors?.join(', ') || response.error || 'Upload failed' 
                });
              }
            } else {
              let errorMessage = `Upload failed with status: ${xhr.status}`;
              try {
                const errorResponse = JSON.parse(xhr.responseText);
                errorMessage = errorResponse.error?.message || errorResponse.message || errorMessage;
                console.error('❌ Backend error details:', errorResponse);
              } catch (parseError) {
                console.error('❌ Could not parse error response:', xhr.responseText);
              }
              
              resolve({ success: false, error: errorMessage });
            }
          } catch (error) {
            console.error('❌ Error parsing response:', error);
            resolve({ 
              success: false, 
              error: 'Failed to parse server response' 
            });
          }
        });

        xhr.addEventListener('error', () => {
          console.error('❌ Network error during upload');
          resolve({ success: false, error: 'Upload failed due to network error' });
        });

        xhr.open('POST', '/api/upload');
        xhr.setRequestHeader('Authorization', `Bearer ${authSession.access_token}`);
        xhr.send(formData);
      });

    } catch (error) {
      console.error('❌ Upload preparation failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload preparation failed' 
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
    // Check file size (max 25MB for backend upload)
    const maxSize = 25 * 1024 * 1024; // 25MB in bytes
    if (blob.size > maxSize) {
      return { 
        valid: false, 
        error: `Video too large: ${Math.round(blob.size / 1024 / 1024)}MB. Max size is 25MB.` 
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

  /**
   * Upload large files directly to Cloudflare Worker (bypass Vercel 4MB limit)
   */
  static async uploadLargeFileToWorker(
    videoFile: File,
    category: string,
    mode: 'training' | 'quick' = 'training',
    onProgress?: (progress: number) => void
  ): Promise<UploadResponse> {
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) {
        return { success: false, error: 'Not authenticated' };
      }

      // Generate upload session and key
      const uploadSession = crypto.randomUUID();
      const key = `${mode}/${authSession.user.id}/${category}/single/${uploadSession}/${videoFile.name}`;
      
      console.log(`🔧 LARGE FILE UPLOAD: Direct to Worker - size: ${videoFile.size}, key: ${key}`);

      // Cloudflare Worker R2 Proxy URL  
      const workerDomain = 'pure-golf-r2-proxy.varro-golf.workers.dev';
      const workerUrl = `https://${workerDomain}`;
      
      // Upload directly to Worker with progress tracking
      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable && onProgress) {
            const progress = Math.round((event.loaded / event.total) * 100);
            console.log(`📊 Direct Worker upload progress: ${progress}%`);
            onProgress(progress);
          }
        });

        xhr.addEventListener('load', async () => {
          try {
            console.log('📡 Worker response status:', xhr.status);
            console.log('📡 Worker response text:', xhr.responseText);
            
            if (xhr.status >= 200 && xhr.status < 300) {
              const response = JSON.parse(xhr.responseText);
              console.log('✅ Worker response parsed:', response);
              
              if (response.success) {
                // Create swing record via separate API call
                const swingId = await this.createSwingRecord(
                  key, 
                  category, 
                  mode, 
                  uploadSession, 
                  authSession.access_token
                );
                
                resolve({ success: true, swingId: swingId || undefined });
              } else {
                resolve({ 
                  success: false, 
                  error: response.error || 'Worker upload failed' 
                });
              }
            } else {
              let errorMessage = `Worker upload failed with status: ${xhr.status}`;
              try {
                const errorResponse = JSON.parse(xhr.responseText);
                errorMessage = errorResponse.error || errorMessage;
              } catch (parseError) {
                console.error('❌ Could not parse worker error response:', xhr.responseText);
              }
              
              resolve({ success: false, error: errorMessage });
            }
          } catch (error) {
            console.error('❌ Error parsing worker response:', error);
            resolve({ 
              success: false, 
              error: 'Failed to parse worker response' 
            });
          }
        });

        xhr.addEventListener('error', () => {
          console.error('❌ Network error during worker upload');
          resolve({ success: false, error: 'Upload failed due to network error' });
        });

        xhr.open('PUT', workerUrl);
        xhr.setRequestHeader('X-File-Key', key);
        xhr.setRequestHeader('Content-Type', videoFile.type);
        xhr.send(videoFile);
      });

    } catch (error) {
      console.error('❌ Large file upload preparation failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload preparation failed' 
      };
    }
  }

  /**
   * Create swing record after successful Worker upload
   */
  static async createSwingRecord(
    key: string, 
    category: string, 
    mode: string, 
    uploadSession: string, 
    accessToken: string
  ): Promise<string | null> {
    try {
      const response = await fetch('/api/swings/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          key,
          category,
          mode,
          uploadSession
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create swing record: ${response.status}`);
      }

      const result = await response.json();
      return result.swingId;
    } catch (error) {
      console.error('❌ Failed to create swing record:', error);
      return null;
    }
  }
} 