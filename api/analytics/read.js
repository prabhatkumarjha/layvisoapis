/**
 * POST /api/analytics/read
 * Read analytics events (protected - admin only)
 */

import { sql } from '../../lib/db.js';
import { validateRequest, getCorsHeaders } from '../../lib/auth.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }

  // Require auth for reading analytics
  const authError = validateRequest(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { 
      event_type, 
      city, 
      category, 
      date_from, 
      date_to, 
      limit = 100,
      group_by
    } = body;

    // Grouped query (for reports)
    if (group_by) {
      let groupQuery;
      
      if (group_by === 'city_category') {
        groupQuery = `
          SELECT ip_city as city, category, COUNT(*) as count
          FROM analytics_events
          WHERE event_type = $1
          GROUP BY ip_city, category
          ORDER BY count DESC
          LIMIT $2
        `;
        const rows = await sql(groupQuery, [event_type || 'page_view', limit]);
        return new Response(
          JSON.stringify({ success: true, data: rows }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } }
        );
      }

      if (group_by === 'search_terms') {
        groupQuery = `
          SELECT search_term, COUNT(*) as count
          FROM analytics_events
          WHERE event_type IN ('search', 'search_no_results')
          AND search_term IS NOT NULL
          GROUP BY search_term
          ORDER BY count DESC
          LIMIT $1
        `;
        const rows = await sql(groupQuery, [limit]);
        return new Response(
          JSON.stringify({ success: true, data: rows }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } }
        );
      }

      if (group_by === 'top_listings') {
        groupQuery = `
          SELECT listing_id, listing_title, COUNT(*) as count
          FROM analytics_events
          WHERE event_type = 'listing_click'
          AND listing_id IS NOT NULL
          GROUP BY listing_id, listing_title
          ORDER BY count DESC
          LIMIT $1
        `;
        const rows = await sql(groupQuery, [limit]);
        return new Response(
          JSON.stringify({ success: true, data: rows }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } }
        );
      }

      if (group_by === 'daily') {
        groupQuery = `
          SELECT DATE(created_at) as date, COUNT(*) as count
          FROM analytics_events
          GROUP BY DATE(created_at)
          ORDER BY date DESC
          LIMIT $1
        `;
        const rows = await sql(groupQuery, [limit]);
        return new Response(
          JSON.stringify({ success: true, data: rows }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } }
        );
      }
    }

    // Raw events query
    let query = `SELECT * FROM analytics_events WHERE 1=1`;
    const values = [];
    let paramIndex = 1;

    if (event_type) {
      query += ` AND event_type = $${paramIndex}`;
      values.push(event_type);
      paramIndex++;
    }

    if (city) {
      query += ` AND (ip_city = $${paramIndex} OR selected_city = $${paramIndex})`;
      values.push(city);
      paramIndex++;
    }

    if (category) {
      query += ` AND category = $${paramIndex}`;
      values.push(category);
      paramIndex++;
    }

    if (date_from) {
      query += ` AND created_at >= $${paramIndex}`;
      values.push(date_from);
      paramIndex++;
    }

    if (date_to) {
      query += ` AND created_at <= $${paramIndex}`;
      values.push(date_to);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    values.push(limit);

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
