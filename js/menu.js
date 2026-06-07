/* ============================================================
   menu.js — Luxury Crop customer menu
   - Reads data/menu.json (or a localStorage override saved by admin)
   - Data-driven rendering, AR/EN (RTL/LTR), search + filters,
     scroll-synced category nav, scroll reveals, allergen/info/
     location/contact modals.
   - SECURITY: every piece of café-supplied data is escaped before it
     touches the DOM (esc / escAttr). No inline event handlers, no eval.
   ============================================================ */
(function () {
  'use strict';

  // ---------- security helpers ----------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escAttr(s) { return esc(s); }
  // allow only http(s) / mailto / tel / instagram-style links; else '#'
  function safeUrl(u) {
    if (!u) return '';
    var s = String(u).trim();
    if (/^(https?:|mailto:|tel:)/i.test(s)) return s;
    return '';
  }

  var $ = function (id) { return document.getElementById(id); };
  var I = window.ICONS;

  // ---------- UI string dictionary ----------
  var T = {
    ar: {
      dir: 'rtl', langBtn: 'English',
      search: 'ابحث في المنيو…',
      all: 'الكل', lowcal: 'أقل من ١٥٠ سعرة', nocaf: 'بدون كافيين',
      sar: 'ر.س', kcal: 'سعرة', caf: 'كافيين', mg: 'مجم', salt: 'صوديوم عالٍ',
      empty: 'لا توجد أصناف مطابقة',
      sfdaHead: 'متوافق مع اشتراطات الهيئة العامة للغذاء والدواء',
      sfdaCal: 'السعرات', sfdaAl: 'مسببات الحساسية', sfdaCaf: 'الكافيين', sfdaNa: 'الصوديوم',
      sfdaNote: 'القيم الغذائية تقديرية لأغراض العرض، وتُعتمد نهائيًا من المنشأة.',
      e_rating: 'التقييم', e_contact: 'تواصل', e_allergens: 'الحساسية', e_info: 'معلومات', e_location: 'الموقع',
      m_allergens: 'مسببات الحساسية', m_allergens_sub: 'المرجع القياسي لمسببات الحساسية الأربعة عشر. الرموز على كل صنف استرشادية وتُعتمد من المقهى.',
      m_info: 'معلومات المنيو', m_location: 'الموقع', m_contact: 'تواصل معنا', m_rating: 'التقييم',
      info_body:
        '<p><span class="pill">{seal} متوافق مع اشتراطات هيئة الغذاء والدواء</span></p>' +
        '<p>يعرض هذا المنيو على كل صنف <strong>السعرات الحرارية</strong> و<strong>مسببات الحساسية</strong> و<strong>محتوى الكافيين</strong>، وفق اشتراطات الهيئة العامة للغذاء والدواء.</p>' +
        '<p class="note">القيم الغذائية المعروضة تقديرية لأغراض العرض وتُعتمد نهائيًا من المنشأة. رموز مسببات الحساسية استرشادية وتُراجع من قبل المقهى.</p>',
      rating_body: 'تقييم العملاء على خرائط قوقل',
      rating_reviews: 'بناءً على تقييمات الزوّار',
      maps_label: 'الموقع على خرائط قوقل', maps_sub: 'اضغط للوصول إلينا',
      ig_label: 'إنستقرام', tiktok_label: 'تيك توك', notset: 'لم يُضف بعد',
      powered_t: 'هذا المنيو الرقمي من إعداد «متوافق»',
      powered_s: 'منيو QR متوافق مع اشتراطات هيئة الغذاء والدواء.',
      wa: 'واتساب',
      disc: 'القيم الغذائية تقديرية وتُعتمد من المنشأة. الرموز التحذيرية لمسببات الحساسية استرشادية.'
    },
    en: {
      dir: 'ltr', langBtn: 'عربي',
      search: 'Search the menu…',
      all: 'All', lowcal: 'Under 150 kcal', nocaf: 'Caffeine-free',
      sar: 'SAR', kcal: 'kcal', caf: 'caffeine', mg: 'mg', salt: 'High sodium',
      empty: 'No matching items',
      sfdaHead: 'Compliant with SFDA menu-labeling requirements',
      sfdaCal: 'Calories', sfdaAl: 'Allergens', sfdaCaf: 'Caffeine', sfdaNa: 'Sodium',
      sfdaNote: 'Nutrition values are estimates for display and are confirmed by the venue.',
      e_rating: 'Rating', e_contact: 'Contact', e_allergens: 'Allergens', e_info: 'Info', e_location: 'Location',
      m_allergens: 'Allergens', m_allergens_sub: 'The standard 14-allergen reference. Icons on each item are indicative and confirmed by the café.',
      m_info: 'Menu info', m_location: 'Location', m_contact: 'Contact us', m_rating: 'Rating',
      info_body:
        '<p><span class="pill">{seal} SFDA-compliant labeling</span></p>' +
        '<p>Every item shows <strong>calories</strong>, <strong>allergens</strong> and <strong>caffeine</strong>, per the Saudi Food &amp; Drug Authority requirements.</p>' +
        '<p class="note">Displayed nutrition values are estimates for display and are confirmed by the venue. Allergen icons are indicative and reviewed by the café.</p>',
      rating_body: 'Customer rating on Google Maps',
      rating_reviews: 'Based on visitor reviews',
      maps_label: 'Find us on Google Maps', maps_sub: 'Tap to get directions',
      ig_label: 'Instagram', tiktok_label: 'TikTok', notset: 'Not added yet',
      powered_t: 'This digital menu is built by Mutawafiq',
      powered_s: 'An SFDA-compliant QR menu.',
      wa: 'WhatsApp',
      disc: 'Nutrition values are estimates, confirmed by the venue. Allergen warning icons are indicative.'
    }
  };

  // ---------- state ----------
  var DATA = null, lang = 'ar', filter = 'all', term = '';
  var revObs = null, navObs = null;

  function t() { return T[lang]; }
  function nm(o, base) { return lang === 'ar' ? o[base + '_ar'] : o[base + '_en']; }

  // ---------- data load ----------
  function load() {
    var override = null;
    try { override = localStorage.getItem('luxurycrop.menu'); } catch (e) {}
    if (override) {
      try { DATA = JSON.parse(override); boot(); return; } catch (e) { /* fall through */ }
    }
    fetch('data/menu.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (j) { DATA = j; boot(); })
      .catch(function (err) {
        document.body.innerHTML =
          '<div style="max-width:520px;margin:60px auto;padding:24px;font-family:Tahoma;text-align:center;color:#6f6f6f">' +
          'تعذّر تحميل بيانات المنيو. افتح الصفحة عبر خادم محلي (وليس بفتح الملف مباشرة) ليتمكن المتصفح من قراءة data/menu.json.' +
          '<br><br><small>' + esc(String(err.message || err)) + '</small></div>';
      });
  }

  // ---------- formatting ----------
  function priceHTML(item) {
    if (item.price == null) return '<span class="price na-price">TODO</span>';
    var n = esc(item.price);
    var r = I.get('riyal', 'cur-ic');                 // new Saudi Riyal symbol
    return lang === 'ar'
      ? '<span class="price">' + n + ' ' + r + '</span>'
      : '<span class="price">' + r + ' ' + n + '</span>';
  }

  function badgesHTML(item) {
    var ti = t(), b = '';
    if (item.kcal != null) {
      b += '<span class="badge kcal">' + I.get('flame') + ' ' + esc(item.kcal) + ' ' + ti.kcal + '</span>';
    }
    if (item.caffeine_mg) {
      b += '<span class="badge caf">' + I.get('bean') + ' ' + esc(item.caffeine_mg) + ' ' + ti.mg + '</span>';
    }
    (item.allergens || []).forEach(function (key) {
      var ref = (DATA.allergen_ref || []).find(function (a) { return a.key === key; });
      if (!ref) return;
      b += '<span class="badge al">' + I.al(key) + ' ' + esc(lang === 'ar' ? ref.ar : ref.en) + '</span>';
    });
    if (item.high_sodium) {
      b += '<span class="badge salt">' + I.get('salt') + ' ' + ti.salt + '</span>';
    }
    return b;
  }

  function cardHTML(item, idx) {
    var sub = lang === 'ar' ? item.name_en : item.name_ar;
    var desc = nm(item, 'desc');
    var delay = Math.min(idx, 7) * 50;
    return '' +
      '<article class="card reveal' + (item.available === false ? ' na' : '') + '" style="transition-delay:' + delay + 'ms">' +
        '<div class="card-top">' +
          '<h3 class="card-name">' + esc(nm(item, 'name')) +
            (sub ? '<span class="card-en">' + esc(sub) + '</span>' : '') +
          '</h3>' +
          priceHTML(item) +
        '</div>' +
        (desc ? '<p class="desc">' + esc(desc) + '</p>' : '') +
        '<div class="badges">' + badgesHTML(item) + '</div>' +
      '</article>';
  }

  // ---------- filters ----------
  function passes(item) {
    if (item.available === false) return false;           // hidden by café via admin
    if (filter === 'lowcal' && !(item.kcal != null && item.kcal < 150)) return false;
    if (filter === 'nocaf' && item.caffeine_mg) return false;
    if (term) {
      var q = term.trim().toLowerCase();
      var hay = ((item.name_ar || '') + ' ' + (item.name_en || '') + ' ' +
                 (item.desc_ar || '') + ' ' + (item.desc_en || '')).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }

  // ---------- render ----------
  function renderSections() {
    var menu = $('menu'); menu.innerHTML = ''; var total = 0;
    (DATA.categories || []).forEach(function (c) {
      var items = (c.items || []).filter(passes);
      if (!items.length) return;
      total += items.length;
      var sec = document.createElement('section');
      sec.className = 'section'; sec.id = 'sec-' + c.slug;
      sec.innerHTML =
        '<div class="sec-head reveal">' +
          '<div class="sec-title"><span class="bar"></span>' + esc(nm(c, 'name')) + '</div>' +
          (nm(c, 'sub') ? '<div class="sec-sub">' + esc(nm(c, 'sub')) + '</div>' : '') +
        '</div>' +
        '<div class="grid">' + items.map(cardHTML).join('') + '</div>';
      menu.appendChild(sec);
    });
    var empty = $('empty');
    empty.style.display = total ? 'none' : 'block';
    empty.textContent = t().empty;
    buildNav();
    setupReveals();
    observeNav();
  }

  function buildNav() {
    var nav = $('navChips');
    var shown = (DATA.categories || []).filter(function (c) { return (c.items || []).filter(passes).length; });
    nav.innerHTML = shown.map(function (c) {
      return '<button class="chip nav" type="button" data-target="sec-' + escAttr(c.slug) + '">' + esc(nm(c, 'name')) + '</button>';
    }).join('');
  }

  // ---------- static chrome ----------
  function buildStatic() {
    var ti = t(), b = DATA.brand || {};
    document.documentElement.lang = lang;
    document.documentElement.dir = ti.dir;

    $('langBtn').innerHTML = I.get('globe') + '<span>' + esc(ti.langBtn) + '</span>';

    // hero
    $('heroLogo').src = (lang === 'ar') ? 'assets/logo-ar.png' : 'assets/logo.png';  /* Arabized wordmark on AR, Latin wordmark on EN — light hero */
    $('heroLogo').alt = esc(nm(b, 'name') || 'Luxury Crop');
    $('brandAr').textContent = b.name_ar || '';   // logo carries the Latin wordmark; show the Arabic name in both modes
    $('tagline').textContent = nm(b, 'tagline') || '';

    var meta = '';
    if (b.rating) meta += '<span class="star">' + I.get('star') + ' ' + esc(b.rating) + '</span>';
    if (nm(b, 'location')) meta += '<span>' + I.get('pin') + ' ' + esc(nm(b, 'location')) + '</span>';
    if (nm(b, 'hours')) meta += '<span>' + I.get('clock') + ' ' + esc(nm(b, 'hours')) + '</span>';
    $('heroMeta').innerHTML = meta;

    // entry icons
    $('entryIcons').innerHTML =
      entryBtn('rating', 'star', ti.e_rating) +
      entryBtn('allergens', 'info', ti.e_allergens, 'leaf') +
      entryBtn('info', 'info', ti.e_info) +
      entryBtn('location', 'pin', ti.e_location) +
      entryBtn('contact', 'instagram', ti.e_contact);

    // sfda strip
    $('sfdaHead').textContent = ti.sfdaHead;
    $('sfdaBadges').innerHTML =
      sfdaBadge('flame', ti.sfdaCal) + sfdaBadge('leaf', ti.sfdaAl) +
      sfdaBadge('bean', ti.sfdaCaf) + sfdaBadge('salt', ti.sfdaNa);
    $('sfdaNote').textContent = ti.sfdaNote;

    // controls
    $('miniLogo').src = b.logo || 'assets/logo.jpg';
    $('search').placeholder = ti.search;
    $('filterChips').innerHTML =
      filterChip('all', ti.all) + filterChip('lowcal', ti.lowcal) + filterChip('nocaf', ti.nocaf);

    // footer
    $('fLogo').src = 'assets/logo-white.png';   // white-on-transparent variant for the dark footer
    var fInfo = '';
    if (nm(b, 'location')) fInfo += '<span>' + I.get('pin') + ' ' + esc(nm(b, 'location')) + '</span>';
    if (b.rating) fInfo += '<span>' + I.get('star') + ' ' + esc(b.rating) + '</span>';
    $('fInfo').innerHTML = fInfo;
    $('fSocial').innerHTML = socialLinks();
    $('poweredT').textContent = ti.powered_t;
    $('poweredS').textContent = ti.powered_s;
    var wa = $('poweredWa');
    wa.href = 'https://wa.me/' + (b.whatsapp_admin || '');
    wa.innerHTML = I.get('whatsapp') + '<span>' + esc(ti.wa) + '</span>';
    $('fDisc').textContent = ti.disc;
  }

  function entryBtn(kind, icon, label, altIcon) {
    return '<button class="entry-btn" type="button" data-modal="' + kind + '" aria-label="' + escAttr(label) + '" title="' + escAttr(label) + '">' +
      I.get(altIcon || icon) + '</button>';
  }
  function sfdaBadge(icon, label) { return '<span class="sfda-badge">' + I.get(icon) + esc(label) + '</span>'; }
  function filterChip(key, label) {
    return '<button class="chip filter' + (filter === key ? ' on' : '') + '" type="button" data-filter="' + key + '">' +
      (key === 'all' ? I.get('filter') : '') + esc(label) + '</button>';
  }
  function socialLinks() {
    var b = DATA.brand || {}, out = '';
    if (safeUrl(b.instagram)) out += '<a href="' + escAttr(b.instagram) + '" target="_blank" rel="noopener" aria-label="Instagram">' + I.get('instagram') + '</a>';
    if (safeUrl(b.tiktok)) out += '<a href="' + escAttr(b.tiktok) + '" target="_blank" rel="noopener" aria-label="TikTok">' + I.get('tiktok') + '</a>';
    if (safeUrl(b.maps)) out += '<a href="' + escAttr(b.maps) + '" target="_blank" rel="noopener" aria-label="Maps">' + I.get('pin') + '</a>';
    return out;
  }

  // ---------- modals ----------
  function openModal(kind) {
    var ti = t(), b = DATA.brand || {}, title = '', icon = 'info', body = '';
    if (kind === 'allergens') {
      title = ti.m_allergens; icon = 'leaf';
      body = '<p class="sec-sub" style="padding:0;margin-bottom:14px">' + esc(ti.m_allergens_sub) + '</p>' +
        '<div class="allergen-grid">' +
        (DATA.allergen_ref || []).map(function (a) {
          return '<div class="allergen-cell">' + I.al(a.key) + '<span class="lb">' + esc(lang === 'ar' ? a.ar : a.en) + '</span></div>';
        }).join('') + '</div>';
    } else if (kind === 'info') {
      title = ti.m_info; icon = 'info';
      body = '<div class="info-block">' + ti.info_body.replace('{seal}', I.get('check')) + '</div>';
    } else if (kind === 'location') {
      title = ti.m_location; icon = 'pin';
      body = '<div class="link-row">' + linkItem(b.maps, 'pin', ti.maps_label, ti.maps_sub) + '</div>';
    } else if (kind === 'contact') {
      title = ti.m_contact; icon = 'instagram';
      body = '<div class="link-row">' +
        linkItem(b.instagram, 'instagram', ti.ig_label, '@' + (String(b.instagram || '').split('/').pop() || '')) +
        '</div>';
    } else if (kind === 'rating') {
      title = ti.m_rating; icon = 'star';
      body = '<div class="info-block" style="text-align:center">' +
        '<div style="font-size:46px;font-weight:800;font-family:Poppins;color:var(--ink)">' + esc(b.rating || '—') + '</div>' +
        '<div style="color:var(--gold);font-size:22px;letter-spacing:2px">★★★★★</div>' +
        '<p style="margin-top:8px">' + esc(ti.rating_body) + '<br><span class="note">' + esc(ti.rating_reviews) + '</span></p>' +
        (safeUrl(b.maps) ? '<div class="link-row" style="margin-top:12px">' + linkItem(b.maps, 'pin', ti.maps_label, ti.maps_sub) + '</div>' : '') +
        '</div>';
    }
    $('modalTitle').innerHTML = I.get(icon) + esc(title);
    $('modalBody').innerHTML = body;
    var back = $('modalBack');
    back.classList.add('open');
    back.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    var back = $('modalBack');
    back.classList.remove('open');
    back.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  function linkItem(url, icon, label, sub) {
    var ti = t(), ok = safeUrl(url);
    return '<a class="link-item' + (ok ? '' : ' disabled') + '" ' +
      (ok ? 'href="' + escAttr(url) + '" target="_blank" rel="noopener"' : 'href="#" aria-disabled="true"') + '>' +
      I.get(icon) + '<span>' + esc(label) +
      '<span class="sub">' + esc(ok ? (sub || '') : ti.notset) + '</span></span></a>';
  }

  // ---------- observers ----------
  function setupReveals() {
    if (revObs) revObs.disconnect();
    revObs = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); revObs.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.reveal').forEach(function (el) { revObs.observe(el); });
    requestAnimationFrame(function () {
      document.querySelectorAll('.reveal').forEach(function (el) {
        if (el.getBoundingClientRect().top < innerHeight) el.classList.add('in');
      });
    });
  }
  function observeNav() {
    if (navObs) navObs.disconnect();
    navObs = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) {
          document.querySelectorAll('.chip.nav').forEach(function (c) {
            c.classList.toggle('on', c.dataset.target === e.target.id);
          });
        }
      });
    }, { rootMargin: '-120px 0px -65% 0px' });
    document.querySelectorAll('.section').forEach(function (s) { navObs.observe(s); });
  }

  // ---------- actions ----------
  function jump(id) {
    var el = $(id); if (!el) return;
    var y = el.getBoundingClientRect().top + scrollY - 116;
    scrollTo({ top: y, behavior: 'smooth' });
  }
  function setFilter(f) { filter = f; buildStatic(); renderSections(); }
  function toggleLang() { lang = (lang === 'ar' ? 'en' : 'ar'); buildStatic(); renderSections(); }
  function debounce(fn, ms) { var h; return function () { clearTimeout(h); h = setTimeout(fn, ms); }; }

  // ---------- wiring (event delegation → CSP-friendly) ----------
  function wire() {
    $('langBtn').addEventListener('click', toggleLang);

    document.addEventListener('click', function (e) {
      var f = e.target.closest('[data-filter]');
      if (f) { setFilter(f.dataset.filter); return; }
      var n = e.target.closest('.chip.nav');
      if (n) { jump(n.dataset.target); return; }
      var m = e.target.closest('[data-modal]');
      if (m) { openModal(m.dataset.modal); return; }
      if (e.target.closest('[data-close]') || e.target === $('modalBack')) { closeModal(); return; }
      if (e.target.closest('#totop')) { scrollTo({ top: 0, behavior: 'smooth' }); }
    });

    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

    var si = $('search');
    si.addEventListener('input', debounce(function () { term = si.value; renderSections(); }, 140));

    addEventListener('scroll', function () {
      $('totop').classList.toggle('show', scrollY > 480);
      $('controls').classList.toggle('scrolled', scrollY > 220);
    }, { passive: true });
  }

  function boot() { buildStatic(); renderSections(); }

  document.addEventListener('DOMContentLoaded', function () { wire(); load(); });
})();
