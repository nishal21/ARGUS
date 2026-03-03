import { useRef, useEffect, useCallback } from 'react'

// ═══════════════════════════════════════════════════════════
// GLSL SHADERS — Post-Processing Pipeline
// ═══════════════════════════════════════════════════════════

const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`

// ─── Passthrough (no effect) ───
const PASSTHROUGH_FRAG = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_texture;
  void main() {
    gl_FragColor = texture2D(u_texture, v_texCoord);
  }
`

// ─── CRT Mode ───
// Scanlines, chromatic aberration, subtle flicker, barrel distortion
const CRT_FRAG = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_texture;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform float u_sensitivity; // 0-1: controls effect intensity
  uniform float u_pixelation; // 0-1: controls pixel grid size

  void main() {
    vec2 uv = v_texCoord;

    // Pixelation
    if (u_pixelation > 0.01) {
      float pxSize = mix(1.0, 12.0, u_pixelation);
      vec2 pixelGrid = floor(uv * u_resolution / pxSize) * pxSize / u_resolution;
      uv = pixelGrid;
    }

    // Chromatic aberration
    float aberration = 0.002 * u_sensitivity;
    float r = texture2D(u_texture, uv + vec2(aberration, 0.0)).r;
    float g = texture2D(u_texture, uv).g;
    float b = texture2D(u_texture, uv - vec2(aberration, 0.0)).b;
    vec3 color = vec3(r, g, b);

    // Scanlines
    float scanline = sin(uv.y * u_resolution.y * 1.5) * 0.5 + 0.5;
    scanline = pow(scanline, 1.5) * 0.15 * u_sensitivity;
    color -= scanline;

    // Subtle flicker
    float flicker = 1.0 - sin(u_time * 8.0) * 0.015 * u_sensitivity;
    color *= flicker;

    // Vignette
    float vignette = 1.0 - length((uv - 0.5) * 1.3);
    vignette = clamp(vignette, 0.0, 1.0);
    color *= mix(1.0, vignette, 0.3 * u_sensitivity);

    // Slight green tint for CRT feel
    color *= vec3(0.95, 1.05, 0.95);

    gl_FragColor = vec4(color, 1.0);
  }
`

// ─── NVG (Night Vision Goggles) ───
// Monochromatic green, enhanced brightness, film grain, halo on bright spots
const NVG_FRAG = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_texture;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform float u_sensitivity;
  uniform float u_pixelation;

  // Pseudo-random noise
  float random(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 uv = v_texCoord;

    // Pixelation
    if (u_pixelation > 0.01) {
      float pxSize = mix(1.0, 12.0, u_pixelation);
      vec2 pixelGrid = floor(uv * u_resolution / pxSize) * pxSize / u_resolution;
      uv = pixelGrid;
    }

    vec3 texColor = texture2D(u_texture, uv).rgb;

    // Luminance
    float luma = dot(texColor, vec3(0.299, 0.587, 0.114));

    // Enhance brightness with sensitivity
    luma = pow(luma, mix(1.0, 0.4, u_sensitivity));
    luma = clamp(luma * mix(1.0, 2.5, u_sensitivity), 0.0, 1.0);

    // NVG green tint (phosphor green)
    vec3 nvgColor = vec3(0.1, 1.0, 0.2) * luma;

    // Film grain
    float grain = random(uv * u_time * 100.0) * 0.08 * u_sensitivity;
    nvgColor += grain * vec3(0.05, 0.15, 0.05);

    // Halo / bloom on bright spots
    float halo = 0.0;
    float haloRadius = 3.0;
    for (float x = -2.0; x <= 2.0; x += 1.0) {
      for (float y = -2.0; y <= 2.0; y += 1.0) {
        vec2 offset = vec2(x, y) * haloRadius / u_resolution;
        float sampleLuma = dot(texture2D(u_texture, uv + offset).rgb, vec3(0.299, 0.587, 0.114));
        if (sampleLuma > 0.5) {
          halo += sampleLuma;
        }
      }
    }
    halo = halo / 25.0 * u_sensitivity * 0.4;
    nvgColor += vec3(0.05, 0.3, 0.08) * halo;

    // Vignette (circular NVG tube look)
    float dist = length(uv - 0.5);
    float vignette = smoothstep(0.7, 0.3, dist);
    nvgColor *= vignette;

    // Subtle scanlines
    float scanline = sin(uv.y * u_resolution.y * 0.8) * 0.03 * u_sensitivity;
    nvgColor -= scanline;

    gl_FragColor = vec4(nvgColor, 1.0);
  }
`

