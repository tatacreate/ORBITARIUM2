import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CELESTIAL_BODIES, GROUND_STATIONS } from '../engine/orbitalMechanics';
import type { CelestialBodyId } from '../types/mission';
import type { GroundStationSpec, OrbitalState } from '../types/nasaSegments';
import {
  createContactShadowTexture,
  createHullPlatingTexture,
  createKaptonTextures,
  createPlanetTexture,
  createSolarPanelTexture,
} from './proceduralTextures';

interface NasaOrbitalSceneProps {
  targetBody: CelestialBodyId;
  orbitState: OrbitalState;
  hasLineOfSight: boolean;
  activeStationId: string | null;
  activeInstrumentsCount: number;
  isBurning: boolean;
  cameraPreset: 'hero' | 'satellite' | 'earth-view' | 'ground-station';
  predictedOrbit?: { altitudeKm: number; eccentricity: number; inclinationDeg: number } | null;
  maneuverNodeAnomalyDeg?: number | null;
  solarPanelAngleDeg?: number;
  radiationAlert?: boolean;
  debrisAlert?: boolean;
  radarPulseActive?: boolean;
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _targetCam = new THREE.Vector3();
const _targetLook = new THREE.Vector3();
const _dummy = new THREE.Object3D();

export function NasaOrbitalScene({
  targetBody,
  orbitState,
  hasLineOfSight,
  activeStationId,
  activeInstrumentsCount,
  isBurning,
  cameraPreset,
  predictedOrbit = null,
  maneuverNodeAnomalyDeg = null,
  solarPanelAngleDeg = 0,
  radiationAlert = false,
  debrisAlert = false,
  radarPulseActive = false,
}: NasaOrbitalSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglError, setWebglError] = useState(false);

