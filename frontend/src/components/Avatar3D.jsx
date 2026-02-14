// ═══════════════════════════════════════════════════════════════════
// Avatar3D.jsx — Cute Robot with Voice Synthesizer Waves
// TV-shaped white head, large dark screen, glowing eyes,
// continuous wave-line mouth, blue accents.
// ═══════════════════════════════════════════════════════════════════
import React, { useRef, useMemo, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
    Environment,
    Html,
    AdaptiveDpr,
    AdaptiveEvents,
    Preload,
    PerformanceMonitor,
    Float,
    RoundedBox,
} from '@react-three/drei';
import * as THREE from 'three';

// ── Palette ──────────────────────────────────────────────────────
const P = {
    body: '#E8EAF0',
    bodyDk: '#CDD2DB',
    screen: '#0C1420',
    blue: '#4A9FE5',
    blueLt: '#7EC8F0',
    blueDk: '#2D6FAF',
    glow: '#A8DCFF',
    white: '#FFFFFF',
    silver: '#9EAAB8',
    orange: '#F0923A',
};

// ── Continuous Voice Waves ───────────────────────────────────────
// 3 smooth ribbon-meshes that undulate like a synthesizer when speaking
function VoiceWaves({ isSpeaking }) {
    const wavesRef = useRef([]);
    const SEGMENTS = 60;

    const configs = useMemo(() => [
        { y: 0.018, phase: 0, amp: 1.0, color: P.blueLt },
        { y: 0, phase: 1.8, amp: 1.3, color: P.white },
        { y: -0.018, phase: 3.6, amp: 0.9, color: P.blueLt },
    ], []);

    // Create PlaneGeometry ribbons (wide and very thin)
    const geos = useMemo(() => configs.map(() => {
        const geo = new THREE.PlaneGeometry(0.3, 0.006, SEGMENTS, 1);
        return geo;
    }), []);

    useEffect(() => () => geos.forEach(g => g.dispose()), [geos]);

    useFrame((state) => {
        const t = state.clock.elapsedTime;

        geos.forEach((geo, idx) => {
            const cfg = configs[idx];
            const pos = geo.attributes.position;
            const vPerRow = SEGMENTS + 1; // vertices per row

            for (let i = 0; i <= SEGMENTS; i++) {
                let waveY = 0;

                if (isSpeaking) {
                    const normX = i / SEGMENTS;
                    // Multi-frequency wave for organic voice-like motion
                    waveY = Math.sin(t * 8 + i * 0.35 + cfg.phase) * 0.014 * cfg.amp
                        + Math.sin(t * 13 + i * 0.55 + cfg.phase * 0.7) * 0.007 * cfg.amp
                        + Math.sin(t * 5.5 + i * 0.2 + cfg.phase * 1.3) * 0.005 * cfg.amp;
                    // Taper at edges
                    const edge = Math.sin(normX * Math.PI);
                    waveY *= edge;
                }

                // Bottom vertex row (indices 0 to SEGMENTS)
                const curBot = pos.getY(i);
                const targetBot = cfg.y + waveY - 0.003;
                pos.setY(i, isSpeaking ? THREE.MathUtils.lerp(curBot, targetBot, 0.2) : THREE.MathUtils.lerp(curBot, cfg.y - 0.003, 0.04));

                // Top vertex row (indices vPerRow to vPerRow + SEGMENTS)
                const curTop = pos.getY(i + vPerRow);
                const targetTop = cfg.y + waveY + 0.003;
                pos.setY(i + vPerRow, isSpeaking ? THREE.MathUtils.lerp(curTop, targetTop, 0.2) : THREE.MathUtils.lerp(curTop, cfg.y + 0.003, 0.04));
            }
            pos.needsUpdate = true;

            // Update emissive intensity
            const mesh = wavesRef.current[idx];
            if (mesh) {
                const targetIntensity = isSpeaking ? 1.8 : 0.5;
                mesh.material.emissiveIntensity = THREE.MathUtils.lerp(
                    mesh.material.emissiveIntensity, targetIntensity, 0.08
                );
            }
        });
    });

    return (
        <group position={[0, -0.08, 0.28]}>
            {configs.map((cfg, idx) => (
                <mesh key={idx} ref={el => { wavesRef.current[idx] = el; }} geometry={geos[idx]}>
                    <meshStandardMaterial
                        color={cfg.color}
                        emissive={cfg.color}
                        emissiveIntensity={0.5}
                        transparent
                        opacity={0.85}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            ))}
        </group>
    );
}

