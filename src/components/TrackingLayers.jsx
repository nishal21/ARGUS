import { useEffect, useRef, useState } from 'react'
import { fetchSatellites, getSatelliteGeoJSON, getSatelliteOrbitLine } from '../services/satelliteService'
import { fetchFlights, getFlightGeoJSON, getFlightProjectedPath } from '../services/flightService'

const SAT_SOURCE = 'argus-satellites'
const FLIGHT_SOURCE = 'argus-flights'
const PATH_SOURCE = 'argus-selected-path'
const EMPTY_GJ = { type: 'FeatureCollection', features: [] }

// ── Layer definitions ──────────────────────────────────────
const SAT_LAYERS = [
    {
        id: 'sat-glow', type: 'circle', source: SAT_SOURCE,
        paint: { 'circle-radius': 8, 'circle-color': 'rgba(0,229,255,0.15)', 'circle-blur': 1 }
    },
    {
        id: 'sat-dot', type: 'circle', source: SAT_SOURCE,
        paint: { 'circle-radius': 3, 'circle-color': '#00e5ff', 'circle-stroke-width': 1, 'circle-stroke-color': 'rgba(0,229,255,0.6)' }
    },
    {
        id: 'sat-label', type: 'symbol', source: SAT_SOURCE,
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 9, 'text-offset': [0, 1.5], 'text-anchor': 'top', 'text-max-width': 10 },
        paint: { 'text-color': 'rgba(0,229,255,0.7)', 'text-halo-color': '#000005', 'text-halo-width': 1 }
    },
]

