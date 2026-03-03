import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'

const VERTEX_SHADER = `
    uniform mat4 u_matrix;
    uniform float u_time;
    
    attribute vec2 a_pos_start;
    attribute vec2 a_pos_end;
    attribute float a_length;
    attribute float a_offset;
    attribute float a_speed;

    varying float v_opacity;

    void main() {
        // Calculate progress along this segment based on time, speed, and offset
        // We use modulo 1.0 so it loops perfectly along the segment
        float progress = fract((u_time * a_speed + a_offset));
        
        // Interpolate position
        vec2 pos = mix(a_pos_start, a_pos_end, progress);
        
        gl_Position = u_matrix * vec4(pos, 0.0, 1.0);
        gl_PointSize = 4.0; // Size of the data packet particle
        
        // Fade in and out at start/end of segments
        v_opacity = smoothstep(0.0, 0.1, progress) * (1.0 - smoothstep(0.9, 1.0, progress));
    }
`

const FRAGMENT_SHADER = `
    precision mediump float;
    varying float v_opacity;

    void main() {
        // Circular glowing dot
        vec2 pt = gl_PointCoord - vec2(0.5);
        float r = length(pt);
        if (r > 0.5) discard;
        
        // Glow effect: bright core, fading edge
        float glow = smoothstep(0.5, 0.0, r);
        
        // Cyber-orange / cyan coloring
        vec3 color = mix(vec3(0.0, 0.9, 1.0), vec3(1.0, 0.6, 0.0), fract(gl_FragCoord.x * 0.01));
        
        gl_FragColor = vec4(color * glow, glow * v_opacity * 0.8);
    }
`

function compileShader(gl, type, source) {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader))
        gl.deleteShader(shader)
        return null
    }
    return shader
}

