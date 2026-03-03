import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const MARKERS = [
    { name: 'WASHINGTON', lat: 38.9072, lon: -77.0369 },
    { name: 'LONDON', lat: 51.5074, lon: -0.1278 },
    { name: 'MOSCOW', lat: 55.7558, lon: 37.6173 },
    { name: 'TOKYO', lat: 35.6762, lon: 139.6503 },
    { name: 'SYDNEY', lat: -33.8688, lon: 151.2093 },
    { name: 'DUBAI', lat: 25.2048, lon: 55.2708 },
    { name: 'SAO PAULO', lat: -23.5505, lon: -46.6333 },
    { name: 'BEIJING', lat: 39.9042, lon: 116.4074 },
]

function latLonToVec3(lat, lon, radius = 2.01) {
    const phi = THREE.MathUtils.degToRad(90 - lat)
    const theta = THREE.MathUtils.degToRad(lon + 180)
    return new THREE.Vector3(
        -radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
    )
}

// Pulsing marker point sprite shader
const markerVertexShader = `
  uniform float uTime;
  uniform float uScale;

  void main() {
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uScale * (200.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`

const markerFragmentShader = `
  uniform vec3 uColor;
  uniform float uTime;

  void main() {
    float d = length(gl_PointCoord - 0.5);

    // Core dot
    float core = smoothstep(0.15, 0.1, d);

    // Glow ring
    float ring = smoothstep(0.4, 0.3, d) - smoothstep(0.3, 0.2, d);
    float pulse = sin(uTime * 3.0) * 0.5 + 0.5;
    ring *= pulse;

    // Outer glow
    float glow = smoothstep(0.5, 0.0, d) * 0.3;

    float alpha = core + ring * 0.6 + glow;
    vec3 color = uColor * (core + ring * 0.8 + glow * 0.5);

    if (alpha < 0.01) discard;

    gl_FragColor = vec4(color, alpha);
  }
`

function Marker({ position, time }) {
    const uniforms = useMemo(() => ({
        uColor: { value: new THREE.Color('#00ff88') },
        uTime: { value: 0 },
        uScale: { value: 3.0 },
    }), [])

    useFrame(() => {
        uniforms.uTime.value = time.current
    })

    const geo = useMemo(() => {
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.Float32BufferAttribute(position.toArray(), 3))
        return g
    }, [position])

    return (
        <points geometry={geo}>
            <shaderMaterial
                vertexShader={markerVertexShader}
                fragmentShader={markerFragmentShader}
                uniforms={uniforms}
                transparent
                depthWrite={false}
                blending={THREE.AdditiveBlending}
            />
        </points>
    )
}

// Connection arcs between markers
function ConnectionArc({ start, end }) {
    const curve = useMemo(() => {
        const mid = start.clone().add(end).multiplyScalar(0.5)
        const dist = start.distanceTo(end)
        mid.normalize().multiplyScalar(2 + dist * 0.3)

        const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
        return new THREE.BufferGeometry().setFromPoints(curve.getPoints(50))
    }, [start, end])

    return (
        <line geometry={curve}>
            <lineBasicMaterial
                color="#00ff88"
                transparent
                opacity={0.08}
                depthTest={true}
            />
        </line>
    )
}

export default function DataMarkers() {
    const timeRef = useRef(0)

    useFrame(({ clock }) => {
        timeRef.current = clock.getElapsedTime()
    })

    const positions = useMemo(
        () => MARKERS.map((m) => latLonToVec3(m.lat, m.lon)),
        []
    )

    // Create a few connection arcs
    const connections = useMemo(() => [
        [0, 1], // Washington -> London
        [1, 2], // London -> Moscow
        [2, 3], // Moscow -> Tokyo
        [5, 7], // Dubai -> Beijing
        [0, 6], // Washington -> Sao Paulo
        [3, 4], // Tokyo -> Sydney
    ], [])

    return (
        <group>
            {positions.map((pos, i) => (
                <Marker key={MARKERS[i].name} position={pos} time={timeRef} />
            ))}
            {connections.map(([a, b], i) => (
                <ConnectionArc
                    key={`arc-${i}`}
                    start={positions[a]}
                    end={positions[b]}
                />
            ))}
        </group>
    )
}
