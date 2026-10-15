# Security Policy

**Maintainer:** Arnold Rurangwa · ARNOVA Group  
**Project:** Boutique La Différence (static GitHub Pages storefront)

## Supported surface

- Public shop: catalog, cart, feedback, and optional chat — **no customer accounts**.
- Admin portal: fixed owner username + **PBKDF2-SHA256** password verification in the browser.
- Data lives in the browser (`localStorage` / IndexedDB) and optional local JSON / Excel / Google Sheets sync. There is no authenticated server API in this repository.

## Reporting a vulnerability

If you discover a security issue (for example XSS in client scripts, or accidental secret exposure in git history), please open a **private** security advisory on GitHub when available, or contact via https://github.com/Arnold-RG.

Please do **not** open a public issue that includes exploit details until a fix is released.

## Secrets policy

- Never commit `.env`, credentials, API keys, PEM files, or local agent configuration.
- Use `.env.example` only for documented non-secret placeholders.
- Admin password verification uses a client-side hash. This deters casual browsing of the admin UI but **is not equivalent to server-side authentication** — treat admin access as local-device protection on a static host.

## Client-side auth limits (documented)

| Control | Behavior |
|--------|----------|
| Password hash | PBKDF2-SHA256, 210,000 iterations |
| Session | `sessionStorage`, 8-hour expiry |
| Rate limit | After **5** failed password attempts, sign-in is locked for **60 seconds** (client-side only; a determined attacker can clear storage) |
| XSS | Product names/descriptions and user-sourced strings are escaped before HTML render |

## Hardening checklist maintained in-repo

- `referrer` policy: `strict-origin-when-cross-origin`
- External links: `rel="noopener noreferrer"`
- CSP meta on public + admin pages (GitHub Pages compatible)
- Forms: `maxlength` + validation where applicable
