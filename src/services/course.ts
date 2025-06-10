import { supabase } from '$lib/supabase';
import { env } from '$env/dynamic/private';

interface ExternalCourse {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  phone?: string;
  website?: string;
  holes?: ExternalHole[];
  tee_sets?: TeeSet[];
}

interface ExternalHole {
  number: number;
  par: number;
  handicap?: number;
  yardages: Record<string, number>; // {"blue": 420, "white": 385, "red": 320}
  description?: string;
}

interface TeeSet {
  name: string;
  rating?: number;
  slope?: number;
  color?: string;
}

interface Course {
  id: string;
  external_id: string;
  name: string;
  location: [number, number]; // [lat, lng]
  address?: any;
  phone?: string;
  website?: string;
  tee_sets?: TeeSet[];
  last_updated: string;
}

interface Hole {
  id: string;
  course_id: string;
  hole_number: number;
  par: number;
  handicap?: number;
  yardages: Record<string, number>;
  description?: string;
  gps_coordinates?: any;
  hazards?: any;
}

/**
 * Search for courses using external Golf Course API
 */
export async function searchCoursesExternal(
  lat: number, 
  lng: number, 
  radius: number = 25
): Promise<ExternalCourse[]> {
  try {
    if (!env.GOLF_COURSE_API_KEY) {
      console.warn('Golf Course API key not configured, returning empty results');
      return [];
    }

    // Using Golf Course Data API from RapidAPI
    const response = await fetch(
      `https://golf-course-api-rapidapi.p.rapidapi.com/courses/search?lat=${lat}&lng=${lng}&radius=${radius}`,
      {
        headers: {
          'X-RapidAPI-Key': env.GOLF_COURSE_API_KEY,
          'X-RapidAPI-Host': 'golf-course-api-rapidapi.p.rapidapi.com'
        }
      }
    );

    if (!response.ok) {
      console.error('Golf Course API error:', response.status, await response.text());
      return [];
    }

    const data = await response.json();
    return data.courses || [];

  } catch (error) {
    console.error('Error searching courses externally:', error);
    return [];
  }
}

/**
 * Get detailed course information including holes
 */
export async function getCourseDetailsExternal(courseId: string): Promise<ExternalCourse | null> {
  try {
    if (!env.GOLF_COURSE_API_KEY) {
      console.warn('Golf Course API key not configured');
      return null;
    }

    const response = await fetch(
      `https://golf-course-api-rapidapi.p.rapidapi.com/courses/${courseId}`,
      {
        headers: {
          'X-RapidAPI-Key': env.GOLF_COURSE_API_KEY,
          'X-RapidAPI-Host': 'golf-course-api-rapidapi.p.rapidapi.com'
        }
      }
    );

    if (!response.ok) {
      console.error('Golf Course API error:', response.status);
      return null;
    }

    const data = await response.json();
    return data.course || null;

  } catch (error) {
    console.error('Error fetching course details:', error);
    return null;
  }
}

/**
 * Cache course data locally in our database
 */
