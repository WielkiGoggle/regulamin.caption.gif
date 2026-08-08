export default async function handler(req, res) {
  res.setHeader("Set-Cookie", [
    "discord_user=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"
  ]);

  res.writeHead(302, {
    Location: "/"
  });
  res.end();
}
