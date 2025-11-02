class WebGLImageRenderer {
    constructor(canvas, projectionManager) {
        this.canvas = canvas;
        this.gl = null;
        this.program = null;
        this.vao = null;
        this.texture = null;
        this.uniformLocations = {};

        this.projectionManager = projectionManager;
        this.projectionIndexMap = this.buildProjectionIndexMap(projectionManager);

        this.currentProjectionKey = projectionManager.currentProjection;
        this.previousProjectionKey = null;

        this.transitionActive = false;
        this.transitionStart = 0;
        this.transitionDuration = 1200;

        this.scale = projectionManager.currentScale;
        this.rotation = {
            x: projectionManager.currentRotation[0],
            y: projectionManager.currentRotation[1]
        };
        this.canvasSize = {
            width: canvas.width,
            height: canvas.height
        };

        this.initializeGL();
    }

    buildProjectionIndexMap(projectionManager) {
        const projections = projectionManager.getAvailableProjections();
        const map = new Map();
        projections.forEach((proj, index) => {
            map.set(proj.key, index);
        });
        return map;
    }

    initializeGL() {
        const gl = this.canvas.getContext('webgl2', { alpha: true, antialias: true });
        if (!gl) {
            throw new Error('WebGL2 not supported');
        }
        this.gl = gl;

        this.resize(this.canvasSize.width, this.canvasSize.height);
        this.compileShaders();
        this.setupGeometry();

        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
        this.gl.clearColor(0.9725, 0.9764, 0.9803, 1.0);
    }

    resize(width, height) {
        if (!this.gl) return;
        this.canvasSize.width = width;
        this.canvasSize.height = height;

        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
        }
        this.gl.viewport(0, 0, width, height);
    }

    compileShaders() {
        const gl = this.gl;
        const vertexSource = this.getVertexShaderSource();
        const fragmentSource = this.getFragmentShaderSource();

        const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentSource);

        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);

        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            const info = gl.getProgramInfoLog(this.program);
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            throw new Error(`Failed to link WebGL program: ${info}`);
        }

        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);

        this.uniformLocations = {
            projectionType: gl.getUniformLocation(this.program, 'uProjectionType'),
            previousProjectionType: gl.getUniformLocation(this.program, 'uPreviousProjectionType'),
            transitionProgress: gl.getUniformLocation(this.program, 'uTransitionProgress'),
            scale: gl.getUniformLocation(this.program, 'uScale'),
            rotationX: gl.getUniformLocation(this.program, 'uRotationX'),
            rotationY: gl.getUniformLocation(this.program, 'uRotationY'),
            canvasSize: gl.getUniformLocation(this.program, 'uCanvasSize'),
            texture: gl.getUniformLocation(this.program, 'uTexture')
        };
    }

    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            const info = this.gl.getShaderInfoLog(shader);
            this.gl.deleteShader(shader);
            throw new Error(`Failed to compile shader: ${info}`);
        }

        return shader;
    }

    getVertexShaderSource() {
        return `#version 300 es
            precision highp float;

            in vec2 position;
            in vec2 texCoord;

            out vec2 vTexCoord;

            void main() {
                gl_Position = vec4(position, 0.0, 1.0);
                vTexCoord = texCoord;
            }
        `;
    }

    getFragmentShaderSource() {
        return `#version 300 es
            precision highp float;

            uniform sampler2D uTexture;
            uniform int uProjectionType;
            uniform int uPreviousProjectionType;
            uniform float uTransitionProgress;
            uniform float uScale;
            uniform float uRotationX;
            uniform float uRotationY;
            uniform vec2 uCanvasSize;

            in vec2 vTexCoord;
            out vec4 outColor;

            const float PI = 3.14159265359;
            const float HALF_PI = 1.57079632679;
            const float TWO_PI = 6.28318530718;
            const float BASE_SCALE = 150.0;
            const vec4 BACKGROUND = vec4(0.9725, 0.9764, 0.9803, 1.0);

            float asinSafe(float x) {
                return asin(clamp(x, -1.0, 1.0));
            }

            float acosSafe(float x) {
                return acos(clamp(x, -1.0, 1.0));
            }

            vec2 toPlane(vec2 uv) {
                float px = (uv.x - 0.5) * uCanvasSize.x / max(uScale, 0.0001);
                float py = (0.5 - uv.y) * uCanvasSize.y / max(uScale, 0.0001);
                return vec2(px, py);
            }

            vec2 applyScale(vec2 uv) {
                float scaleFactor = max(uScale, 1.0) / BASE_SCALE;
                return (uv - 0.5) / scaleFactor + 0.5;
            }

            vec2 inverseMercator(vec2 uv) {
                vec2 plane = toPlane(uv);
                float lon = plane.x * 180.0 / PI;
                float lat = (2.0 * atan(exp(plane.y)) - HALF_PI) * 180.0 / PI;
                return vec2(lon, lat);
            }

            vec2 inverseStereographic(vec2 uv) {
                vec2 plane = toPlane(uv);
                float rho = length(plane);
                if (rho < 1e-6) {
                    return vec2(0.0);
                }
                float c = 2.0 * atan(rho / 2.0);
                float sinc = sin(c);
                float cosc = cos(c);
                float lat = asinSafe(plane.y * sinc / rho) * 180.0 / PI;
                float lon = atan(plane.x * sinc, rho * cosc) * 180.0 / PI;
                return vec2(lon, lat);
            }

            vec2 inverseEqualEarth(vec2 uv) {
                vec2 scaledUV = applyScale(uv);
                float x = (scaledUV.x - 0.5) * 2.0;
                float y = (0.5 - scaledUV.y) * 1.0;

                float A = 1.44708;
                float B = 0.54201;
                float C = 0.00652;

                float phi = y;
                for (int i = 0; i < 5; i++) {
                    float cosPhi = cos(phi);
                    float f = phi + C * phi * phi * phi - y / A;
                    float fprime = 1.0 + 3.0 * C * phi * phi;
                    phi = phi - f / fprime;
                }

                float lat = phi * 180.0 / PI;
                float lon = x * PI / (2.0 * (A - B * cos(phi))) * 180.0 / PI;
                return vec2(lon, lat);
            }

            vec2 inverseMollweide(vec2 uv) {
                vec2 scaledUV = applyScale(uv);
                float x = (scaledUV.x - 0.5) * 2.0 * sqrt(2.0);
                float y = (0.5 - scaledUV.y) * sqrt(2.0);

                float theta = y;
                for (int i = 0; i < 5; i++) {
                    theta -= (theta + sin(theta) - PI * y) / (1.0 + cos(theta));
                }

                float lat = asinSafe((2.0 * theta + sin(2.0 * theta)) / PI) * 180.0 / PI;
                float lon = (PI * x) / (2.0 * sqrt(2.0) * cos(theta)) * 180.0 / PI;
                return vec2(lon, lat);
            }

            vec2 inverseAzimuthalEquidistant(vec2 uv) {
                vec2 plane = toPlane(uv);
                float rho = length(plane);
                if (rho > PI) {
                    return vec2(1e9);
                }
                float c = rho;
                float cosc = cos(c);
                float sinc = rho < 1e-6 ? 1.0 : sin(c) / rho;
                float lat = asinSafe(plane.y * sinc) * 180.0 / PI;
                float lon = atan(plane.x * sin(c), rho * cosc) * 180.0 / PI;
                return vec2(lon, lat);
            }

            vec2 inverseOrthographic(vec2 uv) {
                vec2 plane = toPlane(uv);
                float radiusSquared = dot(plane, plane);
                if (radiusSquared > 1.0) {
                    return vec2(1e9);
                }
                float z = sqrt(max(0.0, 1.0 - radiusSquared));
                float lat = atan(plane.y, z) * 180.0 / PI;
                float lon = atan(plane.x, z) * 180.0 / PI;
                return vec2(lon, lat);
            }

            vec2 inverseGnomonic(vec2 uv) {
                vec2 plane = toPlane(uv);
                float rho = length(plane);
                float c = atan(rho);
                float sinc = rho < 1e-6 ? 1.0 : sin(c) / rho;
                float cosc = cos(c);
                float lat = asinSafe(plane.y * sinc) * 180.0 / PI;
                float lon = atan(plane.x * sin(c), rho * cosc) * 180.0 / PI;
                return vec2(lon, lat);
            }

            vec2 inverseNaturalEarth(vec2 uv) {
                return inverseEqualEarth(uv);
            }

            vec2 getInverseProjection(int projectionType, vec2 uv) {
                if (projectionType == 0) return inverseMercator(uv);
                if (projectionType == 1) return inverseStereographic(uv);
                if (projectionType == 2) return inverseEqualEarth(uv);
                if (projectionType == 3) return inverseMollweide(uv);
                if (projectionType == 4) return inverseAzimuthalEquidistant(uv);
                if (projectionType == 5) return inverseOrthographic(uv);
                if (projectionType == 6) return inverseGnomonic(uv);
                if (projectionType == 7) return inverseNaturalEarth(uv);
                return inverseMercator(uv);
            }

            vec2 applyRotation(vec2 lonLat, float rotX, float rotY) {
                float lon = lonLat.x + rotX;
                float lat = lonLat.y + rotY;
                lon = mod(lon + 180.0, 360.0) - 180.0;
                lat = clamp(lat, -90.0, 90.0);
                return vec2(lon, lat);
            }

            vec2 lonLatToTexture(vec2 lonLat) {
                float u = (lonLat.x / 360.0) + 0.5;
                float v = 0.5 - (lonLat.y / 180.0);
                return vec2(u, v);
            }

            vec4 sampleTexture(vec2 coord) {
                if (coord.x < 0.0 || coord.x > 1.0 || coord.y < 0.0 || coord.y > 1.0) {
                    return BACKGROUND;
                }
                return texture(uTexture, coord);
            }

            vec4 sampleFromLonLat(vec2 lonLat) {
                vec2 rotated = applyRotation(lonLat, uRotationX, uRotationY);
                vec2 texCoord = lonLatToTexture(rotated);
                return sampleTexture(texCoord);
            }

            void main() {
                vec2 uv = gl_FragCoord.xy / uCanvasSize;
                float progress = clamp(uTransitionProgress, 0.0, 1.0);

                vec2 currentLonLat = getInverseProjection(uProjectionType, uv);
                bool currentValid = abs(currentLonLat.x) <= 500.0;

                if (progress < 0.999) {
                    vec2 previousLonLat = getInverseProjection(uPreviousProjectionType, uv);
                    bool previousValid = abs(previousLonLat.x) <= 500.0;

                    if (currentValid && previousValid) {
                        vec2 blendedLonLat = mix(previousLonLat, currentLonLat, progress);
                        outColor = sampleFromLonLat(blendedLonLat);
                        return;
                    }

                    if (!currentValid && previousValid) {
                        vec4 previousColor = sampleFromLonLat(previousLonLat);
                        outColor = mix(previousColor, BACKGROUND, progress);
                        return;
                    }

                    if (currentValid && !previousValid) {
                        vec4 currentColor = sampleFromLonLat(currentLonLat);
                        outColor = mix(BACKGROUND, currentColor, progress);
                        return;
                    }

                    outColor = BACKGROUND;
                    return;
                }

                if (!currentValid) {
                    outColor = BACKGROUND;
                    return;
                }

                outColor = sampleFromLonLat(currentLonLat);
            }
        `;
    }

    setupGeometry() {
        const gl = this.gl;
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);

        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        const vertices = new Float32Array([
            -1, -1,
             1, -1,
             1,  1,
            -1,  1
        ]);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        const positionLocation = gl.getAttribLocation(this.program, 'position');
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        const texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        const texCoords = new Float32Array([
            0, 0,
            1, 0,
            1, 1,
            0, 1
        ]);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

        const texCoordLocation = gl.getAttribLocation(this.program, 'texCoord');
        gl.enableVertexAttribArray(texCoordLocation);
        gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

        gl.bindVertexArray(null);
    }

    loadImage(image) {
        const gl = this.gl;
        if (!gl) return;

        if (!this.texture) {
            this.texture = gl.createTexture();
        }

        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    }

    setProjection(projectionKey) {
        const mapped = this.projectionIndexMap.has(projectionKey)
            ? projectionKey
            : this.currentProjectionKey;

        if (!this.currentProjectionKey) {
            this.currentProjectionKey = mapped;
            return;
        }

        if (this.currentProjectionKey === mapped) {
            return;
        }

        this.previousProjectionKey = this.currentProjectionKey;
        this.currentProjectionKey = mapped;
        this.transitionActive = true;
        this.transitionStart = performance.now();
    }

    setView(scale, rotationX, rotationY) {
        this.scale = scale;
        this.rotation.x = rotationX;
        this.rotation.y = rotationY;
    }

    captureFrameCanvas() {
        if (!this.gl || !this.texture) {
            return null;
        }

        const width = this.canvasSize.width;
        const height = this.canvasSize.height;
        const pixelBuffer = new Uint8Array(width * height * 4);

        try {
            // Ensure the latest frame is rendered before capturing
            this.renderFrame(performance.now());

            this.gl.readPixels(
                0,
                0,
                width,
                height,
                this.gl.RGBA,
                this.gl.UNSIGNED_BYTE,
                pixelBuffer
            );
        } catch (error) {
            console.warn('WebGL capture failed:', error);
            return null;
        }

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = width;
        exportCanvas.height = height;

        const exportCtx = exportCanvas.getContext('2d');
        const imageData = exportCtx.createImageData(width, height);
        const rowSize = width * 4;

        // Flip vertical axis because WebGL's origin is bottom-left
        for (let row = 0; row < height; row++) {
            const srcStart = (height - 1 - row) * rowSize;
            const destStart = row * rowSize;
            imageData.data.set(
                pixelBuffer.subarray(srcStart, srcStart + rowSize),
                destStart
            );
        }

        exportCtx.putImageData(imageData, 0, 0);
        return exportCanvas;
    }

    renderFrame(timestamp) {
        const gl = this.gl;
        if (!gl || !this.texture) {
            this.clear();
            return;
        }

        gl.useProgram(this.program);
        gl.bindVertexArray(this.vao);

        const currentIndex = this.getProjectionIndex(this.currentProjectionKey);
        const previousIndex = this.previousProjectionKey
            ? this.getProjectionIndex(this.previousProjectionKey)
            : currentIndex;

        let transitionProgress = 1.0;
        if (this.transitionActive) {
            const elapsed = timestamp - this.transitionStart;
            transitionProgress = this.easeInOutCubic(Math.min(elapsed / this.transitionDuration, 1.0));
            if (elapsed >= this.transitionDuration) {
                this.transitionActive = false;
                this.previousProjectionKey = null;
                transitionProgress = 1.0;
            }
        }

        gl.uniform1i(this.uniformLocations.projectionType, currentIndex);
        gl.uniform1i(this.uniformLocations.previousProjectionType, previousIndex);
        gl.uniform1f(this.uniformLocations.transitionProgress, transitionProgress);
        gl.uniform1f(this.uniformLocations.scale, Math.max(this.scale, 1.0));
        gl.uniform1f(this.uniformLocations.rotationX, this.rotation.x);
        gl.uniform1f(this.uniformLocations.rotationY, this.rotation.y);
        gl.uniform2f(this.uniformLocations.canvasSize, this.canvasSize.width, this.canvasSize.height);
        gl.uniform1i(this.uniformLocations.texture, 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }

    getProjectionIndex(key) {
        if (!this.projectionIndexMap.has(key)) {
            return 0;
        }
        return this.projectionIndexMap.get(key);
    }

    easeInOutCubic(t) {
        return t < 0.5
            ? 4.0 * t * t * t
            : 1.0 - Math.pow(-2.0 * t + 2.0, 3.0) / 2.0;
    }

    isTransitionActive() {
        return this.transitionActive;
    }

    clear() {
        if (!this.gl) return;
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }

    clearTexture() {
        if (this.texture && this.gl) {
            this.gl.deleteTexture(this.texture);
            this.texture = null;
        }
    }
}

if (typeof window !== 'undefined') {
    window.WebGLImageRenderer = WebGLImageRenderer;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebGLImageRenderer;
}
