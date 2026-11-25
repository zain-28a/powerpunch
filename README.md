# PowerPunch storefront

Static front-end for [powerpunch.site](https://powerpunch.site/) (served by Cloudflare Pages; `/clothes` → `clothes.html`, etc.).
Product data comes from the server API (`/api/products`, `/api/storefront`), which is not part of this repository.

| Page | File | Assets |
|---|---|---|
| Home | `index.html` | `src/home.css`, `src/home.js`, `src/home-light.js`, `src/home-bg.js`, `products/home/` |
| Clothing | `clothes.html` | `src/clothing.css`, `src/clothing.js`, `src/showroom.js` (Three.js, lazy), `products/clothing/` |
| Supplements | `supplements.html` | `src/supplements-page.css`, `src/supplements-page.js`, `products/supplements/` |
| Equipment | `equipment.html` | Intentionally empty: shared header and footer only |

The shop pages share `src/store.css` and `src/store-common.js` (header, bag button, product panel).
Ordering, stock checks, delivery options and the WhatsApp message are unchanged and come from
`src/cart.js`, `src/catalog.js` and `src/shipping-centers.js`.

### Product images

- `products/clothing/<productId>-<colourIndex>.webp`: background-free cut-outs of the original product photos,
  used only in the 3D showroom. Only garments and colours with a clean, accurate isolation are included;
  the Nike and Adidas shorts (photographed on a model) appear only in the collection grid.
  To add a garment to the rail, add its cut-outs and its entry in `CUTOUTS` and `RAIL_ORDER` in `src/clothing.js`.
- `products/supplements/<productId>.webp`: cut-outs for the product lab, chosen per category in `FEATURED`
  in `src/supplements-page.js`.
- Grids and product panels always use the original photos from the catalogue.
- `src/vendor/three.module.min.js` is Three.js r170 (MIT, see `three.LICENSE`), loaded only by the showroom.

## GitHub Pages

Deployed by `.github/workflows/pages.yml` to `https://zain-28a.github.io/powerpunch/`.
The workflow enables Pages itself. If the first run fails on that step, set Settings → Pages → Source: **GitHub Actions** once.

On `*.github.io` there is no `/api`, so the catalog and storefront load from the snapshots in `data/`
(`data/products.json`, `data/storefront.json`) and discount codes are unavailable. `.github/workflows/refresh-data.yml` copies
the live catalogue into `data/` every day and redeploys Pages when it changed; run it manually from the Actions tab for an immediate refresh.

## Home page notes

- No build step and no runtime dependencies: vanilla JS plus a ~4 KB raw-WebGL shader.
- The WebGL light loads only after `load` and idle, and only when WebGL is available and `prefers-reduced-motion` is off. Otherwise a CSS glow is used.
- Approved photography is in `products/home/`: `hero-athlete.jpg`, `category-supplements.jpg`, `category-equipment.jpg`. `powerpunch-logo.png` is the official logo source; the `powerpunch-logo-*.webp` files are resized copies with the same proportions.
- Admin-editable landing copy (`storefront.landing` fields) is still applied through `data-field` attributes.
