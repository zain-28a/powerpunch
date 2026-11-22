(()=>{
const equipment=document.body.dataset.department==='equipment';
const data=equipment?window.equipmentCatalog:window.supplementCatalog,grid=document.querySelector('.grid'),bar=document.querySelector('.category-bar');
const money=formatPrice,esc=escapeHTML;
let active='all',ready=false;
function purchaseControls(p,fieldId){const flavors=supplementFlavors(p);const hasSize=p.weights?.length>0;return `  ${equipment||(!hasSize&&!flavors.length)?'':`<div class="options${hasSize&&flavors.length ? '' : ' options-single'}">
    ${hasSize?`<div>${p.weights.length===1 ? `<span class="weight-label">الحجم / العبوة</span><span class="fixed-weight">${esc(p.weights[0])}</span>` : `<label for="weight-${esc(fieldId)}">الحجم / العبوة</label><select id="weight-${esc(fieldId)}" class="weight">${p.weights.map(x=>`<option>${esc(x)}</option>`).join('')}</select>`}</div>`:''}
    ${flavors.length ? `<div><label for="flavor-${esc(fieldId)}">النكهة</label><select id="flavor-${esc(fieldId)}" class="flavor">${flavors.map(x=>`<option>${esc(x)}</option>`).join('')}</select></div>` : ''}
  </div>`}
  <div class="actions">
    <div class="quantity-stepper" dir="ltr" role="group" aria-label="كمية ${esc(p.name)}">
      <button type="button" data-step="-1" aria-label="إنقاص الكمية" disabled>−</button>
      <output class="quantity" aria-label="الكمية" aria-live="polite">1</output>
      <button type="button" data-step="1" aria-label="زيادة الكمية">+</button>
    </div>
    <p class="variant-status" aria-live="polite"></p>
    <div class="supplement-purchase"><button type="button" class="quick card-buy" data-buy ${ready?'':'disabled'}>شراء الآن</button><button type="button" class="quick" data-add ${ready?'':'disabled'}>أضف إلى السلة</button></div>
  </div>`; }
function render(){bar.hidden=equipment;bar.innerHTML=equipment?'':[{id:'all',name:'الكل'},{id:'best-sellers',name:'الأعلى مبيعاً',en:'BEST SELLERS'},...data.categories].map(c=>`<button type="button" class="${c.id==='best-sellers'?'best-sellers':''}" data-category="${esc(c.id)}" aria-pressed="${active===c.id}">${esc(c.name)}${c.en ? `<span lang="en" dir="ltr">${esc(c.en)}</span>` : ''}</button>`).join('');const products=data.products.filter(p=>active==='all'||(active==='best-sellers'?p.bestSeller===true:p.categoryId===active));grid.innerHTML=products.map(p=>{const category=data.categories.find(c=>c.id===p.categoryId)?.en;return `<article class="card" data-id="${esc(p.id)}">
<button type="button" class="pack product-preview" data-details aria-haspopup="dialog" aria-label="تفاصيل ${esc(p.name)}">
  ${equipment&&p.demo?'<span class="equipment-demo-badge">للمعاينة</span>':''}
  ${category?`<span class="product-category" lang="en" dir="ltr">${esc(category)}</span>`:''}
  ${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">` : `<span class="product-sprite sprite-${Number(p.imageColumn)}" role="img" aria-label="${esc(p.name)}"></span>`}
</button>
<div class="card-body">
  <div class="card-heading"><h3><button type="button" data-details aria-haspopup="dialog">${esc(p.name)}</button></h3><p class="price" dir="ltr">${money(p.price)}</p></div>
  ${purchaseControls(p,p.id)}
</div></article>`}).join('')||(equipment?`<p class="empty">${ready?'ستتوفر الأدوات الرياضية قريباً.':'جارٍ تحميل الأدوات الرياضية…'}</p>`:'<p class="empty">لا توجد منتجات ضمن هذه الفئة حالياً.</p>');grid.querySelectorAll('.card').forEach(syncCard);
}
function syncCard(card){
 const p=getSupplement(card.dataset.id),weight=card.querySelector('.weight')?.value??p.weights?.[0]??'',flavor=card.querySelector('.flavor');
 const options=p.demo||equipment?[]:p.variants.filter(v=>v.weight===weight);
 if(flavor&&!p.demo){
  const previous=flavor.value;
  flavor.replaceChildren(...options.map(v=>new Option(v.flavor,v.flavor)));
  const initial=options.find(v=>v.flavor===previous)||options.find(v=>v.quantity>0)||options[0];
  if(initial)flavor.value=initial.flavor;
 }
 const preview=equipment&&p.demo;
 const limit=preview?0:equipment?MAX_QUANTITY:p.demo?5:Math.min(MAX_QUANTITY,options.find(v=>v.flavor===(flavor?.value??''))?.quantity??0);
 const counter=card.querySelector('.quantity');
 counter.value=String(Math.min(Math.max(1,limit),Math.max(1,Number(counter.value))));
 card.dataset.limit=limit;
 card.querySelector('[data-step="-1"]').disabled=Number(counter.value)<=1;
 card.querySelector('[data-step="1"]').disabled=Number(counter.value)>=limit;
 card.querySelectorAll('[data-add],[data-buy]').forEach(button=>button.disabled=!ready||!limit);
 card.querySelector('.variant-status').textContent=preview?'غير متاح للطلب':limit?'':'غير متوفر حالياً';
}

bar.addEventListener('click',e=>{
 const button=e.target.closest('[data-category]');if(!button)return;
 active=button.dataset.category;render();bar.querySelector(`[data-category="${CSS.escape(active)}"]`).focus({preventScroll:true});
});
const dialog=document.createElement('dialog');
dialog.id='catalog-product-dialog';
dialog.setAttribute('aria-labelledby','catalog-product-title');
const viewer=document.createElement('dialog');
viewer.id='catalog-photo-viewer';
viewer.setAttribute('aria-label','عارض صور المنتج');
document.body.append(dialog,viewer);
let returnFocus;
function photoMarkup(p,src){return src?`<img src="${esc(src)}" alt="${esc(p.name)}" draggable="false">`:`<span class="product-sprite sprite-${Number(p.imageColumn)}" role="img" aria-label="${esc(p.name)}"></span>`;}
function openDetails(card,trigger){
 const p=getSupplement(card.dataset.id);
 const photos=[...new Set([p.image,...(Array.isArray(p.images)?p.images:[])].filter(Boolean))];
 returnFocus=trigger;
 dialog.innerHTML=`<div class="catalog-detail-panel" data-id="${esc(p.id)}">
 <section class="catalog-gallery" aria-label="صور المنتج">
 <button type="button" class="catalog-detail-close" data-detail-close aria-label="إغلاق التفاصيل" autofocus>×</button>
 ${galleryMarkup(p,photos,true)}
 </section>
 <section class="catalog-detail-copy"><p class="eyebrow" lang="en" dir="ltr">POWERPUNCH / ${equipment?'EQUIPMENT':'SUPPLEMENTS'}</p>
 <h2 id="catalog-product-title">${esc(p.name)}</h2><p class="price" dir="ltr">${money(p.price)}</p>
 ${p.description?`<p class="catalog-detail-description">${esc(p.description)}</p>`:''}
 ${purchaseControls(p,'detail-'+p.id)}</section></div>`;
 const panel=dialog.firstElementChild;
 const weight=panel.querySelector('.weight'),flavor=panel.querySelector('.flavor');
 if(weight)weight.value=card.querySelector('.weight').value;
 if(flavor){syncCard(panel);flavor.value=card.querySelector('.flavor').value;}
 panel.querySelector('.quantity').value=card.querySelector('.quantity').value;
 syncCard(panel);
 const track=wireGallery(dialog,photos.length);
 track.addEventListener('click',event=>{
  const button=event.target.closest('[data-enlarge-photo]');
  if(button)openPhotoViewer(p,photos,Number(button.dataset.enlargePhoto));
 });
 dialog.showModal();dialog.scrollTop=0;track.dispatchEvent(new Event('scroll'));document.body.style.overflow='hidden';
}
function galleryMarkup(p,photos,enlarge=false){
 return `<div class="catalog-gallery-track" dir="ltr" tabindex="${photos.length>1?'0':'-1'}">${(photos.length?photos:[null]).map((src,i)=>`<div class="catalog-gallery-slide">${enlarge?`<button type="button" data-enlarge-photo="${i}" aria-label="تكبير الصورة ${i+1}">${photoMarkup(p,src)}</button>`:photoMarkup(p,src)}</div>`).join('')}</div>
 ${photos.length>1?'<div class="catalog-gallery-controls" dir="ltr"><button type="button" data-photo="-1" aria-label="الصورة السابقة">←</button><button type="button" data-photo="1" aria-label="الصورة التالية">→</button></div>':''}`;
}
function wireGallery(root,count){
 const track=root.querySelector('.catalog-gallery-track');
 const arrows=[...root.querySelectorAll('[data-photo]')];
 const current=()=>Math.round(track.scrollLeft/(track.clientWidth||1));
 track.addEventListener('scroll',()=>{
  if(arrows.length){arrows[0].disabled=current()<=0;arrows[1].disabled=current()>=count-1;}
 },{passive:true});
 function move(step){track.scrollTo({left:(current()+step)*track.clientWidth,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
 arrows.forEach(btn=>btn.addEventListener('click',()=>move(Number(btn.dataset.photo))));
 track.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();move(e.key==='ArrowLeft'?-1:1);}});
 return track;
}
function openPhotoViewer(p,photos,index){
 const legacy=photos.map(src=>p.photoCaptions?.[src]).find(value=>typeof value==='string'&&value.trim());
 const caption=Object.hasOwn(p,'photoCaption')?p.photoCaption:legacy;
 viewer.innerHTML=`<div class="catalog-photo-viewer-panel">
 <button type="button" class="catalog-detail-close" data-viewer-close aria-label="إغلاق الصورة المكبّرة" autofocus>×</button>
 ${galleryMarkup(p,photos)}
 ${typeof caption==='string'&&caption.trim()?`<p class="catalog-photo-caption" dir="auto">${esc(caption)}</p>`:''}
 </div>`;
 const track=wireGallery(viewer,photos.length);
 viewer.showModal();viewer.scrollTop=0;
 track.scrollTo({left:index*track.clientWidth,behavior:'instant'});track.dispatchEvent(new Event('scroll'));
}
viewer.addEventListener('click',event=>{if(event.target===viewer||event.target.closest('[data-viewer-close]'))viewer.close();});

dialog.addEventListener('close',()=>{if(!document.querySelector('#cart-dialog')?.open){document.body.style.overflow='';returnFocus?.focus();}});
function handlePurchase(e,container){
 const counter=container.querySelector('.quantity'),step=e.target.closest('[data-step]');
 if(step&&!step.disabled){
  counter.value=String(Number(counter.value)+Number(step.dataset.step));syncCard(container);return;
 }
 const action=e.target.closest('[data-add],[data-buy]');if(!ready||!action||action.disabled)return;
 const product=getSupplement(container.dataset.id);
 const item={supplementId:product.id,weight:container.querySelector('.weight')?.value??product.weights?.[0]??'',flavor:container.querySelector('.flavor')?.value??'',quantity:Number(counter.value)};
 if(equipment&&product.demo)return;
 if(action.hasAttribute('data-buy')){
  if(dialog.open){dialog.close();returnFocus?.focus();}
  startQuickBuy(item);
 }else if(addOrderItem(item)){if(dialog.open)dialog.close();toast('تمت الإضافة إلى السلة');}
}
grid.addEventListener('change',e=>{const card=e.target.closest('.card');if(card)syncCard(card);});
grid.addEventListener('click',e=>{
 const card=e.target.closest('.card');if(!card)return;
 const trigger=e.target.closest('[data-details]');
 if(trigger||!e.target.closest('button,select,label,.actions,.options')){openDetails(card,trigger||card.querySelector('[data-details]'));return;}
 handlePurchase(e,card);
});
dialog.addEventListener('change',()=>syncCard(dialog.firstElementChild));
dialog.addEventListener('click',e=>{
 if(e.target===dialog||e.target.closest('[data-detail-close]')){dialog.close();return;}
 handlePurchase(e,dialog.firstElementChild);
});
const bag=document.querySelector('[data-bag]');
bag.addEventListener('click',openCart);
render();
loadCatalog().then(()=>{
 cart=readCart();initializeCart({social:false});ready=true;bag.disabled=false;
 document.querySelector('.example-note').hidden=!data.products.some(p=>p.demo);
 render();
}).catch(()=>{
 const note=document.querySelector('.example-note');note.hidden=false;note.textContent='تعذّر تحميل السلة. حدّث الصفحة للمحاولة مرة أخرى.';
});
})();
