// File-level compatibility checks. Browser testing is still necessary on real devices.
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const expected = ['index.html','assets/css/site.css','assets/vira/vira-base.css','assets/favicon.svg','site.webmanifest'];
for (const f of expected) assert(existsSync(resolve(root,f)), 'Missing public asset: '+f);
const html = readFileSync(resolve(root,'index.html'),'utf8');
const css = readFileSync(resolve(root,'assets/css/site.css'),'utf8');
for (const [regex,label] of [
  [/<meta[^>]+name="viewport"/i,'mobile viewport'],
  [/<main(?:\s|>)/i,'main landmark'],
  [/id="catalog"/i,'catalogue anchor'],
  [/id="cartBtn"/i,'cart button'],
  [/<\/html>/i,'valid document tail']
]) assert(regex.test(html),'Missing '+label);
for (const [regex,label] of [
  [/@media\s*\(max-width:/i,'responsive breakpoints'],
  [/\.product-grid\s*\{/i,'product cards'],
  [/\.hero\s*\{/i,'hero design'],
  [/var\(--forest\)/i,'brand-scoped accent']
]) assert(regex.test(css),'Missing '+label);
console.log('PASS: static site smoke test on '+process.platform+'; browser/device testing remains necessary');
