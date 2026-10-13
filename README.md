# Boutique La Différence

[![Live site](https://img.shields.io/badge/Live-GitHub%20Pages-2ea44f?logo=github)](https://arnold-rg.github.io/Boutique-la-difference/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

Professional **neighborhood supermarket** storefront for **Boutique La Différence** (Zindiro, Kigali) — food, drinks, electronics, home equipment, tools, body products, and more.

A static shop for customers, and a private office for the owner. The public pages are open to everyone. The admin portal is served only by the shop server, behind a hashed password and an HttpOnly session.

| Surface | URL |
|--------|-----|
| **Public shop** | [arnold-rg.github.io/Boutique-la-difference](https://arnold-rg.github.io/Boutique-la-difference/) |
| **Admin portal** | On the private server only, at `/admin/login` |
| **Repository** | [github.com/Arnold-RG/Boutique-la-difference](https://github.com/Arnold-RG/Boutique-la-difference) |

---

## Highlights

### Public website (no customer login)
- Cinematic hero, category browsing, live product catalog
- **Shopping cart** + WhatsApp checkout (name, phone, delivery)
- About us, our team, partner / Rwanda business ads
- Events & discounts, gallery, map & hours
- Social links + customer service chat widget

### Admin portal (owner only)
- Owner sign-in on the private server (hashed password, session cookie, lockout)
- Products & prices, barcode scan, Excel / Google Sheets sync
- Revenue charts, sales, payments, debts, orders & shipments
- Stock & purchases, daily activity, logistics
- Employees, shifts, salary calculator
- CCTV camera tiles (stream / embed URLs)
- Customer service inbox, policy rules
- Team, social media, advertise other Rwandan businesses
- Site settings, image library, JSON backup

Catalog **names, prices, and photos are not hard-coded** — they come from Excel / CSV / Sheets or the admin UI.

---

## Programming tools & technologies

Everything used to design, build, secure, and host this site:

| Tool / technology | Role in this project |
|-------------------|----------------------|
| **HTML5** | Semantic storefront & admin page structure |
| **CSS3** | Dark navy design system, layout, responsive UI, motion |
| **JavaScript (ES2020+)** | App logic, routing-style tabs, cart, CRUD, sync |
| **[SheetJS (xlsx)](https://sheetjs.com/)** | Import / parse Excel (`.xlsx`) workbooks in the browser |
| **CSV + Google Sheets export** | Spreadsheet sync without a custom backend |
| **[Chart.js](https://www.chartjs.org/)** | Admin revenue charts (last 7 days) |
| **Node.js** | Private admin server: scrypt password check, session cookie, lockout |
| **localStorage / sessionStorage** | Catalog, orders, session & device memory (static hosting) |
| **Canvas 2D** | Cinematic hero atmosphere when no video URL is set |
| **Google Fonts** | [Newsreader](https://fonts.google.com/specimen/Newsreader) + [Sora](https://fonts.google.com/specimen/Sora) |
| **Git** | Version control |
| **GitHub** | Source hosting & collaboration |
| **GitHub Pages** | Free worldwide HTTPS hosting |
| **Microsoft Excel / Google Sheets** | Inventory master data for the shop |
| **WhatsApp deep links** | Order handoff from the cart |

### Runtime & libraries (CDN)

| Library | Purpose |
|---------|---------|
| `xlsx` (SheetJS) | Excel import in admin |
| `chart.js` | Dashboard charts |

No Node/npm build step is required to run the live site — open the HTML files or use GitHub Pages.

---

## Project structure

```
Boutique-la-difference/
├── index.html                 # Public storefront
├── assets/
│   ├── css/
│   │   ├── site.css           # Public shop
│   │   └── admin.css          # Office
│   └── js/
│       ├── data.js            # Shared store · Excel/CSV/Sheets
│       └── store.js           # Public UI · cart · chat
├── admin/                     # Not published on the public site
│   ├── login.html
│   ├── index.html
│   ├── device.html
│   └── js/                    # Office scripts, served only after sign-in
├── server/                    # Sign-in, sessions, lockout
├── data/
│   ├── catalog.template.csv   # Inventory column template
│   └── README.md              # How to connect Excel
├── LICENSE                    # MIT
└── README.md
```

---

## Quick start

### Online
Open the [live shop](https://arnold-rg.github.io/Boutique-la-difference/). Customers do not sign in.

The office is not on that public address. Run the private server (below) and open `/admin/login` there.

### Local
1. Clone the repo:
   ```bash
   git clone https://github.com/Arnold-RG/Boutique-la-difference.git
   cd Boutique-la-difference
   ```
2. Start the server (setup under [Private office](#private-office)):
   ```bash
   node server/index.js
   ```
3. Open `http://localhost:8080/` for the shop and `http://localhost:8080/admin/login` for the office.

---

## Excel & Google Sheets

Template: [`data/catalog.template.csv`](data/catalog.template.csv)

| Column | Notes |
|--------|--------|
| `name` | Required |
| `category` | `food` · `drinks` · `electronics` · `home` · `tools` · `body` · `more` |
| `price` / `cost` | Sell & cost amounts |
| `barcode` / `sku` | Scan & lookup |
| `unit` / `stock` | Unit label & quantity |
| `image` | URL or attach in Admin → Images |
| `featured` / `active` | `true` / `false` |

**Google Sheet:** share or publish as CSV, paste the URL in **Admin → Excel / Sheets → Sync**.

**Backup:** export / restore full JSON from the admin Excel section.

---

## Private office

The public site does not link to the office, and GitHub Pages does not publish the `admin/` or `server/` folders. Sign-in is checked on the server. The password is never stored in this repository.

Before you retire the old public admin page, open it once and download a JSON backup (Excel / Sheets → Download JSON backup). Stock, orders, and notes live in the browser that created them. A new web address starts empty until you restore that file.

1. Install Node.js 20 or newer.
2. Create a password hash. The password is not printed and is not saved:
   ```bash
   node server/hash-password.js
   ```
   Use a new password of at least 12 characters. The old one was committed as a hash and should be retired.
3. Copy the example environment and fill it in:
   ```bash
   cp .env.example .env
   ```
   - `ADMIN_USERNAME` — the name you will type at the door
   - `ADMIN_PASSWORD_HASH` — the line printed by the hash script
   - `SESSION_SECRET` — a long random string:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
     ```
4. Load the file into the environment and start the server. On a Mac or Linux shell:
   ```bash
   set -a && source .env && set +a
   node server/index.js
   ```
5. Open `http://localhost:8080/admin/login`. Five wrong attempts from the same network pause sign-in for 15 minutes. A successful session lasts 8 hours (`SESSION_HOURS`). Sign out from the office when you leave a shared computer.
6. For a public office address, run this same server behind HTTPS (Caddy, nginx, Render, Fly.io, or a small VPS). Set `TRUST_PROXY=1` only when that proxy sends `X-Forwarded-For` and `X-Forwarded-Proto`. The cookie is marked Secure on HTTPS.
7. Do not commit `.env`.

Shop records (catalog, orders, staff, debts, chat) stay in that browser’s `localStorage`. They are not uploaded by the server. Do not commit customer exports, camera passwords, or the `.env` file.

## Publishing the shop

The live shop is [https://arnold-rg.github.io/Boutique-la-difference/](https://arnold-rg.github.io/Boutique-la-difference/).

`.github/workflows/pages.yml` publishes the public files to GitHub Pages on every push to `main`. In the repository, open **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.

If Pages is still set to deploy from the branch, `_config.yml` tells Jekyll to leave out `admin/` and `server/`. Switch the source to GitHub Actions when you can, so the workflow is what goes live.

## Security

- The shop has no customer account.
- The office requires `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` (scrypt), and `SESSION_SECRET`.
- The session is an HttpOnly, SameSite=Strict cookie. It is also Secure when the request is HTTPS.
- Wrong attempts are locked per network address and username.
- Admin responses send `noindex`. `robots.txt` disallows `/admin/`.

## Design

- Ivory paper, deep forest, and a champagne-gold rule
- Typography: **Cormorant Garamond** for titles, **Outfit** for the interface
- Layout for phones, tablets, laptops, wide monitors, and large screens  

---

## Author

**Arnold Rurangwa** · ARNOVA Group · Computer Engineer  

Repository: [Arnold-RG/Boutique-la-difference](https://github.com/Arnold-RG/Boutique-la-difference)

---

## License

MIT — see [LICENSE](LICENSE).
