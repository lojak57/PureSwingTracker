import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  console.log('🟢 DEBUG: Simple log message');
  console.error('🔴 DEBUG: Error log message');
  console.warn('🟡 DEBUG: Warning log message');
  
  console.log('🟢 DEBUG: Object log', { test: 'data', timestamp: new Date().toISOString() });
  
  return json({
    message: 'Debug logs sent to console',
    timestamp: new Date().toISOString()
  });
}; 