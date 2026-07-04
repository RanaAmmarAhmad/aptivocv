import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Lightweight 3D backdrop: rotating wireframe icosahedron + drifting
 * particle field. Renders on the client only. Respects reduced motion.
 */
export default function HeroCanvas() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
    camera.position.z = 6;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // Lime accent color from design tokens.
    const accent = new THREE.Color("#C6F24E");
    const dim = new THREE.Color("#3a4a2a");

    // Central icosahedron - wireframe + faint filled inner shape.
    const geo = new THREE.IcosahedronGeometry(2.1, 1);
    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(geo),
      new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.55 }),
    );
    const inner = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.85, 0),
      new THREE.MeshBasicMaterial({ color: dim, transparent: true, opacity: 0.08, wireframe: false }),
    );
    const group = new THREE.Group();
    group.add(wire);
    group.add(inner);
    scene.add(group);

    // Orbiting satellite rings
    const ring = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(
        Array.from({ length: 128 }, (_, i) => {
          const a = (i / 128) * Math.PI * 2;
          return new THREE.Vector3(Math.cos(a) * 3.4, 0, Math.sin(a) * 3.4);
        }),
      ),
      new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.25 }),
    );
    ring.rotation.x = Math.PI / 3;
    scene.add(ring);

    // Particle field
    const pCount = 380;
    const positions = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 18;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 12 - 2;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({
        color: accent,
        size: 0.03,
        transparent: true,
        opacity: 0.7,
        sizeAttenuation: true,
      }),
    );
    scene.add(points);

    let mouseX = 0;
    let mouseY = 0;
    const onMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMove);

    let raf = 0;
    const clock = new THREE.Clock();
    const tick = () => {
      const t = clock.getElapsedTime();
      const speed = prefersReduced ? 0 : 1;
      group.rotation.x = t * 0.15 * speed + mouseY * 0.2;
      group.rotation.y = t * 0.22 * speed + mouseX * 0.3;
      ring.rotation.z = t * 0.1 * speed;
      points.rotation.y = t * 0.02 * speed;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      geo.dispose();
      pGeo.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0" aria-hidden />;
}