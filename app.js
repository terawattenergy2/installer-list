'use strict';
const $ = id => document.getElementById(id);
const fields = ['search','province','source','type','channel','sort'];
const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize = s => String(s??'').normalize('NFKC').toLocaleLowerCase('th').replace(/\s+/g,' ').trim();
const unique = values => [...new Set(values.filter(Boolean))];
const dial = raw => {
 const parts=String(raw).split(/\s*(?:ต่อ|ext\.?)\s*/i);
 return parts[0].replace(/[^+\d]/g,'')+(parts[1]?';ext='+parts[1].replace(/\D/g,''):'');
};
let records = VENDORS;
const cached=ManualUpdate.restore();
if(cached){records=cached.records;Object.assign(DIRECTORY_META,cached.meta);}
let limit=24, filtered=[];
function applicable(v,province='',source='') {
 return v.sourceRecords.filter(r=>(!source||r.source===source)&&(!province||r.serviceAreas.includes(province))&&r.serviceAreas.length);
}
function refreshOptions(){
 const province=$('province'),type=$('type'),oldProvince=province.value,oldType=type.value;
 province.innerHTML='<option value="">ทุกจังหวัด</option>';type.innerHTML='<option value="">ทุกประเภท</option>';
 for(const p of DIRECTORY_META.provinces){const o=document.createElement('option');o.value=p;o.textContent=`${p} (${records.filter(v=>applicable(v,p).length).length})`;province.append(o);}
 for(const value of unique(records.map(v=>v.type)).sort((a,b)=>a.localeCompare(b,'th'))){const o=document.createElement('option');o.value=value;o.textContent=value;type.append(o);}
 province.value=oldProvince;type.value=oldType;
}
refreshOptions();
function matching(){
 const tokens=normalize($('search').value).split(' ').filter(Boolean);
 return records.flatMap(v=>{
  const selected=applicable(v,$('province').value,$('source').value);
  if(!selected.length||($('type').value&&v.type!==$('type').value))return [];
  const phones=[...new Map(selected.flatMap(r=>r.phones).map(p=>[p.number,p])).values()];
  const emails=unique(selected.flatMap(r=>r.emails));
  if(($('channel').value==='phone'&&!phones.length)||($('channel').value==='email'&&!emails.length))return [];
  const selectionCount=selected.find(r=>r.source==='PEA')?.selectionCount??null;
  const view={...v,selectionCount,name:selected[0].name,address:selected[0].address,province:selected[0].registeredProvince,contacts:unique(selected.flatMap(r=>r.contacts)),phones,emails,selected,sources:unique(selected.map(r=>r.source)),serviceAreas:unique(selected.flatMap(r=>r.serviceAreas))};
  const search=normalize([view.name,v.registration,v.type,...view.serviceAreas,...selected.flatMap(r=>[r.id,r.name,r.address,r.registeredProvince,...r.contacts,...r.phones.map(p=>p.label),...r.emails])].join(' '));
  const digits=[v.registration,...selected.map(r=>r.id),...phones.map(p=>p.number)].map(s=>String(s).replace(/\D/g,''));
  return tokens.every(t=>search.includes(t)||(/^\d[\d-]*$/.test(t)&&digits.some(d=>d.includes(t.replace(/-/g,'')))))?[view]:[];
 });
}
function card(v){
 const e=escapeHTML;
 const areas=$('province').value||`${v.serviceAreas.slice(0,3).join(' · ')}${v.serviceAreas.length>3?` และอีก ${v.serviceAreas.length-3} จังหวัด`:''}`;
 return `<article class="card"><div class="card-top"><span class="badge">${e(v.type)}</span><span class="source-badges">${v.sources.map(s=>`<span class="source-badge source-${s.toLowerCase()}">${s}</span>`).join('')}</span></div><h3>${e(v.name)}</h3><p class="province">⌖ พื้นที่ให้บริการ: ${e(areas)}</p>${v.selectionCount!==null?`<p class="selection-count">ผู้สนใจ (PEA) <strong>${v.selectionCount.toLocaleString('th-TH')}</strong> ราย <small>ข้อมูล ${escapeHTML(DIRECTORY_META.peaUpdatedAt)}</small></p>`:''}<p class="address">ที่อยู่จดทะเบียน${v.province?` · ${e(v.province)}`:''}<br>${e(v.address||'ไม่ระบุที่อยู่')}</p><div class="contact">${v.contacts.length?`<p>ผู้ติดต่อ · ${v.contacts.map(e).join(' / ')}</p>`:''}<div class="phones">${v.phones.length?v.phones.map(p=>`<a class="call" href="tel:${e(dial(p.number))}" aria-label="โทร ${e(p.label)} ${e(v.name)}"><span>☎ &nbsp;${e(p.label)}</span><small>โทรเลย ↗</small></a>`).join(''):'<span class="no-phone">ไม่ระบุเบอร์โทรศัพท์</span>'}</div>${v.emails.map(email=>`<a class="email" href="mailto:${e(email)}">✉ &nbsp;${e(email)}</a>`).join('')}</div><details><summary>ทะเบียนและพื้นที่ให้บริการ</summary><p>เลขผู้เสียภาษี: ${e(v.registration||'ไม่ระบุ')}</p>${v.selected.map(r=>`<p>${e(r.source)} · เลขทะเบียน ${e(r.id)}<br>ชื่อในต้นทาง: ${e(r.name)}<br>ที่อยู่ในต้นทาง: ${e(r.address||'ไม่ระบุ')}<br>พื้นที่ให้บริการ: ${r.serviceAreas.map(e).join(', ')}</p>`).join('')}</details></article>`;
}
function render(reset=true){
 if(reset)limit=24;
 filtered=matching();
 if($('sort').value==='selections')filtered.sort((a,b)=>(b.selectionCount??-1)-(a.selectionCount??-1)||a.name.localeCompare(b.name,'th'));
 if($('sort').value==='name')filtered.sort((a,b)=>a.name.localeCompare(b.name,'th'));
 if($('sort').value==='province')filtered.sort((a,b)=>(a.province||'').localeCompare(b.province||'','th')||a.name.localeCompare(b.name,'th'));
 $('results').innerHTML=filtered.slice(0,limit).map(card).join('');
 $('result-title').textContent=$('province').value?`ผู้ให้บริการใน${$('province').value}`:'ผู้ให้บริการทั้งหมด';
 $('count').textContent=`พบ ${filtered.length.toLocaleString('th-TH')} บริษัท จากทั้งหมด ${records.length.toLocaleString('th-TH')} บริษัท`;
 $('shown').textContent=filtered.length?`แสดง ${Math.min(limit,filtered.length)} จาก ${filtered.length} บริษัท`:'';
 $('empty').hidden=filtered.length!==0;$('load-more').hidden=limit>=filtered.length;$('clear-search').hidden=!$('search').value;
 $('export-excel').disabled=filtered.length===0;
 $('export-status').textContent='';
 $('data-dates').textContent=`ข้อมูลที่ใช้งาน: PEA ${DIRECTORY_META.peaUpdatedAt} · MEA ${DIRECTORY_META.meaUpdatedAt}`;
 $('total-vendors').textContent=records.length.toLocaleString('th-TH');
 const params=new URLSearchParams();fields.forEach(id=>{if($(id).value&&$(id).value!=='original')params.set(id,$(id).value)});
 try{history.replaceState(null,'',location.pathname+(params.size?'?'+params.toString():'')+location.hash)}catch{}
}
function reset(){fields.forEach(id=>$(id).value=id==='sort'?'original':'');render()}
const initial=new URLSearchParams(location.search);
fields.forEach(id=>{if(initial.has(id)){const el=$(id);el.value=initial.get(id);if(el.tagName==='SELECT'&&!el.value)el.selectedIndex=0}$(id).addEventListener(id==='search'?'input':'change',()=>render())});
$('reset').addEventListener('click',reset);$('empty-reset').addEventListener('click',reset);
$('clear-search').addEventListener('click',()=>{$('search').value='';render();$('search').focus()});
$('load-more').addEventListener('click',()=>{limit+=24;render(false)});
window.addEventListener('pageshow',()=>render());render();

