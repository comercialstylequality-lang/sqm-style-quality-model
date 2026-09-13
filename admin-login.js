const {setSessionCookie}=require('../lib/auth');
const {redis}=require('../lib/redis');
const WINDOW=15*60, LIMIT=10;
function clientIp(req){const x=req.headers['x-forwarded-for']||req.headers['x-real-ip']||'unknown';return String(x).split(',')[0].trim().slice(0,80)||'unknown';}
module.exports=async function(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') return res.status(405).json({success:false,error:'Método não permitido.'});
  const {ADMIN_USER,ADMIN_PASSWORD}=process.env;
  if(!ADMIN_USER||!ADMIN_PASSWORD||!process.env.ADMIN_SESSION_SECRET) return res.status(500).json({success:false,error:'Credenciais administrativas não configuradas no Vercel.'});
  try{
    const ip=clientIp(req), key=`sqm:login-rate:${ip.replace(/[^a-zA-Z0-9_.:-]/g,'_')}`;
    const attempts=Number(await redis('INCR',[key]));
    if(attempts===1) await redis('EXPIRE',[key,WINDOW]);
    if(attempts>LIMIT) return res.status(429).json({success:false,error:'Muitas tentativas de login. Aguarde 15 minutos e tente novamente.'});
    const body=req.body||{};
    if(String(body.user||'')!==ADMIN_USER || String(body.password||'')!==ADMIN_PASSWORD) return res.status(401).json({success:false,error:'Usuário ou senha incorretos.'});
    await redis('DEL',[key]);
    setSessionCookie(res,ADMIN_USER);
    return res.status(200).json({success:true,user:ADMIN_USER});
  }catch(e){console.error('admin-login',e);return res.status(500).json({success:false,error:'Não foi possível validar o login agora.'});}
};
