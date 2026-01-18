import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { table, data } = req.body;

    // Allowed tables
    const allowed = ['users', 'providers', 'listings', 'bookmarks', 'reviews', 'listing_views', 'listing_clicks', 'user_interests', 'listing_tags', 'system_collections'];
    if (!allowed.includes(table)) {
      return res.status(400).json({ error: 'Invalid table' });
    }

    const sql = neon(process.env.DATABASE_URL);

    // Build INSERT
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, i) => `$${i + 1}`);

    const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    const result = await sql(query, values);

    // Log to activity_logs
    await sql(`INSERT INTO activity_logs (actor_type, action, entity, entity_id, payload, created_at) VALUES ($1, $2, $3, $4, $5, NOW())`, ['user', 'create', table, result[0]?.id, JSON.stringify(data)]);

    return res.status(201).json({ success: true, data: result[0] });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
