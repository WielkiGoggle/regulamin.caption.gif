export default function handler(req, res) {
  res.setHeader(
    "Set-Cookie",
    "discord_user=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"
  );

  res.status(200).json({
    loggedOut: true
  });
}
