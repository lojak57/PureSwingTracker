/**
 * Photo capture from video streams
 */

import type { CaptureOptions, PhotoResult } from './types';

export class PhotoCapture {
  
  /**
   * Capture photo from video element
   */
  static async fromVideo(
    video: HTMLVideoElement, 
    options: CaptureOptions = {}
  ): Promise<PhotoResult> {
    const {
      maxWidth = 1280,
      maxHeight = 1280,
      quality = 0.85,
      format = 'webp',
      maxSizeBytes = 2 * 1024 * 1024 // 2MB
    } = options;

    return new Promise((resolve, reject) => {
      if (!video.videoWidth || !video.videoHeight) {
        reject(new Error('Video not ready for capture'));
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      // Calculate output dimensions maintaining aspect ratio
      const { width: outputWidth, height: outputHeight } = this.calculateDimensions(
        video.videoWidth,
        video.videoHeight,
        maxWidth,
        maxHeight
      );

      canvas.width = outputWidth;
      canvas.height = outputHeight;

      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0, outputWidth, outputHeight);

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create photo blob'));
            return;
          }

          if (blob.size > maxSizeBytes) {
            reject(new Error(
              `Photo too large: ${Math.round(blob.size / 1024 / 1024)}MB. ` +
              `Maximum size is ${Math.round(maxSizeBytes / 1024 / 1024)}MB.`
            ));
            return;
          }

          this.createDataUrl(blob)
            .then(dataUrl => {
              resolve({
                blob,
                dataUrl,
                width: outputWidth,
                height: outputHeight,
                sizeBytes: blob.size
              });
            })
            .catch(reject);
        },
        `image/${format}`,
        quality
      );
    });
  }

  /**
   * Capture photo from file input
   */
  static async fromFile(
    file: File,
    options: CaptureOptions = {}
  ): Promise<PhotoResult> {
    const {
      maxWidth = 1280,
      maxHeight = 1280,
      quality = 0.85,
      format = 'webp',
      maxSizeBytes = 2 * 1024 * 1024
    } = options;

    if (file.size > maxSizeBytes) {
      throw new Error(
        `File too large: ${Math.round(file.size / 1024 / 1024)}MB. ` +
        `Maximum size is ${Math.round(maxSizeBytes / 1024 / 1024)}MB.`
      );
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }

          const { width: outputWidth, height: outputHeight } = this.calculateDimensions(
            img.width,
            img.height,
            maxWidth,
            maxHeight
          );

          canvas.width = outputWidth;
          canvas.height = outputHeight;
          ctx.drawImage(img, 0, 0, outputWidth, outputHeight);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to process image'));
                return;
              }

              if (blob.size > maxSizeBytes) {
                reject(new Error(`Processed image still too large: ${Math.round(blob.size / 1024 / 1024)}MB`));
                return;
              }

              this.createDataUrl(blob)
                .then(dataUrl => {
                  resolve({
                    blob,
                    dataUrl,
                    width: outputWidth,
                    height: outputHeight,
                    sizeBytes: blob.size
                  });
                })
                .catch(reject);
            },
            `image/${format}`,
            quality
          );

        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image file'));
      };

      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Calculate output dimensions maintaining aspect ratio
   */
  private static calculateDimensions(
    inputWidth: number,
    inputHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    let outputWidth = inputWidth;
    let outputHeight = inputHeight;
    
    if (outputWidth > maxWidth || outputHeight > maxHeight) {
      const aspectRatio = inputWidth / inputHeight;
      
      if (outputWidth > maxWidth) {
        outputWidth = maxWidth;
        outputHeight = maxWidth / aspectRatio;
      }
      
      if (outputHeight > maxHeight) {
        outputHeight = maxHeight;
        outputWidth = maxHeight * aspectRatio;
      }
    }

    return {
      width: Math.round(outputWidth),
      height: Math.round(outputHeight)
    };
  }

  /**
   * Create data URL from blob
   */
  private static createDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read photo data'));
      reader.readAsDataURL(blob);
    });
  }
} 