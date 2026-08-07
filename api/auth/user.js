export default function handler(req,res){

  if(!req.cookies || !req.cookies.discord_user){
    return res.json({
      loggedIn:false
    });
  }

  const user = JSON.parse(req.cookies.discord_user);

  res.json({
    loggedIn:true,
    username:user.username,
    avatar:`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
  });
}
