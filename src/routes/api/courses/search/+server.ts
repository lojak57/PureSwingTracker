import { json } from '@sveltejs/kit';
import { searchCourses } from '../../../../services/course';
import type { RequestHandler } from '@sveltejs/kit';

interface SearchParams {
  lat: number;
  lng: number;
  radius?: number;
}

export const GET: RequestHandler = async ({ url, request }) => {
  try {
    // Parse query parameters
    const lat = parseFloat(url.searchParams.get('lat') || '');
    const lng = parseFloat(url.searchParams.get('lng') || '');
    const radius = parseFloat(url.searchParams.get('radius') || '25');

    // Validate required parameters
    if (isNaN(lat) || isNaN(lng)) {
      return json(
        { 
          error: { 
            code: 'INVALID_COORDINATES', 
            message: 'Valid latitude and longitude are required' 
          } 
        },
        { status: 400 }
      );
    }

    // Validate coordinate ranges
    if (lat < -90 || lat > 90) {
      return json(
        { 
          error: { 
            code: 'INVALID_LATITUDE', 
            message: 'Latitude must be between -90 and 90' 
          } 
        },
        { status: 400 }
      );
    }

    if (lng < -180 || lng > 180) {
      return json(
        { 
          error: { 
            code: 'INVALID_LONGITUDE', 
            message: 'Longitude must be between -180 and 180' 
          } 
        },
        { status: 400 }
      );
    }

    // Validate radius
    if (isNaN(radius) || radius <= 0 || radius > 100) {
      return json(
        { 
          error: { 
            code: 'INVALID_RADIUS', 
            message: 'Radius must be between 1 and 100 miles' 
          } 
        },
        { status: 400 }
      );
    }

    // Search for courses
    const courses = await searchCourses(lat, lng, radius);

    return json({
      courses,
      search_params: {
        lat,
        lng,
        radius
      },
      count: courses.length,
      cached: courses.length > 0 ? 'unknown' : 'external_api'
    });

  } catch (error) {
    console.error('Error in course search endpoint:', error);
    return json(
      { 
        error: { 
          code: 'SEARCH_FAILED', 
          message: 'Failed to search for courses' 
        } 
      },
      { status: 500 }
    );
  }
};

// POST endpoint for more complex search queries
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body: SearchParams = await request.json();
    const { lat, lng, radius = 25 } = body;

    // Validate required parameters
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return json(
        { 
          error: { 
            code: 'INVALID_COORDINATES', 
            message: 'Valid latitude and longitude numbers are required' 
          } 
        },
        { status: 400 }
      );
    }

    // Validate coordinate ranges
    if (lat < -90 || lat > 90) {
      return json(
        { 
          error: { 
            code: 'INVALID_LATITUDE', 
            message: 'Latitude must be between -90 and 90' 
          } 
        },
        { status: 400 }
      );
    }

    if (lng < -180 || lng > 180) {
      return json(
        { 
          error: { 
            code: 'INVALID_LONGITUDE', 
            message: 'Longitude must be between -180 and 180' 
          } 
        },
        { status: 400 }
      );
    }

    // Validate radius
    if (typeof radius !== 'number' || radius <= 0 || radius > 100) {
      return json(
        { 
          error: { 
            code: 'INVALID_RADIUS', 
            message: 'Radius must be a number between 1 and 100 miles' 
          } 
        },
        { status: 400 }
      );
    }

    // Search for courses
    const courses = await searchCourses(lat, lng, radius);

    return json({
      courses,
      search_params: {
        lat,
        lng,
        radius
      },
      count: courses.length,
      cached: courses.length > 0 ? 'unknown' : 'external_api'
    });

  } catch (error) {
    console.error('Error in course search endpoint:', error);
    return json(
      { 
        error: { 
          code: 'SEARCH_FAILED', 
          message: 'Failed to search for courses' 
        } 
      },
      { status: 500 }
    );
  }
}; 