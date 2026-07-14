// Printelier 3D 디자인 에디터
// 손님이 텍스트/색을 바꾸면 실시간으로 3D 모델이 다시 만들어지고, 드래그로 돌려볼 수 있다.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

const FONT_URLS = {
  bold: 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/fonts/helvetiker_bold.typeface.json',
  serif: 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/fonts/gentilis_bold.typeface.json'
};

// 필라멘트 색상 (실제 PLA 판매 색 기준)
const COLORS = ['#efe9df', '#2e2b2d', '#c15f3c', '#7fa8cf', '#eaa9b8', '#8fbf9f', '#f2c14e', '#8d7bc4'];

// ---------- 상태 ----------
const params = new URLSearchParams(location.search);
const state = {
  itemId: params.get('item') || 'name-keychain',
  product: null,
  type: 'keychain',
  text: 'ALEX',
  font: 'bold',
  baseColor: COLORS[2],
  textColor: COLORS[0]
};

// ---------- 씬 ----------
const canvas = document.getElementById('canvas3d');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 1000);
camera.position.set(0, 55, 120);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.autoRotate = true; // 사용자가 잡기 전까지 스스로 돈다
controls.autoRotateSpeed = 2.2;
controls.minDistance = 60;
controls.maxDistance = 260;
canvas.addEventListener('pointerdown', () => (controls.autoRotate = false), { once: true });

// 조명: 부드러운 스튜디오 느낌
scene.add(new THREE.HemisphereLight(0xfff6ec, 0xd8cfc4, 1.1));
const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(60, 100, 80);
scene.add(key);
const rim = new THREE.DirectionalLight(0xffe8d8, 0.5);
rim.position.set(-80, 40, -60);
scene.add(rim);

// 바닥 그림자 느낌의 원판
const disc = new THREE.Mesh(
  new THREE.CircleGeometry(70, 48),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.06 })
);
disc.rotation.x = -Math.PI / 2;
disc.position.y = -1.2;
scene.add(disc);

let modelGroup = new THREE.Group();
scene.add(modelGroup);

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== w * renderer.getPixelRatio() || canvas.height !== h * renderer.getPixelRatio()) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}
(function loop() {
  resize();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
})();

// 개발 검증용 훅: 렌더 직후 캔버스를 캡처해 실제로 그려졌는지 확인
window.__snap = () => {
  renderer.render(scene, camera);
  const d = canvas.toDataURL('image/png');
  const box = new THREE.Box3().setFromObject(modelGroup);
  const size = box.getSize(new THREE.Vector3());
  return {
    bytes: d.length, tris: renderer.info.render.triangles, calls: renderer.info.render.calls,
    model: { w: +size.x.toFixed(1), h: +size.y.toFixed(1), d: +size.z.toFixed(1) }
  };
};

// ---------- 재료 ----------
const mat = (hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.42, metalness: 0.02 });

// ---------- 폰트 ----------
const fontCache = {};
const loader = new FontLoader();
function getFont(name) {
  if (fontCache[name]) return Promise.resolve(fontCache[name]);
  return new Promise((res, rej) =>
    loader.load(FONT_URLS[name], (f) => { fontCache[name] = f; res(f); }, undefined, rej)
  );
}

// ---------- 공용: 텍스트 지오메트리 ----------
function makeText(font, text, size, depth) {
  const geo = new TextGeometry(text, {
    // three r161은 두께 파라미터가 height (r163+에서 depth로 개명) — 둘 다 넘겨 안전하게
    font, size, height: depth, depth, curveSegments: 6,
    bevelEnabled: true, bevelThickness: 0.4, bevelSize: 0.3, bevelSegments: 2
  });
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const w = bb.max.x - bb.min.x, h = bb.max.y - bb.min.y;
  geo.translate(-bb.min.x - w / 2, -bb.min.y, -depth / 2); // 가로 중앙, 바닥 0 정렬
  return { geo, w, h };
}

// 개별 글자 (왼쪽 정렬 — 퍼즐 조각용)
function makeGlyph(font, ch, size, depth) {
  const geo = new TextGeometry(ch, {
    font, size, height: depth, depth, curveSegments: 6,
    bevelEnabled: true, bevelThickness: 0.4, bevelSize: 0.3, bevelSegments: 2
  });
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const w = bb.max.x - bb.min.x;
  geo.translate(-bb.min.x, -bb.min.y, -depth / 2);
  return { geo, w };
}

// 라운드 사각형 Shape (+선택적 구멍)
function roundedRect(w, h, r, holeX = null, holeR = 3.2) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  if (holeX !== null) {
    const hole = new THREE.Path();
    hole.absarc(holeX, 0, holeR, 0, Math.PI * 2);
    s.holes.push(hole);
  }
  return s;
}

