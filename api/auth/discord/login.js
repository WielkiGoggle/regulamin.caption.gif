export default function handler(req, res) {
  const discordUrl =
    "https://discord.com/oauth2/authorize" +
    "?client_id=" + process.env.DISCORD_CLIENT_ID +
    "&response_type=code" +
    "&redirect_uri=" + encodeURIComponent(process.env.DISCORD_REDIRECT_URI) +
    "&scope=identify%20email";

  res.redirect(discordUrl);
}
