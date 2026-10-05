import { isNativeApp, saveOrShareBlob } from './nativeActions.js';

const safeName=value=>String(value||'system-admin').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const download=async(blob,name,title)=>{if(isNativeApp())return saveOrShareBlob({blob,fileName:name,title,text:`${title} export`});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);};
const valueOf=value=>value===null||value===undefined?'':value instanceof Date?value.toISOString():String(value);
const xml=value=>valueOf(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const pdfText=value=>String(value||'').replace(/[^ -~]/g,' ').replace(/([\\()])/g,'\\$1');

export async function exportRows(rows,title,format){
  if(!rows?.length)throw new Error('There are no records to export');
  const columns=Object.keys(rows[0]);const name=safeName(title);
  if(format==='csv'){
    const csv=[columns,...rows.map(row=>columns.map(column=>`"${valueOf(row[column]).replaceAll('"','""')}"`))].map(line=>line.join(',')).join('\r\n');
    await download(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'}),`${name}.csv`,title);return;
  }
  if(format==='excel'){
    const table=`<table><thead><tr>${columns.map(column=>`<th>${xml(column)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${columns.map(column=>`<td>${xml(row[column])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    await download(new Blob([`<html><meta charset="utf-8"><body><h1>${xml(title)}</h1>${table}</body></html>`],{type:'application/vnd.ms-excel'}),`${name}.xls`,title);return;
  }
  const lines=[title,columns.join(' | '),...rows.slice(0,250).map(row=>columns.map(column=>valueOf(row[column])).join(' | '))].flatMap(line=>{const text=pdfText(line);const parts=[];for(let i=0;i<text.length;i+=115)parts.push(text.slice(i,i+115));return parts;});
  const pages=[];for(let i=0;i<lines.length;i+=48)pages.push(lines.slice(i,i+48));
  const objects=[];const add=value=>{objects.push(value);return objects.length;};const catalog=add('');const pagesId=add('');const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');const pageIds=[];
  for(const pageLines of pages){const stream=`BT /F1 8 Tf 34 800 Td 11 TL ${pageLines.map((line,index)=>`${index?'T* ':''}(${pdfText(line)}) Tj`).join(' ')} ET`;const content=add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`));}
  objects[catalog-1]=`<< /Type /Catalog /Pages ${pagesId} 0 R >>`;objects[pagesId-1]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  let pdf='%PDF-1.4\n';const offsets=[0];objects.forEach((object,index)=>{offsets.push(pdf.length);pdf+=`${index+1} 0 obj\n${object}\nendobj\n`;});const xref=pdf.length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>`${String(offset).padStart(10,'0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  await download(new Blob([pdf],{type:'application/pdf'}),`${name}.pdf`,title);
}
