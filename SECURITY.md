# Security Policy

## Supported versions

Security updates apply to the latest commit on the default branch of this repository.

## Reporting a vulnerability

Email **rurangwaarnold32@gmail.com** with:

- Repository name and affected URL/path
- Description and impact
- Steps to reproduce (proof of concept if available)

Please do **not** open a public issue for unpatched vulnerabilities.

We aim to acknowledge reports within 7 days and publish a fix or mitigation when confirmed.

## Practice

- No secrets in source; use `.env.example` only
- Prefer `textContent` / escaped HTML for untrusted data (chat, reviews, product fields)
- External links use `rel="noopener noreferrer"`
- Content-Security-Policy meta on storefront and admin
- Referrer policy: `strict-origin-when-cross-origin`
- Cart and catalog vault prefer IndexedDB with localStorage mirror (GitHub Pages has no server DB)
- Admin auth is client-side for a static Pages deploy — treat it as a shop-floor gate, not bank-grade hosting security
- Dependabot / Actions least privilege where applicable
