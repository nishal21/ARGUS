import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Vertex shader for the globe surface
const globeVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Fragment shader with hex grid pattern and continental glow
const globeFragmentShader = `
  uniform float uTime;
  uniform vec3 uAccentColor;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;

  // Simple hex grid
  float hexGrid(vec2 p, float scale) {
    p *= scale;
    vec2 h = vec2(1.0, sqrt(3.0));
    vec2 a = mod(p, h) - h * 0.5;
    vec2 b = mod(p - h * 0.5, h) - h * 0.5;
    vec2 gv = dot(a, a) < dot(b, b) ? a : b;
    float d = max(abs(gv.x), abs(gv.y * 0.57735 + abs(gv.x) * 0.5));
    return smoothstep(0.45, 0.5, d);
  }

  // Latitude/longitude grid lines
  float latLonGrid(vec2 uv, float divisions) {
    vec2 grid = abs(fract(uv * divisions) - 0.5);
    float line = min(grid.x, grid.y);
    return 1.0 - smoothstep(0.0, 0.02, line);
  }

  void main() {
    // Base dark surface
    vec3 baseColor = vec3(0.02, 0.03, 0.05);

    // Fresnel edge glow
    vec3 viewDir = normalize(-vPosition);
    float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);

    // Hex grid pattern
    float hex = hexGrid(vUv * 2.0 - 1.0, 20.0);

    // Lat/lon grid
    float grid = latLonGrid(vUv, 12.0);
    float fineGrid = latLonGrid(vUv, 36.0) * 0.3;

    // Subtle continental noise approximation using UV
    float continent = sin(vUv.x * 12.0 + vUv.y * 8.0) * 
                     cos(vUv.y * 15.0 - vUv.x * 10.0) * 0.5 + 0.5;
    continent = smoothstep(0.45, 0.55, continent);

    // Compose color
    vec3 color = baseColor;
    color += uAccentColor * hex * 0.06;
    color += uAccentColor * grid * 0.15;
    color += uAccentColor * fineGrid * 0.05;
    color += uAccentColor * continent * 0.04;
    color += uAccentColor * fresnel * 0.3;

    // Pulsing glow
    float pulse = sin(uTime * 0.5) * 0.5 + 0.5;
    color += uAccentColor * fresnel * pulse * 0.1;

    // Simple directional light
    float light = max(dot(vNormal, normalize(vec3(1.0, 0.5, 1.0))), 0.0);
    color += vec3(0.03, 0.04, 0.06) * light;

    gl_FragColor = vec4(color, 1.0);
  }
`

export default function Globe() {
    const meshRef = useRef()
    const materialRef = useRef()

    const uniforms = useMemo(() => ({
        uTime: { value: 0 },
        uAccentColor: { value: new THREE.Color('#00ff88') },
    }), [])

    useFrame(({ clock }) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = clock.getElapsedTime()
        }
        if (meshRef.current) {
            meshRef.current.rotation.y += 0.0005
        }
    })

    return (
        <group>
            {/* Main globe */}
            <mesh ref={meshRef}>
                <sphereGeometry args={[2, 128, 64]} />
                <shaderMaterial
                    ref={materialRef}
                    vertexShader={globeVertexShader}
                    fragmentShader={globeFragmentShader}
                    uniforms={uniforms}
                />
            </mesh>

            {/* Wireframe overlay */}
            <mesh rotation={[0, 0, 0]}>
                <sphereGeometry args={[2.003, 48, 24]} />
                <meshBasicMaterial
                    color="#00ff88"
                    wireframe
                    transparent
                    opacity={0.03}
                />
            </mesh>
        </group>
    )
}
