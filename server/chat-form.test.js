'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { bindChatForm } = require('../assets/js/chat-form.js');

function fakeForm() {
  const handlers = {};
  return {
    addEventListener(type, fn) { handlers[type] = fn; },
    submit() {
      const ev = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
      handlers.submit(ev);
      return ev;
    },
    handlers
  };
}

test('chat form submit is prevented and sends once', () => {
  const form = fakeForm();
  let sent = 0;
  bindChatForm(form, () => { sent += 1; });
  const ev = form.submit();
  assert.equal(ev.defaultPrevented, true, 'submit must not reload the page');
  assert.equal(sent, 1);
});

test('bindChatForm ignores missing form or sender', () => {
  assert.equal(bindChatForm(null, () => {}), null);
  assert.equal(bindChatForm(fakeForm(), null), null);
});

test('storefront wires the chat form through BLDChatForm, not a click handler', () => {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const store = fs.readFileSync(path.join(root, 'assets/js/store.js'), 'utf8');
  assert.match(html, /<form id="helpFoot">/);
  assert.ok(html.indexOf('assets/js/chat-form.js') < html.indexOf('assets/js/store.js'));
  assert.match(store, /BLDChatForm\.bindChatForm\(helpForm, sendChat\)/);
});

test('checkout opens WhatsApp before any await', () => {
  const store = fs.readFileSync(path.join(__dirname, '..', 'assets/js/store.js'), 'utf8');
  const start = store.indexOf('function checkout()');
  const body = store.slice(start, store.indexOf('function renderChat()'));
  assert.ok(start > 0 && !/async function checkout/.test(store));
  assert.ok(!/\bawait\b/.test(body), 'no await inside checkout');
  assert.ok(body.indexOf('window.open(') < body.indexOf('persistCart('));
});
