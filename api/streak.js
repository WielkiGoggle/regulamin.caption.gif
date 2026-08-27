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

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}
function dateStr(value) {
  // @vercel/postgres może zwrócić DATE jako Date lub string - obsługujemy oba
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}
function daysBetween(a, b) {
  const d1 = new Date(a + 'T00:00:00Z');
  const d2 = new Date(b + 'T00:00:00Z');
  return Math.round((d2 - d1) / 86400000);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const user = getUserFromCookie(req);
  if (!user || !user.id) {
    return res.status(401).json({ error: 'Niezalogowany.' });
  }

  try {
    const today = todayUTC();
    const { rows } = await sql`SELECT * FROM visits WHERE user_id = ${user.id}`;

    if (rows.length === 0) {
      await sql`
        INSERT INTO visits (user_id, last_visit_date, current_streak, longest_streak)
        VALUES (${user.id}, ${today}, 1, 1)
      `;
      return res.status(200).json({ streak: 1 });
    }

    const row = rows[0];
    const diff = daysBetween(dateStr(row.last_visit_date), today);

    let newStreak = row.current_streak;
    if (diff === 1) newStreak = row.current_streak + 1;
    else if (diff > 1) newStreak = 1;
    // diff === 0 -> już zaliczone dzisiaj, bez zmian

    const newLongest = Math.max(row.longest_streak, newStreak);

    await sql`
      UPDATE visits
      SET last_visit_date = ${today}, current_streak = ${newStreak}, longest_streak = ${newLongest}
      WHERE user_id = ${user.id}
    `;

    return res.status(200).json({ streak: newStreak, longest: newLongest });
  } catch (error) {
    console.error('Streak error:', error);
    return res.status(500).json({ error: error.message });
  }
}
