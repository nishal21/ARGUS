import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import maplibregl from 'maplibre-gl'

export default function CCTVMesh({ map, enabled, videoUrl, targetLngLat, scale = 1 }) {
    const layerId = 'cctv-mesh-layer'
    const rendererRef = useRef(null)
    const sceneRef = useRef(null)
    const cameraRef = useRef(null)
    const meshGroupRef = useRef(null)
    const videoRef = useRef(null)

    useEffect(() => {
        if (!map) return

        if (!enabled) {
            if (map.getLayer(layerId)) {
                map.removeLayer(layerId)
            }
            if (videoRef.current) {
                videoRef.current.pause()
                videoRef.current.removeAttribute('src')
                videoRef.current.load()
            }
            return
        }

        // 1. Setup Video Element
        if (!videoRef.current) {
            const video = document.createElement('video')
            video.crossOrigin = 'anonymous'
            video.loop = true
            video.muted = true
            video.autoplay = true
            video.playsInline = true
            videoRef.current = video
        }
        videoRef.current.src = videoUrl || 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'
        videoRef.current.play().catch(e => console.warn('Video auto-play blocked:', e))

        // 2. Define Custom Layer
        const customLayer = {
            id: layerId,
            type: 'custom',
            renderingMode: '3d',
            onAdd: function (map, gl) {
                this.map = map

                // Three.js Setup
                this.camera = new THREE.Camera()
                this.scene = new THREE.Scene()
                sceneRef.current = this.scene
                cameraRef.current = this.camera

                // Directional light for subtle shading if needed
                const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
                this.scene.add(ambientLight)
                const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6)
                directionalLight.position.set(0, -70, 100).normalize()
                this.scene.add(directionalLight)

                // The video texture
                const texture = new THREE.VideoTexture(videoRef.current)
                texture.colorSpace = THREE.SRGBColorSpace

                // Group to hold all the extruded buildings
                this.meshGroup = new THREE.Group()
                this.scene.add(this.meshGroup)
                meshGroupRef.current = this.meshGroup

                // Helper to extrude buildings
                this.buildGeometry = () => {
                    // Clear existing
                    while (this.meshGroup.children.length > 0) {
                        const child = this.meshGroup.children[0]
                        this.meshGroup.remove(child)
                        child.geometry.dispose()
                        child.material.dispose()
                    }

                    // Query MapLibre for buildings in the raw vector tiles
                    let features = []
                    try {
                        features = map.querySourceFeatures('protomaps', { sourceLayer: 'buildings' })
                    } catch (e) {
                        return
                    }
                    if (!features || features.length === 0) return

                    const mercatorCenter = maplibregl.MercatorCoordinate.fromLngLat(targetLngLat || map.getCenter(), 0)

                    // Simple Material spanning video texture (using additive blending to look like a projection)
                    const material = new THREE.MeshLambertMaterial({
                        map: texture,
                        color: 0x00e5ff, // Cyber-cyan tint
                        transparent: true,
                        opacity: 0.8,
                        blending: THREE.AdditiveBlending,
                        depthTest: true,
                        depthWrite: false, // Don't write depth, let maplibre buildings occlude
                        side: THREE.DoubleSide
                    })

                    // Store unique buildings to avoid overlapping duplicates
                    const uniqueBuildings = new Set()

                    features.forEach(f => {
                        // Skip if we already processed this feature ID (sometimes MapLibre returns duplicates across tiles)
                        if (f.id && uniqueBuildings.has(f.id)) return
                        if (f.id) uniqueBuildings.add(f.id)

                        const height = f.properties.height || 10
                        const minHeight = f.properties.min_height || 0

                        if (f.geometry.type === 'Polygon') {
                            this.createExtrusion(f.geometry.coordinates, height, minHeight, mercatorCenter, material)
                        } else if (f.geometry.type === 'MultiPolygon') {
                            f.geometry.coordinates.forEach(coords => {
                                this.createExtrusion(coords, height, minHeight, mercatorCenter, material)
                            })
                        }
                    })
                }

                this.createExtrusion = (coordinates, extHeight, minExtHeight, center, material) => {
                    const outerRing = coordinates[0]
                    const shape = new THREE.Shape()

                    outerRing.forEach((coord, i) => {
                        // Convert [lng, lat] to MapLibre Mercator
                        const mercCoord = maplibregl.MercatorCoordinate.fromLngLat(coord, 0)

                        // We must offset relative to a center point because Float32 breaks down at global mercator scale
                        const x = mercCoord.x - center.x
                        const y = mercCoord.y - center.y

                        if (i === 0) shape.moveTo(x, y)
                        else shape.lineTo(x, y)
                    })

                    // Convert meters to MapLibre mercator scale (approximate at equator, better to use mercator scaler)
                    const meterInMercator = maplibregl.MercatorCoordinate.fromLngLat(map.getCenter(), 0).meterInMercatorCoordinateUnits()

                    const extrudeSettings = {
                        depth: (extHeight - minExtHeight) * meterInMercator,
                        bevelEnabled: false,
                        steps: 1
                    }

                    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)

                    // Three.js builds extrusions along Z axis for shapes drawn on X,Y.
                    // UV Mapping: To map the video across the city, we can automatically map UVs based on world X/Y bounding box.

                    // Auto-generate plane mapping UVs based on relative position
                    const posAttrib = geometry.attributes.position
                    const uvAttrib = geometry.attributes.uv
                    for (let i = 0; i < posAttrib.count; i++) {
                        const px = posAttrib.getX(i)
                        const py = posAttrib.getY(i)
                        // Map UV based on a generic scale
                        const u = (px * 1000 * scale) + 0.5
                        const v = (py * 1000 * scale) + 0.5
                        uvAttrib.setXY(i, u, v)
                    }

                    const mesh = new THREE.Mesh(geometry, material)
                    // Offset Z by minHeight
                    mesh.position.z = minExtHeight * meterInMercator
                    this.meshGroup.add(mesh)
                }

                // Initial build
                this.buildGeometry()

                // Rebuild periodically to catch new buildings as we pan
                this.buildInterval = setInterval(() => {
                    if (this.map.isZooming() || this.map.isMoving()) return
                    this.buildGeometry()
                }, 2000)

                // Initialize WebGLRenderer using MapLibre's context
                this.renderer = new THREE.WebGLRenderer({
                    canvas: map.getCanvas(),
                    context: gl,
                    antialias: true,
                })
                this.rendererRef = this.renderer
                this.renderer.autoClear = false
            },

            render: function (gl, matrix) {
                if (!this.map || !this.renderer) return

                const centerLngLat = targetLngLat || this.map.getCenter()
                const centerCoord = maplibregl.MercatorCoordinate.fromLngLat(centerLngLat, 0)

                // Transformation matrix: scale and position at the reference coordinate
                const transform = new THREE.Matrix4().makeTranslation(centerCoord.x, centerCoord.y, centerCoord.z)
                    .scale(new THREE.Vector3(1, 1, 1))

                // MapLibre gives us the projection matrix (v4 array)
                const m = new THREE.Matrix4().fromArray(matrix)

                this.camera.projectionMatrix = m.multiply(transform)

                this.renderer.resetState()
                this.renderer.render(this.scene, this.camera)
                this.map.triggerRepaint()
            },

            onRemove: function () {
                clearInterval(this.buildInterval)
                if (this.meshGroup) {
                    this.meshGroup.children.forEach(c => {
                        c.geometry.dispose()
                        c.material.dispose()
                    })
                }
                if (this.renderer) {
                    this.renderer.dispose()
                }
            }
        }

        if (!map.getLayer(layerId)) {
            // Insert above buildings to act as a projection overlay
            // Actually insert immediately above the 'buildings' layer if we can find it
            map.addLayer(customLayer) // If no beforeId, draws on top of everything
        }

        return () => {
            if (map.getLayer(layerId)) map.removeLayer(layerId)
            if (videoRef.current) {
                videoRef.current.pause()
                videoRef.current.removeAttribute('src')
            }
        }
    }, [map, enabled, videoUrl, targetLngLat, scale])

    return null
}
