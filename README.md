# Boutique La Différence

[![Live site](https://img.shields.io/badge/Live-GitHub%20Pages-2ea44f?logo=github)](https://arnold-rg.github.io/Boutique-la-difference/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

Professional **neighborhood supermarket** storefront for **Boutique La Différence** (Zindiro, Kigali) — food, drinks, electronics, home equipment, tools, body products, and more.

Built as a modern static web app: dark navy UI with green accents, Excel-driven inventory, shopping cart, and a full owner admin portal secured with username + password.

| Surface | URL |
|--------|-----|
| **Public shop** | [arnold-rg.github.io/Boutique-la-difference](https://arnold-rg.github.io/Boutique-la-difference/) |
| **Admin portal** | […/admin/](https://arnold-rg.github.io/Boutique-la-difference/admin/) |
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
- Fixed account · **username + password** only
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
| **Web Crypto API** | PBKDF2-SHA256 password hashing |
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
├── admin/
│   ├── index.html             # Owner dashboard (login + modules)
│   └── device.html            # Optional companion device page
├── assets/
│   ├── css/
│   │   ├── site.css           # Public dark theme
│   │   └── admin.css          # Admin dark theme
│   └── js/
│       ├── data.js            # Shared store · Excel/CSV/Sheets
│       ├── auth.js            # Username + password security
│       ├── store.js           # Public UI · cart · chat
│       ├── admin.js           # Dashboard shell · products · settings
│       └── admin-ops.js       # Sales · CCTV · staff · debts · ads …
├── data/
│   ├── catalog.template.csv   # Inventory column template
│   └── README.md              # How to connect Excel
├── LICENSE                    # MIT
└── README.md
```

---

## Quick start

### Online
1. Open the [live shop](https://arnold-rg.github.io/Boutique-la-difference/).
2. Open [admin](https://arnold-rg.github.io/Boutique-la-difference/admin/).
3. Sign in with the fixed owner username and password.

### Local
1. Clone the repo:
   ```bash
   git clone https://github.com/Arnold-RG/Boutique-la-difference.git
   cd Boutique-la-difference
   ```
2. Open `index.html` in a browser (or serve the folder with any static server).
3. Open `admin/index.html` for the control centre.

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

## Security

- Public site: **no** customer registration or login.
- Admin username is fixed (`Family@nbr1`) and not editable in the UI.
- Password verified with **PBKDF2-SHA256** (210,000 iterations).
- Sessions last **8 hours** (session storage).

---

## Design

- Dark navy blue surfaces · forest green accents · brass CTAs  
- Typography: **Newsreader** (display) + **Sora** (UI)  
- Responsive layout for phone, tablet, and desktop  

---

## Author

**Arnold Rurangwa** · ARNOVA Group · Computer Engineer  

Repository: [Arnold-RG/Boutique-la-difference](https://github.com/Arnold-RG/Boutique-la-difference)

---

## License

MIT — see [LICENSE](LICENSE).
