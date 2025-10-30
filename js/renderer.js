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

    async renderGeoJSON(geoData) {
        const projection = this.projectionManager.getCurrentProjection();
        const configuredProjection = this.projectionManager.configureProjection(
            projection, this.width, this.height
        );
        this.renderGeoJSONDirect(geoData, configuredProjection);
    }

    renderGeoJSONDirect(geoData, projection) {
        const path = d3.geoPath().projection(projection);

        this.svg.selectAll('*').remove();
        const g = this.svg.append('g');

        g.append('path')
            .datum({type: 'Sphere'})
            .attr('class', 'sphere')
            .attr('d', path);

        if (this.showGraticule) {
            const graticule = d3.geoGraticule();
            g.append('path')
                .datum(graticule())
                .attr('class', 'graticule');
            g.append('path')
                .datum(graticule.outline)
                .attr('class', 'graticule-outline');
        }

        if (geoData) {
            g.selectAll('.country')
                .data(geoData.features)
                .enter().append('path')
                .attr('class', 'country');
        }
        
        // Apply path data after all elements are created
        this.svg.selectAll('path').attr('d', path);
    }

    async updateProjection() {
        if (this.currentData && this.currentData.type === 'geojson') {
            await this.renderGeoJSON(this.currentData.data);
        }
        // Note: Image projection updates would go here if needed.
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
        
        if (this.showGraticule) {
            this.drawGraticuleOnCanvas(projection);
        }
    }

    async transformImageWithProjection(sourceImageData, outputImageData, projection, sourceWidth, sourceHeight, showProgress = true) {
        const totalPixels = this.width * this.height;
        let processedPixels = 0;

        if (!projection.invert) {
            // Forward transformation if invert is not supported
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

    showSVG() {
        this.svg.style('display', 'block');
        this.canvas.style.display = 'none';
    }

    showCanvas() {
        this.svg.style('display', 'none');
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
    }

    clear() {
        this.svg.selectAll('*').remove();
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.fillStyle = '#f8f9fa';
        this.ctx.fillRect(0, 0, this.width, this.height);
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

    setGraticuleVisibility(visible) {
        this.showGraticule = visible;
        if (this.currentData) {
            if (this.currentData.type === 'geojson') {
                this.renderGeoJSONDirect(this.currentData.data, this.projectionManager.getCurrentProjection());
            } else if (this.currentData.type === 'image') {
                this.renderImageDirect(this.currentData.data, this.projectionManager.getCurrentProjection());
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
