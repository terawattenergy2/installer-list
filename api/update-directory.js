'use strict';
const decode = s => String(s).replace(/&#(x[\da-f]+|\d+);/gi,(_,n)=>{const c=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return c>0&&c<=0x10ffff?String.fromCodePoint(c):'';}).replace(/&(amp|quot|apos|nbsp|lt|gt);/g,(_,n)=>({amp:'&',quot:'"',apos:"'",nbsp:' ',lt:'<',gt:'>'}[n]));
const text = s => decode(String(s||'').replace(/<svg\b[\s\S]*?<\/svg>/gi,'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const field = (html,tag,cls) => text(html.match(new RegExp('<'+tag+'[^>]*class="[^"\\n]*\\b'+cls+'\\b[^"\\n]*"[^>]*>([\\s\\S]*?)<\\/'+tag+'>','i'))?.[1]||'');
const metro=['กรุงเทพมหานคร','นนทบุรี','สมุทรปราการ'];
function parseMEA(html){
 const total=Number(text(html).match(/ทั้งหมด\s*([\d,]+)\s*ราย/)?.[1]?.replace(/,/g,''));
 const snapshot=html.match(/name="s"\s+value="(\d+)"/)?.[1];
 const data=[...html.matchAll(/<li\s+class="vendor-card"[^>]*>([\s\S]*?)<\/li>/gi)].map(([,card])=>{
  const ids=[...card.matchAll(/<b[^>]*>([\s\S]*?)<\/b>/g)].map(m=>text(m[1]));
  const contacts=[...card.matchAll(/<p\b[^>]*class="vendor-line"[^>]*>([\s\S]*?)<\/p>/gi)].filter(m=>m[1].includes('ผู้ติดต่อ')).map(m=>text(m[1]).replace(/^ผู้ติดต่อ\s*/,''));
  const links=[...card.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)].map(m=>({href:decode(m[1]),label:text(m[2])}));
  return {source:'MEA',id:ids[0],originalId:ids[0],taxId:(ids[1]||'').replace(/\D/g,''),name:field(card,'h3','vendor-option-name'),address:field(card,'span','vendor-address'),registeredProvince:field(card,'strong','vendor-province-name'),serviceAreas:metro,contacts,phones:links.filter(l=>l.href.startsWith('tel:')).map(l=>({number:l.href.slice(4),label:l.label.replace(/^โทร\s*/, '')})),emails:links.filter(l=>l.href.startsWith('mailto:')).map(l=>l.href.slice(7)),selectionCount:null};
 });
 if(!total||!snapshot||!data.length||data.some(v=>!v.id||!v.name||v.taxId.length!==13))throw Error('MEA เปลี่ยนรูปแบบข้อมูลหรือส่งข้อมูลไม่ครบ');
 return {data,total,pageSize:20,pages:Math.ceil(total/20),snapshot};
}
async function upstream(url){
 const response=await fetch(url,{headers:{Accept:'application/json, text/html'},signal:AbortSignal.timeout(25000),cache:'no-store'});
 if(!response.ok)throw Error('ต้นทางตอบกลับ '+response.status);
 return response;
}
async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'กรุณากดปุ่มอัปเดตบนหน้าเว็บ'});}
 try{
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
  const {source,snapshot}=body,page=Number(body.page||1);
  if(!['MEA','PEA'].includes(source)||!Number.isInteger(page)||page<1||page>250||(snapshot&&!/^\d{1,20}$/.test(snapshot)))return res.status(400).json({error:'คำขอไม่ถูกต้อง'});
  let result;
  if(source==='MEA'){
   const url=new URL('https://peoplesolar.mea.or.th/vendor');url.searchParams.set('page',page);if(snapshot)url.searchParams.set('s',snapshot);
   result=parseMEA(await (await upstream(url)).text());
  }else{
   const url=`https://peoplesolar.pea.co.th/api/backend/v1/vendors?page=${page}&pageSize=100&excludeVendorCode=true`;
   const payload=await (await upstream(url)).json();
   if(!Array.isArray(payload.data)||!Number.isInteger(payload.total)||!payload.total||!Number.isInteger(payload.pageSize)||payload.pageSize<1)throw Error('PEA ส่งข้อมูลไม่ครบ');
   const data=payload.data.map(v=>({source:'PEA',id:v.registrationNo,originalId:v.id,taxId:String(v.taxId||'').replace(/\D/g,''),name:v.name,address:v.address||'',registeredProvince:v.province||'',serviceAreas:Array.isArray(v.provinces)?v.provinces.filter(p=>!metro.includes(p)):null,contacts:[],phones:v.phone?[{number:v.phone,label:v.phone}]:[],emails:v.email?[v.email]:[],selectionCount:Number.isInteger(v.selectionCount)&&v.selectionCount>=0?v.selectionCount:null}));
   if(data.some(v=>!v.id||!v.originalId||!v.name||v.taxId.length!==13||!v.serviceAreas))throw Error('PEA เปลี่ยนรูปแบบข้อมูล');
   result={data,total:payload.total,pageSize:payload.pageSize,pages:Math.ceil(payload.total/payload.pageSize)};
  }
  return res.status(200).json({...result,page,source,updatedAt:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())});
 }catch(error){console.error('Directory upstream update failed:',error.message);return res.status(502).json({error:'โหลดข้อมูลต้นทางไม่สำเร็จ กรุณาลองอีกครั้งภายหลัง',failure:error.message==='PEA ส่งข้อมูลไม่ครบ'?'invalid_pea_response':error instanceof SyntaxError?'invalid_json':error.name==='TimeoutError'?'upstream_timeout':['ENOTFOUND','ECONNRESET','ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','ERR_TLS_CERT_ALTNAME_INVALID','UNABLE_TO_GET_ISSUER_CERT','CERT_UNTRUSTED'].includes(error.cause?.code)?error.cause.code:error.message==='PEA เปลี่ยนรูปแบบข้อมูล'?'invalid_pea_data':/^ต้นทางตอบกลับ (403|429|500|502|503|504)$/.test(error.message)?'upstream_http_'+error.message.slice(-3):['UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','CERT_HAS_EXPIRED'].includes(error.cause?.code)?'upstream_tls':'upstream_unavailable'});}
}
module.exports=handler;
module.exports.parseMEA=parseMEA;
