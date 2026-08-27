import { sql } from '@vercel/postgres';

async function discordFetch(path, botToken) {
  const res = await fetch(`https://discord.com/api/v10${path}`, {
    headers: { Authorization: `Bot ${botToken}` }
  });
  if (!res.ok) {
    throw new Error(`Discord API ${path} -> ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function fetchAllMembers(guildId, botToken) {
  const all = [];
  let after = '0';
  for (;;) {
    const batch = await discordFetch(`/guilds/${guildId}/members?limit=1000&after=${after}`, botToken);
    if (batch.length === 0) break;
    all.push(...batch);
    after = batch[batch.length - 1].user.id;
    if (batch.length < 1000) break;
  }
  return all;
}

// Rozróżnia kick / ban sprawdzając dziennik audytu serwera.
async function findRemovalReason(guildId, userId, botToken) {
  try {
    const bans = await discordFetch(`/guilds/${guildId}/audit-logs?action_type=22&limit=50`, botToken); // MEMBER_BAN_ADD
    if (bans.audit_log_entries?.some(e => e.target_id === userId)) return 'zbanowany';

    const kicks = await discordFetch(`/guilds/${guildId}/audit-logs?action_type=20&limit=50`, botToken); // MEMBER_KICK
    if (kicks.audit_log_entries?.some(e => e.target_id === userId)) return 'wyrzucony';
  } catch (e) {
    console.error('Audit log error:', e.message);
  }
  return 'opuścił serwer';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Vercel Cron automatycznie wysyła nagłówek Authorization: Bearer <CRON_SECRET>.
  // Dodatkowo wspieramy ?secret=... do ręcznego odpalenia w przeglądarce.
  const authHeader = req.headers.authorization;
  const querySecret = req.query.secret;
  const expected = process.env.CRON_SECRET;
  if (authHeader !== `Bearer ${expected}` && querySecret !== expected) {
    return res.status(401).json({ error: 'Brak dostępu.' });
  }

  try {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const guildId = process.env.GUILD_ID;
    if (!botToken || !guildId) {
      return res.status(500).json({ error: 'Brak DISCORD_BOT_TOKEN lub GUILD_ID' });
    }

    const liveMembers = await fetchAllMembers(guildId, botToken);
    const liveIds = new Set(liveMembers.filter(m => !m.user.bot).map(m => m.user.id));

    let added = 0, updated = 0, removedCount = 0;

    for (const member of liveMembers) {
      const user = member.user;
      if (user.bot) continue;
      const id = user.id;
      const username = user.username;
      const displayName = member.nick || user.global_name || user.username;
      const avatar = user.avatar || null;

      const existing = await sql`SELECT avatar, removed FROM members WHERE id = ${id}`;

      await sql`
        INSERT INTO members (id, username, display_name, avatar, updated_at, removed, removed_at, removed_reason)
        VALUES (${id}, ${username}, ${displayName}, ${avatar}, NOW(), false, NULL, NULL)
        ON CONFLICT (id) DO UPDATE SET
          username = EXCLUDED.username,
          display_name = EXCLUDED.display_name,
          avatar = EXCLUDED.avatar,
          updated_at = NOW(),
          removed = false,
          removed_at = NULL,
          removed_reason = NULL
      `;

      if (existing.rows.length === 0) added++;
      else if (existing.rows[0].avatar !== avatar || existing.rows[0].removed) updated++;
    }

    // Ci, którzy są w bazie jako aktywni, ale zniknęli z serwera -> oznacz jako usuniętych
    const dbActive = await sql`SELECT id FROM members WHERE removed = false`;
    for (const row of dbActive.rows) {
      if (!liveIds.has(row.id)) {
        const reason = await findRemovalReason(guildId, row.id, botToken);
        await sql`
          UPDATE members
          SET removed = true, removed_at = NOW(), removed_reason = ${reason}
          WHERE id = ${row.id}
        `;
        removedCount++;
      }
    }

    return res.status(200).json({
      success: true,
      total_live: liveIds.size,
      added,
      updated,
      removed: removedCount
    });
  } catch (error) {
    console.error('Sync error:', error);
    return res.status(500).json({ error: error.message });
  }
}
