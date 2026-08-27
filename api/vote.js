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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = getUserFromCookie(req);
  if (!user || !user.id) {
    return res.status(401).json({ error: 'Musisz być zalogowany, aby głosować.' });
  }

  const { plus_id, minus_id } = req.body || {};
  if (!plus_id || !minus_id) {
    return res.status(400).json({ error: 'Wybierz osobę na + i osobę na −.' });
  }
  if (plus_id === minus_id) {
    return res.status(400).json({ error: 'Nie możesz wybrać tej samej osoby na + i na −.' });
  }
  if (plus_id === user.id || minus_id === user.id) {
    return res.status(400).json({ error: 'Nie możesz głosować na samego siebie.' });
  }

  try {
    // obaj kandydaci muszą istnieć i nie być usunięci z serwera
    const candidates = await sql`
      SELECT id, removed FROM members WHERE id IN (${plus_id}, ${minus_id})
    `;
    if (candidates.rows.length !== 2 || candidates.rows.some(c => c.removed)) {
      return res.status(400).json({ error: 'Jeden z wybranych uczestników jest niedostępny.' });
    }

    // rolling 24h od ostatniego głosu (nie reset o północy)
    const last = await sql`
      SELECT created_at FROM votes
      WHERE voter_id = ${user.id}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (last.rows.length > 0) {
      const lastVoteAt = new Date(last.rows[0].created_at);
      const nextVoteAt = new Date(lastVoteAt.getTime() + COOLDOWN_HOURS * 3600 * 1000);
      if (nextVoteAt > new Date()) {
        return res.status(429).json({
          error: 'Możesz głosować raz na 24 godziny.',
          next_vote_at: nextVoteAt.toISOString()
        });
      }
    }

    await sql`
      INSERT INTO votes (voter_id, plus_member_id, minus_member_id, created_at)
      VALUES (${user.id}, ${plus_id}, ${minus_id}, NOW())
    `;
    await sql`UPDATE members SET score = score + 1 WHERE id = ${plus_id}`;
    await sql`UPDATE members SET score = score - 1 WHERE id = ${minus_id}`;

    const nextVoteAt = new Date(Date.now() + COOLDOWN_HOURS * 3600 * 1000);
    return res.status(200).json({ success: true, next_vote_at: nextVoteAt.toISOString() });
  } catch (error) {
    console.error('Vote error:', error);
    return res.status(500).json({ error: error.message });
  }
}
