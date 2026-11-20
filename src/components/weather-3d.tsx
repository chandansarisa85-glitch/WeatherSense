"use client";

import { Cloud, Clouds } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { WeatherKind } from "@/lib/types";

type SceneWeather = { id: number; kind: WeatherKind; target: number; fadeIn?: boolean };

const CLOUD_TINT: Record<WeatherKind, string> = {
  sunny: "#f3f7ff",
  cloudy: "#d1deeb",
  rainy: "#94aac1",
  stormy: "#77839c",
  snowy: "#edf7ff",
};

function useWeatherLayers(kind: WeatherKind, reducedMotion: boolean) {
  const [layers, setLayers] = useState<SceneWeather[]>([{ id: 0, kind, target: 1 }]);
  const activeKind = useRef(kind);
  const nextId = useRef(0);

  useEffect(() => {
    if (activeKind.current === kind) return;
    activeKind.current = kind;
    const timer = window.setTimeout(() => {
      if (reducedMotion) {
        setLayers([{ id: ++nextId.current, kind, target: 1 }]);
        return;
      }
      setLayers((current) => [
        ...current.map((layer) => ({ ...layer, target: 0 })),
        { id: ++nextId.current, kind, target: 1, fadeIn: true },
      ]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [kind, reducedMotion]);

  useEffect(() => {
    if (layers.length < 2) return;
    const timer = window.setTimeout(() => {
      setLayers((current) => current.filter((layer) => layer.target === 1));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [layers]);

  return layers;
}

function SunOrb({ kind, isDay, reducedMotion }: { kind: WeatherKind; isDay: boolean; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const surface = useRef<THREE.MeshStandardMaterial>(null);
  const target = isDay ? (kind === "sunny" ? 1 : kind === "cloudy" ? 0.12 : 0.025) : 0.34;
  const tint = isDay ? "#ffd184" : "#bedcff";

  useFrame(({ clock }, delta) => {
    if (!group.current || reducedMotion) return;
    group.current.rotation.y = clock.elapsedTime * 0.055;
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, 0.52 + Math.sin(clock.elapsedTime * 0.32) * 0.07, 1.8, delta);
    if (surface.current) surface.current.opacity = THREE.MathUtils.damp(surface.current.opacity, target, 2.4, delta);
    if (surface.current) surface.current.emissiveIntensity = THREE.MathUtils.damp(surface.current.emissiveIntensity, 2.2 * target, 2, delta);
  });

  useEffect(() => {
    if (reducedMotion) {
      if (surface.current) surface.current.opacity = target;
      if (surface.current) surface.current.emissiveIntensity = 2.2 * target;
    }
  }, [reducedMotion, target]);

  return (
    <group ref={group} position={[1.18, 0.52, -0.8]}>
      <mesh scale={1.55}>
        <sphereGeometry args={[0.72, 24, 20]} />
        <meshBasicMaterial color={tint} transparent opacity={target * 0.075} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.72, 48, 32]} />
        <meshStandardMaterial ref={surface} color={tint} emissive={tint} emissiveIntensity={2.2 * target} roughness={0.92} metalness={0} transparent opacity={target} depthWrite={false} />
      </mesh>
    </group>
  );
}

function CloudLayer({ kind, target, reducedMotion, seed, fadeIn = false }: SceneWeather & { reducedMotion: boolean; seed: number }) {
  const root = useRef<THREE.Group>(null);
  const opacity = useRef(fadeIn ? 0 : target);
  const { invalidate } = useThree();
  const cloudTint = CLOUD_TINT[kind];
  const cloudCount = reducedMotion ? 14 : 18;

  useFrame(({ clock }, delta) => {
    const previousOpacity = opacity.current;
    opacity.current = THREE.MathUtils.damp(opacity.current, target, 3.2, delta);
    if (root.current) {
      const drift = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.16 + seed) * 0.1;
      root.current.position.x = drift;
      root.current.rotation.y = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.1 + seed) * 0.035;
      if (Math.abs(previousOpacity - opacity.current) > 0.001) {
        root.current.traverse((object) => {
          if (!(object instanceof THREE.InstancedMesh)) return;
          const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of meshMaterials) {
            material.opacity = opacity.current;
            material.transparent = true;
          }
        });
      }
    }
  });

  useEffect(() => {
    if (reducedMotion) {
      opacity.current = target;
      invalidate();
    }
  }, [invalidate, reducedMotion, target]);

  const offset = seed === 1 ? 0 : 1;
  const tint = kind === "stormy" ? "#76829a" : cloudTint;
  const cloudSpeed = reducedMotion ? 0 : kind === "stormy" ? 0.035 : 0.07;

  return (
    <group ref={root} position={[0, -0.2 + offset * 0.28, -0.2 - offset * 0.5]} scale={offset ? 0.72 : 1}>
      <Clouds texture="/cloud-puff.svg" limit={cloudCount + 14} material={THREE.MeshLambertMaterial}>
        <Cloud seed={seed * 17 + 2} segments={cloudCount} bounds={[1.72, 0.38, 0.32]} volume={1.9} smallestVolume={0.72} concentrate="inside" growth={0.08} speed={cloudSpeed} opacity={0.78} color={tint} />
        <group position={[-0.64, -0.2, -0.34]} scale={0.72}>
          <Cloud seed={seed * 29 + 7} segments={12} bounds={[1.5, 0.29, 0.3]} volume={1.35} smallestVolume={0.82} concentrate="inside" growth={0.045} speed={cloudSpeed * 0.72} opacity={0.46} color={tint} />
        </group>
      </Clouds>
    </group>
  );
}

function CloudBanks({ kind, reducedMotion }: { kind: WeatherKind; reducedMotion: boolean }) {
  const layers = useWeatherLayers(kind, reducedMotion);
  return <>
    {layers.map((layer) => <CloudLayer key={layer.id} {...layer} seed={layer.id + 1} reducedMotion={reducedMotion} />)}
  </>;
}

function RainStreaks({ kind, reducedMotion }: { kind: WeatherKind; reducedMotion: boolean }) {
  const rain = useRef<THREE.LineSegments>(null);
  const snow = useRef<THREE.Points>(null);
  const rainMaterial = useRef<THREE.LineBasicMaterial>(null);
  const snowMaterial = useRef<THREE.PointsMaterial>(null);
  const rainPositions = useMemo(() => {
    const data = new Float32Array(34 * 2 * 3);
    for (let i = 0; i < 34; i++) {
      const x = Math.sin(i * 91.7) * 2.9;
      const y = ((i * 19) % 37) / 10 - 1.75;
      const z = ((i * 11) % 18) / 14;
      const offset = i * 6;
      data[offset] = x; data[offset + 1] = y; data[offset + 2] = z;
      data[offset + 3] = x - 0.11; data[offset + 4] = y - 0.28; data[offset + 5] = z;
    }
    return data;
  }, []);
  const snowPositions = useMemo(() => {
    const data = new Float32Array(28 * 3);
    for (let i = 0; i < 28; i++) {
      data[i * 3] = Math.sin(i * 37.1) * 2.8;
      data[i * 3 + 1] = ((i * 17) % 31) / 10 - 1.55;
      data[i * 3 + 2] = ((i * 13) % 16) / 12;
    }
    return data;
  }, []);
  const rainTarget = kind === "rainy" || kind === "stormy" ? 0.62 : 0;
  const snowTarget = kind === "snowy" ? 0.88 : 0;

  useFrame((_, delta) => {
    if (rainMaterial.current) rainMaterial.current.opacity = reducedMotion ? rainTarget : THREE.MathUtils.damp(rainMaterial.current.opacity, rainTarget, 3.3, delta);
    if (snowMaterial.current) snowMaterial.current.opacity = reducedMotion ? snowTarget : THREE.MathUtils.damp(snowMaterial.current.opacity, snowTarget, 3.3, delta);

    if (!reducedMotion && rain.current && rainTarget > 0) {
      const position = rain.current.geometry.attributes.position;
      for (let i = 0; i < position.count; i += 2) {
        let y = position.getY(i) - delta * 1.8;
        if (y < -1.8) y = 1.85;
        position.setY(i, y);
        position.setY(i + 1, y - 0.28);
      }
      position.needsUpdate = true;
    }
    if (!reducedMotion && snow.current && snowTarget > 0) {
      const position = snow.current.geometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        let y = position.getY(i) - delta * 0.28;
        if (y < -1.65) y = 1.7;
        position.setY(i, y);
      }
      position.needsUpdate = true;
    }
  });

  useEffect(() => {
    if (!reducedMotion) return;
    if (rainMaterial.current) rainMaterial.current.opacity = rainTarget;
    if (snowMaterial.current) snowMaterial.current.opacity = snowTarget;
  }, [rainTarget, reducedMotion, snowTarget]);

  return <group position={[0.12, 0.02, 1.05]}>
    <lineSegments ref={rain}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[rainPositions, 3]} /></bufferGeometry>
      <lineBasicMaterial ref={rainMaterial} color="#65cbff" transparent opacity={rainTarget} depthWrite={false} />
    </lineSegments>
    <points ref={snow}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[snowPositions, 3]} /></bufferGeometry>
      <pointsMaterial ref={snowMaterial} color="#d8f0ff" size={0.075} transparent opacity={snowTarget} sizeAttenuation depthWrite={false} />
    </points>
  </group>;
}