// ── Ear Disc with Rings ──────────────────────────────────────────
function EarDisc({ position, flip }) {
    return (
        <group position={position}>
            {/* Main disc */}
            <mesh rotation={[0, flip ? -Math.PI / 2 : Math.PI / 2, 0]}>
                <cylinderGeometry args={[0.09, 0.09, 0.04, 32]} />
                <meshStandardMaterial color={P.blue} roughness={0.35} metalness={0.3} />
            </mesh>
            {/* Ring 1 */}
            <mesh rotation={[0, flip ? -Math.PI / 2 : Math.PI / 2, 0]}>
                <torusGeometry args={[0.065, 0.006, 8, 32]} />
                <meshStandardMaterial
                    color={P.blueLt} emissive={P.blueLt}
                    emissiveIntensity={0.4} transparent opacity={0.8}
                />
            </mesh>
            {/* Ring 2 */}
            <mesh rotation={[0, flip ? -Math.PI / 2 : Math.PI / 2, 0]}>
                <torusGeometry args={[0.045, 0.005, 8, 32]} />
                <meshStandardMaterial
                    color={P.blueLt} emissive={P.blueLt}
                    emissiveIntensity={0.3} transparent opacity={0.6}
                />
            </mesh>
            {/* Center dot */}
            <mesh position={[flip ? -0.02 : 0.02, 0, 0]}>
                <sphereGeometry args={[0.015, 12, 12]} />
                <meshStandardMaterial color={P.blueDk} roughness={0.3} metalness={0.5} />
            </mesh>
        </group>
    );
}

