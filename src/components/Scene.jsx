import { useRef, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import * as THREE from 'three'
import Globe from './Globe'
import Atmosphere from './Atmosphere'
import GridOverlay from './GridOverlay'
import DataMarkers from './DataMarkers'

function CameraTracker({ onCameraChange }) {
    const { camera } = useThree()

    useFrame(() => {
        const pos = camera.position
        const dist = pos.length()

        // Convert camera position to lat/lng
        const lat = THREE.MathUtils.radToDeg(Math.asin(pos.y / dist))
        const lng = THREE.MathUtils.radToDeg(Math.atan2(pos.x, pos.z))

        // Approximate altitude in km (globe radius = 2 units ≈ 6371 km)
        const altitudeKm = Math.max(0, (dist - 2) * 3185.5)

        // Azimuth
        const azimuth = THREE.MathUtils.radToDeg(Math.atan2(pos.x, pos.z))

        onCameraChange({
            lat: lat.toFixed(4),
            lng: lng.toFixed(4),
            altitude: Math.round(altitudeKm),
            azimuth: ((azimuth % 360) + 360) % 360,
        })
    })

    return null
}

export default function Scene({ layers, onCameraChange }) {
    const controlsRef = useRef()

    return (
        <Canvas
            camera={{ position: [0, 2, 6], fov: 45, near: 0.01, far: 1000 }}
            gl={{
                antialias: true,
                toneMapping: THREE.ACESFilmicToneMapping,
                toneMappingExposure: 0.8,
            }}
            style={{ background: '#000005' }}
        >
            {/* Lighting */}
            <ambientLight intensity={0.15} color="#334455" />
            <directionalLight
                position={[5, 3, 5]}
                intensity={1.2}
                color="#aabbcc"
            />
            <pointLight position={[-5, -3, -5]} intensity={0.3} color="#223344" />

            {/* Stars Background */}
            <Stars
                radius={100}
                depth={60}
                count={6000}
                factor={4}
                saturation={0}
                fade
                speed={0.5}
            />

            {/* Globe */}
            <Globe />

            {/* Atmosphere Glow */}
            {layers.atmosphere && <Atmosphere />}

            {/* Grid */}
            {layers.grid && <GridOverlay />}

            {/* Data Markers */}
            {layers.markers && <DataMarkers />}

            {/* Camera Tracker */}
            <CameraTracker onCameraChange={onCameraChange} />

            {/* Controls */}
            <OrbitControls
                ref={controlsRef}
                enablePan={false}
                enableDamping
                dampingFactor={0.08}
                rotateSpeed={0.5}
                zoomSpeed={0.8}
                minDistance={2.3}
                maxDistance={15}
                minPolarAngle={0.1}
                maxPolarAngle={Math.PI - 0.1}
            />
        </Canvas>
    )
}
