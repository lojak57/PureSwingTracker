import { json } from '@sveltejs/kit';
import { getCourseById } from '../../../../services/course';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params }) => {
  try {
    const courseId = params.id;
    
    if (!courseId) {
      return json(
        { 
          error: { 
            code: 'MISSING_COURSE_ID', 
            message: 'Course ID is required' 
          } 
        },
        { status: 400 }
      );
    }

    // Validate UUID format (basic check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(courseId)) {
      return json(
        { 
          error: { 
            code: 'INVALID_COURSE_ID', 
            message: 'Course ID must be a valid UUID' 
          } 
        },
        { status: 400 }
      );
    }

    // Get course with holes
    const course = await getCourseById(courseId);

    if (!course) {
      return json(
        { 
          error: { 
            code: 'COURSE_NOT_FOUND', 
            message: 'Course not found' 
          } 
        },
        { status: 404 }
      );
    }

    return json({
      course,
      holes_count: course.holes.length
    });

  } catch (error) {
    console.error('Error in course details endpoint:', error);
    return json(
      { 
        error: { 
          code: 'FETCH_FAILED', 
          message: 'Failed to fetch course details' 
        } 
      },
      { status: 500 }
    );
  }
}; 