// ── Main Robot ───────────────────────────────────────────────────
function CuteRobot({ isSpeaking, isListening, isThinking, emotion }) {
    const headRef = useRef();
    const bodyRef = useRef();
    const armLRef = useRef();
    const armRRef = useRef();
    const eyeLRef = useRef();
    const eyeRRef = useRef();
    const antLRef = useRef();
    const antRRef = useRef();

    const mats = useMemo(() => ({
        body: new THREE.MeshStandardMaterial({
            color: P.body, roughness: 0.5, metalness: 0.05, envMapIntensity: 0.7,
        }),
        bodyDk: new THREE.MeshStandardMaterial({
            color: P.bodyDk, roughness: 0.45, metalness: 0.08,
        }),
        screen: new THREE.MeshStandardMaterial({
            color: P.screen, roughness: 0.85, metalness: 0.1,
        }),
        silver: new THREE.MeshStandardMaterial({
            color: P.silver, roughness: 0.2, metalness: 0.9, envMapIntensity: 1.2,
        }),
        blue: new THREE.MeshStandardMaterial({
            color: P.blue, roughness: 0.35, metalness: 0.25,
        }),
    }), []);

    useEffect(() => () => Object.values(mats).forEach(m => m.dispose()), [mats]);

    useFrame((state) => {
        const t = state.clock.elapsedTime;

        // Head movement
        if (headRef.current) {
            let rx = Math.sin(t * 0.4) * 0.015, ry = 0, rz = Math.sin(t * 0.3) * 0.01;
            if (isThinking) { rz = Math.sin(t * 0.5) * 0.06; rx = -0.04; }
            else if (isListening) { rx = Math.sin(t * 0.8) * 0.035; }
            else if (isSpeaking) { ry = Math.sin(t * 1.2) * 0.02; }
            headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, rx, 0.04);
            headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, ry, 0.04);
            headRef.current.rotation.z = THREE.MathUtils.lerp(headRef.current.rotation.z, rz, 0.04);
        }

        // Body breathing
        if (bodyRef.current) {
            bodyRef.current.scale.x = 1 + Math.sin(t * 1.2) * 0.01;
            bodyRef.current.scale.y = 1 + Math.sin(t * 1.2) * 0.015;
        }

        // Arm sway
        if (armLRef.current) {
            const swing = isSpeaking ? Math.sin(t * 2) * 0.15 : Math.sin(t * 0.6) * 0.05;
            armLRef.current.rotation.z = THREE.MathUtils.lerp(armLRef.current.rotation.z, 0.25 + swing, 0.04);
            armLRef.current.rotation.x = Math.sin(t * 0.8 + 1) * 0.06;
        }
        if (armRRef.current) {
            const swing = isSpeaking ? Math.sin(t * 2 + 1) * 0.15 : Math.sin(t * 0.6 + 2) * 0.05;
            armRRef.current.rotation.z = THREE.MathUtils.lerp(armRRef.current.rotation.z, -0.25 - swing, 0.04);
            armRRef.current.rotation.x = Math.sin(t * 0.8) * 0.06;
        }

        // Eye squint
        [eyeLRef, eyeRRef].forEach(ref => {
            if (ref.current) {
                let sy = 1;
                if (emotion === 'happy' || (!isSpeaking && !isThinking && !isListening)) sy = 0.85;
                if (isListening) sy = 1.1;
                ref.current.scale.y = THREE.MathUtils.lerp(ref.current.scale.y, sy, 0.06);
            }
        });

        // Antenna tips pulse
        [antLRef, antRRef].forEach(ref => {
            if (ref.current) {
                const pulse = isThinking ? 1.5 + Math.sin(t * 3) * 1 : 0.3 + Math.sin(t * 1.2) * 0.2;
                ref.current.material.emissiveIntensity = pulse;
            }
        });
    });

    return (
        <group ref={headRef}>
            {/* ═══ HEAD ═══ — TV/monitor shape, wider than tall */}
            <RoundedBox args={[0.62, 0.48, 0.4]} radius={0.12} smoothness={8} material={mats.body} />

            {/* Top surface detail */}
            <mesh position={[0, 0.24, 0]} material={mats.bodyDk}>
                <boxGeometry args={[0.4, 0.02, 0.25]} />
            </mesh>

            {/* ═══ DARK FACE SCREEN ═══ — large rounded area */}
            <RoundedBox
                args={[0.5, 0.34, 0.05]}
                radius={0.1}
                smoothness={8}
                position={[0, -0.01, 0.19]}
                material={mats.screen}
            />

            {/* Screen bezel */}
            <RoundedBox
                args={[0.52, 0.36, 0.03]}
                radius={0.11}
                smoothness={8}
                position={[0, -0.01, 0.178]}
                material={mats.bodyDk}
            />

            {/* ═══ EYES ═══ */}
            <mesh ref={eyeLRef} position={[-0.1, 0.06, 0.22]}>
                <sphereGeometry args={[0.048, 32, 32]} />
                <meshStandardMaterial
                    color={P.glow} emissive={P.glow} emissiveIntensity={2}
                    transparent opacity={0.95}
                />
            </mesh>
            <mesh ref={eyeRRef} position={[0.1, 0.06, 0.22]}>
                <sphereGeometry args={[0.048, 32, 32]} />
                <meshStandardMaterial
                    color={P.glow} emissive={P.glow} emissiveIntensity={2}
                    transparent opacity={0.95}
                />
            </mesh>
            <pointLight position={[0, 0.06, 0.3]} color={P.glow} intensity={0.5} distance={1.5} />

            {/* ═══ VOICE SYNTHESIZER WAVES ═══ */}
            <VoiceWaves isSpeaking={isSpeaking} />

            {/* ═══ EAR DISCS ═══ */}
            <EarDisc position={[-0.34, 0, 0]} flip={false} />
            <EarDisc position={[0.34, 0, 0]} flip={true} />

            {/* ═══ ANTENNAS ═══ (two) */}
            <group position={[-0.08, 0.3, -0.05]}>
                <mesh material={mats.silver}>
                    <cylinderGeometry args={[0.006, 0.006, 0.14, 6]} />
                </mesh>
                <mesh ref={antLRef} position={[0, 0.08, 0]}>
                    <sphereGeometry args={[0.015, 12, 12]} />
                    <meshStandardMaterial
                        color={P.orange} emissive={P.orange} emissiveIntensity={0.5}
                        roughness={0.2}
                    />
                </mesh>
            </group>
            <group position={[0.08, 0.3, -0.05]}>
                <mesh material={mats.silver}>
                    <cylinderGeometry args={[0.006, 0.006, 0.12, 6]} />
                </mesh>
                <mesh ref={antRRef} position={[0, 0.07, 0]}>
                    <sphereGeometry args={[0.015, 12, 12]} />
                    <meshStandardMaterial
                        color={P.orange} emissive={P.orange} emissiveIntensity={0.5}
                        roughness={0.2}
                    />
                </mesh>
            </group>

            {/* ═══ NECK ═══ */}
            <group position={[0, -0.32, 0]}>
                <mesh material={mats.silver}>
                    <cylinderGeometry args={[0.05, 0.06, 0.08, 12]} />
                </mesh>
                <mesh material={mats.silver}>
                    <sphereGeometry args={[0.04, 12, 12]} />
                </mesh>
            </group>

            {/* ═══ BODY ═══ */}
            <group ref={bodyRef} position={[0, -0.52, 0]}>
                <mesh material={mats.body}>
                    <capsuleGeometry args={[0.16, 0.14, 12, 24]} />
                </mesh>
                {/* Chest detail */}
                <mesh position={[0, 0.04, 0.14]}>
                    <circleGeometry args={[0.03, 24]} />
                    <meshStandardMaterial
                        color={P.blueLt} emissive={P.blueLt}
                        emissiveIntensity={0.3} transparent opacity={0.5}
                    />
                </mesh>

                {/* Arms */}
                {[-1, 1].map(side => (
                    <group key={side} ref={side === -1 ? armLRef : armRRef} position={[side * 0.2, 0.02, 0]} rotation={[0, 0, side * 0.25]}>
                        <mesh material={mats.silver}>
                            <sphereGeometry args={[0.03, 10, 10]} />
                        </mesh>
                        <mesh position={[0, -0.08, 0]} material={mats.silver}>
                            <capsuleGeometry args={[0.018, 0.06, 6, 10]} />
                        </mesh>
                        <mesh position={[0, -0.13, 0]} material={mats.silver}>
                            <sphereGeometry args={[0.024, 10, 10]} />
                        </mesh>
                        <mesh position={[side * 0.015, -0.2, 0]} rotation={[0, 0, side * -0.3]} material={mats.silver}>
                            <capsuleGeometry args={[0.016, 0.05, 6, 10]} />
                        </mesh>
                        <mesh position={[side * 0.03, -0.26, 0]} material={mats.blue}>
                            <sphereGeometry args={[0.03, 10, 10]} />
                        </mesh>
                    </group>
                ))}
            </group>
        </group>
    );
}