export async function cacheCourse(externalCourse: ExternalCourse): Promise<string | null> {
  try {
    // Check if course already exists
    const { data: existingCourse } = await supabase
      .from('pure.courses')
      .select('id')
      .eq('external_id', externalCourse.id)
      .single();

    if (existingCourse) {
      // Update existing course
      const { error: updateError } = await supabase
        .from('pure.courses')
        .update({
          name: externalCourse.name,
          location: `POINT(${externalCourse.longitude} ${externalCourse.latitude})`,
          address: externalCourse.address ? {
            full: externalCourse.address
          } : null,
          phone: externalCourse.phone,
          website: externalCourse.website,
          tee_sets: externalCourse.tee_sets || [],
          last_updated: new Date().toISOString()
        })
        .eq('external_id', externalCourse.id);

      if (updateError) {
        console.error('Error updating course:', updateError);
        return null;
      }

      return existingCourse.id;
    }

    // Insert new course
    const { data: newCourse, error: insertError } = await supabase
      .from('pure.courses')
      .insert({
        external_id: externalCourse.id,
        name: externalCourse.name,
        location: `POINT(${externalCourse.longitude} ${externalCourse.latitude})`,
        address: externalCourse.address ? {
          full: externalCourse.address
        } : null,
        phone: externalCourse.phone,
        website: externalCourse.website,
        tee_sets: externalCourse.tee_sets || [],
        last_updated: new Date().toISOString()
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error inserting course:', insertError);
      return null;
    }

    // Cache holes if available
    if (externalCourse.holes && newCourse) {
      await cacheHoles(newCourse.id, externalCourse.holes);
    }

    return newCourse?.id || null;

  } catch (error) {
    console.error('Error caching course:', error);
    return null;
  }
}

/**
 * Cache hole data for a course
 */
export async function cacheHoles(courseId: string, holes: ExternalHole[]): Promise<void> {
  try {
    // Delete existing holes for this course
    await supabase
      .from('pure.holes')
      .delete()
      .eq('course_id', courseId);

    // Insert new holes
    const holesData = holes.map(hole => ({
      course_id: courseId,
      hole_number: hole.number,
      par: hole.par,
      handicap: hole.handicap,
      yardages: hole.yardages,
      description: hole.description
    }));

    const { error } = await supabase
      .from('pure.holes')
      .insert(holesData);

    if (error) {
      console.error('Error caching holes:', error);
    }

  } catch (error) {
    console.error('Error caching holes:', error);
  }
}

/**
 * Search courses - checks local cache first, then external API
 */
export async function searchCourses(
  lat: number, 
  lng: number, 
  radius: number = 25
): Promise<Course[]> {
  try {
    // First, search local cache for nearby courses
    const { data: localCourses, error } = await supabase
      .from('pure.courses')
      .select('*')
      .gte('last_updated', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Cache for 7 days
      .limit(20);

    if (error) {
      console.error('Error searching local courses:', error);
    }

    // If we have recent local data, return it
    if (localCourses && localCourses.length > 0) {
      return localCourses.map(formatCourse);
    }

    // Otherwise, fetch from external API and cache
    const externalCourses = await searchCoursesExternal(lat, lng, radius);
    const cachedCourses: Course[] = [];

    for (const externalCourse of externalCourses.slice(0, 10)) { // Limit to 10 courses
      const courseId = await cacheCourse(externalCourse);
      if (courseId) {
        const { data: course } = await supabase
          .from('pure.courses')
          .select('*')
          .eq('id', courseId)
          .single();

        if (course) {
          cachedCourses.push(formatCourse(course));
        }
      }
    }

    return cachedCourses;

  } catch (error) {
    console.error('Error in searchCourses:', error);
    return [];
  }
}

/**
 * Get course by ID with holes
 */
export async function getCourseById(courseId: string): Promise<(Course & { holes: Hole[] }) | null> {
  try {
    const { data: course, error: courseError } = await supabase
      .from('pure.courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      console.error('Error fetching course:', courseError);
      return null;
    }

    const { data: holes, error: holesError } = await supabase
      .from('pure.holes')
      .select('*')
      .eq('course_id', courseId)
      .order('hole_number');

    if (holesError) {
      console.error('Error fetching holes:', holesError);
      return { ...formatCourse(course), holes: [] };
    }

    return {
      ...formatCourse(course),
      holes: holes || []
    };

  } catch (error) {
    console.error('Error in getCourseById:', error);
    return null;
  }
}

/**
 * Format database course for API response
 */
function formatCourse(dbCourse: any): Course {
  // Parse PostGIS POINT format: "POINT(lng lat)"
  let location: [number, number] = [0, 0];
  if (dbCourse.location) {
    const pointMatch = dbCourse.location.match(/POINT\(([^\s]+)\s+([^\)]+)\)/);
    if (pointMatch) {
      location = [parseFloat(pointMatch[2]), parseFloat(pointMatch[1])]; // [lat, lng]
    }
  }

  return {
    id: dbCourse.id,
    external_id: dbCourse.external_id,
    name: dbCourse.name,
    location,
    address: dbCourse.address,
    phone: dbCourse.phone,
    website: dbCourse.website,
    tee_sets: dbCourse.tee_sets || [],
    last_updated: dbCourse.last_updated
  };
} 