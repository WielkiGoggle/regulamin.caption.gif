js
export default async function handler(req, res) {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send("Brak kodu autoryzacyjnego.");
    }

    // Pobranie tokena Discord
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

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Discord token error:", tokenData);
      return res.status(400).send("Nie udało się zalogować przez Discord.");
    }

    // Pobranie danych użytkownika
    const userResponse = await fetch(
      "https://discord.com/api/users/@me",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`
        }
      }
    );

    const user = await userResponse.json();

    if (!userResponse.ok) {
      console.error("Discord user error:", user);
      return res.status(400).send("Nie udało się pobrać danych użytkownika.");
    }

    // Zapis użytkownika w cookie
    res.setHeader(
      "Set-Cookie",
      `discord_user=${encodeURIComponent(
        JSON.stringify(user)
      )}; Path=/; Max-Age=604800; SameSite=Lax`
    );

    // Powrót na stronę główną
    return res.redirect("/");
  } catch (error) {
    console.error("Discord callback error:", error);

    return res.status(500).send(
      "Wystąpił błąd podczas logowania przez Discord."
    );
  }
}
