const {getJson,setJson,redis,del}=require('../lib/redis');
const ASAAS_API_URL='https://api.asaas.com/v3';
function send(res,status,data){return res.status(status).setHeader('Content-Type','application/json; charset=utf-8').json(data);}
async function asaas(path,options={}){const key=process.env.ASAAS_API_KEY;if(!key)throw Object.assign(new Error('ASAAS_API_KEY não configurada no Vercel.'),{status:500});const r=await fetch(`${ASAAS_API_URL}${path}`,{...options,headers:{Accept:'application/json','Content-Type':'application/json',access_token:key,...(options.headers||{})}});const data=await r.json().catch(()=>({}));if(!r.ok){const msg=data?.errors?.map(x=>x.description).filter(Boolean).join('; ')||data?.error||`Asaas HTTP ${r.status}`;throw Object.assign(new Error(msg),{status:r.status});}return data;}
const digits=v=>String(v||'').replace(/\D/g,''); const round=v=>Math.round(Number(v)*100)/100;
function paymentType(v){const x=String(v||'').toUpperCase();return x==='PIX'||x==='CREDIT_CARD'?x:null;}
function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date());}
async function saveOrder(order){await setJson(`sqm:order:${order.id}`,order);await redis('LPUSH',['sqm:orders',order.id]);}
async function reserveStock(items){const reserved=[];try{for(const item of items){const key=`sqm:stock:${item.id}`;await redis('SET',[key,String(item.stock),'NX']);const left=Number(await redis('DECRBY',[key,item.quantity]));if(!Number.isFinite(left)||left<0)throw new Error(`Estoque insuficiente para ${item.name}.`);reserved.push({...item,left});}return reserved;}catch(e){for(const item of reserved){try{await redis('INCRBY',[`sqm:stock:${item.id}`,item.quantity]);}catch(err){console.error('stock rollback',err);}}throw e;}}
async function releaseStock(items){for(const item of (items||[])){try{await redis('INCRBY',[`sqm:stock:${item.id}`,item.quantity]);}catch(e){console.error('stock release',item.id,e);}}}
module.exports=async function(req,res){
  if(req.method!=='POST')return send(res,405,{success:false,error:'Método não permitido.'});
  let reservation=[];let paymentId=null;let orderKey=null;
  try{
    const body=req.body||{},customer=body.customer||{},paymentMethod=paymentType(body.paymentMethod);
    const orderId=String(body.orderId||`SQM-${Date.now()}`).trim().slice(0,100);orderKey=`sqm:checkout:${orderId}`;
    const claimed=await redis('SET',[orderKey,'1','NX','EX',86400]);if(claimed!=='OK')return send(res,409,{success:false,error:'Este pedido já foi processado ou está em processamento. Gere um novo pedido.'});
    const name=String(customer.name||'').trim(),email=String(customer.email||'').trim().toLowerCase(),cpfCnpj=digits(customer.cpfCnpj),phone=digits(customer.phone),cep=digits(customer.cep);
    if(name.length<2||name.length>160)throw Object.assign(new Error('Informe um nome válido.'),{status:400});
    if(!/^\S+@\S+\.\S+$/.test(email)||email.length>254)throw Object.assign(new Error('Informe um e-mail válido.'),{status:400});
    if(![11,14].includes(cpfCnpj.length))throw Object.assign(new Error('CPF/CNPJ inválido.'),{status:400});
    if(phone.length<10||phone.length>15)throw Object.assign(new Error('Telefone inválido.'),{status:400});
    if(!paymentMethod)throw Object.assign(new Error('Forma de pagamento inválida.'),{status:400});
    const requested=Array.isArray(body.items)?body.items:[];if(!requested.length||requested.length>50)throw Object.assign(new Error('Carrinho vazio ou inválido.'),{status:400});
    const products=await getJson('sqm:products');const catalog=Array.isArray(products)?products:require('./products').INITIAL_PRODUCTS;const items=[];const ids=new Set();
    for(const row of requested){const p=catalog.find(x=>String(x.id)===String(row.id));const qty=Math.floor(Number(row.quantity));if(!p||!p.active||ids.has(String(p.id))||qty<1||qty>100)throw Object.assign(new Error('Um produto do carrinho é inválido ou indisponível.'),{status:400});ids.add(String(p.id));
      const color=String(row.color||row.selectedColor||row.cor||'').trim().slice(0,100);
      const size=String(row.size||row.selectedSize||row.tamanho||'').trim().slice(0,100);
      items.push({id:p.id,name:p.name,quantity:qty,value:round(p.price),cost:round(p.cost),stock:Math.max(0,Math.floor(Number(p.stock)||0)),description:p.description||'Produto SQM',color,size});}
    const total=round(items.reduce((s,x)=>s+x.value*x.quantity,0));if(total<=0)throw Object.assign(new Error('Valor do pedido inválido.'),{status:400});
    reservation=await reserveStock(items);
    const order={id:orderId,date:new Date().toISOString(),status:'Pagamento pendente',paymentStatus:'Pendente',payment:paymentMethod,total,items,customer:{name,email,cpfCnpj,phone,cep,address:String(customer.address||'').trim().slice(0,240),number:String(customer.number||'').trim().slice(0,30),complement:String(customer.complement||'').trim().slice(0,160),city:String(customer.city||'').trim().slice(0,120),state:String(customer.state||'').trim().slice(0,80)},createdAt:new Date().toISOString(),stockReserved:true};
    await saveOrder(order);
    try{
      const search=await asaas(`/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}&limit=1`,{method:'GET'});let asaasCustomer=Array.isArray(search.data)?search.data[0]:null;
      const cp={name,cpfCnpj,email,mobilePhone:phone,postalCode:cep||undefined,address:order.customer.address||undefined,addressNumber:order.customer.number||undefined,complement:order.customer.complement||undefined,externalReference:orderId,notificationDisabled:false};Object.keys(cp).forEach(k=>cp[k]===undefined&&delete cp[k]);
      if(!asaasCustomer)asaasCustomer=await asaas('/customers',{method:'POST',body:JSON.stringify(cp)});
      const payment=await asaas('/payments',{method:'POST',body:JSON.stringify({customer:asaasCustomer.id,billingType:paymentMethod,value:total,dueDate:today(),description:`Pedido ${orderId} - SQM | ${items.map(i=>`${i.name} | Cor: ${i.color||'Não informada'} | Tamanho: ${i.size||'Não informado'} | Qtd: ${i.quantity}`).join(' || ')}`,externalReference:orderId})});paymentId=payment.id;
      let pix=null;if(paymentMethod==='PIX'){const p=await asaas(`/payments/${encodeURIComponent(payment.id)}/pixQrCode`,{method:'GET'});pix={encodedImage:p.encodedImage||null,payload:p.payload||null,expirationDate:p.expirationDate||null};}
      Object.assign(order,{asaasCustomerId:asaasCustomer.id,asaasPaymentId:payment.id,asaasInvoiceUrl:payment.invoiceUrl||null,status:'Aguardando pagamento',updatedAt:new Date().toISOString()});await setJson(`sqm:order:${orderId}`,order);
      return send(res,200,{success:true,orderId,customerId:asaasCustomer.id,paymentId:payment.id,status:payment.status,billingType:payment.billingType,invoiceUrl:payment.invoiceUrl||null,pix});
    }catch(e){
      if(paymentId){try{await asaas(`/payments/${encodeURIComponent(paymentId)}`,{method:'DELETE'});}catch(err){console.error('Asaas compensation failed',err);}}
      await releaseStock(reservation);order.stockReserved=false;order.status='Erro ao criar pagamento';order.error=e.message;order.updatedAt=new Date().toISOString();await setJson(`sqm:order:${orderId}`,order);throw e;
    }
  }catch(e){if(!paymentId&&reservation.length){try{await releaseStock(reservation);}catch{}}if(orderKey){try{await del(orderKey);}catch{}}console.error('checkout',e);return send(res,Number(e.status)>=400&&Number(e.status)<600?e.status:500,{success:false,error:e.message||'Não foi possível criar o pagamento.'});}
};
