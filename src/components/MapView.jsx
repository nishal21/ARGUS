import { useRef, useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Protocol } from 'pmtiles'

// Register PMTiles protocol once
let protocolAdded = false
if (!protocolAdded) {
    const protocol = new Protocol()
    maplibregl.addProtocol('pmtiles', protocol.tile)
    protocolAdded = true
}

const API_KEY = import.meta.env.VITE_PROTOMAPS_API_KEY || ''

// Custom dark HUD style matching ARGUS aesthetic
function createArgusStyle(apiKey) {
    return {
        version: 8,
        name: 'ARGUS Dark',
        glyphs: 'https://cdn.protomaps.com/fonts/pbf/{fontstack}/{range}.pbf',
        sources: {
            protomaps: {
                type: 'vector',
                url: `https://api.protomaps.com/tiles/v4.json?key=${apiKey}`,
                attribution: '© <a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
            },
        },
        // Sky & atmosphere config for globe mode
        sky: {
            'sky-color': '#000005',
            'horizon-color': '#000510',
            'fog-color': '#000005',
            'sky-horizon-blend': 0.5,
            'horizon-fog-blend': 0.5,
            'fog-ground-blend': 0.9,
            'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
        },
        layers: [
            // Background (space)
            {
                id: 'background',
                type: 'background',
                paint: {
                    'background-color': '#000005',
                },
            },
            // Earth / land
            {
                id: 'earth',
                type: 'fill',
                source: 'protomaps',
                'source-layer': 'earth',
                paint: {
                    'fill-color': '#0d1117',
                },
            },
            // Water
            {
                id: 'water',
                type: 'fill',
                source: 'protomaps',
                'source-layer': 'water',
                paint: {
                    'fill-color': '#060a10',
                },
            },
            // Land use (parks, forests)
            {
                id: 'landuse_park',
                type: 'fill',
                source: 'protomaps',
                'source-layer': 'landuse',
                filter: ['any',
                    ['in', 'pmap:kind', 'park', 'nature_reserve', 'forest', 'wood'],
                ],
                paint: {
                    'fill-color': 'rgba(0, 255, 136, 0.04)',
                },
            },
            // Land use (other)
            {
                id: 'landuse_other',
                type: 'fill',
                source: 'protomaps',
                'source-layer': 'landuse',
                filter: ['any',
                    ['in', 'pmap:kind', 'residential', 'industrial', 'commercial'],
                ],
                paint: {
                    'fill-color': 'rgba(0, 255, 136, 0.02)',
                },
            },
            // Buildings
            {
                id: 'buildings',
                type: 'fill',
                source: 'protomaps',
                'source-layer': 'buildings',
                paint: {
                    'fill-color': 'rgba(0, 255, 136, 0.06)',
                    'fill-outline-color': 'rgba(0, 255, 136, 0.12)',
                },
            },
            // 3D Buildings
            {
                id: 'buildings-3d',
                type: 'fill-extrusion',
                source: 'protomaps',
                'source-layer': 'buildings',
                minzoom: 14,
                paint: {
                    'fill-extrusion-color': 'rgba(0, 255, 136, 0.08)',
                    'fill-extrusion-height': ['get', 'height'],
                    'fill-extrusion-base': 0,
                    'fill-extrusion-opacity': 0.7,
                },
            },
            // Minor roads
            {
                id: 'roads_minor',
                type: 'line',
                source: 'protomaps',
                'source-layer': 'roads',
                filter: ['any',
                    ['in', 'pmap:kind', 'minor_road', 'other'],
                ],
                paint: {
                    'line-color': 'rgba(0, 255, 136, 0.08)',
                    'line-width': 0.5,
                },
            },
            // Medium roads
            {
                id: 'roads_medium',
                type: 'line',
                source: 'protomaps',
                'source-layer': 'roads',
                filter: ['any',
                    ['in', 'pmap:kind', 'medium_road'],
                ],
                paint: {
                    'line-color': 'rgba(0, 255, 136, 0.12)',
                    'line-width': 1,
                },
            },
            // Major roads
            {
                id: 'roads_major',
                type: 'line',
                source: 'protomaps',
                'source-layer': 'roads',
                filter: ['any',
                    ['in', 'pmap:kind', 'major_road'],
                ],
                paint: {
                    'line-color': 'rgba(0, 255, 136, 0.18)',
                    'line-width': 1.5,
                },
            },
            // Highways
            {
                id: 'roads_highway',
                type: 'line',
                source: 'protomaps',
                'source-layer': 'roads',
                filter: ['any',
                    ['in', 'pmap:kind', 'highway'],
                ],
                paint: {
                    'line-color': 'rgba(0, 255, 136, 0.25)',
                    'line-width': 2,
                },
            },
            // Railways
            {
                id: 'transit_railway',
                type: 'line',
                source: 'protomaps',
                'source-layer': 'transit',
                filter: ['any',
                    ['in', 'pmap:kind', 'rail'],
                ],
                paint: {
                    'line-color': 'rgba(0, 229, 255, 0.12)',
                    'line-width': 0.8,
                    'line-dasharray': [4, 4],
                },
            },
            // Boundaries (country borders)
            {
                id: 'boundaries',
                type: 'line',
                source: 'protomaps',
                'source-layer': 'boundaries',
                paint: {
                    'line-color': 'rgba(0, 255, 136, 0.25)',
                    'line-width': [
                        'interpolate', ['linear'], ['zoom'],
                        0, 0.5,
                        4, 1.5,
                        8, 2,
                    ],
                    'line-dasharray': [3, 2],
                },
            },
            // Place labels - countries
            {
                id: 'places_country',
                type: 'symbol',
                source: 'protomaps',
                'source-layer': 'places',
                filter: ['==', 'pmap:kind', 'country'],
                layout: {
                    'text-field': '{name}',
                    'text-font': ['Noto Sans Medium'],
                    'text-size': [
                        'interpolate', ['linear'], ['zoom'],
                        0, 8,
                        3, 12,
                        6, 14,
                    ],
                    'text-transform': 'uppercase',
                    'text-letter-spacing': 0.15,
                    'text-max-width': 8,
                },
                paint: {
                    'text-color': 'rgba(0, 255, 136, 0.5)',
                    'text-halo-color': '#0a0a0f',
                    'text-halo-width': 2,
                },
            },
            // Place labels - cities
            {
                id: 'places_city',
                type: 'symbol',
                source: 'protomaps',
                'source-layer': 'places',
                filter: ['==', 'pmap:kind', 'city'],
                layout: {
                    'text-field': '{name}',
                    'text-font': ['Noto Sans Medium'],
                    'text-size': [
                        'interpolate', ['linear'], ['zoom'],
                        4, 8,
                        10, 14,
                    ],
                    'text-letter-spacing': 0.08,
                    'text-max-width': 8,
                },
                paint: {
                    'text-color': 'rgba(0, 229, 255, 0.6)',
                    'text-halo-color': '#0a0a0f',
                    'text-halo-width': 1.5,
                },
            },
            // Place labels - towns
            {
                id: 'places_town',
                type: 'symbol',
                source: 'protomaps',
                'source-layer': 'places',
                filter: ['in', 'pmap:kind', 'town', 'village'],
                minzoom: 8,
                layout: {
                    'text-field': '{name}',
                    'text-font': ['Noto Sans Regular'],
                    'text-size': [
                        'interpolate', ['linear'], ['zoom'],
                        8, 8,
                        14, 12,
                    ],
                    'text-max-width': 8,
                },
                paint: {
                    'text-color': 'rgba(0, 229, 255, 0.4)',
                    'text-halo-color': '#0a0a0f',
                    'text-halo-width': 1,
                },
            },
            // Road labels
            {
                id: 'roads_labels',
                type: 'symbol',
                source: 'protomaps',
                'source-layer': 'roads',
                minzoom: 13,
                layout: {
                    'symbol-placement': 'line',
                    'text-field': '{name}',
                    'text-font': ['Noto Sans Regular'],
                    'text-size': 10,
                    'text-max-angle': 30,
                },
                paint: {
                    'text-color': 'rgba(0, 255, 136, 0.35)',
                    'text-halo-color': '#0a0a0f',
                    'text-halo-width': 1,
                },
            },
        ],
    }
}

