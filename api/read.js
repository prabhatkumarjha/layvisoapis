/**
 * POST /api/read
 * Secure read with token + origin validation
 */

import { sql } from '../lib/db.js';
import { validateRequest, getCorsHeaders } from '../lib/auth.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }

  // Validate token + origin
  const authError = validateRequest(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { entity, filters = {}, include_deleted = false } = body;

    const allowed = ['cities', 'listings', 'providers', 'reviews', 'bookmarks', 'listing_tags', 'system_collections', 'users'];
    if (!allowed.includes(entity)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid entity' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } }
      );
    }

    let query = `SELECT * FROM ${entity} WHERE 1=1`;
    const values = [];
    let paramIndex = 1;

    if (!include_deleted) {
      query += ` AND status != 'deleted'`;
    }

    Object.entries(filters).forEach(([key, val]) => {
      query += ` AND ${key} = $${paramIndex}`;
      values.push(val);
      paramIndex++;
    });

    query += ' LIMIT 100';
    const rows = await sql(query, values);

    return new Response(
      JSON.stringify({ success: true, count: rows.length, data: rows }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } }
    );
  }
}
