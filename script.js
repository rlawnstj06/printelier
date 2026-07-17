// ---------- 데이터 로드 (products.json / reviews.json — 관리자에서 관리) ----------
let PRODUCTS = [];
let activeCat = 'all';
const CATS = [
  ['all', 'Everything'],
  ['kids', 'For kids'],
  ['pets', 'For pets'],
  ['home', 'Home & gifts']
];

async function loadData() {
  try {
    const p = await fetch('products.json?v=' + Date.now()).then((r) => r.json());
    PRODUCTS = (p.items || []).filter((x) => x.active !== false);
    renderChips();
    renderProducts();
    syncFormOptions();
    initEstimator();
  } catch (e) {
    console.error('products.json 로드 실패', e);
  }
  try {
    const r = await fetch('reviews.json?v=' + Date.now()).then((r) => r.json());
    renderReviews(r.items || []);
  } catch {}
}

const escHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function renderChips() {
  const el = document.getElementById('catChips');
  el.innerHTML = CATS.map(
    ([id, label]) => `<button class="chip ${id === activeCat ? 'on' : ''}" data-cat="${id}">${label}</button>`
  ).join('');
  el.querySelectorAll('.chip').forEach((b) =>
    b.addEventListener('click', () => {
      activeCat = b.dataset.cat;
      el.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x.dataset.cat === activeCat));
      renderProducts();
    })
  );
}

function renderProducts() {
  const grid = document.getElementById('workGrid');
  const list = activeCat === 'all' ? PRODUCTS : PRODUCTS.filter((p) => p.category === activeCat);
  grid.innerHTML =
    list.map((p) =>
      p.editor
        ? `
    <a class="card card-live reveal" href="editor.html?item=${escHtml(p.id)}">
      <img src="${escHtml(p.img)}" alt="${escHtml(p.alt || p.title)}" loading="lazy" decoding="async" />
      <div class="card-body">
        <h3>${escHtml(p.title)}</h3>
        <p>${escHtml(p.desc)}</p>
        <span class="price">from $${p.priceFrom} · <b class="live-tag">🎨 Design it in 3D →</b></span>
      </div>
    </a>`
        : `
    <a class="card reveal" href="#order" data-item="${escHtml(p.title)}">
      <img src="${escHtml(p.img)}" alt="${escHtml(p.alt || p.title)}" loading="lazy" decoding="async" />
      <div class="card-body">
        <h3>${escHtml(p.title)}</h3>
        <p>${escHtml(p.desc)}</p>
        <span class="price">from $${p.priceFrom}</span>
      </div>
    </a>`
    ).join('') +
    `
    <a class="card card-idea reveal" href="#order" data-item="Something else entirely">
      <div class="card-body">
        <h3>Your idea here</h3>
        <p>A replacement part, a cake topper, a cosplay prop, a thing that does not exist yet. If you can describe it, we can probably print it.</p>
        <span class="price">custom quote</span>
      </div>
    </a>`;

  grid.querySelectorAll('.card').forEach((el) => io.observe(el));
  grid.querySelectorAll('.card[data-item]').forEach((card) => {
    card.addEventListener('click', () => {
      const sel = document.getElementById('itemSelect');
      for (const opt of sel.options) {
        if (opt.text === card.dataset.item) { sel.value = opt.value; break; }
      }
    });
  });
}

function syncFormOptions() {
  const sel = document.getElementById('itemSelect');
  sel.innerHTML =
    PRODUCTS.map((p) => `<option>${escHtml(p.title)}</option>`).join('') +
    '<option>Something else entirely</option>';
}

function renderReviews(items) {
  if (!items.length) return; // 실제 후기가 없으면 섹션 자체가 없음 — 가짜 금지
  const sec = document.getElementById('reviews');
  sec.hidden = false;
  document.getElementById('reviewsGrid').innerHTML = items
    .map(
      (r) => `
    <figure class="review reveal">
      <blockquote>&ldquo;${escHtml(r.text)}&rdquo;</blockquote>
      <figcaption>${escHtml(r.name)}${r.item ? ` · ${escHtml(r.item)}` : ''}</figcaption>
    </figure>`
    )
    .join('');
  sec.querySelectorAll('.reveal').forEach((el) => io.observe(el));
}