$('export-excel').addEventListener('click',()=>{
 if(!filtered.length)return;
 const button=$('export-excel');button.disabled=true;
 try{
  const province=$('province').value||'ทุกจังหวัด';
  const stamp=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const selectedLabel=id=>{const select=$(id);return select.options[select.selectedIndex]?.textContent||select.value;};
  ExcelExport.download(filtered,{
   'วันที่ส่งออก':stamp,'วันที่ข้อมูล PEA':DIRECTORY_META.peaUpdatedAt,'วันที่ข้อมูล MEA':DIRECTORY_META.meaUpdatedAt,'จำนวนบริษัท':filtered.length,
   'จังหวัดที่ต้องการติดตั้ง':province,'แหล่งข้อมูล':selectedLabel('source'),
   'คำค้น':$('search').value||'ทั้งหมด','ประเภทนิติบุคคล':selectedLabel('type'),
   'ช่องทางติดต่อ':selectedLabel('channel'),'เรียงตาม':selectedLabel('sort'),
   'ขอบเขตข้อมูล':'ส่งออกทุกรายการที่ตรงกับตัวกรอง รวมรายการที่ยังไม่กดแสดงเพิ่มเติม',
   'แหล่งข้อมูล PEA':DIRECTORY_META.peaSource,'แหล่งข้อมูล MEA':DIRECTORY_META.meaSource||'ชุดข้อมูลที่ผู้ใช้รวบรวม',
   'หมายเหตุ':'พื้นที่ให้บริการแยกจากที่อยู่บริษัท ข้อมูลติดต่อเลือกตามแหล่งข้อมูลและจังหวัดที่กรอง จำนวนผู้สนใจเป็นยอดรวมของบริษัทจาก PEA ไม่ใช่ยอดแยกจังหวัด และไม่มีรายชื่อบุคคล; ช่องว่างหมายถึงไม่มีข้อมูลจากแหล่งที่เลือก'
  },`ผู้ให้บริการโซลาร์_${province}_${stamp}.xlsx`);
  $('export-status').textContent=`ส่งออก ${filtered.length.toLocaleString('th-TH')} บริษัทแล้ว`;
 }catch(error){
  $('export-status').textContent='ส่งออกไม่สำเร็จ กรุณาลองอีกครั้ง';console.error('Excel export failed',error);
 }finally{button.disabled=filtered.length===0;}
});

