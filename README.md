# Boutique La Différence — Online Shop

**Neighborhood retail · Kigali, Rwanda** · [GitHub repository](https://github.com/Arnold-RG/Boutique-la-difference) · [Website](https://arnold-rg.github.io/Boutique-la-difference/)

## Project overview

Public-facing neighborhood shop site in Zindiro, Kigali, presenting a product catalogue, navigation and customer shopping interactions. It uses static HTML/CSS/JavaScript backed by repository data and assets; confirm which interactions are fully operational before representing the site as a live payment processor.

**Technology:** Static HTML, CSS, JavaScript, JSON/data assets; GitHub Pages.

> **Verification note:** This documentation reflects observed repository structure. It does not imply that paid features, security tests, certifications, deployment configurations or third-party integrations have been approved.

## Architecture map

| Location | What belongs here |
| --- | --- |
| `index.html` | Shopfront |
| `assets/css/site.css` | Responsive shop presentation |
| `assets/` | Product/brand images and scripts |
| `data/` | Catalogue and shop data |
| `site.webmanifest` | Web-app metadata |
| `.github/` | Publishing and quality checks |
| `docs/` | Compatibility and operational notes |

## Development and setup

Install Git and the relevant runtime. Inspect the environment template and repository deployment docs before exposing any network services.

```sh
python -m http.server 8000
# Visit http://localhost:8000
```

**Important:** GitHub Pages hosts a static front end; actual commerce payments and order persistence require separate security-reviewed services.

## Product functionality and user experience

- Clear categories, search, availability/status messaging and accessible quantity controls.
- Cart totals must match current approved product data; show when orders are not active.
- Mobile navigation, product images, verified location, authentic prices and owner-supplied information.

Prioritize accessibility, keyboard and touch navigation, meaningful empty/error/loading states and truthful product claims. Never copy third-party images or logos without authorization.

## Security and data protection

- Never store card numbers or payment credentials in browser local storage.
- For paid checkout, use a reputable payment provider's hosted flows with a secured backend and server-side order pricing.
- Protect administrative data and inventory permissions; the private office service needs separate authentication and backups.

Use secrets management, least privilege, deployment environment isolation, dependency audits and a private vulnerability disclosure path. Release claims must be tied to actual evidence.

## Engineering and CI/CD standards

| Gate | Expected evidence |
| --- | --- |
| Code quality | Lint/type checks, peer review and maintained documentation |
| Automated testing | Relevant unit/integration/security regression tests |
| Dependency and supply chain | Locked builds, dependency reviews, secret scanning and SBOM when helpful |
| Security | Threat model, input validation, authz tests and secure configuration |
| User experience | Responsive layouts, accessibility, functioning navigation and real-world test flows |
| Release | Staging verification, owner approval, traceable deploy and rollback |
| Operations | Metrics/logging and alerting for services; link/uptime checks for static sites |

These are **release criteria**, not claims that every control is currently enabled. Kubernetes should only be used when the actual runtime complexity justifies it.

## Contributing and support

Create a small, reviewable change, include reproduction steps and tests, and document environmental impacts. Do not publish unapproved customer details or change live services without release authorization. Report security vulnerabilities privately via `SECURITY.md` where available.
