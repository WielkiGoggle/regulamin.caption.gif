import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { rows } = await sql`
      SELECT id, username, display_name, avatar, removed_reason, removed_at
      FROM members
      WHERE removed = true
      ORDER BY removed_at DESC
    `;
    const members = rows.map(m => ({
      id: m.id,
      display_name: m.display_name || m.username,
      removed_reason: m.removed_reason,
      removed_at: m.removed_at,
      avatar_url: m.avatar
        ? `https://cdn.discordapp.com/avatars/${m.id}/${m.avatar}.png?size=128`
        : `https://cdn.discordapp.com/embed/avatars/0.png`
    }));
    return res.status(200).json({ members });
  } catch (error) {
    console.error('Removed members error:', error);
    return res.status(500).json({ error: error.message });
  }
}
