const {getJson}=require('../lib/redis');
const KEY='sqm:site:html';
module.exports=async function(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).send('Método não permitido.');
  try{
    const html=await getJson(KEY);
    if(!html)return res.status(200).send('');
    const marker='<meta name="sqm-published" content="1">';
    const output=String(html).includes('name="sqm-published"')?String(html):String(html).replace(/<head([^>]*)>/i,`<head$1>${marker}`);
    res.setHeader('Content-Type','text/html; charset=utf-8');
    return res.status(200).send(output);
  }catch(e){console.error('site-html',e);return res.status(500).send('');}
};
