import { useMemo } from 'react'
import * as THREE from 'three'

const atmosphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const atmosphereFragmentShader = `
  uniform vec3 uColor;
  uniform float uIntensity;

  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vec3 viewDir = normalize(-vPosition);
    float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 2.5);

    // Outer glow
    float glow = fresnel * uIntensity;

    // Fade based on angle from light source
    float light = max(dot(vNormal, normalize(vec3(1.0, 0.3, 0.8))), 0.0);
    glow *= (0.5 + light * 0.5);

    vec3 color = uColor * glow;
    float alpha = glow * 0.6;

    gl_FragColor = vec4(color, alpha);
  }
`

export default function Atmosphere() {
    const uniforms = useMemo(() => ({
        uColor: { value: new THREE.Color('#00ff88') },
        uIntensity: { value: 1.5 },
    }), [])

    return (
        <group>
            {/* Inner atmosphere */}
            <mesh>
                <sphereGeometry args={[2.08, 64, 32]} />
                <shaderMaterial
                    vertexShader={atmosphereVertexShader}
                    fragmentShader={atmosphereFragmentShader}
                    uniforms={uniforms}
                    transparent
                    side={THREE.BackSide}
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </mesh>

            {/* Outer glow ring */}
            <mesh>
                <sphereGeometry args={[2.2, 64, 32]} />
                <shaderMaterial
                    vertexShader={atmosphereVertexShader}
                    fragmentShader={atmosphereFragmentShader}
                    uniforms={{
                        uColor: { value: new THREE.Color('#00ff88') },
                        uIntensity: { value: 0.8 },
                    }}
                    transparent
                    side={THREE.BackSide}
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </mesh>
        </group>
    )
}