  const stateRef = useRef({
    targetBody,
    orbitState,
    hasLineOfSight,
    activeStationId,
    activeInstrumentsCount,
    isBurning,
    cameraPreset,
    predictedOrbit,
    maneuverNodeAnomalyDeg,
    solarPanelAngleDeg,
    radiationAlert,
    debrisAlert,
    radarPulseActive,
  });
  stateRef.current = {
    targetBody,
    orbitState,
    hasLineOfSight,
    activeStationId,
    activeInstrumentsCount,
    isBurning,
    cameraPreset,
    predictedOrbit,
    maneuverNodeAnomalyDeg,
    solarPanelAngleDeg,
    radiationAlert,
    debrisAlert,
    radarPulseActive,
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Software WebGL check
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
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040711);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 800);
    camera.position.set(14, 8, 16);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 4.2;
    controls.maxDistance = 65;
    controls.target.set(0, 0, 0);

    // Balanced NASA Studio & Sunlight lighting
    const sunLight = new THREE.DirectionalLight(0xfffaed, 2.8);
    sunLight.position.set(35, 12, 28);
    sunLight.castShadow = !isSoftwareGl;
    scene.add(sunLight);

    const ambientLight = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.65);
    scene.add(ambientLight);

    // Starfield InstancedMesh (800 stars)
    const starCount = 800;
    const starGeo = new THREE.OctahedronGeometry(0.12, 0);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const starField = new THREE.InstancedMesh(starGeo, starMat, starCount);
    let seed = 4129;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < starCount; i++) {
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      const r = 90 + rand() * 120;
      _dummy.position.set(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
      );
      _dummy.scale.setScalar(0.4 + rand() * 1.2);
      _dummy.updateMatrix();
      starField.setMatrixAt(i, _dummy.matrix);
    }
    starField.instanceMatrix.needsUpdate = true;
    scene.add(starField);

    // Central Planet Sphere
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const planetRadius = 4.2; // Visual normalized radius
    const planetGeo = new THREE.SphereGeometry(planetRadius, 48, 36);
    const planetMat = new THREE.MeshStandardMaterial({
      roughness: 0.72,
      metalness: 0.12,
    });
    const planetMesh = new THREE.Mesh(planetGeo, planetMat);
    planetMesh.castShadow = true;
    planetMesh.receiveShadow = true;
    scene.add(planetMesh);

    // Atmosphere Glow
    const atmoGeo = new THREE.SphereGeometry(planetRadius * 1.035, 40, 30);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.16,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    scene.add(atmoMesh);

    // Ground Stations group placed on planet
    const groundStationsGroup = new THREE.Group();
    scene.add(groundStationsGroup);

    const stationBeacons: { id: string; mesh: THREE.Mesh; ring: THREE.Mesh; body: CelestialBodyId }[] = [];
    const stationMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });

    GROUND_STATIONS.forEach((st) => {
      const stLatRad = (st.latDeg * Math.PI) / 180;
      const stLonRad = (st.lonDeg * Math.PI) / 180;
      const r = planetRadius + 0.02;

      // 3D Cartesian coordinates on sphere
      const x = r * Math.cos(stLatRad) * Math.cos(stLonRad);
      const y = r * Math.sin(stLatRad);
      const z = -r * Math.cos(stLatRad) * Math.sin(stLonRad);

      const beaconMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.18, 12), stationMat);
      beaconMesh.position.set(x, y, z);
      beaconMesh.lookAt(0, 0, 0);
      beaconMesh.rotateX(Math.PI / 2);

      const ringMesh = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.24, 24), ringMat);
      ringMesh.position.set(x, y, z);
      ringMesh.lookAt(0, 0, 0);

      groundStationsGroup.add(beaconMesh, ringMesh);
      stationBeacons.push({ id: st.id, mesh: beaconMesh, ring: ringMesh, body: st.body });
    });

    // Spacecraft Model Root
    const spacecraftRoot = new THREE.Group();
    scene.add(spacecraftRoot);

    const hullTex = createHullPlatingTexture(maxAniso);
    const solarTex = createSolarPanelTexture(maxAniso);
    const kapton = createKaptonTextures(maxAniso);

    const matHull = new THREE.MeshStandardMaterial({
      map: hullTex,
      metalness: 0.72,
      roughness: 0.3,
    });
    const matSolar = new THREE.MeshPhysicalMaterial({
      map: solarTex,
      metalness: 0.25,
      roughness: 0.15,
      clearcoat: 0.9,
    });
    const matKapton = new THREE.MeshStandardMaterial({
      map: kapton.map,
      metalness: 0.85,
      roughness: 0.35,
    });
    const matDish = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.5,
      roughness: 0.25,
      side: THREE.DoubleSide,
    });
    const matCyan = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 1.2,
    });
    const matFlame = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.85,
    });

    // Bus chassis
    const busMesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.72, 0.55), matHull);
    busMesh.castShadow = true;
    spacecraftRoot.add(busMesh);

    // Solar Wings (Left & Right)
    const solarLeft = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.03, 0.52), matSolar);
    solarLeft.position.x = -1.18;
    solarLeft.castShadow = true;
    const solarRight = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.03, 0.52), matSolar);
    solarRight.position.x = 1.18;
    solarRight.castShadow = true;
    spacecraftRoot.add(solarLeft, solarRight);

    // High-Gain Dish Antenna
    const dishPts = [
      new THREE.Vector2(0.01, 0),
      new THREE.Vector2(0.18, 0.04),
      new THREE.Vector2(0.38, 0.12),
      new THREE.Vector2(0.54, 0.24),
    ];
    const dishMesh = new THREE.Mesh(new THREE.LatheGeometry(dishPts, 24), matDish);
    dishMesh.rotation.x = -Math.PI / 2;
    dishMesh.position.set(0, 0.45, 0);
    spacecraftRoot.add(dishMesh);

    // Instrument Boom (SAR / Magnetometer)
    const boomMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 8), matHull);
    boomMesh.position.set(0, -0.65, 0);
    const sensorPod = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.18), matKapton);
    sensorPod.position.set(0, -1.25, 0);
    spacecraftRoot.add(boomMesh, sensorPod);

    // Thruster & Burn Flame
    const thrusterNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.18, 0.22, 16), matHull);
    thrusterNozzle.position.set(0, -0.42, 0);
    const burnFlame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.85, 16), matFlame);
    burnFlame.rotation.x = Math.PI;
    burnFlame.position.set(0, -0.92, 0);
    burnFlame.visible = false;
    spacecraftRoot.add(thrusterNozzle, burnFlame);

    // Active Instrument Scan Footprint Cone
    const scanCone = new THREE.Mesh(
      new THREE.ConeGeometry(1.4, 3.2, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    scanCone.rotation.x = Math.PI;
    scanCone.position.set(0, -1.8, 0);
    spacecraftRoot.add(scanCone);

    // Real-Time Line-of-Sight Downlink Beam
    const beamCurve = new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0));
    const beamGeo = new THREE.TubeGeometry(beamCurve, 2, 0.038, 8, false);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    const downlinkBeam = new THREE.Mesh(beamGeo, beamMat);
    downlinkBeam.visible = false;
    scene.add(downlinkBeam);

    // Dynamic 3D Keplerian Orbit Path (TubeGeometry updated on parameter changes)
    let orbitPathMesh: THREE.Mesh | null = null;
    const orbitMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.65,
    });

    // Predicted Maneuver Transfer Path
    let predictedOrbitMesh: THREE.Mesh | null = null;
    const predictedOrbitMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.55,
    });

    // GMAT-Style Periapsis (Pe), Apoapsis (Ap), Maneuver Node, & Debris Markers
    const periapsisMarker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.18, 0),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee }),
    );
    const apoapsisMarker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.18, 0),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
    );
    const maneuverNodeMarker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.24, 0),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b }),
    );
    maneuverNodeMarker.visible = false;

    const debrisThreatMarker = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.2, 0),
      new THREE.MeshBasicMaterial({ color: 0xf43f5e }),
    );
    debrisThreatMarker.visible = false;

    scene.add(periapsisMarker, apoapsisMarker, maneuverNodeMarker, debrisThreatMarker);

    const buildOrbitCurveGeometry = (altKm: number, ecc: number, incDeg: number, radiusTube: number) => {
      const visualR = planetRadius + Math.max(0.6, Math.min(6.5, (altKm / 1000) * 2.2));
      const a = visualR / (1 - ecc * 0.5);
      const b = a * Math.sqrt(Math.max(0.1, 1 - ecc * ecc));

      const incRad = (incDeg * Math.PI) / 180;
      const pts: THREE.Vector3[] = [];
      const steps = 72;
      for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * Math.PI * 2;
        const x = a * Math.cos(theta);
        const zPrime = b * Math.sin(theta);
        const y = zPrime * Math.sin(incRad);
        const z = zPrime * Math.cos(incRad);
        pts.push(new THREE.Vector3(x, y, z));
      }
      const curve = new THREE.CatmullRomCurve3(pts, true);
      return { geo: new THREE.TubeGeometry(curve, 96, radiusTube, 6, true), a };
    };

    const updateOrbitGeometry = (altKm: number, ecc: number, incDeg: number) => {
      if (orbitPathMesh) {
        scene.remove(orbitPathMesh);
        orbitPathMesh.geometry.dispose();
      }
      const { geo, a } = buildOrbitCurveGeometry(altKm, ecc, incDeg, 0.032);
      orbitPathMesh = new THREE.Mesh(geo, orbitMat);
      scene.add(orbitPathMesh);
      periapsisMarker.position.set(a, 0, 0);
      apoapsisMarker.position.set(-a, 0, 0);
    };

    const updatePredictedGeometry = (pred: { altitudeKm: number; eccentricity: number; inclinationDeg: number } | null) => {
      if (predictedOrbitMesh) {
        scene.remove(predictedOrbitMesh);
        predictedOrbitMesh.geometry.dispose();
        predictedOrbitMesh = null;
      }
      if (!pred) return;
      const { geo } = buildOrbitCurveGeometry(pred.altitudeKm, pred.eccentricity, pred.inclinationDeg, 0.024);
      predictedOrbitMesh = new THREE.Mesh(geo, predictedOrbitMat);
      scene.add(predictedOrbitMesh);
    };

    updateOrbitGeometry(
      stateRef.current.orbitState.altitudeKm,
      stateRef.current.orbitState.eccentricity,
      stateRef.current.orbitState.inclinationDeg,
    );
    updatePredictedGeometry(stateRef.current.predictedOrbit);

    // Planet texture initialization
    let currentTextureBody = targetBody;
    const applyPlanetTexture = (bId: CelestialBodyId) => {
      const tex = createPlanetTexture(bId, maxAniso);
      planetMat.map = tex;
      planetMat.metalness = bId === 'psyche' ? 0.65 : 0.12;
      planetMat.roughness = bId === 'psyche' ? 0.35 : 0.72;
      planetMat.needsUpdate = true;

      const bodyData = CELESTIAL_BODIES[bId];
      if (bId === 'mars') atmoMat.color.setHex(0xfb923c);
      else if (bId === 'europa') atmoMat.color.setHex(0xbae6fd);
      else if (bId === 'earth') atmoMat.color.setHex(0x38bdf8);
      else atmoMat.color.setHex(0x94a3b8);
      atmoMat.opacity = bodyData.atmosphereHeightKm > 0 ? 0.18 : 0.03;
    };
    applyPlanetTexture(targetBody);

    // Animation Loop
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let lastAlt = stateRef.current.orbitState.altitudeKm;
    let lastEcc = stateRef.current.orbitState.eccentricity;
    let lastInc = stateRef.current.orbitState.inclinationDeg;
    let lastPredKey = '';

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || !gl.fenceSync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
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
      const s = stateRef.current;

      // Planet Texture Change Check
      if (s.targetBody !== currentTextureBody) {
        currentTextureBody = s.targetBody;
        applyPlanetTexture(s.targetBody);
      }

      // Dynamic Orbit Ring Rebuild Check
      if (
        Math.abs(s.orbitState.altitudeKm - lastAlt) > 5 ||
        Math.abs(s.orbitState.eccentricity - lastEcc) > 0.02 ||
        Math.abs(s.orbitState.inclinationDeg - lastInc) > 0.5
      ) {
        lastAlt = s.orbitState.altitudeKm;
        lastEcc = s.orbitState.eccentricity;
        lastInc = s.orbitState.inclinationDeg;
        updateOrbitGeometry(lastAlt, lastEcc, lastInc);
      }

      // Predicted Transfer Ring Rebuild Check
      const predKey = s.predictedOrbit
        ? `${Math.round(s.predictedOrbit.altitudeKm)}:${s.predictedOrbit.eccentricity.toFixed(2)}:${s.predictedOrbit.inclinationDeg.toFixed(1)}`
        : 'none';
      if (predKey !== lastPredKey) {
        lastPredKey = predKey;
        updatePredictedGeometry(s.predictedOrbit);
      }

      // Rotate Planet slowly
      planetMesh.rotation.y += dt * 0.035;
      atmoMesh.rotation.y = planetMesh.rotation.y;
      groundStationsGroup.rotation.y = planetMesh.rotation.y;

      // Update Ground Station Visibility based on current body
      stationBeacons.forEach((sb) => {
        const matches = sb.body === s.targetBody;
        sb.mesh.visible = matches;
        sb.ring.visible = matches;
        if (matches) {
          const isActive = sb.id === s.activeStationId;
          (sb.mesh.material as THREE.MeshBasicMaterial).color.setHex(
            isActive ? 0x22d3ee : 0x64748b,
          );
          (sb.ring.material as THREE.MeshBasicMaterial).color.setHex(
            isActive ? (s.hasLineOfSight ? 0x06b6d4 : 0xf43f5e) : 0x334155,
          );
          const pulse = 1 + Math.sin(elapsed * 6) * (isActive ? 0.28 : 0.08);
          sb.ring.scale.setScalar(pulse);
        }
      });

      // Compute Spacecraft 3D position from live True Anomaly and Inclination
      const visualR = planetRadius + Math.max(0.6, Math.min(6.5, (s.orbitState.altitudeKm / 1000) * 2.2));
      const a = visualR / (1 - s.orbitState.eccentricity * 0.5);
      const b = a * Math.sqrt(Math.max(0.1, 1 - s.orbitState.eccentricity * s.orbitState.eccentricity));
      const nuRad = (s.orbitState.trueAnomalyDeg * Math.PI) / 180;
      const incRad = (s.orbitState.inclinationDeg * Math.PI) / 180;

      const scX = a * Math.cos(nuRad);
      const zPrime = b * Math.sin(nuRad);
      const scY = zPrime * Math.sin(incRad);
      const scZ = zPrime * Math.cos(incRad);

      spacecraftRoot.position.set(scX, scY, scZ);
      _v1.set(scX, scY, scZ).normalize();
      spacecraftRoot.lookAt(0, 0, 0);

      // Animate Solar Wings Rotation toward solarPanelAngleDeg
      const targetSolarRad = THREE.MathUtils.degToRad(s.solarPanelAngleDeg);
      solarLeft.rotation.x = THREE.MathUtils.damp(solarLeft.rotation.x, targetSolarRad, 6, dt);
      solarRight.rotation.x = THREE.MathUtils.damp(solarRight.rotation.x, targetSolarRad, 6, dt);

      // Maneuver Node Marker Position
      if (s.maneuverNodeAnomalyDeg !== null && s.maneuverNodeAnomalyDeg !== undefined) {
        const mnRad = (s.maneuverNodeAnomalyDeg * Math.PI) / 180;
        const mnX = a * Math.cos(mnRad);
        const mnZp = b * Math.sin(mnRad);
        maneuverNodeMarker.position.set(mnX, mnZp * Math.sin(incRad), mnZp * Math.cos(incRad));
        maneuverNodeMarker.rotation.y += dt * 2.2;
        maneuverNodeMarker.visible = true;
      } else {
        maneuverNodeMarker.visible = false;
      }

      // Debris Threat Marker ahead of spacecraft when conjunction alert is active
      if (s.debrisAlert) {
        const debRad = nuRad + 0.35;
        const debX = (a + 0.12) * Math.cos(debRad);
        const debZp = (b + 0.12) * Math.sin(debRad);
        debrisThreatMarker.position.set(debX, debZp * Math.sin(incRad), debZp * Math.cos(incRad));
        debrisThreatMarker.rotation.x += dt * 4;
        debrisThreatMarker.rotation.y += dt * 3;
        debrisThreatMarker.visible = true;
      } else {
        debrisThreatMarker.visible = false;
      }

      // Radiation Alert Tint on Sun / Dish highlight
      sunLight.color.setHex(s.radiationAlert ? 0xfbbf24 : 0xfffaed);
      sunLight.intensity = s.radiationAlert ? 3.8 : 2.8;

      // Active Instruments Scan Visualizer + Active Target Firing Pulse
      scanCone.visible = s.activeInstrumentsCount > 0 || s.radarPulseActive;
      if (scanCone.visible) {
        const scanMat = scanCone.material as THREE.MeshBasicMaterial;
        if (s.radarPulseActive) {
          scanMat.color.setHex(0x10b981);
          scanMat.opacity = 0.42;
          scanCone.scale.setScalar(1.32 + Math.sin(elapsed * 16) * 0.12);
        } else {
          scanMat.color.setHex(0x38bdf8);
          scanMat.opacity = 0.14;
          scanCone.scale.setScalar(1 + Math.sin(elapsed * 4) * 0.08);
        }
      }

      // Engine Burn Visualizer
      burnFlame.visible = s.isBurning;
      if (s.isBurning) {
        burnFlame.scale.set(1, 0.8 + Math.sin(elapsed * 24) * 0.35, 1);
      }

      // Real-Time Line-of-Sight Downlink Beam Update
      const activeBeacon = stationBeacons.find((sb) => sb.id === s.activeStationId && sb.body === s.targetBody);
      if (activeBeacon && s.hasLineOfSight) {
        activeBeacon.mesh.getWorldPosition(_v2);
        spacecraftRoot.getWorldPosition(_v3);

        downlinkBeam.visible = true;
        downlinkBeam.geometry.dispose();
        const beamCurveNew = new THREE.LineCurve3(_v3, _v2);
        downlinkBeam.geometry = new THREE.TubeGeometry(beamCurveNew, 3, 0.028, 6, false);
        (downlinkBeam.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(elapsed * 12) * 0.3;
      } else {
        downlinkBeam.visible = false;
      }

      // Camera glide presets
      if (s.cameraPreset === 'hero') {
        _targetCam.set(14, 8, 16);
        _targetLook.set(0, 0, 0);
      } else if (s.cameraPreset === 'satellite') {
        _targetCam.set(scX + 2.2, scY + 1.2, scZ + 2.4);
        _targetLook.set(scX, scY, scZ);
      } else if (s.cameraPreset === 'earth-view') {
        _targetCam.set(0, 18, 0.1);
        _targetLook.set(0, 0, 0);
      } else {
        if (activeBeacon) {
          activeBeacon.mesh.getWorldPosition(_v2);
          _targetCam.set(_v2.x * 1.8, _v2.y * 1.8 + 2.5, _v2.z * 1.8);
          _targetLook.copy(_v2);
        }
      }
      const k = 1 - Math.exp(-4 * dt);
      camera.position.lerp(_targetCam, k);
      controls.target.lerp(_targetLook, k);

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
      controls.dispose();
      pmrem.dispose();
      starGeo.dispose();
      starMat.dispose();
      planetGeo.dispose();
      planetMat.dispose();
      atmoGeo.dispose();
      atmoMat.dispose();
      matHull.dispose();
      matSolar.dispose();
      matKapton.dispose();
      matDish.dispose();
      matCyan.dispose();
      matFlame.dispose();
      stationMat.dispose();
      ringMat.dispose();
      orbitMat.dispose();
      predictedOrbitMat.dispose();
      beamMat.dispose();
      if (orbitPathMesh) {
        orbitPathMesh.geometry.dispose();
      }
      if (predictedOrbitMesh) {
        predictedOrbitMesh.geometry.dispose();
      }
      downlinkBeam.geometry.dispose();

      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [targetBody]);

  if (webglError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[#040711] text-slate-300">
        <p className="text-xs">WebGL rendering unavailable in this browser environment.</p>
      </div>
    );
  }

  return <div ref={mountRef} className="absolute inset-0 w-full h-full" />;
}
