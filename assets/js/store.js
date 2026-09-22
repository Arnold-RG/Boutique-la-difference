/**
 * Public storefront renderer — no login.
 */
(function () {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  let state = {
    category: 'all',
    query: '',
    data: null
  };

  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  function activeProducts() {
    return (state.data.products || []).filter(p => p.active !== false);
  }

  function filtered() {
    const q = state.query.trim().toLowerCase();
    return activeProducts().filter(p => {
      if (state.category !== 'all' && p.category !== state.category) return false;
      if (!q) return true;
      return [p.name, p.description, p.sku, p.category].join(' ').toLowerCase().includes(q);
    });
  }

  function countByCategory(id) {
    return activeProducts().filter(p => p.category === id).length;
  }

  function renderCategories() {
    const grid = $('#catGrid');
    if (!grid) return;
    const cats = state.data.categories || [];
    grid.innerHTML = cats.map(c => `
      <button class="cat-tile" type="button" data-cat="${c.id}">
        <span class="cat-count">${countByCategory(c.id)} items</span>
        <h3>${escapeHtml(c.name)}</h3>
        <span>${escapeHtml(c.blurb || '')}</span>
      </button>
    `).join('');
    $$('.cat-tile', grid).forEach(btn => {
      btn.addEventListener('click', () => {
        state.category = btn.dataset.cat;
        renderFilters();
        renderProducts();
        document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
      });
    });
  }

  function renderFilters() {
    const wrap = $('#filterChips');
    if (!wrap) return;
    const chips = [{ id: 'all', name: 'All' }].concat(state.data.categories || []);
    wrap.innerHTML = chips.map(c => `
      <button type="button" class="chip ${state.category === c.id ? 'active' : ''}" data-cat="${c.id}">${escapeHtml(c.name)}</button>
    `).join('');
    $$('.chip', wrap).forEach(btn => {
      btn.addEventListener('click', () => {
        state.category = btn.dataset.cat;
        renderFilters();
        renderProducts();
      });
    });
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
    return `<span>Photo via admin / Excel</span>`;
  }

  function renderProducts() {
    const grid = $('#productGrid');
    if (!grid) return;
    const list = filtered();
    if (!list.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <strong>Catalog waiting for your Excel data</strong>
          Product names, prices, and photos are not hardcoded here.
          Import a spreadsheet from the admin dashboard, or connect a Google Sheet.
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
        </div>
      </article>
    `).join('');
  }

  function labelCat(id) {
    const c = (state.data.categories || []).find(x => x.id === id);
    return c ? c.name : id;
  }

  function renderPromos() {
    const host = $('#promoList');
    const band = $('#promoBand');
    if (!host || !band) return;
    const discounts = state.data.discounts || [];
    const events = state.data.events || [];
    const items = []
      .concat(discounts.filter(d => d.active !== false).map(d => ({
        badge: 'Discount',
        title: d.title,
        body: d.detail || d.description || ''
      })))
      .concat(events.filter(e => e.active !== false).map(e => ({
        badge: 'Event',
        title: e.title,
        body: [e.date, e.detail || e.description].filter(Boolean).join(' · ')
      })));

    if (!items.length) {
      band.hidden = true;
      return;
    }
    band.hidden = false;
    host.innerHTML = items.slice(0, 6).map(i => `
      <div class="promo-item">
        <span class="badge-sale">${escapeHtml(i.badge)}</span>
        <h4>${escapeHtml(i.title || 'Update')}</h4>
        <p>${escapeHtml(i.body || '')}</p>
      </div>
    `).join('');
  }

  function renderGallery() {
    const grid = $('#galleryGrid');
    if (!grid) return;
    const media = (state.data.media || []).filter(m => m.kind === 'business' || m.kind === 'event' || !m.kind);
    if (!media.length) {
      grid.innerHTML = Array.from({ length: 4 }).map(() => `
        <figure><div class="ph">Business photos appear here after the admin uploads them</div></figure>
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

  function startCinematicCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    let w, h, raf, t0 = performance.now();
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

      // soft light shafts
      for (let i = 0; i < 5; i++) {
        const x = (0.15 + i * 0.18 + Math.sin(t * 0.15 + i) * 0.03) * w;
        const shaft = ctx.createLinearGradient(x, 0, x + 80, h);
        shaft.addColorStop(0, 'rgba(201,162,39,0.10)');
        shaft.addColorStop(0.5, 'rgba(47,107,79,0.05)');
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
        grd.addColorStop(0.45, `rgba(61,138,100,${o.a * 0.45})`);
        grd.addColorStop(1, 'rgba(7,20,15,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(o.x * w, o.y * h, o.r * devicePixelRatio, 0, Math.PI * 2);
        ctx.fill();
      });

      // film grain
      const img = ctx.getImageData(0, 0, Math.min(w, 640), Math.min(h, 360));
      for (let i = 0; i < img.data.length; i += 16) {
        const n = (Math.random() * 18) | 0;
        img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
      }
      ctx.putImageData(img, 0, 0);

      raf = requestAnimationFrame(frame);
    }
    resize();
    window.addEventListener('resize', resize);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      raf = requestAnimationFrame(frame);
    } else {
      frame(t0);
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }

  function refresh() {
    state.data = BLD.get();
    renderSettingsBits();
    renderCategories();
    renderFilters();
    renderProducts();
    renderPromos();
    renderGallery();
    setupHeroVideo();
  }

  function wire() {
    const search = $('#catalogSearch');
    if (search) {
      search.addEventListener('input', () => {
        state.query = search.value;
        renderProducts();
      });
    }
    const nav = $('#siteNav');
    window.addEventListener('scroll', () => {
      if (!nav) return;
      nav.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });
    const toggle = $('#menuToggle');
    const links = $('#navLinks');
    if (toggle && links) {
      toggle.addEventListener('click', () => links.classList.toggle('open'));
      $$('a', links).forEach(a => a.addEventListener('click', () => links.classList.remove('open')));
    }
    window.addEventListener('bld:store', refresh);
    window.addEventListener('storage', (e) => {
      if (e.key === BLD.STORE_KEY) refresh();
    });

    // Optional: auto-sync sheet if configured (silent)
    const sheet = BLD.get().settings.sheetUrl;
    if (sheet) {
      BLD.syncFromSheet(sheet).then(() => refresh()).catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    refresh();
    wire();
  });
})();
