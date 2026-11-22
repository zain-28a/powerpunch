// Store contact details supplied by the store owner.
const storeConfig = Object.freeze({
  name: 'PowerPunch',
  localCenters: {'اللاذقية':'أوتستراد الزراعة، بجانب مكتبة مطر','حلب':'ساحة العزيزية، مقابل ماجيلا أزهار مرجانة'},
  whatsappNumber: '963934609239', // Verified from the store's WhatsApp Business short-link destination.
  whatsappContactUrl: 'https://wa.me/message/ZHT4ZS3JJYTSL1',
  facebookUrl: 'https://www.facebook.com/share/1JdYsCdRRW/?mibextid=wwXIfr',
  instagramUrl: 'https://www.instagram.com/power_punch.sy/',
});

// GitHub Pages has no /api. On *.github.io, data comes from the snapshots in /data.
const PP_STATIC_HOST = /\.github\.io$/i.test(location.hostname);
function ppFetch(path, options) {
  if (!PP_STATIC_HOST) return fetch(path, options);
  const snapshot = {'/api/products': 'data/products.json', '/api/storefront': 'data/storefront.json'}[path];
  if (snapshot) return fetch(snapshot, {cache: 'force-cache'});
  // Discount codes need the live server; report them as unavailable.
  return Promise.resolve(new Response(JSON.stringify({error: 'unavailable'}), {status: 503, headers: {'Content-Type': 'application/json'}}));
}
