# powerpunch

PowerPunch homepage — Dark Sport Editorial with restrained Neo-Brutalist details.

The homepage is plain HTML/CSS/JS with no build step, matching the rest of the live site at https://powerpunch.site. It links to the existing `/clothes`, `/supplements` and `/equipment` pages and reads the optional landing copy from the existing `/api/storefront` endpoint.

## Structure

| Path | Purpose |
|---|---|
| `index.html` | Homepage: hero, brand intro, categories, brand statement, footer |
| `src/home.css` | Homepage styles (brand tokens, layout, responsive rules, motion preferences) |
| `src/home.js` | Header and mobile menu, scroll reveals, pointer parallax, scroll-linked motion, card tilt, leave transition |
| `src/home-light.js` | WebGL hero lighting, loaded on idle only when WebGL is available and reduced motion is off |
| `products/home/` | Optimized images served by the homepage |
| `brand-assets/` | Original approved files (logo, athlete, supplement and dumbbell photography, clothing product photos) |

`products/home/hero-athlete-cutout.webp` is the approved athlete photograph with its pure-black background made transparent. Its pixels are unchanged, which lets the red lighting and the background wordmark sit behind the athlete instead of over him.

## Editable copy

Elements with `data-field` (`eyebrow`, `intro`, `heading1`, `body1`, `heading2`, `body2`) are replaced with `storefront.landing` values from `/api/storefront` when present. The built-in copy stays when the API is unavailable.

## Local preview

Serve the repository root with any static server, for example:

```bash
python3 -m http.server 8080
```

The department pages and `/api/*` live on the production site and are not part of this repository.
