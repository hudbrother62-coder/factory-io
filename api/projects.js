import { neon } from '@neondatabase/serverless';
import { createHash, randomUUID } from 'node:crypto';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const token = req.headers['x-workspace-key'];
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return res.status(401).json({ error: 'Kunci workspace tidak valid.' });
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: 'Neon belum terhubung. Gunakan penyimpanan lokal atau impor/ekspor JSON.' });
  const owner = createHash('sha256').update(token).digest('hex');
  const sql = neon(process.env.DATABASE_URL);
  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT id, title, scene, updated_at FROM factory_projects WHERE workspace_hash = ${owner} ORDER BY updated_at DESC LIMIT 40`;
      return res.status(200).json({ projects: rows });
    }
    if (req.method === 'PUT') {
      const { id, title, scene } = req.body || {};
      if (typeof title !== 'string' || title.trim().length < 1 || title.length > 100 || !scene || typeof scene !== 'object' || Array.isArray(scene)) return res.status(400).json({ error: 'Data proyek tidak valid.' });
      if (!Array.isArray(scene.parts) || scene.parts.length > 250 || !Array.isArray(scene.rules) || scene.rules.length > 100 || JSON.stringify(scene).length > 150000) return res.status(413).json({ error: 'Ukuran scene melewati batas.' });
      const projectId = id && /^[0-9a-f-]{36}$/.test(id) ? id : randomUUID();
      const payload = JSON.stringify(scene);
      const rows = await sql`INSERT INTO factory_projects (id, workspace_hash, title, scene) VALUES (${projectId}, ${owner}, ${title.trim()}, ${payload}::jsonb) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, scene = EXCLUDED.scene, updated_at = now() WHERE factory_projects.workspace_hash = ${owner} RETURNING id, updated_at`;
      if (!rows.length) return res.status(403).json({ error: 'Proyek bukan milik workspace ini.' });
      return res.status(200).json({ id: rows[0].id, updated_at: rows[0].updated_at });
    }
    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({ error: 'ID tidak valid.' });
      await sql`DELETE FROM factory_projects WHERE id = ${id} AND workspace_hash = ${owner}`;
      return res.status(204).end();
    }
    return res.status(405).json({ error: 'Metode tidak didukung.' });
  } catch (error) {
    console.error('Project storage failed:', error);
    return res.status(500).json({ error: 'Penyimpanan Neon gagal. Coba lagi.' });
  }
}
