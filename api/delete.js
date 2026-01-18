import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { table, id } = req.body;

    // Soft delete config
    const softDeleteConfig = {
      users: { field: 'status', value: "'deleted'" },
      providers: { field: 'is_active', value: false },
      listings: { field: 'is_active', value: false },
      bookmarks: { field: 'deleted_at', value: 'NOW()' },
      reviews: { field: 'status', value: "'deleted'" },
      system_collections: { field: 'is_active', value: false }
    };

    if (!softDeleteConfig[table]) {
      return res.status(400).json({ error: 'Table not deletable' });
    }

    if (!id) {
      return res.status(400).json({ error: 'ID required' });
    }

    const sql = neon(process.env.DATABASE_URL);
    const config = softDeleteConfig[table];

    const query = `UPDATE ${table} SET ${config.field} = ${config.value}, updated_at = NOW() WHERE id = $1 RETURNING *`;
    const result = await sql(query, [id]);

    if (result.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    // Log to activity_logs
    await sql(`INSERT INTO activity_logs (actor_type, action, entity, entity_id, created_at) VALUES ($1, $2, $3, $4, NOW())`, ['user', 'soft_delete', table, id]);

    return res.status(200).json({ success: true, data: result[0] });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
