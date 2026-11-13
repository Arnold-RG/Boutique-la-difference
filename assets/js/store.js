/**
 * Public storefront — catalog, cart, about, team, ads, chat (no login).
 * Cart: IndexedDB + localStorage via BLD.loadCart / BLD.saveCart.
 * Catalog: seeded from data/products.json when the vault is empty.
 */
(function () {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  let state = { category: 'all', query: '', data: null, cartOpen: false, cart: [] };
  let cartBusy = false;

  function escapeHtml(s) {
    if (window.ViraSecure && ViraSecure.escapeHtml) return ViraSecure.escapeHtml(s);
    return (BLD.escapeHtml ? BLD.escapeHtml(s) : String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  async function syncCartFromVault() {
    state.cart = await BLD.loadCart();
    updateCartBadge();
    updateStickyCart();
  }

  async function persistCart(items) {
    state.cart = items;
    await BLD.saveCart(items);
    updateCartBadge();
    updateStickyCart();
  }

  function cartItems() { return state.cart || []; }
  function cartCount() { return cartItems().reduce((a, i) => a + (i.qty || 0), 0); }
  function cartTotal() {
    return cartItems().reduce((a, i) => a + (Number(i.price) || 0) * (i.qty || 0), 0);
  }

  async function addToCart(product, btn) {
    if (cartBusy) return;
    cartBusy = true;
    try {
      const items = cartItems().slice();
      const existing = items.find(i => i.id === product.id);
      if (existing) existing.qty += 1;
      else {
        items.push({
          id: product.id,
          name: String(product.name || '').slice(0, 200),
          price: Number(product.price) || 0,
          unit: String(product.unit || 'unit').slice(0, 40),
          qty: 1
        });
      }
      await persistCart(items);
      pulseAddButton(btn);
      flyToCart(btn);
      toast((product.name || 'Item') + ' added to cart');
      if (state.cartOpen) renderCartDrawer();
    } finally {
      cartBusy = false;
    }
  }

  function pulseAddButton(btn) {
    if (!btn || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    btn.classList.remove('is-added');
    void btn.offsetWidth;
    btn.classList.add('is-added');
    setTimeout(() => btn.classList.remove('is-added'), 650);
  }

  function flyToCart(fromEl) {
    if (!fromEl || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const target = $('#stickyCartBar') || $('#cartBtn');
    if (!target) return;
    const a = fromEl.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    const dot = document.createElement('span');
    dot.className = 'cart-fly';
    dot.style.left = (a.left + a.width / 2) + 'px';
    dot.style.top = (a.top + a.height / 2) + 'px';
    document.body.appendChild(dot);
    requestAnimationFrame(() => {
      dot.style.transform = 'translate(' +
        ((b.left + b.width / 2) - (a.left + a.width / 2)) + 'px,' +
        ((b.top + b.height / 2) - (a.top + a.height / 2)) + 'px) scale(.35)';
      dot.style.opacity = '0';
    });
    setTimeout(() => dot.remove(), 520);
  }

  async function setQty(id, qty) {
    let items = cartItems().slice();
    if (qty <= 0) items = items.filter(i => i.id !== id);
    else {
      const row = items.find(i => i.id === id);
      if (row) row.qty = qty;
    }
    await persistCart(items);
    renderCartDrawer();
  }

  function updateCartBadge() {
    const n = String(cartCount());
    const el = $('#cartCount');
    const prev = el ? el.textContent : '';
    if (el) {
      el.textContent = n;
      if (prev !== n) {
        el.classList.remove('bump');
        void el.offsetWidth;
        el.classList.add('bump');
      }
    }
    const stickyCount = $('#stickyCartCount');
    if (stickyCount) stickyCount.textContent = n;
    const btn = $('#cartBtn');
    if (btn) btn.setAttribute('aria-label', 'Open cart, ' + n + (n === '1' ? ' item' : ' items'));
  }

  function updateStickyCart() {
    const bar = $('#stickyCartBar');
    if (!bar) return;
    const n = cartCount();
    const total = $('#stickyCartTotal');
    if (total && state.data) {
      total.textContent = BLD.money(cartTotal(), state.data.settings.currency);
    }
    bar.classList.toggle('is-visible', n > 0);
    bar.setAttribute('aria-hidden', n > 0 ? 'false' : 'true');
    document.body.classList.toggle('has-sticky-cart', n > 0);
  }

  function toast(msg) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = String(msg == null ? '' : msg);
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.remove(), 3200);
  }

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
    const alt = escapeAttr(p.name || 'Product');
    if (p.image) {
      if (p.image.startsWith('media:') || p.image.startsWith('id:')) {
        const id = p.image.replace(/^(media:|id:)/, '');
        const m = (state.data.media || []).find(x => x.id === id);
        if (m && m.dataUrl) return '<img src="' + m.dataUrl + '" alt="' + alt + '" loading="lazy" decoding="async">';
      }
      return '<img src="' + escapeAttr(p.image) + '" alt="' + alt + '" loading="lazy" decoding="async">';
    }
    return '<span class="ph-mark">No photograph</span>';
  }

  function observeReveals(root) {
    if (!('IntersectionObserver' in window)) {
      $$('[data-reveal]', root).forEach(el => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    $$('[data-reveal]', root).forEach((el, i) => {
      el.style.setProperty('--reveal-delay', (i % 10) * 55 + 'ms');
      io.observe(el);
    });
  }

  function renderCategories() {
    const grid = $('#catGrid');
    if (!grid) return;
    grid.innerHTML = (state.data.categories || []).map(c => `
      <button class="cat-tile" type="button" data-cat="${escapeAttr(c.id)}" data-reveal>
        <span class="cat-count">${countByCategory(c.id)} ${countByCategory(c.id) === 1 ? 'item' : 'items'}</span>
        <h3>${escapeHtml(c.name)}</h3>
        <span>${escapeHtml(c.blurb || '')}</span>
      </button>
    `).join('');
    $$('.cat-tile', grid).forEach(btn => btn.addEventListener('click', () => {
      state.category = btn.dataset.cat;
      renderFilters();
      renderProducts();
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      $('#catalog')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    }));
    observeReveals(grid);
  }

  function renderFilters() {
    const wrap = $('#filterChips');
    if (!wrap) return;
    const chips = [{ id: 'all', name: 'All' }].concat(state.data.categories || []);
    wrap.innerHTML = chips.map(c => `
      <button type="button" class="chip ${state.category === c.id ? 'active' : ''}" data-cat="${escapeAttr(c.id)}" aria-pressed="${state.category === c.id ? 'true' : 'false'}">${escapeHtml(c.name)}</button>
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
    const countEl = $('#catalogCount');
    if (countEl) {
      const n = list.length;
      countEl.textContent = n === 1 ? '1 product' : n + ' products';
    }
    if (!list.length) {
      const waiting = !activeProducts().length;
      grid.innerHTML = waiting ? `
        <div class="empty-state">
          <strong>The list is quiet</strong>
          Prices appear here when the shop publishes stock on this browser.
        </div>` : `
        <div class="empty-state">
          <strong>Nothing under that name</strong>
          Try another word, or look through a different department.
        </div>`;
      return;
    }
    grid.innerHTML = list.map(p => {
      const stockN = Number(p.stock) || 0;
      const stockText = stockN > 5 ? stockN + ' in stock' : stockN > 0 ? 'Only ' + stockN + ' left' : 'Ask in store';
      return `
      <article class="product-card" data-reveal>
        <div class="product-media">
          ${p.featured ? '<span class="flag">Featured</span>' : ''}
          ${productImage(p)}
        </div>
        <div class="product-body">
          <div class="cat">${escapeHtml(labelCat(p.category))}</div>
          <h3>${escapeHtml(p.name)}</h3>
          ${p.description ? `<p class="product-desc">${escapeHtml(p.description)}</p>` : ''}
          <div class="product-meta">
            <span class="price">${BLD.money(p.price, state.data.settings.currency)}</span>
            <span class="unit">${escapeHtml(p.unit || 'unit')}</span>
          </div>
          <div class="stock${stockN > 0 && stockN <= 5 ? ' low' : ''}">${escapeHtml(stockText)}</div>
          <button type="button" class="btn btn-ghost btn-add" data-add="${escapeAttr(p.id)}" aria-label="Add ${escapeAttr(p.name)} to cart"><span class="btn-add-label">Add to cart</span></button>
        </div>
      </article>`;
    }).join('');
    $$('[data-add]', grid).forEach(btn => btn.addEventListener('click', () => {
      const p = activeProducts().find(x => x.id === btn.dataset.add);
      if (p) addToCart(p, btn);
    }));
    observeReveals(grid);
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
      <div class="promo-item${i.image ? ' has-img' : ''}" data-reveal>
        ${i.image ? `<img class="promo-img" src="${escapeAttr(i.image)}" alt="" loading="lazy">` : ''}
        <span class="badge-sale">${escapeHtml(i.badge)}</span>
        <h4>${escapeHtml(i.title || 'Update')}</h4>
        <p>${escapeHtml(i.body || '')}</p>
      </div>
    `).join('');
    observeReveals(host);
  }

  function ratingWord(n) {
    return ({ 1: 'Poor', 2: 'Fair', 3: 'Okay', 4: 'Good', 5: 'Excellent' })[n] || 'Excellent';
  }

  function reactionEmoji() {
    return '';
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

    const reviews = state.data.reviews || [];
    const avgEl = $('#fbAvgScore');
    const starsEl = $('#fbAvgStars');
    const countEl = $('#fbReviewCount');
    if (avgEl && starsEl && countEl) {
      if (!reviews.length) {
        avgEl.textContent = '—';
        starsEl.textContent = '☆☆☆☆☆';
        countEl.textContent = 'No reviews yet — be the first';
      } else {
        const avg = reviews.reduce((a, r) => a + (Number(r.rating) || 0), 0) / reviews.length;
        const rounded = Math.round(avg);
        avgEl.textContent = avg.toFixed(1);
        starsEl.textContent = '★'.repeat(rounded) + '☆'.repeat(5 - rounded);
        countEl.textContent = reviews.length + (reviews.length === 1 ? ' review' : ' reviews');
      }
    }

    if (!list) return;
    const shown = reviews.slice(0, 8);
    if (!shown.length) {
      list.innerHTML = '<div class="empty-state"><strong>Be the first</strong>Your rating helps neighbours choose with confidence.</div>';
      return;
    }
    list.innerHTML = shown.map(r => {
      const initial = String(r.name || 'G').trim().charAt(0).toUpperCase() || 'G';
      const when = (r.at || '').replace('T', ' ').slice(0, 10);
      return `
      <article class="review-card">
        <div class="review-avatar" aria-hidden="true">${escapeHtml(initial)}</div>
        <div class="review-top">
          <strong>${escapeHtml(r.name || 'Guest')}</strong>
          <span class="stars">${'★'.repeat(r.rating || 0)}${'☆'.repeat(5 - (r.rating || 0))}</span>
        </div>
        <div class="review-meta">${reactionEmoji(r.reaction) ? reactionEmoji(r.reaction) + ' ' : ''}${escapeHtml(r.reaction || '')} · ${escapeHtml(r.product || 'General')}${when ? ' · ' + escapeHtml(when) : ''}</div>
        ${r.comment ? `<p>${escapeHtml(r.comment)}</p>` : '<p style="opacity:.55">No written comment</p>'}
      </article>`;
    }).join('');
  }

  function wireFeedback() {
    const form = $('#feedbackForm');
    if (!form || form.dataset.wired) return;
    form.dataset.wired = '1';
    const setStars = (n) => {
      $('#fbRating').value = String(n);
      $$('#starPick [data-star]').forEach(b => {
      const on = Number(b.dataset.star) <= n;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', Number(b.dataset.star) === n ? 'true' : 'false');
    });
      const label = $('#fbRatingLabel');
      if (label) label.textContent = ratingWord(n);
    };
    setStars(5);
    $$('#starPick [data-star]').forEach(b => {
      b.addEventListener('click', () => setStars(Number(b.dataset.star)));
      b.addEventListener('mouseenter', () => {
        const n = Number(b.dataset.star);
        $$('#starPick [data-star]').forEach(x => {
          x.classList.toggle('on', Number(x.dataset.star) <= n);
        });
      });
    });
    $('#starPick')?.addEventListener('mouseleave', () => setStars(parseInt($('#fbRating').value, 10) || 5));
    $('#starPick')?.addEventListener('keydown', (e) => {
      const cur = parseInt($('#fbRating').value, 10) || 5;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        setStars(Math.min(5, cur + 1));
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        setStars(Math.max(1, cur - 1));
      }
    });
    $$('#reactionPick [data-reaction]').forEach(b => {
      b.addEventListener('click', () => {
        $$('#reactionPick [data-reaction]').forEach(x => {
          x.classList.remove('active');
          x.setAttribute('aria-pressed', 'false');
        });
        b.classList.add('active');
        b.setAttribute('aria-pressed', 'true');
        $('#fbReaction').value = b.dataset.reaction;
      });
    });
    const comment = $('#fbComment');
    const counter = $('#fbCharCount');
    comment?.addEventListener('input', () => {
      if (counter) counter.textContent = String((comment.value || '').length);
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const rating = parseInt($('#fbRating').value, 10) || 5;
      BLD.update(db => {
        db.reviews = db.reviews || [];
        db.reviews.unshift({
          id: BLD.uid('rev'),
          name: ($('#fbName').value || '').trim().slice(0, 80) || 'Guest',
          rating,
          reaction: $('#fbReaction').value || '',
          product: ($('#fbProduct').value || 'General service').slice(0, 200),
          comment: ($('#fbComment').value || '').trim().slice(0, 500),
          at: new Date().toISOString()
        });
      });
      state.data = BLD.get();
      if (comment) comment.value = '';
      if (counter) counter.textContent = '0';
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
    if (!links.length) return '';
    return links.map(([label, url]) => `<a class="social-chip" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`).join('');
  }

  function renderSocial() {
    const s = state.data.settings.social || {};
    const html = socialHtml(s);
    const a = $('#socialLinks');
    const b = $('#footerSocial');
    if (a) a.innerHTML = html;
    if (b) b.innerHTML = html;
    const panel = $('#socialPanel');
    if (panel) panel.hidden = !html;
  }

  function renderTeam() {
    const grid = $('#teamGrid');
    if (!grid) return;
    const team = state.data.team || [];
    if (!team.length) {
      grid.innerHTML = '<div class="empty-state"><strong>The counter</strong>Names appear here when the shop adds them.</div>';
      return;
    }
    grid.innerHTML = team.map(t => {
      let img = '';
      if (t.photo) {
        if (String(t.photo).startsWith('media:')) {
          const m = (state.data.media || []).find(x => x.id === t.photo.replace('media:', ''));
          if (m) img = `<img src="${m.dataUrl}" alt="${escapeAttr(t.name || 'Team member')}" loading="lazy">`;
        } else img = `<img src="${escapeAttr(t.photo)}" alt="${escapeAttr(t.name || 'Team member')}" loading="lazy">`;
      }
      return `
        <article class="team-card" data-reveal>
          <div class="team-photo">${img || '<span>Photo</span>'}</div>
          <h3>${escapeHtml(t.name)}</h3>
          <div class="role">${escapeHtml(t.role || '')}</div>
          <p>${escapeHtml(t.bio || '')}</p>
        </article>`;
    }).join('');
    observeReveals(grid);
  }

  function renderAds() {
    const grid = $('#adsGrid');
    if (!grid) return;
    const ads = (state.data.ads || []).filter(a => a.active !== false);
    if (!ads.length) {
      grid.innerHTML = '<div class="empty-state"><strong>The board is clear</strong>Other businesses show up here when the shop mentions them.</div>';
      return;
    }
    grid.innerHTML = ads.map(a => `
      <a class="ad-card" href="${escapeAttr(a.link || '#')}" ${a.link ? 'target="_blank" rel="noopener noreferrer"' : ''} data-reveal>
        ${a.image ? `<img src="${escapeAttr(a.image)}" alt="${escapeAttr(a.businessName || 'Neighbor')}" loading="lazy">` : '<div class="ad-ph">Neighbor</div>'}
        <div class="ad-body">
          <h3>${escapeHtml(a.businessName)}</h3>
          <p>${escapeHtml(a.blurb || '')}</p>
        </div>
      </a>
    `).join('');
    observeReveals(grid);
  }

  function renderGallery() {
    const grid = $('#galleryGrid');
    if (!grid) return;
    const media = (state.data.media || []).filter(m => m.kind === 'business' || m.kind === 'event' || !m.kind);
    if (!media.length) {
      grid.innerHTML = '<div class="empty-state"><strong>No photographs yet</strong>Pictures of the shop will hang here.</div>';
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
      if (s.phone) {
        phone.hidden = false;
        phone.textContent = 'Call the shop';
        phone.href = 'tel:' + s.phone.replace(/\s+/g, '');
      } else {
        phone.hidden = true;
        phone.removeAttribute('href');
      }
    }
    const wa = $('#shopWhatsapp');
    if (wa) {
      if (s.whatsapp) {
        wa.href = 'https://wa.me/' + s.whatsapp.replace(/\D/g, '');
        wa.rel = 'noopener noreferrer';
        wa.hidden = false;
      } else wa.hidden = true;
    }
    const map = $('#mapFrame');
    if (map && s.mapEmbed) map.src = s.mapEmbed;
    const hours = $('#hoursTable');
    if (hours && s.hours) {
      hours.innerHTML = '<caption class="sr-only">Opening hours</caption>' + s.hours.map(([d, h]) => `<tr><td>${escapeHtml(d)}</td><td>${escapeHtml(h)}</td></tr>`).join('');
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
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0;
    let h = 0;
    let running = true;
    let visible = true;
    const t0 = performance.now();
    const orbs = Array.from({ length: 7 }, (_, i) => ({
      x: 0.2 + (i % 4) * 0.18,
      y: 0.25 + (i % 3) * 0.22,
      r: 70 + i * 18,
      vx: (i % 2 ? 1 : -1) * 0.00004,
      vy: 0.00003,
      a: 0.05 + (i % 3) * 0.02
    }));
    function resize() {
      w = canvas.width = Math.max(1, canvas.clientWidth * dpr);
      h = canvas.height = Math.max(1, canvas.clientHeight * dpr);
    }
    function draw(now) {
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h);
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#101916');
      g.addColorStop(0.55, '#1a332b');
      g.addColorStop(1, '#0d1714');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      orbs.forEach((o) => {
        if (!reduce) {
          o.x += o.vx;
          o.y += Math.sin(t * 0.15 + o.r) * 0.00008;
          if (o.x < -0.15 || o.x > 1.15) o.vx *= -1;
        }
        const grd = ctx.createRadialGradient(o.x * w, o.y * h, 0, o.x * w, o.y * h, o.r * dpr);
        grd.addColorStop(0, 'rgba(196,165,116,' + o.a + ')');
        grd.addColorStop(1, 'rgba(16,25,22,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(o.x * w, o.y * h, o.r * dpr, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    function frame(now) {
      if (!running || !visible || document.hidden) return;
      draw(now);
      if (!reduce) requestAnimationFrame(frame);
    }
    resize();
    window.addEventListener('resize', () => { resize(); draw(performance.now()); });
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        if (visible && !reduce) requestAnimationFrame(frame);
      });
      io.observe(canvas);
    }
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && visible && !reduce) requestAnimationFrame(frame);
    });
    requestAnimationFrame((now) => {
      draw(now);
      if (!reduce) requestAnimationFrame(frame);
    });
  }

  function openCart(open) {
    state.cartOpen = open;
    const drawer = $('#cartDrawer');
    const scrim = $('#cartScrim');
    drawer?.classList.toggle('open', open);
    scrim?.classList.toggle('open', open);
    if (scrim) scrim.hidden = !open;
    drawer?.setAttribute('aria-hidden', open ? 'false' : 'true');
    document.body.classList.toggle('cart-open', open);
    if (open) {
      renderCartDrawer();
      const close = $('#cartClose');
      if (close) close.focus();
    } else if (drawer && document.activeElement && drawer.contains(document.activeElement)) {
      $('#cartBtn')?.focus();
    }
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
            <button type="button" data-q="${escapeAttr(i.id)}" data-d="-1" aria-label="Fewer ${escapeAttr(i.name)}">−</button>
            <span>${i.qty}</span>
            <button type="button" data-q="${escapeAttr(i.id)}" data-d="1" aria-label="More ${escapeAttr(i.name)}">+</button>
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
    updateStickyCart();
  }

  // Synchronous on purpose: WhatsApp must open inside the submit/click
  // handler (user activation), before any await, or browsers block it.
  function checkout() {
    const items = cartItems();
    if (!items.length) return toast('Your cart is empty');
    const name = ($('#coName')?.value || '').trim().slice(0, 80);
    const phone = ($('#coPhone')?.value || '').trim().slice(0, 40);
    const addr = ($('#coAddr')?.value || '').trim().slice(0, 200);
    if (!name || !phone) return toast('Add your name and phone so the shop can confirm');

    const lines = items.map(i => '• ' + i.name + ' x' + i.qty + ' — ' + BLD.money(i.price * i.qty));
    const total = cartTotal();
    const wa = (state.data.settings.whatsapp || '').replace(/\D/g, '');
    let url = '';
    if (wa) {
      const text = [
        'Order — Boutique La Différence',
        'Name: ' + name,
        'Phone: ' + phone,
        'Address: ' + (addr || '—'),
        '',
        lines.join('\n'),
        '',
        'Total: ' + BLD.money(total)
      ].join('\n');
      url = 'https://wa.me/' + wa + '?text=' + encodeURIComponent(text);
    }

    // Open first, synchronously, while the click still counts as user activation.
    let popup = null;
    if (url) {
      popup = window.open(url, '_blank');
      if (popup) {
        try { popup.opener = null; } catch (e) { /* cross-origin already */ }
      }
    }

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
    persistCart([]).then(renderCartDrawer, renderCartDrawer);

    if (!url) {
      toast('Order saved on this browser. The shop has not published a WhatsApp number yet.');
      return;
    }
    if (popup) {
      toast('The list is ready on WhatsApp. The shop will confirm.');
    } else {
      // Popup blocked anyway: hand over in this tab instead of showing a notice.
      window.location.href = url;
    }
  }

  function renderChat() {
    const body = $('#helpBody');
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
    const input = $('#helpInput');
    const text = (input?.value || '').trim().slice(0, 500);
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
    updateStickyCart();
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
    function setMenu(open) {
      links?.classList.toggle('open', open);
      toggle?.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle?.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
    }
    toggle?.addEventListener('click', () => setMenu(!links?.classList.contains('open')));
    $$('a', links).forEach(a => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('click', (e) => {
      if (!links?.classList.contains('open')) return;
      if (links.contains(e.target) || toggle?.contains(e.target)) return;
      setMenu(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if ($('#cartDrawer')?.classList.contains('open')) openCart(false);
      if (links?.classList.contains('open')) setMenu(false);
    });

    const sections = ['categories', 'catalog', 'about', 'team', 'feedback', 'visit']
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    if (sections.length && 'IntersectionObserver' in window) {
      const spy = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          $$('a', links).forEach((a) => {
            const on = a.getAttribute('href') === '#' + entry.target.id;
            if (on) a.setAttribute('aria-current', 'true');
            else a.removeAttribute('aria-current');
          });
        });
      }, { rootMargin: '-40% 0px -50% 0px', threshold: 0.01 });
      sections.forEach((section) => spy.observe(section));
    }

    $('#cartBtn')?.addEventListener('click', () => openCart(true));
    $('#stickyCartBar')?.addEventListener('click', () => openCart(true));
    $('#cartClose')?.addEventListener('click', () => openCart(false));
    $('#cartScrim')?.addEventListener('click', () => openCart(false));
    const checkoutForm = $('#checkoutForm');
    if (checkoutForm) {
      checkoutForm.addEventListener('submit', (e) => {
        e.preventDefault();
        checkout();
      });
    } else {
      $('#btnCheckout')?.addEventListener('click', checkout);
    }

    const helpForm = $('#helpFoot');
    if (helpForm && helpForm.tagName === 'FORM' && window.BLDChatForm) {
      BLDChatForm.bindChatForm(helpForm, sendChat);
    } else {
      $('#helpSend')?.addEventListener('click', sendChat);
      $('#helpInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendChat(); } });
    }
    window.addEventListener('bld:help-open', renderChat);
    renderChat();

    window.addEventListener('bld:store', refresh);
    window.addEventListener('bld:cart', (e) => {
      if (Array.isArray(e.detail)) state.cart = e.detail;
      updateCartBadge();
      updateStickyCart();
      if (state.cartOpen) renderCartDrawer();
    });
    window.addEventListener('storage', (e) => {
      if (e.key === BLD.STORE_KEY) refresh();
      if (e.key === BLD.CART_KEY) syncCartFromVault().then(() => {
        if (state.cartOpen) renderCartDrawer();
      });
    });

    const sheet = BLD.get().settings.sheetUrl;
    if (sheet) BLD.syncFromSheet(sheet).then(() => refresh()).catch(() => {});
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await syncCartFromVault();
    await BLD.ensureSeedCatalog();
    refresh();
    wire();
  });
})();
