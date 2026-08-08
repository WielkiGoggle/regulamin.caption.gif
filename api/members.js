import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { rows } = await sql`
      SELECT id, username, display_name, avatar, score
      FROM members
      ORDER BY score DESC
    `;

    const members = rows.map(m => ({
      id: m.id,
      username: m.username,
      display_name: m.display_name,
      score: m.score,
      avatar_url: m.avatar
        ? `https://cdn.discordapp.com/avatars/${m.id}/${m.avatar}.png?size=128`
        : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(m.id) >> 22n) % 6}.png`
    }));

    return res.status(200).json({ members });
  } catch (error) {
    console.error('Members error:', error);
    return res.status(500).json({ error: error.message });
  }
}
