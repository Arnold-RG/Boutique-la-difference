/**
 * Public storefront — catalog, cart, about, team, ads, chat (no login).
 */
(function () {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const CART_KEY = 'bld-cart-v1';

  let state = { category: 'all', query: '', data: null, cartOpen: false };

  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    updateCartBadge();
  }
  function cartItems() { return loadCart(); }
  function cartCount() { return cartItems().reduce((a, i) => a + (i.qty || 0), 0); }
  function cartTotal() {
    return cartItems().reduce((a, i) => a + (Number(i.price) || 0) * (i.qty || 0), 0);
  }

  function addToCart(product) {
    const items = loadCart();
    const existing = items.find(i => i.id === product.id);
    if (existing) existing.qty += 1;
    else items.push({ id: product.id, name: product.name, price: product.price, unit: product.unit, qty: 1 });
    saveCart(items);
    toast(product.name + ' added to cart');
  }

  function setQty(id, qty) {
    let items = loadCart();
    if (qty <= 0) items = items.filter(i => i.id !== id);
    else {
      const row = items.find(i => i.id === id);
      if (row) row.qty = qty;
    }
    saveCart(items);
    renderCartDrawer();
  }

  function updateCartBadge() {
    const el = $('#cartCount');
    if (el) el.textContent = String(cartCount());
  }

  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2400);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }

  function activeProducts() {
    return (state.data.products || []).filter(p => p.active !== false);
  }

  function filtered() {
    const q = state.query.trim().toLowerCase();
    return activeProducts().filter(p => {
      if (state.category !== 'all' && p.category !== state.category) return false;
      if (!q) return true;
      return [p.name, p.description, p.sku, p.barcode, p.category].join(' ').toLowerCase().includes(q);
    });
  }

  function countByCategory(id) {
    return activeProducts().filter(p => p.category === id).length;
  }

  function labelCat(id) {
    const c = (state.data.categories || []).find(x => x.id === id);
    return c ? c.name : id;
  }

  function productImage(p) {
    if (p.image) {
      if (p.image.startsWith('media:') || p.image.startsWith('id:')) {
        const id = p.image.replace(/^(media:|id:)/, '');
        const m = (state.data.media || []).find(x => x.id === id);
        if (m && m.dataUrl) return `<img src="${m.dataUrl}" alt="">`;
      }
      return `<img src="${escapeAttr(p.image)}" alt="" loading="lazy">`;
    }
    return `<span>Photo via admin</span>`;
  }

  function renderCategories() {
    const grid = $('#catGrid');
    if (!grid) return;
    grid.innerHTML = (state.data.categories || []).map(c => `
      <button class="cat-tile" type="button" data-cat="${c.id}">
        <span class="cat-count">${countByCategory(c.id)} items</span>
        <h3>${escapeHtml(c.name)}</h3>
        <span>${escapeHtml(c.blurb || '')}</span>
      </button>
    `).join('');
    $$('.cat-tile', grid).forEach(btn => btn.addEventListener('click', () => {
      state.category = btn.dataset.cat;
      renderFilters();
      renderProducts();
      $('#catalog')?.scrollIntoView({ behavior: 'smooth' });
    }));
  }

  function renderFilters() {
    const wrap = $('#filterChips');
    if (!wrap) return;
    const chips = [{ id: 'all', name: 'All' }].concat(state.data.categories || []);
    wrap.innerHTML = chips.map(c => `
      <button type="button" class="chip ${state.category === c.id ? 'active' : ''}" data-cat="${c.id}">${escapeHtml(c.name)}</button>
    `).join('');
    $$('.chip', wrap).forEach(btn => btn.addEventListener('click', () => {
      state.category = btn.dataset.cat;
      renderFilters();
      renderProducts();
    }));
  }

  function renderProducts() {
    const grid = $('#productGrid');
    if (!grid) return;
    const list = filtered();
    if (!list.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <strong>Catalog waiting for inventory</strong>
          Product names, prices, and photos load from Excel / the admin dashboard — nothing is hard-coded here.
        </div>`;
      return;
    }
    grid.innerHTML = list.map(p => `
      <article class="product-card">
        <div class="product-media">${productImage(p)}</div>
        <div class="product-body">
          <div class="cat">${escapeHtml(labelCat(p.category))}</div>
          <h3>${escapeHtml(p.name)}</h3>
          <div class="product-meta">
            <span class="price">${BLD.money(p.price, state.data.settings.currency)}</span>
            <span class="unit">/ ${escapeHtml(p.unit || 'unit')}</span>
          </div>
          <button type="button" class="btn btn-solid btn-add" data-add="${p.id}">Add to cart</button>
        </div>
      </article>
    `).join('');
    $$('[data-add]', grid).forEach(btn => btn.addEventListener('click', () => {
      const p = activeProducts().find(x => x.id === btn.dataset.add);
      if (p) addToCart(p);
    }));
  }

  function renderPromos() {
    const host = $('#promoList');
    const band = $('#promoBand');
    if (!host || !band) return;
    const items = []
      .concat((state.data.discounts || []).filter(d => d.active !== false).map(d => ({
        badge: 'Discount', title: d.title, body: d.detail || d.description || '', image: d.image || ''
      })))
      .concat((state.data.events || []).filter(e => e.active !== false).map(e => ({
        badge: 'Event', title: e.title, body: [e.date, e.detail || e.description].filter(Boolean).join(' · '), image: e.image || ''
      })));
    if (!items.length) { band.hidden = true; return; }
    band.hidden = false;
    host.innerHTML = items.slice(0, 6).map(i => `
      <div class="promo-item${i.image ? ' has-img' : ''}">
        ${i.image ? `<img class="promo-img" src="${escapeAttr(i.image)}" alt="">` : ''}
        <span class="badge-sale">${escapeHtml(i.badge)}</span>
        <h4>${escapeHtml(i.title || 'Update')}</h4>
        <p>${escapeHtml(i.body || '')}</p>
      </div>
    `).join('');
  }

  function renderReviews() {
    const list = $('#reviewList');
    const sel = $('#fbProduct');
    if (sel) {
      const cur = sel.value;
      const opts = ['General service'].concat(
        activeProducts().slice(0, 40).map(p => p.name)
      );
      sel.innerHTML = opts.map(o => `<option value="${escapeAttr(o)}">${escapeHtml(o)}</option>`).join('');
      if (opts.includes(cur)) sel.value = cur;
    }
    if (!list) return;
    const reviews = (state.data.reviews || []).slice(0, 8);
    if (!reviews.length) {
      list.innerHTML = '<div class="empty-state"><strong>Be the first</strong>Leave a rating — it helps us improve every day.</div>';
      return;
    }
    list.innerHTML = reviews.map(r => `
      <article class="review-card">
        <div class="review-top">
          <strong>${escapeHtml(r.name || 'Guest')}</strong>
          <span class="stars">${'★'.repeat(r.rating || 0)}${'☆'.repeat(5 - (r.rating || 0))}</span>
        </div>
        <div class="review-meta">${escapeHtml(r.reaction || '')} · ${escapeHtml(r.product || 'General')}</div>
        <p>${escapeHtml(r.comment || '')}</p>
      </article>`).join('');
  }

  function wireFeedback() {
    const form = $('#feedbackForm');
    if (!form || form.dataset.wired) return;
    form.dataset.wired = '1';
    const setStars = (n) => {
      $('#fbRating').value = String(n);
      $$('#starPick [data-star]').forEach(b => {
        b.classList.toggle('on', Number(b.dataset.star) <= n);
      });
    };
    setStars(5);
    $$('#starPick [data-star]').forEach(b => {
      b.addEventListener('click', () => setStars(Number(b.dataset.star)));
    });
    $$('#reactionPick [data-reaction]').forEach(b => {
      b.addEventListener('click', () => {
        $$('#reactionPick [data-reaction]').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        $('#fbReaction').value = b.dataset.reaction;
      });
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const rating = parseInt($('#fbRating').value, 10) || 5;
      BLD.update(db => {
        db.reviews = db.reviews || [];
        db.reviews.unshift({
          id: BLD.uid('rev'),
          name: ($('#fbName').value || '').trim() || 'Guest',
          rating,
          reaction: $('#fbReaction').value || '',
          product: $('#fbProduct').value || 'General service',
          comment: ($('#fbComment').value || '').trim(),
          at: new Date().toISOString()
        });
      });
      state.data = BLD.get();
      $('#fbComment').value = '';
      const thanks = $('#fbThanks');
      if (thanks) { thanks.hidden = false; setTimeout(() => { thanks.hidden = true; }, 4000); }
      renderReviews();
      toast('Thanks for your feedback!');
    });
  }

  function renderAbout() {
    const about = state.data.settings.about || {};
    const story = $('#aboutStory');
    const mission = $('#aboutMission');
    if (story) story.textContent = about.story || '';
    if (mission) mission.textContent = about.mission || '';
  }

  function socialHtml(s) {
    const links = [
      ['Facebook', s.facebook],
      ['Instagram', s.instagram],
      ['X', s.twitter],
      ['TikTok', s.tiktok],
      ['YouTube', s.youtube],
      ['WhatsApp', s.whatsappChannel]
    ].filter(([, url]) => url);
    if (!links.length) return '<p style="color:var(--muted);font-size:.9rem">Social links appear here when the owner adds them in admin.</p>';
    return links.map(([label, url]) => `<a class="social-chip" href="${escapeAttr(url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`).join('');
  }

  function renderSocial() {
    const s = state.data.settings.social || {};
    const html = socialHtml(s);
    const a = $('#socialLinks');
    const b = $('#footerSocial');
    if (a) a.innerHTML = html;
    if (b) b.innerHTML = html;
  }

  function renderTeam() {
    const grid = $('#teamGrid');
    if (!grid) return;
    const team = state.data.team || [];
    if (!team.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><strong>Team coming soon</strong>Members are added from the admin portal.</div>';
      return;
    }
    grid.innerHTML = team.map(t => {
      let img = '';
      if (t.photo) {
        if (String(t.photo).startsWith('media:')) {
          const m = (state.data.media || []).find(x => x.id === t.photo.replace('media:', ''));
          if (m) img = `<img src="${m.dataUrl}" alt="">`;
        } else img = `<img src="${escapeAttr(t.photo)}" alt="">`;
      }
      return `
        <article class="team-card">
          <div class="team-photo">${img || '<span>Photo</span>'}</div>
          <h3>${escapeHtml(t.name)}</h3>
          <div class="role">${escapeHtml(t.role || '')}</div>
          <p>${escapeHtml(t.bio || '')}</p>
        </article>`;
    }).join('');
  }

  function renderAds() {
    const grid = $('#adsGrid');
    if (!grid) return;
    const ads = (state.data.ads || []).filter(a => a.active !== false);
    if (!ads.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><strong>Partner spotlight</strong>Rwandan businesses advertised by the shop will appear here.</div>';
      return;
    }
    grid.innerHTML = ads.map(a => `
      <a class="ad-card" href="${escapeAttr(a.link || '#')}" ${a.link ? 'target="_blank" rel="noopener"' : ''}>
        ${a.image ? `<img src="${escapeAttr(a.image)}" alt="">` : '<div class="ad-ph">Partner</div>'}
        <div class="ad-body">
          <h3>${escapeHtml(a.businessName)}</h3>
          <p>${escapeHtml(a.blurb || '')}</p>
        </div>
      </a>
    `).join('');
  }

  function renderGallery() {
    const grid = $('#galleryGrid');
    if (!grid) return;
    const media = (state.data.media || []).filter(m => m.kind === 'business' || m.kind === 'event' || !m.kind);
    if (!media.length) {
      grid.innerHTML = Array.from({ length: 4 }).map(() => `
        <figure><div class="ph">Business photos appear after admin upload</div></figure>
      `).join('');
      return;
    }
    grid.innerHTML = media.slice(0, 8).map(m => `
      <figure><img src="${m.dataUrl}" alt="${escapeAttr(m.caption || '')}" loading="lazy"></figure>
    `).join('');
  }

  function renderSettingsBits() {
    const s = state.data.settings || {};
    $$('[data-shop-name]').forEach(el => { el.textContent = s.shopName || 'Boutique La Différence'; });
    $$('[data-tagline]').forEach(el => { el.textContent = s.tagline || ''; });
    $$('[data-address]').forEach(el => { el.textContent = s.address || ''; });
    const phone = $('#shopPhone');
    if (phone) {
      phone.textContent = s.phone || 'Add phone in admin';
      if (s.phone) phone.href = 'tel:' + s.phone.replace(/\s+/g, '');
    }
    const wa = $('#shopWhatsapp');
    if (wa) {
      if (s.whatsapp) {
        wa.href = 'https://wa.me/' + s.whatsapp.replace(/\D/g, '');
        wa.hidden = false;
      } else wa.hidden = true;
    }
    const map = $('#mapFrame');
    if (map && s.mapEmbed) map.src = s.mapEmbed;
    const hours = $('#hoursTable');
    if (hours && s.hours) {
      hours.innerHTML = s.hours.map(([d, h]) => `<tr><td>${escapeHtml(d)}</td><td>${escapeHtml(h)}</td></tr>`).join('');
    }
  }

  function setupHeroVideo() {
    const video = $('#heroVideo');
    const canvas = $('#heroCanvas');
    const url = state.data.settings.heroVideoUrl;
    if (url && video) {
      video.src = url;
      video.hidden = false;
      if (canvas) canvas.hidden = true;
      video.play().catch(() => {});
      return;
    }
    if (video) video.hidden = true;
    if (canvas) {
      canvas.hidden = false;
      startCinematicCanvas(canvas);
    }
  }

  let canvasStarted = false;
  function startCinematicCanvas(canvas) {
    if (canvasStarted) return;
    canvasStarted = true;
    const ctx = canvas.getContext('2d');
    let w, h, t0 = performance.now();
    const orbs = Array.from({ length: 18 }, () => ({
      x: Math.random(), y: Math.random(), r: 40 + Math.random() * 120,
      vx: (Math.random() - 0.5) * 0.00015, vy: (Math.random() - 0.5) * 0.00012,
      a: 0.04 + Math.random() * 0.08
    }));
    function resize() {
      w = canvas.width = canvas.clientWidth * devicePixelRatio;
      h = canvas.height = canvas.clientHeight * devicePixelRatio;
    }
    function frame(now) {
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h);
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#07140f');
      g.addColorStop(0.45, '#123226');
      g.addColorStop(1, '#0a1c14');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 5; i++) {
        const x = (0.15 + i * 0.18 + Math.sin(t * 0.15 + i) * 0.03) * w;
        const shaft = ctx.createLinearGradient(x, 0, x + 80, h);
        shaft.addColorStop(0, 'rgba(201,162,39,0.10)');
        shaft.addColorStop(1, 'rgba(7,20,15,0)');
        ctx.fillStyle = shaft;
        ctx.fillRect(x, 0, 90 * devicePixelRatio, h);
      }
      orbs.forEach(o => {
        o.x += o.vx; o.y += o.vy;
        if (o.x < -0.2 || o.x > 1.2) o.vx *= -1;
        if (o.y < -0.2 || o.y > 1.2) o.vy *= -1;
        const grd = ctx.createRadialGradient(o.x * w, o.y * h, 0, o.x * w, o.y * h, o.r * devicePixelRatio);
        grd.addColorStop(0, `rgba(201,162,39,${o.a})`);
        grd.addColorStop(1, 'rgba(7,20,15,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(o.x * w, o.y * h, o.r * devicePixelRatio, 0, Math.PI * 2);
        ctx.fill();
      });
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        requestAnimationFrame(frame);
      }
    }
    resize();
    window.addEventListener('resize', resize);
    requestAnimationFrame(frame);
  }

  function openCart(open) {
    state.cartOpen = open;
    $('#cartDrawer')?.classList.toggle('open', open);
    $('#cartScrim')?.classList.toggle('open', open);
    if (open) renderCartDrawer();
  }

  function renderCartDrawer() {
    const body = $('#cartBody');
    const items = cartItems();
    if (!body) return;
    if (!items.length) {
      body.innerHTML = '<p class="cart-empty">Your cart is empty. Add products from the catalog.</p>';
    } else {
      body.innerHTML = items.map(i => `
        <div class="cart-row">
          <div>
            <strong>${escapeHtml(i.name)}</strong>
            <div class="muted">${BLD.money(i.price, state.data.settings.currency)} / ${escapeHtml(i.unit || 'unit')}</div>
          </div>
          <div class="qty">
            <button type="button" data-q="${i.id}" data-d="-1">−</button>
            <span>${i.qty}</span>
            <button type="button" data-q="${i.id}" data-d="1">+</button>
          </div>
        </div>
      `).join('');
      $$('[data-q]', body).forEach(btn => btn.addEventListener('click', () => {
        const row = cartItems().find(x => x.id === btn.dataset.q);
        if (!row) return;
        setQty(row.id, row.qty + Number(btn.dataset.d));
      }));
    }
    const total = $('#cartTotal');
    if (total) total.textContent = BLD.money(cartTotal(), state.data.settings.currency);
    updateCartBadge();
  }

  function checkout() {
    const items = cartItems();
    if (!items.length) return toast('Cart is empty');
    const name = $('#coName')?.value.trim();
    const phone = $('#coPhone')?.value.trim();
    const addr = $('#coAddr')?.value.trim();
    if (!name || !phone) return toast('Name and phone are required');

    const lines = items.map(i => `• ${i.name} x${i.qty} = ${Math.round(i.price * i.qty)}`);
    const total = cartTotal();
    const order = {
      id: BLD.uid('ord'),
      customer: name,
      phone,
      address: addr,
      items,
      total,
      status: 'new',
      createdAt: new Date().toISOString()
    };
    BLD.update(db => {
      db.orders = db.orders || [];
      db.orders.unshift(order);
    });
    BLD.logActivity('order', 'Web cart order from ' + name + ' — ' + BLD.money(total));

    const wa = (state.data.settings.whatsapp || '').replace(/\D/g, '') || '25079401854';
    const msg = `New order — Boutique La Différence%0AName: ${encodeURIComponent(name)}%0APhone: ${encodeURIComponent(phone)}%0AAddress: ${encodeURIComponent(addr || '—')}%0A%0A${lines.map(encodeURIComponent).join('%0A')}%0A%0ATotal: ${encodeURIComponent(BLD.money(total))}`;
    window.open(`https://wa.me/${wa}?text=${msg}`, '_blank');
    saveCart([]);
    renderCartDrawer();
    toast('Order sent — we will confirm on WhatsApp');
  }

  function renderChat() {
    const body = $('#chatBody');
    if (!body) return;
    const msgs = state.data.chatMessages || [];
    const welcome = state.data.settings.chatWelcome || 'Muraho! How can we help?';
    if (!msgs.length) {
      body.innerHTML = `<div class="chat-bubble admin"><div class="meta">Shop</div>${escapeHtml(welcome)}</div>`;
      return;
    }
    body.innerHTML = msgs.map(m => `
      <div class="chat-bubble ${m.from === 'admin' ? 'admin' : 'customer'}">
        <div class="meta">${escapeHtml(m.from)}</div>${escapeHtml(m.text)}
      </div>
    `).join('');
    body.scrollTop = body.scrollHeight;
  }

  function sendChat() {
    const input = $('#chatInput');
    const text = input?.value.trim();
    if (!text) return;
    BLD.update(db => {
      db.chatMessages = db.chatMessages || [];
      db.chatMessages.push({ id: BLD.uid('msg'), from: 'customer', text, at: new Date().toISOString() });
    });
    input.value = '';
    state.data = BLD.get();
    renderChat();
  }

  function refresh() {
    state.data = BLD.get();
    renderSettingsBits();
    renderCategories();
    renderFilters();
    renderProducts();
    renderPromos();
    renderAbout();
    renderSocial();
    renderTeam();
    renderAds();
    renderGallery();
    renderReviews();
    setupHeroVideo();
    updateCartBadge();
    renderChat();
  }

  function wire() {
    wireFeedback();
    $('#catalogSearch')?.addEventListener('input', (e) => {
      state.query = e.target.value;
      renderProducts();
    });
    const nav = $('#siteNav');
    window.addEventListener('scroll', () => {
      nav?.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });
    const toggle = $('#menuToggle');
    const links = $('#navLinks');
    toggle?.addEventListener('click', () => links?.classList.toggle('open'));
    $$('a', links).forEach(a => a.addEventListener('click', () => links?.classList.remove('open')));

    $('#cartBtn')?.addEventListener('click', () => openCart(true));
    $('#cartClose')?.addEventListener('click', () => openCart(false));
    $('#cartScrim')?.addEventListener('click', () => openCart(false));
    $('#btnCheckout')?.addEventListener('click', checkout);

    $('#chatFab')?.addEventListener('click', () => {
      const w = $('#chatWidget');
      w.hidden = !w.hidden;
      if (!w.hidden) renderChat();
    });
    $('#chatClose')?.addEventListener('click', () => { $('#chatWidget').hidden = true; });
    $('#chatSend')?.addEventListener('click', sendChat);
    $('#chatInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });

    window.addEventListener('bld:store', refresh);
    window.addEventListener('storage', (e) => {
      if (e.key === BLD.STORE_KEY) refresh();
    });

    const sheet = BLD.get().settings.sheetUrl;
    if (sheet) BLD.syncFromSheet(sheet).then(() => refresh()).catch(() => {});
  }

  document.addEventListener('DOMContentLoaded', () => {
    refresh();
    wire();
  });
})();
