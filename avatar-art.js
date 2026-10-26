'use strict';
const characters=[
 {id:'bubbles',name:'Bubbles',desc:'The cheerful robot cat',color:'#30a8dc',ear:'round',feature:'whiskers'},
 {id:'ember',name:'Ember',desc:'The adventurous red bird',color:'#ed6a62',ear:'tuft',feature:'beak'},
 {id:'milo',name:'Milo',desc:'The curious forest fox',color:'#e99a48',ear:'point',feature:'nose'},
 {id:'nova',name:'Nova',desc:'The bright little explorer',color:'#8b79d5',ear:'antenna',feature:'smile'},
 {id:'leaf',name:'Leaf',desc:'The friendly green dinosaur',color:'#6bbb83',ear:'spikes',feature:'nose'},
 {id:'sunny',name:'Sunny',desc:'The playful golden bear',color:'#e6b854',ear:'bear',feature:'nose'}
];
function avatarSvg(c){
 let ears={round:'<circle cx="39" cy="30" r="14" fill="'+c.color+'"/><circle cx="101" cy="30" r="14" fill="'+c.color+'"/>',tuft:'<path d="M57 24 47 5 70 20 81 3 83 27" fill="'+c.color+'"/>',point:'<path d="M29 54 34 6 65 31 M78 31 108 6 111 54" fill="'+c.color+'"/>',antenna:'<path d="M70 25V7" stroke="'+c.color+'" stroke-width="7"/><circle cx="70" cy="6" r="8" fill="#f5ca68"/>',spikes:'<path d="M33 56 27 24 47 36 57 14 71 33 91 12 96 43" fill="'+c.color+'"/>',bear:'<circle cx="36" cy="37" r="18" fill="'+c.color+'"/><circle cx="104" cy="37" r="18" fill="'+c.color+'"/>'}[c.ear];
 let face=c.feature==='beak'?'<path d="M56 80 84 80 70 99Z" fill="#f8bc58"/>':c.feature==='whiskers'?'<path d="M35 79 52 83 M35 89 52 89 M88 83 105 79 M88 89 105 89" stroke="#3c5874" stroke-width="2"/><circle cx="70" cy="82" r="6" fill="#e97079"/>':'<ellipse cx="70" cy="82" rx="7" ry="5" fill="#774c4b"/>';
 return `<svg viewBox="0 0 140 160" class="character-svg" role="img" aria-label="${c.name} animated character"><ellipse cx="70" cy="150" rx="38" ry="6" fill="#35516b" opacity=".13"/><path d="M43 111Q28 129 39 143L57 140 69 121 82 140 103 143Q112 130 97 111" fill="${c.color}" stroke="#36506c" stroke-width="2"/>${ears}<ellipse cx="70" cy="74" rx="49" ry="52" fill="${c.color}" stroke="#36506c" stroke-width="2"/><ellipse cx="70" cy="91" rx="34" ry="28" fill="#fff8ec"/><g class="blink blink-left"><ellipse cx="55" cy="66" rx="11" ry="15" fill="white"/><circle cx="57" cy="68" r="4" fill="#253c56"/></g><g class="blink blink-right"><ellipse cx="85" cy="66" rx="11" ry="15" fill="white"/><circle cx="83" cy="68" r="4" fill="#253c56"/></g>${face}<path d="M57 101Q70 111 83 101" fill="none" stroke="#5a4a52" stroke-width="3" stroke-linecap="round"/><circle cx="39" cy="94" r="7" fill="#fa8d9b" opacity=".55"/><circle cx="101" cy="94" r="7" fill="#fa8d9b" opacity=".55"/></svg>`;
}


function mountWalkThruLogo(){
 document.querySelectorAll('[data-avatar-logo]').forEach(root=>{
  root.innerHTML='';
  const ids=['leaf','sunny','milo','nova','ember','bubbles'];
  ids.forEach((id,i)=>{
   const item=document.createElement('span');
   item.className='logo-friend logo-friend-'+i;
   item.innerHTML=avatarSvg(characters.find(c=>c.id===id));
   root.appendChild(item);
  });
 });
}
document.addEventListener('DOMContentLoaded',mountWalkThruLogo);
