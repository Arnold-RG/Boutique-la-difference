# Boutique La Différence — Zindiro storefront

Customer-facing grocery and household shop website for **Zindiro, Kigali, Rwanda**.

**Website:** https://arnold-rg.github.io/Boutique-la-difference/

## What this website does

- Responsive customer storefront with a newly built visual identity, hero, departments, story and visit information
- Browse 14 seed catalogue products across food, drinks, home, body, electronics, tools and more
- Search products and filter by category
- Build and edit a shopping list, including an estimated RWF total
- Copy the shopping list to share or take to the shop
- Link to directions on Google Maps

**Important:** This is not a payment checkout or a confirmed remote ordering system. The basket is saved on the visitor's own browser. The products in the seed catalogue are examples; prices, stock, shop address, opening hours and photographs need owner verification before public business claims.

## Architecture

| Path | Purpose |
| --- | --- |
| `index.html` | Complete, rewritten public HTML storefront |
| `assets/css/site.css` | Redesigned, responsive visual system |
| `assets/js/store.js` | Rewritten catalogue, search, filters and shopping-list interaction |
| `assets/js/data.js` | Retained local store-data compatibility module |
| `data/products.json` | Product seed data |
| `assets/favicon.svg` | Brand icon |

The store's **private back-office** is maintained in a separate repository, `boutique-la-difference-office`; the static GitHub Pages website does not have a verified real-time integration with that protected service.

## Local development

From the repository directory, start a local web server:

```sh
python -m http.server 8000
```

Visit http://localhost:8000. Test search, filters, cart quantity changes, mobile navigation, keyboard navigation, and the browser storage after code changes.

## Notes on images and business details

Image URLs point to illustrative stock photography. They are not genuine photos of the shop, team, or exact products. Replace with permission-cleared owner photos when available. The address displayed is based on the existing repository configuration and is not independently verified as the precise map pin. Contact details are not fabricated.