/**
 * Camera module - Production-ready photo capture for golf lie analysis
 * 
 * @example
 * ```typescript
 * import { Camera } from '$lib/camera';
 * 
 * const camera = Camera.getInstance();
 * const stream = await camera.startStream();
 * const photo = await camera.capturePhoto(videoElement);
 * await camera.uploadPhoto(photo, roundId, holeNumber, shotNumber);
 * ```
 */

// Re-export types
export type * from './types';

// Re-export utilities
export * from './utils';

// Re-export individual classes for advanced usage
export { CameraStreamManager } from './stream';
export { PhotoCapture } from './capture';
export { PhotoValidator } from './validation';

// Main Camera API - simplified interface for common use cases
import { CameraStreamManager } from './stream';
import { PhotoCapture } from './capture';
import { PhotoValidator } from './validation';
import { generateLiePhotoFilename, GOLF_CAMERA_SETTINGS } from './utils';
import type { PhotoResult, FacingMode, CaptureOptions, ValidationResult } from './types';

export class Camera {
  private static instance: Camera;
  private streamManager: CameraStreamManager;
  private currentStream: MediaStream | null = null;

  private constructor() {
    this.streamManager = CameraStreamManager.getInstance();
  }

  static getInstance(): Camera {
    if (!Camera.instance) {
      Camera.instance = new Camera();
    }
    return Camera.instance;
  }

  /**
   * Check if camera is supported on this device
   */
  isSupported(): boolean {
    return this.streamManager.isSupported();
  }

  /**
   * Start camera stream for lie photo capture
   */
  async startStream(facingMode?: FacingMode): Promise<MediaStream> {
    this.currentStream = await this.streamManager.getStream(facingMode);
    return this.currentStream;
  }

  /**
   * Stop current camera stream
   */
  stopStream(): void {
    this.streamManager.stopCurrentStream();
    this.currentStream = null;
  }

  /**
   * Capture lie photo from video element
   */
  async capturePhoto(
    video: HTMLVideoElement,
    options: CaptureOptions = GOLF_CAMERA_SETTINGS.LIE_PHOTO
  ): Promise<PhotoResult> {
    // Validate camera settings first
    const cameraValidation = PhotoValidator.validateCameraSettings(video);
    if (!cameraValidation.isValid) {
      throw new Error(`Camera not ready: ${cameraValidation.errors.join(', ')}`);
    }

    // Capture photo
    const photo = await PhotoCapture.fromVideo(video, options);

    // Validate result
    const photoValidation = PhotoValidator.validate(photo, options);
    if (!photoValidation.isValid) {
      throw new Error(`Photo validation failed: ${photoValidation.errors.join(', ')}`);
    }

    return photo;
  }

  /**
   * Process uploaded file
   */
  async processFile(
    file: File,
    options: CaptureOptions = GOLF_CAMERA_SETTINGS.LIE_PHOTO
  ): Promise<PhotoResult> {
    // Validate file first
    const fileValidation = PhotoValidator.validateFile(file);
    if (!fileValidation.isValid) {
      throw new Error(`File validation failed: ${fileValidation.errors.join(', ')}`);
    }

    // Process file
    const photo = await PhotoCapture.fromFile(file, options);

    // Validate result
    const photoValidation = PhotoValidator.validate(photo, options);
    if (!photoValidation.isValid) {
      throw new Error(`Photo validation failed: ${photoValidation.errors.join(', ')}`);
    }

    return photo;
  }

  /**
   * Get available camera devices
   */
  async getDevices() {
    return this.streamManager.getDevices();
  }

  /**
   * Get supported facing modes
   */
  async getSupportedFacingModes() {
    return this.streamManager.getSupportedFacingModes();
  }

  /**
   * Generate filename for lie photo
   */
  generateFilename(roundId: string, holeNumber: number, shotNumber: number): string {
    return generateLiePhotoFilename(roundId, holeNumber, shotNumber);
  }

  /**
   * Validate photo without processing
   */
  validatePhoto(photo: PhotoResult, options?: CaptureOptions): ValidationResult {
    return PhotoValidator.validate(photo, options);
  }

  /**
   * Get current stream status
   */
  get isStreamActive(): boolean {
    return this.currentStream !== null && this.currentStream.active;
  }

  /**
   * Get current stream
   */
  get stream(): MediaStream | null {
    return this.currentStream;
  }
}

// Export singleton instance for convenience
export const camera = Camera.getInstance();

// Export default as the Camera class
export default Camera; 