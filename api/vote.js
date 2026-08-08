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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = getUserFromCookie(req);
  if (!user || !user.id) {
    return res.status(401).json({ error: 'Musisz być zalogowany, aby głosować.' });
  }

  const { member_id, value } = req.body || {};

  if (!member_id || (value !== 1 && value !== -1)) {
    return res.status(400).json({ error: 'Nieprawidłowe dane głosu.' });
  }

  if (member_id === user.id) {
    return res.status(400).json({ error: 'Nie możesz głosować na samego siebie.' });
  }

  try {
    const existing = await sql`
      SELECT id FROM votes
      WHERE voter_id = ${user.id}
        AND created_at::date = CURRENT_DATE
    `;

    if (existing.rows.length > 0) {
      return res.status(429).json({ error: 'Już dziś zagłosowałeś. Wróć jutro.' });
    }

    await sql`
      INSERT INTO votes (voter_id, member_id, value)
      VALUES (${user.id}, ${member_id}, ${value})
    `;

    await sql`
      UPDATE members
      SET score = score + ${value}
      WHERE id = ${member_id}
    `;

    const updated = await sql`
      SELECT score FROM members WHERE id = ${member_id}
    `;

    return res.status(200).json({
      success: true,
      new_score: updated.rows[0]?.score ?? null
    });

  } catch (error) {
    if (error.message && error.message.includes('votes_one_per_day')) {
      return res.status(429).json({ error: 'Już dziś zagłosowałeś. Wróć jutro.' });
    }
    console.error('Vote error:', error);
    return res.status(500).json({ error: error.message });
  }
}