// ---------- 즉시 견적 ----------
function initEstimator() {
  const itemSel = document.getElementById('estItem');
  const sizeSel = document.getElementById('estSize');
  const out = document.getElementById('estOut');
  itemSel.innerHTML = PRODUCTS.map((p, i) => `<option value="${i}">${escHtml(p.title)}</option>`).join('');
  const update = () => {
    const p = PRODUCTS[Number(itemSel.value)];
    if (!p) return;
    const k = Number(sizeSel.value);
    out.textContent = `$${Math.round(p.priceFrom * k)} – $${Math.round(p.priceTypical * k)} typical`;
  };
  itemSel.addEventListener('change', update);
  sizeSel.addEventListener('change', update);
  update();
}

// ---------- 스크롤 리빌 ----------
const io = new IntersectionObserver(
  (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('in')),
  { threshold: 0.12 }
);
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

// ---------- 내비 그림자 ----------
const nav = document.getElementById('nav');
addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 10), { passive: true });

// ---------- 폼 공용 핸들러 (단품/대량주문/디왈리 웨이트리스트) ----------
// Formspree 미설정 시 이메일 초안 폴백 → 설정 전에도 문의를 놓치지 않음
document.querySelectorAll('form.ajax-form').forEach((form) => {
  const note = form.querySelector('.form-note');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const btn = form.querySelector('button[type="submit"]');
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Sending…';

    const configured = !form.action.includes('YOUR_FORM_ID');
    if (configured) {
      try {
        const res = await fetch(form.action, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error();
        form.reset();
        note.textContent = '✓ Sent! We reply within 24 hours.';
        note.classList.add('ok');
      } catch {
        note.textContent = 'Something went wrong. Email us directly: vestpaul@gmail.com';
      }
    } else {
      const subject = form.dataset.subject || 'Printelier request';
      const body = [...data.entries()].map(([k, v]) => `${k}: ${v}`).join('\n');
      location.href = `mailto:vestpaul@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      note.textContent = '✓ Your email app opened with the request, just press send.';
      note.classList.add('ok');
    }
    btn.disabled = false;
    btn.textContent = orig;
  });
});

// ---------- 디왈리 카운트다운 (2026-11-08) ----------
(function diwaliCountdown() {
  const el = document.getElementById('diwaliCountdown');
  if (!el) return;
  const target = new Date('2026-11-08T00:00:00-08:00');
  const tick = () => {
    const ms = target - Date.now();
    if (ms <= 0) { el.textContent = '✨ Happy Diwali!'; return; }
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    el.textContent = `✨ ${d} days ${h} hrs until Diwali`;
  };
  tick();
  setInterval(tick, 60000);
})();

// ---------- 3D 에디터에서 만든 디자인 자동 입력 ----------
(function applyEditorConfig() {
  try {
    const raw = localStorage.getItem('plt_config');
    if (!raw) return;
    const c = JSON.parse(raw);
    if (Date.now() - c.at > 3600000) return localStorage.removeItem('plt_config'); // 1시간 지난 건 무시
    localStorage.removeItem('plt_config');
    // 폼에 디자인 내용 채우기
    const sel = document.getElementById('itemSelect');
    const fill = () => {
      for (const opt of sel.options) if (opt.text === c.item) { sel.value = opt.value; break; }
    };
    fill();
    setTimeout(fill, 800); // products.json 로드 후 한 번 더
    document.querySelector('input[name="personalization"]').value =
      `"${c.text}" · ${c.font} · base ${c.baseColor} · lettering ${c.textColor}`;
    const noteEl = document.getElementById('formNote');
    noteEl.textContent = '✓ Your 3D design details are filled in — just add your name and email.';
    noteEl.classList.add('ok');
    location.hash = '#order';
  } catch {}
})();

loadData();
