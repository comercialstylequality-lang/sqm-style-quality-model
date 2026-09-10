const {verifySession}=require('../lib/auth');
module.exports=async function(req,res){
  if(req.method!=='GET') return res.status(405).json({success:false,error:'Método não permitido.'});
  const s=verifySession(req);
  return res.status(200).json({authenticated:!!s,user:s?.u||null});
};
