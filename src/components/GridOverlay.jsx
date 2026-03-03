import { useMemo } from 'react'
import * as THREE from 'three'

export default function GridOverlay() {
    // Create latitude lines
    const latLines = useMemo(() => {
        const lines = []
        for (let lat = -80; lat <= 80; lat += 20) {
            const points = []
            const phi = THREE.MathUtils.degToRad(90 - lat)
            for (let lon = 0; lon <= 360; lon += 2) {
                const theta = THREE.MathUtils.degToRad(lon)
                const r = 2.005
                points.push(new THREE.Vector3(
                    r * Math.sin(phi) * Math.cos(theta),
                    r * Math.cos(phi),
                    r * Math.sin(phi) * Math.sin(theta)
                ))
            }
            const geometry = new THREE.BufferGeometry().setFromPoints(points)
            lines.push(geometry)
        }
        return lines
    }, [])

    // Create longitude lines
    const lonLines = useMemo(() => {
        const lines = []
        for (let lon = 0; lon < 360; lon += 30) {
            const points = []
            const theta = THREE.MathUtils.degToRad(lon)
            for (let lat = -90; lat <= 90; lat += 2) {
                const phi = THREE.MathUtils.degToRad(90 - lat)
                const r = 2.005
                points.push(new THREE.Vector3(
                    r * Math.sin(phi) * Math.cos(theta),
                    r * Math.cos(phi),
                    r * Math.sin(phi) * Math.sin(theta)
                ))
            }
            const geometry = new THREE.BufferGeometry().setFromPoints(points)
            lines.push(geometry)
        }
        return lines
    }, [])

    const material = useMemo(() =>
        new THREE.LineBasicMaterial({
            color: '#00ff88',
            transparent: true,
            opacity: 0.07,
            depthTest: true,
        }), [])

    return (
        <group>
            {latLines.map((geo, i) => (
                <line key={`lat-${i}`} geometry={geo} material={material} />
            ))}
            {lonLines.map((geo, i) => (
                <line key={`lon-${i}`} geometry={geo} material={material} />
            ))}
        </group>
    )
}