const FLIGHT_LAYERS = [
    {
        id: 'flight-glow', type: 'circle', source: FLIGHT_SOURCE,
        paint: { 'circle-radius': 6, 'circle-color': 'rgba(255,149,0,0.12)', 'circle-blur': 1 }
    },
    {
        id: 'flight-icon', type: 'symbol', source: FLIGHT_SOURCE,
        layout: { 'icon-image': 'flight-arrow', 'icon-size': 0.7, 'icon-rotate': ['get', 'heading'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true }
    },
    {
        id: 'flight-label', type: 'symbol', source: FLIGHT_SOURCE, minzoom: 5,
        layout: { 'text-field': ['get', 'callsign'], 'text-font': ['Noto Sans Regular'], 'text-size': 8, 'text-offset': [0, 1.8], 'text-anchor': 'top', 'text-max-width': 8 },
        paint: { 'text-color': 'rgba(255,149,0,0.6)', 'text-halo-color': '#000005', 'text-halo-width': 1 }
    },
]

const PATH_LAYER = {
    id: 'selected-path-line',
    type: 'line',
    source: PATH_SOURCE,
    layout: {
        'line-join': 'round',
        'line-cap': 'round'
    },
    paint: {
        'line-color': ['case', ['==', ['get', 'type'], 'satellite'], '#00e5ff', '#ff9500'],
        'line-width': 1.5,
        'line-opacity': 0.6,
        'line-dasharray': [2, 2]
    }
}

function makeFlightArrow() {
    const size = 24
    const c = document.createElement('canvas')
    c.width = c.height = size
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#ff9500'
    ctx.strokeStyle = 'rgba(255,149,0,0.8)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(12, 2)
    ctx.lineTo(20, 20)
    ctx.lineTo(12, 16)
    ctx.lineTo(4, 20)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    // Extract raw pixel data for MapLibre v5 compatibility
    const imgData = ctx.getImageData(0, 0, size, size)
    return { width: size, height: size, data: new Uint8Array(imgData.data.buffer) }
}

export default function TrackingLayers({ map, showSatellites, showFlights, selectedObject }) {
    const [ready, setReady] = useState(false)
    const satTimer = useRef(null)
    const flightTimer = useRef(null)
    const satData = useRef([])
    const flightData = useRef([])

    // ── Step 1: Add sources + layers once when map is available ──
    useEffect(() => {
        if (!map) return
        // Map is guaranteed loaded (onMapReady fires after 'load')
        try {
            if (!map.hasImage('flight-arrow')) {
                map.addImage('flight-arrow', makeFlightArrow())
            }
            if (!map.getSource(SAT_SOURCE)) {
                map.addSource(SAT_SOURCE, { type: 'geojson', data: EMPTY_GJ })
                SAT_LAYERS.forEach((l) => map.addLayer(l))
            }
            if (!map.getSource(FLIGHT_SOURCE)) {
                map.addSource(FLIGHT_SOURCE, { type: 'geojson', data: EMPTY_GJ })
                FLIGHT_LAYERS.forEach((l) => map.addLayer(l))
            }
            if (!map.getSource(PATH_SOURCE)) {
                map.addSource(PATH_SOURCE, { type: 'geojson', data: EMPTY_GJ })
                map.addLayer(PATH_LAYER)
            }
            console.log('[ARGUS] Tracking layers initialized')
            setReady(true)
        } catch (e) {
            console.error('[ARGUS] Layer init error:', e)
        }
    }, [map])

    // ── Step 2: Satellite tracking ──
    useEffect(() => {
        if (!map || !ready) return

        SAT_LAYERS.forEach((l) => {
            if (map.getLayer(l.id))
                map.setLayoutProperty(l.id, 'visibility', showSatellites ? 'visible' : 'none')
        })

        if (!showSatellites) return

        let cancelled = false

            ; (async () => {
                satData.current = await fetchSatellites(30)
                if (cancelled) return
                console.log(`[ARGUS] Tracking ${satData.current.length} satellites`)

                const tick = () => {
                    if (cancelled || !map.getSource(SAT_SOURCE)) return
                    map.getSource(SAT_SOURCE).setData(getSatelliteGeoJSON(satData.current))
                }
                tick()
                satTimer.current = setInterval(tick, 2000)
            })()

        return () => { cancelled = true; clearInterval(satTimer.current) }
    }, [map, ready, showSatellites])

    // ── Step 3: Flight tracking ──
    useEffect(() => {
        if (!map || !ready) return

        FLIGHT_LAYERS.forEach((l) => {
            if (map.getLayer(l.id))
                map.setLayoutProperty(l.id, 'visibility', showFlights ? 'visible' : 'none')
        })

        if (!showFlights) return

        let cancelled = false

            ; (async () => {
                const flights = await fetchFlights(150)
                flightData.current = flights
                if (cancelled) return
                console.log(`[ARGUS] Tracking ${flights.length} flights`)
                if (map.getSource(FLIGHT_SOURCE))
                    map.getSource(FLIGHT_SOURCE).setData(getFlightGeoJSON(flights))

                flightTimer.current = setInterval(async () => {
                    const f = await fetchFlights(150)
                    flightData.current = f
                    if (!cancelled && map.getSource(FLIGHT_SOURCE))
                        map.getSource(FLIGHT_SOURCE).setData(getFlightGeoJSON(f))
                }, 60_000)
            })()

        return () => { cancelled = true; clearInterval(flightTimer.current) }
    }, [map, ready, showFlights])

    // ── Step 4: Selected object path rendering ──
    useEffect(() => {
        if (!map || !ready) return

        if (!selectedObject) {
            if (map.getSource(PATH_SOURCE)) {
                map.getSource(PATH_SOURCE).setData(EMPTY_GJ)
            }
            return
        }

        let pathFeature = null

        if (selectedObject.type === 'satellite') {
            const rawSat = satData.current.find(s => s.noradId === selectedObject.noradId)
            if (rawSat) {
                pathFeature = getSatelliteOrbitLine(rawSat.satrec, 90, 100)
                if (pathFeature) pathFeature.properties.type = 'satellite'
            }
        } else if (selectedObject.type === 'flight') {
            const rawFlight = flightData.current.find(f => f.icao24 === selectedObject.icao24)
            if (rawFlight) {
                pathFeature = getFlightProjectedPath(rawFlight, 20) // 20 min projection
                if (pathFeature) pathFeature.properties.type = 'flight'
            }
        }

        if (map.getSource(PATH_SOURCE)) {
            map.getSource(PATH_SOURCE).setData(pathFeature ? { type: 'FeatureCollection', features: [pathFeature] } : EMPTY_GJ)
        }
    }, [map, ready, selectedObject])

    return null
}