function Lightning({ kind, reducedMotion }: { kind: WeatherKind; reducedMotion: boolean }) {
  const light = useRef<THREE.PointLight>(null);
  const nextFlash = useRef(0);
  const flashUntil = useRef(0);
  const flashPeak = useRef(2.3);
  const { invalidate } = useThree();
  useEffect(() => { nextFlash.current = 10 + Math.random() * 9; }, []);
  useFrame(({ clock }, delta) => {
    const time = clock.elapsedTime;
    if (kind !== "stormy" || reducedMotion) {
      if (light.current) light.current.intensity = reducedMotion ? (kind === "stormy" ? 0.18 : 0) : THREE.MathUtils.damp(light.current.intensity, 0, 6, delta);
      return;
    }
    if (time >= nextFlash.current) {
      flashUntil.current = time + 0.12;
      flashPeak.current = 2.1 + Math.random() * 0.6;
      nextFlash.current = time + 11 + Math.random() * 13;
    }
    const flash = time < flashUntil.current ? 1 : 0;
    const intensity = 0.18 + flash * flashPeak.current;
    if (light.current) light.current.intensity = THREE.MathUtils.damp(light.current.intensity, intensity, 12, delta);
  });
  useEffect(() => { if (reducedMotion) invalidate(); }, [invalidate, reducedMotion]);
  return <pointLight ref={light} position={[-1.2, 1.4, -0.4]} color="#b6c5ff" intensity={kind === "stormy" ? 0.18 : 0} distance={6} decay={2} />;
}

