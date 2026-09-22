/**
 * Admin dashboard — login (password + TOTP), CRUD, Excel sync, media.
 */
(function () {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  let tab = 'overview';
  let modal = null;
  let setupSecret = null;
  let pendingUser = null;

  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2800);
  }

  function requireAuth() {
    return BLDAuth.isSetup() && BLDAuth.hasSession();
  }

  /* ========== AUTH UI ========== */
  async function renderAuth() {
    const root = $('#app');
    await BLDAuth.loadQrScript();

    if (!BLDAuth.isSetup()) {
      if (!setupSecret) setupSecret = BLDAuth.generateTotpSecret();
      root.innerHTML = `
        <div class="auth-wrap">
          <div class="auth-card">
            <span class="badge">First-time secure setup</span>
            <h1 class="display">Create admin access</h1>
            <p>One owner account only. You will scan a QR code with Google Authenticator, Authy, or Microsoft Authenticator on an authorized phone.</p>
            <div class="field"><label>Username</label><input id="suUser" autocomplete="username" value="owner"></div>
            <div class="field"><label>Password (min 10 chars)</label><input id="suPass" type="password" autocomplete="new-password"></div>
            <div class="field"><label>Confirm password</label><input id="suPass2" type="password" autocomplete="new-password"></div>
            <div class="qr-box" id="qrBox"><canvas id="qrCanvas" width="180" height="180"></canvas></div>
            <p class="step-note">Scan the QR, then enter the 6-digit code from your app to finish setup.<br>Secret (backup): <code id="secretText"></code></p>
            <div class="field"><label>Authenticator code</label><input id="suTotp" inputmode="numeric" maxlength="6" placeholder="000000"></div>
            <div class="auth-error" id="authErr"></div>
            <button class="btn btn-brass" id="btnSetup">Complete secure setup</button>
          </div>
        </div>`;
      const user = 'owner';
      const url = BLDAuth.otpauthUrl(user, setupSecret);
      $('#secretText').textContent = setupSecret;
      BLDAuth.renderQr($('#qrCanvas') || $('#qrBox'), url);
      // re-render QR when username changes
      $('#suUser').addEventListener('input', () => {
        const u = $('#suUser').value.trim() || 'owner';
        const box = $('#qrBox');
        box.innerHTML = '<canvas id="qrCanvas" width="180" height="180"></canvas>';
        BLDAuth.renderQr($('#qrCanvas'), BLDAuth.otpauthUrl(u, setupSecret));
        $('#secretText').textContent = setupSecret;
      });
      $('#btnSetup').onclick = completeSetup;
      return;
    }

    if (!BLDAuth.hasSession()) {
      root.innerHTML = `
        <div class="auth-wrap">
          <div class="auth-card">
            <span class="badge">Admin only · Public shop has no login</span>
            <h1 class="display">Owner sign-in</h1>
            <p>Username, password, then a one-time code from your authenticator app (QR-enrolled device).</p>
            <div class="field"><label>Username</label><input id="liUser" autocomplete="username"></div>
            <div class="field"><label>Password</label><input id="liPass" type="password" autocomplete="current-password"></div>
            <div class="field"><label>Authenticator code</label><input id="liTotp" inputmode="numeric" maxlength="6" placeholder="000000"></div>
            <div class="auth-error" id="authErr"></div>
            <button class="btn btn-brass" id="btnLogin">Unlock dashboard</button>
            <p class="step-note"><a href="../index.html" style="color:var(--brass-2)">← Back to public website</a></p>
          </div>
        </div>`;
      $('#btnLogin').onclick = doLogin;
      return;
    }

    renderDashboard();
  }

  async function completeSetup() {
    const err = $('#authErr');
    err.textContent = '';
    try {
      const username = $('#suUser').value.trim();
      const p1 = $('#suPass').value;
      const p2 = $('#suPass2').value;
      const code = $('#suTotp').value;
      if (p1 !== p2) throw new Error('Passwords do not match.');
      const ok = await (async () => {
        const clean = String(code || '').replace(/\s+/g, '');
        if (!/^\d{6}$/.test(clean)) return false;
        const now = Math.floor(Date.now() / 1000);
        for (let w = -1; w <= 1; w++) {
          const expected = await BLDAuth.totpCode(setupSecret, now + w * 30);
          if (expected === clean) return true;
        }
        return false;
      })();
      if (!ok) throw new Error('Authenticator code is incorrect. Scan QR and try the current 6-digit code.');
      await BLDAuth.setupAccount({ username, password: p1, totpSecret: setupSecret });
      BLDAuth.createSession();
      toast('Admin account secured');
      renderAuth();
    } catch (e) {
      err.textContent = e.message || String(e);
    }
  }

  async function doLogin() {
    const err = $('#authErr');
    err.textContent = '';
    try {
      const username = $('#liUser').value.trim();
      const password = $('#liPass').value;
      const code = $('#liTotp').value;
      const passOk = await BLDAuth.verifyPassword(username, password);
      if (!passOk) throw new Error('Invalid username or password.');
      const totpOk = await BLDAuth.verifyTotp(code);
      if (!totpOk) throw new Error('Invalid authenticator code.');
      BLDAuth.createSession();
      renderDashboard();
    } catch (e) {
      err.textContent = e.message || String(e);
    }
  }

  /* ========== DASHBOARD ========== */
  const NAV = [
    { section: 'Manage', items: [
      ['overview', 'Overview'],
      ['products', 'Products'],
      ['excel', 'Excel / Sheets'],
      ['media', 'Images'],
      ['events', 'Events & discounts'],
      ['settings', 'Site settings'],
      ['security', 'Security']
    ]}
  ];

  function renderDashboard() {
    const data = BLD.get();
    const root = $('#app');
    root.innerHTML = `
      <div class="admin-shell">
        <aside class="sidebar" id="sidebar">
          <div class="side-brand">
            <div class="mark">L</div>
            <div><strong>La Différence</strong><span>Admin control</span></div>
          </div>
          <nav class="side-nav">
            ${NAV.map(sec => `
              <div class="side-label">${sec.section}</div>
              ${sec.items.map(([id, label]) => `
                <a href="#" class="side-link ${tab === id ? 'active' : ''}" data-tab="${id}">${label}</a>
              `).join('')}
            `).join('')}
          </nav>
          <div class="side-foot">
            <a class="btn btn-outline btn-sm" href="../index.html" target="_blank" rel="noopener">View website</a>
            <button class="btn btn-ghost btn-sm" id="btnLogout" style="justify-content:flex-start;color:rgba(244,247,245,.7)">Sign out</button>
          </div>
        </aside>
        <div class="main">
          <div class="topbar">
            <div style="display:flex;align-items:center;gap:10px;">
              <button class="btn btn-outline btn-sm burger" id="burger">Menu</button>
              <div>
                <div class="muted">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                <h1 class="display">${titleFor(tab)}</h1>
              </div>
            </div>
            <div style="font-size:.85rem;color:var(--muted)">Signed in · TOTP protected</div>
          </div>
          <div class="content" id="tabContent">${tabHtml(data)}</div>
        </div>
      </div>
      ${modal ? modalHtml() : ''}`;

    $$('.side-link').forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault();
      tab = a.dataset.tab;
      modal = null;
      renderDashboard();
    }));
    $('#btnLogout').onclick = () => { BLDAuth.clearSession(); renderAuth(); };
    $('#burger')?.addEventListener('click', () => $('#sidebar').classList.toggle('open'));
    wireTab(data);
  }

  function titleFor(t) {
    return ({
      overview: 'Overview',
      products: 'Products',
      excel: 'Excel & Google Sheets',
      media: 'Image library',
      events: 'Events & discounts',
      settings: 'Site settings',
      security: 'Security'
    })[t] || 'Dashboard';
  }

  function tabHtml(data) {
    if (tab === 'overview') return overviewHtml(data);
    if (tab === 'products') return productsHtml(data);
    if (tab === 'excel') return excelHtml(data);
    if (tab === 'media') return mediaHtml(data);
    if (tab === 'events') return eventsHtml(data);
    if (tab === 'settings') return settingsHtml(data);
    if (tab === 'security') return securityHtml();
    return '';
  }

  function overviewHtml(data) {
    const active = data.products.filter(p => p.active !== false).length;
    const low = data.products.filter(p => p.stock > 0 && p.stock <= 5).length;
    return `
      <div class="grid-kpi">
        <div class="kpi"><div class="label">Products</div><div class="value">${data.products.length}</div></div>
        <div class="kpi"><div class="label">Live on site</div><div class="value">${active}</div></div>
        <div class="kpi"><div class="label">Images</div><div class="value">${data.media.length}</div></div>
        <div class="kpi"><div class="label">Promos / events</div><div class="value">${data.discounts.length + data.events.length}</div></div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Quick path to go live</h2></div>
        <div class="help">
          1. Download the Excel/CSV template from <strong>Excel / Sheets</strong>.<br>
          2. Fill product rows (name, category, price, stock, image URL or leave blank and attach photos here).<br>
          3. Import the file or paste a published Google Sheet link — the public website updates automatically.<br>
          4. Add business photos, discounts, and events. No customer login on the storefront.
          ${low ? `<br><br><span class="pill pill-warn">${low} products at low stock (≤5)</span>` : ''}
        </div>
      </div>`;
  }

  function productsHtml(data) {
    const rows = data.products.map(p => `
      <tr>
        <td>${thumbCell(p, data)}</td>
        <td><strong>${esc(p.name)}</strong><div style="color:var(--muted);font-size:.75rem">${esc(p.sku || p.id)}</div></td>
        <td>${esc(p.category)}</td>
        <td>${BLD.money(p.price, data.settings.currency)}</td>
        <td>${p.stock}</td>
        <td>${p.active !== false ? '<span class="pill pill-ok">Live</span>' : '<span class="pill pill-muted">Hidden</span>'}</td>
        <td class="row-actions">
          <button class="btn btn-outline btn-sm" data-edit="${p.id}">Edit</button>
          <button class="btn btn-danger btn-sm" data-del="${p.id}">Delete</button>
        </td>
      </tr>`).join('') || `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:28px">No products yet — import Excel or add manually.</td></tr>`;

    return `
      <div class="card">
        <div class="card-head">
          <h2>Catalog</h2>
          <button class="btn btn-solid btn-sm" id="btnAddProduct">Add product</button>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>`;
  }

  function thumbCell(p, data) {
    let src = '';
    if (p.image && (p.image.startsWith('media:') || p.image.startsWith('id:'))) {
      const id = p.image.replace(/^(media:|id:)/, '');
      const m = data.media.find(x => x.id === id);
      if (m) src = m.dataUrl;
    } else if (p.image) src = p.image;
    return src ? `<img class="thumb" src="${escAttr(src)}" alt="">` : `<div class="thumb"></div>`;
  }

  function excelHtml(data) {
    return `
      <div class="card">
        <div class="card-head"><h2>Connect Excel / Google Sheets</h2></div>
        <div class="help" style="margin-bottom:16px">
          Columns supported: <code>id, sku, name, category, price, unit, stock, description, image, featured, active</code>.
          Categories: food, drinks, electronics, home, tools, body, more.
          Download the template, edit in Excel, then import (.xlsx or .csv). Or publish a Google Sheet and paste its link.
        </div>
        <div class="form-grid">
          <div class="field full">
            <label>Google Sheet URL</label>
            <input id="sheetUrl" class="input" value="${escAttr(data.settings.sheetUrl || '')}" placeholder="https://docs.google.com/spreadsheets/d/...">
          </div>
        </div>
        <div class="row-actions" style="margin-top:8px">
          <button class="btn btn-solid btn-sm" id="btnSyncSheet">Sync from Google Sheet</button>
          <button class="btn btn-outline btn-sm" id="btnSaveSheet">Save sheet link</button>
          <button class="btn btn-outline btn-sm" id="btnDlTemplate">Download CSV template</button>
          <button class="btn btn-outline btn-sm" id="btnExportCsv">Export current catalog CSV</button>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Import workbook</h2></div>
        <div class="dropzone" id="dropExcel">Drop .xlsx / .csv here or click to browse</div>
        <input type="file" id="fileExcel" accept=".csv,.xlsx,.xls" hidden>
        <div class="row-actions" style="margin-top:12px">
          <label style="font-size:.85rem;display:flex;align-items:center;gap:8px">
            <input type="radio" name="impMode" value="merge" checked> Merge / update
          </label>
          <label style="font-size:.85rem;display:flex;align-items:center;gap:8px">
            <input type="radio" name="impMode" value="replace"> Replace all products
          </label>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Full backup</h2></div>
        <div class="row-actions">
          <button class="btn btn-outline btn-sm" id="btnBackup">Download JSON backup</button>
          <button class="btn btn-outline btn-sm" id="btnRestore">Restore backup…</button>
          <input type="file" id="fileBackup" accept="application/json,.json" hidden>
        </div>
      </div>`;
  }

  function mediaHtml(data) {
    const grid = data.media.length ? data.media.map(m => `
      <div class="media-tile">
        <img src="${m.dataUrl}" alt="">
        <div class="cap">${esc(m.caption || m.kind || 'Image')}
          <div class="row-actions" style="margin-top:6px">
            <button class="btn btn-danger btn-sm" data-mdel="${m.id}">Delete</button>
          </div>
        </div>
      </div>`).join('') : '<p style="color:var(--muted)">No images yet.</p>';

    return `
      <div class="card">
        <div class="card-head"><h2>Upload images</h2></div>
        <div class="form-grid">
          <div class="field"><label>Kind</label>
            <select id="mediaKind">
              <option value="product">Product photo</option>
              <option value="business">Business / store</option>
              <option value="event">Event</option>
            </select>
          </div>
          <div class="field"><label>Caption</label><input id="mediaCap" class="input" placeholder="Optional caption"></div>
          <div class="field full"><div class="dropzone" id="dropMedia">Drop images here or click</div>
            <input type="file" id="fileMedia" accept="image/*" multiple hidden></div>
        </div>
      </div>
      <div class="card"><div class="media-grid">${grid}</div></div>`;
  }

  function eventsHtml(data) {
    const dRows = data.discounts.map(d => `
      <tr>
        <td><strong>${esc(d.title)}</strong><div style="color:var(--muted);font-size:.8rem">${esc(d.detail || '')}</div></td>
        <td>${d.active !== false ? '<span class="pill pill-ok">Live</span>' : '<span class="pill pill-muted">Off</span>'}</td>
        <td class="row-actions">
          <button class="btn btn-outline btn-sm" data-dedit="${d.id}">Edit</button>
          <button class="btn btn-danger btn-sm" data-ddel="${d.id}">Delete</button>
        </td>
      </tr>`).join('') || `<tr><td colspan="3" style="color:var(--muted);padding:20px;text-align:center">No discounts yet</td></tr>`;

    const eRows = data.events.map(e => `
      <tr>
        <td><strong>${esc(e.title)}</strong><div style="color:var(--muted);font-size:.8rem">${esc(e.date || '')} · ${esc(e.detail || '')}</div></td>
        <td>${e.active !== false ? '<span class="pill pill-ok">Live</span>' : '<span class="pill pill-muted">Off</span>'}</td>
        <td class="row-actions">
          <button class="btn btn-outline btn-sm" data-eedit="${e.id}">Edit</button>
          <button class="btn btn-danger btn-sm" data-edel="${e.id}">Delete</button>
        </td>
      </tr>`).join('') || `<tr><td colspan="3" style="color:var(--muted);padding:20px;text-align:center">No events yet</td></tr>`;

    return `
      <div class="card">
        <div class="card-head"><h2>Upcoming discounts</h2><button class="btn btn-solid btn-sm" id="btnAddDisc">Add discount</button></div>
        <div class="table-wrap"><table><thead><tr><th>Discount</th><th>Status</th><th></th></tr></thead><tbody>${dRows}</tbody></table></div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Events</h2><button class="btn btn-solid btn-sm" id="btnAddEvent">Add event</button></div>
        <div class="table-wrap"><table><thead><tr><th>Event</th><th>Status</th><th></th></tr></thead><tbody>${eRows}</tbody></table></div>
      </div>`;
  }

  function settingsHtml(data) {
    const s = data.settings;
    return `
      <div class="card">
        <div class="card-head"><h2>Public website settings</h2></div>
        <div class="form-grid">
          <div class="field"><label>Shop name</label><input id="sName" class="input" value="${escAttr(s.shopName || '')}"></div>
          <div class="field"><label>Currency</label><input id="sCur" class="input" value="${escAttr(s.currency || 'RWF')}"></div>
          <div class="field full"><label>Tagline</label><textarea id="sTag" rows="2">${esc(s.tagline || '')}</textarea></div>
          <div class="field"><label>Phone</label><input id="sPhone" class="input" value="${escAttr(s.phone || '')}"></div>
          <div class="field"><label>WhatsApp (digits)</label><input id="sWa" class="input" value="${escAttr(s.whatsapp || '')}"></div>
          <div class="field full"><label>Address</label><input id="sAddr" class="input" value="${escAttr(s.address || '')}"></div>
          <div class="field full"><label>Map embed URL</label><input id="sMap" class="input" value="${escAttr(s.mapEmbed || '')}"></div>
          <div class="field full"><label>Hero video URL (optional — MP4)</label><input id="sVideo" class="input" value="${escAttr(s.heroVideoUrl || '')}" placeholder="https://…/video.mp4"></div>
          <div class="field full"><label>Hours (one per line: Day | Hours)</label>
            <textarea id="sHours" rows="4">${esc((s.hours || []).map(h => h.join(' | ')).join('\n'))}</textarea>
          </div>
        </div>
        <button class="btn btn-solid" id="btnSaveSettings" style="margin-top:12px">Save settings</button>
      </div>`;
  }

  function securityHtml() {
    const a = BLDAuth.loadAuth();
    return `
      <div class="card">
        <div class="card-head"><h2>Account security</h2></div>
        <p style="color:var(--muted);font-size:.9rem">Username: <strong>${esc(a?.username || '')}</strong> · Password hashed with PBKDF2 (210k iterations) · Login requires TOTP from your authenticator app.</p>
        <div class="form-grid" style="margin-top:14px">
          <div class="field"><label>Current password</label><input id="curPass" type="password" class="input"></div>
          <div class="field"><label>New password</label><input id="newPass" type="password" class="input"></div>
        </div>
        <button class="btn btn-solid btn-sm" id="btnChangePass" style="margin-top:8px">Update password</button>
      </div>
      <div class="card">
        <div class="card-head"><h2>Re-enroll authenticator QR</h2></div>
        <p style="color:var(--muted);font-size:.9rem">Generates a new secret. Authorized phones must scan the new QR.</p>
        <div class="field" style="max-width:280px"><label>Confirm password</label><input id="rotPass" type="password" class="input"></div>
        <button class="btn btn-outline btn-sm" id="btnRotateTotp">Generate new QR</button>
        <div id="rotQr" style="margin-top:14px"></div>
      </div>`;
  }

  function modalHtml() {
    if (!modal) return '';
    if (modal.type === 'product') {
      const p = modal.product || { name: '', category: 'food', price: 0, unit: 'unit', stock: 0, description: '', image: '', featured: false, active: true };
      const mediaOpts = BLD.get().media.map(m => `<option value="media:${m.id}" ${p.image === 'media:' + m.id ? 'selected' : ''}>${esc(m.caption || m.kind || m.id)}</option>`).join('');
      return `
        <div class="modal-scrim" id="modalScrim"><div class="modal">
          <h3 class="display">${p.id ? 'Edit product' : 'Add product'}</h3>
          <div class="form-grid">
            <div class="field full"><label>Name</label><input id="pName" class="input" value="${escAttr(p.name)}"></div>
            <div class="field"><label>SKU</label><input id="pSku" class="input" value="${escAttr(p.sku || '')}"></div>
            <div class="field"><label>Category</label>
              <select id="pCat">${BLD.DEFAULT_CATEGORIES.map(c => `<option value="${c.id}" ${p.category === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
            </div>
            <div class="field"><label>Price</label><input id="pPrice" type="number" min="0" step="1" class="input" value="${p.price || 0}"></div>
            <div class="field"><label>Unit</label><input id="pUnit" class="input" value="${escAttr(p.unit || 'unit')}"></div>
            <div class="field"><label>Stock</label><input id="pStock" type="number" class="input" value="${p.stock || 0}"></div>
            <div class="field"><label>Image</label>
              <select id="pImg">
                <option value="">None</option>
                <option value="__url__">External URL…</option>
                ${mediaOpts}
              </select>
            </div>
            <div class="field full" id="pImgUrlWrap" hidden><label>Image URL</label><input id="pImgUrl" class="input" value="${p.image && !String(p.image).startsWith('media:') ? escAttr(p.image) : ''}"></div>
            <div class="field full"><label>Description</label><textarea id="pDesc" rows="3">${esc(p.description || '')}</textarea></div>
            <div class="field"><label><input type="checkbox" id="pFeat" ${p.featured ? 'checked' : ''}> Featured</label></div>
            <div class="field"><label><input type="checkbox" id="pActive" ${p.active !== false ? 'checked' : ''}> Live on website</label></div>
          </div>
          <div class="row-actions" style="margin-top:16px;justify-content:flex-end">
            <button class="btn btn-ghost btn-sm" id="modalCancel">Cancel</button>
            <button class="btn btn-solid btn-sm" id="modalSaveProduct">Save</button>
          </div>
        </div></div>`;
    }
    if (modal.type === 'discount' || modal.type === 'event') {
      const item = modal.item || { title: '', detail: '', date: '', active: true };
      return `
        <div class="modal-scrim" id="modalScrim"><div class="modal">
          <h3 class="display">${item.id ? 'Edit' : 'Add'} ${modal.type}</h3>
          <div class="form-grid">
            <div class="field full"><label>Title</label><input id="evTitle" class="input" value="${escAttr(item.title || '')}"></div>
            ${modal.type === 'event' ? `<div class="field full"><label>Date</label><input id="evDate" class="input" value="${escAttr(item.date || '')}" placeholder="e.g. 28 Sep 2026"></div>` : ''}
            <div class="field full"><label>Details</label><textarea id="evDetail" rows="3">${esc(item.detail || '')}</textarea></div>
            <div class="field"><label><input type="checkbox" id="evActive" ${item.active !== false ? 'checked' : ''}> Show on website</label></div>
          </div>
          <div class="row-actions" style="margin-top:16px;justify-content:flex-end">
            <button class="btn btn-ghost btn-sm" id="modalCancel">Cancel</button>
            <button class="btn btn-solid btn-sm" id="modalSaveEv">Save</button>
          </div>
        </div></div>`;
    }
    return '';
  }

  function wireTab(data) {
    if (tab === 'products') {
      $('#btnAddProduct')?.addEventListener('click', () => { modal = { type: 'product', product: null }; renderDashboard(); });
      $$('[data-edit]').forEach(b => b.addEventListener('click', () => {
        const product = data.products.find(p => p.id === b.dataset.edit);
        modal = { type: 'product', product: { ...product } };
        renderDashboard();
      }));
      $$('[data-del]').forEach(b => b.addEventListener('click', () => {
        if (!confirm('Delete this product?')) return;
        BLD.update(db => { db.products = db.products.filter(p => p.id !== b.dataset.del); });
        toast('Product deleted');
        renderDashboard();
      }));
    }
    if (tab === 'excel') wireExcel();
    if (tab === 'media') wireMedia();
    if (tab === 'events') wireEvents(data);
    if (tab === 'settings') wireSettings();
    if (tab === 'security') wireSecurity();
    if (modal) wireModal();
  }

  function wireExcel() {
    $('#btnDlTemplate')?.addEventListener('click', () => {
      const sample = 'id,sku,name,category,price,unit,stock,description,image,featured,active\n,,Rice 25kg,food,28000,bag,40,Long grain,,false,true\n';
      BLD.downloadText('catalog.template.csv', sample);
    });
    $('#btnExportCsv')?.addEventListener('click', () => {
      BLD.downloadText('catalog-export.csv', BLD.exportProductsCsv());
      toast('CSV exported');
    });
    $('#btnSaveSheet')?.addEventListener('click', () => {
      BLD.update(db => { db.settings.sheetUrl = $('#sheetUrl').value.trim(); });
      toast('Sheet link saved');
    });
    $('#btnSyncSheet')?.addEventListener('click', async () => {
      try {
        const n = await BLD.syncFromSheet($('#sheetUrl').value.trim());
        toast('Synced ' + n + ' products from Google Sheet');
        renderDashboard();
      } catch (e) { alert(e.message || e); }
    });
    const drop = $('#dropExcel');
    const file = $('#fileExcel');
    drop?.addEventListener('click', () => file.click());
    drop?.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
    drop?.addEventListener('dragleave', () => drop.classList.remove('drag'));
    drop?.addEventListener('drop', e => {
      e.preventDefault(); drop.classList.remove('drag');
      if (e.dataTransfer.files[0]) handleExcel(e.dataTransfer.files[0]);
    });
    file?.addEventListener('change', () => { if (file.files[0]) handleExcel(file.files[0]); });
    $('#btnBackup')?.addEventListener('click', () => { BLD.exportFullBackup(); toast('Backup downloaded'); });
    $('#btnRestore')?.addEventListener('click', () => $('#fileBackup').click());
    $('#fileBackup')?.addEventListener('change', async () => {
      const f = $('#fileBackup').files[0];
      if (!f) return;
      try {
        BLD.importFullBackup(JSON.parse(await f.text()));
        toast('Backup restored');
        renderDashboard();
      } catch (e) { alert(e.message || e); }
    });
  }

  async function handleExcel(file) {
    const mode = ($$('input[name=impMode]').find(r => r.checked) || {}).value || 'merge';
    try {
      const n = await BLD.importWorkbookFile(file, mode);
      toast('Imported ' + n + ' rows');
      renderDashboard();
    } catch (e) { alert(e.message || e); }
  }

  function wireMedia() {
    const drop = $('#dropMedia');
    const file = $('#fileMedia');
    drop?.addEventListener('click', () => file.click());
    drop?.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
    drop?.addEventListener('dragleave', () => drop.classList.remove('drag'));
    drop?.addEventListener('drop', e => {
      e.preventDefault(); drop.classList.remove('drag');
      ingestImages(e.dataTransfer.files);
    });
    file?.addEventListener('change', () => ingestImages(file.files));
    $$('[data-mdel]').forEach(b => b.addEventListener('click', () => {
      BLD.update(db => { db.media = db.media.filter(m => m.id !== b.dataset.mdel); });
      toast('Image removed');
      renderDashboard();
    }));
  }

  function ingestImages(fileList) {
    const kind = $('#mediaKind')?.value || 'product';
    const caption = $('#mediaCap')?.value || '';
    Array.from(fileList || []).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        BLD.update(db => {
          db.media.unshift({
            id: BLD.uid('m'),
            kind,
            caption: caption || file.name,
            dataUrl: reader.result,
            createdAt: new Date().toISOString()
          });
        });
        renderDashboard();
      };
      reader.readAsDataURL(file);
    });
    toast('Images added');
  }

  function wireEvents(data) {
    $('#btnAddDisc')?.addEventListener('click', () => { modal = { type: 'discount', item: null }; renderDashboard(); });
    $('#btnAddEvent')?.addEventListener('click', () => { modal = { type: 'event', item: null }; renderDashboard(); });
    $$('[data-dedit]').forEach(b => {
      const item = data.discounts.find(d => d.id === b.dataset.dedit);
      b.addEventListener('click', () => { modal = { type: 'discount', item: { ...item } }; renderDashboard(); });
    });
    $$('[data-ddel]').forEach(b => b.addEventListener('click', () => {
      BLD.update(db => { db.discounts = db.discounts.filter(d => d.id !== b.dataset.ddel); });
      renderDashboard();
    }));
    $$('[data-eedit]').forEach(b => {
      const item = data.events.find(d => d.id === b.dataset.eedit);
      b.addEventListener('click', () => { modal = { type: 'event', item: { ...item } }; renderDashboard(); });
    });
    $$('[data-edel]').forEach(b => b.addEventListener('click', () => {
      BLD.update(db => { db.events = db.events.filter(d => d.id !== b.dataset.edel); });
      renderDashboard();
    }));
  }

  function wireSettings() {
    $('#btnSaveSettings')?.addEventListener('click', () => {
      BLD.update(db => {
        db.settings.shopName = $('#sName').value.trim();
        db.settings.currency = $('#sCur').value.trim() || 'RWF';
        db.settings.tagline = $('#sTag').value.trim();
        db.settings.phone = $('#sPhone').value.trim();
        db.settings.whatsapp = $('#sWa').value.trim();
        db.settings.address = $('#sAddr').value.trim();
        db.settings.mapEmbed = $('#sMap').value.trim();
        db.settings.heroVideoUrl = $('#sVideo').value.trim();
        db.settings.hours = $('#sHours').value.split('\n').map(l => l.split('|').map(x => x.trim())).filter(p => p[0]);
      });
      toast('Settings saved — refresh the public site');
    });
  }

  function wireSecurity() {
    $('#btnChangePass')?.addEventListener('click', async () => {
      try {
        await BLDAuth.changePassword($('#curPass').value, $('#newPass').value);
        toast('Password updated');
        $('#curPass').value = ''; $('#newPass').value = '';
      } catch (e) { alert(e.message || e); }
    });
    $('#btnRotateTotp')?.addEventListener('click', async () => {
      try {
        await BLDAuth.loadQrScript();
        const { secret, url } = await BLDAuth.rotateTotp($('#rotPass').value);
        const host = $('#rotQr');
        host.innerHTML = `<div class="qr-box" id="newQr"></div><p class="help">New secret: <code>${secret}</code> — scan with your authenticator app now.</p>`;
        BLDAuth.renderQr($('#newQr'), url);
        toast('New authenticator secret active');
      } catch (e) { alert(e.message || e); }
    });
  }

  function wireModal() {
    $('#modalCancel')?.addEventListener('click', () => { modal = null; renderDashboard(); });
    $('#modalScrim')?.addEventListener('click', (e) => { if (e.target.id === 'modalScrim') { modal = null; renderDashboard(); } });
    if (modal.type === 'product') {
      const sel = $('#pImg');
      const wrap = $('#pImgUrlWrap');
      const sync = () => { wrap.hidden = sel.value !== '__url__'; };
      sel?.addEventListener('change', sync);
      if (modal.product?.image && !String(modal.product.image).startsWith('media:')) {
        sel.value = '__url__'; sync();
      }
      $('#modalSaveProduct')?.addEventListener('click', () => {
        let image = $('#pImg').value;
        if (image === '__url__') image = $('#pImgUrl').value.trim();
        const payload = {
          name: $('#pName').value.trim(),
          sku: $('#pSku').value.trim(),
          category: $('#pCat').value,
          price: parseFloat($('#pPrice').value) || 0,
          unit: $('#pUnit').value.trim() || 'unit',
          stock: parseInt($('#pStock').value, 10) || 0,
          description: $('#pDesc').value.trim(),
          image,
          featured: $('#pFeat').checked,
          active: $('#pActive').checked
        };
        if (!payload.name) return alert('Name is required');
        BLD.update(db => {
          if (modal.product?.id) {
            const i = db.products.findIndex(p => p.id === modal.product.id);
            if (i >= 0) db.products[i] = Object.assign({}, db.products[i], payload);
          } else {
            db.products.unshift(Object.assign({ id: BLD.uid('p') }, payload));
          }
        });
        modal = null;
        toast('Product saved');
        renderDashboard();
      });
    }
    if (modal.type === 'discount' || modal.type === 'event') {
      $('#modalSaveEv')?.addEventListener('click', () => {
        const payload = {
          title: $('#evTitle').value.trim(),
          detail: $('#evDetail').value.trim(),
          date: $('#evDate')?.value.trim() || '',
          active: $('#evActive').checked
        };
        if (!payload.title) return alert('Title required');
        BLD.update(db => {
          const key = modal.type === 'discount' ? 'discounts' : 'events';
          if (modal.item?.id) {
            const i = db[key].findIndex(x => x.id === modal.item.id);
            if (i >= 0) db[key][i] = Object.assign({}, db[key][i], payload);
          } else {
            db[key].unshift(Object.assign({ id: BLD.uid(modal.type === 'discount' ? 'd' : 'e') }, payload));
          }
        });
        modal = null;
        toast('Saved');
        renderDashboard();
      });
    }
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function escAttr(s) { return esc(s).replace(/'/g, '&#39;'); }

  // remove unused var warning path
  void pendingUser;

  document.addEventListener('DOMContentLoaded', renderAuth);
})();
