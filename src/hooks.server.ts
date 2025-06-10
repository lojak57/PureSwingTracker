import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // Increase body size limit for upload endpoint
  if (event.url.pathname === '/api/upload') {
    // Set larger body size limit for video uploads (600MB)
    event.request.headers.set('content-length-limit', '629145600'); // 600MB in bytes
  }

  return resolve(event);
}; 