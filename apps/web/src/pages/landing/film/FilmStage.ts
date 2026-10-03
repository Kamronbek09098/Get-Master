import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildWrench, gearGeometry } from './models';

/**
 * GetMaster «filmi»: bitta Three.js sahna, hammasi skroll progressi (0..1) bilan boshqariladi.
 * React bu yerda har kadrda qayta chizilmaydi: tashqaridan faqat setProgress() chaqiriladi.
 *
 * 01 Muammo  → singan tishli g‘ildirak, uchqunlar
 * 02 Tushunish → so‘rov kartochkasi, skaner chizig‘i
 * 03 Moslik → ustalar tugunlari, ulanish chiziqlari
 * 04 Ish → kalit va ishlayotgan g‘ildiraklar (aylanish skrollga bog‘liq)
 * 05 Natija → butun g‘ildirak, muvaffaqiyat halqasi
 * 06 GetMaster → tinch yakuniy kadr
 */
export interface FilmStage {
  setProgress(progress: number): void;
  setActive(active: boolean): void;
  resize(): void;
  dispose(): void;
}

export const SCENES = [0, 0.17, 0.35, 0.53, 0.73, 0.88, 1] as const;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** a→b ko‘tariladi, c→d tushadi. */
const window4 = (a: number, b: number, c: number, d: number, x: number) => smooth(a, b, x) * (1 - smooth(c, d, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function textureFrom(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export interface FilmLabels {
  request: string;
  place: string;
  chips: string[];
  nodes: Array<{ letter: string; rating: string }>;
}

export function createFilmStage(mount: HTMLElement, labels: FilmLabels, options: { lowPower: boolean }): FilmStage | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !options.lowPower, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, options.lowPower ? 1.25 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'gm-film__canvas';
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  const css = getComputedStyle(document.documentElement);
  const accent = new THREE.Color(css.getPropertyValue('--gm-color-accent').trim() || '#f0b84b');

  const chrome = new THREE.MeshPhysicalMaterial({ color: '#dbe6ff', metalness: 1, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.6 });
  const gold = new THREE.MeshPhysicalMaterial({ color: accent, metalness: 1, roughness: 0.26, clearcoat: 0.6, envMapIntensity: 1.25 });
  const navy = new THREE.MeshPhysicalMaterial({ color: '#1a2250', metalness: 0.9, roughness: 0.34, envMapIntensity: 1.1 });
  const broken = new THREE.MeshPhysicalMaterial({ color: '#3a3f55', metalness: 0.85, roughness: 0.5, emissive: new THREE.Color('#ff3b30'), emissiveIntensity: 0.25, envMapIntensity: 0.9 });
  const disposables: Array<{ dispose(): void }> = [chrome, gold, navy, broken, envTexture];

  const key = new THREE.DirectionalLight('#ffffff', 2.1);
  key.position.set(4, 5, 6);
  const rim = new THREE.PointLight(accent, 26, 26);
  rim.position.set(-5, -2, 3);
  const alert = new THREE.PointLight('#ff3b30', 0, 14);
  alert.position.set(0, 0, 2.2);
  const good = new THREE.PointLight('#34d399', 0, 14);
  good.position.set(2.6, 0, 2.4);
  scene.add(key, rim, alert, good, new THREE.AmbientLight('#8fa8ff', 0.35));

  const world = new THREE.Group();
  scene.add(world);

  // ---- 01 Singan g‘ildirak + uchqunlar -------------------------------------------------
  const brokenGeo = gearGeometry(12, 0.78, 1.02, 0.26, [2, 3, 7]);
  const brokenGear = new THREE.Mesh(brokenGeo, broken);
  brokenGear.scale.setScalar(1.0);
  world.add(brokenGear);
  disposables.push(brokenGeo);

  const SPARKS = options.lowPower ? 50 : 110;
  const sparkPositions = new Float32Array(SPARKS * 3);
  const sparkSeeds = new Float32Array(SPARKS);
  for (let i = 0; i < SPARKS; i++) {
    sparkSeeds[i] = Math.random() * 6.28;
    sparkPositions[i * 3] = (Math.random() - 0.5) * 0.5;
    sparkPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
    sparkPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  const sparkMat = new THREE.PointsMaterial({ color: '#ff7a45', size: 0.05, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  world.add(sparks);
  disposables.push(sparkGeo, sparkMat);

  // ---- 02 So‘rov kartochkasi ---------------------------------------------------------
  const cardTexture = textureFrom(1024, 640, (ctx) => {
    ctx.fillStyle = '#0d1738';
    roundRect(ctx, 0, 0, 1024, 640, 56);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,185,255,0.45)';
    ctx.lineWidth = 4;
    roundRect(ctx, 2, 2, 1020, 636, 54);
    ctx.stroke();
    ctx.fillStyle = '#ffb020';
    ctx.beginPath();
    ctx.arc(80, 96, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '600 30px "JetBrains Mono", monospace';
    ctx.fillStyle = '#ffd27a';
    ctx.fillText('YANGI SO‘ROV', 108, 108);
    ctx.font = '800 64px Manrope, Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(labels.request, 64, 232);
    ctx.font = '500 34px Inter, sans-serif';
    ctx.fillStyle = 'rgba(231,238,255,0.78)';
    ctx.fillText(labels.place, 64, 312);
    let x = 64;
    ctx.font = '700 30px Inter, sans-serif';
    labels.chips.forEach((chip) => {
      const w = ctx.measureText(chip).width + 52;
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      roundRect(ctx, x, 380, w, 64, 32);
      ctx.fill();
      ctx.fillStyle = '#e8efff';
      ctx.fillText(chip, x + 26, 422);
      x += w + 16;
    });
    ctx.strokeStyle = 'rgba(160,185,255,0.25)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(64, 500 + i * 36);
      ctx.lineTo(64 + (i === 2 ? 380 : 780 - i * 90), 500 + i * 36);
      ctx.stroke();
    }
  });
  const cardMat = new THREE.MeshBasicMaterial({ map: cardTexture, transparent: true, opacity: 0, depthWrite: false });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.125), cardMat);
  world.add(card);
  const scanMat = new THREE.MeshBasicMaterial({ color: '#7aa2ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.05), scanMat);
  scan.position.z = 0.02;
  card.add(scan);
  disposables.push(cardTexture, cardMat, scanMat, card.geometry, scan.geometry);

  // ---- 03 Ustalar tugunlari -----------------------------------------------------------
  const NODE_COUNT = labels.nodes.length;
  const nodes: Array<{ mesh: THREE.Mesh; base: THREE.Vector3; phase: number }> = [];
  const lineGeo = new THREE.BufferGeometry();
  const linePositions = new Float32Array(NODE_COUNT * 6);
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: '#7aa2ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  world.add(lines);
  disposables.push(lineGeo, lineMat);
  const nodeGeo = new THREE.PlaneGeometry(0.78, 0.78);
  disposables.push(nodeGeo);
  labels.nodes.forEach((node, i) => {
    const tex = textureFrom(256, 256, (ctx) => {
      ctx.fillStyle = i === 1 ? '#ffb020' : '#16224f';
      ctx.beginPath();
      ctx.arc(128, 128, 120, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = i === 1 ? '#fff2cf' : 'rgba(160,185,255,0.55)';
      ctx.stroke();
      ctx.font = '800 96px Manrope, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = i === 1 ? '#3a2600' : '#ffffff';
      ctx.fillText(node.letter, 128, 140);
      ctx.font = '600 34px Inter, sans-serif';
      ctx.fillStyle = i === 1 ? '#3a2600' : '#ffd27a';
      ctx.fillText(`★ ${node.rating}`, 128, 200);
    });
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false });
    const mesh = new THREE.Mesh(nodeGeo, mat);
    const angle = (i / NODE_COUNT) * Math.PI * 2 + 0.4;
    const base = new THREE.Vector3(Math.cos(angle) * 2.9, Math.sin(angle) * 1.7, (Math.random() - 0.5) * 1.6);
    mesh.position.copy(base);
    world.add(mesh);
    nodes.push({ mesh, base, phase: i * 1.7 });
    disposables.push(tex, mat);
  });
  const CHOSEN = 1;

  // ---- 04 Ish: kalit + g‘ildiraklar --------------------------------------------------
  const work = new THREE.Group();
  work.position.set(2.7, 0, 0);
  world.add(work);
  const wrench = buildWrench(chrome);
  wrench.scale.setScalar(0.5);
  wrench.position.set(-0.2, -0.1, 0.35);
  work.add(wrench);
  const gearAGeo = gearGeometry(14, 0.62, 0.8, 0.2);
  const gearBGeo = gearGeometry(9, 0.4, 0.54, 0.2);
  const gearA = new THREE.Mesh(gearAGeo, gold);
  const gearB = new THREE.Mesh(gearBGeo, navy);
  gearA.position.set(0.25, 0.1, 0);
  gearB.position.set(1.1, 0.78, 0);
  work.add(gearA, gearB);
  disposables.push(gearAGeo, gearBGeo);

  // ---- 05 Natija -------------------------------------------------------------------
  const goodGeo = gearGeometry(12, 0.78, 1.02, 0.26);
  const goodGear = new THREE.Mesh(goodGeo, gold);
  goodGear.position.set(2.7, 0, 0);
  world.add(goodGear);
  const ringGeo = new THREE.TorusGeometry(1.5, 0.03, 16, 96);
  const ringMat = new THREE.MeshBasicMaterial({ color: '#34d399', transparent: true, opacity: 0 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.copy(goodGear.position);
  world.add(ring);
  const checkTexture = textureFrom(256, 256, (ctx) => {
    ctx.strokeStyle = '#04231a';
    ctx.lineWidth = 26;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(68, 134);
    ctx.lineTo(114, 180);
    ctx.lineTo(190, 86);
    ctx.stroke();
  });
  const checkBg = new THREE.Mesh(new THREE.CircleGeometry(0.46, 48), new THREE.MeshBasicMaterial({ color: '#34d399', transparent: true, opacity: 0 }));
  const checkMark = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: checkTexture, transparent: true, opacity: 0 }));
  checkBg.position.set(2.7, 0, 0.6);
  checkMark.position.set(2.7, 0, 0.62);
  world.add(checkBg, checkMark);
  disposables.push(goodGeo, ringGeo, ringMat, checkTexture, checkBg.geometry, checkMark.geometry, checkBg.material as THREE.Material, checkMark.material as THREE.Material);

  // ---- Kamera yo‘li ----------------------------------------------------------------------
  const keys: Array<{ p: number; pos: [number, number, number]; look: [number, number, number] }> = [
    { p: 0.0, pos: [0, 0.15, 6.4], look: [0, 0, 0] },
    { p: 0.17, pos: [0, 0, 5.4], look: [0, 0, 0] },
    { p: 0.35, pos: [0, 0.6, 9.4], look: [0, 0, 0] },
    { p: 0.47, pos: [0, 0.5, 9.2], look: [0, 0, 0] },
    { p: 0.53, pos: [1.4, 0.3, 8.8], look: [2.2, 0, 0] },
    { p: 0.73, pos: [2.7, 0.2, 6.6], look: [2.7, 0, 0] },
    { p: 0.88, pos: [2.5, 0.1, 7.6], look: [2.6, 0, 0] },
    { p: 1.0, pos: [0, 0, 9.2], look: [0, 0, 0] },
  ];
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  function cameraAt(p: number) {
    let i = 0;
    while (i < keys.length - 2 && p > keys[i + 1]!.p) i++;
    const a = keys[i]!;
    const b = keys[i + 1]!;
    const t = smooth(a.p, b.p, p);
    camPos.set(lerp(a.pos[0], b.pos[0], t), lerp(a.pos[1], b.pos[1], t), lerp(a.pos[2], b.pos[2], t));
    camLook.set(lerp(a.look[0], b.look[0], t), lerp(a.look[1], b.look[1], t), lerp(a.look[2], b.look[2], t));
  }

  // ---- Holat -------------------------------------------------------------------------------
  const state = { target: 0, p: 0, active: true, px: 0, py: 0, tpx: 0, tpy: 0, portrait: false };
  const clock = new THREE.Clock();
  let frame = 0;

  function applyScenes(p: number, time: number) {
    // 01
    const s1 = 1 - smooth(0.12, 0.23, p);
    brokenGear.visible = s1 > 0.01;
    brokenGear.scale.setScalar(1.0 * (0.2 + 0.8 * s1));
    brokenGear.rotation.z = Math.sin(time * 4.2) * 0.05 + p * 5;
    brokenGear.rotation.x = Math.sin(time * 1.1) * 0.12;
    broken.emissiveIntensity = 0.25 + Math.sin(time * 6) * 0.15;
    alert.intensity = s1 * (3.5 + Math.sin(time * 7) * 1.4);
    sparkMat.opacity = s1 * 0.9;
    for (let i = 0; i < SPARKS; i++) {
      const seed = sparkSeeds[i]!;
      const life = (time * 0.6 + seed) % 1;
      const r = 0.6 + life * 2.2;
      sparkPositions[i * 3] = Math.cos(seed * 9.1) * r;
      sparkPositions[i * 3 + 1] = Math.sin(seed * 7.3) * r * 0.8 - life * 0.4;
      sparkPositions[i * 3 + 2] = Math.sin(seed * 3.7) * 0.8;
    }
    sparkGeo.attributes.position!.needsUpdate = true;
    sparks.visible = s1 > 0.01;

    // 02 + 03 so‘rov kartochkasi
    const cardIn = smooth(0.17, 0.27, p);
    const cardOut = smooth(0.5, 0.58, p);
    cardMat.opacity = cardIn * (1 - cardOut);
    const cardScale = lerp(0.5, 1, cardIn) * lerp(1, 0.5, smooth(0.35, 0.45, p));
    card.scale.setScalar(cardScale);
    card.position.set(0, lerp(0.3, 0, cardIn), 0);
    card.visible = cardMat.opacity > 0.01;
    const scanT = smooth(0.2, 0.33, p);
    scan.position.y = lerp(1.0, -1.0, scanT);
    scanMat.opacity = window4(0.2, 0.22, 0.31, 0.34, p) * 0.9;

    // 03 tugunlar
    const matchIn = smooth(0.35, 0.47, p);
    const chosenGo = smooth(0.5, 0.58, p);
    nodes.forEach((n, i) => {
      const stagger = clamp01((matchIn - i * 0.07) / 0.6);
      const mat = n.mesh.material as THREE.MeshBasicMaterial;
      const isChosen = i === CHOSEN;
      const out = isChosen ? smooth(0.58, 0.64, p) : smooth(0.5, 0.58, p);
      mat.opacity = stagger * (1 - out);
      n.mesh.visible = mat.opacity > 0.01;
      const float = Math.sin(time * 0.9 + n.phase) * 0.12;
      const targetPos = isChosen ? new THREE.Vector3(2.7, 0, 0.3) : n.base;
      n.mesh.position.set(
        lerp(n.base.x * 0.35, isChosen ? lerp(n.base.x, targetPos.x, chosenGo) : n.base.x, stagger),
        lerp(n.base.y * 0.35, isChosen ? lerp(n.base.y, targetPos.y, chosenGo) : n.base.y, stagger) + float,
        n.base.z,
      );
      n.mesh.scale.setScalar(isChosen ? lerp(1, 0.55, chosenGo) : 1);
      n.mesh.lookAt(camera.position);
      linePositions[i * 6] = 0;
      linePositions[i * 6 + 1] = 0;
      linePositions[i * 6 + 2] = 0;
      linePositions[i * 6 + 3] = n.mesh.position.x * stagger;
      linePositions[i * 6 + 4] = n.mesh.position.y * stagger;
      linePositions[i * 6 + 5] = n.mesh.position.z * stagger;
    });
    lineGeo.attributes.position!.needsUpdate = true;
    lineMat.opacity = window4(0.37, 0.46, 0.52, 0.6, p) * 0.7;

    // 04 ish
    const workIn = smooth(0.55, 0.64, p);
    const workOut = smooth(0.7, 0.75, p);
    work.visible = workIn * (1 - workOut) > 0.01;
    work.scale.setScalar(lerp(0.2, 1, workIn) * (1 - workOut * 0.6));
    const turn = clamp01((p - 0.55) / 0.2) * Math.PI * 14;
    gearA.rotation.z = turn;
    gearB.rotation.z = -turn * (14 / 9) + 0.2;
    wrench.rotation.z = -0.62 + Math.sin(turn * 0.35) * 0.16;
    rim.intensity = 26;

    // 05 natija
    const resultIn = smooth(0.74, 0.8, p);
    const resultOut = smooth(0.86, 0.93, p);
    goodGear.visible = resultIn > 0.01 && resultOut < 0.99;
    goodGear.scale.setScalar(lerp(0.1, 0.95, resultIn) * (1 - resultOut * 0.5));
    goodGear.rotation.z = clamp01((p - 0.74) / 0.26) * Math.PI * 2;
    const ringT = smooth(0.78, 0.9, p);
    ring.scale.setScalar(lerp(0.6, 1.5, ringT));
    ringMat.opacity = (1 - ringT * 0.9) * smooth(0.76, 0.79, p) * (1 - resultOut);
    ring.visible = ringMat.opacity > 0.01;
    const checkIn = smooth(0.82, 0.88, p) * (1 - smooth(0.87, 0.93, p));
    (checkBg.material as THREE.MeshBasicMaterial).opacity = checkIn;
    (checkMark.material as THREE.MeshBasicMaterial).opacity = checkIn;
    checkBg.scale.setScalar(lerp(0.3, 1, smooth(0.82, 0.9, p)));
    checkMark.scale.setScalar(lerp(0.3, 1, smooth(0.82, 0.9, p)));
    good.intensity = window4(0.76, 0.84, 0.9, 1.0, p) * 5;

    // 06 yakun
    // Tik (telefon) ekran: sahna kichraytiriladi; 1-sahnada matn tepada, qolganida pastda bo‘lgani uchun sahna pastga/tepaga suriladi.
    world.scale.setScalar(state.portrait ? 0.68 : 1);
    world.position.y = state.portrait ? lerp(-1.2, 0.9, smooth(0.08, 0.2, p)) : 0;
    world.rotation.y = Math.sin(time * 0.3) * 0.06 + state.px * 0.18;
    world.rotation.x = state.py * 0.1;
  }

  function render() {
    frame = requestAnimationFrame(render);
    if (!state.active || document.hidden) return;
    const time = clock.getElapsedTime();
    state.p += (state.target - state.p) * 0.085;
    state.px += (state.tpx - state.px) * 0.05;
    state.py += (state.tpy - state.py) * 0.05;
    applyScenes(state.p, time);
    cameraAt(state.p);
    camera.position.copy(camPos).add(new THREE.Vector3(state.px * 0.35, -state.py * 0.25, 0));
    camera.lookAt(camLook);
    renderer.render(scene, camera);
  }
  render();

  const onPointer = (event: PointerEvent) => {
    state.tpx = (event.clientX / window.innerWidth) * 2 - 1;
    state.tpy = (event.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  function resize() {
    const w = mount.clientWidth || 1;
    const h = mount.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    state.portrait = w / h < 0.8;
    // Tor (vertikal) ekranda sahnani uzoqlashtirib, hammasi sig‘ishini ta’minlaymiz.
    camera.fov = w / h < 0.75 ? 52 : w / h < 1.1 ? 42 : 34;
    // Keng ekranda sahna biroz o‘ngga suriladi: chapda matn uchun joy qoladi.
    if (w / h > 1.15) camera.setViewOffset(w, h, -w * 0.13, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  resize();

  return {
    setProgress(progress) {
      state.target = clamp01(progress);
    },
    setActive(active) {
      state.active = active;
    },
    resize,
    dispose() {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onPointer);
      disposables.forEach((item) => item.dispose());
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