// ─── FLIR (Thermal / White-Hot) ───
// Luminance-based color ramp simulating heat signatures
const FLIR_FRAG = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_texture;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform float u_sensitivity;
  uniform float u_pixelation;

  // Thermal color ramp (Black → Blue → Purple → Red → Orange → Yellow → White)
  vec3 thermalRamp(float t) {
    t = clamp(t, 0.0, 1.0);
    if (t < 0.15) return mix(vec3(0.0, 0.0, 0.05), vec3(0.1, 0.0, 0.3), t / 0.15);
    if (t < 0.3)  return mix(vec3(0.1, 0.0, 0.3), vec3(0.5, 0.0, 0.5), (t - 0.15) / 0.15);
    if (t < 0.5)  return mix(vec3(0.5, 0.0, 0.5), vec3(0.9, 0.1, 0.1), (t - 0.3) / 0.2);
    if (t < 0.7)  return mix(vec3(0.9, 0.1, 0.1), vec3(1.0, 0.5, 0.0), (t - 0.5) / 0.2);
    if (t < 0.85) return mix(vec3(1.0, 0.5, 0.0), vec3(1.0, 0.9, 0.2), (t - 0.7) / 0.15);
    return mix(vec3(1.0, 0.9, 0.2), vec3(1.0, 1.0, 1.0), (t - 0.85) / 0.15);
  }

  void main() {
    vec2 uv = v_texCoord;

    // Pixelation
    if (u_pixelation > 0.01) {
      float pxSize = mix(1.0, 12.0, u_pixelation);
      vec2 pixelGrid = floor(uv * u_resolution / pxSize) * pxSize / u_resolution;
      uv = pixelGrid;
    }

    vec3 texColor = texture2D(u_texture, uv).rgb;

    // Compute luminance as "heat"
    float heat = dot(texColor, vec3(0.299, 0.587, 0.114));

    // Apply sensitivity (gamma/contrast curve)
    heat = pow(heat, mix(1.5, 0.3, u_sensitivity));
    heat = clamp(heat, 0.0, 1.0);

    // Apply thermal color ramp
    vec3 thermal = thermalRamp(heat);

    // Subtle noise for sensor feel
    float noise = fract(sin(dot(uv * u_time, vec2(12.9898, 78.233))) * 43758.5453);
    thermal += (noise - 0.5) * 0.03;

    // Slight edge enhancement
    float edgeH = dot(texture2D(u_texture, uv + vec2(1.0/u_resolution.x, 0.0)).rgb, vec3(0.3, 0.6, 0.1))
                - dot(texture2D(u_texture, uv - vec2(1.0/u_resolution.x, 0.0)).rgb, vec3(0.3, 0.6, 0.1));
    float edgeV = dot(texture2D(u_texture, uv + vec2(0.0, 1.0/u_resolution.y)).rgb, vec3(0.3, 0.6, 0.1))
                - dot(texture2D(u_texture, uv - vec2(0.0, 1.0/u_resolution.y)).rgb, vec3(0.3, 0.6, 0.1));
    float edge = length(vec2(edgeH, edgeV)) * 2.0 * u_sensitivity;
    thermal += edge * vec3(0.3, 0.2, 0.1);

    gl_FragColor = vec4(thermal, 1.0);
  }
