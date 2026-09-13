const {requireAdmin}=require('../lib/auth');
const {getJson,setJson,redis}=require('../lib/redis');
const INITIAL_PRODUCTS=[
{id:1,name:'Camiseta Básica Tech Insider',cost:166.25,price:166.25,category:'clothing',newArrival:true,featured:false,active:true,stock:0,image:'',description:'',sizes:[],colors:[],supplier:'https://produto.mercadolivre.com.br/MLB-3193860320-camiseta-basica-tech-insider-masculina-_JM'},
{id:2,name:'Camiseta Manga Longa Básica 100% Algodão',cost:31.15,price:31.15,category:'clothing',newArrival:false,featured:false,active:true,stock:0,image:'',description:'',sizes:[],colors:[],supplier:'https://produto.mercadolivre.com.br/MLB-4211231565-camiseta-manga-longa-masculina-basica-camisa-_JM'},
{id:3,name:'Kit 6 Camisetas Básicas Masculinas',cost:138.13,price:138.13,category:'clothing',newArrival:false,featured:false,active:true,stock:0,image:'',description:'',sizes:[],colors:[],supplier:'https://produto.mercadolivre.com.br/MLB-2775895319-6-camiseta-basica-masculina-camisa-lisa-cores-algodao-_JM'},
{id:4,name:'Camiseta Básica Lisa 100% Algodão Premium',cost:43.65,price:43.65,category:'clothing',newArrival:true,featured:false,active:true,stock:0,image:'',description:'',sizes:[],colors:[],supplier:'https://produto.mercadolivre.com.br/MLB-3673537813-camiseta-masculina-basica-lisa-100-algodao-premium-_JM'},
{id:5,name:'Camiseta Básica Tech Modal Anti-Odor',cost:45,price:45,category:'clothing',newArrival:true,featured:false,active:true,stock:0,image:'',description:'',sizes:[],colors:[],supplier:'https://produto.mercadolivre.com.br/MLB-5167782652-camiseta-masculina-anti-odor-tech-modal-basica-no-amassa-_JM'},
{id:6,name:'Camiseta Básica Canelada Tricot Modal',cost:69.9,price:69.9,category:'clothing',newArrival:false,featured:false,active:true,stock:0,image:'',description:'',sizes:[],colors:[],supplier:'https://produto.mercadolivre.com.br/MLB-4421548667-camiseta-masculina-basica-canelada-manga-curta-tricot-modal-_JM'},
{id:7,name:'Camiseta Básica Algodão Brasil 2026',cost:36.9,price:36.9,category:'clothing',newArrival:true,featured:false,active:true,stock:0,image:'',description:'',sizes:[],colors:[],supplier:'https://produto.mercadolivre.com.br/MLB-6241967020-camiseta-masculina-basica-algodao-brasil-copa-do-mundo-2026-_JM'}
];
function safeUrl(v){const s=String(v||'').trim();if(!s)return '';try{const u=new URL(s);return ['http:','https:'].includes(u.protocol)?s.slice(0,2000):'';}catch{return '';}}
function cleanProducts(list){
  if(!Array.isArray(list)||list.length>200) throw new Error('Lista de produtos inválida.');
  const seen=new Set();
  const out=list.map((p,i)=>{
    const id=String(p.id??Date.now()+i).slice(0,80); if(seen.has(id)) throw new Error('Existem produtos com ID duplicado.'); seen.add(id);
    const cost=Number(p.cost),price=Number(p.price),stock=Number(p.stock);
    if(!Number.isFinite(cost)||!Number.isFinite(price)||cost<0||price<0||cost>1e7||price>1e7) throw new Error(`Preço/custo inválido no produto ${id}.`);
    if(!Number.isInteger(stock)||stock<0||stock>1e7) throw new Error(`Estoque inválido no produto ${id}.`);
    const arr=(v,max)=>Array.isArray(v)?v.map(x=>String(x).trim()).filter(Boolean).slice(0,max):[];
    return {id,name:String(p.name||'').trim().slice(0,180),cost,price,category:p.category==='fragrance'?'fragrance':'clothing',newArrival:!!p.newArrival,featured:!!p.featured,active:p.active!==false,stock,image:safeUrl(p.image),images:arr(p.images,20).map(safeUrl).filter(Boolean),description:String(p.description||'').slice(0,5000),sizes:arr(p.sizes,20),colors:arr(p.colors,20),supplier:safeUrl(p.supplier)};
  }).filter(p=>p.name&&p.price>=0);
  if(!out.length) throw new Error('Cadastre pelo menos um produto válido.');
  return out;
}
async function hydrateStocks(products){
  const out=[];for(const p of products){const raw=await redis('GET',[`sqm:stock:${p.id}`]);const n=raw===null?null:Number(raw);out.push({...p,stock:Number.isFinite(n)&&n>=0?n:p.stock});}return out;
}
module.exports=async function(req,res){
  res.setHeader('Cache-Control','no-store');
  try{
    if(req.method==='GET'){
      const products=await getJson('sqm:products');
      return res.status(200).json({exists:true,products:await hydrateStocks(Array.isArray(products)?products:INITIAL_PRODUCTS)});
    }
    if(req.method==='PUT'){
      if(!requireAdmin(req,res)) return;
      const products=cleanProducts(req.body?.products);
      await setJson('sqm:products',products);
      for(const p of products) await redis('SET',[`sqm:stock:${p.id}`,String(p.stock)]);
      return res.status(200).json({ok:true,products});
    }
    return res.status(405).json({error:'Método não permitido.'});
  }catch(e){console.error(e);return res.status(500).json({error:e.message||'Erro no catálogo.'});}
};
module.exports.INITIAL_PRODUCTS=INITIAL_PRODUCTS;