// ---------- 모델 3종 ----------
function buildKeychain(font) {
  const g = new THREE.Group();
  const { geo: tGeo, w } = makeText(font, state.text, 13, 4);
  const plateW = w + 26, plateH = 24;
  const plate = new THREE.Mesh(
    new THREE.ExtrudeGeometry(roundedRect(plateW, plateH, 9, -plateW / 2 + 8.5), { depth: 4, bevelEnabled: false }),
    mat(state.baseColor)
  );
  plate.rotation.x = -Math.PI / 2; // 눕히기
  plate.position.y = 4;
  g.add(plate);

  const txt = new THREE.Mesh(tGeo, mat(state.textColor));
  txt.rotation.x = -Math.PI / 2;
  txt.position.set(4, 4 + 4, 6.5); // 구멍 피해서 살짝 오른쪽
  g.add(txt);
  return { group: g, camDist: Math.max(90, plateW * 2.1) };
}

function buildNameplate(font) {
  const g = new THREE.Group();
  const { geo: tGeo, w } = makeText(font, state.text, 18, 7);
  const baseW = w + 18;
  const base = new THREE.Mesh(new THREE.BoxGeometry(baseW, 6, 20), mat(state.baseColor));
  base.geometry.translate(0, 3, 0);
  g.add(base);

  const txt = new THREE.Mesh(tGeo, mat(state.textColor));
  txt.position.y = 5.2; // 받침 위에 서 있게
  g.add(txt);
  return { group: g, camDist: Math.max(110, baseW * 2.2) };
}

function buildTopper(font) {
  const g = new THREE.Group();
  const { geo: tGeo, w } = makeText(font, state.text, 15, 3);
  const txt = new THREE.Mesh(tGeo, mat(state.textColor));
  txt.position.y = 26;
  g.add(txt);

  // 글자 아래 연결 바 + 케이크 꽂이
  const bar = new THREE.Mesh(new THREE.BoxGeometry(w + 6, 3, 3), mat(state.textColor));
  bar.position.y = 25;
  g.add(bar);
  const stickL = new THREE.Mesh(new THREE.BoxGeometry(3, 26, 3), mat(state.textColor));
  stickL.position.set(-w / 3, 12, 0);
  g.add(stickL);
  const stickR = stickL.clone();
  stickR.position.x = w / 3;
  g.add(stickR);
  return { group: g, camDist: Math.max(110, w * 2.4) };
}

function buildNamePuzzle(font) {
  const g = new THREE.Group();
  const text = state.text.toUpperCase();
  const startIdx = Math.max(0, COLORS.indexOf(state.textColor));

  // 글자별 지오메트리 준비 + 전체 폭 계산
  const glyphs = [];
  let totalW = 0;
  for (const ch of text) {
    if (ch === ' ') { glyphs.push(null); totalW += 9; continue; }
    const gl = makeGlyph(font, ch, 15, 6);
    glyphs.push(gl);
    totalW += gl.w + 3.5;
  }
  totalW = Math.max(totalW - 3.5, 10);

  // 받침 트레이
  const trayW = totalW + 18, trayD = 34;
  const tray = new THREE.Mesh(
    new THREE.ExtrudeGeometry(roundedRect(trayW, trayD, 10), { depth: 5, bevelEnabled: false }),
    mat(state.baseColor)
  );
  tray.rotation.x = -Math.PI / 2;
  tray.position.y = 5;
  g.add(tray);

  // 퍼즐 조각들: 색이 하나씩 순환
  let x = -totalW / 2;
  let ci = 0;
  for (const gl of glyphs) {
    if (!gl) { x += 9; continue; }
    const piece = new THREE.Mesh(gl.geo, mat(COLORS[(startIdx + ci) % COLORS.length]));
    piece.rotation.x = -Math.PI / 2;
    piece.position.set(x, 11, 5.5);
    g.add(piece);
    x += gl.w + 3.5;
    ci++;
  }
  return { group: g, camDist: Math.max(120, trayW * 2.0) };
}

// 제네릭 차 실루엣 (측면, 휠 아치 컷) — 특정 브랜드 아님(상표권 안전)
function carShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 4);
  s.quadraticCurveTo(0.5, 8.5, 6, 9);       // 뒷범퍼 → 트렁크
  s.quadraticCurveTo(11, 14.5, 19, 14.8);   // 뒷유리 → 루프
  s.lineTo(26, 14.8);                        // 루프
  s.quadraticCurveTo(33, 14.2, 38, 9.5);    // 앞유리
  s.quadraticCurveTo(43.5, 8.8, 44, 5.5);   // 보닛 → 노즈
  s.quadraticCurveTo(44, 4, 42.5, 4);       // 앞범퍼
  s.lineTo(38.5, 4);
  s.absarc(33.5, 4, 5, 0, Math.PI, false);  // 앞바퀴 아치
  s.lineTo(15.5, 4);
  s.absarc(10.5, 4, 5, 0, Math.PI, false);  // 뒷바퀴 아치
  s.lineTo(0, 4);
  return s;
}

