import { sql } from '@vercel/postgres';

function getUserFromCookie(req) {
  const cookies = req.headers.cookie || "";
  const match = cookies.match(/(?:^|;\s*)discord_user=([^;]*)/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

const COOLDOWN_HOURS = 24;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { rows } = await sql`
      SELECT id, username, display_name, avatar, score
      FROM members
      WHERE removed = false
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

    // status blokady 24h dla zalogowanego użytkownika
    let can_vote = null;
    let next_vote_at = null;
    const user = getUserFromCookie(req);
    if (user && user.id) {
      const last = await sql`
        SELECT created_at FROM votes WHERE voter_id = ${user.id} ORDER BY created_at DESC LIMIT 1
      `;
      if (last.rows.length > 0) {
        const lastVoteAt = new Date(last.rows[0].created_at);
        const nextAt = new Date(lastVoteAt.getTime() + COOLDOWN_HOURS * 3600 * 1000);
        if (nextAt > new Date()) {
          can_vote = false;
          next_vote_at = nextAt.toISOString();
        } else {
          can_vote = true;
        }
      } else {
        can_vote = true;
      }
    }

    return res.status(200).json({ members, can_vote, next_vote_at });
  } catch (error) {
    console.error('Members error:', error);
    return res.status(500).json({ error: error.message });
  }
}
