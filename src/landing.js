const reduced=matchMedia('(prefers-reduced-motion: reduce)');
fetch('/api/storefront').then(response=>response.ok?response.json():null).then(storefront=>{
 if(!storefront?.landing)return;
 document.querySelectorAll('[data-field]').forEach(el=>{
  const text=storefront.landing[el.dataset.field];
  if(typeof text==='string'&&text.trim())el.textContent=text;
 });
}).catch(()=>{}); // Built-in text remains visible when the API is unavailable.

const clothesBanner=document.querySelector('.clothes-banner');
const shirt=clothesBanner.querySelector('.garment-3d');
if(!reduced.matches){
 let modelStarted=false;
 const observer=new IntersectionObserver(entries=>{
  if(!entries[0].isIntersecting||modelStarted)return;
  modelStarted=true;observer.disconnect();
  import('/src/garment3d.bundle.js').then(module=>module.initializeGarments()).catch(()=>{});
 },{rootMargin:'150px'});
 observer.observe(shirt);
}
let leaving=false;
document.querySelectorAll('[data-department]').forEach(link=>{
 link.addEventListener('click',event=>{
  if(reduced.matches||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  event.preventDefault();
  if(leaving)return;
  leaving=true;
  link.classList.add('departing');
  if(link.dataset.department==='clothes'){
   const layer=document.createElement('div');
   layer.className='transition-layer';layer.setAttribute('aria-hidden','true');
   const canvas=shirt.querySelector('canvas');
   const image=shirt.querySelector('img').cloneNode();
   if(canvas&&shirt.classList.contains('is-ready')){
    try{image.src=canvas.toDataURL();}catch{}
   }
   const bounds=shirt.getBoundingClientRect();
   layer.append(image);document.body.append(layer);
   const zoom=Math.max(innerWidth/bounds.width,innerHeight/bounds.height)*2.8;
   image.style.cssText=`position:absolute;left:${bounds.left}px;top:${bounds.top}px;width:${bounds.width}px;height:${bounds.height}px;animation:none`;
   image.animate([{transform:'scale(1)'},{transform:`translate(${innerWidth/2-bounds.left-bounds.width/2}px,${innerHeight/2-bounds.top-bounds.height/2}px) scale(${zoom})`}],{duration:670,easing:'cubic-bezier(.38,.12,.62,1)',fill:'forwards'});
  }
  setTimeout(()=>location.assign(link.href),link.dataset.department==='clothes'?680:710);
 });
});
window.addEventListener('pageshow',()=>{
 leaving=false;
 document.querySelectorAll('.departing').forEach(el=>el.classList.remove('departing'));
 document.querySelector('.transition-layer')?.remove();
});
