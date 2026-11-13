# Inventory data

## Seed JSON (default catalog)

[`products.json`](products.json) loads automatically on first visit when the browser vault has no products. Edits to this file, once published, are what new visitors see.

## Excel / Sheets template

Use [`catalog.template.csv`](catalog.template.csv) as the master layout.

### How to update the public catalog

1. Open the template in **Microsoft Excel** or **Google Sheets**.
2. Replace example rows with real stock (`name`, `category`, `price`, `cost`, `barcode`, `stock`, …).
3. Export or convert to the `products.json` shape and commit the result in this repository, or use the private office to import a workbook and then copy the catalog back into [`products.json`](products.json).

The public shop at [arnold-rg.github.io/Boutique-la-difference](https://arnold-rg.github.io/Boutique-la-difference/) does not include an owner login. Spreadsheet sync in the private office updates only that office’s browser vault unless you also publish `products.json` here.

## Storage notes

| Data | Where |
|------|--------|
| Catalog seed for every visitor | [`products.json`](products.json) in this repository |
| Catalog / settings overrides on a device | `localStorage` (`bld-store-v1`) + IndexedDB mirror on this origin |
| Shopping cart | IndexedDB preferred, `localStorage` fallback (`bld-cart-v1`) |

See [SECURITY.md](../SECURITY.md) for XSS limits.
