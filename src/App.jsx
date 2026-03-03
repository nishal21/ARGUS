import { useState, useCallback } from 'react'
import MapView from './components/MapView'
import TrackingLayers from './components/TrackingLayers'
import DetectionMode from './components/DetectionMode'
import PostProcessing from './components/PostProcessing'
import Sidebar from './components/Sidebar'
import HUDOverlay from './components/HUDOverlay'
import CCTVMesh from './components/CCTVMesh'
import TrafficSimulation from './components/TrafficSimulation'

const DEFAULT_LAYERS = {
  terrain: true,
  satellite: false,
  grid: true,
  atmosphere: true,
  markers: true,   // satellites
  threats: true,    // flights
}

export default function App() {
  const [preset, setPreset] = useState('tactical')
  const [layers, setLayers] = useState(DEFAULT_LAYERS)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [cameraInfo, setCameraInfo] = useState({
    lat: 0,
    lng: 0,
    altitude: 35000,
    azimuth: 0,
  })

  // Post-processing
  const [shaderMode, setShaderMode] = useState('none')
  const [sensitivity, setSensitivity] = useState(0.5)
  const [pixelation, setPixelation] = useState(0)

  // Map instance ref for tracking layers
  const [mapInstance, setMapInstance] = useState(null)

  // Detection mode & Selection
  const [detectionMode, setDetectionMode] = useState(true)
  const [selectedObject, setSelectedObject] = useState(null)

  // WebGL Extras
  const [cctvEnabled, setCctvEnabled] = useState(false)
  const [trafficEnabled, setTrafficEnabled] = useState(false)

  const toggleLayer = useCallback((key) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const handlePreset = useCallback((p) => {
    setPreset(p)
    document.documentElement.setAttribute('data-preset', p)
  }, [])

  return (
    <div className="app-container scanlines">
      <div className="canvas-wrapper">
        <MapView
          layers={layers}
          onCameraChange={setCameraInfo}
          onMapReady={setMapInstance}
        />
        <PostProcessing
          mode={shaderMode}
          sensitivity={sensitivity}
          pixelation={pixelation}
        />
      </div>

      {/* Tracking layers — rendered outside canvas but manage MapLibre layers */}
      <TrackingLayers
        map={mapInstance}
        showSatellites={layers.markers}
        showFlights={layers.threats}
        selectedObject={selectedObject}
      />
      <DetectionMode
        map={mapInstance}
        enabled={detectionMode}
        selectedObject={selectedObject}
        onSelect={setSelectedObject}
      />
      <CCTVMesh
        map={mapInstance}
        enabled={cctvEnabled}
        videoUrl="https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4"
        targetLngLat={mapInstance ? mapInstance.getCenter() : null}
        scale={0.5}
      />
      <TrafficSimulation
        map={mapInstance}
        enabled={trafficEnabled}
      />

      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        layers={layers}
        onToggleLayer={toggleLayer}
        preset={preset}
        onPreset={handlePreset}
        shaderMode={shaderMode}
        onShaderMode={setShaderMode}
        sensitivity={sensitivity}
        onSensitivity={setSensitivity}
        pixelation={pixelation}
        onPixelation={setPixelation}
        detectionMode={detectionMode}
        onDetectionMode={setDetectionMode}
        cctvEnabled={cctvEnabled}
        onCctvEnabled={setCctvEnabled}
        trafficEnabled={trafficEnabled}
        onTrafficEnabled={setTrafficEnabled}
      />

      <HUDOverlay cameraInfo={cameraInfo} sidebarOpen={sidebarOpen} />
    </div>
  )
}
