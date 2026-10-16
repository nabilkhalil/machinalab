// MachinaLab 3D turning view: a Three.js (r159, vendored) scene of a lathe finish-turning a bar.
// Browser only. It draws whatever `MachinaLab.turning.motion()` describes and computes no
// machining quantity itself: every number the student reads comes from the model, not from here.
//
// Lifecycle: create() once; the app moves `view.canvas` into each freshly rendered simulator page.
// The animation loop runs only while playing, the canvas is on the page and the tab is visible.
(function (root) {
  'use strict';

  // WebGL may be switched off by the browser, a group policy or an old graphics driver.
  function supported() {
    if (!root.THREE) return false;
    try {
      const probe = document.createElement('canvas');
      return Boolean(probe.getContext('webgl2') || probe.getContext('webgl'));
    } catch {
      return false;
    }
  }

  // Small canvas textures, so no image files are needed (CSP: img-src 'self' data:).
  function stripeTexture(THREE, draw) {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    draw(c.getContext('2d'));
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function create() {
    const THREE = root.THREE;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    // Pixel ratio capped: sharp enough, and affordable on integrated laptop graphics.
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 1.5));
    const canvas = renderer.domElement;
    canvas.className = 'lathe-canvas';
    canvas.setAttribute('role', 'img');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#dfe8ee');
    const camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.1, 200);
    scene.add(new THREE.HemisphereLight('#ffffff', '#5d7180', 2.2));
    const sun = new THREE.DirectionalLight('#ffffff', 2.4);
    sun.position.set(3, 6, 5);
    scene.add(sun);

    const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.45, ...extra });
    // Cylinder whose axis is the x axis (the spindle axis), length 1, scaled per frame.
    // Optional plain material for the end faces, so surface textures only show on the side.
    const axialCylinder = (radius, segments, material, faceMaterial) => {
      const g = new THREE.CylinderGeometry(radius, radius, 1, segments, 1);
      g.rotateZ(-Math.PI / 2);
      return new THREE.Mesh(g, faceMaterial ? [material, faceMaterial, faceMaterial] : material);
    };
    const faceMat = mat('#a9b6bf', { metalness: 0.4, roughness: 0.4 });

    // ---- Machine: bed, headstock and chuck ------------------------------------------------
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1, 0.35, 2.4), mat('#3f505c', { metalness: 0.1 }));
    bed.position.y = -2.1;
    scene.add(bed);
    const headstock = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3.4, 2.8), mat('#4b6272', { metalness: 0.1 }));
    headstock.position.set(-1.45, -0.25, 0);
    scene.add(headstock);

    // Everything on the spindle turns together.
    const spindle = new THREE.Group();
    scene.add(spindle);
    const chuck = axialCylinder(1.55, 40, mat('#8395a2'));
    chuck.scale.x = 0.55;
    chuck.position.x = -0.42;
    spindle.add(chuck);
    for (let i = 0; i < 3; i++) {
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.42, 0.34), mat('#5d6d79'));
      const a = i * 2 * Math.PI / 3;
      jaw.position.set(0.05, Math.cos(a) * 1.18, Math.sin(a) * 1.18);
      jaw.rotation.x = a;
      spindle.add(jaw);
    }

    // ---- Workpiece: uncut stock (chuck side) and finished diameter (tailstock side) ------
    // Lengthwise dark streaks on the stock make the rotation visible.
    const stockTex = stripeTexture(THREE, g => {
      g.fillStyle = '#7d8a93';
      g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#5b666e';
      [6, 22, 41, 50].forEach(x => g.fillRect(x, 0, 3, 64));
    });
    // Rings on the finished surface stand for the feed marks (spacing = drawn feed per revolution).
    const markTex = stripeTexture(THREE, g => {
      g.fillStyle = '#d3dde3';
      g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#93a3ad';
      g.fillRect(0, 0, 64, 14);
    });
    const stock = axialCylinder(1, 48, mat('#ffffff', { map: stockTex, metalness: 0.3, roughness: 0.6 }), faceMat);
    spindle.add(stock);
    let finished = null;
    const finishedMat = mat('#ffffff', { map: markTex, metalness: 0.55, roughness: 0.3 });

    // ---- Tailstock centre --------------------------------------------------------------
    const tailstock = new THREE.Group();
    const centre = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.6, 24), mat('#8395a2'));
    centre.rotation.z = Math.PI / 2;
    centre.position.x = 0.3;
    const quill = axialCylinder(0.38, 24, mat('#4b6272', { metalness: 0.1 }));
    quill.scale.x = 1.4;
    quill.position.x = 1.3;
    tailstock.add(centre, quill);
    scene.add(tailstock);

    // ---- Tool: coated insert on a holder, cutting on the operator's side (+z) -----------
    const tool = new THREE.Group();
    const insert = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.07, 3), mat('#d9a441', { metalness: 0.6, roughness: 0.3 }));
    // A 3-sided cylinder has a corner at +z; turned half a revolution, that corner points at the
    // bar and touches the finished radius at the tool group's origin.
    insert.rotation.y = Math.PI;
    insert.position.set(0, 0, 0.2);
    const holder = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 1.9), mat('#59656f'));
    holder.position.set(0.12, -0.12, 1.25);
    tool.add(insert, holder);
    scene.add(tool);

    // ---- Chips (purely illustrative) ---------------------------------------------------
    const chipMat = mat('#9b7a43', { metalness: 0.5 });
    const chipGeo = new THREE.TetrahedronGeometry(0.06);
    const chips = Array.from({ length: 40 }, () => {
      const mesh = new THREE.Mesh(chipGeo, chipMat);
      mesh.visible = false;
      scene.add(mesh);
      return { mesh, vel: new THREE.Vector3(), life: 0 };
    });
    let chipClock = 0;

    // ---- State ---------------------------------------------------------------------------
    let m = null;            // current motion description (turning.js)
    let progress = 0;        // 0 = tool at the tailstock end, 1 = pass complete
    let hold = 0;            // pause at the end of a pass before the next one, s
    let angle = 0;
    let playing = false;
    let raf = 0;
    let last = 0;
    const view = { az: 0.62, el: 0.5, zoom: 1 };
    const target = new THREE.Vector3();

    function placeCamera() {
      const len = m ? m.length : 4;
      const dist = (len * 1.05 + 6) * view.zoom;
      target.set(len * 0.42, -0.35, 0.3);
      camera.position.set(
        target.x + dist * Math.sin(view.az) * Math.cos(view.el),
        target.y + dist * Math.sin(view.el),
        target.z + dist * Math.cos(view.az) * Math.cos(view.el));
      camera.lookAt(target);
    }

    // Lengths and positions for the current progress through the pass.
    function applyProgress() {
      if (!m) return;
      const len = m.length;
      const toolX = len - progress * (len - 0.2);
      stock.scale.x = Math.max(toolX, 1e-3);
      stock.position.x = toolX / 2;
      const cutLen = Math.max(len - toolX, 1e-3);
      finished.scale.x = cutLen;
      finished.position.x = toolX + cutLen / 2;
      finished.visible = len - toolX > 1e-3;
      // One ring per drawn revolution, anchored to the tailstock end so the rings stay on the
      // bar while the tool moves (texture v runs from the tool side, 0, to the tailstock end, 1).
      const rings = cutLen / m.feedPitch;
      markTex.repeat.set(1, rings);
      markTex.offset.set(0, -rings);
      tool.position.set(toolX, 0, m.radiusFinal);
    }

    function emitChip() {
      const chip = chips.find(c => c.life <= 0);
      if (!chip) return;
      chip.life = 0.9;
      chip.mesh.visible = true;
      chip.mesh.position.set(tool.position.x, 0.05, m.radiusFinal + 0.05);
      chip.vel.set(0.3 + Math.random() * 0.5, 1.6 + Math.random() * 1.2, 0.7 + Math.random() * 0.8);
    }

    function step(dt) {
      angle -= 2 * Math.PI * m.revPerSecond * dt; // front of the bar moves down onto the tool
      spindle.rotation.x = angle;
      if (hold > 0) {
        hold -= dt;
        if (hold <= 0) progress = 0;
      } else {
        progress += dt / m.passSeconds;
        if (progress >= 1) {
          progress = 1;
          hold = 1.2;
        }
        chipClock += dt * Math.min(30, 10 + m.revPerSecond * 6);
        while (chipClock >= 1) {
          chipClock -= 1;
          emitChip();
        }
      }
      for (const c of chips) {
        if (c.life <= 0) continue;
        c.life -= dt;
        c.vel.y -= 6 * dt;
        c.mesh.position.addScaledVector(c.vel, dt);
        c.mesh.rotation.x += 9 * dt;
        c.mesh.rotation.y += 7 * dt;
        if (c.life <= 0) c.mesh.visible = false;
      }
      applyProgress();
    }

    function resize() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      const size = renderer.getSize(new THREE.Vector2());
      if (size.x === w && size.y === h) return;
      renderer.setSize(w, h, false); // false: CSS keeps control of the displayed size
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    function draw() {
      resize();
      placeCamera();
      renderer.render(scene, camera);
    }

    // Run only while it can be seen: playing, on the page, scrolled into view and the tab visible.
    let onScreen = true;
    const shouldRun = () => playing && m && canvas.isConnected && onScreen && !document.hidden;
    // About 30 frames per second is smooth for this motion and halves the work on laptop graphics.
    const FRAME_MS = 1000 / 30;
    function frame(now) {
      raf = 0;
      if (now - last >= FRAME_MS - 2) {
        const dt = Math.min(0.1, (now - last) / 1000); // no jump after a stall
        last = now;
        step(dt);
        draw();
      }
      if (shouldRun()) raf = root.requestAnimationFrame(frame);
    }
    function start() {
      if (raf || !shouldRun()) return;
      last = root.performance.now();
      raf = root.requestAnimationFrame(frame);
    }
    // Redraw once when paused (camera moved, inputs changed, canvas re-attached).
    function refresh() {
      if (!m || !canvas.isConnected) return;
      if (raf) return;
      applyProgress();
      draw();
    }
    document.addEventListener('visibilitychange', start);
    if (root.ResizeObserver) new root.ResizeObserver(() => refresh()).observe(canvas);
    if (root.IntersectionObserver) {
      new root.IntersectionObserver(entries => {
        onScreen = entries[entries.length - 1].isIntersecting;
        start();
      }).observe(canvas);
    }

    // ---- Camera control: drag (mouse, pen, touch-sideways) or the buttons ----------------
    let drag = null;
    canvas.addEventListener('pointerdown', e => {
      drag = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', e => {
      if (!drag) return;
      orbit(-(e.clientX - drag.x) * 0.008, (e.clientY - drag.y) * 0.006);
      drag = { x: e.clientX, y: e.clientY };
    });
    const endDrag = () => { drag = null; };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    function orbit(dAz, dEl) {
      view.az += dAz;
      view.el = Math.min(1.35, Math.max(-0.15, view.el + dEl));
      refresh();
    }
    function zoom(factor) {
      view.zoom = Math.min(1.8, Math.max(0.55, view.zoom * factor));
      refresh();
    }
    function resetView() {
      view.az = 0.62;
      view.el = 0.5;
      view.zoom = 1;
      refresh();
    }

    // ---- Public interface ----------------------------------------------------------------
    function setMotion(next) {
      const rebuild = !m || next.radiusFinal !== m.radiusFinal;
      m = next;
      if (rebuild) {
        if (finished) {
          spindle.remove(finished);
          finished.geometry.dispose();
        }
        finished = axialCylinder(m.radiusFinal, 48, finishedMat, faceMat);
        spindle.add(finished);
      }
      bed.scale.x = m.length + 4.5;
      bed.position.x = m.length / 2 - 0.2;
      tailstock.position.x = m.length;
      refresh();
    }

    return {
      canvas,
      setMotion,
      play() { playing = true; start(); },
      pause() { playing = false; },
      isPlaying: () => playing,
      // Show a half-finished cut, used for the still picture in reduced-motion mode.
      showMidPass() { progress = 0.5; hold = 0; refresh(); },
      restart() { progress = 0; hold = 0; chips.forEach(c => { c.life = 0; c.mesh.visible = false; }); refresh(); },
      resume: start,
      orbit,
      zoom,
      resetView,
    };
  }

  root.MachinaLab = root.MachinaLab || {};
  root.MachinaLab.lathe3d = { supported, create };
})(typeof window !== 'undefined' ? window : globalThis);
