/**
 * Boutique La Différence — shared data layer
 * Products / media / events live in localStorage and sync via Excel/CSV/Google Sheets.
 */
(function (global) {
  const STORE_KEY = 'bld-store-v1';
  const DEFAULT_CATEGORIES = [
    { id: 'food', name: 'Food', blurb: 'Staples, fresh & pantry' },
    { id: 'drinks', name: 'Drinks', blurb: 'Water, juices & soft drinks' },
    { id: 'electronics', name: 'Electronics', blurb: 'Phones, small appliances & more' },
    { id: 'home', name: 'Home equipment', blurb: 'Kitchen & household gear' },
    { id: 'tools', name: 'Products & tools', blurb: 'Hardware and daily tools' },
    { id: 'body', name: 'Body products', blurb: 'Care, hygiene & beauty' },
    { id: 'more', name: 'More', blurb: 'Everything else in store' }
  ];

  function uid(prefix) {
    return prefix + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  function emptyStore() {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      settings: {
        shopName: 'Boutique La Différence',
        tagline: 'Your neighborhood supermarket in Zindiro — food, drinks, electronics, home & more.',
        phone: '',
        whatsapp: '',
        address: 'KG 11 Ave, Zindiro, Kigali',
        mapEmbed: 'https://maps.google.com/maps?q=Zindiro+Kigali&output=embed',
        heroVideoUrl: '',
        currency: 'RWF',
        sheetUrl: '',
        hours: [
          ['Monday – Friday', '07:00 – 23:00'],
          ['Saturday – Sunday', '09:00 – 23:00']
        ]
      },
      categories: DEFAULT_CATEGORIES.map(c => ({ ...c })),
      products: [],
      media: [],
      events: [],
      discounts: []
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return emptyStore();
      const parsed = JSON.parse(raw);
      return Object.assign(emptyStore(), parsed, {
        settings: Object.assign(emptyStore().settings, parsed.settings || {}),
        categories: (parsed.categories && parsed.categories.length) ? parsed.categories : emptyStore().categories
      });
    } catch (e) {
      return emptyStore();
    }
  }

  function save(data) {
    data.updatedAt = new Date().toISOString();
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
    global.dispatchEvent(new CustomEvent('bld:store', { detail: data }));
    return data;
  }

  function get() { return load(); }

  function update(mutator) {
    const data = load();
    mutator(data);
    return save(data);
  }

  function money(n, currency) {
    const cur = currency || load().settings.currency || 'RWF';
    const val = Number(n) || 0;
    return cur + ' ' + Math.round(val).toLocaleString('en-US');
  }

  /* ---------- CSV / Excel helpers ---------- */
  function parseCsv(text) {
    const rows = [];
    const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;
      const parts = [];
      let cur = '';
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQ && line[i + 1] === '"') { cur += '"'; i++; continue; }
          inQ = !inQ;
          continue;
        }
        if (ch === ',' && !inQ) { parts.push(cur); cur = ''; continue; }
        cur += ch;
      }
      parts.push(cur);
      rows.push(parts.map(p => p.trim()));
    }
    return rows;
  }

  function rowsToObjects(rows) {
    if (!rows.length) return [];
    const headers = rows[0].map(h => h.toLowerCase().trim());
    return rows.slice(1).map(r => {
      const o = {};
      headers.forEach((h, i) => { o[h] = (r[i] || '').trim(); });
      return o;
    });
  }

  function normalizeProduct(o) {
    const name = o.name || o.product || o.title || o.item || '';
    if (!name) return null;
    const category = (o.category || o.cat || o.dept || o.department || 'more').toLowerCase().replace(/\s+/g, '-');
    const catMap = {
      food: 'food', foods: 'food', grocery: 'food', groceries: 'food',
      drink: 'drinks', drinks: 'drinks', beverage: 'drinks', beverages: 'drinks',
      electronic: 'electronics', electronics: 'electronics',
      home: 'home', household: 'home', equipment: 'home', 'home-equipment': 'home',
      tool: 'tools', tools: 'tools', products: 'tools', hardware: 'tools',
      body: 'body', beauty: 'body', care: 'body', 'body-products': 'body',
      more: 'more', other: 'more', general: 'more'
    };
    return {
      id: o.id || o.sku || uid('p'),
      sku: o.sku || o.id || '',
      name,
      category: catMap[category] || (DEFAULT_CATEGORIES.some(c => c.id === category) ? category : 'more'),
      price: parseFloat(o.price || o.cost || o.amount || '0') || 0,
      unit: o.unit || 'unit',
      stock: Math.round(parseFloat(o.stock || o.qty || o.quantity || '0') || 0),
      description: o.description || o.desc || o.notes || '',
      image: o.image || o.photo || o.img || o.image_url || '',
      featured: String(o.featured || '').toLowerCase() === 'true' || o.featured === '1',
      active: String(o.active || 'true').toLowerCase() !== 'false' && o.active !== '0'
    };
  }

  function importProductRows(objects, mode) {
    const mapped = objects.map(normalizeProduct).filter(Boolean);
    return update(db => {
      if (mode === 'replace') {
        db.products = mapped;
      } else {
        const byId = new Map(db.products.map(p => [p.id, p]));
        const bySku = new Map(db.products.filter(p => p.sku).map(p => [p.sku, p]));
        mapped.forEach(p => {
          const existing = byId.get(p.id) || (p.sku && bySku.get(p.sku));
          if (existing) Object.assign(existing, p);
          else db.products.push(p);
        });
      }
    });
  }

  function exportProductsCsv(products) {
    const cols = ['id', 'sku', 'name', 'category', 'price', 'unit', 'stock', 'description', 'image', 'featured', 'active'];
    const list = products || load().products;
    const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    return [cols.join(',')].concat(list.map(p => cols.map(c => esc(p[c])).join(','))).join('\n');
  }

  function sheetExportCsvUrl(sheetLink) {
    if (!sheetLink) return null;
    try {
      const m = sheetLink.match(/\/d\/([a-zA-Z0-9-_]+)/);
      const gid = (sheetLink.match(/gid=(\d+)/) || [])[1];
      if (m) {
        let url = 'https://docs.google.com/spreadsheets/d/' + m[1] + '/export?format=csv';
        if (gid) url += '&gid=' + gid;
        return url;
      }
      if (sheetLink.includes('/export') || sheetLink.includes('output=csv')) return sheetLink;
    } catch (e) {}
    return null;
  }

  async function syncFromSheet(url) {
    const csvUrl = sheetExportCsvUrl(url || load().settings.sheetUrl);
    if (!csvUrl) throw new Error('Invalid Google Sheet link. Share the sheet and paste the edit or export URL.');
    const res = await fetch(csvUrl);
    if (!res.ok) throw new Error('Could not fetch sheet (make sure it is published or shared).');
    const text = await res.text();
    const objs = rowsToObjects(parseCsv(text));
    importProductRows(objs, 'replace');
    if (url) update(db => { db.settings.sheetUrl = url; });
    return load().products.length;
  }

  async function importWorkbookFile(file, mode) {
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.csv') || file.type === 'text/csv') {
      const text = await file.text();
      const objs = rowsToObjects(parseCsv(text));
      importProductRows(objs, mode || 'merge');
      return objs.length;
    }
    if (!global.XLSX) throw new Error('Excel parser not loaded. Use CSV or refresh the page.');
    const buf = await file.arrayBuffer();
    const wb = global.XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const objs = global.XLSX.utils.sheet_to_json(sheet, { defval: '' });
    const normalized = objs.map(row => {
      const o = {};
      Object.keys(row).forEach(k => { o[String(k).toLowerCase().trim()] = String(row[k]).trim(); });
      return o;
    });
    importProductRows(normalized, mode || 'merge');
    return normalized.length;
  }

  function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function exportFullBackup() {
    downloadText('boutique-la-difference-backup.json', JSON.stringify(load(), null, 2), 'application/json');
  }

  function importFullBackup(obj) {
    if (!obj || typeof obj !== 'object') throw new Error('Invalid backup file');
    const base = emptyStore();
    save(Object.assign(base, obj, {
      settings: Object.assign(base.settings, obj.settings || {}),
      categories: (obj.categories && obj.categories.length) ? obj.categories : base.categories
    }));
  }

  global.BLD = {
    STORE_KEY,
    DEFAULT_CATEGORIES,
    uid,
    emptyStore,
    get,
    load,
    save,
    update,
    money,
    parseCsv,
    rowsToObjects,
    normalizeProduct,
    importProductRows,
    exportProductsCsv,
    sheetExportCsvUrl,
    syncFromSheet,
    importWorkbookFile,
    downloadText,
    exportFullBackup,
    importFullBackup
  };
})(window);
