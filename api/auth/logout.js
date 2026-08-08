export default async function handler(req, res) {
  res.setHeader(
    "Set-Cookie",
    "discord_user=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"
  );

  return res.redirect(302, "/");
}