export default function MapView({ layers, onCameraChange, onMapReady }) {
    const containerRef = useRef(null)
    const mapRef = useRef(null)

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return

        const map = new maplibregl.Map({
            container: containerRef.current,
            style: createArgusStyle(API_KEY),
            center: [30, 20],
            zoom: 1.2,
            minZoom: 0.5,
            maxZoom: 18,
            antialias: true,
            preserveDrawingBuffer: true,
            fadeDuration: 0,
            attributionControl: false,
            maxPitch: 85,
            pitch: 0,
        })

        // Enable globe projection after style loads (v5 API)
        map.on('style.load', () => {
            map.setProjection({ type: 'globe' })
        })

        // Auto-tilt: smoothly increase pitch as zoom increases
        // Orbital (0-4): flat | Regional (4-10): slight tilt | City (10-14): moderate | Street (14+): steep
        let autoPitchEnabled = true
        map.on('zoom', () => {
            if (!autoPitchEnabled) return
            const zoom = map.getZoom()
            let targetPitch = 0
            if (zoom > 14) {
                targetPitch = 60
            } else if (zoom > 10) {
                targetPitch = ((zoom - 10) / 4) * 50  // 0 → 50 between zoom 10-14
            } else if (zoom > 5) {
                targetPitch = ((zoom - 5) / 5) * 10   // 0 → 10 between zoom 5-10
            }

            const currentPitch = map.getPitch()
            // Only auto-adjust if user hasn't manually overridden pitch significantly
            if (Math.abs(currentPitch - targetPitch) > 5) {
                map.easeTo({ pitch: targetPitch, duration: 800 })
            }
        })

        // Disable auto-pitch temporarily when user manually drags pitch
        map.on('pitchstart', () => { autoPitchEnabled = false })
        map.on('pitchend', () => {
            // Re-enable after a delay so user's manual pitch is respected briefly
            setTimeout(() => { autoPitchEnabled = true }, 3000)
        })

        // Track camera position for HUD
        const updateCamera = () => {
            const center = map.getCenter()
            const zoom = map.getZoom()
            const bearing = map.getBearing()

            // Approximate altitude from zoom level
            const altitudeKm = Math.round(40075 / Math.pow(2, zoom + 1))

            onCameraChange({
                lat: center.lat.toFixed(4),
                lng: center.lng.toFixed(4),
                altitude: altitudeKm,
                azimuth: ((bearing % 360) + 360) % 360,
            })
        }

        map.on('move', updateCamera)
        map.on('load', () => {
            updateCamera()
            if (onMapReady) onMapReady(map)
        })

        // Add subtle attribution
        map.addControl(
            new maplibregl.AttributionControl({ compact: true }),
            'bottom-right'
        )

        mapRef.current = map

        return () => {
            map.remove()
            mapRef.current = null
        }
    }, [])

    // Toggle layer visibility based on sidebar
    useEffect(() => {
        const map = mapRef.current
        if (!map || !map.isStyleLoaded()) return

        const setVisibility = (ids, visible) => {
            ids.forEach((id) => {
                if (map.getLayer(id)) {
                    map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
                }
            })
        }

        // terrain toggle -> buildings
        setVisibility(['buildings', 'buildings-3d'], layers.terrain)
        // grid toggle -> boundaries
        setVisibility(['boundaries'], layers.grid)
    }, [layers.terrain, layers.grid])

    return (
        <div
            ref={containerRef}
            style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
            }}
        />
    )
}
