/**
 * POST /api/token
 * Issues short-lived API token (15 min)
 * Only responds to allowed origins
 */

import { generateToken, verifyOrigin, getCorsHeaders } from '../lib/auth.js';

export const config = {
  runtime: 'edge'
};

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request)
    });
  }

  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request) } }
    );
  }

  const originCheck = verifyOrigin(request);
  if (!originCheck.valid) {
    return new Response(
      JSON.stringify({ success: false, error: 'Origin not allowed' }),
      { status: 403, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request) } }
    );
  }

  const token = generateToken();
  const expiresIn = 15 * 60;

  return new Response(
    JSON.stringify({
      success: true,
      token,
      expiresIn,
      expiresAt: Date.now() + expiresIn * 1000
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request) }
    }
  );
}
