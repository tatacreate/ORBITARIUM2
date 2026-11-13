import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { getCatalogParts } from '../engine/physics';
import type { CameraPreset, CelestialBodyId, MissionConfig, SubsystemTab } from '../types/mission';
import {
  createContactShadowTexture,
  createHullPlatingTexture,
  createKaptonTextures,
  createPlanetTexture,
  createSolarPanelTexture,
} from './proceduralTextures';

interface SpacecraftSceneProps {
  config: MissionConfig;
  sceneMode: 'title' | 'hangar' | 'planner' | 'orbit';
  explodeAmount: number; // 0..1
  cameraPreset: CameraPreset;
  cameraPresetNonce: number;
  simProgress: number; // 0..1 during orbit simulation
  onSelectSubsystem?: (tab: SubsystemTab) => void;
}

// Pre-allocated scratch math helpers (Zero GC in rAF loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _targetCamPos = new THREE.Vector3();
const _targetLook = new THREE.Vector3();
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

function disposeGroupResources(group: THREE.Object3D) {
  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      mesh.geometry.dispose();
    }
  });
}

function tagInteractive(obj: THREE.Object3D, subsystem: SubsystemTab) {
  obj.traverse((child) => {
    child.userData.subsystemTab = subsystem;
    if ((child as THREE.Mesh).isMesh) {
      child.layers.enable(1);
    }
  });
}

