'use strict';
const $ = id => document.getElementById(id);
const fields = ['search','province','type','channel','sort'];
const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize = s => String(s).normalize('NFKC').toLocaleLowerCase('th').replace(/\s+/g,' ').trim();
const records = VENDORS.map(v=>({...v,search:normalize([v.id,v.registration,v.name,v.province,v.address,...v.contacts,...v.phones.map(p=>p.label),...v.emails].join(' ')),digits:[v.id,v.registration,...v.phones.map(p=>p.number)].map(s=>s.replace(/[^0-9]/g,''))}));
let limit=24, filtered=[];
for(const [id,key] of [['province','province'],['type','type']]){
 const values=[...new Set(records.map(v=>v[key]))].sort((a,b)=>a.localeCompare(b,'th'));
 for(const value of values){const o=document.createElement('option');o.value=value;o.textContent=`${value} (${records.filter(v=>v[key]===value).length})` ;$(id).append(o);}
}
function matching(){
 const tokens=normalize($('search').value).split(' ').filter(Boolean);
 return records.filter(v=>!($('province').value&&v.province!==$('province').value)&&!($('type').value&&v.type!==$('type').value)&&!($('channel').value==='phone'&&!v.phones.length)&&!($('channel').value==='email'&&!v.emails.length)&&tokens.every(t=>v.search.includes(t)||(/^\d[\d-]+$/.test(t)&&v.digits.some(d=>d.includes(t.replace(/-/g,''))))));
}
function card(v){
 const e=escapeHTML;
 return `<article class="card"><div class="card-top"><span class="badge">${e(v.type)}</span><span class="id">#${e(v.id)}</span></div><h3>${e(v.name)}</h3><p class="province">⌖ ${e(v.province)}</p><p class="address">${e(v.address||'ไม่ระบุที่อยู่')}</p><div class="contact">${v.contacts.length?`<p>ผู้ติดต่อ · ${v.contacts.map(e).join(' / ')}</p>`:''}<div class="phones">${v.phones.length?v.phones.map(p=>`<a class="call" href="tel:${e(p.number)}" aria-label="โทร ${e(p.label)} ${e(v.name)}"><span>☎ &nbsp;${e(p.label)}</span><small>โทรเลย ↗</small></a>`).join(''):'<span class="no-phone">ไม่ระบุเบอร์โทรศัพท์</span>'}</div>${v.emails.map(email=>`<a class="email" href="mailto:${e(email)}">✉ &nbsp;${e(email)}</a>`).join('')}</div><details><summary>ข้อมูลทะเบียนผู้ให้บริการ</summary><p>เลขทะเบียนผู้ให้บริการ: ${e(v.id)}</p><p>เลขทะเบียนนิติบุคคล: ${e(v.registration)}</p></details></article>`;
}
function render(reset=true){
 if(reset)limit=24;
 filtered=matching();
 if($('sort').value==='name')filtered.sort((a,b)=>a.name.localeCompare(b.name,'th'));
 if($('sort').value==='province')filtered.sort((a,b)=>a.province.localeCompare(b.province,'th')||a.name.localeCompare(b.name,'th'));
 $('results').innerHTML=filtered.slice(0,limit).map(card).join('');
 $('count').textContent=`พบ ${filtered.length.toLocaleString('th-TH')} ราย จากทั้งหมด ${records.length.toLocaleString('th-TH')} ราย`;
 $('shown').textContent=filtered.length?`แสดง ${Math.min(limit,filtered.length)} จาก ${filtered.length} ราย`:'';
 $('empty').hidden=filtered.length!==0;
 $('load-more').hidden=limit>=filtered.length;
 $('clear-search').hidden=!$('search').value;
 const params=new URLSearchParams();fields.forEach(id=>{if($(id).value&&$(id).value!=='original')params.set(id,$(id).value)});
 try{history.replaceState(null,'',location.pathname+(params.size?'?'+params.toString():'')+location.hash)}catch{}
}
function reset(){fields.forEach(id=>$(id).value=id==='sort'?'original':'');render()}
const initial=new URLSearchParams(location.search);fields.forEach(id=>{if(initial.has(id)){const el=$(id);el.value=initial.get(id);if(el.tagName==='SELECT'&&!el.value)el.selectedIndex=0}$(id).addEventListener(id==='search'?'input':'change',()=>render())});
$('reset').addEventListener('click',reset);$('empty-reset').addEventListener('click',reset);$('clear-search').addEventListener('click',()=>{$('search').value='';render();$('search').focus()});$('load-more').addEventListener('click',()=>{limit+=24;render(false)});window.addEventListener('pageshow',()=>render());render();
