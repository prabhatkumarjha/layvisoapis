import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { table, id, data } = req.body;

    // Allowed tables
    const allowed = ['users', 'providers', 'listings', 'bookmarks', 'reviews', 'user_interests', 'listing_tags', 'system_collections'];
    if (!allowed.includes(table)) {
      return res.status(400).json({ error: 'Invalid table' });
    }

    if (!id) {
      return res.status(400).json({ error: 'ID required' });
    }

    const sql = neon(process.env.DATABASE_URL);

    // Build UPDATE
    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');

    const query = `UPDATE ${table} SET ${setClause}, updated_at = NOW() WHERE id = $${columns.length + 1} RETURNING *`;
    const result = await sql(query, [...values, id]);

    if (result.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    // Log to activity_logs
    await sql(`INSERT INTO activity_logs (actor_type, action, entity, entity_id, payload, created_at) VALUES ($1, $2, $3, $4, $5, NOW())`, ['user', 'update', table, id, JSON.stringify(data)]);

    return res.status(200).json({ success: true, data: result[0] });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
