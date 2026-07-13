// ---------- 데이터 로드 (products.json / reviews.json — 커맨드 센터에서 관리) ----------
let PRODUCTS = [];

async function loadData() {
  try {
    const p = await fetch('products.json?v=' + Date.now()).then((r) => r.json());
    PRODUCTS = (p.items || []).filter((x) => x.active !== false);
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

function renderProducts() {
  const grid = document.getElementById('workGrid');
  grid.innerHTML =
    PRODUCTS.map(
      (p) => `
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

// ---------- 주문 폼: Formspree 미설정 시 이메일 초안 폴백 ----------
const form = document.getElementById('orderForm');
const note = document.getElementById('formNote');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const btn = form.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Sending…';

  const configured = !form.action.includes('YOUR_FORM_ID');
  if (configured) {
    try {
      const res = await fetch(form.action, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error();
      form.reset();
      note.textContent = '✓ Sent! Check your inbox, we reply within 24 hours.';
      note.classList.add('ok');
    } catch {
      note.textContent = 'Something went wrong. Email us directly: vestpaul@gmail.com';
    }
  } else {
    const body = [...data.entries()].map(([k, v]) => `${k}: ${v}`).join('\n');
    location.href = `mailto:vestpaul@gmail.com?subject=${encodeURIComponent('Custom order request - Printelier')}&body=${encodeURIComponent(body)}`;
    note.textContent = '✓ Your email app opened with the request, just press send.';
    note.classList.add('ok');
  }
  btn.disabled = false;
  btn.textContent = 'Request my free preview';
});

loadData();
