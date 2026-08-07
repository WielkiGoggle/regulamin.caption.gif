export default async function handler(req, res) {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send("Brak kodu Discord");
  }

  const response = await fetch("https://discord.com/api/oauth2/token", {
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
  });

  const data = await response.json();

  if (!data.access_token) {
    return res.status(500).json(data);
  }

  const userResponse = await fetch(
    "https://discord.com/api/users/@me",
    {
      headers: {
        Authorization: `Bearer ${data.access_token}`,
      },
    }
  );

  const user = await userResponse.json();

  res.status(200).json({
    message: "Zalogowano!",
    username: user.username,
    avatar: user.avatar,
    id: user.id,
  });
}
