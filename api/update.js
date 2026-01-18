/**
 * POST /api/update
 * Secure update with token + origin validation + activity log
 */

import { sql } from '../lib/db.js';
import { validateRequest, getCorsHeaders } from '../lib/auth.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }

  const authError = validateRequest(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { entity, id, data, actor } = body;

    const allowed = ['cities', 'listings', 'providers', 'reviews', 'bookmarks', 'listing_tags', 'system_collections', 'users', 'user_interests'];
    if (!allowed.includes(entity)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid entity' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } }
      );
    }

    if (!id) {
      return new Response(
        JSON.stringify({ success: false, error: 'ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } }
      );
    }

    if (!data || typeof data !== 'object') {
      return new Response(
        JSON.stringify({ success: false, error: 'Data required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } }
      );
    }

    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');

    const query = `UPDATE ${entity} SET ${setClause}, updated_at = NOW() WHERE id = $${columns.length + 1} RETURNING *`;
    const rows = await sql(query, [...values, id]);

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Record not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } }
      );
    }

    // Activity log
    if (actor) {
      const logQuery = `INSERT INTO activity_logs (actor_type, actor_id, actor_email, action, entity, entity_id, payload, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`;
      await sql(logQuery, [
        actor.type || 'user',
        actor.id || null,
        actor.email || null,
        'update',
        entity,
        id,
        JSON.stringify(data)
      ]);
    }

    return new Response(
      JSON.stringify({ success: true, data: rows[0] }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } }
    );
  }
}
