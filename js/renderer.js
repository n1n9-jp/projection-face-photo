class Renderer {
    constructor(projectionManager, languageManager = null) {
        this.projectionManager = projectionManager;
        this.languageManager = languageManager;
        this.svg = d3.select('#map-svg');
        this.canvas = document.getElementById('image-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.webglCanvas = document.getElementById('webgl-canvas');
        this.webglRenderer = null;
        this.webglEnabled = false;
        this.webglInitError = null;
        this.webglAnimationFrame = null;
        this.webglAnimationCallback = null;
        this.overlayNeedsUpdate = false;
        this.width = 800;
        this.height = 600;
        this.currentData = null;
        this.isRendering = false;
        this.previousProjection = null;
        this.transitionDuration = 500;
        this.showGraticule = true;
        this.showProjectionName = true;
        this.geoGroup = null;
        this.dataGroup = null;
        this.spherePath = null;
        this.graticulePath = null;
        this.graticuleOutlinePath = null;
        this.geoGraticule = d3.geoGraticule();
    }

    initialize() {
        this.setupSVG();
        this.setupCanvas();
        this.initializeWebGL();
    }

    setupSVG() {
        this.svg
            .attr('width', this.width)
            .attr('height', this.height)
            .style('background', '#f8f9fa');

        this.svg.selectAll('*').remove();

        this.geoGroup = this.svg.append('g')
            .attr('class', 'geo-layer');

        this.spherePath = this.geoGroup.append('path')
            .attr('class', 'sphere')
            .datum({type: 'Sphere'});

        this.graticulePath = this.geoGroup.append('path')
            .attr('class', 'graticule')
            .datum(this.geoGraticule());

        this.graticuleOutlinePath = this.geoGroup.append('path')
            .attr('class', 'graticule-outline')
            .datum(this.geoGraticule.outline());

        this.dataGroup = this.geoGroup.append('g')
            .attr('class', 'geo-data');

        this.updateGraticuleVisibility();
    }

    setupCanvas() {
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.ctx.fillStyle = '#f8f9fa';
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    detectWebGLSupport() {
        if (!this.webglCanvas) {
            return { supported: false, error: new Error('WebGL canvas not found') };
        }

        try {
            const testCanvas = document.createElement('canvas');
            const options = { alpha: true, antialias: true, failIfMajorPerformanceCaveat: true };
            const gl2 = testCanvas.getContext('webgl2', options);

            if (gl2) {
                const loseContext = gl2.getExtension('WEBGL_lose_context');
                if (loseContext) {
                    loseContext.loseContext();
                }
                return { supported: true };
            }

            return { supported: false, error: new Error('WebGL2 not supported') };
        } catch (error) {
            return { supported: false, error };
        }
    }

    initializeWebGL() {
        if (!this.webglCanvas || typeof WebGLImageRenderer === 'undefined') {
            return;
        }

        const support = this.detectWebGLSupport();
        if (!support.supported) {
            this.webglRenderer = null;
            this.webglEnabled = false;
            this.webglInitError = support.error;
            if (this.webglCanvas) {
                this.webglCanvas.style.display = 'none';
            }
            return;
        }

        try {
            this.webglRenderer = new WebGLImageRenderer(this.webglCanvas, this.projectionManager);
            this.webglRenderer.resize(this.width, this.height);
            this.webglRenderer.setProjection(this.projectionManager.currentProjection);
            this.webglRenderer.setView(
                this.projectionManager.currentScale,
                this.projectionManager.currentRotation[0],
                this.projectionManager.currentRotation[1]
            );
            this.webglEnabled = true;
            this.webglCanvas.style.display = 'none';
        } catch (error) {
            console.warn('WebGL initialization failed:', error);
            this.webglRenderer = null;
            this.webglEnabled = false;
            this.webglInitError = error;
            if (this.webglCanvas) {
                this.webglCanvas.style.display = 'none';
            }
        }
    }

    async render(data) {
        if (this.isRendering) return;
        
        this.isRendering = true;
        this.currentData = data;

        try {
            this.showLoading();
            
            if (data.type === 'geojson') {
                this.stopWebGLAnimation();
                await this.renderGeoJSON(data.data);
                this.showSVG();
            } else if (data.type === 'image') {
                await this.renderImage(data.data);
            }
        } catch (error) {
            console.error('Rendering error:', error);
            this.showError('描画中にエラーが発生しました: ' + error.message);
        } finally {
            this.hideLoading();
            this.isRendering = false;
        }
    }

    async renderGeoJSON(geoData) {
        const projection = this.projectionManager.getCurrentProjection();
        const configuredProjection = this.projectionManager.configureProjection(
            projection, this.width, this.height
        );
        this.renderGeoJSONDirect(geoData, configuredProjection);
    }

    renderGeoJSONDirect(geoData, projection) {
        if (!this.geoGroup) {
            this.setupSVG();
        }

        const previousProjection = this.previousProjection ? this.previousProjection : null;
        const shouldAnimate = Boolean(previousProjection) && this.shouldAnimate();
        const transition = shouldAnimate ? this.createGeoTransition() : null;

        const features = this.extractGeoFeatures(geoData);
        const keyFn = (feature, index) => feature.id || feature.properties?.id || feature.properties?.name || index;
        const selection = this.dataGroup.selectAll('path.country')
            .data(features, keyFn);

        const exiting = selection.exit();
        if (transition) {
            exiting.transition(transition)
                .style('opacity', 0)
                .remove();
        } else {
            exiting.remove();
        }

        const entering = selection.enter()
            .append('path')
            .attr('class', 'country');

        if (previousProjection) {
            const previousPath = d3.geoPath().projection(previousProjection);
            entering.attr('d', d => previousPath(d));
        } else {
            const initialPath = d3.geoPath().projection(projection);
            entering.attr('d', d => initialPath(d));
        }

        entering.style('opacity', shouldAnimate ? 0 : 1);
        if (transition) {
            entering.transition(transition)
                .style('opacity', 1);
        } else {
            entering.style('opacity', 1);
        }

        const merged = entering.merge(selection);

        const applyProjection = (proj) => {
            if (!proj) {
                return;
            }

            const pathGenerator = d3.geoPath().projection(proj);
            this.spherePath.attr('d', pathGenerator({type: 'Sphere'}));
            this.graticulePath.attr('d', pathGenerator(this.geoGraticule()));
            this.graticuleOutlinePath.attr('d', pathGenerator(this.geoGraticule.outline()));
            merged.attr('d', d => pathGenerator(d));
        };

        if (transition && previousProjection) {
            const transitionStrategy = this.determineProjectionTransition(previousProjection, projection);
            if (transitionStrategy.type === 'interpolate' && typeof transitionStrategy.interpolate === 'function') {
                const path = d3.geoPath();
                const graticule = this.geoGraticule();
                const graticuleOutline = this.geoGraticule.outline();
                const sphere = {type: 'Sphere'};

                transition
                    .on('start', () => {
                        applyProjection(previousProjection);
                    })
                    .tween('projection', () => {
                        return (t) => {
                            const currentProjection = transitionStrategy.interpolate(t);
                            path.projection(currentProjection);
                            this.spherePath.attr('d', path(sphere));
                            this.graticulePath.attr('d', path(graticule));
                            this.graticuleOutlinePath.attr('d', path(graticuleOutline));
                            merged.attr('d', d => path(d));
                        };
                    })
                    .on('end', () => {
                        applyProjection(projection);
                    })
                    .on('interrupt', () => {
                        applyProjection(projection);
                    });
            } else if (transitionStrategy.type === 'crossfade') {
                this.performCrossFadeTransition(applyProjection, projection);
            } else {
                applyProjection(projection);
            }
        } else {
            applyProjection(projection);
        }

        this.updateGraticuleVisibility();

        this.previousProjection = typeof projection.copy === 'function' ? projection.copy() : projection;
    }

    renderGeoJSONToCanvas(context, projection, geoData) {
        if (!context || !projection || !geoData) {
            return;
        }

        context.save();
        context.clearRect(0, 0, this.width, this.height);
        context.fillStyle = '#f8f9fa';
        context.fillRect(0, 0, this.width, this.height);

        const path = d3.geoPath().projection(projection).context(context);
        const sphere = { type: 'Sphere' };

        // Draw sphere background
        context.beginPath();
        path(sphere);
        context.fillStyle = '#e6f3ff';
        context.fill();
        context.lineWidth = 1;
        context.strokeStyle = '#4a90e2';
        context.stroke();

        if (this.showGraticule) {
            const graticule = this.geoGraticule();
            const graticuleOutline = this.geoGraticule.outline();

            // Graticule lines
            context.beginPath();
            path(graticule);
            context.lineWidth = 1;
            context.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            context.stroke();

            // Graticule outline
            context.beginPath();
            path(graticuleOutline);
            context.lineWidth = 2;
            context.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            context.stroke();
        }

        // Draw GeoJSON features
        const features = this.extractGeoFeatures(geoData);
        context.lineWidth = 1.5;
        context.strokeStyle = '#2c5aa0';
        context.fillStyle = 'rgba(0, 0, 0, 0)';

        features.forEach(feature => {
            context.beginPath();
            path(feature);
            context.stroke();
        });

        context.restore();
    }

    async updateProjection() {
        if (this.currentData) {
            if (this.currentData.type === 'geojson') {
                await this.renderGeoJSON(this.currentData.data);
            } else if (this.currentData.type === 'image') {
                await this.renderImage(this.currentData.data);
            }
        }
    }

    handleProjectionChange() {
        if (this.webglEnabled && this.webglRenderer && this.currentData && this.currentData.type === 'image') {
            this.webglRenderer.setProjection(this.projectionManager.currentProjection);
            this.markOverlayDirty();
        }
    }

    handleViewChange() {
        if (this.webglEnabled && this.webglRenderer && this.currentData && this.currentData.type === 'image') {
            this.webglRenderer.setView(
                this.projectionManager.currentScale,
                this.projectionManager.currentRotation[0],
                this.projectionManager.currentRotation[1]
            );
            this.markOverlayDirty();
            this.refreshOverlay();
            this.overlayNeedsUpdate = false;
        }
    }


    async renderImage(imageElement) {
        const projection = this.projectionManager.getCurrentProjection();
        const configuredProjection = this.projectionManager.configureProjection(
            projection, this.width, this.height
        );

        if (this.webglEnabled && this.webglRenderer) {
            this.webglRenderer.resize(this.width, this.height);
            this.webglRenderer.loadImage(imageElement);
            this.webglRenderer.setProjection(this.projectionManager.currentProjection);
            this.webglRenderer.setView(
                this.projectionManager.currentScale,
                this.projectionManager.currentRotation[0],
                this.projectionManager.currentRotation[1]
            );
            this.showWebGL();
            this.markOverlayDirty();
            this.refreshOverlay();
            this.overlayNeedsUpdate = false;
            this.startWebGLAnimation();
            this.previousProjection = projection;
            return;
        }

        this.stopWebGLAnimation();
        this.showCanvas();
        await this.renderImageDirect(imageElement, configuredProjection);
        this.previousProjection = typeof configuredProjection.copy === 'function'
            ? configuredProjection.copy()
            : configuredProjection;
    }

    async renderImageDirect(imageElement, projection) {
        this.ctx.fillStyle = '#f8f9fa';
        this.ctx.fillRect(0, 0, this.width, this.height);

        const sourceCanvas = document.createElement('canvas');
        const sourceCtx = sourceCanvas.getContext('2d');
        sourceCanvas.width = imageElement.width;
        sourceCanvas.height = imageElement.height;
        sourceCtx.drawImage(imageElement, 0, 0);

        const sourceImageData = sourceCtx.getImageData(0, 0, imageElement.width, imageElement.height);
        const outputImageData = this.ctx.createImageData(this.width, this.height);

        await this.transformImageWithProjection(
            sourceImageData,
            outputImageData,
            projection,
            imageElement.width,
            imageElement.height
        );

        this.ctx.putImageData(outputImageData, 0, 0);

        if (this.showGraticule) {
            this.drawGraticuleOnCanvas(projection);
        }

        if (this.showProjectionName) {
            this.drawProjectionNameOnCanvas();
        }
    }

    startWebGLAnimation() {
        if (!this.webglEnabled || !this.webglRenderer) {
            return;
        }
        if (this.webglAnimationFrame) {
            return;
        }

        const loop = (timestamp) => {
            this.webglAnimationFrame = requestAnimationFrame(loop);
            this.webglRenderer.renderFrame(timestamp || performance.now());
            if (this.overlayNeedsUpdate) {
                const transitionActive = typeof this.webglRenderer.isTransitionActive === 'function'
                    ? this.webglRenderer.isTransitionActive()
                    : false;
                if (!transitionActive) {
                    this.refreshOverlay();
                    this.overlayNeedsUpdate = false;
                }
            }
        };

        this.webglAnimationCallback = loop;
        this.webglAnimationFrame = requestAnimationFrame(loop);
    }

    stopWebGLAnimation() {
        if (this.webglAnimationFrame) {
            cancelAnimationFrame(this.webglAnimationFrame);
            this.webglAnimationFrame = null;
            this.webglAnimationCallback = null;
        }
        if (this.webglEnabled && this.webglRenderer) {
            this.webglRenderer.clear();
        }
    }

    markOverlayDirty() {
        this.overlayNeedsUpdate = true;
    }

    refreshOverlay() {
        if (!this.webglEnabled || !this.webglRenderer) {
            return;
        }
        if (!this.canvas || !this.ctx) {
            return;
        }

        this.ctx.clearRect(0, 0, this.width, this.height);

        if (!this.showGraticule && !this.showProjectionName) {
            return;
        }

        const projection = this.projectionManager.configureProjection(
            this.projectionManager.getCurrentProjection(),
            this.width,
            this.height
        );

        if (this.showGraticule) {
            this.drawGraticuleOnCanvas(projection);
        }

        if (this.showProjectionName) {
            this.drawProjectionNameOnCanvas();
        }
    }

    async transformImageWithProjection(sourceImageData, outputImageData, projection, sourceWidth, sourceHeight, showProgress = true) {
        const totalPixels = this.width * this.height;
        let processedPixels = 0;

        if (!projection.invert) {
            // Show warning and fill with background color if invert is not supported
            console.warn('Current projection does not support image transformation');
            for (let i = 0; i < outputImageData.data.length; i += 4) {
                outputImageData.data[i] = 248;     // R
                outputImageData.data[i + 1] = 249; // G  
                outputImageData.data[i + 2] = 250; // B
                outputImageData.data[i + 3] = 255; // A
            }
            return;
        }

        return new Promise((resolve) => {
            const processChunk = (startY, endY) => {
                for (let y = startY; y < endY; y++) {
                    for (let x = 0; x < this.width; x++) {
                        const geoCoords = projection.invert([x, y]);
                        
                        if (geoCoords && isFinite(geoCoords[0]) && isFinite(geoCoords[1])) {
                            const [longitude, latitude] = geoCoords;
                            
                            if (longitude >= -180 && longitude <= 180 && 
                                latitude >= -90 && latitude <= 90) {
                                
                                const [sourceX, sourceY] = this.projectionManager.geoToImageCoordinates(
                                    longitude, latitude, sourceWidth, sourceHeight
                                );

                                const sourcePixel = this.samplePixel(
                                    sourceImageData, sourceX, sourceY, sourceWidth, sourceHeight
                                );

                                const outputIndex = (y * this.width + x) * 4;
                                outputImageData.data[outputIndex] = sourcePixel.r;
                                outputImageData.data[outputIndex + 1] = sourcePixel.g;
                                outputImageData.data[outputIndex + 2] = sourcePixel.b;
                                outputImageData.data[outputIndex + 3] = sourcePixel.a;
                            }
                        }
                        processedPixels++;
                    }
                }
            };

            const chunkSize = 50;
            let currentY = 0;

            const processNextChunk = () => {
                const endY = Math.min(currentY + chunkSize, this.height);
                processChunk(currentY, endY);
                currentY = endY;

                if (showProgress) {
                    const progress = (processedPixels / totalPixels) * 100;
                    this.updateProgress(progress);
                }

                if (currentY < this.height) {
                    setTimeout(processNextChunk, 1);
                } else {
                    resolve();
                }
            };
            processNextChunk();
        });
    }

    samplePixel(imageData, x, y, width, height) {
        const x1 = Math.floor(x);
        const y1 = Math.floor(y);
        const x2 = Math.min(x1 + 1, width - 1);
        const y2 = Math.min(y1 + 1, height - 1);

        const fx = x - x1;
        const fy = y - y1;

        const getPixel = (px, py) => {
            const index = (py * width + px) * 4;
            return {
                r: imageData.data[index] || 0,
                g: imageData.data[index + 1] || 0,
                b: imageData.data[index + 2] || 0,
                a: imageData.data[index + 3] || 255
            };
        };

        const p1 = getPixel(x1, y1);
        const p2 = getPixel(x2, y1);
        const p3 = getPixel(x1, y2);
        const p4 = getPixel(x2, y2);

        return {
            r: Math.round(p1.r * (1 - fx) * (1 - fy) + p2.r * fx * (1 - fy) + p3.r * (1 - fx) * fy + p4.r * fx * fy),
            g: Math.round(p1.g * (1 - fx) * (1 - fy) + p2.g * fx * (1 - fy) + p3.g * (1 - fx) * fy + p4.g * fx * fy),
            b: Math.round(p1.b * (1 - fx) * (1 - fy) + p2.b * fx * (1 - fy) + p3.b * (1 - fx) * fy + p4.b * fx * fy),
            a: Math.round(p1.a * (1 - fx) * (1 - fy) + p2.a * fx * (1 - fy) + p3.a * (1 - fx) * fy + p4.a * fx * fy)
        };
    }

    determineProjectionTransition(previousProjection, nextProjection) {
        if (!previousProjection || !nextProjection) {
            return { type: 'none' };
        }

        if (this.shouldUseCrossFade(previousProjection, nextProjection)) {
            return { type: 'crossfade' };
        }

        const raw0 = previousProjection.raw;
        const raw1 = nextProjection.raw;

        if (typeof raw0 === 'function' && typeof raw1 === 'function' && this.isRawInterpolationSafe(raw0, raw1)) {
            return {
                type: 'interpolate',
                interpolate: this.createRawProjectionInterpolator(previousProjection, nextProjection, raw0, raw1)
            };
        }

        return {
            type: 'interpolate',
            interpolate: this.createTransformProjectionInterpolator(previousProjection, nextProjection)
        };
    }

    createRawProjectionInterpolator(previousProjection, nextProjection, raw0, raw1) {

        const renderer = this;
        const scale0 = previousProjection.scale();
        const scale1 = nextProjection.scale();

        const translate0 = previousProjection.translate();
        const translate1 = nextProjection.translate();

        const center0 = previousProjection.center();
        const center1 = nextProjection.center();

        const rotate0 = previousProjection.rotate();
        const rotate1 = nextProjection.rotate();

        const precision0 = previousProjection.precision();
        const precision1 = nextProjection.precision();

        const clipAngle0 = previousProjection.clipAngle();
        const clipAngle1 = nextProjection.clipAngle();

        const clipExtent0 = previousProjection.clipExtent();
        const clipExtent1 = nextProjection.clipExtent();

        const reflectX0 = this.getProjectionReflection(previousProjection, 'reflectX');
        const reflectX1 = this.getProjectionReflection(nextProjection, 'reflectX');
        const reflectY0 = this.getProjectionReflection(previousProjection, 'reflectY');
        const reflectY1 = this.getProjectionReflection(nextProjection, 'reflectY');

        return (t) => {
            if (t <= 0) {
                return previousProjection;
            }
            if (t >= 1) {
                return nextProjection;
            }

            const raw = function(lambda, phi) {
                const p0 = raw0(lambda, phi);
                const p1 = raw1(lambda, phi);

                const validP0 = renderer.isValidProjectedPoint(p0);
                const validP1 = renderer.isValidProjectedPoint(p1);

                if (!validP0 && !validP1) {
                    return null;
                }

                if (!validP0) {
                    return p1;
                }

                if (!validP1) {
                    return p0;
                }

                return [
                    p0[0] + (p1[0] - p0[0]) * t,
                    p0[1] + (p1[1] - p0[1]) * t
                ];
            };

            const interpolated = d3.geoProjection(raw)
                .scale(this.interpolateNumber(scale0, scale1, t))
                .translate(this.interpolateArray(translate0, translate1, t))
                .center(this.interpolateArray(center0, center1, t))
                .rotate(this.interpolateArray(rotate0, rotate1, t))
                .precision(this.interpolateNumber(precision0, precision1, t));

            const clipAngle = renderer.interpolateClipAngle(clipAngle0, clipAngle1, t);
            if (clipAngle === null) {
                interpolated.clipAngle(null);
            } else if (!Number.isNaN(clipAngle)) {
                interpolated.clipAngle(Math.max(0, clipAngle));
            }

            const clipExtent = renderer.interpolateClipExtent(clipExtent0, clipExtent1, t);
            if (clipExtent) {
                interpolated.clipExtent(clipExtent);
            } else {
                interpolated.clipExtent(null);
            }

            const reflectX = renderer.interpolateBoolean(reflectX0, reflectX1, t);
            if (typeof interpolated.reflectX === 'function' && reflectX !== null) {
                interpolated.reflectX(reflectX);
            }

            const reflectY = renderer.interpolateBoolean(reflectY0, reflectY1, t);
            if (typeof interpolated.reflectY === 'function' && reflectY !== null) {
                interpolated.reflectY(reflectY);
            }

            return interpolated;
        };
    }

    createTransformProjectionInterpolator(previousProjection, nextProjection) {
        const renderer = this;
        return (t) => {
            if (t <= 0) {
                return previousProjection;
            }
            if (t >= 1) {
                return nextProjection;
            }

            let currentT = t;

            return d3.geoTransform({
                point: function(x, y) {
                    const p0 = previousProjection([x, y]);
                    const p1 = nextProjection([x, y]);

                    const validP0 = renderer.isValidProjectedPoint(p0);
                    const validP1 = renderer.isValidProjectedPoint(p1);

                    if (!validP0 && !validP1) {
                        return;
                    }

                    if (!validP0) {
                        this.stream.point(p1[0], p1[1]);
                        return;
                    }

                    if (!validP1) {
                        this.stream.point(p0[0], p0[1]);
                        return;
                    }

                    this.stream.point(
                        p0[0] + (p1[0] - p0[0]) * currentT,
                        p0[1] + (p1[1] - p0[1]) * currentT
                    );
                },
                sphere: function() {
                    if (this.stream.sphere) {
                        this.stream.sphere();
                    }
                },
                lineStart: function() {
                    if (this.stream.lineStart) {
                        this.stream.lineStart();
                    }
                },
                lineEnd: function() {
                    if (this.stream.lineEnd) {
                        this.stream.lineEnd();
                    }
                },
                polygonStart: function() {
                    if (this.stream.polygonStart) {
                        this.stream.polygonStart();
                    }
                },
                polygonEnd: function() {
                    if (this.stream.polygonEnd) {
                        this.stream.polygonEnd();
                    }
                }
            });
        };
    }

    performCrossFadeTransition(applyProjection, targetProjection) {
        const currentGroupNode = this.geoGroup.node();
        if (!currentGroupNode) {
            applyProjection(targetProjection);
            return;
        }

        const previousGroupNode = currentGroupNode.cloneNode(true);
        if (!previousGroupNode) {
            applyProjection(targetProjection);
            return;
        }

        previousGroupNode.classList.add('geo-layer-previous');
        const svgNode = this.svg.node();
        svgNode.appendChild(previousGroupNode);

        const previousSelection = d3.select(previousGroupNode);
        const currentSelection = this.geoGroup;

        previousSelection.interrupt().style('opacity', 1);
        currentSelection.interrupt().style('opacity', 0);

        applyProjection(targetProjection);

        const duration = this.transitionDuration;
        previousSelection.transition()
            .duration(duration)
            .ease(d3.easeCubicInOut)
            .style('opacity', 0)
            .remove();

        currentSelection.transition()
            .duration(duration)
            .ease(d3.easeCubicInOut)
            .style('opacity', 1);
    }

    isRawInterpolationSafe(raw0, raw1) {
        const samplePoints = [
            [0, 0],
            [Math.PI / 6, 0],
            [-Math.PI / 6, 0],
            [0, Math.PI / 6],
            [0, -Math.PI / 6],
            [Math.PI / 4, Math.PI / 8],
            [-Math.PI / 4, Math.PI / 8],
            [Math.PI / 3, 0],
            [-Math.PI / 3, 0],
            [0, Math.PI / 3],
            [0, -Math.PI / 3],
            [Math.PI / 2.2, 0],
            [-Math.PI / 2.2, 0],
            [0, Math.PI * 0.49],
            [0, -Math.PI * 0.49]
        ];

        for (const [lambda, phi] of samplePoints) {
            const p0 = raw0(lambda, phi);
            const p1 = raw1(lambda, phi);
            const valid0 = this.isValidRawPoint(p0);
            const valid1 = this.isValidRawPoint(p1);

            if (valid0 !== valid1) {
                return false;
            }
        }

        return true;
    }

    isValidRawPoint(point) {
        if (!point || !isFinite(point[0]) || !isFinite(point[1])) {
            return false;
        }

        const [x, y] = point;
        const limit = Math.PI * 4;
        return Math.abs(x) <= limit && Math.abs(y) <= limit;
    }

    isValidProjectedPoint(point) {
        if (!point || !isFinite(point[0]) || !isFinite(point[1])) {
            return false;
        }
        const [x, y] = point;
        const thresholdX = this.width * 20;
        const thresholdY = this.height * 20;
        return Math.abs(x) <= thresholdX && Math.abs(y) <= thresholdY;
    }

    shouldUseCrossFade(previousProjection, nextProjection) {
        const angle0 = this.getProjectionClipAngle(previousProjection);
        const angle1 = this.getProjectionClipAngle(nextProjection);

        const severe0 = this.isSevereClipAngle(angle0);
        const severe1 = this.isSevereClipAngle(angle1);

        if (!severe0 && !severe1) {
            return false;
        }

        if (severe0 && severe1) {
            const diff = Math.abs((angle0 || 0) - (angle1 || 0));
            return diff > 5;
        }

        return true;
    }

    getProjectionClipAngle(projection) {
        if (projection && typeof projection.clipAngle === 'function') {
            const angle = projection.clipAngle();
            return typeof angle === 'number' ? angle : null;
        }
        return null;
    }

    isSevereClipAngle(angle) {
        if (angle == null || Number.isNaN(angle)) {
            return false;
        }
        return angle <= 95;
    }

    interpolateNumber(a, b, t) {
        if (typeof a !== 'number' && typeof b !== 'number') {
            return 0;
        }
        if (typeof a !== 'number') {
            return b;
        }
        if (typeof b !== 'number') {
            return a;
        }
        return a + (b - a) * t;
    }

    interpolateArray(a, b, t) {
        if (!Array.isArray(a) && !Array.isArray(b)) {
            return [];
        }

        if (!Array.isArray(a)) {
            return b.slice();
        }

        if (!Array.isArray(b)) {
            return a.slice();
        }

        const length = Math.max(a.length, b.length);
        const result = [];
        for (let i = 0; i < length; i++) {
            const valueA = typeof a[i] === 'number' ? a[i] : b[i];
            const valueB = typeof b[i] === 'number' ? b[i] : a[i];
            result.push(this.interpolateNumber(valueA, valueB, t));
        }
        return result;
    }

    interpolateClipAngle(a, b, t) {
        if (a == null && b == null) {
            return null;
        }

        const angleA = a == null ? 180 : a;
        const angleB = b == null ? 180 : b;
        const interpolated = angleA + (angleB - angleA) * t;

        if (interpolated >= 179.999) {
            return null;
        }

        return interpolated;
    }

    interpolateClipExtent(a, b, t) {
        if (!a && !b) {
            return null;
        }

        const extentA = a || b;
        const extentB = b || a;

        if (!extentA || !extentB) {
            return null;
        }

        return [
            [
                this.interpolateNumber(extentA[0][0], extentB[0][0], t),
                this.interpolateNumber(extentA[0][1], extentB[0][1], t)
            ],
            [
                this.interpolateNumber(extentA[1][0], extentB[1][0], t),
                this.interpolateNumber(extentA[1][1], extentB[1][1], t)
            ]
        ];
    }

    interpolateBoolean(a, b, t) {
        const isBoolA = typeof a === 'boolean';
        const isBoolB = typeof b === 'boolean';

        if (!isBoolA && !isBoolB) {
            return null;
        }

        if (!isBoolA) {
            return b;
        }

        if (!isBoolB) {
            return a;
        }

        return t < 0.5 ? a : b;
    }

    getProjectionReflection(projection, method) {
        if (typeof projection[method] === 'function') {
            try {
                return projection[method]();
            } catch (error) {
                return null;
            }
        }
        return null;
    }

    extractGeoFeatures(geoData) {
        if (!geoData) {
            return [];
        }

        if (geoData.type === 'FeatureCollection') {
            return geoData.features || [];
        }

        if (geoData.type === 'Feature') {
            return [geoData];
        }

        return [{
            type: 'Feature',
            geometry: geoData
        }];
    }

    shouldAnimate() {
        return Boolean(this.previousProjection) && this.transitionDuration > 0;
    }

    createGeoTransition() {
        return this.svg.transition()
            .duration(this.transitionDuration)
            .ease(d3.easeCubicInOut);
    }

    updateGraticuleVisibility() {
        if (this.graticulePath) {
            this.graticulePath.style('display', this.showGraticule ? null : 'none');
        }
        if (this.graticuleOutlinePath) {
            this.graticuleOutlinePath.style('display', this.showGraticule ? null : 'none');
        }
    }

    showSVG() {
        this.svg.style('display', 'block');
        this.canvas.style.display = 'none';
        if (this.webglCanvas) {
            this.webglCanvas.style.display = 'none';
        }
    }

    showCanvas() {
        this.svg.style('display', 'none');
        this.canvas.style.display = 'block';
        if (this.webglCanvas) {
            this.webglCanvas.style.display = 'none';
        }
    }

    showWebGL() {
        this.svg.style('display', 'none');
        if (this.webglCanvas) {
            this.webglCanvas.style.display = 'block';
        }
        this.canvas.style.display = 'block';
    }

    showLoading() {
        document.getElementById('loading').style.display = 'block';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }

    updateProgress(percentage) {
        document.getElementById('progress').style.width = Math.min(100, Math.max(0, percentage)) + '%';
    }

    showError(message) {
        this.hideLoading();
        console.error(message);
        alert(message);
    }

    setDimensions(width, height) {
        this.width = width;
        this.height = height;
        this.svg.attr('width', width).attr('height', height);
        this.canvas.width = width;
        this.canvas.height = height;
        if (this.webglCanvas) {
            this.webglCanvas.width = width;
            this.webglCanvas.height = height;
        }
        if (this.webglEnabled && this.webglRenderer) {
            this.webglRenderer.resize(width, height);
            this.markOverlayDirty();
        }
    }

    clear() {
        this.previousProjection = null;
        this.setupSVG();
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.stopWebGLAnimation();
        if (this.webglEnabled && this.webglRenderer) {
            this.webglRenderer.clearTexture();
            this.webglRenderer.clear();
        } else {
            this.ctx.fillStyle = '#f8f9fa';
            this.ctx.fillRect(0, 0, this.width, this.height);
        }
        this.overlayNeedsUpdate = false;
    }

    drawGraticuleOnCanvas(projection) {
        const graticule = d3.geoGraticule();
        const path = d3.geoPath().projection(projection).context(this.ctx);

        this.ctx.beginPath();
        path(graticule.outline());
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.globalAlpha = 0.8;
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;

        this.ctx.beginPath();
        path(graticule());
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.7;
        this.ctx.stroke();
    }

    drawProjectionNameOnCanvas() {
        const projectionKey = this.projectionManager.currentProjection;

        // LanguageManagerから投影法名を取得（日本語）
        let projectionName = projectionKey;
        if (this.languageManager) {
            projectionName = this.languageManager.t(`projections.${projectionKey}.name`);
        }

        this.ctx.save();
        this.ctx.font = 'bold 16px "Noto Sans JP", "Hiragino Sans", sans-serif';
        this.ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 1.0)';
        this.ctx.lineWidth = 4;

        const textMetrics = this.ctx.measureText(projectionName);
        const textWidth = textMetrics.width;
        const padding = 10;

        const x = this.width - textWidth - padding - 10;
        const y = this.height - padding - 5;

        this.ctx.strokeText(projectionName, x, y);
        this.ctx.fillText(projectionName, x, y);
        this.ctx.restore();
    }

    setGraticuleVisibility(visible) {
        this.showGraticule = visible;
        this.updateGraticuleVisibility();

        if (this.currentData) {
            if (this.currentData.type === 'image') {
                if (this.webglEnabled && this.webglRenderer) {
                    this.markOverlayDirty();
                    const transitionActive = typeof this.webglRenderer.isTransitionActive === 'function'
                        ? this.webglRenderer.isTransitionActive()
                        : false;
                    if (!transitionActive) {
                        this.refreshOverlay();
                        this.overlayNeedsUpdate = false;
                    }
                } else {
                    const projection = this.projectionManager.configureProjection(
                        this.projectionManager.getCurrentProjection(),
                        this.width,
                        this.height
                    );
                    this.renderImageDirect(this.currentData.data, projection);
                }
            }
        }
    }

    setProjectionNameVisibility(visible) {
        this.showProjectionName = visible;

        if (this.currentData) {
            if (this.currentData.type === 'image') {
                if (this.webglEnabled && this.webglRenderer) {
                    this.markOverlayDirty();
                    const transitionActive = typeof this.webglRenderer.isTransitionActive === 'function'
                        ? this.webglRenderer.isTransitionActive()
                        : false;
                    if (!transitionActive) {
                        this.refreshOverlay();
                        this.overlayNeedsUpdate = false;
                    }
                } else {
                    const projection = this.projectionManager.configureProjection(
                        this.projectionManager.getCurrentProjection(),
                        this.width,
                        this.height
                    );
                    this.renderImageDirect(this.currentData.data, projection);
                }
            }
        }
    }

    supportsWebGL() {
        return Boolean(this.webglEnabled && this.webglRenderer);
    }

    getWebGLError() {
        return this.webglInitError;
    }

    exportImage() {
        if (!this.currentData) return null;

        if (this.currentData.type === 'geojson') {
            const projection = this.projectionManager.configureProjection(
                this.projectionManager.getCurrentProjection(),
                this.width,
                this.height
            );

            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = this.width;
            exportCanvas.height = this.height;

            const exportCtx = exportCanvas.getContext('2d');
            this.renderGeoJSONToCanvas(exportCtx, projection, this.currentData.data);

            // 投影法を表示する場合、エクスポート用キャンバスに描画
            if (this.showProjectionName) {
                const tempCtx = this.ctx;
                this.ctx = exportCtx;
                this.drawProjectionNameOnCanvas();
                this.ctx = tempCtx;
            }

            return Promise.resolve(exportCanvas.toDataURL('image/png'));
        } else {
            if (this.webglEnabled && this.webglRenderer && this.webglCanvas) {
                const exportCanvas = document.createElement('canvas');
                exportCanvas.width = this.width;
                exportCanvas.height = this.height;
                const exportCtx = exportCanvas.getContext('2d');

                const capturedCanvas = typeof this.webglRenderer.captureFrameCanvas === 'function'
                    ? this.webglRenderer.captureFrameCanvas()
                    : null;

                if (capturedCanvas) {
                    exportCtx.drawImage(capturedCanvas, 0, 0);
                } else {
                    exportCtx.drawImage(this.webglCanvas, 0, 0);
                }

                if (this.showGraticule) {
                    exportCtx.drawImage(this.canvas, 0, 0);
                }

                // 投影法を表示する場合、エクスポート用キャンバスに描画
                if (this.showProjectionName) {
                    const tempCtx = this.ctx;
                    this.ctx = exportCtx;
                    this.drawProjectionNameOnCanvas();
                    this.ctx = tempCtx;
                }

                return Promise.resolve(exportCanvas.toDataURL('image/png'));
            }

            return Promise.resolve(this.canvas.toDataURL('image/png'));
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Renderer;
}
