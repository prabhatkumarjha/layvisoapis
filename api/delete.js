import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { table, id } = req.body;

    // Soft delete tables (set deleted_at)
    const softDelete = ['bookmarks', 'reviews'];
    
    // Hard delete tables
    const hardDelete = ['listing_views', 'listing_clicks', 'listing_tags', 'user_interests'];

    const allowed = [...softDelete, ...hardDelete];
    if (!allowed.includes(table)) {
      return res.status(400).json({ error: 'Invalid table' });
    }

    if (!id) {
      return res.status(400).json({ error: 'ID required' });
    }

    const sql = neon(process.env.DATABASE_URL);
    let result;

    if (softDelete.includes(table)) {
      result = await sql(`UPDATE ${table} SET deleted_at = NOW() WHERE id = $1 RETURNING *`, [id]);
    } else {
      result = await sql(`DELETE FROM ${table} WHERE id = $1 RETURNING *`, [id]);
    }

    if (result.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    // Log to activity_logs
    await sql(`INSERT INTO activity_logs (actor_type, action, entity, entity_id, created_at) VALUES ($1, $2, $3, $4, NOW())`, ['user', 'delete', table, id]);

    return res.status(200).json({ success: true, data: result[0] });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
