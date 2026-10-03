import * as THREE from 'three';

/** Qo‘sh uchli gayka kaliti: bir uchi ochiq og‘iz (U), ikkinchi uchi olti qirrali halqa; tutqichi tekis. Hammasi bitta metall guruhda. */
export function buildWrench(material: THREE.Material) {
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

export function gearGeometry(teeth: number, inner: number, outer: number, depth: number, skip: number[] = []) {
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  let started = false;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    // Tushirib qoldirilgan tishlar (singan tishli g‘ildirak uchun).
    if (skip.includes(i)) {
      const x = Math.cos(a + step * 0.37) * inner;
      const y = Math.sin(a + step * 0.37) * inner;
      if (!started) shape.moveTo(x, y);
      else shape.lineTo(x, y);
      started = true;
      continue;
    }
    const pts: Array<[number, number]> = [
      [inner, a],
      [outer, a + step * 0.22],
      [outer, a + step * 0.52],
      [inner, a + step * 0.74],
    ];
    pts.forEach(([r, ang]) => {
      const x = Math.cos(ang) * r;
      const y = Math.sin(ang) * r;
      if (!started) shape.moveTo(x, y);
      else shape.lineTo(x, y);
      started = true;
    });
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, inner * 0.42, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 24 });
  g.center();
  return g;
}

