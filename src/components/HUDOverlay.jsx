import { useState, useEffect } from 'react'

function formatCoord(val, posLabel, negLabel) {
    const num = parseFloat(val)
    const dir = num >= 0 ? posLabel : negLabel
    return `${Math.abs(num).toFixed(4)}° ${dir}`
}

function formatAltitude(km) {
    if (km > 10000) return `${(km / 1000).toFixed(1)}K KM`
    if (km > 100) return `${km.toLocaleString()} KM`
    return `${km} KM`
}

function getZoomLevel(km) {
    if (km > 20000) return 'ORBITAL'
    if (km > 10000) return 'STRATEGIC'
    if (km > 3000) return 'CONTINENTAL'
    if (km > 500) return 'REGIONAL'
    if (km > 50) return 'TACTICAL'
    return 'CLOSE-IN'
}

function CompassRose({ azimuth }) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    const idx = Math.round(azimuth / 45) % 8

    return (
        <div className="hud-compass">
            {directions.map((d, i) => (
                <span key={d}>
                    {i > 0 && <span className="compass-line" />}
                    <span className={`compass-mark ${i === idx ? 'active' : ''}`}>
                        {d}
                    </span>
                </span>
            ))}
        </div>
    )
}

export default function HUDOverlay({ cameraInfo }) {
    const [time, setTime] = useState(new Date())

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    const dateStr = time.toISOString().slice(0, 10)
    const timeStr = time.toISOString().slice(11, 19)

    return (
        <div className="hud-overlay">
            {/* Corner brackets */}
            <div className="hud-corner top-left" />
            <div className="hud-corner top-right" />
            <div className="hud-corner bottom-left" />
            <div className="hud-corner bottom-right" />

            {/* Crosshair */}
            <div className="hud-crosshair">
                <svg className="crosshair-svg" viewBox="0 0 40 40">
                    <line x1="20" y1="0" x2="20" y2="14" />
                    <line x1="20" y1="26" x2="20" y2="40" />
                    <line x1="0" y1="20" x2="14" y2="20" />
                    <line x1="26" y1="20" x2="40" y2="20" />
                    <circle cx="20" cy="20" r="8" />
                    <circle cx="20" cy="20" r="2" />
                </svg>
            </div>

            {/* Compass */}
            <CompassRose azimuth={cameraInfo.azimuth} />

            {/* System Status */}
            <div className="hud-status">
                <span className="hud-status-dot" />
                SYSTEM ONLINE
            </div>

            {/* Date/Time */}
            <div className="hud-datetime">
                {dateStr} &nbsp; {timeStr} UTC
            </div>

            {/* Coordinates */}
            <div className="hud-coords">
                <div className="hud-coord-line">
                    <span className="label">LAT</span>
                    <span className="value">{formatCoord(cameraInfo.lat, 'N', 'S')}</span>
                </div>
                <div className="hud-coord-line">
                    <span className="label">LON</span>
                    <span className="value">{formatCoord(cameraInfo.lng, 'E', 'W')}</span>
                </div>
                <div className="hud-coord-line">
                    <span className="label">HDG</span>
                    <span className="value">{Math.round(cameraInfo.azimuth)}°</span>
                </div>
            </div>

            {/* Zoom / Altitude */}
            <div className="hud-zoom">
                <div className="hud-zoom-line">
                    ALT <span className="value">{formatAltitude(cameraInfo.altitude)}</span>
                </div>
                <div className="hud-zoom-line">
                    VIEW <span className="value">{getZoomLevel(cameraInfo.altitude)}</span>
                </div>
            </div>
        </div>
    )
}
