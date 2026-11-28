// 四隅の金具・紋章と後片付け

export function disposeObject3D(root) {
  root.traverse(child => {
    if (!child.isMesh) return;
    if (child.geometry) child.geometry.dispose();
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach(m => {
      if (m && typeof m.dispose === 'function') m.dispose();
    });
  });
}

/**
 * Adds low-poly metal corner guards to all 4 corners of a cover exterior group.
 */
export function addCartoonCorners(parent, w, h, metalMat, style) {
  const corners = [
    { sx: -1, sz: -1 },
    { sx: 1, sz: -1 },
    { sx: -1, sz: 1 },
    { sx: 1, sz: 1 }
  ];

  corners.forEach(({ sx, sz }) => {
    const g = new THREE.Group();
    g.position.set(sx * (w * 0.5 - 0.015), 0, sz * (h * 0.5 - 0.015));

    if (style === 'chunky') {
      const armL = 0.34;
      const armW = 0.085;
      const thick = 0.022;

      const barX = new THREE.Mesh(new THREE.BoxGeometry(armL, thick, armW), metalMat);
      barX.position.set(-sx * (armL * 0.5 - armW * 0.5), thick * 0.5, -sz * (armW * 0.5));
      g.add(barX);

      const barZ = new THREE.Mesh(new THREE.BoxGeometry(armW, thick, armL), metalMat);
      barZ.position.set(-sx * (armW * 0.5), thick * 0.5, -sz * (armL * 0.5 - armW * 0.5));
      g.add(barZ);

      // Tiny stepped corner rivet
      const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.032, 0.018, 6), metalMat);
      rivet.position.set(-sx * 0.06, thick + 0.006, -sz * 0.06);
      g.add(rivet);
    } else {
      // 'round': hexagonal low-poly rivet stud
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.022, 6), metalMat);
      plate.position.set(-sx * 0.12, 0.011, -sz * 0.12);
      g.add(plate);

      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.020, 6), metalMat);
      cap.position.set(-sx * 0.12, 0.026, -sz * 0.12);
      g.add(cap);
    }

    parent.add(g);
  });
}

/**
 * Adds a gemless low-poly metallic emblem centered below the front cover title.
 */
export function addSimpleMetalEmblem(parent, metalMat, coverMat, style, bookH) {
  const g = new THREE.Group();
  g.name = 'FrontCoverEmblem';
  g.position.set(0.02, 0.012, bookH * 0.06);

  if (style === 'compass') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.026, 5, 16), metalMat);
    ring.rotation.x = Math.PI * 0.5;
    ring.position.y = 0.014;
    g.add(ring);

    // 4 main compass points
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) * 0.5;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.28, 4), metalMat);
      spike.rotation.z = -Math.PI * 0.5;
      spike.rotation.y = ang;
      spike.scale.set(1, 1, 0.35);
      spike.position.set(Math.cos(ang) * 0.19, 0.018, -Math.sin(ang) * 0.19);
      g.add(spike);
    }

    // 4 diagonal minor points
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) * 0.5 + Math.PI * 0.25;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.18, 4), metalMat);
      spike.rotation.z = -Math.PI * 0.5;
      spike.rotation.y = ang;
      spike.scale.set(1, 1, 0.35);
      spike.position.set(Math.cos(ang) * 0.14, 0.014, -Math.sin(ang) * 0.14);
      g.add(spike);
    }

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.036, 8), metalMat);
    hub.position.y = 0.018;
    g.add(hub);
  } else if (style === 'moon') {
    // Low-poly crescent built from arc segments + 4-point star
    const segs = 7;
    for (let i = 0; i < segs; i++) {
      const t = i / (segs - 1);
      const ang = 0.55 * Math.PI + t * 1.15 * Math.PI;
      const thickness = Math.sin(t * Math.PI) * 0.065 + 0.025;
      const block = new THREE.Mesh(new THREE.BoxGeometry(thickness, 0.028, 0.12), metalMat);
      block.position.set(Math.cos(ang) * 0.24 - 0.04, 0.014, Math.sin(ang) * 0.24);
      block.rotation.y = -ang;
      g.add(block);
    }

    const starCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), metalMat);
    starCore.scale.set(1, 0.35, 1);
    starCore.position.set(0.14, 0.018, -0.04);
    g.add(starCore);
  } else if (style === 'ring') {
    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.028, 5, 12), metalMat);
    outerRing.rotation.x = Math.PI * 0.5;
    outerRing.position.y = 0.014;
    g.add(outerRing);

    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.022, 5, 8), metalMat);
    innerRing.rotation.x = Math.PI * 0.5;
    innerRing.position.y = 0.018;
    g.add(innerRing);

    const centerPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.028, 6), metalMat);
    centerPlate.position.y = 0.016;
    g.add(centerPlate);
  } else if (style === 'crest') {
    const shieldOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.32, 0.024, 6), metalMat);
    shieldOuter.scale.set(0.88, 1, 1.12);
    shieldOuter.position.y = 0.012;
    g.add(shieldOuter);

    const shieldInner = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.23, 0.028, 6), coverMat);
    shieldInner.scale.set(0.88, 1, 1.12);
    shieldInner.position.y = 0.015;
    g.add(shieldInner);

    const barV = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.032, 0.34), metalMat);
    barV.position.y = 0.018;
    g.add(barV);

    const barH = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.032, 0.05), metalMat);
    barH.position.set(0, 0.018, -0.05);
    g.add(barH);
  }

  parent.add(g);
}
