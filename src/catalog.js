// The server is the catalog's source of truth; no hard-coded product fallback.
let products = [];
let sizes = [];
let categories = [];
let offers = [];
let rotatingShirt = null;
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
async function loadCatalog() {
  const [response, storefront] = await Promise.all([ppFetch('/api/products',{cache:'no-store'}),window.supplementExamples?ppFetch('/api/storefront',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null):null]);
  if(window.supplementExamples){
    if(!storefront)throw new Error('Storefront could not be loaded');
    const data=storefront.supplements;
    Object.assign(window.supplementCatalog,{categories:data.categories,products:data.products.length?data.products:window.supplementExamples.products});
    if(window.equipmentCatalog){
      const equipment=storefront.equipment;
      Object.assign(window.equipmentCatalog,{categories:equipment?.categories??[],products:equipment?.products?.length?equipment.products:(window.equipmentExamples??[])});
    }
  }
  if(!response.ok) throw new Error('Catalog could not be loaded');
  const catalog=await response.json();
  if(!Array.isArray(catalog.products)) throw new Error('Invalid catalog');
  products=catalog.products;
  categories=catalog.categories||[];
  offers=catalog.offers||[];
  rotatingShirt=catalog.rotatingShirt||null;
  sizes=[...new Set(products.flatMap(p=>p.variants.map(v=>v.size)))];
}
function productPrice(p){return p.salePrice??p.price;}
function priceMarkup(p){const price=productPrice(p),old=p.salePrice!==undefined?(p.originalPrice??p.price):p.originalPrice;return `<span class="current-price">${formatPrice(price)}</span>${old>price?`<del class="old-price">${formatPrice(old)}</del>`:''}`;}
function offerDiscount(o){return Math.max(1,Math.round((1-o.price/o.originalPrice)*100));}
function variantStock(p, color, size) {
  return p?.variants?.find(v=>v.color===color && v.size===size)?.quantity || 0;
}
function colorStock(p, color) {
  return p.variants.filter(v=>v.color===color).reduce((total,v)=>total+v.quantity,0);
}
function colorStockLabel(p, color) {
  const amount=colorStock(p,color);
  return amount ? `المتوفر بهذا اللون: ${amount} قطعة` : 'هذا اللون غير متوفر — 0 قطعة';
}
function stockOverlay() {
  return '<span class="stock-overlay" dir="ltr"><span lang="en">OUT OF STOCK</span><span class="stock-overlay-ar" lang="ar" dir="rtl">نفدت الكمية</span></span>';
}
function productPhotos(p,color=0) {
  const images=p.galleries?.[color];
  return Array.isArray(images)&&images.length?images:p.images?.[color]?[p.images[color]]:[];
}
function productReel(p){
 const match=typeof p?.instagramReel==='string'&&p.instagramReel.match(/^https:\/\/www\.instagram\.com\/reel\/([A-Za-z0-9_-]{1,80})\/$/);
 return match?`https://www.instagram.com/reel/${match[1]}/`:null;
}
function productGallery(p){
 const slides=p.colors.flatMap((_,color)=>Array.from({length:Math.max(1,productPhotos(p,color).length)},(_,photo)=>({color,photo})));
 const reel=productReel(p);if(reel)slides.push({reel});return slides;
}
function productArt(p,color=0,photo=0) {
  const image=productPhotos(p,color)[photo];
  let remote=false;
  try {const url=new URL(image);remote=url.protocol==='https:'&&url.hostname==='res.cloudinary.com'&&/^\/[\w-]+\/image\/upload\//.test(url.pathname)&&!url.username&&!url.password;}catch{}
  if(image && (remote||/^\/products\/[a-zA-Z0-9_-]+\.(svg|png|jpg|jpeg|webp|avif)$/.test(image))) return `<img class="product-photo" src="${escapeHTML(image)}" alt="${escapeHTML(p.name)} — ${escapeHTML(p.colors[color][0])}" loading="lazy">`;
  return svgGear(p.type,p.colors[color][1]);
}
