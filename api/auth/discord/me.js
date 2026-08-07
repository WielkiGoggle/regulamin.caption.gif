export default function handler(req, res) {

  const cookie = req.headers.cookie;

  if (!cookie) {
    return res.status(401).json({
      loggedIn: false
    });
  }

  const match = cookie.match(/user=([^;]+)/);

  if (!match) {
    return res.status(401).json({
      loggedIn: false
    });
  }

  const user = JSON.parse(
    decodeURIComponent(match[1])
  );

  res.status(200).json({
    loggedIn: true,
    user
  });
}
