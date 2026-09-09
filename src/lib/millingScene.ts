import * as THREE from "three";
import { clampProgress, phase, smoothPhase } from "./millingProgress";

/** Deterministic, scroll-sampled scene. No clock, physics accumulation, or render loop. */
export function createMillingScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 768 ? 1 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = window.innerWidth >= 768;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#d9cbb5");
  scene.fog = new THREE.FogExp2("#d9cbb5", 0.024);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 90);
  const resources = new Set<{ dispose(): void }>();
  const keep = <T extends { dispose(): void }>(resource: T): T => { resources.add(resource); return resource; };
  let seed = 1974;
  const random = () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };

  function texture(kind: "stone" | "jute" | "wood" | "label") {
    const surface = document.createElement("canvas");
    surface.width = surface.height = 512;
    const ctx = surface.getContext("2d")!;
    ctx.fillStyle = { stone: "#898278", jute: "#ba945c", wood: "#63442a", label: "#e6d5ac" }[kind];
    ctx.fillRect(0, 0, 512, 512);
    if (kind === "label") {
      ctx.strokeStyle = "#284a37";
      ctx.lineWidth = 6;
      ctx.strokeRect(24, 24, 464, 464);
      ctx.fillStyle = "#284a37";
      ctx.textAlign = "center";
      ctx.font = "bold 58px Georgia";
      ctx.fillText("BABAY DEE", 256, 127);
      ctx.font = "24px Georgia";
      ctx.fillText("ATTA CHAKKI", 256, 168);
      ctx.beginPath(); ctx.moveTo(256, 324); ctx.lineTo(256, 202); ctx.stroke();
      for (let i = 0; i < 5; i++) {
        for (const side of [-1, 1]) {
          ctx.beginPath(); ctx.ellipse(256 + side * 18, 217 + i * 20, 19, 7, side * -0.6, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.font = "bold 32px Georgia"; ctx.fillText("STONE GROUND", 256, 387);
      ctx.font = "22px Georgia"; ctx.fillText("WHOLE WHEAT FLOUR", 256, 431);
    } else if (kind === "stone") {
      for (let i = 0; i < 32000; i++) {
        const tone = Math.floor(50 + random() * 150);
        ctx.fillStyle = `rgba(${tone},${tone - 5},${tone - 12},${0.15 + random() * 0.5})`;
        ctx.fillRect(random() * 512, random() * 512, 1 + random() * 3, 1 + random() * 3);
      }
    } else if (kind === "jute") {
      for (let i = 0; i < 512; i += 4) {
        ctx.fillStyle = i % 8 ? "#a27e4d" : "#d0ad76";
        ctx.fillRect(i, 0, 1.5, 512);
        ctx.fillStyle = "rgba(71,47,25,.24)";
        ctx.fillRect(0, i, 512, 1.5);
      }
    } else {
      for (let i = 0; i < 240; i++) {
        ctx.strokeStyle = `rgba(29,15,6,${random() * 0.4})`;
        ctx.lineWidth = random() * 3;
        ctx.beginPath(); const x = random() * 512; ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + 35, 170, x - 25, 340, x + 10, 512); ctx.stroke();
      }
    }
    const result = keep(new THREE.CanvasTexture(surface));
    result.colorSpace = THREE.SRGBColorSpace;
    result.wrapS = result.wrapT = THREE.RepeatWrapping;
    if (kind === "jute") result.repeat.set(3, 2);
    result.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    return result;
  }

  const stoneMap = texture("stone");
  const juteMap = texture("jute");
  const woodMap = texture("wood");
  const material = (color: string, roughness = 0.85) => keep(new THREE.MeshStandardMaterial({ color, roughness }));
  const stone = keep(new THREE.MeshStandardMaterial({ map: stoneMap, bumpMap: stoneMap, bumpScale: 0.045, roughness: 0.97 }));
  const jute = keep(new THREE.MeshStandardMaterial({ map: juteMap, bumpMap: juteMap, bumpScale: 0.025, roughness: 1, side: THREE.DoubleSide }));
  const wood = keep(new THREE.MeshStandardMaterial({ map: woodMap, roughness: 0.76 }));
  const flourMaterial = material("#fff0ce");
  const brass = material("#9f793d", 0.38); brass.metalness = 0.65;
  const green = material("#294d3a", 0.55);
  const dark = material("#27251f");
  const skin = material("#ac7b53");
  const cream = material("#ede0c8");
  const mesh = (geometry: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    const object = new THREE.Mesh(keep(geometry), mat);
    object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  };
  const box = (w: number, h: number, d: number, mat: THREE.Material, parent: THREE.Object3D, x: number, y: number, z = 0) => mesh(new THREE.BoxGeometry(w, h, d), mat, parent, x, y, z);
  const cylinder = (r: number, h: number, mat: THREE.Material, parent: THREE.Object3D, x: number, y: number, z = 0) => mesh(new THREE.CylinderGeometry(r, r, h, 64), mat, parent, x, y, z);
  const ring = (r: number, thickness: number, mat: THREE.Material, parent: THREE.Object3D, y: number) => {
    const object = mesh(new THREE.TorusGeometry(r, thickness, 10, 80), mat, parent, 0, y);
    object.rotation.x = Math.PI / 2; return object;
  };

  scene.add(new THREE.HemisphereLight("#fff0d5", "#78614a", 1.15));
  const sun = new THREE.DirectionalLight("#ffe0a3", 3.4);
  sun.position.set(-4, 10, 5); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 1024);
  Object.assign(sun.shadow.camera, { left: -8, right: 26, top: 8, bottom: -8, far: 40 });
  sun.shadow.bias = -0.001;
  scene.add(sun);
  const rim = new THREE.DirectionalLight("#fff5df", 2.3); rim.position.set(8, 5, -4); scene.add(rim);
  const floor = mesh(new THREE.PlaneGeometry(100, 70), material("#c8b390"), scene, 10, -0.12);
  floor.rotation.x = -Math.PI / 2;

  // Natural two-stone chakki with a real feed opening and carved radial furrows.
  const mill = new THREE.Group(); mill.position.y = 1; scene.add(mill);
  cylinder(1.8, 0.18, wood, mill, 0, 0.18);
  for (const x of [-1.05, 1.05]) for (const z of [-0.75, 0.75]) box(0.22, 1.25, 0.22, wood, mill, x, -0.48, z);
  cylinder(1.4, 0.48, stone, mill, 0, 0.54);
  cylinder(1.5, 0.06, flourMaterial, mill, 0, 0.79);
  const rotor = new THREE.Group(); rotor.position.y = 0.85; mill.add(rotor);
  const rotorProfile = [[0.23, 0], [1.28, 0], [1.32, 0.04], [1.32, 0.4], [1.26, 0.47], [0.23, 0.47], [0.23, 0]].map(([r, y]) => new THREE.Vector2(r, y));
  mesh(new THREE.LatheGeometry(rotorProfile, 96), stone, rotor);
  ring(1.325, 0.026, brass, rotor, 0.12);
  ring(1.325, 0.025, brass, rotor, 0.34);
  cylinder(0.055, 0.5, wood, rotor, 1.05, 0.63);
  const groovePoints: number[] = [];
  for (let i = 0; i < 32; i++) {
    const angle = i / 32 * Math.PI * 2;
    groovePoints.push(Math.cos(angle) * 0.32, 0.475, Math.sin(angle) * 0.32, Math.cos(angle + 0.13) * 1.24, 0.475, Math.sin(angle + 0.13) * 1.24);
  }
  const grooves = keep(new THREE.BufferGeometry()); grooves.setAttribute("position", new THREE.Float32BufferAttribute(groovePoints, 3));
  rotor.add(new THREE.LineSegments(grooves, keep(new THREE.LineBasicMaterial({ color: "#554c3e", transparent: true, opacity: 0.55 }))));
  const hopper = mesh(new THREE.CylinderGeometry(0.62, 0.13, 0.7, 48, 1, true), wood, mill, 0, 2.45);
  hopper.material = keep(new THREE.MeshStandardMaterial({ map: woodMap, side: THREE.DoubleSide }));
  box(0.08, 1.9, 0.08, wood, mill, -0.6, 1.65, -0.45);
  box(0.08, 1.9, 0.08, wood, mill, 0.6, 1.65, -0.45);
  const chute = box(2.05, 0.08, 0.48, wood, mill, 1.65, 0.6, 0);
  chute.rotation.z = -0.12;
  for (const z of [-0.26, 0.26]) { const edge = box(2.05, 0.22, 0.05, wood, mill, 1.65, 0.69, z); edge.rotation.z = -0.12; }

  const grainCount = window.innerWidth < 768 ? 100 : 180;
  const grainGeometry = keep(new THREE.SphereGeometry(1, 10, 7));
  const grains = new THREE.InstancedMesh(grainGeometry, material("#c38a2e", 0.65), grainCount);
  const flour = new THREE.InstancedMesh(keep(new THREE.SphereGeometry(1, 5, 4)), flourMaterial, grainCount);
  scene.add(grains, flour); grains.castShadow = true;
  const particles = Array.from({ length: grainCount }, () => ({ a: random() * Math.PI * 2, r: random(), offset: random(), size: 0.65 + random() * 0.6 }));
  const dummy = new THREE.Object3D();

  function makeSack() {
    const group = new THREE.Group();
    const profile = [[0.04, 0], [0.38, 0.02], [0.51, 0.15], [0.56, 0.55], [0.48, 1.06], [0.34, 1.28], [0.36, 1.4]].map(([r, y]) => new THREE.Vector2(r, y));
    const bodyGeometry = new THREE.LatheGeometry(profile, 64);
    const positions = bodyGeometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      const theta = Math.atan2(z, x);
      const fold = 1 + Math.sin(theta * 12 + y * 3) * 0.035 + Math.sin(theta * 21) * 0.014;
      positions.setXYZ(i, x * fold, y, z * fold * 0.82);
    }
    bodyGeometry.computeVertexNormals();
    mesh(bodyGeometry, jute, group);
    const label = mesh(new THREE.PlaneGeometry(0.64, 0.64), keep(new THREE.MeshStandardMaterial({ map: texture("label"), roughness: 1 })), group, 0, 0.71, 0.48);
    label.rotation.x = -0.03;
    const fill = cylinder(0.325, 0.09, flourMaterial, group, 0, 1.22); fill.scale.z = 0.8;
    const neck = mesh(new THREE.CylinderGeometry(0.2, 0.1, 0.24, 32, 1, true), jute, group, 0, 1.49);
    const tie = ring(0.125, 0.027, wood, group, 1.4);
    neck.visible = tie.visible = false;
    return { group, fill, neck, tie };
  }
  const sack = makeSack(); scene.add(sack.group);

  const truck = new THREE.Group(); scene.add(truck);
  box(2.9, 0.24, 1.35, green, truck, 0, 0.62);
  box(1.0, 1.05, 1.3, green, truck, 0.95, 1.18);
  const glass = material("#506d6c", 0.25); glass.metalness = 0.25;
  box(0.7, 0.49, 1.32, glass, truck, 0.92, 1.42);
  box(0.08, 0.54, 1.2, glass, truck, 1.47, 1.42);
  box(1.15, 0.12, 1.45, green, truck, 0.96, 1.78);
  box(0.18, 0.15, 1.45, brass, truck, 1.5, 0.63);
  for (const z of [-0.69, 0.69]) box(1.7, 0.4, 0.07, wood, truck, -0.6, 0.95, z);
  const wheels: THREE.Mesh[] = [];
  for (const x of [-0.95, 0.94]) for (const z of [-0.73, 0.73]) {
    const wheel = cylinder(0.36, 0.2, dark, truck, x, 0.36, z); wheel.rotation.x = Math.PI / 2; wheels.push(wheel);
    const hub = cylinder(0.16, 0.215, brass, truck, x, 0.36, z); hub.rotation.x = Math.PI / 2;
  }
  // Store set and a customer receiving the same sack before placing it on the shelf.
  const store = new THREE.Group(); store.position.x = 20; scene.add(store);
  box(7, 4.8, 0.18, cream, store, 0, 2.2, -1.9);
  for (const x of [-2.5, 2.5]) box(0.14, 3.6, 1.2, wood, store, x, 1.8, -0.6);
  for (const y of [0.18, 1.35, 3.2]) box(5.2, 0.14, 1.2, wood, store, 0, y, -0.6);
  box(5.6, 0.32, 1.6, green, store, 0, 4, -0.65);
  for (const x of [-1.8, 1.8]) {
    const bag = makeSack(); bag.group.position.set(x, 1.43, -0.6); bag.neck.visible = bag.tie.visible = true; store.add(bag.group);
  }
  for (const x of [-1.9, -0.65, 0.65, 1.9]) {
    const bag = makeSack(); bag.group.position.set(x, 0.25, -0.6); bag.group.scale.setScalar(0.68); bag.neck.visible = bag.tie.visible = true; store.add(bag.group);
  }
  function person(x: number, z: number, clothing: THREE.Material) {
    const group = new THREE.Group(); group.position.set(x, 0, z); scene.add(group);
    mesh(new THREE.CapsuleGeometry(0.28, 0.55, 6, 16), clothing, group, 0, 1.05);
    mesh(new THREE.SphereGeometry(0.19, 20, 16), skin, group, 0, 1.85);
    for (const side of [-1, 1]) {
      mesh(new THREE.CapsuleGeometry(0.1, 0.58, 4, 12), clothing, group, side * 0.15, 0.41);
      const arm = mesh(new THREE.CapsuleGeometry(0.075, 0.53, 4, 12), clothing, group, side * 0.3, 1.22, 0.26);
      arm.rotation.x = -0.9;
      mesh(new THREE.SphereGeometry(0.085, 12, 8), skin, group, side * 0.3, 1.07, 0.52);
    }
    return group;
  }
  const courier = person(16.8, 1.7, green);
  const customer = person(19.1, 1.4, cream);

  const target = new THREE.Vector3();
  const cameraKeys = [
    { p: 0, x: 0, y: 3.3, z: 0, distance: 7 },
    { p: 0.23, x: 0, y: 2.1, z: 0, distance: 8.5 },
    { p: 0.4, x: 0.6, y: 1.8, z: 0, distance: 9.5 },
    { p: 0.57, x: 2.8, y: 0.9, z: 0, distance: 7.5 },
    { p: 0.67, x: 5, y: 1.15, z: 0, distance: 10 },
    { p: 0.79, x: 17.5, y: 1.25, z: 0.5, distance: 10 },
    { p: 0.9, x: 19.2, y: 1.5, z: 0.2, distance: 8.5 },
    { p: 1, x: 20, y: 2, z: -0.3, distance: 8 },
  ];

  return {
    resize(width: number, height: number) {
      renderer.setSize(Math.max(1, width), Math.max(1, height), false);
      camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix();
    },
    render(value: number) {
      const p = clampProgress(value);
      rotor.rotation.y = p * Math.PI * 22;
      const grainFlow = phase(p, 0, 0.43);
      grains.visible = p < 0.45;
      flour.visible = p > 0.16 && p < 0.58;
      particles.forEach((particle, i) => {
        const t = (particle.offset + grainFlow * 4) % 1;
        const spread = (1 - smoothPhase(p, 0.06, 0.22)) * 1.2 + 0.13;
        dummy.position.set(Math.cos(particle.a) * spread * particle.r, 2.35 + (1 - t) * 3.8, Math.sin(particle.a) * spread * particle.r);
        dummy.rotation.set(p * 8 + particle.a, particle.a, p * 5);
        dummy.scale.set(0.056 * particle.size, 0.125 * particle.size, 0.045 * particle.size);
        dummy.updateMatrix(); grains.setMatrixAt(i, dummy.matrix);
        const f = (particle.offset + p * 9) % 1;
        dummy.position.set(0.9 + Math.min(1, f / 0.8) * 2.03, 1.8 - f * 0.34 - Math.max(0, f - 0.8) * 4 + Math.sin(particle.a) * 0.04, Math.cos(particle.a) * 0.17);
        dummy.scale.setScalar(0.015 * particle.size); dummy.updateMatrix(); flour.setMatrixAt(i, dummy.matrix);
      });
      grains.instanceMatrix.needsUpdate = flour.instanceMatrix.needsUpdate = true;

      const filled = smoothPhase(p, 0.39, 0.55);
      sack.group.scale.set(0.72 + filled * 0.28, 0.22 + filled * 0.78, 0.72 + filled * 0.28);
      sack.group.position.set(2.95, 0, 0);
      sack.fill.position.y = 0.42 + filled * 0.8;
      sack.fill.visible = p < 0.57;
      sack.neck.visible = sack.tie.visible = p >= 0.57;
      sack.group.rotation.set(0, 0.15, 0);
      const loaded = smoothPhase(p, 0.58, 0.65);
      const travel = smoothPhase(p, 0.65, 0.79);
      truck.position.x = 5 + travel * 12;
      truck.visible = p >= 0.56 && p < 0.96;
      wheels.forEach((wheel) => { wheel.rotation.y = travel * -32; });
      if (p >= 0.58) {
        sack.group.position.set(THREE.MathUtils.lerp(2.95, truck.position.x - 0.5, loaded), loaded * 0.8 + Math.sin(loaded * Math.PI) * 0.7, 0);
      }
      const handoff = smoothPhase(p, 0.79, 0.88);
      if (p >= 0.79) {
        sack.group.position.set(THREE.MathUtils.lerp(16.5, 19.1, handoff), 0.8 + Math.sin(handoff * Math.PI) * 0.24, handoff * 1.9);
      }
      const shelved = smoothPhase(p, 0.88, 0.98);
      if (p >= 0.88) {
        sack.group.position.set(THREE.MathUtils.lerp(19.1, 20, shelved), THREE.MathUtils.lerp(0.8, 1.43, shelved) + Math.sin(shelved * Math.PI) * 0.2, THREE.MathUtils.lerp(1.9, -0.4, shelved));
        sack.group.rotation.y = 0.15 * (1 - shelved);
      }
      courier.visible = customer.visible = p >= 0.76 && p < 0.97;
      customer.position.x = 19.1 + shelved * 0.9;
      customer.position.z = 1.4 - shelved * 1.9;
      mill.visible = p < 0.7; store.visible = p > 0.65;

      const index = Math.max(0, cameraKeys.findIndex((key) => key.p >= p) - 1);
      const a = cameraKeys[index], b = cameraKeys[index + 1];
      const t = smoothPhase(p, a.p, b.p);
      target.set(THREE.MathUtils.lerp(a.x, b.x, t), THREE.MathUtils.lerp(a.y, b.y, t), THREE.MathUtils.lerp(a.z, b.z, t));
      const distance = THREE.MathUtils.lerp(a.distance, b.distance, t) * (camera.aspect < 1 ? 1.55 : 1);
      const orbit = -0.2 + p * 0.5;
      camera.position.set(target.x + Math.sin(orbit) * distance, target.y + distance * 0.38, target.z + Math.cos(orbit) * distance);
      camera.lookAt(target);
      renderer.render(scene, camera);
    },
    dispose() {
      resources.forEach((resource) => resource.dispose());
      grains.dispose(); flour.dispose();
      sun.shadow.dispose();
      renderer.dispose();
      scene.clear();
    },
  };
}
