import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** Qo‘sh uchli gayka kaliti: bir uchi ochiq og‘iz (U), ikkinchi uchi olti qirrali halqa; tutqichi tekis. Hammasi bitta metall guruhda. */
function buildWrench(material: THREE.Material) {
  const group = new THREE.Group();
  const ext = (shape: THREE.Shape, depth: number, bevel = 0.06) => {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 6, curveSegments: 40 });
    g.translate(0, 0, -depth / 2);
    return g;
  };

  // Tutqich: yumaloq uchli to‘rtburchak.
  const handle = new THREE.Shape();
  const hw = 0.27;
  const hl = 2.5;
  handle.moveTo(-hw, -hl);
  handle.lineTo(hw, -hl);
  handle.lineTo(hw * 0.86, hl);
  handle.lineTo(-hw * 0.86, hl);
  handle.closePath();
  group.add(new THREE.Mesh(ext(handle, 0.2), material));

  // Ochiq og‘izli bosh (yuqorida), biroz og‘gan.
  const R = 0.9;
  const w = 0.33;
  const alpha = Math.asin(w / R);
  const open = new THREE.Shape();
  open.absarc(0, 0, R, Math.PI / 2 + alpha, Math.PI / 2 - alpha + Math.PI * 2, false);
  open.lineTo(w, 0.05);
  open.lineTo(-w, 0.05);
  open.closePath();
  const openMesh = new THREE.Mesh(ext(open, 0.26), material);
  openMesh.position.y = hl + 0.3;
  openMesh.rotation.z = 0.26;
  group.add(openMesh);

  // Olti qirrali halqali bosh (pastda).
  const ring = new THREE.Shape();
  ring.absarc(0, 0, 0.82, 0, Math.PI * 2, false);
  const hex = new THREE.Path();
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const x = Math.cos(ang) * 0.4;
    const y = Math.sin(ang) * 0.4;
    if (i === 0) hex.moveTo(x, y);
    else hex.lineTo(x, y);
  }
  hex.closePath();
  ring.holes.push(hex);
  const ringMesh = new THREE.Mesh(ext(ring, 0.26), material);
  ringMesh.position.y = -(hl + 0.28);
  group.add(ringMesh);

  // Tutqichdagi osish teshigi (bezak).
  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.03, 12, 24), material);
  eye.position.set(0, -1.6, 0.12);
  group.add(eye);
  return group;
}

