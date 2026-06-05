/* ============================================================
   admin.js — Luxury Crop dashboard
   - CRUD categories + items, drag reorder, allergen editor,
     availability toggle, live preview (iframe reads same data).
   - Persistence: localStorage('luxurycrop.menu') + JSON export/import.
   - SECURITY: all rendered data is escaped (esc). Imported JSON is
     run through normalizeMenu() which validates structure, coerces
     types, clamps string lengths, filters allergen keys, and drops
     unknown/unsafe fields — so a malicious file cannot inject markup
     or break the schema.
   ============================================================ */
(function () {
  'use strict';
  var I = window.ICONS;
  var KEY = 'luxurycrop.menu';
  var $ = function (s, r) { return (r || document).querySelector(s); };

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function safeUrl(u) { var s = String(u == null ? '' : u).trim(); return /^(https?:|mailto:|tel:)/i.test(s) ? s : ''; }
  function clampStr(s, n) { return String(s == null ? '' : s).slice(0, n); }
  function numOrNull(v) { if (v === '' || v == null) return null; var n = Number(v); return isFinite(n) ? n : null; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function slugify(s, fallback) {
    var x = String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return x || (fallback || ('cat-' + Date.now().toString(36)));
  }
  function genId() { return 'x' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }

  var DEFAULT_ALLERGENS = [
    { key: 'gluten', ar: 'جلوتين', en: 'Gluten' }, { key: 'crustaceans', ar: 'قشريات', en: 'Crustaceans' },
    { key: 'eggs', ar: 'بيض', en: 'Eggs' }, { key: 'fish', ar: 'أسماك', en: 'Fish' },
    { key: 'peanuts', ar: 'فول سوداني', en: 'Peanuts' }, { key: 'soy', ar: 'صويا', en: 'Soy' },
    { key: 'milk', ar: 'حليب', en: 'Milk' }, { key: 'treenuts', ar: 'مكسرات', en: 'Tree nuts' },
    { key: 'celery', ar: 'كرفس', en: 'Celery' }, { key: 'mustard', ar: 'خردل', en: 'Mustard' },
    { key: 'sesame', ar: 'سمسم', en: 'Sesame' }, { key: 'sulphites', ar: 'كبريتات', en: 'Sulphites' },
    { key: 'lupin', ar: 'ترمس', en: 'Lupin' }, { key: 'molluscs', ar: 'رخويات', en: 'Molluscs' }
  ];

  // ---------- state ----------
  var MODEL = null;        // working copy
  var ORIGINAL = null;     // pristine menu.json (for Reset)
  var selCat = 0;
  var dirty = false;
  var editingItem = null;  // {catIdx, itemIdx} or {catIdx, itemIdx:-1} for new
  var editingCat = null;   // catIdx or -1 for new

  function allergenRef() { return (MODEL && MODEL.allergen_ref) || DEFAULT_ALLERGENS; }
  function allergenKeys() { return allergenRef().map(function (a) { return a.key; }); }

  // ---------- normalize / validate (security boundary) ----------
  function normalizeItem(raw) {
    raw = (raw && typeof raw === 'object') ? raw : {};
    var keys = allergenKeys();
    var al = Array.isArray(raw.allergens) ? raw.allergens.filter(function (k) { return keys.indexOf(k) !== -1; }) : [];
    var img = safeUrl(raw.image) || (typeof raw.image === 'string' && /^products\//.test(raw.image) ? raw.image : null);
    return {
      id: raw.id ? clampStr(raw.id, 40) : genId(),
      name_ar: clampStr(raw.name_ar, 160),
      name_en: clampStr(raw.name_en, 160),
      desc_ar: clampStr(raw.desc_ar, 600),
      desc_en: clampStr(raw.desc_en, 600),
      price: numOrNull(raw.price),
      currency: 'SAR',
      image: img || null,
      allergens: al,
      allergens_confirmed: !!raw.allergens_confirmed,
      kcal: numOrNull(raw.kcal),
      caffeine_mg: numOrNull(raw.caffeine_mg),
      nutrition_estimated: raw.nutrition_estimated !== false,
      high_sodium: !!raw.high_sodium,
      available: raw.available !== false
    };
  }
  function normalizeCat(raw, i) {
    raw = (raw && typeof raw === 'object') ? raw : {};
    return {
      id: raw.id ? clampStr(raw.id, 40) : genId(),
      slug: slugify(raw.slug || raw.name_en || ('cat-' + i)),
      name_ar: clampStr(raw.name_ar, 120),
      name_en: clampStr(raw.name_en, 120),
      sub_ar: clampStr(raw.sub_ar, 200),
      sub_en: clampStr(raw.sub_en, 200),
      items: Array.isArray(raw.items) ? raw.items.map(normalizeItem) : []
    };
  }
  function normalizeBrand(raw) {
    raw = (raw && typeof raw === 'object') ? raw : {};
    return {
      name_ar: clampStr(raw.name_ar || 'محصول فاخر', 80),
      name_en: clampStr(raw.name_en || 'Luxury Crop', 80),
      tagline_ar: clampStr(raw.tagline_ar, 120),
      tagline_en: clampStr(raw.tagline_en, 120),
      logo: (typeof raw.logo === 'string' && /^assets\//.test(raw.logo)) ? raw.logo : (safeUrl(raw.logo) || 'assets/logo.jpg'),
      theme: (raw.theme && typeof raw.theme === 'object') ? raw.theme : { bg: '#ffffff', ink: '#0a0a0a', accent: '#e1352b', muted: '#6b6b6b' },
      location_ar: clampStr(raw.location_ar, 80),
      location_en: clampStr(raw.location_en, 80),
      rating: numOrNull(raw.rating),
      instagram: safeUrl(raw.instagram),
      tiktok: safeUrl(raw.tiktok),
      maps: safeUrl(raw.maps),
      whatsapp_admin: clampStr(String(raw.whatsapp_admin || '').replace(/[^0-9]/g, ''), 20)
    };
  }
  function normalizeMenu(raw) {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'الملف ليس بصيغة JSON صالحة (كائن).' };
    if (!Array.isArray(raw.categories)) return { ok: false, error: 'الحقل "categories" مفقود أو ليس قائمة.' };
    var alref = Array.isArray(raw.allergen_ref)
      ? raw.allergen_ref.filter(function (a) { return a && typeof a.key === 'string'; })
        .map(function (a) { return { key: clampStr(a.key, 30), ar: clampStr(a.ar, 40), en: clampStr(a.en, 40) }; })
      : DEFAULT_ALLERGENS;
    if (!alref.length) alref = DEFAULT_ALLERGENS;
    var menu = {
      _meta: (raw._meta && typeof raw._meta === 'object') ? raw._meta : { schema_version: 1 },
      brand: normalizeBrand(raw.brand),
      allergen_ref: alref,
      categories: raw.categories.map(normalizeCat)
    };
    return { ok: true, menu: menu };
  }

  // ---------- persistence ----------
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(MODEL)); } catch (e) { toast('تعذّر الحفظ محليًا', true); }
    setDirty(false);
    refreshPreview();
  }
  function setDirty(v) {
    dirty = v;
    var d = $('#savedDot');
    d.classList.toggle('dirty', v);
    $('#savedText').textContent = v ? 'لم يُحفظ' : 'محفوظ تلقائيًا';
  }

  function load() {
    fetch('data/menu.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (j) {
        ORIGINAL = normalizeMenu(j).menu;
        var saved = null;
        try { saved = localStorage.getItem(KEY); } catch (e) {}
        if (saved) {
          var n = normalizeMenu(JSON.parse(saved));
          MODEL = n.ok ? n.menu : clone(ORIGINAL);
        } else {
          MODEL = clone(ORIGINAL);
        }
        boot();
      })
      .catch(function (err) {
        // no file (opened from file://) → try localStorage, else default skeleton
        var saved = null; try { saved = localStorage.getItem(KEY); } catch (e) {}
        if (saved) { var n = normalizeMenu(JSON.parse(saved)); if (n.ok) { MODEL = n.menu; ORIGINAL = clone(n.menu); boot(); return; } }
        $('#app').innerHTML = '<div class="empty-hint">تعذّر تحميل data/menu.json — افتح اللوحة عبر خادم محلي.<br><small>' + esc(String(err.message || err)) + '</small></div>';
      });
  }

  // ---------- render ----------
  function render() { renderCats(); renderItems(); }

  function renderCats() {
    var list = $('#catList');
    list.innerHTML = MODEL.categories.map(function (c, i) {
      return '<div class="cat-row' + (i === selCat ? ' active' : '') + '" data-ci="' + i + '" draggable="true" data-kind="cat">' +
        '<span class="drag" data-drag aria-hidden="true">' + I.get('drag') + '</span>' +
        '<div class="cat-main"><div class="nm">' + esc(c.name_ar) + '</div>' +
        '<div class="sub">' + esc(c.name_en) + ' · ' + c.items.length + ' صنف</div></div>' +
        '<button class="icon-btn" data-editcat="' + i + '" aria-label="تعديل القسم">' + I.get('edit') + '</button>' +
        '</div>';
    }).join('') || '<div class="empty-hint">لا أقسام بعد</div>';
    $('#catCount').textContent = MODEL.categories.length;
  }

  function renderItems() {
    var cat = MODEL.categories[selCat];
    $('#itemsTitle').textContent = cat ? cat.name_ar : '—';
    $('#itemCount').textContent = cat ? cat.items.length : 0;
    var list = $('#itemList');
    if (!cat) { list.innerHTML = '<div class="empty-hint">اختر قسمًا</div>'; return; }
    list.innerHTML = cat.items.map(function (it, i) {
      var price = it.price == null ? '<span class="tag-todo">TODO</span>' : '<span class="price">' + esc(it.price) + ' ' + I.get('riyal', 'cur-ic') + '</span>';
      var meta = [price];
      if (it.kcal != null) meta.push(esc(it.kcal) + ' سعرة');
      if (it.caffeine_mg) meta.push(esc(it.caffeine_mg) + ' مجم كافيين');
      if (it.allergens && it.allergens.length) meta.push(it.allergens.length + ' مسبب حساسية');
      return '<div class="item-row" data-ii="' + i + '" draggable="true" data-kind="item">' +
        '<span class="drag" data-drag aria-hidden="true">' + I.get('drag') + '</span>' +
        '<div class="it-main"><div class="it-name">' + esc(it.name_ar) +
          (it.name_en ? ' <span class="en">' + esc(it.name_en) + '</span>' : '') +
          (it.available === false ? ' <span class="tag-off">موقوف</span>' : '') + '</div>' +
        '<div class="it-meta">' + meta.join(' <span style="color:#cfcfcf">•</span> ') + '</div></div>' +
        '<div class="it-actions">' +
          '<button class="icon-btn" data-avail="' + i + '" aria-label="إتاحة/إيقاف" title="إتاحة/إيقاف">' + I.get(it.available === false ? 'eye' : 'check') + '</button>' +
          '<button class="icon-btn" data-edititem="' + i + '" aria-label="تعديل">' + I.get('edit') + '</button>' +
          '<button class="icon-btn" data-delitem="' + i + '" aria-label="حذف">' + I.get('trash') + '</button>' +
        '</div></div>';
    }).join('') || '<div class="empty-hint">لا أصناف في هذا القسم — أضف صنفًا</div>';
  }

  // ---------- item drawer ----------
  function openItemDrawer(catIdx, itemIdx) {
    editingItem = { catIdx: catIdx, itemIdx: itemIdx };
    var isNew = itemIdx < 0;
    var it = isNew ? normalizeItem({ available: true, nutrition_estimated: true }) : clone(MODEL.categories[catIdx].items[itemIdx]);
    $('#drawerTitle').textContent = isNew ? 'صنف جديد' : 'تعديل صنف';
    $('#drawerBody').innerHTML =
      grp('الاسم (عربي)', '<input type="text" id="f_name_ar" value="' + esc(it.name_ar) + '">') +
      grp('Name (English)', '<input type="text" id="f_name_en" dir="ltr" value="' + esc(it.name_en) + '">') +
      grp('الوصف (عربي)', '<textarea id="f_desc_ar">' + esc(it.desc_ar) + '</textarea>') +
      grp('Description (English)', '<textarea id="f_desc_en" dir="ltr">' + esc(it.desc_en) + '</textarea>') +
      '<div class="grid2">' +
        grp('السعر (ر.س)', '<input type="number" id="f_price" min="0" step="1" value="' + (it.price == null ? '' : esc(it.price)) + '">') +
        grp('السعرات (تقديري)', '<input type="number" id="f_kcal" min="0" step="1" value="' + (it.kcal == null ? '' : esc(it.kcal)) + '">') +
      '</div>' +
      '<div class="grid2">' +
        grp('الكافيين مجم (تقديري)', '<input type="number" id="f_caf" min="0" step="1" value="' + (it.caffeine_mg == null ? '' : esc(it.caffeine_mg)) + '">') +
        grp('رابط صورة (اختياري)', '<input type="url" id="f_img" dir="ltr" placeholder="https://…" value="' + esc(safeUrl(it.image)) + '"><span class="hint">الصور مخفية في التصميم النصّي الحالي.</span>') +
      '</div>' +
      grp('مسببات الحساسية', '<div class="allergen-pick" id="f_allergens">' +
        allergenRef().map(function (a) {
          var on = it.allergens.indexOf(a.key) !== -1;
          return '<button type="button" class="al-chip' + (on ? ' on' : '') + '" data-al="' + esc(a.key) + '">' + I.al(a.key) + esc(a.ar) + '</button>';
        }).join('') + '</div>') +
      '<div class="field"><label class="switch"><input type="checkbox" id="f_salt"' + (it.high_sodium ? ' checked' : '') + '><span class="track"></span>صوديوم عالٍ</label></div>' +
      '<div class="field"><label class="switch"><input type="checkbox" id="f_avail"' + (it.available !== false ? ' checked' : '') + '><span class="track"></span>متاح للعرض</label></div>';
    $('#drawerDelete').style.display = isNew ? 'none' : '';
    $('#drawerSave').dataset.mode = 'item';
    openDrawer();
  }
  function grp(label, inner) { return '<div class="field"><label>' + esc(label) + '</label>' + inner + '</div>'; }

  function saveItem() {
    var ci = editingItem.catIdx, ii = editingItem.itemIdx;
    var sel = [].map.call(document.querySelectorAll('#f_allergens .al-chip.on'), function (b) { return b.dataset.al; });
    var data = normalizeItem({
      id: ii < 0 ? genId() : MODEL.categories[ci].items[ii].id,
      name_ar: $('#f_name_ar').value, name_en: $('#f_name_en').value,
      desc_ar: $('#f_desc_ar').value, desc_en: $('#f_desc_en').value,
      price: $('#f_price').value, kcal: $('#f_kcal').value, caffeine_mg: $('#f_caf').value,
      image: $('#f_img').value, allergens: sel,
      high_sodium: $('#f_salt').checked, available: $('#f_avail').checked,
      nutrition_estimated: true
    });
    if (!data.name_ar && !data.name_en) { toast('أدخل اسم الصنف', true); return; }
    if (ii < 0) MODEL.categories[ci].items.push(data); else MODEL.categories[ci].items[ii] = data;
    persist(); render(); closeDrawer(); toast('تم حفظ الصنف');
  }

  // ---------- category drawer ----------
  function openCatDrawer(catIdx) {
    editingCat = catIdx;
    var isNew = catIdx < 0;
    var c = isNew ? { name_ar: '', name_en: '', sub_ar: '', sub_en: '', slug: '' } : clone(MODEL.categories[catIdx]);
    $('#drawerTitle').textContent = isNew ? 'قسم جديد' : 'تعديل قسم';
    $('#drawerBody').innerHTML =
      grp('اسم القسم (عربي)', '<input type="text" id="c_name_ar" value="' + esc(c.name_ar) + '">') +
      grp('Category name (English)', '<input type="text" id="c_name_en" dir="ltr" value="' + esc(c.name_en) + '">') +
      grp('وصف مختصر (عربي)', '<input type="text" id="c_sub_ar" value="' + esc(c.sub_ar) + '">') +
      grp('Short description (English)', '<input type="text" id="c_sub_en" dir="ltr" value="' + esc(c.sub_en) + '">');
    $('#drawerDelete').style.display = (isNew || MODEL.categories.length <= 1) ? 'none' : '';
    $('#drawerSave').dataset.mode = 'cat';
    openDrawer('cat');
  }
  function saveCat() {
    var ci = editingCat, isNew = ci < 0;
    var raw = {
      name_ar: $('#c_name_ar').value, name_en: $('#c_name_en').value,
      sub_ar: $('#c_sub_ar').value, sub_en: $('#c_sub_en').value,
      slug: isNew ? '' : MODEL.categories[ci].slug
    };
    if (!raw.name_ar && !raw.name_en) { toast('أدخل اسم القسم', true); return; }
    if (isNew) {
      var c = normalizeCat(raw, MODEL.categories.length); c.items = [];
      MODEL.categories.push(c); selCat = MODEL.categories.length - 1;
    } else {
      var ex = MODEL.categories[ci];
      ex.name_ar = clampStr(raw.name_ar, 120); ex.name_en = clampStr(raw.name_en, 120);
      ex.sub_ar = clampStr(raw.sub_ar, 200); ex.sub_en = clampStr(raw.sub_en, 200);
    }
    persist(); render(); closeDrawer(); toast('تم حفظ القسم');
  }

  // ---------- drawer open/close ----------
  function openDrawer() { $('#drawerBack').classList.add('open'); $('#drawer').classList.add('open'); document.body.style.overflow = 'hidden'; }
  function closeDrawer() { $('#drawerBack').classList.remove('open'); $('#drawer').classList.remove('open'); document.body.style.overflow = ''; editingItem = null; editingCat = null; $('#drawerSave').dataset.mode = 'item'; }

  // ---------- delete / availability ----------
  function deleteItem(ci, ii) {
    var it = MODEL.categories[ci].items[ii];
    if (!confirm('حذف «' + (it.name_ar || it.name_en) + '»؟')) return;
    MODEL.categories[ci].items.splice(ii, 1); persist(); render(); toast('تم الحذف');
  }
  function deleteCat() {
    if (editingCat < 0 || MODEL.categories.length <= 1) return;
    var c = MODEL.categories[editingCat];
    if (!confirm('حذف القسم «' + (c.name_ar || c.name_en) + '» وكل أصنافه؟')) return;
    MODEL.categories.splice(editingCat, 1); selCat = Math.max(0, selCat - 1);
    persist(); render(); closeDrawer(); toast('تم حذف القسم');
  }
  function toggleAvail(ci, ii) { var it = MODEL.categories[ci].items[ii]; it.available = it.available === false ? true : false; persist(); render(); }

  // ---------- drag & drop reorder ----------
  var dragKind = null, dragIdx = -1;
  function onDragStart(e) {
    var row = e.target.closest('[data-kind]'); if (!row) return;
    dragKind = row.dataset.kind; dragIdx = +(row.dataset.ci != null ? row.dataset.ci : row.dataset.ii);
    row.classList.add('dragging'); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(dragIdx)); } catch (x) {}
  }
  function onDragOver(e) {
    var row = e.target.closest('[data-kind]'); if (!row || row.dataset.kind !== dragKind) return;
    e.preventDefault();
    var r = row.getBoundingClientRect(); var after = (e.clientY - r.top) > r.height / 2;
    document.querySelectorAll('.drop-above,.drop-below').forEach(function (x) { x.classList.remove('drop-above', 'drop-below'); });
    row.classList.add(after ? 'drop-below' : 'drop-above');
  }
  function onDrop(e) {
    var row = e.target.closest('[data-kind]'); if (!row || row.dataset.kind !== dragKind) return cleanupDrag();
    e.preventDefault();
    var to = +(row.dataset.ci != null ? row.dataset.ci : row.dataset.ii);
    var r = row.getBoundingClientRect(); if ((e.clientY - r.top) > r.height / 2) to += 1;
    var arr = dragKind === 'cat' ? MODEL.categories : MODEL.categories[selCat].items;
    if (dragIdx < to) to -= 1;
    if (to !== dragIdx && dragIdx >= 0 && to >= 0 && to <= arr.length) {
      var moved = arr.splice(dragIdx, 1)[0]; arr.splice(to, 0, moved);
      if (dragKind === 'cat') selCat = arr.indexOf(moved);
      persist(); render();
    }
    cleanupDrag();
  }
  function cleanupDrag() {
    document.querySelectorAll('.dragging,.drop-above,.drop-below').forEach(function (x) { x.classList.remove('dragging', 'drop-above', 'drop-below'); });
    dragKind = null; dragIdx = -1;
  }

  // ---------- export / import / reset ----------
  function exportJSON() {
    var blob = new Blob([JSON.stringify(MODEL, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = 'menu.json'; document.body.appendChild(a); a.click();
    a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('تم تنزيل menu.json');
  }
  function importJSON(file) {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast('الملف كبير جدًا', true); return; }
    var rd = new FileReader();
    rd.onload = function () {
      var raw; try { raw = JSON.parse(rd.result); } catch (e) { toast('ملف JSON غير صالح', true); return; }
      var n = normalizeMenu(raw);
      if (!n.ok) { toast(n.error, true); return; }
      MODEL = n.menu; selCat = 0; persist(); render(); toast('تم استيراد المنيو');
    };
    rd.onerror = function () { toast('تعذّر قراءة الملف', true); };
    rd.readAsText(file);
  }
  function resetAll() {
    if (!confirm('استرجاع البيانات الأصلية وإلغاء كل تعديلاتك المحفوظة؟')) return;
    try { localStorage.removeItem(KEY); } catch (e) {}
    MODEL = clone(ORIGINAL); selCat = 0; persist(); render(); toast('تمت الاستعادة');
  }

  // ---------- preview ----------
  function refreshPreview() {
    var f = $('#preview'); if (f && f.contentWindow) { try { f.contentWindow.location.reload(); } catch (e) { f.src = f.src; } }
  }
  function togglePreview() { $('#previewPane').classList.toggle('show'); }

  // ---------- toast ----------
  var toastH = null;
  function toast(msg, isErr) {
    var el = $('#toast');
    el.innerHTML = I.get(isErr ? 'close' : 'check') + '<span></span>';
    el.querySelector('span').textContent = msg;
    el.classList.toggle('err', !!isErr); el.classList.add('show');
    clearTimeout(toastH); toastH = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  // ---------- wiring ----------
  function wire() {
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest('#catList .cat-row') && !t.closest('[data-editcat]') && !t.closest('[data-drag]')) {
        selCat = +t.closest('.cat-row').dataset.ci; render(); return;
      }
      var ec = t.closest('[data-editcat]'); if (ec) { openCatDrawer(+ec.dataset.editcat); return; }
      var ei = t.closest('[data-edititem]'); if (ei) { openItemDrawer(selCat, +ei.dataset.edititem); return; }
      var di = t.closest('[data-delitem]'); if (di) { deleteItem(selCat, +di.dataset.delitem); return; }
      var av = t.closest('[data-avail]'); if (av) { toggleAvail(selCat, +av.dataset.avail); return; }
      var al = t.closest('[data-al]'); if (al) { al.classList.toggle('on'); return; }
      if (t.closest('#addItem')) { if (MODEL.categories.length) openItemDrawer(selCat, -1); else toast('أضف قسمًا أولًا', true); return; }
      if (t.closest('#addCat')) { openCatDrawer(-1); return; }
      if (t.closest('#drawerSave')) { ($('#drawerSave').dataset.mode === 'cat') ? saveCat() : saveItem(); return; }
      if (t.closest('#drawerDelete')) { (editingCat != null && editingCat >= -0 && $('#drawerSave').dataset.mode === 'cat') ? deleteCat() : (editingItem && deleteItem(editingItem.catIdx, editingItem.itemIdx)); return; }
      if (t.closest('[data-closedrawer]') || t === $('#drawerBack')) { closeDrawer(); return; }
      if (t.closest('#btnExport')) { exportJSON(); return; }
      if (t.closest('#btnImport')) { $('#fileInput').click(); return; }
      if (t.closest('#btnReset')) { resetAll(); return; }
      if (t.closest('#btnPreview')) { togglePreview(); return; }
    });
    $('#fileInput').addEventListener('change', function (e) { importJSON(e.target.files[0]); e.target.value = ''; });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });
    // drag events (delegated)
    var cl = $('#catList'), il = $('#itemList');
    [cl, il].forEach(function (list) {
      list.addEventListener('dragstart', onDragStart);
      list.addEventListener('dragover', onDragOver);
      list.addEventListener('drop', onDrop);
      list.addEventListener('dragend', cleanupDrag);
    });
  }

  function boot() {
    $('#brandLogo').src = (MODEL.brand && MODEL.brand.logo) || 'assets/logo.jpg';
    render(); setDirty(false); refreshPreview();
  }

  document.addEventListener('DOMContentLoaded', function () { wire(); load(); });
})();
