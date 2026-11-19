# Boutique La Différence · Cross-platform website support

This shopping site runs through standard web browsers, rather than as native operating-system software.

- It is intended to be usable on current Chrome, Edge, Firefox and Safari on Windows, Linux and macOS, plus Chrome for Android and Safari for iOS.
- The site uses responsive CSS and viewport settings. Keyboard, touch, font zoom, cart and WhatsApp/contact flows need real-device acceptance testing.
- The GitHub Actions workflow `.github/workflows/cross-platform-website.yml` performs static smoke tests on Linux, Windows and macOS. It does **not** prove the site's complete browser or mobile performance.
- The main `.github/workflows/pages.yml` continues publishing the site to GitHub Pages. No Docker/Kubernetes infrastructure is required.
- The palette is specific to this shop's concept (navy / citrus / ivory); it is not a universal agency template. Match actual authorized business brand assets before claiming this is an official visual identity.

**Native app note:** Running in a mobile browser is not the same as a Play Store / App Store application. Separate mobile app packaging and platform approval are required for native delivery.
