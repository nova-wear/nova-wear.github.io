/* Nova — каталог, картка товару, кошик, оформлення. Без залежностей.
   Вироби й кольори — у garments.js (збирається tools/build-garments.py). */
(function () {
  'use strict';

  /* ---------- Налаштування магазину ---------- */
  var CONFIG = {
    orderEndpoint: '', // https://nova-orders.<субдомен>.workers.dev/order — див. worker/README.md
    shipDays: '1–3',
    currency: '₴'
  };

  var G = window.GARMENTS || {};

  /* ---------- Товари ---------- */
  var SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  var CATS = { all: 'Усі', tee: 'Футболки', hoodie: 'Худі', sweat: 'Світшоти', acc: 'Аксесуари' };
  var PRODUCTS = {
    teeover: { price: 990, cat: 'tee', color: 'black', sizes: SIZES,
      desc: 'Вільна футболка зі спущеним плечем: її можна носити окремо або як шар під сорочку чи худі.',
      feats: ['Вільна посадка', 'Спущене плече', 'Подовжений силует'] },
    tee: { price: 790, cat: 'tee', color: 'white', sizes: SIZES,
      desc: 'Класична футболка прямого крою на кожен день, яка поєднується з будь-чим у гардеробі.',
      feats: ['Прямий крій', 'Класична посадка', 'Круглий виріз'] },
    hoodieover: { price: 1890, cat: 'hoodie', color: 'brown', sizes: SIZES,
      desc: 'Обʼємне худі з капюшоном і вільним силуетом, щоб у ньому було зручно щодня.',
      feats: ['Вільна посадка', 'Капюшон', 'Спущене плече'] },
    hoodieoverfleece: { price: 2190, cat: 'hoodie', color: 'pink', sizes: SIZES,
      desc: 'Обʼємне худі з флісом усередині на прохолодну погоду й холодні вечори.',
      feats: ['Фліс усередині', 'Вільна посадка', 'Для холодного сезону'] },
    hoodie: { price: 1690, cat: 'hoodie', color: 'bordo', sizes: SIZES,
      desc: 'Худі класичної посадки з капюшоном: акуратний силует, який підходить і в місто, і додому.',
      feats: ['Класична посадка', 'Капюшон', 'Акуратний силует'] },
    hoodiezip: { price: 1990, cat: 'hoodie', color: 'navy', sizes: SIZES,
      desc: 'Худі із застібкою на всю довжину, яке легко надіти поверх футболки чи зняти в приміщенні.',
      feats: ['Застібка на всю довжину', 'Капюшон', 'Зручно для шарів'] },
    sweat: { price: 1490, cat: 'sweat', color: 'graphite', sizes: SIZES,
      desc: 'Світшот без капюшона з круглим вирізом, який доречний і з джинсами, і під піджак.',
      feats: ['Без капюшона', 'Круглий виріз', 'Класична посадка'] },
    cap: { price: 690, cat: 'acc', color: 'black', sizes: null,
      desc: 'Однотонна кепка без логотипів, що доповнює базовий образ.',
      feats: ['Регулюється за розміром', 'Без логотипів', 'Один розмір'] },
    tote: { price: 490, cat: 'acc', color: 'beige', sizes: null,
      desc: 'Місткий шопер для щоденних справ, покупок і ноутбука.',
      feats: ['Без розміру', 'Місткий', 'На щодень'] }
  };
  var ORDER = ['hoodieover', 'teeover', 'sweat', 'hoodieoverfleece', 'hoodie', 'tee', 'hoodiezip', 'cap', 'tote'];
  var VIEWS = { front: 'Спереду', back: 'Ззаду', left: 'Збоку' };

  /* ---------- Утиліти ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return n.toLocaleString('uk-UA') + ' ' + CONFIG.currency; }
  function reduceMotion() { return matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function plural(n, one, few, many) { return n % 10 === 1 && n % 100 !== 11 ? one : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? few : many; }

  function store(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem(key) || 'null');
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { return null; }
  }

  function colorOf(product, id) {
    var cs = (G[product] || {}).colors || [];
    for (var i = 0; i < cs.length; i++) if (cs[i].id === id) return cs[i];
    return cs[0];
  }
  function productName(p) { return (G[p] || {}).name || p; }
  function viewsOf(p, color) { var c = colorOf(p, color); return c ? Object.keys(c.shots) : ['front']; }

  /* Вставляє фото виробу в квадратний кадр .garment: виріб займає однакову частку кадру,
     тож різні кольори й моделі не «стрибають» за розміром. */
  function renderGarment(el, product, color, opts) {
    opts = opts || {};
    var col = colorOf(product, color);
    if (!col || !el) return;
    var view = col.shots[opts.view] ? opts.view : 'front';
    var shot = col.shots[view];
    var alt = productName(product) + ', ' + col.name.toLowerCase() + (view === 'back' ? ', вигляд ззаду' : view === 'left' ? ', вигляд збоку' : '');
    var ratio = shot[0] / shot[1], fill = opts.fill || 0.84;
    var H = fill / Math.max(shot[4] / 100 * ratio, shot[5] / 100), W = H * ratio;
    var left = 0.5 - (shot[2] + shot[4] / 2) / 100 * W, top = 0.5 - (shot[3] + shot[5] / 2) / 100 * H;
    el.innerHTML = '<div class="garment__frame" style="left:' + (left * 100).toFixed(2) + '%;top:' + (top * 100).toFixed(2) + '%;width:' + (W * 100).toFixed(2) + '%;height:' + (H * 100).toFixed(2) + '%">' +
      '<img src="images/g/' + product + '-' + col.id + '-' + view + '.webp" alt="' + (opts.decorative ? '' : esc(alt)) + '" width="' + shot[0] + '" height="' + shot[1] + '"' + (opts.lazy ? ' loading="lazy"' : '') + ' decoding="async"></div>';
  }

  /* ---------- Перший екран ---------- */
  var HERO = [['hoodieover', 'coyote'], ['teeover', 'black'], ['sweat', 'beige'], ['cap', 'navy']];
  function renderHero() {
    var box = $('#hero-tiles');
    if (!box) return;
    box.innerHTML = HERO.map(function (h) {
      return '<button type="button" class="htile" data-open="' + h[0] + '" data-color="' + h[1] + '">' +
        '<span class="garment" data-htile="' + h[0] + '"></span>' +
        '<span class="htile__cap"><span>' + esc(productName(h[0])) + '</span><b>' + money(PRODUCTS[h[0]].price) + '</b></span></button>';
    }).join('');
    HERO.forEach(function (h) { renderGarment(box.querySelector('[data-htile="' + h[0] + '"]'), h[0], h[1], { fill: 0.8 }); });
  }

  /* ---------- Каталог ---------- */
  var filter = 'all';
  function renderCatalog() {
    var grid = $('#catalog-grid');
    if (!grid) return;
    var list = ORDER.filter(function (p) { return filter === 'all' || PRODUCTS[p].cat === filter; });
    grid.innerHTML = list.map(function (p) {
      var cs = G[p].colors, n = cs.length, P = PRODUCTS[p];
      var dots = cs.slice(0, 6).map(function (c) { return '<i style="--c:' + c.hex + '"></i>'; }).join('') + (n > 6 ? '<em>+' + (n - 6) + '</em>' : '');
      return '<li><button type="button" class="pcard" data-open="' + p + '" aria-label="' + esc(productName(p) + ', ' + money(P.price) + ', ' + n + ' ' + plural(n, 'колір', 'кольори', 'кольорів')) + '">' +
        '<span class="pcard__media"><span class="garment" data-pcard="' + p + '"></span>' + (viewsOf(p, P.color).indexOf('back') >= 0 ? '<span class="garment pcard__alt" data-pcard-alt="' + p + '"></span>' : '') + '</span>' +
        '<span class="pcard__body"><span class="pcard__name">' + esc(productName(p)) + '</span>' +
        '<span class="pcard__price">' + money(P.price) + '</span>' +
        '<span class="pcard__dots" aria-hidden="true">' + dots + '</span>' +
        '<span class="pcard__cta" aria-hidden="true">' + (P.sizes ? 'Обрати розмір' : 'Купити') + '</span></span></button></li>';
    }).join('');
    list.forEach(function (p) {
      renderGarment(grid.querySelector('[data-pcard="' + p + '"]'), p, PRODUCTS[p].color, { lazy: true });
      var alt = grid.querySelector('[data-pcard-alt="' + p + '"]');
      if (alt) renderGarment(alt, p, PRODUCTS[p].color, { lazy: true, view: 'back', decorative: true });
    });
    $$('#cat-filter [data-cat]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-cat') === filter)); });
  }
  function bindCatalog() {
    var f = $('#cat-filter');
    f.innerHTML = Object.keys(CATS).map(function (k) { return '<button type="button" class="filter" data-cat="' + k + '">' + esc(CATS[k]) + '</button>'; }).join('');
    f.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cat]');
      if (!b) return;
      filter = b.getAttribute('data-cat');
      renderCatalog();
      setParam('cat', filter === 'all' ? null : filter);
    });
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-open]');
      if (b) openProduct(b.getAttribute('data-open'), b.getAttribute('data-color'));
    });
  }

  // Стан фільтра й відкритого товару — у адресі, щоб посиланням можна було поділитися.
  function setParam(k, v) {
    try {
      var u = new URL(location.href);
      if (v) u.searchParams.set(k, v); else u.searchParams.delete(k);
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch (e) { /* старі браузери */ }
  }
  function getParam(k) { try { return new URL(location.href).searchParams.get(k); } catch (e) { return null; } }

  /* ---------- Картка товару ---------- */
  var cur = null; // { product, color, size, qty, view }
  var lastFocus = null;

  function openProduct(p, color) {
    if (!PRODUCTS[p]) return;
    cur = { product: p, color: colorOf(p, color || PRODUCTS[p].color).id, size: null, qty: 1, view: 'front' };
    var P = PRODUCTS[p];
    $('#pd-name').textContent = productName(p);
    $('#pd-price').textContent = money(P.price);
    $('#pd-desc').textContent = P.desc;
    $('#pd-feats').innerHTML = P.feats.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('');
    $('#pd-colors').innerHTML = G[p].colors.map(function (c) {
      return '<label class="swatch" title="' + esc(c.name) + '"><input type="radio" name="pd-color" value="' + c.id + '"><span style="--c:' + c.hex + '" aria-hidden="true"></span><span class="sr-only">' + esc(c.name) + '</span></label>';
    }).join('');
    $('#pd-size-field').hidden = !P.sizes;
    $('#pd-sizes').innerHTML = (P.sizes || []).map(function (s) {
      return '<label class="chip"><input type="radio" name="pd-size" value="' + s + '"><span>' + s + '</span></label>';
    }).join('');
    $('#pd-size-err').hidden = true;
    $('#pd-size-field').classList.remove('field--bad');
    syncProduct();
    setParam('p', p);
    openLayer($('#product'), $('#pd-close'));
  }

  function syncProduct() {
    var col = colorOf(cur.product, cur.color);
    var views = viewsOf(cur.product, cur.color);
    if (views.indexOf(cur.view) < 0) cur.view = 'front';
    renderGarment($('#pd-media'), cur.product, cur.color, { view: cur.view, fill: 0.82 });
    var vb = $('#pd-views');
    vb.hidden = views.length < 2;
    vb.innerHTML = views.map(function (v) { return '<button type="button" class="seg" data-view="' + v + '" aria-pressed="' + (v === cur.view) + '">' + VIEWS[v] + '</button>'; }).join('');
    $('#pd-color-name').textContent = col.name;
    $$('#pd-colors input').forEach(function (i) { i.checked = i.value === cur.color; });
    $$('#pd-sizes input').forEach(function (i) { i.checked = i.value === cur.size; });
    $('#pd-qty-n').textContent = cur.qty;
    $('#pd-total').textContent = money(PRODUCTS[cur.product].price * cur.qty);
  }

  function bindProduct() {
    var d = $('#product');
    new MutationObserver(function () { if (d.hidden) setParam('p', null); }).observe(d, { attributes: true, attributeFilter: ['hidden'] });
    $('#pd-close').addEventListener('click', function () { closeLayer(d); });
    d.addEventListener('click', function (e) { if (e.target === d) closeLayer(d); });
    d.addEventListener('change', function (e) {
      if (e.target.name === 'pd-color') { cur.color = e.target.value; syncProduct(); }
      if (e.target.name === 'pd-size') { cur.size = e.target.value; $('#pd-size-err').hidden = true; $('#pd-size-field').classList.remove('field--bad'); }
    });
    $('#pd-views').addEventListener('click', function (e) {
      var b = e.target.closest('[data-view]');
      if (!b) return;
      cur.view = b.getAttribute('data-view');
      syncProduct();
      $('#pd-views [data-view="' + cur.view + '"]').focus();
    });
    $$('#product [data-pqty]').forEach(function (b) {
      b.addEventListener('click', function () {
        cur.qty = Math.max(1, Math.min(20, cur.qty + Number(b.getAttribute('data-pqty'))));
        syncProduct();
      });
    });
    $('#pd-add').addEventListener('click', function () {
      if (PRODUCTS[cur.product].sizes && !cur.size) {
        var err = $('#pd-size-err');
        err.hidden = false;
        $('#pd-size-field').classList.add('field--bad');
        $('#pd-size-field').scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' });
        var first = $('#pd-sizes input');
        if (first) first.focus({ preventScroll: true });
        return;
      }
      addToCart(cur.product, cur.color, PRODUCTS[cur.product].sizes ? cur.size : null, cur.qty);
      closeLayer(d, true);
      openCart();
    });
    $('#pd-sizes-link').addEventListener('click', function (e) {
      e.preventDefault();
      closeLayer(d);
      var faq = $('#faq-size');
      faq.open = true;
      faq.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
      faq.querySelector('summary').focus({ preventScroll: true });
    });
  }

  /* ---------- Шари (картка товару, кошик): фокус, Escape, блок прокрутки ---------- */
  var openLayers = [];
  function openLayer(d, focusEl) {
    if (!openLayers.length) lastFocus = document.activeElement;
    openLayers.push(d);
    d.hidden = false;
    document.body.classList.add('no-scroll');
    requestAnimationFrame(function () { d.classList.add('is-open'); (focusEl || d).focus(); });
  }
  function closeLayer(d, keepFocus) {
    var i = openLayers.indexOf(d);
    if (i < 0) return;
    openLayers.splice(i, 1);
    if (d.id === 'cart') hideToast();
    d.classList.remove('is-open');
    setTimeout(function () { if (openLayers.indexOf(d) < 0) d.hidden = true; }, 250);
    if (!openLayers.length) {
      document.body.classList.remove('no-scroll');
      if (!keepFocus && lastFocus && lastFocus.focus) lastFocus.focus();
    }
  }
  document.addEventListener('keydown', function (e) {
    var d = openLayers[openLayers.length - 1];
    if (!d) return;
    if (e.key === 'Escape') { closeLayer(d); return; }
    if (e.key === 'Tab') {
      var f = $$('button, [href], input, select, textarea', d).concat($('#toast').classList.contains('is-on') ? $$('#toast-undo:not([hidden])') : [])
        .filter(function (x) { return !x.disabled && x.offsetParent !== null && x.tabIndex >= 0; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  /* ---------- Кошик ---------- */
  var cart = store('nova-cart') || [];
  if (!Array.isArray(cart)) cart = [];
  cart = cart.filter(function (i) { return i && PRODUCTS[i.product] && colorOf(i.product, i.color) && i.qty > 0; });
  cart.forEach(function (i) { i.price = PRODUCTS[i.product].price; });

  function sizeLabel(i) { return i.size || 'без розміру'; }
  function total() { return cart.reduce(function (s, i) { return s + i.price * i.qty; }, 0); }

  function saveCart(focus) {
    store('nova-cart', cart);
    renderCart();
    if (focus) {
      var el = focus.key && $('#cart-list [data-key="' + focus.key + '"] ' + focus.sel);
      (el || $(focus.fallback || '#cart-close')).focus();
    }
  }

  function addToCart(product, color, size, qty) {
    var same = cart.filter(function (i) { return i.product === product && i.color === color && i.size === size; })[0];
    if (same) same.qty = Math.min(20, same.qty + qty);
    else cart.push({ product: product, color: color, size: size, qty: qty, price: PRODUCTS[product].price, key: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) });
    saveCart();
    toast('Додано в кошик: ' + productName(product).toLowerCase());
  }

  function renderCart() {
    var count = cart.reduce(function (s, i) { return s + i.qty; }, 0);
    $$('.cart-count').forEach(function (el) { el.textContent = count; el.hidden = !count; });
    $$('[data-open-cart]').forEach(function (b) { b.setAttribute('aria-label', count ? 'Кошик, ' + count + ' ' + plural(count, 'товар', 'товари', 'товарів') : 'Кошик'); });
    var list = $('#cart-list');
    if (!list) return;
    $('#cart-empty').hidden = !!cart.length;
    $('#cart-foot').hidden = !cart.length;
    list.innerHTML = cart.map(function (i) {
      return '<li class="cart-item" data-key="' + i.key + '">' +
        '<div class="garment garment--thumb" data-thumb="' + i.key + '"></div>' +
        '<div class="cart-item__info"><strong>' + esc(productName(i.product)) + '</strong>' +
        '<span>' + esc(colorOf(i.product, i.color).name) + ' · ' + (i.size ? 'розмір ' + esc(i.size) : 'без розміру') + '</span>' +
        '<div class="cart-item__row"><div class="qty" role="group" aria-label="Кількість">' +
        '<button type="button" data-qty="-1" aria-label="Менше"' + (i.qty <= 1 ? ' disabled' : '') + '>−</button><span aria-live="polite">' + i.qty + '</span><button type="button" data-qty="1" aria-label="Більше"' + (i.qty >= 20 ? ' disabled' : '') + '>+</button></div>' +
        '<span class="cart-item__price">' + money(i.price * i.qty) + '</span></div>' +
        '<button type="button" class="link-btn" data-remove>Видалити</button></div></li>';
    }).join('');
    cart.forEach(function (i) { renderGarment(list.querySelector('[data-thumb="' + i.key + '"]'), i.product, i.color, { fill: 0.86 }); });
    $('#cart-total').textContent = money(total());
    $('#checkout-total').textContent = money(total());
  }

  function openCart() { showStep('cart'); openLayer($('#cart'), $('#cart-close')); }
  function hideToast() { $('#toast').classList.remove('is-on'); }
  function showStep(name) {
    if (name !== 'cart') hideToast();
    $$('#cart [data-step]').forEach(function (el) { el.hidden = el.getAttribute('data-step') !== name; });
    var titles = { cart: 'Кошик', checkout: 'Оформлення', sent: 'Замовлення прийнято' };
    $('#cart-title').textContent = titles[name];
  }

  function bindCart() {
    $$('[data-open-cart]').forEach(function (b) { b.addEventListener('click', openCart); });
    $('#cart-close').addEventListener('click', function () { closeLayer($('#cart')); });
    $$('[data-close-cart]').forEach(function (a) { a.addEventListener('click', function () { closeLayer($('#cart'), a.tagName === 'A'); }); });
    $('#cart').addEventListener('click', function (e) {
      if (e.target.id === 'cart') return closeLayer($('#cart'));
      var row = e.target.closest('.cart-item');
      if (!row) return;
      var it = cart.filter(function (x) { return x.key === row.getAttribute('data-key'); })[0];
      if (e.target.closest('[data-qty]')) {
        var dq = e.target.closest('[data-qty]').getAttribute('data-qty');
        it.qty = Math.max(1, Math.min(20, it.qty + Number(dq)));
        saveCart({ key: it.key, sel: '[data-qty="' + dq + '"]:not(:disabled)' });
        if (document.activeElement === document.body || document.activeElement.disabled) $('#cart-list [data-key="' + it.key + '"] [data-qty]:not(:disabled)').focus();
      } else if (e.target.closest('[data-remove]')) {
        var idx = cart.indexOf(it);
        cart.splice(idx, 1);
        var next = cart[idx] || cart[idx - 1];
        saveCart(next ? { key: next.key, sel: '[data-remove]' } : { fallback: '#cart-empty .btn' });
        toast('Товар видалено з кошика', function () { cart.splice(idx, 0, it); saveCart({ key: it.key, sel: '[data-remove]' }); });
      }
    });
    $('#to-checkout').addEventListener('click', function () { showStep('checkout'); $('#c-name').focus(); });
    $('#back-to-cart').addEventListener('click', function () { showStep('cart'); $('#to-checkout').focus(); });
    $('#checkout').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, bad = [];
      $('#send-err').hidden = true;
      $$('input[required]', f).forEach(function (x) {
        var fld = x.closest('.field'), err = fld.querySelector('.field__err');
        var v = x.value.trim(), msg = '';
        if (!v) msg = err.getAttribute('data-empty');
        else if (x.name === 'phone' && /[^\d\s()+\-]/.test(v)) msg = 'У номері можуть бути лише цифри, пробіли, «+», дужки й дефіс.';
        else if (x.name === 'phone' && v.replace(/\D/g, '').length < 10) msg = 'Номер закороткий — вкажіть 10 цифр, напр. 050 123 45 67.';
        fld.classList.toggle('field--error', !!msg);
        err.textContent = msg;
        if (msg) { x.setAttribute('aria-invalid', 'true'); bad.push(x); } else x.removeAttribute('aria-invalid');
      });
      if (bad.length) { bad[0].focus(); return; }
      sendOrder(f, orderText(f));
    });
  }

  // Замовлення йде менеджеру через Worker. Якщо не вдалося — кошик лишається, можна спробувати ще раз.
  function sendOrder(f, msg) {
    var btn = f.querySelector('button[type=submit]');
    if (!CONFIG.orderEndpoint) { $('#send-err').hidden = false; $('#send-err').focus(); return; }
    btn.disabled = true; btn.textContent = 'Надсилаємо…';
    fetch(CONFIG.orderEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: msg, name: f.elements.name.value, phone: f.elements.phone.value, website: f.elements.website ? f.elements.website.value : '' })
    }).then(function (r) { return r.json(); }).then(function (res) {
      if (!res || !res.ok) throw new Error('order');
      cart = []; saveCart();
      f.reset();
      showStep('sent');
      $('#cart-title').focus();
    }).catch(function () {
      var err = $('#send-err');
      err.hidden = false;
      err.focus();
    }).then(function () { btn.disabled = false; btn.textContent = 'Підтвердити замовлення'; });
  }

  function orderText(f) {
    var v = function (n) { return (f.elements[n].value || '').trim(); };
    var lines = ['Нове замовлення — Nova', ''];
    cart.forEach(function (i, n) {
      lines.push((n + 1) + '. ' + productName(i.product) + ', ' + colorOf(i.product, i.color).name.toLowerCase() + ', ' + (i.size ? 'розмір ' + i.size : 'без розміру') + ' × ' + i.qty + ' — ' + money(i.price * i.qty));
    });
    lines.push('', 'Разом: ' + money(total()), '');
    lines.push('Імʼя: ' + v('name'), 'Телефон: ' + v('phone'), 'Нова Пошта: ' + v('city') + ', ' + v('branch'));
    lines.push('Оплата: ' + (f.elements.pay.value === 'card' ? 'передоплата на карту' : 'накладений платіж'));
    if (v('comment')) lines.push('Коментар: ' + v('comment'));
    return lines.join('\n');
  }

  var toastTimer;
  function toast(text, undo) {
    var t = $('#toast'), u = $('#toast-undo');
    $('#toast-text').textContent = text;
    u.hidden = !undo;
    u.onclick = undo ? function () { undo(); t.classList.remove('is-on'); } : null;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, undo ? 5000 : 2600);
  }

  /* ---------- Меню ---------- */
  function bindNav() {
    var btn = $('#menu-btn'), nav = $('#nav');
    function setMenu(open) {
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Закрити меню' : 'Меню');
      nav.classList.toggle('is-open', open);
    }
    btn.addEventListener('click', function () { setMenu(btn.getAttribute('aria-expanded') !== 'true'); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); btn.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (nav.classList.contains('is-open') && !e.target.closest('#nav, #menu-btn')) setMenu(false);
    });
    $$('a[href="#faq-size"]').forEach(function (a) {
      a.addEventListener('click', function () { $('#faq-size').open = true; });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    $$('[data-ship]').forEach(function (el) { el.textContent = CONFIG.shipDays; });
    var min = Math.min.apply(null, ORDER.map(function (p) { return PRODUCTS[p].price; }));
    $$('[data-min-price]').forEach(function (el) { el.textContent = money(min); });
    renderHero();
    if (CATS[getParam('cat')]) filter = getParam('cat');
    bindCatalog();
    renderCatalog();
    bindProduct();
    bindCart();
    renderCart();
    bindNav();
    if (PRODUCTS[getParam('p')]) openProduct(getParam('p'));
    var y = $('#year'); if (y) y.textContent = new Date().getFullYear();
  });
})();
