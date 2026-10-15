# Inventory data

## Seed JSON (default catalog)

[`products.json`](products.json) loads automatically on first visit when the browser vault has no products. Admin Excel / Sheets sync or manual edits then override it in `localStorage` / IndexedDB.

## Excel / Sheets template

Use [`catalog.template.csv`](catalog.template.csv) as the master layout.

### How to connect

1. Open the template in **Microsoft Excel** or **Google Sheets**.
2. Replace example rows with real stock (`name`, `category`, `price`, `cost`, `barcode`, `stock`, …).
3. In the **admin portal** → **Excel / Sheets**:
   - Drop a `.xlsx` or `.csv` file, **or**
   - Paste a Google Sheet URL and click **Sync**.
4. The [public website](https://arnold-rg.github.io/Boutique-la-difference/) catalog updates from the same browser data store (or after sync on each device).

## Storage notes

| Data | Where |
|------|--------|
| Catalog / settings / orders | `localStorage` (`bld-store-v1`) + IndexedDB mirror |
| Shopping cart | IndexedDB preferred, `localStorage` fallback (`bld-cart-v1`) |

See [SECURITY.md](../SECURITY.md) for XSS and auth limits.
