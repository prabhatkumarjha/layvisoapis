/**
 * POST /api/analytics/track
 * Insert analytics event (no auth for tracking)
 */

import { sql } from '../../lib/db.js';
import { getCorsHeaders } from '../../lib/auth.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } }
    );
  }

  try {
    const body = await req.json();
    const {
      session_id,
      ip_city,
      ip_region,
      ip_country,
      selected_city,
      selected_area,
      event_type,
      page_url,
      page_title,
      time_spent_seconds,
      category,
      listing_id,
      listing_title,
      search_term,
      referrer,
      utm_source,
      utm_medium,
      utm_campaign,
      device_type,
      browser,
      os,
      screen_size
    } = body;

    // Require minimum fields
    if (!event_type) {
      return new Response(
        JSON.stringify({ success: false, error: 'event_type required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } }
      );
    }

    // Get IP hash from headers (Cloudflare provides this)
    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown';
    const ip_hash = await hashIP(ip);

    const query = `
      INSERT INTO analytics_events (
        session_id, ip_hash, ip_city, ip_region, ip_country,
        selected_city, selected_area, event_type, page_url, page_title,
        time_spent_seconds, category, listing_id, listing_title, search_term,
        referrer, utm_source, utm_medium, utm_campaign,
        device_type, browser, os, screen_size, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, NOW()
      ) RETURNING id
    `;

    const rows = await sql(query, [
      session_id || null,
      ip_hash,
      ip_city || null,
      ip_region || null,
      ip_country || null,
      selected_city || null,
      selected_area || null,
      event_type,
      page_url || null,
      page_title || null,
      time_spent_seconds || null,
      category || null,
      listing_id || null,
      listing_title || null,
      search_term || null,
      referrer || null,
      utm_source || null,
      utm_medium || null,
      utm_campaign || null,
      device_type || null,
      browser || null,
      os || null,
      screen_size || null
    ]);

    return new Response(
      JSON.stringify({ success: true, id: rows[0].id }),
      { status: 201, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } }
    );
  }
}

// Simple hash function for IP (privacy)
async function hashIP(ip) {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + 'layviso-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}
