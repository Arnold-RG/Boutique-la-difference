# Boutique La Différence

Professional retail storefront for a neighborhood supermarket in Zindiro, Kigali — food, drinks, electronics, home equipment, tools, body products, and more.

**Public site:** no customer login or registration.  
**Admin dashboard:** single owner account with password + authenticator-app (TOTP / QR) security.

Live catalog data is **not hard-coded**. Names, prices, stock, and photos come from Excel / CSV / Google Sheets or the admin panel.

## Quick start

1. Open [`index.html`](index.html) for the public shop.
2. Open [`admin/`](admin/) once to **create the owner account**:
   - Choose username + strong password (10+ characters)
   - Scan the QR code with **Google Authenticator**, **Authy**, or **Microsoft Authenticator**
   - Enter the 6-digit code to finish setup
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
- Admin requires **username + password + time-based one-time code** from an enrolled phone.
- Passwords are stored only as **PBKDF2-SHA256** hashes (210,000 iterations) with a random salt.
- Sessions last 8 hours (tab session storage).
- Re-enroll a new authenticator QR anytime from Admin → Security.

## Stack

HTML · CSS · JavaScript · [SheetJS](https://sheetjs.com/) (Excel) · Web Crypto

## Author

Arnold Rurangwa · ARNOVA Group · Computer Engineer

## License

MIT — see [LICENSE](LICENSE).
