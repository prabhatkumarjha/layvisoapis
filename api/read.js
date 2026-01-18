export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    const body = await req.json();
    const { entity, filters = {} } = body;

    // Allowed tables
    const allowed = ['cities', 'listings', 'providers', 'reviews'];
    if (!allowed.includes(entity)) {
      return new Response(JSON.stringify({ error: 'Invalid entity' }), { status: 400 });
    }

    // Build query
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL);

    let query = `SELECT * FROM ${entity} WHERE 1=1`;
    const values = [];

    // Add filters
    Object.entries(filters).forEach(([key, val], i) => {
      query += ` AND ${key} = $${i + 1}`;
      values.push(val);
    });

    query += ' LIMIT 100';

    const rows = await sql(query, values);

    return new Response(JSON.stringify({ success: true, data: rows }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