function Scene({ kind, isDay, reducedMotion }: { kind: WeatherKind; isDay: boolean; reducedMotion: boolean }) {
  const { invalidate } = useThree();
  const skyLight = useRef<THREE.HemisphereLight>(null);
  const rimLight = useRef<THREE.PointLight>(null);
  const palette = kind === "stormy" ? "#9996ff" : kind === "sunny" ? "#8fceff" : kind === "snowy" ? "#c5eaff" : "#72c7e8";
  const targetLightColor = useMemo(() => new THREE.Color(palette), [palette]);
  useFrame((_, delta) => {
    const intensity = kind === "stormy" ? 0.62 : kind === "sunny" ? 1.28 : 0.92;
    if (skyLight.current) skyLight.current.intensity = reducedMotion ? intensity : THREE.MathUtils.damp(skyLight.current.intensity, intensity, 2, delta);
    if (rimLight.current) {
      if (reducedMotion) rimLight.current.color.copy(targetLightColor);
      else rimLight.current.color.lerp(targetLightColor, 1 - Math.exp(-delta * 2));
      const targetIntensity = kind === "sunny" ? 1.25 : 0.62;
      rimLight.current.intensity = reducedMotion ? targetIntensity : THREE.MathUtils.damp(rimLight.current.intensity, targetIntensity, 2, delta);
    }
  });
  useEffect(() => { if (reducedMotion) invalidate(); }, [invalidate, kind, reducedMotion]);

  return <>
    <hemisphereLight ref={skyLight} args={[isDay ? "#dff3ff" : "#7897c4", "#26354c", kind === "sunny" ? 1.28 : 0.92]} />
    <directionalLight position={[-3, 4, 5]} intensity={1.25} color="#eaf6ff" />
    <pointLight ref={rimLight} position={[1.6, 1.2, -2]} intensity={kind === "sunny" ? 1.25 : 0.62} color={palette} distance={9} />
    <SunOrb kind={kind} isDay={isDay} reducedMotion={reducedMotion} />
    <CloudBanks kind={kind} reducedMotion={reducedMotion} />
    <RainStreaks kind={kind} reducedMotion={reducedMotion} />
    <Lightning kind={kind} reducedMotion={reducedMotion} />
  </>;
}

export function Weather3D({ kind, isDay, reducedMotion = false }: { kind: WeatherKind; isDay: boolean; reducedMotion?: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    const element = container.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setNearViewport(entry.isIntersecting), { rootMargin: "100px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={container} className="weather-render-surface">
      <Canvas
        fallback={<div className="scene-3d-fallback" aria-hidden="true" />}
        dpr={reducedMotion ? 1 : [1, 1.15]}
        camera={{ position: [0, 0, 7], fov: 40 }}
        frameloop={reducedMotion || !nearViewport ? "demand" : "always"}
        gl={{ alpha: true, antialias: false, powerPreference: "low-power", stencil: false, depth: true }}
        performance={{ min: 0.7 }}
        aria-label="Animated three-dimensional weather scene"
      >
        <Suspense fallback={null}><Scene kind={kind} isDay={isDay} reducedMotion={reducedMotion} /></Suspense>
      </Canvas>
    </div>
  );
}
