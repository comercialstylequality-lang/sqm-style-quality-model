const {getJson,setJson,redis}=require('../lib/redis');
module.exports=async function(req,res){
  if(req.method!=='POST') return res.status(405).json({success:false});
  try{
    const expected=process.env.ASAAS_WEBHOOK_TOKEN;
    const received=req.headers['asaas-access-token']||req.headers['asaas_access_token'];
    if(!expected||received!==expected) return res.status(401).json({success:false,error:'Webhook não autorizado.'});
    const event=req.body||{};
    if(event.id){const key=`sqm:webhook:${event.id}`;const first=await redis('SET',[key,'1','NX','EX','1209600']);if(first!=='OK') return res.status(200).json({success:true,duplicate:true});}
    const p=event.payment||{}; const paymentId=p.id; if(!paymentId)return res.status(200).json({success:true,ignored:true});
    let orderId=p.externalReference;
    let order=orderId?await getJson(`sqm:order:${orderId}`):null;
    if(!order){
      const ids=await redis('LRANGE',['sqm:orders','0','199']);
      for(const id of ids||[]){const o=await getJson(`sqm:order:${id}`);if(o?.asaasPaymentId===paymentId){order=o;orderId=id;break;}}
    }
    if(!order)return res.status(200).json({success:true,ignored:true});
    const map={PAYMENT_CREATED:['Aguardando pagamento','Pendente'],PAYMENT_CONFIRMED:['Pago','Pago'],PAYMENT_RECEIVED:['Pago','Pago'],PAYMENT_OVERDUE:['Pagamento expirado','Pendente'],PAYMENT_DELETED:['Cancelado','Cancelado'],PAYMENT_REFUNDED:['Cancelado','Cancelado'],PAYMENT_CREDIT_CARD_CAPTURE_REFUSED:['Pagamento recusado','Pendente']};
    const mapped=map[event.event];
    if(mapped){order.status=mapped[0];order.paymentStatus=mapped[1];}
    order.asaasStatus=p.status||order.asaasStatus;order.updatedAt=new Date().toISOString();order.lastWebhookEvent=event.event;
    await setJson(`sqm:order:${orderId}`,order);
    return res.status(200).json({success:true});
  }catch(e){console.error('webhook',e);return res.status(500).json({success:false,error:e.message});}
};
