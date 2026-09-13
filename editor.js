const { requireAdmin } = require('../lib/auth');
const { getJson, setJson } = require('../lib/redis');
const KEY='sqm:editor:html', PUBLIC_KEY='sqm:site:html', MAX_HTML=700*1024;
module.exports=async function(req,res){
  res.setHeader('Cache-Control','no-store');
  try{
    if(!requireAdmin(req,res))return;
    if(req.method==='GET'){const html=await getJson(KEY);return res.status(200).json({ok:true,html:html||''});}
    if(req.method==='PUT'){
      const html=String(req.body?.html||'');if(!html.trim())return res.status(400).json({ok:false,error:'HTML vazio.'});if(Buffer.byteLength(html,'utf8')>MAX_HTML)return res.status(413).json({ok:false,error:'HTML muito grande.'});
      await setJson(KEY,html);await setJson(PUBLIC_KEY,html);return res.status(200).json({ok:true,published:true});
    }
    if(req.method==='DELETE'){await setJson(KEY,'');await setJson(PUBLIC_KEY,'');return res.status(200).json({ok:true});}
    return res.status(405).json({ok:false,error:'Método não permitido.'});
  }catch(e){console.error('SQM editor:',e);return res.status(500).json({ok:false,error:e.message||'Erro no editor.'});}
};
