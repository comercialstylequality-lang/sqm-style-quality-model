const {getJson,setJson,redis}=require('../lib/redis');
const ASAAS_API_URL='https://api.asaas.com/v3';
function send(res,status,data){return res.status(status).setHeader('Content-Type','application/json; charset=utf-8').json(data);}
async function asaas(path,options={}){
  const key=process.env.ASAAS_API_KEY; if(!key) throw Object.assign(new Error('ASAAS_API_KEY não configurada no Vercel.'),{status:500});
  const r=await fetch(`${ASAAS_API_URL}${path}`,{...options,headers:{Accept:'application/json','Content-Type':'application/json',access_token:key,...(options.headers||{})}});
  const data=await r.json().catch(()=>({}));
  if(!r.ok){const msg=data?.errors?.map(x=>x.description).filter(Boolean).join('; ')||data?.error||`Asaas HTTP ${r.status}`;throw Object.assign(new Error(msg),{status:r.status});}
  return data;
}
const digits=v=>String(v||'').replace(/\D/g,'');
const round=v=>Math.round(Number(v)*100)/100;
const text=v=>String(v==null?'':v).trim().slice(0,60);
function paymentType(v){const x=String(v||'').toUpperCase();return x==='PIX'||x==='CREDIT_CARD'?x:null;}
function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date());}
async function saveOrder(order){await setJson(`sqm:order:${order.id}`,order);await redis('LPUSH',['sqm:orders',order.id]);}
module.exports=async function(req,res){
  if(req.method!=='POST') return send(res,405,{success:false,error:'Método não permitido.'});
  try{
    const body=req.body||{}; const customer=body.customer||{}; const paymentMethod=paymentType(body.paymentMethod);
    const orderId=String(body.orderId||`SQM-${Date.now()}`).slice(0,100);
    const name=String(customer.name||'').trim(),email=String(customer.email||'').trim().toLowerCase(),cpfCnpj=digits(customer.cpfCnpj),phone=digits(customer.phone);
    if(name.length<2)return send(res,400,{success:false,error:'Informe o nome completo.'});
    if(!/^\S+@\S+\.\S+$/.test(email))return send(res,400,{success:false,error:'Informe um e-mail válido.'});
    if(![11,14].includes(cpfCnpj.length))return send(res,400,{success:false,error:'CPF/CNPJ inválido.'});
    if(phone.length<10)return send(res,400,{success:false,error:'Telefone inválido.'});
    if(!paymentMethod)return send(res,400,{success:false,error:'Forma de pagamento inválida.'});
    const requested=Array.isArray(body.items)?body.items:[];
    if(!requested.length)return send(res,400,{success:false,error:'Carrinho vazio.'});
    const products=await getJson('sqm:products');
    const catalog=Array.isArray(products)?products:require('./products').INITIAL_PRODUCTS;
    const items=[];
    for(const row of requested){
      const p=catalog.find(x=>String(x.id)===String(row.id)); const qty=Math.floor(Number(row.quantity));
      if(!p||!p.active||qty<1) return send(res,400,{success:false,error:'Um produto do carrinho não está disponível.'});
      if(Number(p.stock)>0 && qty>Number(p.stock)) return send(res,400,{success:false,error:`Estoque insuficiente para ${p.name}.`});
      const size=text(row.size||row.tamanho||row.selectedSize);
      const color=text(row.color||row.cor||row.selectedColor);
      const variation=[size?`Tamanho: ${size}`:'',color?`Cor: ${color}`:''].filter(Boolean).join(' | ');
      items.push({id:p.id,name:p.name,quantity:qty,value:round(p.price),cost:round(p.cost),size,color,variation,description:variation?`${p.description||'Produto SQM'} (${variation})`:(p.description||'Produto SQM')});
    }
    const total=round(items.reduce((s,x)=>s+x.value*x.quantity,0));
    if(total<=0)return send(res,400,{success:false,error:'Valor do pedido inválido.'});
    const order={id:orderId,date:new Date().toISOString(),status:'Pagamento pendente',paymentStatus:'Pendente',payment:paymentMethod,total,items,customer:{...customer,cpfCnpj},createdAt:new Date().toISOString()};
    await saveOrder(order);
    try{
      const search=await asaas(`/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}&limit=1`,{method:'GET'});
      let asaasCustomer=Array.isArray(search.data)?search.data[0]:null;
      const cp={name,cpfCnpj,email,mobilePhone:phone,postalCode:digits(customer.cep)||undefined,address:String(customer.address||'').trim()||undefined,addressNumber:String(customer.number||'').trim()||undefined,complement:String(customer.complement||'').trim()||undefined,externalReference:orderId,notificationDisabled:false};
      Object.keys(cp).forEach(k=>cp[k]===undefined&&delete cp[k]);
      if(!asaasCustomer) asaasCustomer=await asaas('/customers',{method:'POST',body:JSON.stringify(cp)});
      const payment=await asaas('/payments',{method:'POST',body:JSON.stringify({customer:asaasCustomer.id,billingType:paymentMethod,value:total,dueDate:today(),description:`Pedido ${orderId} - SQM`,externalReference:orderId})});
      let pix=null;
      if(paymentMethod==='PIX'){
        const p=await asaas(`/payments/${encodeURIComponent(payment.id)}/pixQrCode`,{method:'GET'});
        pix={encodedImage:p.encodedImage||null,payload:p.payload||null,expirationDate:p.expirationDate||null};
      }
      Object.assign(order,{asaasCustomerId:asaasCustomer.id,asaasPaymentId:payment.id,asaasInvoiceUrl:payment.invoiceUrl||null,status:'Aguardando pagamento',updatedAt:new Date().toISOString()});
      await setJson(`sqm:order:${orderId}`,order);
      return send(res,200,{success:true,orderId,customerId:asaasCustomer.id,paymentId:payment.id,status:payment.status,billingType:payment.billingType,invoiceUrl:payment.invoiceUrl||null,pix});
    }catch(e){
      order.status='Erro ao criar pagamento'; order.paymentStatus='Pendente'; order.error=e.message; order.updatedAt=new Date().toISOString(); await setJson(`sqm:order:${orderId}`,order); throw e;
    }
  }catch(e){console.error('checkout',e);return send(res,Number(e.status)>=400&&Number(e.status)<600?e.status:500,{success:false,error:e.message||'Não foi possível criar o pagamento.'});}
};
