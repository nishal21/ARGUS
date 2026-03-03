import {
    Layers,
    Mountain,
    Satellite,
    Grid3x3,
    CloudSun,
    MapPin,
    AlertTriangle,
    PanelLeftClose,
    Monitor,
    Eye,
    Thermometer,
    Crosshair,
    Video,
    Activity,
} from 'lucide-react'
import StylePresets from './StylePresets'

const DATA_LAYERS = [
    {
        key: 'terrain',
        label: '3D TERRAIN',
        sublabel: 'Building Extrusion',
        icon: Mountain,
    },
    {
        key: 'satellite',
        label: 'SAT IMAGERY',
        sublabel: 'Multispectral Feed',
        icon: Satellite,
    },
    {
        key: 'grid',
        label: 'GRID OVERLAY',
        sublabel: 'Boundaries & Borders',
        icon: Grid3x3,
    },
    {
        key: 'atmosphere',
        label: 'ATMO GLOW',
        sublabel: 'Atmospheric Render',
        icon: CloudSun,
    },
    {
        key: 'markers',
        label: 'SAT TRACKING',
        sublabel: 'Celestrak TLE Orbits',
        icon: MapPin,
    },
    {
        key: 'threats',
        label: 'LIVE FLIGHTS',
        sublabel: 'OpenSky Network',
        icon: AlertTriangle,
    },
]

const SHADER_MODES = [
    { key: 'none', label: 'STD' },
    { key: 'crt', label: 'CRT', icon: Monitor },
    { key: 'nvg', label: 'NVG', icon: Eye },
    { key: 'flir', label: 'FLIR', icon: Thermometer },
]

function ToggleSwitch({ active, onClick }) {
    return (
        <div className={`switch ${active ? 'active' : ''}`} onClick={onClick}>
            <div className="switch-knob" />
        </div>
    )
}

function ToggleRow({ layer, active, onToggle }) {
    const Icon = layer.icon
    return (
        <div
            className={`toggle-row ${active ? 'active' : ''}`}
            onClick={onToggle}
        >
            <div className="toggle-info">
                <div className="toggle-icon">
                    <Icon size={14} />
                </div>
                <div>
                    <div className="toggle-label">{layer.label}</div>
                    <div className="toggle-sublabel">{layer.sublabel}</div>
                </div>
            </div>
            <ToggleSwitch active={active} onClick={(e) => e.stopPropagation()} />
        </div>
    )
}

function HUDSlider({ label, value, onChange, min = 0, max = 1, step = 0.01 }) {
    return (
        <div className="slider-row">
            <div className="slider-header">
                <span className="slider-label">{label}</span>
                <span className="slider-value">{Math.round(value * 100)}%</span>
            </div>
            <input
                type="range"
                className="hud-slider"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
            />
        </div>
    )
}

