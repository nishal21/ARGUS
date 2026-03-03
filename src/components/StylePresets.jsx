const PRESETS = [
    { key: 'tactical', label: 'TACTICAL', dotClass: 'tactical' },
    { key: 'thermal', label: 'THERMAL', dotClass: 'thermal' },
    { key: 'stealth', label: 'STEALTH', dotClass: 'stealth' },
    { key: 'crimson', label: 'CRIMSON', dotClass: 'crimson' },
]

export default function StylePresets({ active, onSelect }) {
    return (
        <div className="presets-grid">
            {PRESETS.map((p) => (
                <button
                    key={p.key}
                    className={`preset-btn ${active === p.key ? 'active' : ''}`}
                    onClick={() => onSelect(p.key)}
                >
                    <span className={`preset-dot ${p.dotClass}`} />
                    {p.label}
                </button>
            ))}
        </div>
    )
}
