/**
 * GPS utilities for golf course distance calculation and positioning
 */

export interface GPSPosition {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp?: number;
}

export interface DistanceResult {
  yards: number;
  meters: number;
  accuracy: 'high' | 'medium' | 'low';
}

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 */
export function calculateDistance(pos1: GPSPosition, pos2: GPSPosition): DistanceResult {
  const R = 6371; // Earth's radius in kilometers
  
  const lat1Rad = toRadians(pos1.lat);
  const lat2Rad = toRadians(pos2.lat);
  const deltaLatRad = toRadians(pos2.lat - pos1.lat);
  const deltaLngRad = toRadians(pos2.lng - pos1.lng);

  const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) *
            Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  const meters = R * c * 1000; // Convert to meters
  const yards = meters * 1.09361; // Convert to yards

  // Determine accuracy based on GPS accuracy if available
  let accuracy: 'high' | 'medium' | 'low' = 'medium';
  if (pos1.accuracy && pos2.accuracy) {
    const avgAccuracy = (pos1.accuracy + pos2.accuracy) / 2;
    if (avgAccuracy <= 5) accuracy = 'high';
    else if (avgAccuracy <= 15) accuracy = 'medium';
    else accuracy = 'low';
  }

  return {
    yards: Math.round(yards),
    meters: Math.round(meters),
    accuracy
  };
}

/**
 * Get current GPS position with high accuracy for golf
 */
export function getCurrentPosition(timeout: number = 10000): Promise<GPSPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout,
      maximumAge: 30000 // 30 seconds max age
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        });
      },
      (error) => {
        let message = 'Unknown GPS error';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'GPS access denied. Please enable location services.';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'GPS position unavailable. Please try again.';
            break;
          case error.TIMEOUT:
            message = 'GPS request timed out. Please try again.';
            break;
        }
        reject(new Error(message));
      },
      options
    );
  });
}

/**
 * Calculate distance to pin from current position
 */
export async function getDistanceToPin(pinPosition: GPSPosition): Promise<DistanceResult | null> {
  try {
    const currentPos = await getCurrentPosition();
    return calculateDistance(currentPos, pinPosition);
  } catch (error) {
    console.error('Error getting distance to pin:', error);
    return null;
  }
}

/**
 * Format distance for display
 */
export function formatDistance(distance: DistanceResult): string {
  const { yards, accuracy } = distance;
  
  let accuracyIndicator = '';
  switch (accuracy) {
    case 'high':
      accuracyIndicator = '📍'; 
      break;
    case 'medium':
      accuracyIndicator = '📌'; 
      break;
    case 'low':
      accuracyIndicator = '📍'; 
      break;
  }
  
  return `${accuracyIndicator} ${yards}y`;
}

/**
 * Utility functions
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Mock pin positions for development/testing
 */
export const MOCK_PIN_POSITIONS: Record<string, GPSPosition[]> = {
  'pebble-beach': [
    { lat: 36.5682, lng: -121.9453 }, // Hole 1
    { lat: 36.5686, lng: -121.9458 }, // Hole 2
    { lat: 36.5690, lng: -121.9463 }, // Hole 3
  ]
};

/**
 * Get mock pin position for testing
 */
export function getMockPinPosition(courseId: string, holeNumber: number): GPSPosition | null {
  const positions = MOCK_PIN_POSITIONS[courseId];
  if (!positions || !positions[holeNumber - 1]) {
    return null;
  }
  return positions[holeNumber - 1];
} 