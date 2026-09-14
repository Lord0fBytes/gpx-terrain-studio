import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

interface TerrainViewerProps {
  readonly stl: ArrayBuffer;
  readonly isStale: boolean;
}

export function TerrainViewer({ stl, isStale }: TerrainViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const resetViewRef = useRef<() => void>(() => undefined);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setError(undefined);

    let animationFrame = 0;
    let renderer: THREE.WebGLRenderer | undefined;
    let geometry: THREE.BufferGeometry | undefined;
    let material: THREE.MeshStandardMaterial | undefined;
    let controls: OrbitControls | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let rotateViewFromKeyboard: ((event: KeyboardEvent) => void) | undefined;

    try {
      geometry = new STLLoader().parse(stl);
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      const bounds = geometry.boundingBox;
      if (!bounds || bounds.isEmpty()) throw new Error('The generated STL does not contain displayable geometry.');

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xe8eee8);
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 10_000);
      camera.up.set(0, 0, 1);

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.domElement.setAttribute('role', 'img');
      renderer.domElement.setAttribute('aria-label', 'Interactive preview of the exact generated terrain STL. Drag or use the arrow keys to rotate, scroll or pinch to zoom, and press Home to reset the view.');
      renderer.domElement.tabIndex = 0;
      container.appendChild(renderer.domElement);

      material = new THREE.MeshStandardMaterial({ color: 0xc9784d, metalness: 0, roughness: 0.82 });
      scene.add(new THREE.Mesh(geometry, material));
      scene.add(new THREE.HemisphereLight(0xf5fbff, 0x435147, 1.45));
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.35);
      keyLight.position.set(140, -100, 220);
      scene.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0xffe9d6, 1.1);
      fillLight.position.set(-100, 80, 90);
      scene.add(fillLight);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = false;
      controls.minPolarAngle = 0.08;
      controls.maxPolarAngle = Math.PI / 2 - 0.03;

      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const radius = Math.max(size.length() / 2, 1);
      const fitView = () => {
        const verticalFov = THREE.MathUtils.degToRad(camera.fov);
        const fitHeightDistance = radius / Math.tan(verticalFov / 2);
        const fitWidthDistance = fitHeightDistance / Math.max(camera.aspect, 0.1);
        const distance = Math.max(fitHeightDistance, fitWidthDistance) * 1.15;
        camera.near = Math.max(distance / 1_000, 0.01);
        camera.far = distance * 20;
        camera.position.set(center.x + distance * 0.72, center.y - distance * 0.88, center.z + distance * 0.65);
        camera.updateProjectionMatrix();
        controls!.target.copy(center);
        controls!.minDistance = radius * 0.35;
        controls!.maxDistance = radius * 12;
        controls!.update();
      };
      resetViewRef.current = fitView;

      rotateViewFromKeyboard = (event: KeyboardEvent) => {
        if (event.key === 'Home') {
          event.preventDefault();
          fitView();
          return;
        }
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;

        event.preventDefault();
        const step = THREE.MathUtils.degToRad(10);
        const offset = camera.position.clone().sub(controls!.target);
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          offset.applyAxisAngle(new THREE.Vector3(0, 0, 1), event.key === 'ArrowLeft' ? -step : step);
        } else {
          const orbitAxis = new THREE.Vector3(-offset.y, offset.x, 0).normalize();
          const candidate = offset.clone().applyAxisAngle(orbitAxis, event.key === 'ArrowUp' ? -step : step);
          if (candidate.z > offset.length() * 0.04) offset.copy(candidate);
        }
        camera.position.copy(controls!.target).add(offset);
        controls!.update();
      };
      renderer.domElement.addEventListener('keydown', rotateViewFromKeyboard);

      const resize = () => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (width <= 0 || height <= 0) return;
        renderer!.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      resize();
      fitView();
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);

      const render = () => {
        controls!.update();
        renderer!.render(scene, camera);
        animationFrame = requestAnimationFrame(render);
      };
      render();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'This browser could not initialize the 3D preview.');
    }

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      controls?.dispose();
      geometry?.dispose();
      material?.dispose();
      if (rotateViewFromKeyboard) renderer?.domElement.removeEventListener('keydown', rotateViewFromKeyboard);
      renderer?.dispose();
      renderer?.domElement.remove();
      resetViewRef.current = () => undefined;
    };
  }, [stl]);

  return (
    <div className="terrain-viewer">
      <div className="terrain-viewer__canvas" ref={containerRef} />
      {error && <p className="terrain-viewer__message is-error" role="alert">{error}</p>}
      {!error && <p className={`terrain-viewer__message${isStale ? ' is-stale' : ''}`} aria-live="polite">
        {isStale ? 'Settings changed — regenerate to update this preview.' : 'Exact export geometry · Drag or use arrow keys to rotate · Scroll or pinch to zoom'}
      </p>}
      {!error && <button className="terrain-viewer__reset" onClick={() => resetViewRef.current()} type="button">Reset view</button>}
    </div>
  );
}
