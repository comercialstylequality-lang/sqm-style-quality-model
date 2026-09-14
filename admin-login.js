const {setSessionCookie}=require('../lib/auth');
module.exports=async function(req,res){
  if(req.method!=='POST') return res.status(405).json({success:false,error:'Método não permitido.'});
  const {ADMIN_USER,ADMIN_PASSWORD}=process.env;
  if(!ADMIN_USER||!ADMIN_PASSWORD||!process.env.ADMIN_SESSION_SECRET) return res.status(500).json({success:false,error:'Credenciais administrativas não configuradas no Vercel.'});
  const body=req.body||{};
  if(String(body.user||'')!==ADMIN_USER || String(body.password||'')!==ADMIN_PASSWORD) return res.status(401).json({success:false,error:'Usuário ou senha incorretos.'});
  setSessionCookie(res,ADMIN_USER);
  return res.status(200).json({success:true,user:ADMIN_USER});
};
