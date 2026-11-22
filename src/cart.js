const CART_KEY = 'powerpunch.cart.v1';
const MAX_QUANTITY = 99;
let discountCode='';
const DISCOUNT_KEY='powerpunch.discount.v1';
let discountState=null,discountTimer,discountTyping,discountSending=false;
const discountLines=(items)=>items.map(item=>item.offerId?{kind:'bundle',id:item.offerId,quantity:item.quantity}:item.supplementId?{kind:getSupplement(item.supplementId)?.department==='equipment'?'equipment':'supplements',id:item.supplementId,quantity:item.quantity}:{kind:'clothes',id:item.productId,quantity:item.quantity});
const discountRequest=(items)=>({code:discountCode,lines:discountLines(items)});
function storeDiscount(code){try{if(code)localStorage.setItem(DISCOUNT_KEY,code);else localStorage.removeItem(DISCOUNT_KEY);}catch{}}
function discountError(reason){return ({invalid_code:'الكود غير صالح أو انتهت صلاحيته.',invalid_items:'الأسعار أو المنتجات تغيّرت. حدّث الصفحة وحاول من جديد.',invalid_request:'تحقّق من الكود ومحتويات السلة.'})[reason]||'ما قدرنا نتحقق من الكود. جرّب مرة تانية أو أزله للمتابعة.';}
async function requestDiscount(body,items){
 const r=await ppFetch('/api/discount/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
 const quote=await r.json();
 if(quote.error)return quote;
 if(!r.ok||quote.code!==body.code||quote.subtotalCents!==Math.round(orderTotal(items)*100)||!Number.isSafeInteger(quote.discountCents)||quote.discountCents<0||quote.totalCents!==quote.subtotalCents-quote.discountCents||!Number.isFinite(quote.expiresAt))return {error:'invalid_items'};
 return quote;
}
function renderDiscount(){
 const box=document.querySelector('#cart-discount');if(!box)return;
 const items=activeOrder(),eligible=items.length>0&&!cartHasDemo(items),result=discountState?.result;
 box.hidden=!eligible;
 const amount=eligible&&result?.discountCents>0?result.discountCents:0;
 document.querySelector('#cart-discount-summary').hidden=!amount;
 document.querySelector('#cart-subtotal-value').textContent=formatPrice(orderTotal(items));
 document.querySelector('#cart-discount-value').textContent='− '+formatPrice(amount/100);
 document.querySelector('#cart-total').textContent=formatPrice(orderTotal(items)-amount/100);
 const status=document.querySelector('#cart-code-status');
 status.textContent=!eligible?'':discountState?.message??(result?.error?discountError(result.error):result?(amount?'تم تطبيق الخصم.':'الكود صالح، بس ما في منتجات مشمولة بهالطلب.'):discountState?'عم نتحقق من الكود…':'');
 document.querySelector('#cart-code-remove').hidden=!discountCode;
 document.querySelector('#cart-checkout').disabled=!items.length||!whatsappUrl()||!canFulfill(items)||cartHasDemo(items)||discountSending||Boolean(discountCode&&(!result||result.error));
}
function refreshDiscount({force=false}={}){
 const items=activeOrder();
 if(!discountCode||!items.length||cartHasDemo(items)){discountState=null;renderDiscount();return;}
 const body=discountRequest(items),key=JSON.stringify(body);
 if(!force&&discountState?.key===key){renderDiscount();return;}
 clearTimeout(discountTimer);const pending={key};discountState=pending;renderDiscount();
 requestDiscount(body,items).catch(()=>({error:'network'})).then(result=>{
  if(discountState!==pending)return;
  pending.result=result;
  if(!result.error){
   storeDiscount(result.code);
   discountTimer=setTimeout(()=>{discountState=null;refreshDiscount();},Math.min(2147483647,Math.max(100,result.expiresAt-Date.now()+100)));
  }else if(result.error==='invalid_code')storeDiscount('');
  renderDiscount();
 });
}
function applyDiscount(){
 clearTimeout(discountTyping);
 const field=document.querySelector('#cart-code');const code=field.value.trim().toUpperCase();
 if(!code){field.focus();return;}
 if(!/^PP[A-F0-9]{12}$/.test(code)){
  document.querySelector('#cart-code-status').textContent='تحقّق من كتابة الكود وحاول مرة تانية.';return;
 }
 field.value=code;
 if(code!==discountCode)storeDiscount('');
 discountCode=code;refreshDiscount({force:true});
}

const cartKey = item => item.supplementId?`supplement:${JSON.stringify([item.supplementId,item.weight,item.flavor])}`:item.offerId?`offer:${item.offerId}:`+item.selections.map(part=>`${part.productId}:${part.color}:${part.size}`).join('|'):`${item.productId}:${item.color}:${item.size}`;
function getSupplement(id){return window.supplementCatalog?.products.find(p=>p.id===id)??window.equipmentCatalog?.products.find(p=>p.id===id);}
function supplementFlavors(product){return Array.isArray(product.flavors)?product.flavors.filter(f=>typeof f==='string'&&f.trim()):[];}
function cartHasDemo(items){return items.some(item=>item.supplementId&&getSupplement(item.supplementId)?.demo===true);}
function supplementArt(p){return p.image?`<img src="${escapeHTML(p.image)}" alt="">`:`<span class="product-sprite sprite-${Number(p.imageColumn)}" aria-hidden="true"></span>`;}
function lineParts(item) {
 if(item.offerId) return item.selections||[];
 return [{productId:item.productId,color:item.color,size:item.size}];
}
function linePrice(item) {
 if(item.supplementId)return getSupplement(item.supplementId)?.price||0;
 if(item.offerId)return offers.find(o=>o.id===item.offerId)?.price||0;
 const p=products.find(p=>p.id===item.productId);return p?productPrice(p):0;
}
function orderTotal(items){return items.reduce((sum,item)=>sum+Math.round(linePrice(item)*100)*item.quantity,0)/100;}
function orderPieceCount(items){return items.reduce((sum,item)=>sum+(item.supplementId?1:lineParts(item).length)*item.quantity,0);}
function validSelection(item){const p=products.find(p=>p.id===item?.productId);return p&&Number.isInteger(item.color)&&p.colors[item.color]&&p.variants.some(v=>v.color===item.color&&v.size===item.size);}
function normalizeCart(value) {
 if(!Array.isArray(value))return [];
 const merged=new Map();
 for(const item of value){
  if(!item||!Number.isInteger(item.quantity)||item.quantity<1)continue;
  let clean;
  if(item.supplementId){
   const p=getSupplement(item.supplementId),flavor=item.flavor??'',weight=item.weight??'';
   if(!p)continue;
   if(p.department==='equipment'){
    if((item.weight??'')!==''||flavor!=='')continue;
   } else {
   if(p.weights?.length?!p.weights.includes(weight):weight!=='')continue;
   const flavors=supplementFlavors(p);
   if(flavors.length?!flavors.includes(flavor):flavor!=='')continue;
   if(!p.demo&&!p.variants?.some(v=>v.weight===weight&&v.flavor===flavor))continue;
   }
   clean={supplementId:p.id,weight:item.weight??'',flavor,quantity:item.quantity};
  }else if(item.offerId){
   const offer=offers.find(o=>o.id===item.offerId&&o.type==='package');
   const expected=offer?.items.flatMap(part=>Array(part.quantity).fill(part.productId));
   if(!expected||!Array.isArray(item.selections)||item.selections.length!==expected.length||item.selections.some((part,i)=>part.productId!==expected[i]||!validSelection(part)))continue;
   clean={offerId:offer.id,selections:item.selections.map(({productId,color,size})=>({productId,color,size})),quantity:item.quantity};
  }else{if(!validSelection(item))continue;clean={productId:item.productId,color:item.color,size:item.size,quantity:item.quantity};}
  const key=cartKey(clean),previous=merged.get(key);
  merged.set(key,{...clean,quantity:Math.min(MAX_QUANTITY,(previous?.quantity||0)+clean.quantity)});
 }
 return [...merged.values()];
}
function canFulfill(items){
 const totals=new Map();
 const supplementTotals=new Map();
 for(const item of items){
  if(item.supplementId){
   if(!normalizeCart([item]).length||item.quantity>MAX_QUANTITY)return false;
   const p=getSupplement(item.supplementId),key=cartKey(item),quantity=(supplementTotals.get(key)||0)+item.quantity;
   if(quantity>MAX_QUANTITY||(!p.demo&&p.department!=='equipment'&&quantity>p.variants.find(v=>v.weight===(item.weight??'')&&v.flavor===(item.flavor??'')).quantity))return false;
   supplementTotals.set(key,quantity);continue;
  }
  for(const part of lineParts(item)){if(!validSelection(part))return false;const key=`${part.productId}:${part.color}:${part.size}`;totals.set(key,{...part,quantity:(totals.get(key)?.quantity||0)+item.quantity});}
 }
 return [...totals.values()].every(part=>part.quantity<=variantStock(products.find(p=>p.id===part.productId),part.color,part.size));
}
function readCart() {
  try { return normalizeCart(JSON.parse(localStorage.getItem(CART_KEY) || '[]')); }
  catch { return []; }
}
let cart = []; // Restored only after the database catalog has loaded.
let cartReturnFocus;
let quickOrder=null;
const activeOrder=()=>quickOrder||cart;
const cartTotal = () => orderTotal(cart);
function persistCart() {
  try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }
  catch { toast('تعذّر حفظ السلة على هذا الجهاز. يمكنك متابعة طلبك خلال هذه الزيارة.'); }
  renderCart();
}
function addOrderItem(item){
 const [clean]=normalizeCart([item]);
 if(!clean){toast(item.supplementId?'هذا المنتج غير متوفر حالياً':'اختر لوناً ومقاساً متوفرين');return false;}
 const next=normalizeCart([...cart,clean]);
 const previous=cart.find(line=>cartKey(line)===cartKey(clean));
 if((previous?.quantity||0)+item.quantity>MAX_QUANTITY||!next.length||!canFulfill(next)){toast(item.supplementId?'الكمية المطلوبة غير متوفرة':'الكمية المطلوبة غير متوفرة لهذا اللون والمقاس');return false;}
 cart=next;persistCart();return true;
}
function addToCart(productId,color,size){return addOrderItem({productId,color,size,quantity:1});}
function startQuickBuy(item){
 const next=normalizeCart([{...item,quantity:item.quantity??1}]);
 if(!next.length||!canFulfill(next)){toast('هذا الخيار غير متوفر حالياً');return false;}
 quickOrder=next;cartReturnFocus=document.activeElement;renderCart();document.querySelector('#cart-dialog').showModal();document.body.style.overflow='hidden';return true;
}
const supplementDetails=(item)=>[item.weight?'الحجم / العبوة: '+item.weight:'',item.flavor?'النكهة: '+item.flavor:''].filter(Boolean);
function buildOrderMessage(customer={},items=cart,discount=null){
 return [`مرحباً ${storeConfig.name}، أود طلب المنتجات التالية:`, '', ...items.map((item,index)=>{
  if(item.supplementId){
   const p=getSupplement(item.supplementId);
   const details=supplementDetails(item);
   const option=details.length?details.join(' | ')+'\n':'';
   return `${index+1}. ${p.name} (${p.department==='equipment'?'E':'S'}/${p.id})\n${option}الكمية: ${item.quantity} | سعر القطعة: ${formatPrice(linePrice(item))} | المجموع: ${formatPrice(linePrice(item)*item.quantity)}`;
  }
  const label=item.offerId?offers.find(o=>o.id===item.offerId).name:products.find(p=>p.id===item.productId).name;
  const details=lineParts(item).map(part=>{const p=products.find(p=>p.id===part.productId);return `${item.offerId?p.name+' ':''}(P/${p.id})\nاللون: ${p.colors[part.color][0]} | المقاس: ${part.size}`;}).join('\n');
  return `${index+1}. ${item.offerId?'باقة: ':''}${label}\n${details}\n${item.offerId?'عدد الباقات':'الكمية'}: ${item.quantity} | ${item.offerId?'سعر الباقة':'سعر القطعة'}: ${formatPrice(linePrice(item))} | المجموع: ${formatPrice(linePrice(item)*item.quantity)}`;
 }), '', `عدد القطع: ${orderPieceCount(items)}`,`إجمالي المنتجات: ${formatPrice(orderTotal(items))}`,...(discount?.discountCents>0?[`كود الخصم: ${discount.code}`,`قيمة الخصم: ${formatPrice(discount.discountCents/100)}`,`الإجمالي بعد الخصم: ${formatPrice(discount.totalCents/100)}`]:[]),...deliveryMessageLines(customer.deliveryCenter,customer),...(customer.name?.trim()?[`الاسم: ${customer.name.trim()}`]:[]),...(customer.city?.trim()?[`المدينة / المنطقة: ${customer.city.trim()}`]:[]),...(customer.phone?.trim()?[`رقم الهاتف: ${customer.phone.trim()}`]:[]),...(customer.notes?.trim()?[`ملاحظات: ${customer.notes.trim()}`]:[]),'','يرجى تأكيد توفر المنتجات والسعر النهائي وتكلفة التوصيل وتفاصيل الدفع لإتمام الطلب.'].join('\n');
}
function whatsappUrl(message = '') {
  const number = storeConfig.whatsappNumber.replace(/[\s()+-]/g, '');
  if (!/^[1-9]\d{6,14}$/.test(number)) return null;
  return `https://wa.me/${number}${message ? '?text=' + encodeURIComponent(message) : ''}`;
}
function renderCart(){
 document.querySelectorAll('.bag-count').forEach(el=>el.textContent=orderPieceCount(cart));
 document.querySelectorAll('[data-bag]').forEach(el=>el.setAttribute('aria-label',`سلة التسوق، ${orderPieceCount(cart)} قطعة`));
 const list=document.querySelector('#cart-items');if(!list)return;
 const items=activeOrder();document.querySelector('#cart-title').textContent=quickOrder?'إتمام الشراء المباشر':'سلة التسوق';
 list.innerHTML=items.length?items.map(item=>{
  const key=cartKey(item),parts=lineParts(item),supplement=item.supplementId?getSupplement(item.supplementId):null,p=supplement||products.find(p=>p.id===parts[0].productId);
  const name=item.offerId?offers.find(o=>o.id===item.offerId).name:p.name;
  const options=supplement?[...supplementDetails(item),...(supplement.demo?['منتج معاينة']:[])]:[];
  const details=supplement?(options.length?`<p>${escapeHTML(options.join(' · '))}</p>`:''):parts.map(part=>{const product=products.find(p=>p.id===part.productId);return `<p>${item.offerId?escapeHTML(product.name)+' · ':''}${escapeHTML(product.colors[part.color][0])} · <bdi>${escapeHTML(part.size)}</bdi></p>`;}).join('');
  const increased=items.map(line=>line===item?{...line,quantity:line.quantity+1}:line);
  return `<article class="cart-item"><div class="cart-art">${supplement?supplementArt(supplement):productArt(p,parts[0].color)}</div><div class="cart-item-info"><h3>${item.offerId?'باقة: ':''}${escapeHTML(name)}</h3>${details}<p>${item.offerId?'سعر الباقة':'سعر القطعة'}: <bdi>${formatPrice(linePrice(item))}</bdi></p><div class="cart-controls"><button type="button" data-quantity="${escapeHTML(key)}" data-delta="-1" aria-label="تقليل الكمية" ${item.quantity===1?'disabled':''}>−</button><span aria-label="الكمية">${item.quantity}</span><button type="button" data-quantity="${escapeHTML(key)}" data-delta="1" aria-label="زيادة الكمية" ${item.quantity>=MAX_QUANTITY||!canFulfill(increased)?'disabled':''}>+</button><button type="button" class="cart-remove" data-remove="${escapeHTML(key)}">حذف</button></div></div><strong dir="ltr">${formatPrice(linePrice(item)*item.quantity)}</strong></article>`;
 }).join(''):'<div class="cart-empty"><p>سلتك فارغة</p><p>اختر منتجاتك المفضلة وأضفها إلى السلة.</p><button type="button" class="cta" data-close-cart>متابعة التسوق ↗</button></div>';
 document.querySelector('#cart-total').textContent=formatPrice(orderTotal(items));
 const unavailable=!canFulfill(items),demo=cartHasDemo(items);
 document.querySelector('#cart-checkout').disabled=!items.length||!whatsappUrl()||unavailable||demo;
 document.querySelector('#cart-demo-note').hidden=!demo;
 document.querySelector('#cart-stock-note').hidden=!unavailable;
 document.querySelector('#cart-order-fields').hidden=!items.length;
 document.querySelector('#cart-config-note').hidden=Boolean(whatsappUrl())||!items.length;
 refreshDiscount();
}
function openCart() {
  quickOrder=null;
  cartReturnFocus = document.activeElement;
  renderCart();
  document.querySelector('#cart-dialog').showModal();
  document.body.style.overflow = 'hidden';
}
function closeCart() { document.querySelector('#cart-dialog').close(); }
function initializeCart({social=true}={}) {
  document.body.insertAdjacentHTML('beforeend', `<dialog id="cart-dialog" class="cart-dialog" dir="rtl" lang="ar" aria-labelledby="cart-title"><div class="cart-panel"><header class="cart-header"><div><span class="kicker">POWERPUNCH / إتمام الطلب</span><h2 id="cart-title">سلة التسوق</h2></div><button type="button" class="cart-close" data-close-cart aria-label="إغلاق السلة">×</button></header><div id="cart-items"></div><p id="cart-stock-note" class="cart-config-note" role="status" hidden>بعض الكميات المطلوبة غير متوفرة. يرجى تقليل الكمية أو حذف المنتج قبل المتابعة.</p><p id="cart-demo-note" class="cart-config-note" role="status" hidden>المكملات الحالية للمعاينة. لإرسال طلب حقيقي، احذف منتجات المعاينة من السلة.</p><form id="cart-form"><div id="cart-discount" class="cart-discount" hidden><label for="cart-code">عندك كود خصم؟</label><div class="cart-code-row"><input id="cart-code" dir="ltr" maxlength="24" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="POWER PUNCH"><button type="button" id="cart-code-apply">تطبيق</button><button type="button" id="cart-code-remove" hidden>إزالة</button></div><p id="cart-code-status" class="cart-hint" role="status"></p></div><div id="cart-order-fields"><h3 class="checkout-section-title"><bdi>01</bdi> التوصيل والاستلام</h3><p class="cart-hint">بحلب واللاذقية يمكنك الاستلام من مركزنا أو اختيار التوصيل. لباقي المناطق اختر مركز القدموس.</p><label for="delivery-region">المحافظة / المنطقة</label><select id="delivery-region" name="deliveryRegion" required><option value="">اختر المنطقة</option></select><div id="kadmous-fields"><label for="delivery-center">مركز القدموس للاستلام</label><select id="delivery-center" name="deliveryCenter" required disabled><option value="">اختر المنطقة أولاً</option></select><p id="delivery-center-details" class="cart-hint" aria-live="polite"></p></div><div id="local-delivery-fields" hidden><label for="local-delivery-method">طريقة الاستلام</label><select id="local-delivery-method" name="localMethod" disabled><option value="">اختر طريقة الاستلام</option><option value="pickup">استلام من مركزنا</option><option value="delivery">توصيل إلى عنواني</option></select><p id="local-center-details" class="cart-hint" aria-live="polite"></p><div id="delivery-address-fields" hidden><label for="delivery-address">عنوان التوصيل بالتفصيل (مطلوب)</label><textarea id="delivery-address" name="address" maxlength="500" rows="2" disabled placeholder="الحي، الشارع، البناء، الطابق وأقرب نقطة دالة"></textarea></div></div><p id="other-center-hint" class="cart-hint">لم تجد مركزك؟ اكتب اسم المركز في الملاحظات للتأكيد مع فريقنا.</p><h3 class="checkout-section-title"><bdi>02</bdi> بيانات التواصل</h3><label for="customer-name">الاسم الثلاثي (مطلوب)</label><input id="customer-name" name="name" autocomplete="name" maxlength="100" required placeholder="الاسم واسم الأب والكنية"><label for="customer-phone">رقم الهاتف (مطلوب)</label><input id="customer-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="22" required placeholder="09xxxxxxxx"><label for="customer-notes">ملاحظات الطلب (اختياري)</label><textarea id="customer-notes" name="notes" rows="2" maxlength="500"></textarea></div><div class="checkout-footer"><div id="cart-discount-summary" hidden><div><span>إجمالي المنتجات</span><bdi id="cart-subtotal-value"></bdi></div><div><span>قيمة الخصم</span><bdi id="cart-discount-value"></bdi></div></div><div class="cart-total"><span>إجمالي الطلب</span><strong id="cart-total" dir="ltr"></strong></div><p class="cart-hint">يؤكد فريقنا التوفر وتكلفة التوصيل والدفع عبر واتساب. اضغط إرسال داخل واتساب لإرسال طلبك.</p><p id="cart-config-note" class="cart-config-note" role="status">الطلب عبر واتساب غير متاح حالياً. سيتم تفعيله بعد إضافة رقم المتجر.</p><button id="cart-checkout" class="modal-add" type="submit">إرسال الطلب عبر واتساب ↗</button></div></form></div></dialog>`);
  const dialog = document.querySelector('#cart-dialog');
  const codeField=dialog.querySelector('#cart-code');
  try{discountCode=localStorage.getItem(DISCOUNT_KEY)||'';}catch{}
  codeField.value=discountCode;
  codeField.addEventListener('input',()=>{clearTimeout(discountTyping);if(/^PP[A-F0-9]{12}$/i.test(codeField.value.trim())&&codeField.value.trim().toUpperCase()!==discountCode)discountTyping=setTimeout(applyDiscount,350);});
  codeField.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyDiscount();}});
  dialog.querySelector('#cart-code-apply').addEventListener('click',applyDiscount);
  dialog.querySelector('#cart-code-remove').addEventListener('click',()=>{clearTimeout(discountTimer);clearTimeout(discountTyping);discountCode='';discountState=null;codeField.value='';storeDiscount('');renderDiscount();codeField.focus();});
  dialog.addEventListener('click', event => {
    if (event.target === dialog || event.target.closest('[data-close-cart]')) closeCart();
    const control = event.target.closest('[data-quantity], [data-remove]');
    if (!control) return;
    const key = control.dataset.quantity || control.dataset.remove;
    let items=activeOrder();
    if(control.hasAttribute('data-remove'))items=items.filter(item=>cartKey(item)!==key);
    else {const next=items.map(item=>cartKey(item)===key?{...item,quantity:Math.max(1,Math.min(MAX_QUANTITY,item.quantity+Number(control.dataset.delta)))}:item);if(Number(control.dataset.delta)<0||canFulfill(next))items=next;}
    if(quickOrder){quickOrder=items;renderCart();}else{cart=items;persistCart();}
    const replacement = [...dialog.querySelectorAll('[data-quantity], [data-remove]')].find(el => (el.dataset.quantity || el.dataset.remove) === key && el.dataset.delta === control.dataset.delta && !el.disabled);
    (replacement || dialog.querySelector('.cart-close')).focus();
  });
  dialog.addEventListener('close', () => { document.body.style.overflow = ''; quickOrder=null;cartReturnFocus?.focus(); });
  document.querySelector('#cart-form').addEventListener('submit', async event => {
    event.preventDefault();
    const items=activeOrder();if(!items.length||!canFulfill(items)||cartHasDemo(items)||discountSending)return;
    const customer = Object.fromEntries(new FormData(event.currentTarget));
    const problem=customerProblem(customer);if(problem){document.querySelector(problem.field).setCustomValidity(problem.message);document.querySelector(problem.field).reportValidity();return;}
    if(!localCity(customer.deliveryRegion)&&!getDeliveryCenter(customer.deliveryCenter)&&customer.deliveryCenter!=='other')return;
    if(customer.deliveryCenter==='other' && !customer.notes?.trim()){document.querySelector('#customer-notes').focus();return;}
    if(/^PP[A-F0-9]{12}$/i.test(codeField.value.trim())&&codeField.value.trim().toUpperCase()!==discountCode){applyDiscount();codeField.focus();return;}
    if(discountCode){
      const body=discountRequest(items),previous=discountState?.result;
      if(!previous||previous.error)return;
      discountSending=true;renderDiscount();
      const latest=await requestDiscount(body,items).catch(()=>({error:'network'}));
      discountSending=false;
      if(!dialog.open||JSON.stringify(discountRequest(activeOrder()))!==JSON.stringify(body)){renderDiscount();return;}
      discountState={key:JSON.stringify(body),result:latest};
      if(latest.error||latest.discountCents!==previous.discountCents||latest.totalCents!==previous.totalCents){
        if(latest.error==='invalid_code')storeDiscount('');
        if(!latest.error)discountState.message='تغيّر الخصم. راجع الإجمالي واضغط إرسال الطلب من جديد.';
        renderDiscount();return;
      }
      renderDiscount();
      const discountedUrl=whatsappUrl(buildOrderMessage(customer,items,latest));
      if(discountedUrl)location.assign(discountedUrl);
      return;
    }
    const url = whatsappUrl(buildOrderMessage(customer,items));
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    // Retain the cart: opening WhatsApp does not confirm that an order was sent.
  });
  for(const selector of ['#customer-name','#customer-phone'])document.querySelector(selector).addEventListener('input',()=>{const fields=Object.fromEntries(new FormData(document.querySelector('#cart-form')));const problem=customerProblem(fields);for(const id of ['#customer-name','#customer-phone'])document.querySelector(id).setCustomValidity(problem?.field===id?problem.message:'');});
  initializeDeliveryMenu();
  if(social)initializeSocialLinks();
  renderCart();
}
function initializeSocialLinks() {
  const icons = {
    Facebook: '<path d="M14 21v-8h3l.5-4H14V7c0-1 .3-2 2-2h2V1.5A25 25 0 0 0 15 1c-3 0-5 2-5 5v3H7v4h3v8z" fill="currentColor" stroke="none"/>',
    Instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>',
    WhatsApp: '<path d="M20.5 11.8a8.5 8.5 0 0 1-12.6 7.5L3 21l1.6-5A8.5 8.5 0 1 1 20.5 11.8Z"/><path d="M8 7c-2 3 3 8 6 9l2-2-3-1-1 1-3-3 1-1-1-3Z"/>'
  };
  const links = { Facebook: storeConfig.facebookUrl, Instagram: storeConfig.instagramUrl, WhatsApp: storeConfig.whatsappContactUrl || whatsappUrl() };
  const nav = document.createElement('nav');
  nav.className = 'social-links';
  nav.setAttribute('aria-label', 'Follow PowerPunch');
  for (const [name, icon] of Object.entries(icons)) {
    let url = links[name];
    try { if (new URL(url).protocol !== 'https:') url = null; } catch { url = null; }
    const el = document.createElement(url ? 'a' : 'button');
    el.className = 'social-link';
    el.setAttribute('aria-label', name);
    el.title = name;
    el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7">${icon}</svg>`;
    if (url) { el.href = url; el.target = '_blank'; el.rel = 'noopener noreferrer'; }
    else { el.type = 'button'; el.title = `${name} — account coming soon`; el.addEventListener('click', () => toast(`سيتم إضافة حساب ${name} قريباً`)); }
    nav.append(el);
  }
  document.querySelector('.topbar .brand-logo').after(nav);
}
window.addEventListener('storage', event => { if (event.key === CART_KEY || event.key === null) { cart = readCart(); renderCart(); } });
// initializeCart is called after loadCatalog succeeds.

