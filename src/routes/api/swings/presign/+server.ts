/**
 * Get presigned upload URLs for swing videos based on mode
 * POST /api/swings/presign
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AuthService } from '../../../../services/auth';
import { getUploadUrls, getModeInfo } from '$lib/modes';
import type { SwingMode } from '$lib/modes/types';

interface PresignRequest {
  mode: SwingMode;
  metadata?: {
    category?: string;
    location?: string;
    context?: string;
  };
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    // Check authentication
    const user = await AuthService.getCurrentUser();
    if (!user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body: PresignRequest = await request.json();
    
    // Validate mode
    if (!body.mode || !['training', 'quick'].includes(body.mode)) {
      return json({ 
        error: 'Invalid mode. Must be "training" or "quick"' 
      }, { status: 400 });
    }

    // Get mode information
    const modeInfo = getModeInfo(body.mode);
    
    // Get presigned URLs
    const { urls, swing_id } = await getUploadUrls(body.mode, user.id);
    
    // Return response with upload URLs and mode config
    return json({
      swing_id,
      mode: body.mode,
      upload_urls: urls,
      config: {
        max_file_size_mb: modeInfo.config.max_file_size_mb,
        video_requirements: modeInfo.config.video_requirements,
        processing_time_target: modeInfo.config.processing_time_target,
        analysis_depth: modeInfo.config.analysis_depth
      },
      display: modeInfo.display,
      validation: modeInfo.validation
    });

  } catch (error) {
    console.error('Presign error:', error);
    return json({ 
      error: 'Failed to generate upload URLs' 
    }, { status: 500 });
  }
}; 