export default function TrafficSimulation({ map, enabled }) {
    const layerId = 'gpu-traffic-layer'
    const programRef = useRef(null)
    const bufferRef = useRef(null)
    const countRef = useRef(0)

    useEffect(() => {
        if (!map) return

        if (!enabled) {
            if (map.getLayer(layerId)) {
                map.removeLayer(layerId)
            }
            return
        }

        const customLayer = {
            id: layerId,
            type: 'custom',
            onAdd: function (map, gl) {
                this.map = map
                this.gl = gl

                // Compile shaders
                const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
                const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
                this.program = gl.createProgram()
                gl.attachShader(this.program, vs)
                gl.attachShader(this.program, fs)
                gl.linkProgram(this.program)
                programRef.current = this.program

                // Extract locations of uniforms/attributes
                this.uMatrix = gl.getUniformLocation(this.program, 'u_matrix')
                this.uTime = gl.getUniformLocation(this.program, 'u_time')
                this.aPosStart = gl.getAttribLocation(this.program, 'a_pos_start')
                this.aPosEnd = gl.getAttribLocation(this.program, 'a_pos_end')
                this.aLength = gl.getAttribLocation(this.program, 'a_length')
                this.aOffset = gl.getAttribLocation(this.program, 'a_offset')
                this.aSpeed = gl.getAttribLocation(this.program, 'a_speed')

                this.buffer = gl.createBuffer()
                bufferRef.current = this.buffer

                this.extractRoadData = () => {
                    // map.querySourceFeatures queries the raw vector tile data directly
                    const roads = map.querySourceFeatures('protomaps', { sourceLayer: 'roads' })

                    if (!roads || roads.length === 0) return

                    const particles = []

                    // For each road LineString, create multiple particles flowing along its segments
                    roads.forEach(road => {
                        let coords = []
                        if (road.geometry.type === 'LineString') {
                            coords = road.geometry.coordinates
                        } else if (road.geometry.type === 'MultiLineString') {
                            coords = road.geometry.coordinates.flat() // Simplistic flattening for demo
                        }

                        if (coords.length < 2) return

                        // Convert coordinates to Mercator [0,1] space required by Custom Layer matrix
                        const mercCoords = coords.map(c => maplibregl.MercatorCoordinate.fromLngLat(c))

                        for (let i = 0; i < mercCoords.length - 1; i++) {
                            const start = mercCoords[i]
                            const end = mercCoords[i + 1]

                            // Calculate approximate segment length in mercator units
                            const dx = end.x - start.x
                            const dy = end.y - start.y
                            const length = Math.sqrt(dx * dx + dy * dy)

                            if (length < 0.000001) continue // Skip microscopic segments

                            // Spawn multiple particles per segment based on length
                            // e.g., 1 particle per tiny unit
                            let numParticles = Math.max(1, Math.floor(length * 50000))
                            // Cap limits to avoid melting GPU if we zoom way out (mercator length gets huge relative to view)
                            numParticles = Math.min(numParticles, 10)

                            for (let p = 0; p < numParticles; p++) {
                                // Data format: [startX, startY, endX, endY, length, offset, speed] = 7 floats per particle
                                particles.push(
                                    start.x, start.y,
                                    end.x, end.y,
                                    length,
                                    Math.random(), // random offset 0-1
                                    (Math.random() * 0.5 + 0.5) * 0.1 // speed factor
                                )
                            }
                        }
                    })

                    if (particles.length > 0) {
                        const data = new Float32Array(particles)
                        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
                        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
                        this.count = particles.length / 7
                        countRef.current = this.count
                        // console.log(`[GPU Traffic] Spawning ${this.count} data packets`)
                    }
                }

                // Initial extraction
                setTimeout(this.extractRoadData, 1000)

                // Re-extract occasionally when panning
                map.on('moveend', this.extractRoadData)
                this.cleanupListener = () => map.off('moveend', this.extractRoadData)
            },

            render: function (gl, matrix) {
                if (!this.program || countRef.current === 0) return

                gl.useProgram(this.program)
                gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)

                // Enable blending for the glowing particles
                gl.enable(gl.BLEND)
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE) // Additive blending
                gl.disable(gl.DEPTH_TEST)

                // Stride = 7 floats * 4 bytes = 28
                const stride = 28

                gl.enableVertexAttribArray(this.aPosStart)
                gl.vertexAttribPointer(this.aPosStart, 2, gl.FLOAT, false, stride, 0)

                gl.enableVertexAttribArray(this.aPosEnd)
                gl.vertexAttribPointer(this.aPosEnd, 2, gl.FLOAT, false, stride, 8)

                gl.enableVertexAttribArray(this.aLength)
                gl.vertexAttribPointer(this.aLength, 1, gl.FLOAT, false, stride, 16)

                gl.enableVertexAttribArray(this.aOffset)
                gl.vertexAttribPointer(this.aOffset, 1, gl.FLOAT, false, stride, 20)

                gl.enableVertexAttribArray(this.aSpeed)
                gl.vertexAttribPointer(this.aSpeed, 1, gl.FLOAT, false, stride, 24)

                // Set uniforms
                gl.uniformMatrix4fv(this.uMatrix, false, matrix)
                gl.uniform1f(this.uTime, performance.now() / 1000.0)

                // Draw particles
                gl.drawArrays(gl.POINTS, 0, countRef.current)

                // Cleanup GL state so MapLibre can continue rendering its own layers properly
                gl.disable(gl.BLEND)
                gl.enable(gl.DEPTH_TEST)

                // Force continuous repaint since simulation is time-based
                this.map.triggerRepaint()
            },

            onRemove: function (map, gl) {
                if (this.cleanupListener) this.cleanupListener()
                if (this.buffer) gl.deleteBuffer(this.buffer)
                if (this.program) gl.deleteProgram(this.program)
            }
        }

        if (!map.getLayer(layerId)) {
            // Draw on top of roads but under UI
            map.addLayer(customLayer)
        }

        return () => {
            if (map.getLayer(layerId)) map.removeLayer(layerId)
        }
    }, [map, enabled])

    return null
}
