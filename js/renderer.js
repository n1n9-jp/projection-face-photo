class Renderer {
    constructor(projectionManager) {
        this.projectionManager = projectionManager;
        this.svg = d3.select('#map-svg');
        this.canvas = document.getElementById('image-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = 800;
        this.height = 600;
        this.currentData = null;
        this.isRendering = false;
        this.previousProjection = null;
        this.transitionDuration = 500;
        this.showGraticule = true;
    }

    initialize() {
        this.setupSVG();
        this.setupCanvas();
    }

    setupSVG() {
        this.svg
            .attr('width', this.width)
            .attr('height', this.height)
            .style('background', '#f8f9fa');

        this.svg.selectAll('*').remove();
    }

    setupCanvas() {
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.ctx.fillStyle = '#f8f9fa';
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    async render(data) {
        if (this.isRendering) return;
        
        this.isRendering = true;
        this.currentData = data;

        try {
            this.showLoading();
            
            if (data.type === 'geojson') {
                await this.renderGeoJSON(data.data);
                this.showSVG();
            } else if (data.type === 'image') {
                await this.renderImage(data.data);
                this.showCanvas();
            }
        } catch (error) {
            console.error('Rendering error:', error);
            this.showError('描画中にエラーが発生しました: ' + error.message);
        } finally {
            this.hideLoading();
            this.isRendering = false;
        }
    }

    async renderGeoJSON(geoData, useTransition = false) {
        const projection = this.projectionManager.getCurrentProjection();
        const configuredProjection = this.projectionManager.configureProjection(
            projection, this.width, this.height
        );

        // For GeoJSON, we can use transition even without invert function
        // because we're interpolating SVG paths directly
        if (useTransition && this.previousProjection) {
            this.renderGeoJSONWithTransition(geoData, configuredProjection);
        } else {
            this.renderGeoJSONDirect(geoData, configuredProjection);
        }

        this.previousProjection = configuredProjection;
    }

    renderGeoJSONDirect(geoData, projection) {
        const path = d3.geoPath().projection(projection);

        this.svg.selectAll('*').remove();

        const g = this.svg.append('g');

        g.append('defs').append('path')
            .datum({type: 'Sphere'})
            .attr('id', 'sphere')
            .attr('d', path);

        g.append('use')
            .attr('class', 'sphere')
            .attr('xlink:href', '#sphere');

        // Render GeoJSON features first (background)
        if (geoData.type === 'FeatureCollection') {
            g.selectAll('.feature')
                .data(geoData.features)
                .enter().append('path')
                .attr('class', 'country')
                .attr('d', path)
                .on('mouseover', function(event, d) {
                    d3.select(this).style('fill', '#ff6b6b');
                    if (d.properties && d.properties.name) {
                        console.log('Feature:', d.properties.name);
                    }
                })
                .on('mouseout', function() {
                    d3.select(this).style('fill', '#4a90e2');
                });
        } else if (geoData.type === 'Feature') {
            g.append('path')
                .datum(geoData)
                .attr('class', 'country')
                .attr('d', path);
        }

        // Render graticule (SVG用の実装)
        if (this.showGraticule) {
            // D3のgeoGraticuleを正しく使用
            const graticule = d3.geoGraticule();
            const lines = graticule.lines();
            
            // 投影法の境界線（outline）を描画
            g.append('path')
                .datum(graticule.outline)
                .attr('class', 'graticule-outline')
                .attr('d', path)
                .attr('fill', 'none')
                .attr('stroke', '#333')
                .attr('stroke-width', '2px')
                .attr('stroke-opacity', '0.8');
            
            // graticuleのlines()メソッドで経緯線を個別に描画
            g.selectAll('.graticule-line')
                .data(lines)
                .enter().append('path')
                .attr('class', 'graticule-line')
                .attr('d', path)
                .attr('fill', 'none')
                .attr('stroke', '#666')
                .attr('stroke-width', '1px')
                .attr('stroke-opacity', '0.7');
        }
    }

    renderGeoJSONWithTransition(geoData, targetProjection) {
        if (!this.previousProjection) {
            this.renderGeoJSONDirect(geoData, targetProjection);
            return;
        }

        try {
            // 安定したパス補間による実装
            const previousPath = d3.geoPath().projection(this.previousProjection);
            const targetPath = d3.geoPath().projection(targetProjection);

            // 存在する要素のみ選択してトランジション
            const elements = this.svg.selectAll('.sphere, .graticule, .graticule-line, .graticule-outline, .country')
                .filter(function() {
                    // 既にd属性を持つ要素のみトランジション対象
                    return d3.select(this).attr('d') !== null;
                });

            const transition = elements
                .transition()
                .duration(this.transitionDuration)
                .ease(d3.easeQuadInOut)
                .attrTween('d', (d) => this.pathTween(previousPath, targetPath, d));
                
            // トランジション終了時に最終状態を確実に設定
            transition.on('end', () => {
                this.renderGeoJSONDirect(geoData, targetProjection);
            });
            
        } catch (error) {
            console.warn('Transition failed, falling back to direct render:', error);
            this.renderGeoJSONDirect(geoData, targetProjection);
        }
    }

    pathTween(previousPath, targetPath, datum) {
        return (t) => {
            try {
                const p1 = previousPath(datum);
                const p2 = targetPath(datum);
                
                // 有効なパスかチェック
                if (!p1 || !p2 || 
                    p1.includes('Infinity') || p1.includes('NaN') || 
                    p2.includes('Infinity') || p2.includes('NaN')) {
                    // nullの代わりに終了状態のパスを返す
                    return p2 || p1 || '';
                }
                
                const interpolated = d3.interpolateString(p1, p2);
                const result = interpolated(t);
                
                // 結果も有効かチェック
                if (!result || result.includes('Infinity') || result.includes('NaN')) {
                    // 無効な結果の場合、tの値に応じて適切なパスを返す
                    return t > 0.5 ? p2 : p1;
                }
                
                return result;
            } catch (error) {
                console.warn('Path interpolation error:', error);
                // エラー時は終了状態のパスを返す
                return targetPath(datum) || previousPath(datum) || '';
            }
        };
    }


    async renderImage(imageElement, useTransition = false) {
        const projection = this.projectionManager.getCurrentProjection();
        const configuredProjection = this.projectionManager.configureProjection(
            projection, this.width, this.height
        );

        // Always use direct rendering for images (transitions disabled for now)
        await this.renderImageDirect(imageElement, configuredProjection);
        this.previousProjection = configuredProjection;
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
        
        // 画像の上にgraticuleを描画
        if (this.showGraticule) {
            this.drawGraticuleOnCanvas(projection);
        }
    }

    async renderImageWithTransition(imageElement, targetProjection) {
        console.log('Starting image transition');
        
        // For image transitions, just render the final state directly
        // The complex interpolation isn't working well for images
        await this.renderImageDirect(imageElement, targetProjection);
        
        console.log('Image transition completed (simplified)');
    }

    createInterpolatedProjection(proj1, proj2, t) {
        return (coordinates) => {
            const p1 = proj1(coordinates);
            const p2 = proj2(coordinates);
            
            if (!p1 || !p2) return null;
            
            return [
                p1[0] * (1 - t) + p2[0] * t,
                p1[1] * (1 - t) + p2[1] * t
            ];
        };
    }

    easeQuadInOut(t) {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    async transformImageWithProjection(sourceImageData, outputImageData, projection, sourceWidth, sourceHeight, showProgress = true) {
        const totalPixels = this.width * this.height;
        let processedPixels = 0;

        // If projection doesn't support invert, use forward transformation instead
        if (!projection.invert) {
            return this.transformImageForward(sourceImageData, outputImageData, projection, sourceWidth, sourceHeight, showProgress);
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

    async transformImageForward(sourceImageData, outputImageData, projection, sourceWidth, sourceHeight, showProgress = true) {
        // Clear output first
        for (let i = 0; i < outputImageData.data.length; i += 4) {
            outputImageData.data[i] = 248;     // Background color R
            outputImageData.data[i + 1] = 249; // Background color G  
            outputImageData.data[i + 2] = 250; // Background color B
            outputImageData.data[i + 3] = 255; // Alpha
        }

        const totalPixels = sourceWidth * sourceHeight;
        let processedPixels = 0;

        return new Promise((resolve) => {
            const processChunk = (startY, endY) => {
                for (let sourceY = startY; sourceY < endY; sourceY++) {
                    for (let sourceX = 0; sourceX < sourceWidth; sourceX++) {
                        // Convert source pixel coordinates to geo coordinates
                        const [longitude, latitude] = this.projectionManager.imageToGeoCoordinates(
                            sourceX, sourceY, sourceWidth, sourceHeight
                        );

                        // Project to screen coordinates
                        const screenCoords = projection([longitude, latitude]);
                        
                        if (screenCoords && isFinite(screenCoords[0]) && isFinite(screenCoords[1])) {
                            const [screenX, screenY] = screenCoords;
                            
                            // Check if within canvas bounds
                            if (screenX >= 0 && screenX < this.width && screenY >= 0 && screenY < this.height) {
                                // Get source pixel
                                const sourceIndex = (sourceY * sourceWidth + sourceX) * 4;
                                const r = sourceImageData.data[sourceIndex];
                                const g = sourceImageData.data[sourceIndex + 1];
                                const b = sourceImageData.data[sourceIndex + 2];
                                const a = sourceImageData.data[sourceIndex + 3];

                                // Set output pixel (with anti-aliasing)
                                this.setPixelWithAntialiasing(outputImageData, screenX, screenY, r, g, b, a);
                            }
                        }
                        
                        processedPixels++;
                    }
                }
            };

            const chunkSize = Math.max(1, Math.floor(sourceHeight / 100)); // Smaller chunks for smoother progress
            let currentY = 0;

            const processNextChunk = () => {
                const endY = Math.min(currentY + chunkSize, sourceHeight);
                processChunk(currentY, endY);
                currentY = endY;

                if (showProgress) {
                    const progress = (processedPixels / totalPixels) * 100;
                    this.updateProgress(progress);
                }

                if (currentY < sourceHeight) {
                    setTimeout(processNextChunk, 1);
                } else {
                    resolve();
                }
            };

            processNextChunk();
        });
    }

    setPixelWithAntialiasing(imageData, x, y, r, g, b, a) {
        const x1 = Math.floor(x);
        const y1 = Math.floor(y);
        const x2 = Math.min(x1 + 1, this.width - 1);
        const y2 = Math.min(y1 + 1, this.height - 1);

        const fx = x - x1;
        const fy = y - y1;

        // Distribute pixel value to 4 nearest pixels with bilinear weights
        const weights = [
            (1 - fx) * (1 - fy), // top-left
            fx * (1 - fy),       // top-right
            (1 - fx) * fy,       // bottom-left
            fx * fy              // bottom-right
        ];

        const positions = [
            [x1, y1],
            [x2, y1],
            [x1, y2],
            [x2, y2]
        ];

        positions.forEach(([px, py], i) => {
            if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
                const index = (py * this.width + px) * 4;
                const weight = weights[i];
                
                // Alpha blending
                const existingAlpha = imageData.data[index + 3] / 255;
                const newAlpha = (a * weight) / 255;
                const combinedAlpha = existingAlpha + newAlpha * (1 - existingAlpha);
                
                if (combinedAlpha > 0) {
                    imageData.data[index] = (imageData.data[index] * existingAlpha + r * newAlpha * (1 - existingAlpha)) / combinedAlpha;
                    imageData.data[index + 1] = (imageData.data[index + 1] * existingAlpha + g * newAlpha * (1 - existingAlpha)) / combinedAlpha;
                    imageData.data[index + 2] = (imageData.data[index + 2] * existingAlpha + b * newAlpha * (1 - existingAlpha)) / combinedAlpha;
                    imageData.data[index + 3] = combinedAlpha * 255;
                }
            }
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
            r: Math.round(
                p1.r * (1 - fx) * (1 - fy) +
                p2.r * fx * (1 - fy) +
                p3.r * (1 - fx) * fy +
                p4.r * fx * fy
            ),
            g: Math.round(
                p1.g * (1 - fx) * (1 - fy) +
                p2.g * fx * (1 - fy) +
                p3.g * (1 - fx) * fy +
                p4.g * fx * fy
            ),
            b: Math.round(
                p1.b * (1 - fx) * (1 - fy) +
                p2.b * fx * (1 - fy) +
                p3.b * (1 - fx) * fy +
                p4.b * fx * fy
            ),
            a: Math.round(
                p1.a * (1 - fx) * (1 - fy) +
                p2.a * fx * (1 - fy) +
                p3.a * (1 - fx) * fy +
                p4.a * fx * fy
            )
        };
    }

    showSVG() {
        this.svg.style('display', 'block');
        this.canvas.style.display = 'none';
    }

    showCanvas() {
        this.svg.style('display', 'none');
        this.canvas.style.display = 'block';
    }

    showLoading() {
        const loading = document.getElementById('loading');
        loading.style.display = 'block';
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        loading.style.display = 'none';
    }

    updateProgress(percentage) {
        const progress = document.getElementById('progress');
        progress.style.width = Math.min(100, Math.max(0, percentage)) + '%';
    }

    showError(message) {
        this.hideLoading();
        console.error(message);
        alert(message);
    }

    async updateProjection(useTransition = true) {
        if (this.currentData) {
            await this.renderWithTransition(this.currentData, useTransition);
        }
    }

    async renderWithTransition(data, useTransition = true) {
        if (this.isRendering) return;
        
        this.isRendering = true;

        try {
            if (data.type === 'geojson') {
                await this.renderGeoJSON(data.data, useTransition);
                this.showSVG();
            } else if (data.type === 'image') {
                await this.renderImage(data.data, useTransition);
                this.showCanvas();
            }
        } catch (error) {
            console.error('Transition rendering error:', error);
            this.showError('トランジション描画中にエラーが発生しました: ' + error.message);
        } finally {
            this.isRendering = false;
        }
    }

    setDimensions(width, height) {
        this.width = width;
        this.height = height;
        
        this.svg
            .attr('width', width)
            .attr('height', height);
            
        this.canvas.width = width;
        this.canvas.height = height;
    }

    clear() {
        this.svg.selectAll('*').remove();
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.fillStyle = '#f8f9fa';
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    drawGraticuleOnCanvas(projection) {
        console.log('Drawing graticule on canvas...');
        
        const graticule = d3.geoGraticule();
        const path = d3.geoPath().projection(projection).context(this.ctx);
        
        // 投影法の境界線（outline）を描画
        this.ctx.beginPath();
        path(graticule.outline());
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.globalAlpha = 0.8;
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;
        
        // Canvas上に経緯線を描画
        this.ctx.beginPath();
        path(graticule());
        this.ctx.strokeStyle = '#666';
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.7;
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;
        
        console.log('Graticule drawn on canvas');
    }

    setGraticuleVisibility(visible) {
        this.showGraticule = visible;
        if (this.currentData) {
            if (this.currentData.type === 'geojson') {
                this.renderGeoJSONDirect(this.currentData.data, 
                    this.projectionManager.configureProjection(
                        this.projectionManager.getCurrentProjection(), 
                        this.width, this.height
                    )
                );
            } else if (this.currentData.type === 'image') {
                // 画像の場合は再描画
                this.renderImageDirect(this.currentData.data, 
                    this.projectionManager.configureProjection(
                        this.projectionManager.getCurrentProjection(), 
                        this.width, this.height
                    )
                );
            }
        }
    }

    exportImage() {
        if (!this.currentData) return null;

        if (this.currentData.type === 'geojson') {
            const svgData = new XMLSerializer().serializeToString(this.svg.node());
            const canvas = document.createElement('canvas');
            canvas.width = this.width;
            canvas.height = this.height;
            const ctx = canvas.getContext('2d');
            
            const img = new Image();
            const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
            const url = URL.createObjectURL(svgBlob);
            
            return new Promise((resolve) => {
                img.onload = () => {
                    ctx.drawImage(img, 0, 0);
                    URL.revokeObjectURL(url);
                    resolve(canvas.toDataURL('image/png'));
                };
                img.src = url;
            });
        } else {
            return Promise.resolve(this.canvas.toDataURL('image/png'));
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Renderer;
}