function getDeliveryCenter(id) {
 return deliveryDirectory.centers.find(center=>center.id===id);
}
function localCity(region){return /اللاذقية/.test(region||'')?'اللاذقية':/حلب/.test(region||'')?'حلب':null;}
function customerProblem(customer){
 const names=(customer.name||'').trim().split(/\s+/).filter(Boolean);
 if(names.length<3||names.some(name=>!/^\p{L}[\p{L}\p{M}ّـ'-]*$/u.test(name)))return {field:'#customer-name',message:'يرجى إدخال الاسم الثلاثي: الاسم واسم الأب والكنية.'};
 const phone=(customer.phone||'').replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[\s()-]/g,'');
 if(!/^\+?\d{9,15}$/.test(phone))return {field:'#customer-phone',message:'يرجى إدخال رقم هاتف صحيح مع رمز البلد عند الحاجة.'};
 if(localCity(customer.deliveryRegion)&&!['pickup','delivery'].includes(customer.localMethod))return {field:'#local-delivery-method',message:'اختر استلاماً من المركز أو توصيلاً إلى عنوانك.'};
 if(localCity(customer.deliveryRegion)&&customer.localMethod==='delivery'&&(customer.address||'').trim().length<8)return {field:'#delivery-address',message:'يرجى إدخال عنوان التوصيل بالتفصيل.'};
 return null;
}
function deliveryMessageLines(id,customer={}) {
 const city=localCity(customer.deliveryRegion);
 if(city)return [`المدينة: ${city}`,customer.localMethod==='delivery'?'طريقة الاستلام: توصيل من مركز PowerPunch إلى عنوان الزبون':'طريقة الاستلام: استلام من مركز PowerPunch',...(customer.localMethod==='delivery'?[`عنوان التوصيل: ${customer.address?.trim()||''}`]:[`مركز الاستلام: PowerPunch — ${city}`,`عنوان المركز: ${storeConfig.localCenters?.[city]||'يؤكد مع فريق المتجر'}`])];
 if(id==='other') return ['شركة الشحن: القدموس','مركز الاستلام: مركز آخر — يرجى مراجعة الملاحظات لتأكيد المركز'];
 const center=getDeliveryCenter(id);
 if(!center)return [];
 return ['شركة الشحن: القدموس',`مركز الاستلام: ${center.name}`,`منطقة المركز: ${center.region}`,`عنوان المركز: ${center.address}`,`هاتف المركز: ${center.phone}`];
}
function initializeDeliveryMenu() {
 const region=document.querySelector('#delivery-region');
 const center=document.querySelector('#delivery-center');
 const details=document.querySelector('#delivery-center-details');
 const notes=document.querySelector('#customer-notes');
 const regions=[...new Set(deliveryDirectory.centers.map(c=>c.region))];
 region.innerHTML='<option value="">اختر المنطقة</option>'+regions.map(r=>`<option value="${escapeHTML(r)}">${escapeHTML(r)}</option>`).join('')+'<option value="other-region">منطقة أخرى</option>';
 region.addEventListener('change',()=>{
   const city=localCity(region.value),method=document.querySelector('#local-delivery-method'),address=document.querySelector('#delivery-address');
   document.querySelector('#other-center-hint').hidden=Boolean(city);
   document.querySelector('#kadmous-fields').hidden=Boolean(city);document.querySelector('#local-delivery-fields').hidden=!city;
   method.disabled=!city;method.required=Boolean(city);method.value='';method.setCustomValidity('');
   address.disabled=true;address.required=false;address.value='';address.setCustomValidity('');document.querySelector('#delivery-address-fields').hidden=true;
   document.querySelector('#local-center-details').textContent=city?`مركز PowerPunch في ${city}: ${storeConfig.localCenters?.[city]||'يؤكد مع فريق المتجر'}. ينسق فريقنا معك تفاصيل الاستلام أو التوصيل.`:'';
   center.required=!city;center.disabled=Boolean(city)||!region.value;
   notes.required=false;
   document.querySelector('label[for="customer-notes"]').textContent='ملاحظات الطلب (اختياري)';

   center.innerHTML='<option value="">اختر مركز الاستلام</option>'+deliveryDirectory.centers.filter(c=>c.region===region.value).map(c=>`<option value="${c.id}">${escapeHTML(c.name)}</option>`).join('')+(region.value?'<option value="other">مركز آخر — اكتب اسمه في الملاحظات</option>':'');
   details.textContent='';
 });
 document.querySelector('#local-delivery-method').addEventListener('change',event=>{
  event.target.setCustomValidity('');const delivery=event.target.value==='delivery',address=document.querySelector('#delivery-address');
  document.querySelector('#delivery-address-fields').hidden=!delivery;address.disabled=!delivery;address.required=delivery;address.setCustomValidity('');
 });
 document.querySelector('#delivery-address').addEventListener('input',e=>e.target.setCustomValidity(''));
 center.addEventListener('change',()=>{
   const branch=getDeliveryCenter(center.value);
   notes.required=center.value==='other';
   document.querySelector('label[for="customer-notes"]').textContent=notes.required?'اسم المركز المطلوب ومنطقته (مطلوب)':'ملاحظات الطلب (اختياري)';
   details.textContent=branch?`${branch.address} · هاتف المركز: ${branch.phone}`:center.value==='other'?'يرجى كتابة اسم المركز المطلوب ومنطقته في الملاحظات لتأكيده مع فريقنا.':'';
 });
}
