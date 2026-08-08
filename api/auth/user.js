export default async function handler(req, res) {
  const cookies = req.headers.cookie || "";

  const match = cookies.match(/(?:^|;\s*)discord_user=([^;]*)/);

  if (!match) {
    return res.status(200).json({
      loggedIn: false
    });
  }

  try {
    const user = JSON.parse(decodeURIComponent(match[1]));

    let avatar = "https://cdn.discordapp.com/embed/avatars/0.png";

    if (user.avatar) {
      avatar = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
    }

    return res.status(200).json({
      loggedIn: true,
      id: user.id,
      username: user.username,
      avatar: avatar
    });
  } catch (error) {
    return res.status(200).json({
      loggedIn: false
    });
  }
}
