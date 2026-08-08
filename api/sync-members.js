import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  // Tylko metoda GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const guildId = process.env.GUILD_ID;

    if (!botToken || !guildId) {
      return res.status(500).json({ error: 'Brak DISCORD_BOT_TOKEN lub GUILD_ID' });
    }

    // Pobieramy członków serwera
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members?limit=100`,
      {
        headers: {
          Authorization: `Bot ${botToken}`
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Discord error:', errorText);
      return res.status(500).json({ error: 'Nie udało się pobrać członków', details: errorText });
    }

    const members = await response.json();

    // Zapisujemy / aktualizujemy każdego członka
    for (const member of members) {
      const user = member.user;
      if (user.bot) continue; // pomijamy boty

      const id = user.id;
      const username = user.username;
      const displayName = member.nick || user.global_name || user.username;
      const avatar = user.avatar || null;

      await sql`
        INSERT INTO members (id, username, display_name, avatar, updated_at)
        VALUES (${id}, ${username}, ${displayName}, ${avatar}, NOW())
        ON CONFLICT (id) DO UPDATE SET
          username = EXCLUDED.username,
          display_name = EXCLUDED.display_name,
          avatar = EXCLUDED.avatar,
          updated_at = NOW()
      `;
    }

    return res.status(200).json({
      success: true,
      count: members.filter(m => !m.user.bot).length
    });

  } catch (error) {
    console.error('Sync error:', error);
    return res.status(500).json({ error: error.message });
  }
}
