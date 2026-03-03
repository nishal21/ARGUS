import React, { useState, useEffect } from 'react'
import './LandingPage.css'

const BOOT_SEQUENCE = [
    "INITIALIZING KERNEL...",
    "LOADING CRYPTOGRAPHIC MODULES... [OK]",
    "ESTABLISHING SECURE CONNECTION TO OPENSKY NETWORK...",
    "OPENSKY UPLINK [OK]",
    "FETCHING CELESTRAK TLE ORBITAL DATA...",
    "SATELLITE ORBITS SYNCHRONIZED [OK]",
    "LOADING PROTOMAPS VECTOR TILES...",
    "ENGAGING ADVANCED WEBGL SHADER PIPELINE...",
    "ACCESS GRANTED."
]

export default function LandingPage({ onEnter }) {
    const [bootLines, setBootLines] = useState([])
    const [bootComplete, setBootComplete] = useState(false)
    const [fadingOut, setFadingOut] = useState(false)

    useEffect(() => {
        let currentLine = 0
        const interval = setInterval(() => {
            if (currentLine < BOOT_SEQUENCE.length) {
                setBootLines((prev) => [...prev, BOOT_SEQUENCE[currentLine]])
                currentLine++
            } else {
                setBootComplete(true)
                clearInterval(interval)
            }
        }, 300) // 300ms per line

        return () => clearInterval(interval)
    }, [])

    const handleEnter = () => {
        if (!bootComplete) return
        setFadingOut(true)
        // Wait for CSS fade transition to finish before unmounting
        setTimeout(() => {
            onEnter()
        }, 1200)
    }

    return (
        <div className={`landing-container scanlines ${fadingOut ? 'fade-out' : ''}`}>
            <div className="landing-content">
                <div className="landing-logo-wrapper">
                    <img src={`${import.meta.env.BASE_URL}logo removed.png`} alt="ARGUS Logo" className="landing-logo glitch-img" />
                </div>

                <h1 className="landing-title glitch-text" data-text="ARGUS">ARGUS</h1>
                <h2 className="landing-subtitle">GEOSPATIAL INTELLIGENCE PLATFORM v3.2.1</h2>

                <div className="landing-terminal">
                    {bootLines.map((line, i) => (
                        <div key={i} className="terminal-line">{'>'} {line}</div>
                    ))}
                    {!bootComplete && <div className="terminal-cursor">_</div>}
                </div>

                <div className={`landing-action ${bootComplete ? 'visible' : ''}`}>
                    <button className="uplink-btn" onClick={handleEnter} disabled={!bootComplete}>
                        INITIALIZE UPLINK
                    </button>
                    <p className="warning-text">UNAUTHORIZED ACCESS IS STRICTLY PROHIBITED</p>
                </div>
            </div>

            {/* Background design elements */}
            <div className="grid-bg"></div>
            <div className="vignette"></div>
        </div>
    )
}