function buildCar(font) {
  const g = new THREE.Group();
  const sub = new THREE.Group();
  const plateW = 68, plateH = 30;

  const plate = new THREE.Mesh(
    new THREE.ExtrudeGeometry(roundedRect(plateW, plateH, 4.5, -plateW / 2 + 7), { depth: 4, bevelEnabled: false }),
    mat(state.baseColor)
  );
  sub.add(plate);

  const car = new THREE.Mesh(new THREE.ExtrudeGeometry(carShape(), { depth: 2.6, bevelEnabled: false }), mat(state.textColor));
  car.position.set(-17, -0.5, 4);
  sub.add(car);

  const { geo: tGeo } = makeText(font, state.text, 8.2, 2.6);
  const txt = new THREE.Mesh(tGeo, mat(state.textColor));
  txt.position.set(3, -13.5, 5.3);
  sub.add(txt);

  sub.rotation.x = -Math.PI / 2; // 키체인처럼 눕히기
  sub.position.y = 1;
  g.add(sub);
  return { group: g, camDist: 165 };
}

const BUILDERS = { keychain: buildKeychain, nameplate: buildNameplate, topper: buildTopper, namepuzzle: buildNamePuzzle, car: buildCar };

// ---------- 리빌드 ----------
let firstBuild = true;
async function rebuild() {
  const font = await getFont(state.font);
  scene.remove(modelGroup);
  modelGroup.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  const builder = BUILDERS[state.type] || buildKeychain; // 알 수 없는 타입(캐시 불일치 등)이어도 죽지 않게
  const { group, camDist } = builder(font);
  modelGroup = group;
  scene.add(modelGroup);
  if (firstBuild) {
    camera.position.set(0, camDist * 0.45, camDist);
    controls.target.set(0, state.type === 'topper' ? 24 : 8, 0);
    document.getElementById('stageLoad').style.display = 'none';
    firstBuild = false;
  }
  updateEstimate();
}

// ---------- 가격 추정 ----------
function updateEstimate() {
  const p = state.product;
  if (!p) return;
  const extra = Math.max(0, state.text.length - 5) * 1.5;
  const lo = Math.round(p.priceFrom + extra), hi = Math.round(p.priceTypical + extra);
  document.getElementById('pEst').firstChild.textContent = `~ $${lo} – $${hi} `;
}

// ---------- UI ----------
function swatchRow(el, cur, onPick) {
  el.innerHTML = COLORS.map((c) => `<button class="sw ${c === cur ? 'on' : ''}" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join('');
  el.querySelectorAll('.sw').forEach((b) =>
    b.addEventListener('click', () => {
      el.querySelectorAll('.sw').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      onPick(b.dataset.c);
    })
  );
}

document.getElementById('cText').addEventListener('input', (e) => {
  state.text = e.target.value.trim() || 'NAME';
  rebuild();
});
document.querySelectorAll('.fbtn').forEach((b) =>
  b.addEventListener('click', () => {
    document.querySelectorAll('.fbtn').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    state.font = b.dataset.font;
    rebuild();
  })
);

// 주문 버튼: 디자인 구성을 담아 주문 폼으로
document.getElementById('orderBtn').addEventListener('click', () => {
  localStorage.setItem('plt_config', JSON.stringify({
    at: Date.now(),
    item: state.product?.title || state.itemId,
    text: state.text,
    font: state.font === 'bold' ? 'Rounded Bold' : 'Classic Serif',
    baseColor: state.baseColor,
    textColor: state.textColor,
    type: state.type
  }));
});

// ---------- 시작 ----------
(async function init() {
  try {
    const data = await fetch('products.json?v=' + Date.now()).then((r) => r.json());
    state.product = data.items.find((i) => i.id === state.itemId && i.editor) || data.items.find((i) => i.editor);
    if (state.product) {
      state.itemId = state.product.id;
      state.type = state.product.editor.type;
      state.text = state.product.editor.text || 'NAME';
      document.getElementById('pTitle').textContent = state.product.title.replace(/s$/, '');
      document.getElementById('cText').value = state.text;
    }
  } catch {}
  if (state.type === 'topper') {
    document.getElementById('ctlBase').style.display = 'none'; // 토퍼는 단색
  }
  if (state.type === 'namepuzzle') {
    document.getElementById('textColorLabel').textContent = 'Piece colours · pick the first, the rest follow';
  }
  if (state.type === 'car') {
    document.getElementById('textColorLabel').textContent = 'Car & plate lettering colour';
    document.getElementById('cText').maxLength = 9; // 번호판 길이
  }
  swatchRow(document.getElementById('swBase'), state.baseColor, (c) => { state.baseColor = c; rebuild(); });
  swatchRow(document.getElementById('swText'), state.textColor, (c) => { state.textColor = c; rebuild(); });
  rebuild();
})();
