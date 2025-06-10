/**
 * Camera module type definitions
 */

export interface CaptureOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'webp';
  maxSizeBytes?: number;
}

export interface PhotoResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface CameraConstraints {
  width: { ideal: number; max: number };
  height: { ideal: number; max: number };
  facingMode: 'environment' | 'user';
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface CameraError {
  code: 'PERMISSION_DENIED' | 'NOT_FOUND' | 'NOT_READABLE' | 'UNKNOWN';
  message: string;
  originalError?: Error;
}

export type FacingMode = 'environment' | 'user';

export interface CameraDevice {
  deviceId: string;
  label: string;
  facingMode?: FacingMode;
} 