function gearGeometry(teeth: number, inner: number, outer: number, depth: number) {
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts: Array<[number, number]> = [
      [inner, a],
      [outer, a + step * 0.22],
      [outer, a + step * 0.52],
      [inner, a + step * 0.74],
    ];
    pts.forEach(([r, ang], index) => {
      const x = Math.cos(ang) * r;
      const y = Math.sin(ang) * r;
      if (i === 0 && index === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, inner * 0.42, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 24 });
  g.center();
  return g;
}

interface Floating {
  mesh: THREE.Object3D;
  base: THREE.Vector3;
  speed: THREE.Vector3;
  phase: number;
  spin: THREE.Vector3;
}

export default function Hero3D() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(dpr);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    renderer.domElement.className = 'gm-hero3d__canvas';

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(0, 0, 9);

    const styles = getComputedStyle(document.documentElement);
    const primary = new THREE.Color(styles.getPropertyValue('--gm-color-primary').trim() || '#1b4dff');
    const accent = new THREE.Color(styles.getPropertyValue('--gm-color-accent').trim() || '#ffb020');

    const chrome = new THREE.MeshPhysicalMaterial({ color: primary.clone().lerp(new THREE.Color('#ffffff'), 0.82), metalness: 1, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.6 });
    const steel = new THREE.MeshPhysicalMaterial({ color: primary.clone().lerp(new THREE.Color('#c9d6ff'), 0.35), metalness: 1, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.18, envMapIntensity: 1.25 });
    const gold = new THREE.MeshPhysicalMaterial({ color: accent, metalness: 1, roughness: 0.28, clearcoat: 0.5, envMapIntensity: 1.2 });
    const dark = new THREE.MeshPhysicalMaterial({ color: '#1a2250', metalness: 0.9, roughness: 0.35, envMapIntensity: 1.1 });

    const key = new THREE.DirectionalLight('#ffffff', 2.2);
    key.position.set(4, 5, 6);
    const rim = new THREE.PointLight(accent, 30, 24);
    rim.position.set(-5, -2, 3);
    scene.add(key, rim, new THREE.AmbientLight('#8fa8ff', 0.35));

    const group = new THREE.Group();
    scene.add(group);

    const wrench = buildWrench(chrome);
    wrench.scale.setScalar(0.58);
    wrench.rotation.z = -0.62;
    group.add(wrench);

    const floaters: Floating[] = [];
    const add = (mesh: THREE.Object3D, x: number, y: number, z: number, spin: [number, number, number], speed = 0.6) => {
      mesh.position.set(x, y, z);
      group.add(mesh);
      floaters.push({ mesh, base: new THREE.Vector3(x, y, z), speed: new THREE.Vector3(0.7 + Math.random() * 0.5, speed, 0.5), phase: Math.random() * 6.28, spin: new THREE.Vector3(...spin) });
    };
    add(new THREE.Mesh(gearGeometry(12, 0.62, 0.82, 0.22), gold), 2.2, 1.5, -0.6, [0.1, 0.05, 0.35]);
    add(new THREE.Mesh(gearGeometry(9, 0.42, 0.58, 0.18), dark), -2.3, -1.6, 0.4, [0.08, 0.1, -0.5]);
    add(new THREE.Mesh(gearGeometry(16, 0.5, 0.64, 0.16), steel), -2.1, 1.9, -1.2, [0.05, 0.08, 0.28]);
    const nutGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.22, 6);
    const nut1 = new THREE.Mesh(nutGeo, gold);
    nut1.rotation.x = Math.PI / 2;
    add(nut1, 1.9, -1.9, 0.8, [0.6, 0.2, 0.3]);
    const nut2 = new THREE.Mesh(nutGeo, steel);
    nut2.scale.setScalar(0.7);
    add(nut2, 2.9, -0.2, -0.2, [0.4, 0.6, 0.1]);
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 2), gold);
    add(ball, 3.3, 1.2, 0.9, [0.2, 0.3, 0.1]);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.11, 24, 64), dark);
    add(ring, 1.1, 1.9, 0.3, [0.5, 0.3, 0.2]);

    // Uchqunlar (zarralar).
    const sparkCount = 90;
    const sparkGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(sparkCount * 3);
    for (let i = 0; i < sparkCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 11;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1;
    }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: accent, size: 0.045, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(sparks);

    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (event: PointerEvent) => {
      pointer.tx = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = (event.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    const size = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Keng ekranda sahna o‘ngga va biroz yuqoriga suriladi: chapda matn, o‘ngda 3D.
      if (w > 900) camera.setViewOffset(w, h, -w * 0.2, h * 0.07, w, h);
      else camera.clearViewOffset();
      // Tor ekranda sahnani uzoqroqqa olib, hamma narsa sig‘adi.
      camera.position.z = w < 700 ? 12.5 : w < 1000 ? 10.5 : 9;
      camera.updateProjectionMatrix();
    };
    size();
    const resizeObserver = new ResizeObserver(size);
    resizeObserver.observe(mount);

    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
    });
    io.observe(mount);

    let scrollProgress = 0;
    const onScroll = () => {
      scrollProgress = Math.min(1, window.scrollY / Math.max(1, window.innerHeight * 0.9));
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    const clock = new THREE.Clock();
    let frame = 0;
    const intro = { value: 0 };
    const render = () => {
      frame = requestAnimationFrame(render);
      if (!visible || document.hidden) return;
      const t = clock.getElapsedTime();
      intro.value = Math.min(1, intro.value + 0.012);
      const ease = 1 - Math.pow(1 - intro.value, 3);
      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;

      group.rotation.y = pointer.x * 0.5 + scrollProgress * 1.1;
      group.rotation.x = pointer.y * 0.3 - scrollProgress * 0.4;
      group.position.y = scrollProgress * -1.2 + Math.sin(t * 0.8) * 0.12;
      group.scale.setScalar(0.35 + ease * 0.47 - scrollProgress * 0.12);
      wrench.rotation.z = -0.62 + Math.sin(t * 0.6) * 0.07;
      wrench.rotation.y = Math.sin(t * 0.5) * 0.25 + (1 - ease) * 2.4;

      for (const f of floaters) {
        f.mesh.position.set(f.base.x + Math.sin(t * f.speed.x + f.phase) * 0.18, f.base.y + Math.cos(t * f.speed.y + f.phase) * 0.22, f.base.z + Math.sin(t * f.speed.z + f.phase) * 0.15);
        f.mesh.rotation.x += f.spin.x * 0.01;
        f.mesh.rotation.y += f.spin.y * 0.01;
        f.mesh.rotation.z += f.spin.z * 0.01;
      }
      sparks.rotation.y = t * 0.03 + pointer.x * 0.2;
      sparks.rotation.x = pointer.y * 0.1;
      rim.position.x = -5 + pointer.x * 3;
      rim.position.y = -2 - pointer.y * 3;
      renderer.render(scene, camera);
    };
    render();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
      resizeObserver.disconnect();
      io.disconnect();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose?.();
      });
      [chrome, steel, gold, dark].forEach((m) => m.dispose());
      envTexture.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={mountRef} className="gm-hero3d" aria-hidden="true" />;
}