export default function Sidebar({
    open,
    onToggle,
    layers,
    onToggleLayer,
    preset,
    onPreset,
    shaderMode,
    onShaderMode,
    sensitivity,
    onSensitivity,
    pixelation,
    onPixelation,
    detectionMode,
    onDetectionMode,
    cctvEnabled,
    onCctvEnabled,
    trafficEnabled,
    onTrafficEnabled,
}) {
    const activeCount = Object.values(layers).filter(Boolean).length

    return (
        <>
            {/* Toggle button — visible when sidebar is closed */}
            <button
                className={`sidebar-toggle ${open ? 'hidden' : ''}`}
                onClick={onToggle}
                title="Open Panel"
            >
                <Layers size={18} />
            </button>

            {/* Sidebar panel */}
            <div className={`sidebar ${!open ? 'collapsed' : ''}`}>
                {/* Header */}
                <div className="sidebar-header">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <img
                                src="/logo removed.png"
                                alt="ARGUS"
                                style={{
                                    width: '42px',
                                    height: '42px',
                                    objectFit: 'contain',
                                    filter: 'drop-shadow(0 0 8px var(--hud-accent-glow))',
                                }}
                            />
                            <div>
                                <div className="sidebar-title">
                                    ARGUS
                                </div>
                                <div className="classification-badge">
                                    TOP SECRET // SCI
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={onToggle}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--hud-text-dim)',
                                cursor: 'pointer',
                                padding: '4px',
                                marginTop: '-2px',
                                transition: 'color var(--transition-fast)',
                            }}
                            onMouseEnter={(e) => e.target.style.color = 'var(--hud-accent)'}
                            onMouseLeave={(e) => e.target.style.color = 'var(--hud-text-dim)'}
                            title="Close Panel"
                        >
                            <PanelLeftClose size={16} />
                        </button>
                    </div>
                    <div className="sidebar-subtitle">
                        GEOSPATIAL INTELLIGENCE PLATFORM v3.2.1
                    </div>
                </div>

                {/* Body */}
                <div className="sidebar-body">
                    {/* Data Layers */}
                    <div className="section">
                        <div className="section-title">
                            DATA LAYERS
                            <span className="count">{activeCount}/{DATA_LAYERS.length}</span>
                        </div>
                        {DATA_LAYERS.map((layer) => (
                            <ToggleRow
                                key={layer.key}
                                layer={layer}
                                active={layers[layer.key]}
                                onToggle={() => onToggleLayer(layer.key)}
                            />
                        ))}
                    </div>

                    {/* Detection Mode */}
                    <div className="section">
                        <div className="section-title">DETECTION</div>
                        <div
                            className={`toggle-row ${detectionMode ? 'active' : ''}`}
                            onClick={() => onDetectionMode(!detectionMode)}
                        >
                            <div className="toggle-info">
                                <div className="toggle-icon">
                                    <Crosshair size={14} />
                                </div>
                                <div>
                                    <div className="toggle-label">DETECT MODE</div>
                                    <div className="toggle-sublabel">Hover Identification</div>
                                </div>
                            </div>
                            <ToggleSwitch
                                active={detectionMode}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>

                    {/* WebGL Integrations */}
                    <div className="section">
                        <div className="section-title">ADVANCED WEBGL</div>
                        <div
                            className={`toggle-row ${cctvEnabled ? 'active' : ''}`}
                            onClick={() => onCctvEnabled(!cctvEnabled)}
                        >
                            <div className="toggle-info">
                                <div className="toggle-icon">
                                    <Video size={14} />
                                </div>
                                <div>
                                    <div className="toggle-label">CCTV MESH</div>
                                    <div className="toggle-sublabel">UV Projection</div>
                                </div>
                            </div>
                            <ToggleSwitch
                                active={cctvEnabled}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                        <div
                            className={`toggle-row ${trafficEnabled ? 'active' : ''}`}
                            onClick={() => onTrafficEnabled(!trafficEnabled)}
                        >
                            <div className="toggle-info">
                                <div className="toggle-icon">
                                    <Activity size={14} />
                                </div>
                                <div>
                                    <div className="toggle-label">GPU TRAFFIC</div>
                                    <div className="toggle-sublabel">OSM Data Packets</div>
                                </div>
                            </div>
                            <ToggleSwitch
                                active={trafficEnabled}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>

                    {/* Post-Processing Shaders */}
                    <div className="section">
                        <div className="section-title">POST-PROCESSING</div>
                        <div className="shader-modes">
                            {SHADER_MODES.map((s) => (
                                <button
                                    key={s.key}
                                    className={`shader-btn ${shaderMode === s.key ? 'active' : ''}`}
                                    onClick={() => onShaderMode(s.key)}
                                >
                                    {s.icon && <s.icon size={12} />}
                                    {s.label}
                                </button>
                            ))}
                        </div>

                        {shaderMode !== 'none' && (
                            <div className="shader-controls">
                                <HUDSlider
                                    label="SENSITIVITY"
                                    value={sensitivity}
                                    onChange={onSensitivity}
                                />
                                <HUDSlider
                                    label="PIXELATION"
                                    value={pixelation}
                                    onChange={onPixelation}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer — Style Presets */}
                <div className="sidebar-footer">
                    <div className="section" style={{ marginBottom: 0 }}>
                        <div className="section-title">STYLE PRESETS</div>
                        <StylePresets active={preset} onSelect={onPreset} />
                    </div>
                </div>
            </div>
        </>
    )
}
