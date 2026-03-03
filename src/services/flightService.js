// OpenSky Network via Vite dev proxy (avoids CORS)
const OPENSKY_API = '/api/opensky/states/all'
const OPENSKY_USER = import.meta.env.VITE_OPENSKY_USERNAME || ''
const OPENSKY_PASS = import.meta.env.VITE_OPENSKY_PASSWORD || ''

let cachedFlights = null
let lastFetchTime = 0
const FETCH_INTERVAL = 60_000 // Refresh every 60s (auth allows 60 req/min, public much less)

// Fake flight data if OpenSky is rate limiting us (429)
const FALLBACK_FLIGHTS = [
    { icao24: 'a00001', callsign: 'AFR123', originCountry: 'France', lng: 2.35, lat: 48.85, altitude: 10500, velocity: 850, heading: 45, verticalRate: 0 },
    { icao24: 'a00002', callsign: 'BAW456', originCountry: 'United Kingdom', lng: -0.12, lat: 51.50, altitude: 9400, velocity: 820, heading: 270, verticalRate: 0 },
    { icao24: 'a00003', callsign: 'DLH789', originCountry: 'Germany', lng: 8.56, lat: 50.03, altitude: 11200, velocity: 880, heading: 120, verticalRate: 0 },
    { icao24: 'a00004', callsign: 'UAL101', originCountry: 'United States', lng: -74.00, lat: 40.71, altitude: 10800, velocity: 900, heading: 85, verticalRate: 0 },
    { icao24: 'a00005', callsign: 'UAE202', originCountry: 'United Arab Emirates', lng: 55.27, lat: 25.20, altitude: 12000, velocity: 920, heading: 310, verticalRate: 0 }
]

// Fetch live flight data from OpenSky Network
export async function fetchFlights(maxCount = 150) {
    const now = Date.now()
    if (cachedFlights && now - lastFetchTime < FETCH_INTERVAL) {
        return cachedFlights
    }

    try {
        const res = await fetch(OPENSKY_API)
        if (!res.ok) throw new Error(`OpenSky HTTP ${res.status}`)
        const data = await res.json()

        if (!data.states) return cachedFlights || []

        // Parse OpenSky state vectors
        const flights = data.states
            .filter((s) => s[5] != null && s[6] != null && !s[8]) // Has position, airborne
            .slice(0, maxCount)
            .map((s) => ({
                icao24: s[0],
                callsign: (s[1] || '').trim() || s[0].toUpperCase(),
                originCountry: s[2] || 'UNKNOWN',
                lng: s[5],
                lat: s[6],
                altitude: Math.round(s[7] || s[13] || 0), // meters
                velocity: Math.round((s[9] || 0) * 3.6), // m/s → km/h
                heading: s[10] || 0,
                verticalRate: s[11] || 0,
            }))

        cachedFlights = flights
        lastFetchTime = now
        return flights
    } catch (err) {
        console.warn('[ARGUS] OpenSky fetch failed:', err.message)
        if (!cachedFlights || cachedFlights.length === 0) {
            console.log('[ARGUS] Using fallback synthetic flights')
            cachedFlights = FALLBACK_FLIGHTS
        }
        return cachedFlights
    }
}

// Convert flights to GeoJSON for MapLibre
export function getFlightGeoJSON(flights) {
    const features = flights.map((f) => ({
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: [f.lng, f.lat],
        },
        properties: {
            callsign: f.callsign,
            icao24: f.icao24,
            originCountry: f.originCountry,
            altitude: f.altitude,
            speed: f.velocity,
            heading: f.heading,
            verticalRate: f.verticalRate,
            type: 'flight',
        },
    }))

    return {
        type: 'FeatureCollection',
        features,
    }
}

// Generate a projected flight path (LineString) based on current velocity and heading
export function getFlightProjectedPath(flight, durationMinutes = 30) {
    if (!flight || flight.speed === 0) return null

    // speed is in km/h, convert to degrees per hour (approximate, ignoring latitude scaling for simple visual)
    // 1 deg lat = ~111 km. 
    // To do this simply: project a line forward in latitude/longitude space
    const distanceKm = flight.speed * (durationMinutes / 60)

    // Convert heading from degrees (clockwise from North) to Math angles (radians, counter-clockwise from East)
    const headingRad = (90 - flight.heading) * (Math.PI / 180)

    // 1 degree of latitude is ~111.32 km.
    // 1 degree of longitude is ~111.32 * cos(lat) km.
    const latOffset = (distanceKm * Math.sin(headingRad)) / 111.32
    const lngOffset = (distanceKm * Math.cos(headingRad)) / (111.32 * Math.cos(flight.lat * (Math.PI / 180)))

    const endLat = flight.lat + latOffset
    const endLng = flight.lng + lngOffset

    return {
        type: 'Feature',
        geometry: {
            type: 'LineString',
            coordinates: [
                [flight.lng, flight.lat],
                [endLng, endLat]
            ]
        },
        properties: { type: 'path' }
    }
}
