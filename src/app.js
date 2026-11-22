// Storefront interactions and the original campaign illustrations.
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
function flipGear(type, color){
 const p=products.find(p=>p.id==='pp-competition'),image=p&&productPhotos(p,0)[0];
 return `<div class="garment-3d" role="img" aria-label="مجسّم بلوزة كومبتشن ثلاثي الأبعاد — اسحب للتدوير" tabindex="0">${image?`<img class="garment-poster" src="${escapeHTML(image)}" alt="بلوزة كومبتشن أسود وأحمر" loading="lazy">`:''}</div>`;
}

function makeCard(p,i){
 const out=colorStock(p,0)===0;
 return `<article class="product-card reveal" data-product="${i}" data-delay="${i%3}">
 <button class="product-visual${out?' is-out-of-stock':''}" data-open="${i}" aria-label="عرض ${escapeHTML(p.name)}${out?' — نفدت الكمية لهذا اللون':''}">
 <span class="product-id" dir="ltr">POWERPUNCH</span>${productArt(p,0)}${stockOverlay()}<span class="photo-badge" dir="rtl"${productPhotos(p,0).length<2?' hidden':''}>${productPhotos(p,0).length} صور</span><span class="product-open" aria-hidden="true">↗</span>${p.salePrice!==undefined?`<span class="sale-badge" dir="rtl">خصم <bdi>${offerDiscount({price:p.salePrice,originalPrice:p.originalPrice})}%</bdi></span>`:''}</button>
 <div class="product-card-body" dir="rtl"><div class="product-meta"><div><div class="product-type">${escapeHTML(p.categoryName||p.kind)}</div><h3>${escapeHTML(p.name)}</h3></div><div class="price" dir="ltr">${priceMarkup(p)}</div></div>
 <div class="stock-amount${out?' stock-amount-empty':''}" id="stock-${i}" dir="rtl" aria-live="polite">${colorStockLabel(p,0)}</div>
 <div class="shelf"><div><div class="swatches">${p.colors.map((c,k)=>`<button class="swatch" data-swatch="${i}:${k}" title="${escapeHTML(c[0])}" aria-label="${escapeHTML(p.name)}: ${escapeHTML(c[0])}" aria-pressed="${k===0}" style="--sw:${c[1]}"></button>`).join('')}</div><div class="color-label" id="color-${i}">${escapeHTML(p.colors[0][0])}</div></div></div><div class="card-actions"><button class="quick card-buy" data-open="${i}" data-intent="buy">شراء الآن</button><button class="quick" data-open="${i}" data-intent="cart">أضف إلى السلة</button></div></div></article>`
}

let chosen=0, chosenColor=0, chosenPhoto=0, chosenSize='M', lastFocus=null;

