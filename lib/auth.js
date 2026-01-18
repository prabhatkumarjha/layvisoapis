/**
 * Auth utilities for token generation and validation
 * Handles short-lived API tokens + origin verification
 */

const TOKEN_SECRET = process.env.TOKEN_SECRET;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());

/**
 * Create URL-safe signature
 */
function createSignature(data) {
  const combined = TOKEN_SECRET + data;
  let hash = 5381;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) + hash) + combined.charCodeAt(i);
    hash = hash >>> 0;
  }
  return hash.toString(36);
}

/**
 * Generate short-lived token (15 min expiry)
 */
export function generateToken() {
  const payload = {
    iat: Date.now(),
    exp: Date.now() + 15 * 60 * 1000,
    nonce: Math.random().toString(36).substring(2)
  };
  
  const data = JSON.stringify(payload);
  const encoded = btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const signature = createSignature(encoded);
  
  return `${encoded}.${signature}`;
}

/**
 * Verify token validity
 */
export function verifyToken(token) {
  if (!token) {
    return { valid: false, error: 'No token provided' };
  }

  try {
    const [encoded, signature] = token.split('.');
    
    if (!encoded || !signature) {
      return { valid: false, error: 'Invalid token format' };
    }

    const expectedSig = createSignature(encoded);
    if (signature !== expectedSig) {
      return { valid: false, error: 'Invalid signature' };
    }

    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const data = JSON.parse(atob(padded));
    
    if (Date.now() > data.exp) {
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true, payload: data };
  } catch (err) {
    return { valid: false, error: 'Token verification failed' };
  }
}

/**
 * Verify request origin
 */
export function verifyOrigin(request) {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return { valid: true, origin };
  }
  
  if (referer) {
    const refOrigin = new URL(referer).origin;
    if (ALLOWED_ORIGINS.includes(refOrigin)) {
      return { valid: true, origin: refOrigin };
    }
  }
  
  return { valid: false, error: 'Origin not allowed' };
}

/**
 * Middleware: Validate token + origin
 */
export function validateRequest(request) {
  const originCheck = verifyOrigin(request);
  if (!originCheck.valid) {
    return new Response(
      JSON.stringify({ success: false, error: originCheck.error }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  const tokenCheck = verifyToken(token);
  if (!tokenCheck.valid) {
    return new Response(
      JSON.stringify({ success: false, error: tokenCheck.error }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return null;
}

/**
 * CORS headers for allowed origins
 */
export function getCorsHeaders(request) {
  const origin = request.headers.get('origin');
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}
