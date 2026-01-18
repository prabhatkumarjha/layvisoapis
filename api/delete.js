/**
 * POST /api/delete
 * Secure soft delete with token + origin validation + activity log
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
    const { entity, id, actor } = body;

    const allowed = ['cities', 'listings', 'providers', 'reviews', 'bookmarks', 'system_collections', 'users'];
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

    // Soft delete based on table type
    let query;
    const softDeleteMap = {
      users: `UPDATE users SET status = 'deleted', updated_at = NOW() WHERE id = $1 RETURNING *`,
      providers: `UPDATE providers SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
      listings: `UPDATE listings SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
      bookmarks: `UPDATE bookmarks SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
      reviews: `UPDATE reviews SET status = 'deleted', updated_at = NOW() WHERE id = $1 RETURNING *`,
      system_collections: `UPDATE system_collections SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
      cities: `UPDATE cities SET status = 'deleted', updated_at = NOW() WHERE id = $1 RETURNING *`
    };

    query = softDeleteMap[entity];
    const rows = await sql(query, [id]);

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
        'delete',
        entity,
        id,
        JSON.stringify({ soft_delete: true })
      ]);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Deleted successfully', data: rows[0] }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } }
    );
  }
}