// ── Scene Lighting ───────────────────────────────────────────────
function SceneLighting() {
    return (
        <>
            <ambientLight intensity={0.55} color="#E8EAF0" />
            <directionalLight position={[3, 4, 5]} intensity={1.1} color="#FFF8F0" />
            <directionalLight position={[-3, 2, 4]} intensity={0.45} color="#D8E8FF" />
            <pointLight position={[0, 1, -3]} intensity={0.25} color="#B4C6E0" distance={8} />
            <pointLight position={[0, -2, 2]} intensity={0.2} color="#E8EAF0" distance={6} />
            <spotLight position={[0, 5, 3]} angle={0.4} penumbra={1} intensity={0.3} color="#FFFFFF" distance={12} />
        </>
    );
}

// ── Loading ──────────────────────────────────────────────────────
function LoadingFallback() {
    return (
        <Html center>
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                color: P.blue, fontFamily: 'Inter, sans-serif',
            }}>
                <div style={{
                    width: 36, height: 36,
                    border: `3px solid ${P.bodyDk}`,
                    borderTop: `3px solid ${P.blue}`,
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                }} />
                <p style={{ marginTop: 10, fontSize: 11, opacity: 0.8 }}>Loading…</p>
            </div>
        </Html>
    );
}

// ── Main Export ──────────────────────────────────────────────────
export default function Avatar3D({
    isSpeaking = false,
    isListening = false,
    isThinking = false,
    emotion = 'neutral',
    style = {},
}) {
    const [dpr, setDpr] = useState(1.5);

    return (
        <div style={{
            width: '100%', height: '100%', minHeight: 200,
            borderRadius: 'inherit', overflow: 'hidden',
            background: 'transparent',
            ...style,
        }}>
            <Canvas
                camera={{ position: [0, -0.1, 3.6], fov: 32 }}
                dpr={dpr}
                gl={{
                    antialias: true,
                    toneMapping: THREE.ACESFilmicToneMapping,
                    toneMappingExposure: 1.2,
                    outputColorSpace: THREE.SRGBColorSpace,
                    powerPreference: 'high-performance',
                    alpha: true,
                }}
            >
                <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.5)} />
                <Suspense fallback={<LoadingFallback />}>
                    <SceneLighting />
                    <Float speed={1.5} rotationIntensity={0.08} floatIntensity={0.35}>
                        <CuteRobot
                            isSpeaking={isSpeaking}
                            isListening={isListening}
                            isThinking={isThinking}
                            emotion={emotion}
                        />
                    </Float>
                    <Environment preset="night" environmentIntensity={0.25} />
                </Suspense>
                <AdaptiveDpr pixelated />
                <AdaptiveEvents />
                <Preload all />
            </Canvas>
        </div>
    );
}
