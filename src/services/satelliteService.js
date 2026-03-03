import * as satellite from 'satellite.js'

// Featured satellites to track (mix of ISS, Starlink, GPS, weather, etc.)
const CELESTRAK_GROUPS = [
    { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle', label: 'Stations' },
    { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle', label: 'Active' },
]

// Parse TLE text into satellite records
function parseTLEData(tleText) {
    const lines = tleText.trim().split('\n').map((l) => l.trim())
    const sats = []
    for (let i = 0; i + 2 < lines.length; i += 3) {
        const name = lines[i].replace(/^0 /, '')
        const tleLine1 = lines[i + 1]
        const tleLine2 = lines[i + 2]
        if (!tleLine1.startsWith('1 ') || !tleLine2.startsWith('2 ')) continue
        try {
            const satrec = satellite.twoline2satrec(tleLine1, tleLine2)
            const noradId = tleLine1.substring(2, 7).trim()
            sats.push({ name, noradId, satrec, tleLine1, tleLine2 })
        } catch (e) {
            // Skip malformed TLEs
        }
    }
    return sats
}

// Calculate current position of a satellite
export function getSatellitePosition(satrec, date = new Date()) {
    const posVel = satellite.propagate(satrec, date)
    if (!posVel.position || typeof posVel.position === 'boolean') return null

    const gmst = satellite.gstime(date)
    const geo = satellite.eciToGeodetic(posVel.position, gmst)

    const lng = satellite.degreesLong(geo.longitude)
    const lat = satellite.degreesLat(geo.latitude)
    const alt = geo.height // km

    // Velocity magnitude (km/s)
    let speed = 0
    if (posVel.velocity && typeof posVel.velocity !== 'boolean') {
        const v = posVel.velocity
        speed = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
    }

    return { lat, lng, alt, speed }
}

// Satellite data cache
let cachedSatellites = []
let lastFetchTime = 0
const FETCH_INTERVAL = 300_000 // Refresh TLE every 5 minutes

// Fallback TLE data if Celestrak blocks the request or is down
const FALLBACK_TLES = `
0 ISS (ZARYA)
1 25544U 98067A   23306.49133317  .00018520  00000-0  33418-3 0  9990
2 25544  51.6418 205.5173 0004273 293.0768 181.7132 15.50085810423185
0 HST
1 20580U 90037B   23306.48514115  .00001007  00000-0  56260-4 0  9997
2 20580  28.4693  88.3970 0002570 307.7289 125.7516 15.09349896451635
`

// Fetch satellite TLE data from Celestrak
export async function fetchSatellites(maxCount = 30) {
    const now = Date.now()
    if (cachedSatellites.length > 0 && now - lastFetchTime < FETCH_INTERVAL) {
        return cachedSatellites
    }

    try {
        // Fetch stations group (ISS, Tiangong, etc. — small, reliable set)
        const res = await fetch(CELESTRAK_GROUPS[0].url)
        if (!res.ok) throw new Error(`Celestrak HTTP ${res.status}`)
        const text = await res.text()
        let sats = parseTLEData(text)

        // Limit to maxCount satellites
        sats = sats.slice(0, maxCount)

        cachedSatellites = sats
        lastFetchTime = now
        return sats
    } catch (err) {
        console.warn('[ARGUS] Celestrak fetch failed:', err.message)
        // Parse fallback TLEs if we have no cached data
        if (cachedSatellites.length === 0) {
            console.log('[ARGUS] Using fallback satellite TLEs')
            cachedSatellites = parseTLEData(FALLBACK_TLES)
        }
        return cachedSatellites
    }
}

// Get GeoJSON features for all tracked satellites
export function getSatelliteGeoJSON(satellites) {
    const now = new Date()
    const features = []

    for (const sat of satellites) {
        const pos = getSatellitePosition(sat.satrec, now)
        if (!pos) continue

        features.push({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [pos.lng, pos.lat],
            },
            properties: {
                name: sat.name,
                noradId: sat.noradId,
                altitude: Math.round(pos.alt),
                speed: Math.round(pos.speed * 3600), // km/h
                type: 'satellite',
            },
        })
    }

    return {
        type: 'FeatureCollection',
        features,
    }
}

// Generate an orbital path (LineString) for a specific satellite
export function getSatelliteOrbitLine(satrec, durationMinutes = 90, segments = 60) {
    if (!satrec) return null
    const coords = []
    const now = new Date()

    // Calculate orbit from (-duration/2) to (+duration/2)
    const stepMs = (durationMinutes * 60 * 1000) / segments
    const startTimeStr = now.getTime() - (durationMinutes * 60 * 1000) / 2

    for (let i = 0; i <= segments; i++) {
        const time = new Date(startTimeStr + i * stepMs)
        const pos = getSatellitePosition(satrec, time)
        if (pos) {
            // Check for wrap-around across the antimeridian to prevent horizontal lines across map
            if (coords.length > 0) {
                const prev = coords[coords.length - 1]
                if (Math.abs(pos.lng - prev[0]) > 180) {
                    // Start a new line segment (MapLibre multi-linestring would be better, but we can just split or ignore)
                    // For WebGL globes, wrapping often renders correctly if coordinates just wrap. 
                    // MapLibre v5 globe mode handles antimeridian crossing automatically.
                }
            }
            coords.push([pos.lng, pos.lat])
        }
    }

    return {
        type: 'Feature',
        geometry: {
            type: 'LineString',
            coordinates: coords
        },
        properties: { type: 'path' }
    }
}