export function SpacecraftScene({
  config,
  sceneMode,
  explodeAmount,
  cameraPreset,
  cameraPresetNonce,
  simProgress,
  onSelectSubsystem,
}: SpacecraftSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglError, setWebglError] = useState(false);

  const stateRef = useRef({
    config,
    sceneMode,
    explodeAmount,
    cameraPreset,
    simProgress,
    onSelectSubsystem,
  });
  stateRef.current = {
    config,
    sceneMode,
    explodeAmount,
    cameraPreset,
    simProgress,
    onSelectSubsystem,
  };

  const camTransitionRef = useRef({
    active: false,
    preset: cameraPreset,
    mode: sceneMode,
  });

  useEffect(() => {
    camTransitionRef.current = {
      active: true,
      preset: cameraPreset,
      mode: sceneMode,
    };
  }, [cameraPreset, cameraPresetNonce, sceneMode]);

  const rebuildRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    rebuildRef.current?.();
  }, [
    config.busId,
    config.propulsionId,
    config.powerId,
    config.commsId,
    config.shieldingId,
    config.launchVehicleId,
    config.solarSizing,
    config.propellantRatio,
    config.orbitId,
    config.objectiveId,
    config.modelMode,
    config.instrumentIds.join(','),
  ]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software WebGL Guard
    const isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError(true);
      return;
    }

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    // 2. Scene, Fog & Studio Environment
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050811);
    scene.fog = new THREE.FogExp2(0x050811, 0.0085);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 320);
    camera.position.set(6.2, 3.4, 7.6);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 3.0;
    controls.maxDistance = 30;
    controls.maxPolarAngle = Math.PI * 0.88;
    controls.target.set(0, 0.7, 0);
    controls.addEventListener('start', () => {
      camTransitionRef.current.active = false;
    });

    // 3. Balanced 3-Point Warm/Cool Studio Lighting
    const hemiLight = new THREE.HemisphereLight(0x8ecae6, 0x0f172a, 0.7);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.35);
    keyLight.position.set(7, 10, 6);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 30;
    keyLight.shadow.camera.left = -6;
    keyLight.shadow.camera.right = 6;
    keyLight.shadow.camera.top = 6;
    keyLight.shadow.camera.bottom = -6;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    rimLight.position.set(-7, 4, -8);
    scene.add(rimLight);

    // 4. Procedural Materials & Textures
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const kapton = createKaptonTextures(maxAniso);
    const solarTex = createSolarPanelTexture(maxAniso);
    const hullTex = createHullPlatingTexture(maxAniso);
    const contactTex = createContactShadowTexture();

    const matKapton = new THREE.MeshStandardMaterial({
      map: kapton.map,
      bumpMap: kapton.bumpMap,
      bumpScale: 0.035,
      metalness: 0.88,
      roughness: 0.34,
    });

    const matHull = new THREE.MeshStandardMaterial({
      map: hullTex,
      color: 0xdbe4ee,
      metalness: 0.72,
      roughness: 0.28,
    });

    const matDarkCarbon = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.35,
      roughness: 0.68,
    });

    const matSolarCell = new THREE.MeshPhysicalMaterial({
      map: solarTex,
      metalness: 0.25,
      roughness: 0.16,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
    });

    const matNozzle = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.92,
      roughness: 0.22,
      side: THREE.DoubleSide,
    });

    const matDish = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      metalness: 0.45,
      roughness: 0.32,
      side: THREE.DoubleSide,
    });

    const matAccentCyan = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.95,
      metalness: 0.5,
      roughness: 0.25,
    });

    const matIonGlow = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 2.2,
      metalness: 0.1,
      roughness: 0.2,
    });

    const matFlame = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });

    const matLens = new THREE.MeshPhysicalMaterial({
      color: 0x0e7490,
      metalness: 0.1,
      roughness: 0.05,
      clearcoat: 1.0,
      transmission: isSoftwareGl ? 0 : 0.72,
      transparent: isSoftwareGl,
      opacity: isSoftwareGl ? 0.7 : 1,
      ior: 1.6,
    });

    const matRtgGlow = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 1.2,
      metalness: 0.55,
      roughness: 0.35,
    });

    // 5. Starfield InstancedMesh (900 stars)
    const starCount = 900;
    const starGeo = new THREE.OctahedronGeometry(0.11, 0);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const starField = new THREE.InstancedMesh(starGeo, starMat, starCount);
    let seed = 9182;
    const srand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < starCount; i++) {
      const theta = srand() * Math.PI * 2;
      const phi = Math.acos(2 * srand() - 1);
      const r = 65 + srand() * 95;
      _dummy.position.set(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
      );
      const s = 0.4 + srand() * 1.4;
      _dummy.scale.setScalar(s);
      _dummy.updateMatrix();
      starField.setMatrixAt(i, _dummy.matrix);
      const tint = srand();
      if (tint < 0.2) _color.setHex(0x93c5fd);
      else if (tint < 0.35) _color.setHex(0xfde68a);
      else _color.setHex(0xf8fafc);
      starField.setColorAt(i, _color);
    }
    starField.instanceMatrix.needsUpdate = true;
    if (starField.instanceColor) starField.instanceColor.needsUpdate = true;
    starField.computeBoundingSphere();
    scene.add(starField);

    // 6. Hangar Calibration Platform & Contact Shadow
    const hangarGroup = new THREE.Group();
    const deckGeo = new THREE.CylinderGeometry(3.9, 4.15, 0.16, 48);
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.65,
      roughness: 0.48,
    });
    const deckMesh = new THREE.Mesh(deckGeo, deckMat);
    deckMesh.position.y = -1.65;
    deckMesh.receiveShadow = true;
    hangarGroup.add(deckMesh);

    const ringGeo = new THREE.RingGeometry(3.35, 3.44, 64);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.48,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = -1.56;
    hangarGroup.add(ringMesh);

    const innerRingGeo = new THREE.RingGeometry(1.9, 1.94, 48);
    innerRingGeo.rotateX(-Math.PI / 2);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0x64748b,
      transparent: true,
      opacity: 0.35,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.position.y = -1.555;
    hangarGroup.add(innerRing);

    const shadowGeo = new THREE.PlaneGeometry(5.6, 5.6);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: contactTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.62,
    });
    const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    contactShadow.position.y = -1.55;
    hangarGroup.add(contactShadow);
    scene.add(hangarGroup);

    // 7. Orbital Simulation Planet & Glowing Trajectory Ring
    const orbitGroup = new THREE.Group();
    orbitGroup.visible = false;
    scene.add(orbitGroup);

    const planetCache = new Map<CelestialBodyId, THREE.CanvasTexture>();
    const planetGeo = new THREE.SphereGeometry(5.2, 48, 32);
    const planetMat = new THREE.MeshStandardMaterial({
      roughness: 0.72,
      metalness: 0.08,
    });
    const planetMesh = new THREE.Mesh(planetGeo, planetMat);
    planetMesh.position.set(0, -1.5, -10.5);
    planetMesh.receiveShadow = true;
    orbitGroup.add(planetMesh);

    const atmoGeo = new THREE.SphereGeometry(5.48, 40, 28);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.14,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    atmoMesh.position.copy(planetMesh.position);
    orbitGroup.add(atmoMesh);

    const orbitRadius = 9.4;
    const orbitCurvePts: THREE.Vector3[] = [];
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      orbitCurvePts.push(
        new THREE.Vector3(
          Math.cos(a) * orbitRadius,
          Math.sin(a) * 1.4 - 1.5,
          Math.sin(a) * orbitRadius - 10.5,
        ),
      );
    }
    const orbitCurve = new THREE.CatmullRomCurve3(orbitCurvePts, true);
    const orbitTubeGeo = new THREE.TubeGeometry(orbitCurve, 96, 0.036, 6, true);
    const orbitTubeMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.55,
    });
    const orbitTube = new THREE.Mesh(orbitTubeGeo, orbitTubeMat);
    orbitGroup.add(orbitTube);

    // Glowing trail spheres behind spacecraft along trajectory
    const trailCount = 24;
    const trailGeo = new THREE.SphereGeometry(0.075, 8, 8);
    const trailMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    const trailNodes = new THREE.InstancedMesh(trailGeo, trailMat, trailCount);
    trailNodes.frustumCulled = false;
    orbitGroup.add(trailNodes);

    // Thruster / Rocket Plume InstancedMesh (48 particles)
    const plumeCount = 48;
    const plumeGeo = new THREE.SphereGeometry(0.09, 8, 8);
    const plumeMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const plumeParticles = new THREE.InstancedMesh(plumeGeo, plumeMat, plumeCount);
    plumeParticles.frustumCulled = false;
    orbitGroup.add(plumeParticles);

    // 7B. Animated Launch Rocket Stack (Stage 1 + Fairing Separation during simProgress < 0.22)
    const rocketGroup = new THREE.Group();
    rocketGroup.visible = false;
    orbitGroup.add(rocketGroup);

    const rocketBodyGeo = new THREE.CylinderGeometry(0.42, 0.48, 3.6, 20);
    const rocketBody = new THREE.Mesh(rocketBodyGeo, matHull);
    rocketBody.position.y = -0.3;
    rocketGroup.add(rocketBody);

    const rocketInterstageGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.35, 20);
    const rocketInterstage = new THREE.Mesh(rocketInterstageGeo, matDarkCarbon);
    rocketInterstage.position.y = 1.55;
    rocketGroup.add(rocketInterstage);

    const rocketNozzleGeo = new THREE.CylinderGeometry(0.18, 0.34, 0.45, 16);
    const rocketNozzle = new THREE.Mesh(rocketNozzleGeo, matNozzle);
    rocketNozzle.position.y = -2.3;
    rocketGroup.add(rocketNozzle);

    const rocketFlameGeo = new THREE.ConeGeometry(0.32, 1.4, 14);
    rocketFlameGeo.rotateX(Math.PI);
    const rocketFlame = new THREE.Mesh(rocketFlameGeo, matFlame);
    rocketFlame.position.y = -3.15;
    rocketGroup.add(rocketFlame);

    // Fairing Halves that peel open during fairing separation (simProgress 0.14..0.22)
    const fairingLeftGeo = new THREE.CylinderGeometry(0.12, 0.44, 1.35, 16, 1, false, 0, Math.PI);
    const fairingRightGeo = new THREE.CylinderGeometry(0.12, 0.44, 1.35, 16, 1, false, Math.PI, Math.PI);
    const fairingLeft = new THREE.Mesh(fairingLeftGeo, matDish);
    const fairingRight = new THREE.Mesh(fairingRightGeo, matDish);
    fairingLeft.position.set(0, 2.38, 0);
    fairingRight.position.set(0, 2.38, 0);
    rocketGroup.add(fairingLeft, fairingRight);

    // 8. Composite Procedural Spacecraft Assembly Root
    const craftRoot = new THREE.Group();
    craftRoot.position.y = 0.85;
    scene.add(craftRoot);

    const subGroups = {
      bus: new THREE.Group(),
      propulsion: new THREE.Group(),
      powerLeft: new THREE.Group(),
      powerRight: new THREE.Group(),
      comms: new THREE.Group(),
      shielding: new THREE.Group(),
      payload: new THREE.Group(),
    };

    Object.values(subGroups).forEach((g) => craftRoot.add(g));

    const explodeCurrent = { val: 0 };

    const rebuildSpacecraft = () => {
      const cfg = stateRef.current.config;
      const { bus, propulsion, power, comms, shielding, instruments, orbit, modelMode, launchVehicle } =
        getCatalogParts(cfg);
      const isRealistic = modelMode === 'realistic';

      // Rocket scale tint based on chosen launch vehicle
      const rocketScale =
        launchVehicle.id === 'electron-light'
          ? 0.72
          : launchVehicle.id === 'falcon-med'
            ? 0.96
            : launchVehicle.id === 'vulcan-heavy'
              ? 1.12
              : 1.28;
      rocketGroup.scale.setScalar(rocketScale);

      // Update Planet texture for Orbit mode
      let pTex = planetCache.get(orbit.body);
      if (!pTex) {
        pTex = createPlanetTexture(orbit.body, maxAniso);
        planetCache.set(orbit.body, pTex);
      }
      planetMat.map = pTex;
      planetMat.metalness = orbit.body === 'psyche' ? 0.65 : 0.08;
      planetMat.roughness = orbit.body === 'psyche' ? 0.35 : 0.78;
      planetMat.needsUpdate = true;

      if (orbit.body === 'mars') atmoMat.color.setHex(0xfb923c);
      else if (orbit.body === 'europa') atmoMat.color.setHex(0xbae6fd);
      else if (orbit.body === 'earth') atmoMat.color.setHex(0x38bdf8);
      else atmoMat.color.setHex(0x94a3b8);
      atmoMat.opacity = orbit.body === 'moon' || orbit.body === 'psyche' ? 0.04 : 0.14;

      Object.values(subGroups).forEach((g) => {
        disposeGroupResources(g);
        g.clear();
      });

      // --- A. BUS & STRUCTURE ---
      const busRadius = bus.tier === 1 ? 0.56 : bus.tier === 2 ? 0.86 : 1.08;
      const busHeight = bus.tier === 1 ? 0.92 : bus.tier === 2 ? 1.24 : 1.56;
      const sides = bus.tier === 1 ? 4 : bus.tier === 2 ? 8 : 6;

      const coreGeo = new THREE.CylinderGeometry(busRadius, busRadius * 1.04, busHeight, sides);
      const coreMesh = new THREE.Mesh(coreGeo, matHull);
      coreMesh.castShadow = true;
      coreMesh.receiveShadow = true;
      subGroups.bus.add(coreMesh);

      const collarGeo = new THREE.CylinderGeometry(
        busRadius * 1.08,
        busRadius * 1.08,
        0.11,
        sides,
      );
      const topCollar = new THREE.Mesh(collarGeo, matDarkCarbon);
      topCollar.position.y = busHeight * 0.5 + 0.04;
      topCollar.castShadow = true;
      subGroups.bus.add(topCollar);

      const botCollar = new THREE.Mesh(collarGeo, matDarkCarbon);
      botCollar.position.y = -busHeight * 0.5 - 0.04;
      botCollar.castShadow = true;
      subGroups.bus.add(botCollar);

      if (isRealistic) {
        for (let i = 0; i < 2; i++) {
          const stGroup = new THREE.Group();
          const stTube = new THREE.Mesh(
            new THREE.CylinderGeometry(0.11, 0.075, 0.28, 12),
            matDarkCarbon,
          );
          const stLens = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 12), matLens);
          stLens.position.y = 0.13;
          stGroup.add(stTube, stLens);
          stGroup.position.set(
            i === 0 ? busRadius * 0.72 : -busRadius * 0.72,
            busHeight * 0.35,
            busRadius * 0.55,
          );
          stGroup.rotation.set(0.45, 0, i === 0 ? -0.4 : 0.4);
          subGroups.bus.add(stGroup);
        }
      }
      tagInteractive(subGroups.bus, 'bus');

      // --- B. THERMAL & RADIATION SHIELDING ---
      const wrapHeight = busHeight * 0.76;
      const wrapGeo = new THREE.CylinderGeometry(
        busRadius * 1.055,
        busRadius * 1.075,
        wrapHeight,
        sides,
      );
      const wrapMat =
        shielding.id === 'mli-standard' || shielding.id === 'aerogel-rad' ? matKapton : matHull;
      const wrapMesh = new THREE.Mesh(wrapGeo, wrapMat);
      wrapMesh.castShadow = true;
      subGroups.shielding.add(wrapMesh);

      if (shielding.id !== 'mli-standard' && isRealistic) {
        const finCount = shielding.id === 'cryo-radiator' ? 6 : 4;
        for (let i = 0; i < finCount; i++) {
          const angle = (i / finCount) * Math.PI * 2;
          const fin = new THREE.Mesh(
            new THREE.BoxGeometry(
              0.08,
              busHeight * 0.65,
              shielding.id === 'cryo-radiator' ? 0.36 : 0.18,
            ),
            shielding.id === 'cryo-radiator' ? matAccentCyan : matDarkCarbon,
          );
          fin.position.set(
            Math.cos(angle) * (busRadius * 1.12),
            0,
            Math.sin(angle) * (busRadius * 1.12),
          );
          fin.rotation.y = -angle + Math.PI / 2;
          fin.castShadow = true;
          subGroups.shielding.add(fin);
        }
      }
      tagInteractive(subGroups.shielding, 'bus');

      // --- C. PROPULSION SYSTEM ---
      const tankScale = 0.75 + cfg.propellantRatio * 0.3;
      const tankR = busRadius * 0.28 * tankScale;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const tank = new THREE.Mesh(new THREE.SphereGeometry(tankR, 16, 14), matHull);
        tank.position.set(
          Math.cos(a) * busRadius * 0.62,
          -busHeight * 0.62,
          Math.sin(a) * busRadius * 0.62,
        );
        tank.castShadow = true;
        subGroups.propulsion.add(tank);
      }

      if (propulsion.electricPropulsion) {
        const ionHousing = new THREE.Mesh(
          new THREE.CylinderGeometry(busRadius * 0.48, busRadius * 0.56, 0.26, 24),
          matDarkCarbon,
        );
        ionHousing.position.y = -busHeight * 0.5 - 0.22;
        const ionChannel = new THREE.Mesh(
          new THREE.TorusGeometry(busRadius * 0.34, 0.07, 12, 32),
          matIonGlow,
        );
        ionChannel.rotation.x = Math.PI / 2;
        ionChannel.position.y = -busHeight * 0.5 - 0.36;
        subGroups.propulsion.add(ionHousing, ionChannel);
      } else {
        const bellScale = propulsion.id === 'biprop-hyper' ? 1.25 : 0.85;
        const bellPts = [
          new THREE.Vector2(0.08 * bellScale, 0.0),
          new THREE.Vector2(0.14 * bellScale, -0.1),
          new THREE.Vector2(0.28 * bellScale, -0.35),
          new THREE.Vector2(0.36 * bellScale, -0.64),
        ];
        const bellGeo = new THREE.LatheGeometry(bellPts, 28);
        const bellMesh = new THREE.Mesh(bellGeo, matNozzle);
        bellMesh.position.y = -busHeight * 0.5 - 0.12;
        bellMesh.castShadow = true;
        subGroups.propulsion.add(bellMesh);
      }

      if (isRealistic) {
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          const rcsPod = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.18), matDarkCarbon);
          rcsPod.position.set(
            Math.cos(a) * (busRadius + 0.12),
            -busHeight * 0.38,
            Math.sin(a) * (busRadius + 0.12),
          );
          rcsPod.rotation.y = -a;
          subGroups.propulsion.add(rcsPod);
        }
      }
      tagInteractive(subGroups.propulsion, 'bus');

      // --- D. POWER SYSTEM ---
      if (power.kind === 'solar') {
        const wingLen = (power.id === 'ultraflex-array' ? 2.55 : 1.95) * cfg.solarSizing;
        const wingW = power.id === 'ultraflex-array' ? 1.05 : 0.78;
        const makeWing = (side: -1 | 1) => {
          const wg = new THREE.Group();
          const gimbal = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1, 0.1, 0.36, 12),
            matDarkCarbon,
          );
          gimbal.rotation.z = Math.PI / 2;
          gimbal.position.x = side * (busRadius + 0.18);
          wg.add(gimbal);

          const boom = new THREE.Mesh(
            new THREE.CylinderGeometry(0.035, 0.035, wingLen + 0.35, 8),
            matHull,
          );
          boom.rotation.z = Math.PI / 2;
          boom.position.x = side * (busRadius + 0.3 + wingLen * 0.5);
          wg.add(boom);

          if (power.id === 'ultraflex-array') {
            const disk = new THREE.Mesh(
              new THREE.CylinderGeometry(wingLen * 0.48, wingLen * 0.48, 0.035, 16),
              matSolarCell,
            );
            disk.position.x = side * (busRadius + 0.45 + wingLen * 0.48);
            disk.castShadow = true;
            disk.receiveShadow = true;
            wg.add(disk);
          } else {
            const panel = new THREE.Mesh(
              new THREE.BoxGeometry(wingLen, 0.04, wingW),
              matSolarCell,
            );
            panel.position.x = side * (busRadius + 0.38 + wingLen * 0.5);
            panel.castShadow = true;
            panel.receiveShadow = true;
            wg.add(panel);

            const frame = new THREE.Mesh(
              new THREE.BoxGeometry(wingLen + 0.04, 0.025, wingW + 0.04),
              matDarkCarbon,
            );
            frame.position.copy(panel.position);
            frame.position.y -= 0.025;
            wg.add(frame);
          }
          return wg;
        };
        subGroups.powerLeft.add(makeWing(-1));
        subGroups.powerRight.add(makeWing(1));
      } else {
        const rtgGroup = new THREE.Group();
        const rtgBody = new THREE.Mesh(
          new THREE.CylinderGeometry(0.24, 0.24, 1.05, 16),
          matDarkCarbon,
        );
        rtgBody.rotation.z = Math.PI / 2;
        rtgBody.position.x = busRadius + 0.65;
        rtgBody.castShadow = true;
        rtgGroup.add(rtgBody);

        for (let f = 0; f < 6; f++) {
          const a = (f / 6) * Math.PI * 2;
          const fin = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.03, 0.22), matRtgGlow);
          fin.position.set(busRadius + 0.65, Math.sin(a) * 0.28, Math.cos(a) * 0.28);
          fin.rotation.x = a;
          rtgGroup.add(fin);
        }
        subGroups.powerRight.add(rtgGroup);
      }
      tagInteractive(subGroups.powerLeft, 'power');
      tagInteractive(subGroups.powerRight, 'power');

      // --- E. COMMUNICATIONS DISH / LASER TURRET ---
      const commsY = busHeight * 0.5 + 0.14;
      if (comms.band === 'S-Band') {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.45, 10), matHull);
        mast.position.y = commsY + 0.22;
        const helix = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.16, 0.35, 12),
          matAccentCyan,
        );
        helix.position.y = commsY + 0.52;
        subGroups.comms.add(mast, helix);
      } else if (comms.band === 'Ka-Band') {
        const dishPts = [
          new THREE.Vector2(0.01, 0),
          new THREE.Vector2(0.35, 0.07),
          new THREE.Vector2(0.75, 0.22),
          new THREE.Vector2(1.05, 0.42),
        ];
        const dishGeo = new THREE.LatheGeometry(dishPts, 32);
        const dishMesh = new THREE.Mesh(dishGeo, matDish);
        dishMesh.position.y = commsY + 0.22;
        dishMesh.castShadow = true;
        subGroups.comms.add(dishMesh);

        const feedHorn = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.11, 0.24, 12),
          matDarkCarbon,
        );
        feedHorn.position.y = commsY + 0.78;
        subGroups.comms.add(feedHorn);

        for (let s = 0; s < 3; s++) {
          const a = (s / 3) * Math.PI * 2;
          const strutCurve = new THREE.LineCurve3(
            new THREE.Vector3(Math.cos(a) * 0.92, commsY + 0.56, Math.sin(a) * 0.92),
            new THREE.Vector3(0, commsY + 0.82, 0),
          );
          const strut = new THREE.Mesh(
            new THREE.TubeGeometry(strutCurve, 4, 0.018, 6, false),
            matHull,
          );
          subGroups.comms.add(strut);
        }
      } else {
        const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.32), matDarkCarbon);
        yoke.position.y = commsY + 0.22;
        const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.46, 20), matHull);
        turret.rotation.x = Math.PI / 3;
        turret.position.set(0, commsY + 0.42, 0.1);
        const optics = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 20), matLens);
        optics.rotation.x = Math.PI / 3;
        optics.position.set(0, commsY + 0.54, 0.29);
        subGroups.comms.add(yoke, turret, optics);
      }
      tagInteractive(subGroups.comms, 'power');

      // --- F. SCIENTIFIC INSTRUMENTS ---
      const mountRadius = busRadius + 0.16;
      instruments.forEach((inst, idx) => {
        const angle = (idx / Math.max(1, instruments.length)) * Math.PI * 2 + 0.4;
        const instGroup = new THREE.Group();
        instGroup.position.set(
          Math.cos(angle) * mountRadius,
          busHeight * 0.2,
          Math.sin(angle) * mountRadius,
        );
        instGroup.rotation.y = -angle;

        if (inst.id === 'multispec-cam' || inst.id === 'ir-sounder') {
          const barrel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.17, 0.19, 0.54, 16),
            matDarkCarbon,
          );
          barrel.rotation.z = Math.PI / 2;
          barrel.position.x = 0.22;
          const aperture = new THREE.Mesh(
            new THREE.CylinderGeometry(0.14, 0.14, 0.04, 16),
            matLens,
          );
          aperture.rotation.z = Math.PI / 2;
          aperture.position.x = 0.49;
          instGroup.add(barrel, aperture);
        } else if (inst.id === 'sar-radar') {
          const arm = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.06), matHull);
          arm.position.x = 0.15;
          const antennaPanel = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.58, 0.92),
            matKapton,
          );
          antennaPanel.position.x = 0.34;
          antennaPanel.castShadow = true;
          instGroup.add(arm, antennaPanel);
        } else if (inst.id === 'mag-boom') {
          const boom = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.035, 1.85, 8),
            matHull,
          );
          boom.rotation.z = Math.PI / 2;
          boom.position.x = 0.92;
          const sensorTip = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.12, 0),
            matAccentCyan,
          );
          sensorTip.position.x = 1.85;
          instGroup.add(boom, sensorTip);
        } else {
          const box = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.3, 0.34), matHull);
          box.position.x = 0.18;
          const cone = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.15, 0.2, 12),
            matAccentCyan,
          );
          cone.rotation.z = -Math.PI / 2;
          cone.position.x = 0.44;
          instGroup.add(box, cone);
        }
        subGroups.payload.add(instGroup);
      });
      tagInteractive(subGroups.payload, 'payload');
    };

    rebuildSpacecraft();
    rebuildRef.current = rebuildSpacecraft;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 9. Throttled Click & Hover Raycasting onto Layer 1
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let lastMoveCheck = 0;

    const updatePointer = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (ev: PointerEvent) => {
      pointerDownPos = { x: ev.clientX, y: ev.clientY };
    };

    const onPointerUp = (ev: PointerEvent) => {
      const dist = Math.hypot(ev.clientX - pointerDownPos.x, ev.clientY - pointerDownPos.y);
      if (dist > 6) return;
      if (stateRef.current.sceneMode !== 'hangar') return;
      updatePointer(ev);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([craftRoot], true);
      if (hits.length > 0) {
        const tab = hits[0].object.userData.subsystemTab as SubsystemTab | undefined;
        if (tab && stateRef.current.onSelectSubsystem) {
          stateRef.current.onSelectSubsystem(tab);
        }
      }
    };

    const onPointerMove = (ev: PointerEvent) => {
      const now = performance.now();
      if (now - lastMoveCheck < 65) return;
      lastMoveCheck = now;
      if (stateRef.current.sceneMode !== 'hangar') {
        renderer.domElement.style.cursor = 'grab';
        return;
      }
      updatePointer(ev);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([craftRoot], true);
      renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    // 10. Animation Loop
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const st = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (st === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();
      const { sceneMode: mode, explodeAmount: targetExplode, simProgress: simProg } =
        stateRef.current;

      explodeCurrent.val = THREE.MathUtils.damp(explodeCurrent.val, targetExplode, 7, dt);
      const ex = explodeCurrent.val;
      subGroups.propulsion.position.y = -ex * 1.15;
      subGroups.comms.position.y = ex * 1.1;
      subGroups.powerLeft.position.x = -ex * 1.15;
      subGroups.powerRight.position.x = ex * 1.15;
      subGroups.payload.position.y = ex * 0.45;
      subGroups.payload.scale.setScalar(1 + ex * 0.14);

      if (mode === 'title') {
        hangarGroup.visible = false;
        orbitGroup.visible = true;
        rocketGroup.visible = false;
        craftRoot.visible = true;
        trailNodes.visible = false;
        plumeParticles.visible = false;
        planetMesh.rotation.y += dt * 0.05;

        const angle = elapsed * 0.22;
        orbitCurve.getPointAt((angle * 0.08) % 1, _v1);
        craftRoot.position.lerp(_v1, 0.2);
        craftRoot.lookAt(planetMesh.position);
        craftRoot.rotateY(Math.PI / 2);

        _targetCamPos.set(
          craftRoot.position.x - 2.6,
          craftRoot.position.y + 2.1,
          craftRoot.position.z + 5.8,
        );
        _targetLook.set(craftRoot.position.x - 1.8, craftRoot.position.y - 0.1, craftRoot.position.z);
        camera.position.lerp(_targetCamPos, 1 - Math.exp(-3 * dt));
        controls.target.lerp(_targetLook, 1 - Math.exp(-4 * dt));
      } else if (mode === 'planner') {
        hangarGroup.visible = false;
        orbitGroup.visible = true;
        rocketGroup.visible = false;
        craftRoot.visible = false;
        trailNodes.visible = false;
        plumeParticles.visible = false;
        planetMesh.rotation.y += dt * 0.06;

        _targetCamPos.set(0, 2.5, 11.5);
        _targetLook.set(0, -1.4, -10.5);
        camera.position.lerp(_targetCamPos, 1 - Math.exp(-3.5 * dt));
        controls.target.lerp(_targetLook, 1 - Math.exp(-4 * dt));
      } else if (mode === 'hangar') {
        hangarGroup.visible = true;
        orbitGroup.visible = false;
        rocketGroup.visible = false;
        craftRoot.visible = true;
        trailNodes.visible = false;
        plumeParticles.visible = false;

        craftRoot.position.set(0, 0.72 + Math.sin(elapsed * 1.3) * 0.04, 0);
        craftRoot.rotation.set(0, elapsed * 0.14, 0);

        if (camTransitionRef.current.active) {
          const preset = camTransitionRef.current.preset;
          if (preset === 'hero') {
            _targetCamPos.set(5.4, 3.0, 6.2);
            _targetLook.set(0, 0.55, 0);
          } else if (preset === 'payload') {
            _targetCamPos.set(2.8, 3.6, 3.4);
            _targetLook.set(0, 1.05, 0);
          } else if (preset === 'propulsion') {
            _targetCamPos.set(3.4, -0.4, 4.2);
            _targetLook.set(0, -0.35, 0);
          } else {
            _targetCamPos.set(0.4, 3.8, 7.2);
            _targetLook.set(0, 0.75, 0);
          }
          const k = 1 - Math.exp(-5.5 * dt);
          camera.position.lerp(_targetCamPos, k);
          controls.target.lerp(_targetLook, k);
          if (camera.position.distanceTo(_targetCamPos) < 0.05) {
            camTransitionRef.current.active = false;
          }
        }
      } else {
        // Orbit Live Mission Simulation Mode (Multi-Stage Launch -> Orbit)
        hangarGroup.visible = false;
        orbitGroup.visible = true;
        planetMesh.rotation.y += dt * 0.09;

        const isLaunchStage = simProg < 0.22;

        if (isLaunchStage) {
          // Animated 3D Launch Stack Ascent + Fairing Separation
          rocketGroup.visible = true;
          craftRoot.visible = simProg >= 0.16;
          trailNodes.visible = false;
          plumeParticles.visible = true;

          const launchT = simProg / 0.22; // 0..1
          const altY = -3.0 + launchT * 6.5;
          const tiltZ = -launchT * 0.42;
          rocketGroup.position.set(-2.5 + launchT * 2.5, altY, -1.8);
          rocketGroup.rotation.set(0.12, 0, tiltZ);

          // Flame flicker
          const flamePulse = 0.85 + Math.sin(elapsed * 28) * 0.18;
          rocketFlame.scale.set(1, flamePulse, 1);

          // Fairing halves separate cleanly between 0.14 and 0.22
          const fairingSep = Math.max(0, (simProg - 0.14) / 0.08);
          fairingLeft.position.set(-fairingSep * 1.6, 2.38 - fairingSep * 0.6, 0);
          fairingLeft.rotation.z = fairingSep * 0.75;
          fairingRight.position.set(fairingSep * 1.6, 2.38 - fairingSep * 0.6, 0);
          fairingRight.rotation.z = -fairingSep * 0.75;

          // Position spacecraft inside emerging fairing
          craftRoot.position.set(
            rocketGroup.position.x + Math.sin(-tiltZ) * 2.2,
            rocketGroup.position.y + Math.cos(-tiltZ) * 2.2,
            rocketGroup.position.z,
          );
          craftRoot.rotation.set(0.12, elapsed * 0.6, tiltZ);

          // Launch exhaust particles
          plumeMat.color.setHex(0xf59e0b);
          for (let i = 0; i < plumeCount; i++) {
            const age = (elapsed * 3.4 + i / plumeCount) % 1;
            _dummy.position.set(
              rocketGroup.position.x - Math.sin(tiltZ) * (-2.6 - age * 4.5) + Math.sin(i * 5.2) * 0.25 * age,
              rocketGroup.position.y + Math.cos(tiltZ) * (-2.6 - age * 4.5),
              rocketGroup.position.z + Math.cos(i * 4.1) * 0.25 * age,
            );
            _dummy.scale.setScalar(Math.max(0.08, (1 - age) * 2.2));
            _dummy.updateMatrix();
            plumeParticles.setMatrixAt(i, _dummy.matrix);
          }
          plumeParticles.instanceMatrix.needsUpdate = true;

          _targetCamPos.set(rocketGroup.position.x + 4.8, rocketGroup.position.y + 1.4, 7.6);
          _targetLook.copy(rocketGroup.position);
          const k = 1 - Math.exp(-4 * dt);
          camera.position.lerp(_targetCamPos, k);
          controls.target.lerp(_targetLook, k);
        } else {
          // Orbital Cruise, Orbit Insertion & Glowing Trajectory Trail
          rocketGroup.visible = false;
          craftRoot.visible = true;
          trailNodes.visible = true;

          const orbitT = Math.min(0.999, Math.max(0.001, (simProg - 0.22) / 0.78));
          orbitCurve.getPointAt(orbitT, _v1);
          orbitCurve.getPointAt((orbitT + 0.01) % 1, _v2);
          craftRoot.position.copy(_v1);
          craftRoot.lookAt(_v2);
          craftRoot.rotateX(Math.PI / 2);

          // Glowing trajectory trail nodes behind craft
          for (let i = 0; i < trailCount; i++) {
            const backOffset = (i + 1) * 0.0055;
            const tt = (orbitT - backOffset + 1) % 1;
            orbitCurve.getPointAt(tt, _dummy.position);
            _dummy.scale.setScalar(Math.max(0.15, (1 - i / trailCount) * 1.25));
            _dummy.updateMatrix();
            trailNodes.setMatrixAt(i, _dummy.matrix);
          }
          trailNodes.instanceMatrix.needsUpdate = true;

          // Thruster burn particles during insertion & corrections
          const firing = simProg < 0.34 || (simProg > 0.44 && simProg < 0.66);
          plumeParticles.visible = firing;
          if (firing) {
            plumeMat.color.setHex(0x38bdf8);
            for (let i = 0; i < plumeCount; i++) {
              const age = (elapsed * 2.8 + i / plumeCount) % 1;
              _dummy.position.set(
                _v1.x + (_v1.x - _v2.x) * age * 14 + Math.sin(i * 7.3) * 0.08 * age,
                _v1.y + (_v1.y - _v2.y) * age * 14 + Math.cos(i * 4.1) * 0.08 * age,
                _v1.z + (_v1.z - _v2.z) * age * 14,
              );
              const s = (1 - age) * 1.4;
              _dummy.scale.setScalar(Math.max(0.05, s));
              _dummy.updateMatrix();
              plumeParticles.setMatrixAt(i, _dummy.matrix);
            }
            plumeParticles.instanceMatrix.needsUpdate = true;
          }

          _targetCamPos.set(_v1.x + 3.6, _v1.y + 2.4, _v1.z + 5.2);
          const k = 1 - Math.exp(-3.5 * dt);
          camera.position.lerp(_targetCamPos, k);
          controls.target.lerp(_v1, k);
        }
      }

      if (controls.enableDamping) controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    tick();

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);

      controls.dispose();
      Object.values(subGroups).forEach((g) => disposeGroupResources(g));
      starGeo.dispose();
      starMat.dispose();
      deckGeo.dispose();
      deckMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      innerRingGeo.dispose();
      innerRingMat.dispose();
      shadowGeo.dispose();
      shadowMat.dispose();
      planetGeo.dispose();
      planetMat.dispose();
      atmoGeo.dispose();
      atmoMat.dispose();
      orbitTubeGeo.dispose();
      orbitTubeMat.dispose();
      trailGeo.dispose();
      trailMat.dispose();
      plumeGeo.dispose();
      plumeMat.dispose();
      rocketBodyGeo.dispose();
      rocketInterstageGeo.dispose();
      rocketNozzleGeo.dispose();
      rocketFlameGeo.dispose();
      fairingLeftGeo.dispose();
      fairingRightGeo.dispose();

      kapton.map.dispose();
      kapton.bumpMap.dispose();
      solarTex.dispose();
      hullTex.dispose();
      contactTex.dispose();
      planetCache.forEach((t) => t.dispose());
      envTex.dispose();

      matKapton.dispose();
      matHull.dispose();
      matDarkCarbon.dispose();
      matSolarCell.dispose();
      matNozzle.dispose();
      matDish.dispose();
      matAccentCyan.dispose();
      matIonGlow.dispose();
      matFlame.dispose();
      matLens.dispose();
      matRtgGlow.dispose();

      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  if (webglError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[#060911] text-slate-300">
        <div className="max-w-md border border-slate-800 bg-slate-950 p-6 text-center">
          <h2 className="font-display text-lg font-semibold text-white">
            3D Spacecraft Viewport Unavailable
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            WebGL initialization failed in this browser context. Hardware or software WebGL2 is required for the 3D hangar and orbital simulation.
          </p>
        </div>
      </div>
    );
  }

  return <div ref={mountRef} className="absolute inset-0 w-full h-full" />;
}
