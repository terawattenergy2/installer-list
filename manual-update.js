'use strict';
const ManualUpdate=(()=>{
 const cacheKey='installer-directory-manual-v1';
 const distinct=values=>[...new Set(values.filter(Boolean))];
 function merge(records,replacements,meta){
  const companyMap=new Map();
  const rows=records.flatMap(v=>v.sourceRecords.filter(r=>!replacements[r.source]).map(r=>({...r,taxId:v.registration})));
  for(const list of Object.values(replacements))rows.push(...list);
  for(const r of rows){
   const key='tax:'+r.taxId;
   if(!companyMap.has(key))companyMap.set(key,{id:key,registration:r.taxId,name:r.name,province:r.registeredProvince,address:r.address,contacts:[],phones:[],emails:[],type:r.name.includes('มหาชน')?'บริษัทมหาชน':r.name.includes('ห้างหุ้นส่วน')?'ห้างหุ้นส่วน':r.name.includes('บริษัท')?'บริษัทจำกัด':'อื่น ๆ',sources:[],serviceAreas:[],sourceRecords:[]});
   const v=companyMap.get(key);const {taxId,...sourceRecord}=r;
   v.sourceRecords.push(sourceRecord);v.sources=distinct([...v.sources,r.source]);v.serviceAreas=distinct([...v.serviceAreas,...r.serviceAreas]);v.contacts=distinct([...v.contacts,...r.contacts]);v.phones=[...new Map([...v.phones,...r.phones].map(p=>[p.number,p])).values()];v.emails=distinct([...v.emails,...r.emails]);
  }
  const merged=[...companyMap.values()].filter(v=>v.serviceAreas.length);
  return {records:merged,meta:{...meta,uniqueVendors:merged.length,bothSources:merged.filter(v=>v.sources.length===2).length,meaRecords:rows.filter(r=>r.source==='MEA').length,peaRecords:rows.filter(r=>r.source==='PEA').length,meaUniqueCompanies:merged.filter(v=>v.sources.includes('MEA')).length,peaUniqueCompanies:merged.filter(v=>v.sources.includes('PEA')).length,meaSource:'https://peoplesolar.mea.or.th/vendor'}};
 }
 async function page(source,page,snapshot){
  const res=await fetch('/api/update-directory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source,page,snapshot}),signal:AbortSignal.timeout(35000)});
  const result=await res.json();if(!res.ok)throw Error(result.error||'โหลดข้อมูลไม่สำเร็จ');
  if(result.source!==source||result.page!==page||!Array.isArray(result.data)||!Number.isInteger(result.total)||!Number.isInteger(result.pages)||result.pages<1||result.pages>250)throw Error('ข้อมูลตอบกลับไม่ครบ');
  return result;
 }
 async function fetchSource(source,progress){
  const first=await page(source,1);const batches=[first.data];let next=2,completed=1;
  progress(source,completed,first.pages);
  await Promise.all(Array.from({length:Math.min(3,first.pages-1)},async()=>{
   while(next<=first.pages){const n=next++;const result=await page(source,n,first.snapshot);
    if(result.total!==first.total||result.pages!==first.pages||(first.snapshot&&result.snapshot!==first.snapshot))throw Error('ข้อมูลต้นทางเปลี่ยนระหว่างดึง กรุณาลองอีกครั้ง');
    batches[n-1]=result.data;progress(source,++completed,first.pages);
   }
  }));
  const data=batches.flat(),ids=new Set(data.map(v=>v.originalId));
  if(data.length!==first.total||ids.size!==first.total)throw Error('ได้ข้อมูลไม่ครบหรือมีรายการซ้ำ จึงยังไม่แทนที่ชุดเดิม');
  return {data,date:first.updatedAt};
 }
 function restore(){
  try{const data=JSON.parse(localStorage.getItem(cacheKey)||'null');
   if(!data||data.version!==1||!Array.isArray(data.records)||!data.records.length||!data.meta||!Array.isArray(data.meta.provinces))return null;
   if(data.records.some(v=>!Array.isArray(v.sourceRecords)||!Array.isArray(v.serviceAreas)))return null;
   return data;
  }catch{return null;}
 }
 function persist(data){localStorage.setItem(cacheKey,JSON.stringify({...data,version:1}));}
 return {merge,fetchSource,restore,persist};
})();
