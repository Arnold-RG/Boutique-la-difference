/**
 * Extra admin modules — sales, CCTV, staff, debts, ads, chat, logistics, etc.
 */
(function (global) {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function money(n, data) { return BLD.money(n, (data || BLD.get()).settings.currency); }

  let chartInst = null;

  const NAV = [
    { section: 'Manage', items: [
      ['overview', 'Overview'],
      ['products', 'Products & prices'],
      ['barcode', 'Barcode scan'],
      ['excel', 'Excel / Sheets'],
      ['media', 'Images'],
      ['events', 'Events & discounts']
    ]},
    { section: 'Commerce', items: [
      ['sales', 'Sales & revenue'],
      ['orders', 'Orders & shipments'],
      ['payments', 'Customer payments'],
      ['debts', 'Customer debts'],
      ['inventory', 'Stock & purchases']
    ]},
    { section: 'Operations', items: [
      ['activity', 'Daily activity'],
      ['employees', 'Employees & shifts'],
      ['payroll', 'Salary calculator'],
      ['logistics', 'Logistics'],
      ['cctv', 'Camera security'],
      ['chat', 'Customer service'],
      ['reviews', 'Reviews & feedback'],
      ['policies', 'Policy rules']
    ]},
    { section: 'Website', items: [
      ['team', 'Our team'],
      ['ads', 'Advertise businesses'],
      ['social', 'Social media'],
      ['settings', 'Site settings'],
      ['security', 'Login security']
    ]}
  ];

  const TITLES = {
    overview: 'Overview & charts',
    products: 'Products & prices',
    barcode: 'Barcode automation',
    excel: 'Excel & Google Sheets',
    media: 'Image library',
    events: 'Events & discounts',
    sales: 'Sales & revenue',
    orders: 'Orders & shipments',
    payments: 'Customer payments',
    debts: 'Customer debts',
    inventory: 'Stock & purchases',
    activity: 'Daily activity',
    employees: 'Employees & shifts',
    payroll: 'Salary calculator',
    logistics: 'Logistics',
    cctv: 'Camera security',
    chat: 'Customer service chat',
    reviews: 'Reviews & feedback',
    policies: 'Policy rules',
    team: 'Our team (website)',
    ads: 'Advertise other businesses',
    social: 'Social media',
    settings: 'Site settings',
    security: 'Login security'
  };

  function overviewExtra(data) {
    const st = BLD.revenueStats(data);
    return `
      <div class="grid-kpi">
        <div class="kpi"><div class="label">Today revenue</div><div class="value">${money(st.todayRevenue, data)}</div></div>
        <div class="kpi"><div class="label">Month revenue</div><div class="value">${money(st.monthRevenue, data)}</div></div>
        <div class="kpi"><div class="label">Est. profit</div><div class="value">${money(st.profit, data)}</div></div>
        <div class="kpi"><div class="label">Open debts</div><div class="value">${money(st.debtsOpen, data)}</div></div>
      </div>
      <div class="grid-kpi" style="grid-template-columns:repeat(4,1fr)">
        <div class="kpi"><div class="label">Products</div><div class="value">${data.products.length}</div></div>
        <div class="kpi"><div class="label">Stock value</div><div class="value">${money(st.stockValue, data)}</div></div>
        <div class="kpi"><div class="label">Low stock</div><div class="value">${st.lowStock}</div></div>
        <div class="kpi"><div class="label">Today sales</div><div class="value">${st.todayOrders}</div></div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Revenue — last 7 days</h2></div>
        <canvas id="revChart" height="110"></canvas>
      </div>
      <div class="card">
        <div class="card-head"><h2>Recent activity</h2></div>
        <div class="table-wrap"><table>
          <thead><tr><th>When</th><th>Type</th><th>Note</th></tr></thead>
          <tbody>${(data.activities || []).slice(0, 8).map(a => `
            <tr><td>${esc((a.at || '').replace('T', ' ').slice(0, 16))}</td><td>${esc(a.type)}</td><td>${esc(a.message)}</td></tr>
          `).join('') || '<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:20px">No activity yet</td></tr>'}
        </tbody></table></div>
      </div>`;
  }

  function mountChart(data) {
    const canvas = $('#revChart');
    if (!canvas || !global.Chart) return;
    const st = BLD.revenueStats(data);
    if (chartInst) { chartInst.destroy(); chartInst = null; }
    chartInst = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: st.days.map(d => d.label),
        datasets: [{
          label: 'Revenue',
          data: st.days.map(d => d.total),
          backgroundColor: 'rgba(201,162,39,0.75)',
          borderRadius: 8
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { callback: v => Math.round(v) } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function salesHtml(data) {
    const rows = (data.sales || []).map(s => `
      <tr>
        <td>${esc((s.date || '').slice(0, 16))}</td>
        <td>${esc(s.customer || 'Walk-in')}</td>
        <td>${esc(s.method || 'cash')}</td>
        <td>${money(s.total, data)}</td>
        <td class="row-actions"><button class="btn btn-danger btn-sm" data-sdel="${s.id}">Delete</button></td>
      </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px">No sales recorded</td></tr>';
    return `
      <div class="card">
        <div class="card-head"><h2>Record a sale</h2></div>
        <div class="form-grid">
          <div class="field"><label>Customer</label><input id="saleCust" class="input" placeholder="Name or Walk-in"></div>
          <div class="field"><label>Payment</label>
            <select id="saleMethod"><option>cash</option><option>momo</option><option>card</option><option>debt</option></select>
          </div>
          <div class="field"><label>Total (${data.settings.currency})</label><input id="saleTotal" type="number" class="input" min="0"></div>
          <div class="field"><label>Cost total (optional)</label><input id="saleCost" type="number" class="input" min="0"></div>
          <div class="field full"><label>Items note</label><input id="saleNote" class="input" placeholder="e.g. Rice x2, Oil x1"></div>
        </div>
        <button class="btn btn-solid btn-sm" id="btnAddSale" style="margin-top:8px">Save sale</button>
      </div>
      <div class="card"><div class="card-head"><h2>Sales log</h2></div>
        <div class="table-wrap"><table><thead><tr><th>Date</th><th>Customer</th><th>Method</th><th>Total</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      </div>`;
  }

  function wireSales(ctx) {
    $('#btnAddSale')?.addEventListener('click', () => {
      const total = parseFloat($('#saleTotal').value) || 0;
      if (total <= 0) return alert('Enter a total');
      const method = $('#saleMethod').value;
      const customer = $('#saleCust').value.trim() || 'Walk-in';
      BLD.update(db => {
        db.sales.unshift({
          id: BLD.uid('sale'),
          date: new Date().toISOString(),
          customer, method, total,
          costTotal: parseFloat($('#saleCost').value) || 0,
          note: $('#saleNote').value.trim()
        });
        if (method === 'debt') {
          db.debts.unshift({
            id: BLD.uid('debt'),
            customer, amount: total, balance: total, status: 'open',
            note: $('#saleNote').value.trim(),
            createdAt: new Date().toISOString()
          });
        }
      });
      BLD.logActivity('sale', 'Sale ' + money(total) + ' — ' + customer);
      ctx.refresh();
    });
    $$('[data-sdel]').forEach(b => b.addEventListener('click', () => {
      BLD.update(db => { db.sales = db.sales.filter(s => s.id !== b.dataset.sdel); });
      ctx.refresh();
    }));
  }

  function barcodeHtml() {
    return `
      <div class="card styled-panel">
        <div class="card-head"><h2>Barcode scanner</h2></div>
        <p style="color:var(--muted);font-size:.9rem;margin-top:0">Point the camera at a product barcode, or type / use a USB scanner, then press Enter.</p>
        <div class="scanner-wrap">
          <div id="bcReader" class="scanner-view"></div>
          <div class="row-actions" style="margin-top:10px">
            <button class="btn btn-solid btn-sm" id="btnCamStart">Start camera</button>
            <button class="btn btn-outline btn-sm" id="btnCamStop">Stop camera</button>
          </div>
        </div>
        <div class="field" style="margin-top:16px"><label>Barcode / SKU</label><input id="bcInput" class="input" placeholder="Code appears here…"></div>
        <div id="bcResult" class="help" style="margin-top:12px">Waiting for scan…</div>
        <div class="row-actions" style="margin-top:12px">
          <button class="btn btn-solid btn-sm" id="btnBcSale" hidden>Record 1 unit sale</button>
        </div>
      </div>`;
  }

  let bcScanner = null;

  function wireBarcode(ctx) {
    const input = $('#bcInput');
    const result = $('#bcResult');
    const btn = $('#btnBcSale');
    let found = null;

    async function stopCam() {
      try {
        if (bcScanner) {
          await bcScanner.stop();
          await bcScanner.clear();
          bcScanner = null;
        }
      } catch (e) {}
    }

    function lookup(code) {
      if (code != null) input.value = String(code).trim();
      found = BLD.findByBarcode(input.value);
      if (!found) {
        result.innerHTML = '<strong>No product found</strong> for that code. Add a barcode on the product form.';
        btn.hidden = true;
        return;
      }
      result.innerHTML = `<strong>${esc(found.name)}</strong><br>Price: ${money(found.price)} · Stock: ${found.stock} · Category: ${esc(found.category)}`;
      btn.hidden = false;
    }

    input?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); lookup(); } });
    $('#btnCamStart')?.addEventListener('click', async () => {
      if (!global.Html5Qrcode) {
        alert('Camera scanner library not loaded. Refresh the page.');
        return;
      }
      await stopCam();
      bcScanner = new global.Html5Qrcode('bcReader');
      try {
        await bcScanner.start(
          { facingMode: 'environment' },
          { fps: 8, qrbox: { width: 240, height: 140 } },
          (decoded) => { lookup(decoded); },
          () => {}
        );
      } catch (e) {
        alert('Camera permission denied or unavailable. You can still type the barcode.');
        bcScanner = null;
      }
    });
    $('#btnCamStop')?.addEventListener('click', stopCam);
    btn?.addEventListener('click', () => {
      if (!found) return;
      BLD.update(db => {
        const p = db.products.find(x => x.id === found.id);
        if (p && p.stock > 0) p.stock -= 1;
        db.sales.unshift({
          id: BLD.uid('sale'),
          date: new Date().toISOString(),
          customer: 'Barcode sale',
          method: 'cash',
          total: found.price,
          costTotal: found.cost || 0,
          note: found.name + ' x1'
        });
      });
      BLD.logActivity('barcode', 'Sold via barcode: ' + found.name);
      stopCam().then(() => ctx.refresh());
    });
    setTimeout(() => input?.focus(), 50);
  }

  function inventoryHtml(data) {
    const low = data.products.filter(p => p.stock <= 5);
    const purch = (data.purchases || []).map(p => `
      <tr><td>${esc((p.date || '').slice(0, 10))}</td><td>${esc(p.supplier || '')}</td><td>${esc(p.note || '')}</td><td>${money(p.total, data)}</td>
      <td><button class="btn btn-danger btn-sm" data-pdel="${p.id}">Delete</button></td></tr>`).join('') ||
      '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px">No purchases</td></tr>';
    return `
      <div class="card styled-panel">
        <div class="card-head"><h2>Low stock (≤5)</h2></div>
        <div class="table-wrap"><table><thead><tr><th>Product</th><th>Stock</th><th>Price</th></tr></thead>
        <tbody>${low.map(p => `<tr><td>${esc(p.name)}</td><td>${p.stock}</td><td>${money(p.price, data)}</td></tr>`).join('') ||
          '<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:16px">All stock levels healthy</td></tr>'}
        </tbody></table></div>
      </div>
      <div class="card styled-panel">
        <div class="card-head"><h2>Record purchase / restock</h2></div>
        <div class="form-grid">
          <div class="field"><label>Supplier</label><input id="purSup" class="input"></div>
          <div class="field"><label>Total cost</label><input id="purTotal" type="number" class="input"></div>
          <div class="field full"><label>Notes</label><input id="purNote" class="input" placeholder="Items received"></div>
        </div>
        <button class="btn btn-solid btn-sm" id="btnAddPur" style="margin-top:8px">Save purchase</button>
      </div>
      <div class="card styled-panel"><div class="card-head"><h2>Purchase history</h2></div>
        <div class="table-wrap"><table><thead><tr><th>Date</th><th>Supplier</th><th>Note</th><th>Total</th><th></th></tr></thead><tbody>${purch}</tbody></table></div>
      </div>`;
  }

  function wireInventory(ctx) {
    $('#btnAddPur')?.addEventListener('click', () => {
      BLD.update(db => {
        db.purchases.unshift({
          id: BLD.uid('pur'),
          date: new Date().toISOString(),
          supplier: $('#purSup').value.trim(),
          total: parseFloat($('#purTotal').value) || 0,
          note: $('#purNote').value.trim()
        });
      });
      BLD.logActivity('purchase', 'Purchase recorded');
      ctx.refresh();
    });
    $$('[data-pdel]').forEach(b => b.addEventListener('click', () => {
      BLD.update(db => { db.purchases = db.purchases.filter(p => p.id !== b.dataset.pdel); });
      ctx.refresh();
    }));
  }

  function activityHtml(data) {
    return `
      <div class="card styled-panel">
        <div class="card-head"><h2>Log daily note</h2></div>
        <div class="form-grid">
          <div class="field"><label>Type</label>
            <select id="actType"><option>note</option><option>opening</option><option>closing</option><option>incident</option><option>delivery</option></select>
          </div>
          <div class="field full"><label>Message</label><input id="actMsg" class="input"></div>
        </div>
        <button class="btn btn-solid btn-sm" id="btnAct" style="margin-top:8px">Add activity</button>
      </div>
      <div class="card styled-panel"><div class="table-wrap"><table>
        <thead><tr><th>When</th><th>Type</th><th>Message</th><th></th></tr></thead>
        <tbody>${(data.activities || []).map(a => `
          <tr><td>${esc((a.at || '').replace('T',' ').slice(0,16))}</td><td>${esc(a.type)}</td><td>${esc(a.message)}</td>
          <td><button class="btn btn-danger btn-sm" data-adel="${a.id}">Delete</button></td></tr>`).join('') ||
          '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:20px">Empty</td></tr>'}
      </tbody></table></div></div>`;
  }

  function wireActivity(ctx) {
    $('#btnAct')?.addEventListener('click', () => {
      BLD.logActivity($('#actType').value, $('#actMsg').value.trim());
      ctx.refresh();
    });
    $$('[data-adel]').forEach(b => b.addEventListener('click', () => {
      BLD.update(db => { db.activities = db.activities.filter(a => a.id !== b.dataset.adel); });
      ctx.refresh();
    }));
  }

  function employeesHtml(data) {
    const cards = (data.employees || []).map(e => `
      <article class="emp-card">
        <div class="emp-card-top">
          <div class="emp-avatar">${e.photo ? `<img src="${esc(e.photo)}" alt="">` : `<span>${esc((e.name || '?').slice(0, 1).toUpperCase())}</span>`}</div>
          <div>
            <h3>${esc(e.name)}</h3>
            <div class="emp-role">${esc(e.role || 'Staff')} · <span class="pill ${e.status === 'inactive' ? 'pill-muted' : 'pill-ok'}">${esc(e.status || 'active')}</span></div>
          </div>
        </div>
        <div class="emp-meta">
          <div><span>Phone</span>${esc(e.phone || '—')}</div>
          <div><span>Email</span>${esc(e.email || '—')}</div>
          <div><span>ID / NID</span>${esc(e.nationalId || '—')}</div>
          <div><span>Hired</span>${esc(e.hireDate || '—')}</div>
          <div><span>Wage</span>${money(e.wage || 0, data)} / ${esc(e.wageType || 'month')}</div>
          <div><span>Bank</span>${esc(e.bankAccount || '—')}</div>
          <div class="full"><span>Address</span>${esc(e.address || '—')}</div>
          <div class="full"><span>Emergency</span>${esc(e.emergencyContact || '—')}</div>
          ${e.notes ? `<div class="full"><span>Notes</span>${esc(e.notes)}</div>` : ''}
        </div>
        <div class="row-actions">
          <button class="btn btn-outline btn-sm" data-eedit="${e.id}">Edit</button>
          <button class="btn btn-danger btn-sm" data-edel="${e.id}">Delete</button>
        </div>
      </article>`).join('') || '<p style="color:var(--muted)">No employees saved yet.</p>';

    const shifts = (data.shifts || []).map(s => `
      <tr><td>${esc(s.employee || '')}</td><td>${esc(s.day || '')}</td><td>${esc(s.start || '')} – ${esc(s.end || '')}</td>
      <td><button class="btn btn-danger btn-sm" data-shdel="${s.id}">Delete</button></td></tr>`).join('') ||
      '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:20px">No shifts</td></tr>';

    return `
      <div class="card styled-panel">
        <div class="card-head"><h2 id="empFormTitle">Add employee</h2></div>
        <input type="hidden" id="empEditId" value="">
        <div class="form-grid">
          <div class="field"><label>Full name *</label><input id="empName" class="input" placeholder="e.g. Mugisha Alain"></div>
          <div class="field"><label>Role / title</label><input id="empRole" class="input" placeholder="Cashier, Manager…"></div>
          <div class="field"><label>Phone</label><input id="empPhone" class="input" placeholder="+250…"></div>
          <div class="field"><label>Email</label><input id="empEmail" class="input" type="email"></div>
          <div class="field"><label>National ID</label><input id="empNid" class="input"></div>
          <div class="field"><label>Hire date</label><input id="empHire" class="input" type="date"></div>
          <div class="field"><label>Wage amount</label><input id="empWage" type="number" class="input"></div>
          <div class="field"><label>Wage type</label><select id="empWageType"><option>month</option><option>day</option><option>hour</option></select></div>
          <div class="field"><label>Bank / MoMo account</label><input id="empBank" class="input"></div>
          <div class="field"><label>Status</label><select id="empStatus"><option value="active">Active</option><option value="inactive">Inactive</option><option value="on-leave">On leave</option></select></div>
          <div class="field full"><label>Home address</label><input id="empAddr" class="input"></div>
          <div class="field full"><label>Emergency contact</label><input id="empEmerg" class="input" placeholder="Name + phone"></div>
          <div class="field full"><label>Notes</label><textarea id="empNotes" rows="2"></textarea></div>
          <div class="field full"><label>Photo (from files)</label>
            <input type="file" id="empPhoto" accept="image/*" class="input">
            <input type="hidden" id="empPhotoData" value="">
            <div id="empPhotoPrev" class="photo-prev"></div>
          </div>
        </div>
        <div class="row-actions" style="margin-top:12px">
          <button class="btn btn-solid btn-sm" id="btnEmp">Save employee</button>
          <button class="btn btn-ghost btn-sm" id="btnEmpClear">Clear form</button>
        </div>
      </div>
      <div class="card styled-panel">
        <div class="card-head"><h2>Saved employees</h2></div>
        <div class="emp-grid">${cards}</div>
      </div>
      <div class="card styled-panel">
        <div class="card-head"><h2>Add shift</h2></div>
        <div class="form-grid">
          <div class="field"><label>Employee</label><input id="shEmp" class="input" list="empList"></div>
          <div class="field"><label>Day</label><input id="shDay" class="input" placeholder="Monday"></div>
          <div class="field"><label>Start</label><input id="shStart" class="input" placeholder="07:00"></div>
          <div class="field"><label>End</label><input id="shEnd" class="input" placeholder="15:00"></div>
        </div>
        <datalist id="empList">${(data.employees || []).map(e => `<option value="${esc(e.name)}">`).join('')}</datalist>
        <button class="btn btn-solid btn-sm" id="btnShift" style="margin-top:8px">Save shift</button>
      </div>
      <div class="card styled-panel"><div class="card-head"><h2>Schedule</h2></div>
        <div class="table-wrap"><table><thead><tr><th>Employee</th><th>Day</th><th>Hours</th><th></th></tr></thead><tbody>${shifts}</tbody></table></div>
      </div>`;
  }

  function clearEmpForm() {
    $('#empEditId').value = '';
    ['empName','empRole','empPhone','empEmail','empNid','empHire','empWage','empBank','empAddr','empEmerg','empNotes','empPhotoData'].forEach(id => {
      const el = $('#' + id); if (el) el.value = '';
    });
    if ($('#empWageType')) $('#empWageType').value = 'month';
    if ($('#empStatus')) $('#empStatus').value = 'active';
    if ($('#empPhoto')) $('#empPhoto').value = '';
    if ($('#empPhotoPrev')) $('#empPhotoPrev').innerHTML = '';
    if ($('#empFormTitle')) $('#empFormTitle').textContent = 'Add employee';
  }

  function fillEmpForm(e) {
    $('#empEditId').value = e.id;
    $('#empName').value = e.name || '';
    $('#empRole').value = e.role || '';
    $('#empPhone').value = e.phone || '';
    $('#empEmail').value = e.email || '';
    $('#empNid').value = e.nationalId || '';
    $('#empHire').value = e.hireDate || '';
    $('#empWage').value = e.wage || '';
    $('#empWageType').value = e.wageType || 'month';
    $('#empBank').value = e.bankAccount || '';
    $('#empStatus').value = e.status || 'active';
    $('#empAddr').value = e.address || '';
    $('#empEmerg').value = e.emergencyContact || '';
    $('#empNotes').value = e.notes || '';
    $('#empPhotoData').value = e.photo || '';
    $('#empPhotoPrev').innerHTML = e.photo ? `<img src="${e.photo}" alt="">` : '';
    $('#empFormTitle').textContent = 'Edit employee';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function wireEmployees(ctx) {
    $('#empPhoto')?.addEventListener('change', async () => {
      const f = $('#empPhoto').files?.[0];
      if (!f) return;
      const dataUrl = await BLD.readFileAsDataUrl(f);
      $('#empPhotoData').value = dataUrl;
      $('#empPhotoPrev').innerHTML = `<img src="${dataUrl}" alt="">`;
    });
    $('#btnEmpClear')?.addEventListener('click', clearEmpForm);
    $('#btnEmp')?.addEventListener('click', () => {
      if (!$('#empName').value.trim()) return alert('Name required');
      const payload = {
        name: $('#empName').value.trim(),
        role: $('#empRole').value.trim(),
        phone: $('#empPhone').value.trim(),
        email: $('#empEmail').value.trim(),
        nationalId: $('#empNid').value.trim(),
        hireDate: $('#empHire').value,
        wage: parseFloat($('#empWage').value) || 0,
        wageType: $('#empWageType').value,
        bankAccount: $('#empBank').value.trim(),
        status: $('#empStatus').value,
        address: $('#empAddr').value.trim(),
        emergencyContact: $('#empEmerg').value.trim(),
        notes: $('#empNotes').value.trim(),
        photo: $('#empPhotoData').value || ''
      };
      const editId = $('#empEditId').value;
      BLD.update(db => {
        if (editId) {
          const i = db.employees.findIndex(x => x.id === editId);
          if (i >= 0) db.employees[i] = Object.assign({}, db.employees[i], payload);
        } else {
          db.employees.unshift(Object.assign({ id: BLD.uid('emp'), createdAt: new Date().toISOString() }, payload));
        }
      });
      BLD.logActivity('employee', (editId ? 'Updated' : 'Added') + ' employee ' + payload.name);
      ctx.refresh();
    });
    $('#btnShift')?.addEventListener('click', () => {
      BLD.update(db => {
        db.shifts.unshift({
          id: BLD.uid('sh'),
          employee: $('#shEmp').value.trim(),
          day: $('#shDay').value.trim(),
          start: $('#shStart').value.trim(),
          end: $('#shEnd').value.trim()
        });
      });
      ctx.refresh();
    });
    $$('[data-eedit]').forEach(b => b.addEventListener('click', () => {
      const e = BLD.get().employees.find(x => x.id === b.dataset.eedit);
      if (e) fillEmpForm(e);
    }));
    $$('[data-edel]').forEach(b => b.addEventListener('click', () => {
      if (!confirm('Delete this employee record?')) return;
      BLD.update(db => { db.employees = db.employees.filter(e => e.id !== b.dataset.edel); });
      ctx.refresh();
    }));
    $$('[data-shdel]').forEach(b => b.addEventListener('click', () => {
      BLD.update(db => { db.shifts = db.shifts.filter(e => e.id !== b.dataset.shdel); });
      ctx.refresh();
    }));
  }

  function reviewsHtml(data) {
    const list = data.reviews || [];
    const avg = list.length ? (list.reduce((a, r) => a + (Number(r.rating) || 0), 0) / list.length).toFixed(1) : '—';
    const rows = list.map(r => `
      <tr>
        <td><strong>${esc(r.name || 'Guest')}</strong>
          <div style="font-size:.75rem;color:var(--muted)">${esc((r.at || '').replace('T',' ').slice(0,16))}</div>
        </td>
        <td>${'★'.repeat(r.rating || 0)}${'☆'.repeat(5 - (r.rating || 0))}</td>
        <td>${esc(r.reaction || '')}</td>
        <td>${esc(r.product || 'General')}</td>
        <td>${esc(r.comment || '')}</td>
        <td><button class="btn btn-danger btn-sm" data-rdel="${r.id}">Delete</button></td>
      </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px">No customer reviews yet</td></tr>';
    return `
      <div class="grid-kpi" style="grid-template-columns:repeat(2,1fr)">
        <div class="kpi"><div class="label">Reviews</div><div class="value">${list.length}</div></div>
        <div class="kpi"><div class="label">Avg rating</div><div class="value">${avg}</div></div>
      </div>
      <div class="card styled-panel">
        <div class="card-head"><h2>Customer feedback</h2></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Customer</th><th>Stars</th><th>Reaction</th><th>About</th><th>Comment</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>`;
  }

  function wireReviews(ctx) {
    $$('[data-rdel]').forEach(b => b.addEventListener('click', () => {
      BLD.update(db => { db.reviews = (db.reviews || []).filter(r => r.id !== b.dataset.rdel); });
      ctx.refresh();
    }));
  }

  function payrollHtml(data) {
    const rows = (data.salaries || []).map(s => `
      <tr><td>${esc(s.employee)}</td><td>${esc(s.period)}</td><td>${s.days || 0}d / ${s.hours || 0}h</td>
      <td>${money(s.amount, data)}</td>
      <td><button class="btn btn-danger btn-sm" data-saldel="${s.id}">Delete</button></td></tr>`).join('') ||
      '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px">No salary records</td></tr>';
    return `
      <div class="card">
        <div class="card-head"><h2>Calculate salary</h2></div>
        <div class="form-grid">
          <div class="field"><label>Employee</label>
            <select id="salEmp">${(data.employees || []).map(e => `<option value="${e.id}" data-wage="${e.wage}" data-type="${e.wageType}">${esc(e.name)} (${e.wageType})</option>`).join('') || '<option value="">Add employees first</option>'}
            </select>
          </div>
          <div class="field"><label>Period label</label><input id="salPeriod" class="input" placeholder="Sep 2026"></div>
          <div class="field"><label>Days worked</label><input id="salDays" type="number" class="input" value="26"></div>
          <div class="field"><label>Hours worked</label><input id="salHours" type="number" class="input" value="0"></div>
        </div>
        <button class="btn btn-solid btn-sm" id="btnSal" style="margin-top:8px">Compute &amp; save</button>
        <div id="salPreview" class="help" style="margin-top:12px"></div>
      </div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Employee</th><th>Period</th><th>Time</th><th>Amount</th><th></th></tr></thead><tbody>${rows}</tbody>
      </table></div></div>`;
  }

  function wirePayroll(ctx) {
    $('#btnSal')?.addEventListener('click', () => {
      const opt = $('#salEmp')?.selectedOptions?.[0];
      if (!opt || !opt.value) return alert('Select employee');
      const wage = parseFloat(opt.dataset.wage) || 0;
      const type = opt.dataset.type || 'month';
      const days = parseFloat($('#salDays').value) || 0;
      const hours = parseFloat($('#salHours').value) || 0;
      let amount = wage;
      if (type === 'day') amount = wage * days;
      if (type === 'hour') amount = wage * hours;
      if (type === 'month') amount = wage;
      $('#salPreview').textContent = 'Calculated: ' + money(amount);
      BLD.update(db => {
        db.salaries.unshift({
          id: BLD.uid('sal'),
          employee: opt.textContent.split(' (')[0],
          employeeId: opt.value,
          period: $('#salPeriod').value.trim() || BLD.todayKey().slice(0, 7),
          days, hours, amount,
          createdAt: new Date().toISOString()
        });
      });
      ctx.refresh();
    });
    $$('[data-saldel]').forEach(b => b.addEventListener('click', () => {
      BLD.update(db => { db.salaries = db.salaries.filter(s => s.id !== b.dataset.saldel); });
      ctx.refresh();
    }));
  }

  function debtsHtml(data) {
    const rows = (data.debts || []).map(d => `
      <tr><td><strong>${esc(d.customer)}</strong><div style="font-size:.75rem;color:var(--muted)">${esc(d.note || '')}</div></td>
      <td>${money(d.amount, data)}</td><td>${money(d.balance, data)}</td>
      <td>${d.status === 'paid' ? '<span class="pill pill-ok">Paid</span>' : '<span class="pill pill-warn">Open</span>'}</td>
      <td class="row-actions">
        <button class="btn btn-outline btn-sm" data-dpay="${d.id}">Record payment</button>
        <button class="btn btn-danger btn-sm" data-ddel="${d.id}">Delete</button>
      </td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px">No debts</td></tr>';
    return `
      <div class="card">
        <div class="card-head"><h2>Add customer debt</h2></div>
        <div class="form-grid">
          <div class="field"><label>Customer</label><input id="debtCust" class="input"></div>
          <div class="field"><label>Amount</label><input id="debtAmt" type="number" class="input"></div>
          <div class="field full"><label>Note</label><input id="debtNote" class="input"></div>
        </div>
        <button class="btn btn-solid btn-sm" id="btnDebt" style="margin-top:8px">Save debt</button>
      </div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Customer</th><th>Amount</th><th>Balance</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody>
      </table></div></div>`;
  }

  function wireDebts(ctx) {
    $('#btnDebt')?.addEventListener('click', () => {
      const amount = parseFloat($('#debtAmt').value) || 0;
      if (!$('#debtCust').value.trim() || amount <= 0) return alert('Customer and amount required');
      BLD.update(db => {
        db.debts.unshift({
          id: BLD.uid('debt'),
          customer: $('#debtCust').value.trim(),
          amount, balance: amount, status: 'open',
          note: $('#debtNote').value.trim(),
          createdAt: new Date().toISOString()
        });
      });
      ctx.refresh();
    });
    $$('[data-dpay]').forEach(b => b.addEventListener('click', () => {
      const pay = parseFloat(prompt('Payment amount (RWF)') || '0') || 0;
      if (pay <= 0) return;
      BLD.update(db => {
        const d = db.debts.find(x => x.id === b.dataset.dpay);
        if (!d) return;
        d.balance = Math.max(0, (Number(d.balance) || 0) - pay);
        if (d.balance <= 0) d.status = 'paid';
        db.payments.unshift({
          id: BLD.uid('pay'),
          customer: d.customer,
          amount: pay,
          method: 'debt-pay',
          date: new Date().toISOString(),
          note: 'Debt payment'
        });
      });
      ctx.refresh();
    }));
    $$('[data-ddel]').forEach(b => b.addEventListener('click', () => {
      BLD.update(db => { db.debts = db.debts.filter(d => d.id !== b.dataset.ddel); });
      ctx.refresh();
    }));
  }

  function paymentsHtml(data) {
    const rows = (data.payments || []).map(p => `
      <tr><td>${esc((p.date || '').slice(0, 16))}</td><td>${esc(p.customer || '')}</td>
      <td>${esc(p.method || '')}</td><td>${money(p.amount, data)}</td>
      <td><button class="btn btn-danger btn-sm" data-paydel="${p.id}">Delete</button></td></tr>`).join('') ||
      '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px">No payments</td></tr>';
    return `
      <div class="card">
        <div class="card-head"><h2>Record payment</h2></div>
        <div class="form-grid">
          <div class="field"><label>Customer</label><input id="payCust" class="input"></div>
          <div class="field"><label>Amount</label><input id="payAmt" type="number" class="input"></div>
          <div class="field"><label>Method</label><select id="payMethod"><option>momo</option><option>cash</option><option>card</option><option>bank</option></select></div>
          <div class="field"><label>Note</label><input id="payNote" class="input"></div>
        </div>
        <button class="btn btn-solid btn-sm" id="btnPay" style="margin-top:8px">Save payment</button>
      </div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Date</th><th>Customer</th><th>Method</th><th>Amount</th><th></th></tr></thead><tbody>${rows}</tbody>
      </table></div></div>`;
  }

  function wirePayments(ctx) {
    $('#btnPay')?.addEventListener('click', () => {
      BLD.update(db => {
        db.payments.unshift({
          id: BLD.uid('pay'),
          customer: $('#payCust').value.trim(),
          amount: parseFloat($('#payAmt').value) || 0,
          method: $('#payMethod').value,
          note: $('#payNote').value.trim(),
          date: new Date().toISOString()
        });
      });
      ctx.refresh();
    });
    $$('[data-paydel]').forEach(b => b.addEventListener('click', () => {
      BLD.update(db => { db.payments = db.payments.filter(p => p.id !== b.dataset.paydel); });
      ctx.refresh();
    }));
  }

  function ordersHtml(data) {
    const orders = (data.orders || []).map(o => `
      <tr><td>${esc((o.createdAt || '').slice(0, 16))}</td><td>${esc(o.customer || '')}</td>
      <td>${esc(o.phone || '')}</td><td>${money(o.total, data)}</td>
      <td><span class="pill ${o.status === 'delivered' ? 'pill-ok' : 'pill-warn'}">${esc(o.status || 'new')}</span></td>
      <td class="row-actions">
        <button class="btn btn-outline btn-sm" data-ost="${o.id}">Advance status</button>
        <button class="btn btn-danger btn-sm" data-odel="${o.id}">Delete</button>
      </td></tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px">No online orders yet</td></tr>';
    const ships = (data.shipments || []).map(s => `
      <tr><td>${esc(s.customer || '')}</td><td>${esc(s.address || '')}</td><td>${esc(s.courier || '')}</td>
      <td>${esc(s.status || '')}</td>
      <td><button class="btn btn-danger btn-sm" data-shidel="${s.id}">Delete</button></td></tr>`).join('') ||
      '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px">No shipments</td></tr>';
    return `
      <div class="card"><div class="card-head"><h2>Website / cart orders</h2></div>
        <div class="table-wrap"><table><thead><tr><th>When</th><th>Customer</th><th>Phone</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>${orders}</tbody></table></div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Create shipment</h2></div>
        <div class="form-grid">
          <div class="field"><label>Customer</label><input id="shipCust" class="input"></div>
          <div class="field"><label>Courier</label><input id="shipCour" class="input" placeholder="Motorbike / self"></div>
          <div class="field full"><label>Address</label><input id="shipAddr" class="input"></div>
        </div>
        <button class="btn btn-solid btn-sm" id="btnShip" style="margin-top:8px">Save shipment</button>
      </div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Customer</th><th>Address</th><th>Courier</th><th>Status</th><th></th></tr></thead><tbody>${ships}</tbody>
      </table></div></div>`;
  }

  function wireOrders(ctx) {
    const flow = ['new', 'preparing', 'shipped', 'delivered'];
    $$('[data-ost]').forEach(b => b.addEventListener('click', () => {
      BLD.update(db => {
        const o = db.orders.find(x => x.id === b.dataset.ost);
        if (!o) return;
        const i = flow.indexOf(o.status || 'new');
        o.status = flow[Math.min(i + 1, flow.length - 1)];
        if (o.status === 'shipped') {
          db.shipments.unshift({
            id: BLD.uid('ship'),
            orderId: o.id,
            customer: o.customer,
            address: o.address || '',
            courier: 'Assigned',
            status: 'in-transit',
            createdAt: new Date().toISOString()
          });
        }
      });
      ctx.refresh();
    }));
    $$('[data-odel]').forEach(b => b.addEventListener('click', () => {
      BLD.update(db => { db.orders = db.orders.filter(o => o.id !== b.dataset.odel); });
      ctx.refresh();
    }));
    $('#btnShip')?.addEventListener('click', () => {
      BLD.update(db => {
        db.shipments.unshift({
          id: BLD.uid('ship'),
          customer: $('#shipCust').value.trim(),
          address: $('#shipAddr').value.trim(),
          courier: $('#shipCour').value.trim(),
          status: 'pending',
          createdAt: new Date().toISOString()
        });
      });
      ctx.refresh();
    });
    $$('[data-shidel]').forEach(b => b.addEventListener('click', () => {
      BLD.update(db => { db.shipments = db.shipments.filter(s => s.id !== b.dataset.shidel); });
      ctx.refresh();
    }));
  }

  function logisticsHtml(data) {
    const rows = (data.logistics || []).map(l => `
      <tr><td>${esc(l.title)}</td><td>${esc(l.from || '')} → ${esc(l.to || '')}</td>
      <td>${esc(l.status || '')}</td>
      <td><button class="btn btn-danger btn-sm" data-ldel="${l.id}">Delete</button></td></tr>`).join('') ||
      '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:20px">No logistics entries</td></tr>';
    return `
      <div class="card">
        <div class="card-head"><h2>Add logistics run</h2></div>
        <div class="form-grid">
          <div class="field"><label>Title</label><input id="logTitle" class="input" placeholder="Supplier pickup"></div>
          <div class="field"><label>Status</label><select id="logStatus"><option>planned</option><option>in-transit</option><option>done</option></select></div>
          <div class="field"><label>From</label><input id="logFrom" class="input"></div>
          <div class="field"><label>To</label><input id="logTo" class="input" value="Boutique La Différence"></div>
        </div>
        <button class="btn btn-solid btn-sm" id="btnLog" style="margin-top:8px">Save</button>
      </div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Title</th><th>Route</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody>
      </table></div></div>`;
  }

  function wireLogistics(ctx) {
    $('#btnLog')?.addEventListener('click', () => {
      BLD.update(db => {
        db.logistics.unshift({
          id: BLD.uid('log'),
          title: $('#logTitle').value.trim(),
          from: $('#logFrom').value.trim(),
          to: $('#logTo').value.trim(),
          status: $('#logStatus').value,
          createdAt: new Date().toISOString()
        });
      });
      ctx.refresh();
    });
    $$('[data-ldel]').forEach(b => b.addEventListener('click', () => {
      BLD.update(db => { db.logistics = db.logistics.filter(l => l.id !== b.dataset.ldel); });
      ctx.refresh();
    }));
  }

  function cctvHtml(data) {
    const cams = data.cameras || [];
    const tiles = cams.map(c => `
      <div class="cctv-tile">
        ${c.streamUrl
          ? (c.streamUrl.includes('.m3u8') || c.streamUrl.includes('youtube') || c.streamUrl.includes('iframe')
            ? `<iframe src="${esc(c.streamUrl)}" title="${esc(c.name)}" allow="autoplay; encrypted-media" allowfullscreen></iframe>`
            : `<img src="${esc(c.streamUrl)}" alt="${esc(c.name)}" style="width:100%;height:100%;object-fit:cover">`)
          : `<div class="cctv-placeholder"><span class="live-dot"></span> LIVE · ${esc(c.name || 'Camera')}<br><small>Add stream URL</small></div>`}
        <div class="cctv-cap">
          <strong>${esc(c.name)}</strong> · ${esc(c.location || '')}
          <button class="btn btn-danger btn-sm" data-camdel="${c.id}">Remove</button>
        </div>
      </div>`).join('') || '<p style="color:var(--muted)">No cameras yet — add IP camera MJPEG/HLS/iframe URLs below.</p>';
    return `
      <div class="card">
        <div class="card-head"><h2>Add camera</h2></div>
        <div class="help" style="margin-bottom:12px">Paste a live stream URL from your DVR/NVR, IP camera MJPEG endpoint, or an embeddable viewer link. Browser permissions and camera vendor CORS rules apply.</div>
        <div class="form-grid">
          <div class="field"><label>Camera name</label><input id="camName" class="input" placeholder="Front entrance"></div>
          <div class="field"><label>Location</label><input id="camLoc" class="input" placeholder="Door / aisle"></div>
          <div class="field full"><label>Live stream / embed URL</label><input id="camUrl" class="input" placeholder="https://…"></div>
        </div>
        <button class="btn btn-solid btn-sm" id="btnCam" style="margin-top:8px">Add camera</button>
      </div>
      <div class="cctv-grid">${tiles}</div>`;
  }

  function wireCctv(ctx) {
    $('#btnCam')?.addEventListener('click', () => {
      if (!$('#camName').value.trim()) return alert('Name required');
      BLD.update(db => {
        db.cameras.unshift({
          id: BLD.uid('cam'),
          name: $('#camName').value.trim(),
          location: $('#camLoc').value.trim(),
          streamUrl: $('#camUrl').value.trim()
        });
      });
      ctx.refresh();
    });
    $$('[data-camdel]').forEach(b => b.addEventListener('click', () => {
      BLD.update(db => { db.cameras = db.cameras.filter(c => c.id !== b.dataset.camdel); });
      ctx.refresh();
    }));
  }

  function chatHtml(data) {
    const msgs = (data.chatMessages || []).slice().reverse().map(m => `
      <div class="chat-bubble ${m.from === 'admin' ? 'admin' : 'customer'}">
        <div class="meta">${esc(m.from)} · ${esc((m.at || '').replace('T',' ').slice(0,16))}</div>
        ${esc(m.text)}
      </div>`).join('') || '<p style="color:var(--muted)">No customer messages yet.</p>';
    return `
      <div class="card">
        <div class="card-head"><h2>Service inbox</h2></div>
        <div class="chat-pane" id="chatPane">${msgs}</div>
        <div class="confirm-row" style="margin-top:12px">
          <input id="chatReply" class="input" placeholder="Reply as shop…">
          <button class="btn btn-solid btn-sm" id="btnChat">Send</button>
        </div>
      </div>`;
  }

  function wireChat(ctx) {
    $('#btnChat')?.addEventListener('click', () => {
      const text = $('#chatReply').value.trim();
      if (!text) return;
      BLD.update(db => {
        db.chatMessages.push({ id: BLD.uid('msg'), from: 'admin', text, at: new Date().toISOString() });
      });
      ctx.refresh();
    });
  }

  function policiesHtml(data) {
    const rows = (data.policies || []).map(p => `
      <tr><td><strong>${esc(p.title)}</strong><div style="font-size:.8rem;color:var(--muted)">${esc(p.body || '')}</div></td>
      <td><button class="btn btn-danger btn-sm" data-poldel="${p.id}">Delete</button></td></tr>`).join('') ||
      '<tr><td colspan="2" style="text-align:center;color:var(--muted);padding:20px">No policies</td></tr>';
    return `
      <div class="card">
        <div class="card-head"><h2>Add policy rule</h2></div>
        <div class="form-grid">
          <div class="field full"><label>Title</label><input id="polTitle" class="input" placeholder="Return policy"></div>
          <div class="field full"><label>Details</label><textarea id="polBody" rows="3"></textarea></div>
        </div>
        <button class="btn btn-solid btn-sm" id="btnPol" style="margin-top:8px">Save policy</button>
      </div>
      <div class="card"><div class="table-wrap"><table><thead><tr><th>Policy</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }

  function wirePolicies(ctx) {
    $('#btnPol')?.addEventListener('click', () => {
      BLD.update(db => {
        db.policies.unshift({
          id: BLD.uid('pol'),
          title: $('#polTitle').value.trim(),
          body: $('#polBody').value.trim()
        });
      });
      ctx.refresh();
    });
    $$('[data-poldel]').forEach(b => b.addEventListener('click', () => {
      BLD.update(db => { db.policies = db.policies.filter(p => p.id !== b.dataset.poldel); });
      ctx.refresh();
    }));
  }

  function teamHtml(data) {
    const rows = (data.team || []).map(t => `
      <tr><td><strong>${esc(t.name)}</strong><div style="font-size:.8rem;color:var(--muted)">${esc(t.role || '')}</div></td>
      <td>${esc(t.bio || '')}</td>
      <td><button class="btn btn-danger btn-sm" data-tdel="${t.id}">Delete</button></td></tr>`).join('') ||
      '<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:20px">Add team members for the public About page</td></tr>';
    return `
      <div class="card">
        <div class="card-head"><h2>Add team member</h2></div>
        <div class="form-grid">
          <div class="field"><label>Name</label><input id="tmName" class="input"></div>
          <div class="field"><label>Role</label><input id="tmRole" class="input"></div>
          <div class="field full"><label>Short bio</label><input id="tmBio" class="input"></div>
          <div class="field full"><label>Photo URL or media:id</label><input id="tmPhoto" class="input"></div>
        </div>
        <button class="btn btn-solid btn-sm" id="btnTm" style="margin-top:8px">Save</button>
      </div>
      <div class="card"><div class="table-wrap"><table><thead><tr><th>Person</th><th>Bio</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }

  function wireTeam(ctx) {
    $('#btnTm')?.addEventListener('click', () => {
      if (!$('#tmName').value.trim()) return alert('Name required');
      BLD.update(db => {
        db.team.unshift({
          id: BLD.uid('tm'),
          name: $('#tmName').value.trim(),
          role: $('#tmRole').value.trim(),
          bio: $('#tmBio').value.trim(),
          photo: $('#tmPhoto').value.trim()
        });
      });
      ctx.refresh();
    });
    $$('[data-tdel]').forEach(b => b.addEventListener('click', () => {
      BLD.update(db => { db.team = db.team.filter(t => t.id !== b.dataset.tdel); });
      ctx.refresh();
    }));
  }

  function adsHtml(data) {
    const rows = (data.ads || []).map(a => `
      <tr><td><strong>${esc(a.businessName)}</strong><div style="font-size:.8rem;color:var(--muted)">${esc(a.blurb || '')}</div></td>
      <td>${a.active !== false ? '<span class="pill pill-ok">Live</span>' : '<span class="pill pill-muted">Off</span>'}</td>
      <td class="row-actions">
        <button class="btn btn-outline btn-sm" data-atog="${a.id}">Toggle</button>
        <button class="btn btn-danger btn-sm" data-adel="${a.id}">Delete</button>
      </td></tr>`).join('') ||
      '<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:20px">Advertise other Rwandan businesses on your site</td></tr>';
    return `
      <div class="card">
        <div class="card-head"><h2>Advertise a business in Rwanda</h2></div>
        <div class="form-grid">
          <div class="field"><label>Business name</label><input id="adName" class="input"></div>
          <div class="field"><label>Website / WhatsApp link</label><input id="adLink" class="input" placeholder="https://…"></div>
          <div class="field full"><label>Short blurb</label><input id="adBlurb" class="input"></div>
          <div class="field full"><label>Image URL (optional)</label><input id="adImg" class="input"></div>
        </div>
        <button class="btn btn-solid btn-sm" id="btnAd" style="margin-top:8px">Publish ad</button>
      </div>
      <div class="card"><div class="table-wrap"><table><thead><tr><th>Business</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }

  function wireAds(ctx) {
    $('#btnAd')?.addEventListener('click', () => {
      if (!$('#adName').value.trim()) return alert('Business name required');
      BLD.update(db => {
        db.ads.unshift({
          id: BLD.uid('ad'),
          businessName: $('#adName').value.trim(),
          link: $('#adLink').value.trim(),
          blurb: $('#adBlurb').value.trim(),
          image: $('#adImg').value.trim(),
          active: true
        });
      });
      ctx.refresh();
    });
    $$('[data-atog]').forEach(b => b.addEventListener('click', () => {
      BLD.update(db => {
        const a = db.ads.find(x => x.id === b.dataset.atog);
        if (a) a.active = (a.active === false);
      });
      ctx.refresh();
    }));
    $$('[data-adel]').forEach(b => b.addEventListener('click', () => {
      BLD.update(db => { db.ads = db.ads.filter(a => a.id !== b.dataset.adel); });
      ctx.refresh();
    }));
  }

  function socialHtml(data) {
    const s = data.settings.social || {};
    return `
      <div class="card">
        <div class="card-head"><h2>Social media links</h2></div>
        <div class="form-grid">
          <div class="field"><label>Facebook</label><input id="socFb" class="input" value="${esc(s.facebook || '')}"></div>
          <div class="field"><label>Instagram</label><input id="socIg" class="input" value="${esc(s.instagram || '')}"></div>
          <div class="field"><label>X / Twitter</label><input id="socTw" class="input" value="${esc(s.twitter || '')}"></div>
          <div class="field"><label>TikTok</label><input id="socTk" class="input" value="${esc(s.tiktok || '')}"></div>
          <div class="field"><label>YouTube</label><input id="socYt" class="input" value="${esc(s.youtube || '')}"></div>
          <div class="field"><label>WhatsApp channel</label><input id="socWa" class="input" value="${esc(s.whatsappChannel || '')}"></div>
        </div>
        <button class="btn btn-solid" id="btnSoc" style="margin-top:12px">Save social links</button>
      </div>
      <div class="card">
        <div class="card-head"><h2>About us (website)</h2></div>
        <div class="form-grid">
          <div class="field full"><label>Our story</label><textarea id="aboutStory" rows="4">${esc(data.settings.about?.story || '')}</textarea></div>
          <div class="field full"><label>Mission</label><textarea id="aboutMission" rows="2">${esc(data.settings.about?.mission || '')}</textarea></div>
        </div>
        <button class="btn btn-solid" id="btnAbout" style="margin-top:12px">Save about</button>
      </div>`;
  }

  function wireSocial(ctx) {
    $('#btnSoc')?.addEventListener('click', () => {
      BLD.update(db => {
        db.settings.social = {
          facebook: $('#socFb').value.trim(),
          instagram: $('#socIg').value.trim(),
          twitter: $('#socTw').value.trim(),
          tiktok: $('#socTk').value.trim(),
          youtube: $('#socYt').value.trim(),
          whatsappChannel: $('#socWa').value.trim()
        };
      });
      ctx.toast('Social links saved');
    });
    $('#btnAbout')?.addEventListener('click', () => {
      BLD.update(db => {
        db.settings.about = {
          story: $('#aboutStory').value.trim(),
          mission: $('#aboutMission').value.trim()
        };
      });
      ctx.toast('About section saved');
    });
  }

  function renderTab(tab, data) {
    if (tab === 'sales') return salesHtml(data);
    if (tab === 'barcode') return barcodeHtml();
    if (tab === 'inventory') return inventoryHtml(data);
    if (tab === 'activity') return activityHtml(data);
    if (tab === 'employees') return employeesHtml(data);
    if (tab === 'payroll') return payrollHtml(data);
    if (tab === 'debts') return debtsHtml(data);
    if (tab === 'payments') return paymentsHtml(data);
    if (tab === 'orders') return ordersHtml(data);
    if (tab === 'logistics') return logisticsHtml(data);
    if (tab === 'cctv') return cctvHtml(data);
    if (tab === 'chat') return chatHtml(data);
    if (tab === 'reviews') return reviewsHtml(data);
    if (tab === 'policies') return policiesHtml(data);
    if (tab === 'team') return teamHtml(data);
    if (tab === 'ads') return adsHtml(data);
    if (tab === 'social') return socialHtml(data);
    return null;
  }

  function wireTab(tab, ctx) {
    if (tab === 'overview') mountChart(ctx.data);
    if (tab === 'sales') wireSales(ctx);
    if (tab === 'barcode') wireBarcode(ctx);
    if (tab === 'inventory') wireInventory(ctx);
    if (tab === 'activity') wireActivity(ctx);
    if (tab === 'employees') wireEmployees(ctx);
    if (tab === 'payroll') wirePayroll(ctx);
    if (tab === 'debts') wireDebts(ctx);
    if (tab === 'payments') wirePayments(ctx);
    if (tab === 'orders') wireOrders(ctx);
    if (tab === 'logistics') wireLogistics(ctx);
    if (tab === 'cctv') wireCctv(ctx);
    if (tab === 'chat') wireChat(ctx);
    if (tab === 'reviews') wireReviews(ctx);
    if (tab === 'policies') wirePolicies(ctx);
    if (tab === 'team') wireTeam(ctx);
    if (tab === 'ads') wireAds(ctx);
    if (tab === 'social') wireSocial(ctx);
  }

  global.BLDAdminOps = { NAV, TITLES, overviewExtra, renderTab, wireTab, mountChart };
})(window);
