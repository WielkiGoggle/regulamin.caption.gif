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
    res.setHeader('Cache-Control', 'no-store');
    const user = getUserFromCookie(req);
    const { rows } = await sql`
      SELECT id, username, display_name, avatar, score
      FROM members
      WHERE removed = false
      ORDER BY score DESC, display_name ASC
    `;

    const members = rows.map(member => ({
      id: member.id,
      display_name: member.display_name || member.username,
      score: Number(member.score) || 0,
      avatar_url: member.avatar
        ? `https://cdn.discordapp.com/avatars/${member.id}/${member.avatar}.png?size=128`
        : 'https://cdn.discordapp.com/embed/avatars/0.png'
    }));

    let canVote = false;
    let nextVoteAt = null;

    if (user?.id) {
      const lastVote = await sql`
        SELECT created_at
        FROM votes
        WHERE voter_id = ${user.id}
        ORDER BY created_at DESC
        LIMIT 1
      `;

      canVote = true;
      if (lastVote.rows.length > 0) {
        const lastVoteAt = new Date(lastVote.rows[0].created_at);
        const nextVoteTime = lastVoteAt.getTime() + COOLDOWN_HOURS * 3600 * 1000;
        if (nextVoteTime > Date.now()) {
          canVote = false;
          nextVoteAt = new Date(nextVoteTime).toISOString();
        }
      }
    }

    return res.status(200).json({
      members,
      can_vote: canVote,
      next_vote_at: nextVoteAt
    });
  } catch (error) {
    console.error('Members ranking error:', error);
    return res.status(500).json({ error: error.message });
  }
}