`

const SHADERS = {
    crt: CRT_FRAG,
    nvg: NVG_FRAG,
    flir: FLIR_FRAG,
}

// ═══════════════════════════════════════════════════════════
// WebGL Helper Functions
// ═══════════════════════════════════════════════════════════

function createShader(gl, type, source) {
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

function createProgram(gl, vertexSource, fragmentSource) {
    const vs = createShader(gl, gl.VERTEX_SHADER, vertexSource)
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
    if (!vs || !fs) return null

    const program = gl.createProgram()
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program))
        gl.deleteProgram(program)
        return null
    }
    return program
}

// ═══════════════════════════════════════════════════════════
// PostProcessing Component
// ═══════════════════════════════════════════════════════════

export default function PostProcessing({ mode, sensitivity, pixelation }) {
    const canvasRef = useRef(null)
    const glRef = useRef(null)
    const programsRef = useRef({})
    const textureRef = useRef(null)
    const animRef = useRef(null)
    const startTimeRef = useRef(Date.now())

    // Initialize WebGL
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const gl = canvas.getContext('webgl', {
            premultipliedAlpha: false,
            alpha: true,
            preserveDrawingBuffer: false,
        })
        if (!gl) { console.error('WebGL not supported'); return }
        glRef.current = gl

        // Create quad geometry (full-screen triangle strip)
        const posBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1, 1, -1, -1, 1, 1, 1,
        ]), gl.STATIC_DRAW)

        const texBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            0, 0, 1, 0, 0, 1, 1, 1,
        ]), gl.STATIC_DRAW)

        // Create texture for map canvas capture
        const texture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        textureRef.current = texture

        // Compile all shader programs
        const programs = {}
        for (const [name, frag] of Object.entries(SHADERS)) {
            const prog = createProgram(gl, VERTEX_SHADER, frag)
            if (prog) {
                programs[name] = {
                    program: prog,
                    attribs: {
                        position: gl.getAttribLocation(prog, 'a_position'),
                        texCoord: gl.getAttribLocation(prog, 'a_texCoord'),
                    },
                    uniforms: {
                        texture: gl.getUniformLocation(prog, 'u_texture'),
                        time: gl.getUniformLocation(prog, 'u_time'),
                        resolution: gl.getUniformLocation(prog, 'u_resolution'),
                        sensitivity: gl.getUniformLocation(prog, 'u_sensitivity'),
                        pixelation: gl.getUniformLocation(prog, 'u_pixelation'),
                    },
                    posBuffer,
                    texBuffer,
                }
            }
        }
        programsRef.current = programs

        return () => {
            if (animRef.current) cancelAnimationFrame(animRef.current)
            // Cleanup GL resources
            for (const p of Object.values(programs)) {
                gl.deleteProgram(p.program)
            }
            gl.deleteTexture(texture)
            gl.deleteBuffer(posBuffer)
            gl.deleteBuffer(texBuffer)
        }
    }, [])

    // Render loop
    useEffect(() => {
        if (animRef.current) cancelAnimationFrame(animRef.current)

        if (!mode || mode === 'none') {
            // No shader active — hide canvas
            if (canvasRef.current) canvasRef.current.style.display = 'none'
            return
        }

        const canvas = canvasRef.current
        if (!canvas) return
        canvas.style.display = 'block'

        const render = () => {
            const gl = glRef.current
            const programData = programsRef.current[mode]
            if (!gl || !programData) {
                animRef.current = requestAnimationFrame(render)
                return
            }

            // Find the MapLibre canvas
            const mapCanvas = document.querySelector('.maplibregl-canvas')
            if (!mapCanvas) {
                animRef.current = requestAnimationFrame(render)
                return
            }

            // Resize our canvas to match
            if (canvas.width !== mapCanvas.width || canvas.height !== mapCanvas.height) {
                canvas.width = mapCanvas.width
                canvas.height = mapCanvas.height
                canvas.style.width = mapCanvas.style.width
                canvas.style.height = mapCanvas.style.height
                gl.viewport(0, 0, canvas.width, canvas.height)
            }

            // Read map canvas into texture
            gl.bindTexture(gl.TEXTURE_2D, textureRef.current)
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mapCanvas)

            // Use shader program
            const { program, attribs, uniforms, posBuffer, texBuffer } = programData
            gl.useProgram(program)

            // Set uniforms
            gl.uniform1i(uniforms.texture, 0)
            gl.uniform1f(uniforms.time, (Date.now() - startTimeRef.current) / 1000)
            gl.uniform2f(uniforms.resolution, canvas.width, canvas.height)
            gl.uniform1f(uniforms.sensitivity, sensitivity)
            gl.uniform1f(uniforms.pixelation, pixelation)

            // Bind position attribute
            gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer)
            gl.enableVertexAttribArray(attribs.position)
            gl.vertexAttribPointer(attribs.position, 2, gl.FLOAT, false, 0, 0)

            // Bind texCoord attribute
            gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer)
            gl.enableVertexAttribArray(attribs.texCoord)
            gl.vertexAttribPointer(attribs.texCoord, 2, gl.FLOAT, false, 0, 0)

            // Draw
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

            animRef.current = requestAnimationFrame(render)
        }

        animRef.current = requestAnimationFrame(render)

        return () => {
            if (animRef.current) cancelAnimationFrame(animRef.current)
        }
    }, [mode, sensitivity, pixelation])

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 1,
                display: 'none',
            }}
        />
    )
}
