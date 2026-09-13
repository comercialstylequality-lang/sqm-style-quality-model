const {requireAdmin}=require('../lib/auth');
const {redis,getJson,setJson}=require('../lib/redis');
async function releaseStock(order){if(!order?.stockReserved)return;for(const item of (order.items||[])){await redis('INCRBY',[`sqm:stock:${item.id}`,Number(item.quantity)||0]);}order.stockReserved=false;}
module.exports=async function(req,res){
  res.setHeader('Cache-Control','no-store');
  try{
    if(!requireAdmin(req,res)) return;
    if(req.method==='GET'){
      const ids=await redis('LRANGE',['sqm:orders','0','199']);
      const orders=[];
      for(const id of (ids||[])) { const o=await getJson(`sqm:order:${id}`); if(o) orders.push(o); }
      return res.status(200).json({success:true,orders});
    }
    if(req.method==='PATCH'){
      const id=String(req.body?.orderId||''); if(!id) return res.status(400).json({success:false,error:'orderId obrigatório.'});
      const order=await getJson(`sqm:order:${id}`); if(!order) return res.status(404).json({success:false,error:'Pedido não encontrado.'});
      const status=String(req.body?.status||'').trim();
      const allowed=['Pagamento pendente','Aguardando pagamento','Pago','Processando','Enviado','Entregue','Cancelado','Pagamento expirado'];
      if(!allowed.includes(status)) return res.status(400).json({success:false,error:'Status inválido.'});
      if(status==='Cancelado') await releaseStock(order); order.status=status; order.paymentStatus=['Pago','Processando','Enviado','Entregue'].includes(status)?'Pago':status==='Cancelado'?'Cancelado':'Pendente'; order.updatedAt=new Date().toISOString();
      await setJson(`sqm:order:${id}`,order);
      return res.status(200).json({success:true,order});
    }
    return res.status(405).json({success:false,error:'Método não permitido.'});
  }catch(e){console.error(e);return res.status(500).json({success:false,error:e.message||'Erro nos pedidos.'});}
};
