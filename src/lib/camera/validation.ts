/**
 * Photo validation logic
 */

import type { PhotoResult, ValidationResult, CaptureOptions } from './types';

export class PhotoValidator {
  
  /**
   * Validate photo against requirements
   */
  static validate(photo: PhotoResult, options: CaptureOptions = {}): ValidationResult {
    const {
      maxWidth = 1280,
      maxHeight = 1280,
      maxSizeBytes = 2 * 1024 * 1024
    } = options;

    const errors: string[] = [];

    // Size validation
    if (photo.width > maxWidth) {
      errors.push(`Image width ${photo.width}px exceeds maximum ${maxWidth}px`);
    }

    if (photo.height > maxHeight) {
      errors.push(`Image height ${photo.height}px exceeds maximum ${maxHeight}px`);
    }

    // File size validation
    if (photo.sizeBytes > maxSizeBytes) {
      errors.push(`File size ${this.formatFileSize(photo.sizeBytes)} exceeds maximum ${this.formatFileSize(maxSizeBytes)}`);
    }

    // Minimum size check
    if (photo.sizeBytes < 1024) {
      errors.push('Image file appears to be corrupted or too small');
    }

    // Aspect ratio check (golf photos should be reasonably rectangular)
    const aspectRatio = photo.width / photo.height;
    if (aspectRatio < 0.3 || aspectRatio > 3.0) {
      errors.push(`Unusual aspect ratio detected. Please capture a normal golf lie photo.`);
    }

    // Minimum resolution check
    if (photo.width < 200 || photo.height < 200) {
      errors.push('Photo resolution too low. Please capture a higher quality image.');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate blob before processing
   */
  static validateBlob(blob: Blob): ValidationResult {
    const errors: string[] = [];

    if (!blob || blob.size === 0) {
      errors.push('Invalid or empty image file');
    }

    if (!blob.type.startsWith('image/')) {
      errors.push('File must be an image');
    }

    // Check for supported formats
    const supportedFormats = ['image/jpeg', 'image/png', 'image/webp'];
    if (!supportedFormats.includes(blob.type)) {
      errors.push('Unsupported image format. Please use JPEG, PNG, or WebP.');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate file before processing
   */
  static validateFile(file: File): ValidationResult {
    const blobValidation = this.validateBlob(file);
    const errors = [...blobValidation.errors];

    // Additional file-specific checks
    if (file.name && !this.hasValidImageExtension(file.name)) {
      errors.push('Invalid file extension. Please use .jpg, .jpeg, .png, or .webp files.');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if camera settings are suitable for golf photos
   */
  static validateCameraSettings(video: HTMLVideoElement): ValidationResult {
    const errors: string[] = [];

    if (!video.videoWidth || !video.videoHeight) {
      errors.push('Camera not ready. Please wait for video to load.');
    }

    if (video.videoWidth < 640 || video.videoHeight < 480) {
      errors.push('Camera resolution too low. Please use a higher quality camera.');
    }

    // Check if video is playing
    if (video.paused || video.ended) {
      errors.push('Camera feed not active. Please ensure camera is working.');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Format file size for display
   */
  private static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Check if filename has valid image extension
   */
  private static hasValidImageExtension(filename: string): boolean {
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const extension = filename.toLowerCase().split('.').pop();
    return extension ? validExtensions.includes(`.${extension}`) : false;
  }
}

export { PhotoValidator as Validator }; 