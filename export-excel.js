'use strict';
// Small, dependency-free OOXML writer. Identifiers remain strings, never formulas.
const ExcelExport = (() => {
 const enc = new TextEncoder();
 const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const col = index => {let s='';for(let n=index+1;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
 const crcTable = Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=(n&1)?0xEDB88320^(n>>>1):n>>>1;return n>>>0;});
 function crc(bytes){let c=0xFFFFFFFF;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
 function zip(files){
  const parts=[],central=[];let offset=0,centralLength=0;
  for(const [path,text] of Object.entries(files)){
   const name=enc.encode(path),bytes=enc.encode(text),checksum=crc(bytes);
   const header=new Uint8Array(30+name.length),h=new DataView(header.buffer);
   h.setUint32(0,0x04034B50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint16(12,33,true);
   h.setUint32(14,checksum,true);h.setUint32(18,bytes.length,true);h.setUint32(22,bytes.length,true);h.setUint16(26,name.length,true);header.set(name,30);
   const dir=new Uint8Array(46+name.length),d=new DataView(dir.buffer);
   d.setUint32(0,0x02014B50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint16(14,33,true);
   d.setUint32(16,checksum,true);d.setUint32(20,bytes.length,true);d.setUint32(24,bytes.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);dir.set(name,46);
   parts.push(header,bytes);central.push(dir);offset+=header.length+bytes.length;centralLength+=dir.length;
  }
  const end=new Uint8Array(22),e=new DataView(end.buffer),count=central.length;
  e.setUint32(0,0x06054B50,true);e.setUint16(8,count,true);e.setUint16(10,count,true);e.setUint32(12,centralLength,true);e.setUint32(16,offset,true);
  const output=new Uint8Array(offset+centralLength+22);let position=0;
  for(const bytes of [...parts,...central,end]){output.set(bytes,position);position+=bytes.length;}return output;
 }
 function sheet(rows,widths,filter=false){
  const end=col(rows[0].length-1)+rows.length;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${end}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((width,i)=>`<col min="${i+1}" max="${i+1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.map((row,r)=>{
   const height=r===0?30:Math.min(409,Math.max(32,...row.map((v,c)=>Math.ceil(String(v??'').length/(widths[c]||24))*17+12)));
   return `<row r="${r+1}" ht="${height}" customHeight="1">${row.map((value,c)=>{const ref=col(c)+(r+1),style=r===0?1:2;return typeof value==='number'&&Number.isFinite(value)?`<c r="${ref}" s="${style}"><v>${value}</v></c>`:`<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;}).join('')}</row>`;
  }).join('')}</sheetData>${filter?`<autoFilter ref="A1:${end}"/>`:''}</worksheet>`;
 }
 function build(rows,context){
  const headers=['ลำดับ','ชื่อผู้ให้บริการ','เลขผู้เสียภาษี','แหล่งข้อมูล','เลขทะเบียนผู้ให้บริการ','ประเภทนิติบุคคล','ผู้ติดต่อ','โทรศัพท์','อีเมล','จังหวัดที่จดทะเบียน','ที่อยู่จดทะเบียน','จำนวนจังหวัดที่ให้บริการ','พื้นที่ให้บริการ'];
  const values=rows.map((v,i)=>[i+1,v.name,v.registration,v.sources.join(' / '),v.selected.map(r=>r.source+': '+r.id).join(' / '),v.type,v.contacts.join(' / '),v.phones.map(p=>p.label).join(' / '),v.emails.join(' / '),v.province,v.address,v.serviceAreas.length,v.serviceAreas.join(', ')]);
  const information=[['รายการ','รายละเอียด'],...Object.entries(context)];
  const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  return zip({
   '[Content_Types].xml':`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
   '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
   'xl/workbook.xml':`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="ผู้ให้บริการ" sheetId="1" r:id="rId1"/><sheet name="เงื่อนไขการส่งออก" sheetId="2" r:id="rId2"/></sheets></workbook>`,
   'xl/_rels/workbook.xml.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
   'xl/styles.xml':`<?xml version="1.0"?><styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Tahoma"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Tahoma"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF123F36"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
   'xl/worksheets/sheet1.xml':sheet([headers,...values],[8,48,22,16,30,23,35,32,45,24,70,20,90],true),
   'xl/worksheets/sheet2.xml':sheet(information,[30,100])
  });
 }
 function download(rows,context,filename){
  const blob=new Blob([build(rows,context)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
 }
 return {build,download};
})();
