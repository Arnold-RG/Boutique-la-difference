# Boutique La Différence

Professional retail storefront for a neighborhood supermarket in Zindiro, Kigali — food, drinks, electronics, home equipment, tools, body products, and more.

**Public site:** no customer login or registration.  
**Admin dashboard:** fixed owner account `Family@nbr1` — password every time, then quick number-match verification (select the number shown on the portal; allowed phones use `/admin/device.html`).

Live catalog data is **not hard-coded**. Names, prices, stock, and photos come from Excel / CSV / Google Sheets or the admin panel.

## Quick start

1. Open [`index.html`](index.html) for the public shop.
2. Open [`admin/`](admin/) and sign in:
   - Username is fixed: `Family@nbr1` (cannot be changed)
   - Type the owner password
   - Match the quick verification number shown on screen (or open the device verifier on an allowed phone and tap the same number)
3. In **Excel / Sheets**, download the CSV template, fill products, import `.xlsx` / `.csv`, or paste a Google Sheet link and sync.
4. Upload product / business / event images, add discounts and events, edit site settings.

## Excel & Google Sheets

Template: [`data/catalog.template.csv`](data/catalog.template.csv)

| Column | Notes |
|--------|--------|
| `name` | Required |
| `category` | `food` · `drinks` · `electronics` · `home` · `tools` · `body` · `more` |
| `price` | Number |
| `unit` | e.g. bag, bottle, pcs |
| `stock` | Quantity |
| `sku` / `id` | Optional identifiers |
| `image` | URL or leave blank and attach in Media |
| `featured` / `active` | `true` / `false` |

**Google Sheet:** File → Share (anyone with link can view) or Publish to web (CSV), then paste the sheet URL in Admin → Excel / Sheets → Sync.

**Full backup:** Admin can export / restore a JSON backup of products, media, events, and settings.

## Architecture

```
index.html              Public storefront (no auth)
admin/index.html        Secured owner dashboard
assets/css/             Site + admin styles
assets/js/data.js       Shared store + Excel/CSV/Sheet sync
assets/js/auth.js       PBKDF2 password + TOTP (RFC 6238)
assets/js/store.js      Public UI
assets/js/admin.js      Dashboard CRUD
data/catalog.template.csv
```

Data persists in the browser (`localStorage`) so the static GitHub Pages site works without a backend. Use the same browser profile for admin + public preview, or sync via Sheet / backup JSON on each device.

## Security notes

- Public pages never offer login or registration.
- Admin username is fixed as `Family@nbr1` and cannot be changed in the UI.
- Password is required on every sign-in (stored only as a PBKDF2-SHA256 hash in the app code).
- Second step is a quick number match (e.g. 24 / 32 / 65 / 9) — tap the number shown on the portal, or match it on an allowed device page.
- Sessions last 8 hours (tab session storage). Successful logins register the browser as an allowed device.

## Stack

HTML · CSS · JavaScript · [SheetJS](https://sheetjs.com/) (Excel) · Web Crypto

## Author

Arnold Rurangwa · ARNOVA Group · Computer Engineer

## License

MIT — see [LICENSE](LICENSE).
