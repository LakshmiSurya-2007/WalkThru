'use strict';
// Client-side text extraction. Libraries are loaded from CDN in index.html.
const WalkThruParser = (() => {
  const headings = [
    ['Education', /education|academic (background|qualifications|history)|educational qualifications|qualification(s)?/i],
    ['Experience', /work experience|professional experience|employment( history)?|internships?|career history|teaching experience|industrial training/i],
    ['Skills', /technical skills|soft skills|skills|core competencies|key competencies|tools (and|&) technologies|expertise|programming languages/i],
    ['Projects', /projects|academic projects|personal projects|key projects|research projects/i],
    ['Certifications', /certifications?|licenses?( and certifications?)?|courses|training|credentials/i],
    ['Achievements & Awards', /achievements?(?:\s*(?:&|and)\s*awards?)?|awards?(?:\s*(?:&|and)\s*honors?)?|honors|accomplishments/i],
    ['Summary', /professional summary|profile summary|about me|objective|career objective|personal statement|summary|profile/i],
    ['Publications', /publications?|research papers/i],
    ['Volunteer Work', /volunteer( work| experience)?|community service/i],
    ['Languages', /languages? known|languages?/i],
    ['Interests', /interests|hobbies/i],
    ['Workshops & Extracurricular Activities', /workshops?(?:\s*(?:&|and)\s*extracurricular activities)?|extracurricular activities/i],
    ['Personal Details', /personal details|personal information/i],
    ['Contact', /contact( details| information)?|personal (details|information)/i],
    ['References', /references/i]
  ];
  const tidy = s => s.replace(/[\u2022\u25cf\u25aa\u25a0]/g, ' ').replace(/\s+/g,' ').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'').trim();
  const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function identifyHeading(raw) {
    let line=tidy(raw).replace(/^\d{1,2}[.)]\s*/, '').replace(/[:：]\s*$/, '');
    if(!line || line.length>65) return null;
    for (const [name,regex] of headings) {
      if(regex.test(line) && (new RegExp('^(?:'+regex.source+')$','i')).test(line)) return name;
    }
    return null;
  }
  function findInlineHeading(line) {
    // PDFs sometimes join a heading and its first detail on the same line.
    const trimmed=line.trim();
    for(const [name,regex] of headings){
      const anchored=new RegExp('^\\s*(?:\\d{1,2}[.)]\\s*)?(?:'+regex.source+')\\s*[:：|–—-]\\s*(.+)$','i');
      const match=trimmed.match(anchored);
      if(match && match[1].trim()) return {title:name,remainder:match[1].trim()};
    }
    return null;
  }
  function parse(text, filename) {
    const lines=text.replace(/[\uE000-\uF8FF\uFFFD]/g,'')
      .replace(/\r\n?/g,'\n').split('\n')
      .map(x=>x.replace(/[\u0000-\u0009\u000B-\u001F]/g,'').trim())
      .filter(Boolean);
    if(!lines.length)throw new Error('No readable text found. Scanned PDFs require OCR.');
    const sections=[];let current={title:'Introduction',lines:[]};
    const flush=()=>{
      if(!current.lines.length)return;
      const body=current.lines.join('\n').trim();
      if(body)sections.push({title:current.title,content:body});
    };
    for(const line of lines){
      // Repair heading text stuck to the end of a preceding PDF line.
      const trailing=line.match(/^(.{8,}?)\s{2,}(OBJECTIVE|EXPERIENCE|EDUCATION|PROJECTS|CONTACT|SKILLS|CERTIFICATIONS|INTERESTS|LANGUAGES|PERSONAL DETAILS)\s*$/);
      if(trailing){current.lines.push(trailing[1].trim());flush();current={title:identifyHeading(trailing[2])||trailing[2],lines:[]};continue;}
      const standalone=identifyHeading(line);
      const inline=standalone?null:findInlineHeading(line);
      const generic=null; // Do not mistake employer names or job titles for headings.
      const next=standalone||inline?.title||generic;
      if(next){
        flush();
        current={title:next,lines:inline?[inline.remainder]:[]};
      }else current.lines.push(line);
    }
    flush();
    // The parser never invents six fixed sections; only actual recognized headings become checkpoints.
    // Do not infer "Contact" from a phone/email line or from an internship.
    const first=sections.find(x=>x.title==='Introduction');
    const name=first?.content.split('\n')[0]?.slice(0,90)||'';
    return {filename,name,sections,extractedAt:new Date().toISOString()};
  }
  async function extract(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'docx') {
      if (!window.mammoth) throw new Error('DOCX reader could not load. Check your internet connection and refresh.');
      const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return result.value;
    }
    if (ext === 'pdf') {
      if (!window.pdfjsLib) throw new Error('PDF reader could not load. Check your internet connection and refresh.');
      const pdfjs = window.pdfjsLib;
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      const pages = [];
      try {
        for (let p = 1; p <= doc.numPages; p++) {
          const page = await doc.getPage(p);
          const viewport=page.getViewport({scale:1});
          const items=(await page.getTextContent()).items
            .filter(item=>typeof item.str==='string' && item.str.trim())
            .map(item=>({text:item.str.trim(),x:item.transform?.[4]??0,y:item.transform?.[5]??0,width:item.width??0}));
          // Separate independently flowing columns BEFORE ordering by vertical position.
          // On this uploaded resume, the left column ends around 60% of page width.
          // A wide gap in text-start positions indicates two independent columns.
          const width=viewport.width;
          const left=items.filter(i=>i.x<width*.60);
          const right=items.filter(i=>i.x>=width*.60);
          const substantialRight=right.filter(i=>i.text.length>3).length>=5;
          const substantialLeft=left.filter(i=>i.text.length>3).length>=5;
          const columns=substantialLeft&&substantialRight?[left,right]:[items];
          function reconstruct(column){
            const sorted=column.sort((a,b)=>Math.abs(a.y-b.y)>3?b.y-a.y:a.x-b.x);
            const rows=[];
            for(const item of sorted){
              let row=rows.find(r=>Math.abs(r.y-item.y)<=3);
              if(!row){row={y:item.y,items:[]};rows.push(row)}
              row.items.push(item);
            }
            rows.sort((a,b)=>b.y-a.y);
            return rows.map(row=>{
              row.items.sort((a,b)=>a.x-b.x);
              let line='',prev=null;
              for(const item of row.items){
                if(prev){const gap=item.x-(prev.x+prev.width);if(gap>16)line+='  ';else if(gap>1)line+=' '}
                line+=item.text;prev=item;
              }
              return line;
            }).join('\n');
          }
          // Preserve page + column boundaries to avoid leaking internship content into Contact.
          const out=columns.map(reconstruct).join('\n\n');
          pages.push(out);
        }
      } finally { await doc.destroy(); }
      return pages.join('\n');
    }
    throw new Error('Only PDF and DOCX files are supported.');
  }
  async function extractStructured(file){
    if(file.name.split('.').pop().toLowerCase()!=='pdf')return parse(await extract(file),file.name);
    if(!window.pdfjsLib)throw new Error('PDF.js could not load. Check your internet connection.');
    const pdfjs=window.pdfjsLib;
    pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
    const columnStreams=[[],[]];let isTwoColumn=false;
    try{
      for(let p=1;p<=doc.numPages;p++){
        const page=await doc.getPage(p);const width=page.getViewport({scale:1}).width;
        const items=(await page.getTextContent()).items.filter(x=>x.str?.trim()).map(x=>({text:x.str.trim(),x:x.transform[4],y:x.transform[5],width:x.width||0}));
        const left=items.filter(x=>x.x<width*.60),right=items.filter(x=>x.x>=width*.60);
        const split=left.filter(x=>x.text.length>3).length>=5&&right.filter(x=>x.text.length>3).length>=5;
        isTwoColumn||=split;
        const columns=split?[left,right]:[items,[]];
        columns.forEach((column,ci)=>{
          const rows=[];
          for(const item of column.sort((a,b)=>Math.abs(a.y-b.y)>3?b.y-a.y:a.x-b.x)){
            let row=rows.find(r=>Math.abs(r.y-item.y)<=3);
            if(!row){row={y:item.y,items:[]};rows.push(row)}row.items.push(item);
          }
          rows.sort((a,b)=>b.y-a.y);
          const text=rows.map(r=>r.items.sort((a,b)=>a.x-b.x).map(x=>x.text).join(' ')).join('\n');
          if(text.trim())columnStreams[ci].push(text);
        });
      }
    }finally{await doc.destroy()}
    if(!isTwoColumn)return parse(columnStreams[0].join('\n'),file.name);
    // Page 2 resumes the left column, so combine left pages before parsing right column.
    const leftData=parse(columnStreams[0].join('\n'),file.name);
    const rightData=parse(columnStreams[1].join('\n'),file.name);
    const leftSections=leftData.sections;
    const rightSections=rightData.sections.filter(s=>s.title!=='Introduction'||s.content.trim());
    return {filename:file.name,name:leftData.name,sections:[...leftSections,...rightSections],extractedAt:new Date().toISOString()};
  }
  return { parse, extract, extractStructured };
})();
