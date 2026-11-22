let activeCategory='all';
let selectedBundle=null;
let bundleSelections=[];
let bundleReturnFocus=null;
function categoryProducts(id){
 return products.filter(p=>id==='all'||id==='offers'&&p.salePrice!==undefined||(p.categoryIds||[p.categoryId]).includes(id));
}
function bundleAvailable(offer){return offer.items.every(item=>products.find(p=>p.id===item.productId)?.variants.some(v=>v.quantity>=item.quantity));}
function makeBundleCard(offer){
 const out=!bundleAvailable(offer);
 const art=offer.items.slice(0,4).map(item=>{const p=products.find(p=>p.id===item.productId);return `<span class="bundle-tile">${productArt(p)}</span>`;}).join('');
 return `<article class="product-card bundle-card"><button class="product-visual${out?' is-out-of-stock':''}" data-offer-open="${escapeHTML(offer.id)}" aria-label="عرض باقة ${escapeHTML(offer.name)}"><span class="product-id">POWERPUNCH / OFFER</span><span class="bundle-montage">${art}</span><span class="sale-badge" dir="rtl">وفّر <bdi>${offerDiscount(offer)}%</bdi></span>${stockOverlay()}</button><div class="product-card-body" dir="rtl"><div class="product-meta"><div><div class="product-type">باقة · ${offer.items.reduce((n,i)=>n+i.quantity,0)} قطع</div><h3>${escapeHTML(offer.name)}</h3></div><div class="price" dir="ltr">${priceMarkup(offer)}</div></div><p class="bundle-summary">${offer.items.map(item=>escapeHTML(products.find(p=>p.id===item.productId).name)).join(' + ')}</p><p class="bundle-note">اختَر لون ومقاس كل قطعة</p><div class="card-actions"><button class="quick card-buy" data-offer-open="${escapeHTML(offer.id)}" data-intent="buy">شراء الباقة</button><button class="quick" data-offer-open="${escapeHTML(offer.id)}" data-intent="cart">أضف إلى السلة</button></div></div></article>`;
}
function renderShop(){
 const packages=offers.filter(o=>o.type==='package'),visible=categoryProducts(activeCategory);
 const visiblePackages=['all','offers'].includes(activeCategory)?packages:[];
 const entries=[{id:'all',name:'الكل',count:products.length+packages.length},{id:'offers',name:'العروض',count:categoryProducts('offers').length+packages.length},...categories.map(c=>({...c,count:categoryProducts(c.id).length}))];
 document.querySelector('#category-tabs').innerHTML=entries.map(c=>`<button type="button" class="category-chip${c.id==='offers'?' offers-chip':''}" data-category="${escapeHTML(c.id)}" aria-pressed="${c.id===activeCategory}"><span>${escapeHTML(c.name)}</span><span class="category-count">${c.count}</span></button>`).join('');
 document.querySelector('#catalog-count').textContent=`${visible.length+visiblePackages.length} ${activeCategory==='offers'?'عرضاً ومنتجاً':'منتجات'}`;
 const grid=document.querySelector('#productsGrid');
 grid.innerHTML=visible.map(p=>makeCard(p,products.indexOf(p))).join('')+visiblePackages.map(makeBundleCard).join('');
 if(!visible.length&&!visiblePackages.length)grid.innerHTML=`<div class="catalog-empty"><h3>${activeCategory==='offers'?'العروض القادمة بانتظارك':'لا توجد منتجات في هذا التصنيف حالياً'}</h3><p>${activeCategory==='offers'?'تابعنا لتكتشف التخفيضات والباقات الجديدة.':'يمكنك استكشاف باقي تصنيفات المتجر.'}</p><button type="button" class="quick" data-category="all">عرض كل المنتجات</button></div>`;
 grid.querySelectorAll('.reveal').forEach(card=>card.classList.add('show'));
}
function openBundle(id){
 selectedBundle=offers.find(o=>o.id===id&&o.type==='package');if(!selectedBundle)return;
 bundleReturnFocus=document.activeElement;
 bundleSelections=selectedBundle.items.flatMap(item=>Array.from({length:item.quantity},()=>{
  const p=products.find(p=>p.id===item.productId),color=Math.max(0,p.colors.findIndex((_,i)=>colorStock(p,i)>0));
  return {productId:p.id,color,size:p.variants.find(v=>v.color===color&&v.quantity>0)?.size||''};
 }));
 renderBundle();document.querySelector('#bundle-dialog').showModal();document.body.style.overflow='hidden';
}
function renderBundle(){
 const dialog=document.querySelector('#bundle-dialog');
 dialog.querySelector('.bundle-title').textContent=selectedBundle.name;
 dialog.querySelector('.bundle-price').innerHTML=priceMarkup(selectedBundle);
 dialog.querySelector('.bundle-savings').textContent=`وفّر ${formatPrice(selectedBundle.originalPrice-selectedBundle.price)} على الباقة كاملة`;
 dialog.querySelector('.bundle-components').innerHTML=bundleSelections.map((part,i)=>{
  const p=products.find(p=>p.id===part.productId),available=variantStock(p,part.color,part.size);
  return `<section class="bundle-component"><div class="bundle-component-photo">${productArt(p,part.color)}</div><div class="bundle-component-details"><h3><span>${i+1}</span> ${escapeHTML(p.name)}</h3><label for="bundle-color-${i}">اللون</label><select id="bundle-color-${i}" data-bundle-color="${i}">${p.colors.map((c,k)=>`<option value="${k}" ${k===part.color?'selected':''} ${colorStock(p,k)===0?'disabled':''}>${escapeHTML(c[0])}${colorStock(p,k)===0?' — غير متوفر':''}</option>`).join('')}</select><label for="bundle-size-${i}">المقاس</label><select id="bundle-size-${i}" data-bundle-size="${i}"><option value="" ${!part.size?'selected':''} disabled>اختر المقاس</option>${[...new Set(p.variants.map(v=>v.size))].map(size=>`<option value="${escapeHTML(size)}" ${size===part.size?'selected':''} ${variantStock(p,part.color,size)===0?'disabled':''}>${escapeHTML(size)}${variantStock(p,part.color,size)===0?' — غير متوفر':''}</option>`).join('')}</select><p class="stock-amount${available?'':' stock-amount-empty'}">${available?`المتوفر بهذا اللون والمقاس: ${available} قطعة`:'هذا الخيار غير متوفر حالياً'}</p></div></section>`;
 }).join('');
 const valid=bundleSelections.every(validSelection)&&canFulfill([{offerId:selectedBundle.id,selections:bundleSelections,quantity:1}]);
 dialog.querySelectorAll('[data-bundle-buy],[data-bundle-add]').forEach(button=>button.disabled=!valid);
}
function initializeShop(){
 renderShop();
 document.body.insertAdjacentHTML('beforeend',`<dialog id="bundle-dialog" class="bundle-dialog" dir="rtl" lang="ar" aria-labelledby="bundle-title"><div class="bundle-panel"><header class="bundle-header"><div><span class="kicker">POWERPUNCH / عرض باقة</span><h2 class="bundle-title" id="bundle-title"></h2></div><button class="cart-close" type="button" data-bundle-close aria-label="إغلاق الباقة">×</button></header><div class="price bundle-price" dir="ltr"></div><p class="bundle-savings"></p><p class="bundle-intro">الباقة بسعر واحد. اختَر لون ومقاس كل قطعة كما يناسبك.</p><div class="bundle-components"></div><div class="purchase-actions"><button class="modal-add" type="button" data-bundle-buy>شراء الباقة الآن</button><button class="modal-add secondary-add" type="button" data-bundle-add>أضف الباقة إلى السلة</button></div></div></dialog>`);
 const dialog=document.querySelector('#bundle-dialog');
 dialog.addEventListener('close',()=>{document.body.style.overflow='';bundleReturnFocus?.focus();});
 dialog.addEventListener('click',e=>{
  if(e.target===dialog||e.target.closest('[data-bundle-close]')){dialog.close();return;}
  const buy=e.target.closest('[data-bundle-buy]'),add=e.target.closest('[data-bundle-add]');if(!buy&&!add)return;
  const item={offerId:selectedBundle.id,selections:structuredClone(bundleSelections),quantity:1};
  if(buy){dialog.close();startQuickBuy(item);}else if(addOrderItem(item)){dialog.close();toast('تمت إضافة الباقة إلى السلة');}
 });
 dialog.addEventListener('change',e=>{
  const color=e.target.closest('[data-bundle-color]'),size=e.target.closest('[data-bundle-size]');
  if(color){const part=bundleSelections[Number(color.dataset.bundleColor)],p=products.find(p=>p.id===part.productId);part.color=Number(color.value);if(!variantStock(p,part.color,part.size))part.size=p.variants.find(v=>v.color===part.color&&v.quantity>0)?.size||'';const id=color.id;renderBundle();document.getElementById(id).focus();}
  if(size){bundleSelections[Number(size.dataset.bundleSize)].size=size.value;const id=size.id;renderBundle();document.getElementById(id).focus();}
 });
 document.addEventListener('click',e=>{
  const category=e.target.closest('[data-category]');if(category){activeCategory=category.dataset.category;renderShop();const selected=[...document.querySelectorAll('#category-tabs button')].find(b=>b.dataset.category===activeCategory);selected?.focus({preventScroll:true});selected?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'});return;}
  const offer=e.target.closest('[data-offer-open]');if(offer)openBundle(offer.dataset.offerOpen);
 });
}
