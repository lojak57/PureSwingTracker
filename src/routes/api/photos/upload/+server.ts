import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/supabase';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function validatePhotoUpload(file: File): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!file) {
    errors.push('No file provided');
    return { isValid: false, errors };
  }

  if (file.size > MAX_FILE_SIZE) {
    errors.push(`File too large: ${Math.round(file.size / 1024 / 1024)}MB. Maximum size is 2MB.`);
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    errors.push('Invalid file type. Only JPEG, PNG, and WebP are allowed.');
  }

  if (file.size < 1024) {
    errors.push('File appears to be corrupted or too small');
  }

  return { isValid: errors.length === 0, errors };
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const roundId = formData.get('roundId') as string;
    const holeNumber = formData.get('holeNumber') as string;
    const shotNumber = formData.get('shotNumber') as string;
    const filename = formData.get('filename') as string;

    if (!file || !roundId || !holeNumber || !shotNumber || !filename) {
      return json({ 
        error: 'Missing required fields: file, roundId, holeNumber, shotNumber, filename' 
      }, { status: 400 });
    }

    // Validate file
    const validation = validatePhotoUpload(file);
    if (!validation.isValid) {
      return json({ 
        error: 'File validation failed',
        details: validation.errors 
      }, { status: 400 });
    }

    // Verify round ownership
    const { data: roundData, error: roundError } = await supabase
      .from('rounds')
      .select('id, user_id')
      .eq('id', roundId)
      .single();

    if (roundError || !roundData || roundData.user_id !== user.id) {
      return json({ error: 'Round not found or not owned by user' }, { status: 404 });
    }

    // For now, just simulate successful upload
    // In production, this would upload to R2 bucket 'pure-round-photos'
    const mockUrl = `https://pure-round-photos.example.com/${filename}`;

    // Update the shot with lie photo URL
    const { error: updateError } = await supabase
      .from('shots')
      .update({ lie_photo_url: mockUrl })
      .eq('round_id', roundId)
      .eq('hole_number', parseInt(holeNumber))
      .eq('shot_number', parseInt(shotNumber));

    if (updateError) {
      console.error('Error updating shot with photo URL:', updateError);
      return json({ error: 'Failed to save photo reference' }, { status: 500 });
    }

    return json({ 
      success: true,
      photoUrl: mockUrl,
      filename,
      size: file.size
    });

  } catch (error: unknown) {
    console.error('Photo upload error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}; 