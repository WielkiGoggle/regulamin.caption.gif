export default async function handler(req, res) {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send("BŁĄD: Brak kodu Discord.");
    }

    if (!process.env.DISCORD_CLIENT_ID) {
      return res.status(500).send("BŁĄD: Brak DISCORD_CLIENT_ID.");
    }

    if (!process.env.DISCORD_CLIENT_SECRET) {
      return res.status(500).send("BŁĄD: Brak DISCORD_CLIENT_SECRET.");
    }

    if (!process.env.DISCORD_REDIRECT_URI) {
      return res.status(500).send("BŁĄD: Brak DISCORD_REDIRECT_URI.");
    }

    const tokenResponse = await fetch(
      "https://discord.com/api/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          client_id: process.env.DISCORD_CLIENT_ID,
          client_secret: process.env.DISCORD_CLIENT_SECRET,
          grant_type: "authorization_code",
          code: code,
          redirect_uri: process.env.DISCORD_REDIRECT_URI
        })
      }
    );

    const tokenText = await tokenResponse.text();

    let tokenData;

    try {
      tokenData = JSON.parse(tokenText);
    } catch {
      return res.status(500).send(
        "BŁĄD: Discord zwrócił nieprawidłową odpowiedź: " +
        tokenText
      );
    }

    if (!tokenResponse.ok) {
      console.error("Discord token error:", tokenData);

      return res.status(400).send(
        "DISCORD TOKEN ERROR: " +
        JSON.stringify(tokenData)
      );
    }

    if (!tokenData.access_token) {
      return res.status(500).send(
        "BŁĄD: Discord nie zwrócił access_token."
      );
    }

    const userResponse = await fetch(
      "https://discord.com/api/users/@me",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`
        }
      }
    );

    const userText = await userResponse.text();

    let user;

    try {
      user = JSON.parse(userText);
    } catch {
      return res.status(500).send(
        "BŁĄD: Discord zwrócił nieprawidłowe dane użytkownika: " +
        userText
      );
    }

    if (!userResponse.ok) {
      console.error("Discord user error:", user);

      return res.status(400).send(
        "DISCORD USER ERROR: " +
        JSON.stringify(user)
      );
    }

    // Zapisujemy tylko potrzebne dane
    const sessionUser = {
      id: user.id,
      username: user.username,
      global_name: user.global_name || user.username,
      avatar: user.avatar || null
    };

    const cookieValue = encodeURIComponent(JSON.stringify(sessionUser));

    res.setHeader(
      "Set-Cookie",
      `discord_user=${cookieValue}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`
    );

    return res.redirect("/");
  } catch (error) {
    console.error("CALLBACK ERROR:", error);

    return res.status(500).send(
      "CALLBACK ERROR: " +
      (error?.message || String(error))
    );
  }
}
