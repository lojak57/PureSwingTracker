/**
 * Camera stream management - device access, permissions, enumeration
 */

import type { FacingMode, CameraError, CameraDevice } from './types';

export class CameraStreamManager {
  private static instance: CameraStreamManager;
  private currentStream: MediaStream | null = null;

  static getInstance(): CameraStreamManager {
    if (!CameraStreamManager.instance) {
      CameraStreamManager.instance = new CameraStreamManager();
    }
    return CameraStreamManager.instance;
  }

  /**
   * Check if camera API is available
   */
  isSupported(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  /**
   * Get camera stream with golf-optimized settings
   */
  async getStream(facingMode: FacingMode = 'environment'): Promise<MediaStream> {
    if (!this.isSupported()) {
      throw this.createCameraError('NOT_FOUND', 'Camera not supported on this device');
    }

    // Stop any existing stream first
    this.stopCurrentStream();

    const constraints: MediaStreamConstraints = {
      video: {
        width: { ideal: 1920, max: 4096 },
        height: { ideal: 1080, max: 4096 },
        facingMode: { ideal: facingMode }
      },
      audio: false
    };

    try {
      this.currentStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.currentStream;
    } catch (error) {
      throw this.handleStreamError(error);
    }
  }

  /**
   * Stop current camera stream
   */
  stopCurrentStream(): void {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
      this.currentStream = null;
    }
  }

  /**
   * Get available camera devices
   */
  async getDevices(): Promise<CameraDevice[]> {
    if (!this.isSupported()) {
      return [];
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
          facingMode: this.guessFacingMode(device.label)
        }));
    } catch (error) {
      console.warn('Failed to enumerate camera devices:', error);
      return [];
    }
  }

  /**
   * Get supported facing modes
   */
  async getSupportedFacingModes(): Promise<FacingMode[]> {
    const devices = await this.getDevices();
    const modes: Set<FacingMode> = new Set();
    
    if (devices.length > 1) {
      modes.add('environment');
      modes.add('user');
    } else if (devices.length === 1) {
      modes.add('environment'); // Default to back camera
    }

    return Array.from(modes);
  }

  private handleStreamError(error: unknown): CameraError {
    if (error instanceof DOMException) {
      switch (error.name) {
        case 'NotAllowedError':
          return this.createCameraError('PERMISSION_DENIED', 'Camera access denied. Please allow camera permissions.');
        case 'NotFoundError':
          return this.createCameraError('NOT_FOUND', 'No camera found on this device.');
        case 'NotReadableError':
          return this.createCameraError('NOT_READABLE', 'Camera is being used by another application.');
        default:
          return this.createCameraError('UNKNOWN', `Camera error: ${error.message}`);
      }
    }
    
    return this.createCameraError('UNKNOWN', 'Unknown camera error');
  }

  private createCameraError(code: CameraError['code'], message: string, originalError?: Error): CameraError {
    return { code, message, originalError };
  }

  private guessFacingMode(label: string): FacingMode | undefined {
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes('front') || lowerLabel.includes('user')) {
      return 'user';
    }
    if (lowerLabel.includes('back') || lowerLabel.includes('rear') || lowerLabel.includes('environment')) {
      return 'environment';
    }
    return undefined;
  }
} 