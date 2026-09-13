const {getJson,setJson,redis}=require('../lib/redis');
async function releaseOrderStock(order){if(!order?.stockReserved)return;for(const item of (order.items||[])){try{await redis('INCRBY',[`sqm:stock:${item.id}`,Number(item.quantity)||0]);}catch(e){console.error('webhook stock release',item.id,e);}}order.stockReserved=false;}
module.exports=async function(req,res){
  if(req.method!=='POST')return res.status(405).json({success:false});
  try{
    const expected=process.env.ASAAS_WEBHOOK_TOKEN,received=req.headers['asaas-access-token']||req.headers['asaas_access_token'];
    if(!expected||received!==expected)return res.status(401).json({success:false,error:'Webhook não autorizado.'});
    const event=req.body||{};
    const eventKey=event.id?`sqm:webhook:${event.id}`:null;
    if(eventKey){const first=await redis('SET',[eventKey,'processing','NX','EX',600]);if(first!=='OK'){const state=await redis('GET',[eventKey]);if(state==='done')return res.status(200).json({success:true,duplicate:true});return res.status(409).json({success:false,error:'Evento já está sendo processado.'});}}
    const p=event.payment||{},paymentId=p.id;if(!paymentId)return res.status(200).json({success:true,ignored:true});
    let orderId=p.externalReference,order=orderId?await getJson(`sqm:order:${orderId}`):null;
    if(!order){const ids=await redis('LRANGE',['sqm:orders','0','199']);for(const id of ids||[]){const o=await getJson(`sqm:order:${id}`);if(o?.asaasPaymentId===paymentId){order=o;orderId=id;break;}}}
    if(!order)return res.status(200).json({success:true,ignored:true});
    const map={PAYMENT_CREATED:['Aguardando pagamento','Pendente'],PAYMENT_CONFIRMED:['Pago','Pago'],PAYMENT_RECEIVED:['Pago','Pago'],PAYMENT_OVERDUE:['Pagamento expirado','Pendente'],PAYMENT_DELETED:['Cancelado','Cancelado'],PAYMENT_REFUNDED:['Cancelado','Cancelado'],PAYMENT_CREDIT_CARD_CAPTURE_REFUSED:['Pagamento recusado','Pendente']};
    const mapped=map[event.event];if(mapped){order.status=mapped[0];order.paymentStatus=mapped[1];}
    if(['PAYMENT_OVERDUE','PAYMENT_DELETED','PAYMENT_REFUNDED'].includes(event.event))await releaseOrderStock(order);
    if(['PAYMENT_CONFIRMED','PAYMENT_RECEIVED'].includes(event.event))order.stockReserved=!!order.stockReserved;
    order.asaasStatus=p.status||order.asaasStatus;order.updatedAt=new Date().toISOString();order.lastWebhookEvent=event.event;await setJson(`sqm:order:${orderId}`,order);
    if(eventKey)await redis('SET',[eventKey,'done','EX',1209600]);
    return res.status(200).json({success:true});
  }catch(e){
    if(typeof eventKey!=='undefined'&&eventKey){try{await redis('DEL',[eventKey]);}catch{}}
    console.error('webhook',e);return res.status(500).json({success:false,error:e.message});
  }
};