function openQuick(i,intent='buy'){
 chosen=i;chosenColor=Number(document.querySelector(`[data-product="${i}"] .swatch[aria-pressed="true"]`)?.dataset.swatch.split(':')[1]||0);chosenSize='M';
 const p=products[i];chosenPhoto=productGallery(p).findIndex(slide=>slide.color===chosenColor);
 document.querySelector('.modal-name').textContent=p.name;document.querySelector('.modal-desc').textContent=p.kind+' · جاهز لكل تمرين.';document.querySelector('.modal-price').innerHTML=priceMarkup(p);
 document.querySelector('.modal-colors').innerHTML=p.colors.map((c,k)=>`<button class="swatch" data-modal-color="${k}" aria-label="${escapeHTML(c[0])}" title="${escapeHTML(c[0])}" aria-pressed="${k===chosenColor}" style="--sw:${c[1]}"></button>`).join('');
 lastFocus=document.activeElement;document.querySelector('.modal').classList.add('open');document.body.style.overflow='hidden';document.querySelector('.modal-panel').scrollTop=0;
 renderGallery();document.querySelector('.modal-close').focus();
}
function closeQuick(){document.querySelector('.modal').classList.remove('open');document.querySelector('.modal-art iframe')?.remove();document.body.style.overflow='';lastFocus?.focus?.()}
function selectGallerySlide(index){
 const p=products[chosen],slides=productGallery(p),slide=slides[index];if(!slide)return;
 chosenPhoto=index;
 if(slide.color!==undefined){chosenColor=slide.color;document.querySelectorAll('[data-modal-color]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.modalColor)===chosenColor));}
 updateVariantOptions();
 const art=document.querySelector('.modal-art');art.classList.toggle('is-reel',Boolean(slide.reel));
 const slot=art.querySelector('.reel-slot');
 if(slot){
  if(slide.reel&&!slot.querySelector('iframe'))slot.innerHTML=`<div class="reel-media"><iframe src="${slide.reel}embed/" title="ريل المنتج ${escapeHTML(p.name)} على إنستغرام" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe><a class="reel-fallback" href="${slide.reel}" target="_blank" rel="noopener noreferrer">ما ظهر الفيديو؟ شاهد على إنستغرام ↗</a></div>`;
  else if(!slide.reel)slot.replaceChildren();
 }
 art.querySelectorAll('.gallery-slide').forEach((el,i)=>{el.inert=i!==index;el.setAttribute('aria-hidden',i!==index);});
 const prev=document.querySelector('[data-gallery-step="-1"]'),next=document.querySelector('[data-gallery-step="1"]');
 if(prev)prev.disabled=index===0;if(next)next.disabled=index===slides.length-1;
}
function renderGallery(rebuild=true){
 const p=products[chosen],slides=productGallery(p),art=document.querySelector('.modal-art');
 chosenPhoto=Math.max(0,Math.min(chosenPhoto,slides.length-1));
 if(rebuild){
  art.classList.remove('is-out-of-stock');
  art.innerHTML=`<div class="gallery-track" tabindex="0" role="region" aria-label="صور ألوان المنتج والفيديو، اسحب للتنقل">${slides.map(slide=>slide.reel?'<div class="gallery-slide reel-slot"></div>':`<div class="gallery-slide${colorStock(p,slide.color)===0?' is-out-of-stock':''}">${productArt(p,slide.color,slide.photo)}${stockOverlay()}</div>`).join('')}</div>`;
  const track=art.querySelector('.gallery-track');
  let settleTimer;
  const settle=()=>{
   if(!document.querySelector('.modal.open')||track.clientWidth===0)return;
   const index=Math.round(track.scrollLeft/track.clientWidth);
   if(Math.abs(track.scrollLeft-index*track.clientWidth)<3&&index!==chosenPhoto)selectGallerySlide(index);
  };
  track.addEventListener('scroll',()=>{clearTimeout(settleTimer);settleTimer=setTimeout(settle,90);},{passive:true});track.addEventListener('scrollend',settle);
  // Native touch scrolling preserves vertical page gestures; mouse dragging adds desktop support.
  let drag=null;
  track.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0||e.target.closest('a,iframe'))return;drag={x:e.clientX,left:track.scrollLeft};track.setPointerCapture(e.pointerId);track.classList.add('dragging');});
  track.addEventListener('pointermove',e=>{if(drag)track.scrollLeft=drag.left+drag.x-e.clientX;});
  const release=()=>{if(!drag)return;drag=null;track.classList.remove('dragging');track.scrollTo({left:Math.round(track.scrollLeft/track.clientWidth)*track.clientWidth,behavior:prefersReduced?'instant':'smooth'});};
  track.addEventListener('pointerup',release);track.addEventListener('pointercancel',release);track.addEventListener('lostpointercapture',release);
  track.addEventListener('dragstart',e=>e.preventDefault());
  document.querySelector('.gallery-thumbnails').replaceChildren();document.querySelector('.gallery-thumbnails').hidden=true;
  const controls=document.querySelector('.gallery-controls');controls.hidden=slides.length<2;
  controls.innerHTML=slides.length>1?'<button type="button" data-gallery-step="-1" aria-label="العنصر السابق">←</button><button type="button" data-gallery-step="1" aria-label="العنصر التالي">→</button>':'';
 }
 selectGallerySlide(chosenPhoto);
 const track=art.querySelector('.gallery-track');track.scrollTo({left:chosenPhoto*track.clientWidth,behavior:rebuild||prefersReduced?'instant':'smooth'});
}
function movePhoto(step){
 const count=productGallery(products[chosen]).length;
 const next=Math.max(0,Math.min(count-1,chosenPhoto+step));if(next===chosenPhoto)return;
 chosenPhoto=next;renderGallery(false);
}
function initialize(){
 initializeShop();
 document.querySelectorAll('[data-flip-gear]').forEach(el=>{const id=Number(el.dataset.flipGear),p=products[id];if(p)el.innerHTML=flipGear(p.type,p.colors[0][1])});
 document.querySelectorAll('[data-hero-gear]').forEach(el=>{const id=Number(el.dataset.heroGear),p=products[id];if(p)el.innerHTML=flipGear(p.type,p.colors[0][1])});
 import('/src/garment3d.bundle.js').then(module=>module.initializeGarments()).catch(()=>{});
 const intersection=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('show');intersection.unobserve(e.target)}}),{threshold:.09});document.querySelectorAll('.reveal, .reveal-x').forEach(x=>intersection.observe(x));
 document.addEventListener('click',e=>{
  const sw=e.target.closest('[data-swatch]');if(sw){const [i,k]=sw.dataset.swatch.split(':').map(Number),p=products[i],card=sw.closest('.product-card');card.querySelectorAll('.swatch').forEach(b=>b.setAttribute('aria-pressed',b===sw));card.querySelector('.product-visual').querySelector('svg,img').outerHTML=productArt(p,k);document.getElementById('color-'+i).textContent=p.colors[k][0];updateCardStock(card,p,k,i);return;}
  const op=e.target.closest('[data-open]');if(op){openQuick(Number(op.dataset.open),op.dataset.intent);return;}
  if(e.target.closest('[data-close-modal]')){closeQuick();return;}
  const mc=e.target.closest('[data-modal-color]');if(mc){chosenColor=Number(mc.dataset.modalColor);chosenPhoto=productGallery(products[chosen]).findIndex(slide=>slide.color===chosenColor);renderGallery(false);return;}
  const arrow=e.target.closest('[data-gallery-step]');if(arrow){movePhoto(Number(arrow.dataset.galleryStep));return;}
  const sz=e.target.closest('[data-size]');if(sz && !sz.disabled){chosenSize=sz.dataset.size;document.querySelectorAll('.size').forEach(b=>b.setAttribute('aria-pressed',b===sz));updateModalStock();return;}
  if(e.target.closest('[data-buy]')){const item={productId:products[chosen].id,color:chosenColor,size:chosenSize,quantity:1};if(chosenSize&&variantStock(products[chosen],chosenColor,chosenSize)){closeQuick();startQuickBuy(item);}return;}
  if(e.target.closest('[data-add]')){if(addToCart(products[chosen].id,chosenColor,chosenSize)){closeQuick();toast('تمت إضافة المنتج إلى السلة');}return;}
  if(e.target.closest('[data-open-menu]')){document.querySelector('.menu-panel').classList.add('open');return;}
  if(e.target.closest('[data-close-menu]')||e.target.closest('.menu-panel a')){document.querySelector('.menu-panel').classList.remove('open');return;}
  if(e.target.closest('[data-bag]')){openCart();return;}
 });
 document.addEventListener('keydown',e=>{if(document.querySelector('.modal.open')&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();movePhoto(e.key==='ArrowRight'?1:-1);}if(e.key==='Escape'){if(document.querySelector('.modal.open'))closeQuick();document.querySelector('.menu-panel').classList.remove('open')}if(e.key==='Tab'&&document.querySelector('.modal.open')){const items=[...document.querySelector('.modal-panel').querySelectorAll('button:not([disabled]),a[href],.gallery-track,iframe')];const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
 let frameRequested=false;
 const progressBar=document.querySelector('.progress');
 const flipStages=[...document.querySelectorAll('.flip-story')];
 const rollPanels=[...document.querySelectorAll('[data-roll-panel]')];
 const heroFloat=[...document.querySelectorAll('[data-hero-float]')];
 const stageParts=new Map(flipStages.map(stage=>{const progress=stage.querySelector('.flip-progress');const meter=document.createElement('span');meter.className='flip-meter';progress?.append(meter);return [stage,{model:stage.querySelector('.garment-3d'),phase:stage.querySelector('.phase'),detail:stage.querySelector('.phase-note'),meter}]}));
 const heroModels=new Map(heroFloat.map(el=>[el,el.querySelector('.garment-3d')]));
 function clamp01(value){return Math.min(1,Math.max(0,value))}
 function setVarIfChanged(el,key,value){
   if(el.dataset[key]===value)return;
   el.dataset[key]=value;
   el.style.setProperty('--'+(key==='panelOpen'?'panel-open':'text-open'),value)
 }
 function onFrame(){
   frameRequested=false;
   const top=window.scrollY;
   const vh=window.innerHeight;
   const max=Math.max(1,document.documentElement.scrollHeight-vh);
   // Read all geometry before changing styles, avoiding synchronous layout during scroll.
   const rects=prefersReduced?null:new Map([...flipStages,...heroFloat,...rollPanels].map(el=>[el,el.getBoundingClientRect()]));
   progressBar.style.transform=`scaleX(${clamp01(top/max)})`;
   if(prefersReduced)return;
   for(const stage of flipStages){
     const r=rects.get(stage);
     if(r.top>vh+30||r.bottom< -30)continue;
     const travel=Math.max(1,r.height-vh);
     const t=clamp01(-r.top/travel);
     const {model,phase,detail,meter}=stageParts.get(stage);
     if(model)window.PowerPunchGarment3D?.rotate(model,(t*540-18)*Math.PI/180,Math.sin(t*Math.PI*2)*.08,Math.sin(t*Math.PI)*.02);
     meter.style.transform=`scaleX(${t.toFixed(3)})`;
     const label=t<.34?'01 / READY':t<.68?'02 / PUSH':'03 / RISE';
     if(phase&&phase.textContent!==label)phase.textContent=label;
     const note=t<.34?'Start strong.':t<.68?'Push beyond.':'Keep the momentum.';
     if(detail&&detail.textContent!==note)detail.textContent=note;
   }
   for(const el of heroFloat){
     const r=rects.get(el);
     if(r.bottom<0||r.top>vh)continue;
     const offset=clamp01(1-r.bottom/(vh+r.height));
     const model=heroModels.get(el);
     if(model)window.PowerPunchGarment3D?.rotate(model,(-12+offset*115)*Math.PI/180,(5-offset*13)*Math.PI/180,offset*.025);
   }
   for(const panel of rollPanels){
     const r=rects.get(panel);
     const start=vh*.94, end=vh*.5;
     const open=clamp01((start-r.top)/(start-end));
     const textOpen=clamp01((open-.18)/.72);
     setVarIfChanged(panel,'panelOpen',open.toFixed(2));
     setVarIfChanged(panel,'textOpen',textOpen.toFixed(2));
   }
 }
 function request(){if(!frameRequested){frameRequested=true;requestAnimationFrame(onFrame)}}
 progressBar.style.width='100%';progressBar.style.transformOrigin='left center';progressBar.style.transform='scaleX(0)';
 window.addEventListener('scroll',request,{passive:true});
 window.addEventListener('resize',request,{passive:true});
 request();
}
document.addEventListener('DOMContentLoaded', async () => {
 const grid=document.getElementById('productsGrid');
 grid.innerHTML='<p role="status">جارٍ تحميل المنتجات…</p>';
 try { await loadCatalog(); cart=readCart(); initializeCart(); initialize(); }
 catch(error) {
   console.error(error);
   grid.innerHTML='<p role="alert">تعذّر تحميل المنتجات. يرجى إعادة تحميل الصفحة والمحاولة مجدداً.</p>';
   document.querySelector('[data-bag]').disabled=true;
 }
});

function updateVariantOptions() {
 const p=products[chosen];
 const options=[...new Set(p.variants.map(v=>v.size))];
 if(!variantStock(p,chosenColor,chosenSize)) chosenSize=options.find(size=>variantStock(p,chosenColor,size)>0) || '';
 document.querySelector('.sizes').innerHTML=options.map(size=>`<button class="size" data-size="${escapeHTML(size)}" aria-pressed="${size===chosenSize}" ${variantStock(p,chosenColor,size)===0?'disabled':''}>${escapeHTML(size)}</button>`).join('');
 const buy=document.querySelector('[data-buy]');buy.disabled=!chosenSize;
 const add=document.querySelector('[data-add]');
 add.disabled=!chosenSize;
 add.textContent=chosenSize?'أضف إلى السلة ↗':'هذا اللون غير متوفر حالياً';
 updateModalStock();
}

function updateCardStock(card,p,color,index) {
 const out=colorStock(p,color)===0;
 const visual=card.querySelector('.product-visual');
 visual.classList.toggle('is-out-of-stock',out);
 visual.setAttribute('aria-label',`عرض ${p.name}${out?' — نفدت الكمية لهذا اللون':''}`);
 const amount=document.getElementById('stock-'+index);
 const badge=card.querySelector('.photo-badge');badge.hidden=productPhotos(p,color).length<2;badge.textContent=productPhotos(p,color).length+' صور';
 amount.textContent=colorStockLabel(p,color);
 amount.classList.toggle('stock-amount-empty',out);
}
function updateModalStock() {
 const p=products[chosen];
 const out=colorStock(p,chosenColor)===0;
 let amount=document.querySelector('.modal-stock');
 if(!amount) {
   amount=document.createElement('p');
   amount.className='modal-stock stock-amount';
   amount.dir='rtl';
   amount.setAttribute('aria-live','polite');
   document.querySelector('.sizes').after(amount);
 }
 amount.classList.toggle('stock-amount-empty',out);
 amount.textContent=chosenSize ? `المتوفر من ${p.colors[chosenColor][0]} / ${chosenSize}: ${variantStock(p,chosenColor,chosenSize)} قطعة` : colorStockLabel(p,chosenColor);
}