let updateRunning=false;
$('update-data').addEventListener('click',async()=>{
 if(updateRunning)return;
 updateRunning=true;const button=$('update-data');button.disabled=true;button.setAttribute('aria-busy','true');
 const status=$('update-status');
 try{
  const source=$('update-source').value,sources=source==='both'?['PEA','MEA']:[source],replacements={},dates={};
  for(const name of sources){
   const result=await ManualUpdate.fetchSource(name,(s,done,total)=>{status.textContent=`กำลังอัปเดต ${s} หน้า ${done}/${total}…`;});
   replacements[name]=result.data;dates[name==='PEA'?'peaUpdatedAt':'meaUpdatedAt']=result.date;
  }
  const next=ManualUpdate.merge(records,replacements,{...DIRECTORY_META,...dates});
  next.meta.updatedAt=[next.meta.peaUpdatedAt,next.meta.meaUpdatedAt].sort().at(-1);
  try{ManualUpdate.persist(next);}catch{throw Error('เบราว์เซอร์บันทึกข้อมูลไม่ได้ กรุณาตรวจพื้นที่จัดเก็บหรือการตั้งค่าความเป็นส่วนตัว');}
  records=next.records;Object.assign(DIRECTORY_META,next.meta);refreshOptions();render();
  status.textContent=`อัปเดต ${sources.join(' และ ')} สำเร็จ · PEA ${DIRECTORY_META.peaRecords} รายการ · MEA ${DIRECTORY_META.meaRecords} รายการ · รวม ${records.length} บริษัทไม่ซ้ำ — บันทึกในเบราว์เซอร์นี้แล้ว`;
 }catch(error){status.textContent=`อัปเดตไม่สำเร็จ: ${error.message} ข้อมูลเดิมยังอยู่`;}
 finally{updateRunning=false;button.disabled=false;button.removeAttribute('aria-busy');}
});
