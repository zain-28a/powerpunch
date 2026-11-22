# PowerPunch storefront

Static front-end for [powerpunch.site](https://powerpunch.site/) (served by Cloudflare Pages; `/clothes` → `clothes.html`, etc.).
Product data comes from the server API (`/api/products`, `/api/storefront`), which is not part of this repository.

| Page | File | Assets |
|---|---|---|
| Home | `index.html` | `src/home.css`, `src/home.js`, `src/home-light.js` (lazy WebGL hero lighting), `products/home/` |
| Clothing | `clothes.html` | `src/styles.css`, `src/app.js`, `src/shop.js`, … |
| Supplements | `supplements.html` | `src/supplements.css`, `src/supplements.js`, … |
| Equipment | `equipment.html` | `src/supplements.css`, `src/supplements.js`, … |

## GitHub Pages

Deployed by `.github/workflows/pages.yml` to `https://zain-28a.github.io/powerpunch/`.
The workflow enables Pages itself. If the first run fails on that step, set Settings → Pages → Source: **GitHub Actions** once.

On `*.github.io` there is no `/api`, so the catalog and storefront load from the snapshots in `data/`
(`data/products.json`, `data/storefront.json`) and discount codes are unavailable. Refresh the snapshots from `/api/products` and `/api/storefront` when products change.

## Home page notes

- No build step and no runtime dependencies: vanilla JS plus a ~4 KB raw-WebGL shader.
- The WebGL light loads only after `load` and idle, and only when WebGL is available and `prefers-reduced-motion` is off. Otherwise a CSS glow is used.
- Approved photography is in `products/home/`: `hero-athlete.jpg`, `category-supplements.jpg`, `category-equipment.jpg`. `powerpunch-logo.png` is the official logo source; the `powerpunch-logo-*.webp` files are resized copies with the same proportions.
- The Clothing card uses an existing product photo from the catalog (Cloudinary).
- Admin-editable landing copy (`storefront.landing` fields) is still applied through `data-field` attributes.
