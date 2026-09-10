function redisConfig(){
  const url=process.env.KV_REST_API_URL
    || process.env.UPSTASH_REDIS_REST_URL_KV_REST_API_URL
    || process.env.UPSTASH_REDIS_REST_URL;
  const token=process.env.KV_REST_API_TOKEN
    || process.env.UPSTASH_REDIS_REST_URL_KV_REST_API_TOKEN
    || process.env.UPSTASH_REDIS_REST_TOKEN;
  if(!url||!token) throw new Error('KV_REST_API_URL/KV_REST_API_TOKEN não configuradas.');
  return {url:url.replace(/\/$/,''),token};
}
async function redis(command,args=[]){
  const {url,token}=redisConfig();
  const r=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify([command,...args])});
  const data=await r.json().catch(()=>({}));
  if(!r.ok || data.error) throw new Error(data.error||`Redis HTTP ${r.status}`);
  return data.result;
}
async function getJson(key){const v=await redis('GET',[key]);return v?JSON.parse(v):null;}
async function setJson(key,value){return redis('SET',[key,JSON.stringify(value)]);}
module.exports={redis,getJson,setJson};
