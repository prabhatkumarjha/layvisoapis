export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    const body = await req.json();
    const { entity, filters = {}, include_deleted = false } = body;

    // Allowed tables
    const allowed = ['cities', 'listings', 'providers', 'reviews', 'bookmarks', 'listing_tags', 'system_collections', 'users'];
    if (!allowed.includes(entity)) {
      return new Response(JSON.stringify({ error: 'Invalid entity' }), { status: 400 });
    }

    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL);

    let query = `SELECT * FROM ${entity} WHERE 1=1`;
    const values = [];
    let paramIndex = 1;

    // Auto-filter deleted records (unless admin requests all)
    if (!include_deleted) {
      query += ` AND status != 'deleted'`;
    }

    // Add user filters
    Object.entries(filters).forEach(([key, val]) => {
      query += ` AND ${key} = $${paramIndex}`;
      values.push(val);
      paramIndex++;
    });

    query += ' LIMIT 100';

    const rows = await sql(query, values);

    return new Response(JSON.stringify({ success: true, count: rows.length, data: rows }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
