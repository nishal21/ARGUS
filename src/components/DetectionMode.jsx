import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'

// Layer IDs that support detection
const DETECTABLE_LAYERS = ['sat-dot', 'sat-glow', 'flight-icon', 'flight-glow']

export default function DetectionMode({ map, enabled, selectedObject, onSelect }) {
  const popupRef = useRef(null)
  const crosshairRef = useRef(null)

  useEffect(() => {
    if (!map || (!enabled && !selectedObject)) {
      // Cleanup
      if (popupRef.current) {
        popupRef.current.remove()
        popupRef.current = null
      }
      if (crosshairRef.current) {
        crosshairRef.current.remove()
        crosshairRef.current = null
      }
      // Reset cursor
      if (map) map.getCanvas().style.cursor = ''
      return
    }

    // Create popup for data card
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: 'detection-popup',
      maxWidth: '280px',
      offset: [0, -20],
    })
    popupRef.current = popup

    // Create crosshair overlay element
    const crosshairEl = document.createElement('div')
    crosshairEl.className = 'detection-crosshair'
    crosshairEl.innerHTML = `
      <svg viewBox="0 0 60 60" width="60" height="60">
        <line x1="0" y1="30" x2="18" y2="30" stroke="currentColor" stroke-width="1"/>
        <line x1="42" y1="30" x2="60" y2="30" stroke="currentColor" stroke-width="1"/>
        <line x1="30" y1="0" x2="30" y2="18" stroke="currentColor" stroke-width="1"/>
        <line x1="30" y1="42" x2="30" y2="60" stroke="currentColor" stroke-width="1"/>
        <rect x="8" y="8" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="4 4">
          <animate attributeName="stroke-dashoffset" from="0" to="16" dur="2s" repeatCount="indefinite"/>
        </rect>
        <circle cx="30" cy="30" r="4" fill="none" stroke="currentColor" stroke-width="0.5"/>
      </svg>
    `
    crosshairEl.style.display = 'none'
    document.body.appendChild(crosshairEl)
    crosshairRef.current = crosshairEl

    // Helper to render popup
    const renderDataCard = (props, coords) => {
      // Position crosshair overlay at the screen point
      const point = map.project(coords)
      crosshairEl.style.display = 'block'
      crosshairEl.style.left = `${point.x - 30}px`
      crosshairEl.style.top = `${point.y - 30}px`

      let html = ''
      if (props.type === 'satellite') {
        const color = '#00e5ff'
        html = `
          <div class="detection-card">
            <div class="detection-card-header" style="border-color: ${color}">
              <span class="detection-type" style="color: ${color}">⊕ SATELLITE</span>
              <span class="detection-id">${props.name || 'UNKNOWN'}</span>
            </div>
            <div class="detection-card-body">
              <div class="detection-row">
                <span class="detection-key">NORAD ID</span>
                <span class="detection-val">${props.noradId}</span>
              </div>
              <div class="detection-row">
                <span class="detection-key">ALTITUDE</span>
                <span class="detection-val">${props.altitude?.toLocaleString()} KM</span>
              </div>
              <div class="detection-row">
                <span class="detection-key">VELOCITY</span>
                <span class="detection-val">${props.speed?.toLocaleString()} KM/H</span>
              </div>
              <div class="detection-row">
                <span class="detection-key">POSITION</span>
                <span class="detection-val">${coords[1].toFixed(2)}°, ${coords[0].toFixed(2)}°</span>
              </div>
            </div>
          </div>
        `
      } else if (props.type === 'flight') {
        const color = '#ff9500'
        html = `
          <div class="detection-card">
            <div class="detection-card-header" style="border-color: ${color}">
              <span class="detection-type" style="color: ${color}">✈ AIRCRAFT</span>
              <span class="detection-id">${props.callsign}</span>
            </div>
            <div class="detection-card-body">
              <div class="detection-row">
                <span class="detection-key">ICAO</span>
                <span class="detection-val">${props.icao24?.toUpperCase()}</span>
              </div>
              <div class="detection-row">
                <span class="detection-key">ALTITUDE</span>
                <span class="detection-val">${props.altitude?.toLocaleString()} M</span>
              </div>
              <div class="detection-row">
                <span class="detection-key">SPEED</span>
                <span class="detection-val">${props.speed?.toLocaleString()} KM/H</span>
              </div>
              <div class="detection-row">
                <span class="detection-key">HEADING</span>
                <span class="detection-val">${Math.round(props.heading || 0)}°</span>
              </div>
              <div class="detection-row">
                <span class="detection-key">ORIGIN</span>
                <span class="detection-val">${props.originCountry}</span>
              </div>
            </div>
          </div>
        `
      }
      popup.setLngLat(coords).setHTML(html).addTo(map)
    }

    // Mouse move handler
    const onMouseMove = (e) => {
      // Only query layers that exist on the map
      const existingLayers = DETECTABLE_LAYERS.filter((id) => map.getLayer(id))
      if (existingLayers.length === 0) return

      const features = map.queryRenderedFeatures(e.point, { layers: existingLayers })

      if (features.length === 0) {
        map.getCanvas().style.cursor = ''
        if (!selectedObject) {
          popup.remove()
          crosshairEl.style.display = 'none'
        }
        return
      }

      const feature = features[0]
      const props = feature.properties
      const coords = feature.geometry.coordinates.slice()

      map.getCanvas().style.cursor = 'crosshair'
      renderDataCard(props, coords)
    }

    const onMouseLeave = () => {
      map.getCanvas().style.cursor = ''
      if (!selectedObject) {
        popup.remove()
        crosshairEl.style.display = 'none'
      }
    }

    const onClick = (e) => {
      const existingLayers = DETECTABLE_LAYERS.filter((id) => map.getLayer(id))
      if (existingLayers.length === 0) return

      const features = map.queryRenderedFeatures(e.point, { layers: existingLayers })
      if (features.length === 0) {
        if (onSelect) onSelect(null)
        return
      }

      const feature = features[0]

      // If clicking the currently selected object, deselect it
      if (selectedObject &&
        ((selectedObject.type === 'satellite' && feature.properties.noradId === selectedObject.noradId) ||
          (selectedObject.type === 'flight' && feature.properties.icao24 === selectedObject.icao24))) {
        if (onSelect) onSelect(null)
      } else {
        if (onSelect) onSelect(feature.properties)
      }
    }

    map.on('mousemove', onMouseMove)
    map.on('mouseleave', onMouseLeave)
    map.on('click', onClick)

    return () => {
      map.off('mousemove', onMouseMove)
      map.off('mouseleave', onMouseLeave)
      map.off('click', onClick)
      popup.remove()
      crosshairEl.remove()
      map.getCanvas().style.cursor = ''
    }
  }, [map, enabled, onSelect, selectedObject])

  return null
}
