const {clearSessionCookie}=require('../lib/auth');
module.exports=async function(req,res){
  if(req.method!=='POST') return res.status(405).json({success:false,error:'Método não permitido.'});
  clearSessionCookie(res);
  return res.status(200).json({success:true});
};
