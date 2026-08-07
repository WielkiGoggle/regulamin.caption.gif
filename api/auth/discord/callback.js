import { sql } from "@vercel/postgres";

export default async function handler(req, res) {

  const code = req.query.code;

  if (!code) {
    return res.status(400).send("Brak kodu Discord");
  }


  // Pobieranie tokena Discord
  const response = await fetch(
    "https://discord.com/api/oauth2/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
      }),
    }
  );


  const data = await response.json();


  if (!data.access_token) {
    return res.status(500).json(data);
  }



  // Pobieranie użytkownika Discord
  const userResponse = await fetch(
    "https://discord.com/api/users/@me",
    {
      headers: {
        Authorization: `Bearer ${data.access_token}`,
      },
    }
  );


  const user = await userResponse.json();



  // Zapis do Neon PostgreSQL
  await sql`
    INSERT INTO users (
      discord_id,
      username,
      avatar
    )
    VALUES (
      ${user.id},
      ${user.username},
      ${user.avatar}
    )
    ON CONFLICT (discord_id)
    DO UPDATE SET
      username = ${user.username},
      avatar = ${user.avatar};
  `;



  // Powrót na stronę z danymi użytkownika
  res.redirect(
    `/?user=${encodeURIComponent(JSON.stringify(user))}`
  );

}
