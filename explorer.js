 'use strict';
const canvas=document.getElementById('game-canvas');
const ctx=canvas.getContext('2d');
const stage=document.getElementById('game-stage');
const avatarEl=document.getElementById('stage-avatar');
const popup=document.getElementById('stage-popup');
const popupHeading=document.getElementById('popup-heading');
const popupBody=document.getElementById('popup-body');
const map=document.getElementById('mini-map');
const $=id=>document.getElementById(id);
const storage=key=>{try{return sessionStorage.getItem(key)}catch{return null}};
let resume=null;
try{resume=JSON.parse(storage('walkthru.resume')||'null')}catch{}
if(!resume?.sections?.length){
 document.querySelector('.adventure-main').innerHTML='<section class="checkpoint-panel" style="display:block!important"><h2>No resume loaded</h2><p>Upload a PDF or DOCX first.</p><a class="btn btn-primary" href="index.html">Upload resume</a></section>';
}else{
const avatarId=storage('walkthru.avatar');
const selected=characters.find(c=>c.id===avatarId)||characters[0];
avatarEl.innerHTML=avatarSvg(selected);
// Keep avatar as a sibling of the popup, so it remains visible when popup closes.
avatarEl.title=`Selected avatar: ${selected.name}`;
const checkpoints=[
 {title:'START',text:`Welcome${resume.name?' to '+resume.name+"'s":' to your'} resume adventure! Use the arrow keys or A / D to visit the first resume section.`,icon:'🚩',kind:'start'},
 ...resume.sections.filter(x=>String(x.content??'').trim()).map(s=>({
 title:String(s.title||'Resume section'),text:String(s.content||''),icon:/educat|academic/i.test(s.title)?'🎓':/skill/i.test(s.title)?'🧰':/experience|intern|employment/i.test(s.title)?'💼':/project|research/i.test(s.title)?'🚀':/certif|award|achieve/i.test(s.title)?'🏅':/contact/i.test(s.title)?'☎️':'📚',kind:'section'
 })),
 {title:'FINISH',text:'You have reached the end of this resume. Thank you for exploring with WalkThru!',icon:'🏁',kind:'finish'}
];
const total=checkpoints.length;
const positions=checkpoints.map((c,i)=>({x:145+i*260,y:340+(i%3===1?-24:i%3===2?22:0)}));
const worldWidth=positions.at(-1).x+280;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
let current=0,from=0,to=0,startAt=performance.now(),camera=0,opened=false,showEffects=!matchMedia('(prefers-reduced-motion: reduce)').matches;
let sound=false,ctxAudio=null,popupTimer=0;
const visited=new Set([0]);
function playTone(){
 if(!sound)return;
 try{ctxAudio??=new (window.AudioContext||window.webkitAudioContext)();const o=ctxAudio.createOscillator(),g=ctxAudio.createGain();o.frequency.value=630;g.gain.setValueAtTime(.045,ctxAudio.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctxAudio.currentTime+.12);o.connect(g);g.connect(ctxAudio.destination);o.start();o.stop(ctxAudio.currentTime+.14)}catch{}
}
const nodes=checkpoints.map((c,i)=>{
 const b=document.createElement('button');b.type='button';b.className='map-node';
 b.textContent=c.icon;b.title=`${i+1}. ${c.title}`;
 b.setAttribute('aria-label',`Go to ${c.title}`);
 b.addEventListener('click',()=>go(i));map.appendChild(b);return b;
});
// Resume content is rendered as real HTML elements (never injected HTML from a resume).
function formatDetails(text, sectionTitle=''){
 popupBody.replaceChildren();
 const title=sectionTitle.toLowerCase();
 const cleaned=String(text||'').replace(/[\uE000-\uF8FF\uFFFD]/g,'').replace(/[\u0000-\u0009\u000B-\u001F]/g,'');
 let lines=cleaned.split(/\n+/).map(x=>x.replace(/[ \t]+/g,' ').replace(/^[,;:|•●▪■]\s*/,'').trim()).filter(Boolean);
 // Repair one specific PDF artifact: stray headings carried over from adjacent columns.
 lines=lines.filter(x=>x.toLowerCase()!==title && !/^[\uE000-\uF8FF]$/.test(x));
 if(!lines.length){popupBody.textContent='No readable details found in this section.';return}
 const list=document.createElement('div');list.className='resume-readable';
 const make=(tag,cls,value)=>{const el=document.createElement(tag);el.className=cls;el.textContent=value;return el};
 const add=(cls,heading,body)=>{
   const item=document.createElement('div');item.className='readable-item '+cls;
   if(heading)item.append(make('strong','readable-label',heading));
   item.append(make('span','readable-value',body));
   list.append(item);
 };
 if(/contact/i.test(title)){
   const all=lines.join(' ');
   const email=all.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
   const phone=all.match(/(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/);
   const link=all.match(/https?:\/\/[^\s]+(?:\s+[a-z][\w-]+)?/i);
   if(email)add('fact','Email',email[0]);
   if(phone)add('fact','Phone',phone[0]);
   if(link)add('fact','LinkedIn / Website',link[0].replace(/\s+/g,''));
   const remainder=lines.filter(x=>!x.includes('@')&&!/https?:\/\//.test(x)&&!/\+91/.test(x)&&!/^\s*\d{10}\s*$/.test(x));
   if(remainder.length){
     add('fact','Other contact details',remainder.join(' ').replace(/\bOBJECTIVE\b.*$/i,'').trim());
   }
 }else if(/skills|languages|interests/i.test(title)){
   const words=lines.join(' ').split(/\s*[,;]\s*/).map(x=>x.trim()).filter(Boolean);
   const chips=document.createElement('div');chips.className='readable-chips';
   words.forEach(x=>chips.append(make('span','readable-chip',x)));
   list.append(chips);
 }else if(/objective|summary|profile/i.test(title)){
   list.append(make('p','readable-summary',lines.join(' ')));
 }else if(/personal details/i.test(title)){
   lines.forEach(x=>{
     const m=x.match(/^([^:]{2,28})\s*:\s*(.+)$/);
     if(m)add('fact',m[1],m[2]);else add('paragraph','',x);
   });
 }else{
   // A paragraph-style card for each meaningful entry; dates receive distinct chips.
   let entry=null;
   const newEntry=()=>{entry=document.createElement('article');entry.className='readable-card';list.append(entry)};
   lines.forEach((line,i)=>{
     const isDate=/^(?:\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|(?:19|20)\d\d\s*[-–]\s*(?:\d{2,4}|present)|(?:19|20)\d\d[-–](?:19|20)\d\d)/i.test(line);
     const isBullet=/^[•●▪■\-–]\s+/.test(line);
     const isHeading=!isDate && !isBullet && line.length<95 && (i===0 || (i>0 && /[.!?]$/.test(lines[i-1])) || /intern|college|school|university|project|certificate|hackathon|workshop/i.test(line));
     if(isHeading){newEntry();entry.append(make('h3','readable-entry-title',line));return}
     if(!entry)newEntry();
     if(isDate){entry.append(make('span','readable-date',line));return}
     const last=entry.lastElementChild;
     if(last?.classList.contains('readable-description')&&!/[.!?]$/.test(last.textContent)){
       last.textContent+=' '+line.replace(/^[•●▪■\-–]\s*/,'');
     }else entry.append(make('p','readable-description',line.replace(/^[•●▪■\-–]\s*/,'')));
   });
 }
 popupBody.append(list);
}
function popupPosition(){
 // Checkpoint position is computed in draw() for the moving camera.
 // When the popup is open, CSS places the avatar above the popup.
}
function renderUI(){
 const cp=checkpoints[current];
 $('progress-text').textContent=`Checkpoint ${current+1} / ${total}`;
 $('progress-fill').style.width=`${100*(current+1)/total}%`;
 $('journey-name').textContent=`${resume.name||'Resume'} · ${total-2} resume sections`;
 $('collect-counter').textContent=`⭐ ${visited.size} / ${total} discovered`;
 $('mini-map-status').textContent=`${total-2} resume sections · scroll to see all →`;
 $('move-left').disabled=current===0;
 $('move-right').disabled=current===total-1;
 $('finish-game').hidden=cp.kind!=='finish';
 $('open-detail').textContent=opened?'Hide checkpoint':'View checkpoint';
 popupHeading.textContent=cp.title;
 formatDetails(cp.text,cp.title);
 popup.hidden=!opened;
 nodes.forEach((b,i)=>{b.classList.toggle('current',i===current);b.classList.toggle('visited',visited.has(i));b.setAttribute('aria-current',i===current?'step':'false')});
 map.scrollTo({left:nodes[current].offsetLeft-map.offsetLeft-map.clientWidth/2+nodes[current].clientWidth/2,behavior:'smooth'});
}
function showPopup(open){
 opened=open;
 avatarEl.classList.toggle('at-popup',open);
 avatarEl.classList.toggle('at-checkpoint',!open);
 renderUI();
}
function go(next){
 next=clamp(next,0,total-1);
 if(next===current)return;
 clearTimeout(popupTimer);
 from=to;to=next;startAt=performance.now();current=next;opened=false;
 visited.add(next);playTone();avatarEl.classList.remove('at-popup');avatarEl.classList.add('at-checkpoint');renderUI();

 popupTimer=setTimeout(()=>{showPopup(true)},showEffects?640:20);
}
function draw(t){
 const W=canvas.width,H=canvas.height;
 ctx.clearRect(0,0,W,H);
 const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#a8edf5');sky.addColorStop(.75,'#e2f7d5');sky.addColorStop(1,'#f5d28e');
 ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
 const fraction=showEffects?clamp((t-startAt)/620,0,1):1;
 const ease=fraction*fraction*(3-2*fraction);
 const px=positions[from].x+(positions[to].x-positions[from].x)*ease;
 const py=positions[from].y+(positions[to].y-positions[from].y)*ease;
 const target=clamp(px-210,0,Math.max(0,worldWidth-W));
 camera=showEffects?camera+(target-camera)*.18:target;
 ctx.save();ctx.translate(-camera*.24,0);
 for(let i=0;i<Math.ceil(worldWidth/300)+5;i++){ctx.fillStyle=i%2?'#c4e5b5':'#a7d7b4';ctx.beginPath();ctx.arc(i*300,430,150,Math.PI,0);ctx.fill()}
 ctx.restore();
 ctx.save();ctx.translate(-camera,0);
 for(let i=0;i<Math.ceil(worldWidth/210)+2;i++){
  const x=i*210+70+(showEffects?Math.sin(t/1300+i)*9:0);
  ctx.fillStyle='#ffffffa8';ctx.beginPath();ctx.ellipse(x,90+(i%3)*20,65,19,0,0,Math.PI*2);ctx.ellipse(x+35,80+(i%3)*20,42,25,0,0,Math.PI*2);ctx.fill();
 }
 ctx.fillStyle='#80c99b';ctx.fillRect(0,435,worldWidth,75);
 ctx.lineCap='round';ctx.lineJoin='round';
 ctx.beginPath();positions.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
 ctx.strokeStyle='#f3cf89';ctx.lineWidth=43;ctx.stroke();
 ctx.strokeStyle='#d85458';ctx.lineWidth=6;ctx.stroke();
 ctx.setLineDash([12,15]);ctx.strokeStyle='#fff6e2';ctx.lineWidth=2;ctx.stroke();ctx.setLineDash([]);
 positions.forEach((p,i)=>{
  const cp=checkpoints[i],selected=i===current;
  ctx.fillStyle=selected?'#ffe7ad':'#fffef3';ctx.strokeStyle=cp.kind==='finish'?'#d34c50':'#e2ac6b';ctx.lineWidth=3;
  ctx.beginPath();ctx.roundRect(p.x-80,p.y-145,160,82,13);ctx.fill();ctx.stroke();
  ctx.font='30px sans-serif';ctx.textAlign='center';ctx.fillText(cp.icon,p.x,p.y-108);
  ctx.fillStyle='#244e64';ctx.font='bold 14px sans-serif';ctx.fillText(cp.title.slice(0,20),p.x,p.y-81);
  ctx.fillStyle=cp.kind==='finish'?'#d34c50':'#e4aa5b';ctx.beginPath();ctx.arc(p.x,p.y,selected?20:14,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(p.x,p.y,selected?9:6,0,Math.PI*2);ctx.fill();
  if(cp.kind==='start'||cp.kind==='finish'){
   ctx.strokeStyle='#874d4e';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(p.x+35,p.y-10);ctx.lineTo(p.x+35,p.y-75);ctx.stroke();
   ctx.fillStyle=cp.kind==='start'?'#edac57':'#d34c50';ctx.beginPath();ctx.moveTo(p.x+37,p.y-75);ctx.lineTo(p.x+88,p.y-61);ctx.lineTo(p.x+37,p.y-46);ctx.closePath();ctx.fill();
  }
 });
 ctx.restore();
 // Overlay avatar stays on screen beside the popup; canvas never paints a fallback emoji.
 const xPct=100*(px-camera)/W;
 const yPct=100*(py-62)/H;
 avatarEl.style.setProperty('--checkpoint-x',`${xPct}%`);
 avatarEl.style.setProperty('--checkpoint-y',`${yPct}%`);
 requestAnimationFrame(draw);
}
$('move-left').onclick=()=>go(current-1);
$('move-right').onclick=()=>go(current+1);
$('open-detail').onclick=()=>showPopup(!opened);
$('popup-close').onclick=()=>showPopup(false);
$('finish-game').onclick=()=>{$('game-finish').hidden=false};
$('sound-toggle').onclick=()=>{sound=!sound;$('sound-toggle').textContent=sound?'🔊 Sound on':'🔇 Sound off';playTone()};
$('motion-toggle').onclick=()=>{showEffects=!showEffects;$('motion-toggle').textContent=showEffects?'✨ Effects on':'✨ Effects off'};
function keyHandler(e){
 if(e.ctrlKey||e.metaKey||e.altKey||e.isComposing)return;
 const target=e.target;
 if(target instanceof HTMLElement && (target.matches('input,textarea,select,[contenteditable]')))return;
 const key=e.key.toLowerCase();
 if(!['arrowright','arrowleft','arrowup','arrowdown','w','a','s','d','enter','escape'].includes(key))return;
 // Keyboard works even after clicking a navigation button or checkpoint card.
 e.preventDefault();
 if(key==='arrowright'||key==='d')go(current+1);
 else if(key==='arrowleft'||key==='a')go(current-1);
 else if(key==='arrowup'||key==='w'||key==='enter')showPopup(true);
 else showPopup(false);
}
document.addEventListener('keydown',keyHandler,true);
$('game-stage').setAttribute('tabindex','0');
$('game-stage').addEventListener('click',()=>{$('game-stage').focus({preventScroll:true})});
avatarEl.classList.add('at-checkpoint');
renderUI();
requestAnimationFrame(draw);
}
