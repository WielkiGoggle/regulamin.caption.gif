export default async function handler(req, res) {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send("BŁĄD: Brak kodu Discord.");
    }

    if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET || !process.env.DISCORD_REDIRECT_URI) {
      return res.status(500).send("BŁĄD: Brak zmiennych środowiskowych Discord.");
    }

    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
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
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Token error:", tokenData);
      return res.status(400).send("Błąd tokena Discord: " + JSON.stringify(tokenData));
    }

    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    });

    const user = await userResponse.json();

    if (!userResponse.ok) {
      console.error("User error:", user);
      return res.status(400).send("Błąd użytkownika Discord: " + JSON.stringify(user));
    }

    // Tylko potrzebne dane
    const sessionUser = {
      id: user.id,
      username: user.username,
      global_name: user.global_name || user.username,
      avatar: user.avatar || null
    };

    const cookieValue = encodeURIComponent(JSON.stringify(sessionUser));

    // Ustawiamy cookie
    res.setHeader("Set-Cookie", [
      `discord_user=${cookieValue}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`
    ]);

    // Przekierowanie
    res.writeHead(302, {
      Location: "/"
    });
    res.end();

  } catch (error) {
    console.error("CALLBACK ERROR:", error);
    return res.status(500).send("CALLBACK ERROR: " + (error.message || String(error)));
  }
}
