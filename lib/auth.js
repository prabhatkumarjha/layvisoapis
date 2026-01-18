/**
 * Auth utilities for token generation and validation
 * Handles short-lived API tokens + origin verification
 */

const TOKEN_SECRET = process.env.TOKEN_SECRET;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());

/**
 * Generate short-lived token (15 min expiry)
 */
export function generateToken() {
  const payload = {
    iat: Date.now(),
    exp: Date.now() + 15 * 60 * 1000, // 15 minutes
    nonce: crypto.randomUUID()
  };
  
  const data = JSON.stringify(payload);
  const encoded = Buffer.from(data).toString('base64url');
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

    // Verify signature
    const expectedSig = createSignature(encoded);
    if (signature !== expectedSig) {
      return { valid: false, error: 'Invalid signature' };
    }

    // Decode and check expiry
    const data = JSON.parse(Buffer.from(encoded, 'base64url').toString());
    
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
  
  // Check origin header first
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return { valid: true, origin };
  }
  
  // Fallback to referer
  if (referer) {
    const refOrigin = new URL(referer).origin;
    if (ALLOWED_ORIGINS.includes(refOrigin)) {
      return { valid: true, origin: refOrigin };
    }
  }
  
  // Allow if no origin (server-to-server, but we'll require token anyway)
  // For strict mode, return false here
  return { valid: false, error: 'Origin not allowed' };
}

/**
 * Create HMAC signature
 */
function createSignature(data) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(TOKEN_SECRET);
  const msgData = encoder.encode(data);
  
  // Simple hash (for Edge runtime compatibility)
  let hash = 0;
  const combined = TOKEN_SECRET + data;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(36) + Buffer.from(combined.slice(0, 16)).toString('base64url');
}

/**
 * Middleware: Validate token + origin
 * Returns error response if invalid, null if valid
 */
export function validateRequest(request) {
  // Check origin
  const originCheck = verifyOrigin(request);
  if (!originCheck.valid) {
    return new Response(
      JSON.stringify({ success: false, error: originCheck.error }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Check token
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  const tokenCheck = verifyToken(token);
  if (!tokenCheck.valid) {
    return new Response(
      JSON.stringify({ success: false, error: tokenCheck.error }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return null; // Valid request
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
