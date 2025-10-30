class UIControls {
    constructor(projectionManager, renderer) {
        this.projectionManager = projectionManager;
        this.renderer = renderer;
        this.isUpdating = false;
        this.debounceTimeout = null;
    }

    initialize() {
        this.setupProjectionSelector();
        this.setupControlSliders();
        this.setupProjectionInfo();
        this.updateProjectionInfo();
    }

    setupProjectionSelector() {
        const selector = document.getElementById('projection-select');
        
        selector.addEventListener('change', (event) => {
            this.handleProjectionChange(event.target.value);
        });

        this.populateProjectionOptions();
    }

    populateProjectionOptions() {
        const selector = document.getElementById('projection-select');
        const projections = this.projectionManager.getAvailableProjections();
        
        selector.innerHTML = '';
        
        projections.forEach(proj => {
            const option = document.createElement('option');
            option.value = proj.key;
            option.textContent = proj.name;
            selector.appendChild(option);
        });

        selector.value = this.projectionManager.currentProjection;
    }

    setupControlSliders() {
        const scaleSlider = document.getElementById('scale-slider');
        const rotationXSlider = document.getElementById('rotation-x');
        const rotationYSlider = document.getElementById('rotation-y');
        const graticuleCheckbox = document.getElementById('show-graticule');

        const scaleValue = document.getElementById('scale-value');
        const rotationXValue = document.getElementById('rotation-x-value');
        const rotationYValue = document.getElementById('rotation-y-value');

        scaleSlider.addEventListener('input', (event) => {
            const value = parseInt(event.target.value);
            scaleValue.textContent = value;
            this.handleScaleChange(value);
        });

        rotationXSlider.addEventListener('input', (event) => {
            const value = parseInt(event.target.value);
            rotationXValue.textContent = value + '°';
            this.handleRotationChange();
        });

        rotationYSlider.addEventListener('input', (event) => {
            const value = parseInt(event.target.value);
            rotationYValue.textContent = value + '°';
            this.handleRotationChange();
        });

        graticuleCheckbox.addEventListener('change', (event) => {
            this.handleGraticuleChange(event.target.checked);
        });

        this.updateSliderValues();
    }

    updateSliderValues() {
        const scaleSlider = document.getElementById('scale-slider');
        const rotationXSlider = document.getElementById('rotation-x');
        const rotationYSlider = document.getElementById('rotation-y');

        const scaleValue = document.getElementById('scale-value');
        const rotationXValue = document.getElementById('rotation-x-value');
        const rotationYValue = document.getElementById('rotation-y-value');

        scaleSlider.value = this.projectionManager.currentScale;
        rotationXSlider.value = this.projectionManager.currentRotation[0];
        rotationYSlider.value = this.projectionManager.currentRotation[1];

        scaleValue.textContent = this.projectionManager.currentScale;
        rotationXValue.textContent = this.projectionManager.currentRotation[0] + '°';
        rotationYValue.textContent = this.projectionManager.currentRotation[1] + '°';
    }

    setupProjectionInfo() {
        const infoElement = document.getElementById('projection-info');
        
        infoElement.innerHTML = `
            <div class="projection-details">
                <h3 id="projection-name">投影法を選択してください</h3>
                <p id="projection-description"></p>
                <p id="projection-properties"></p>
                <div class="projection-characteristics" id="projection-characteristics" style="display: none;">
                    <h4>特徴:</h4>
                    <ul id="characteristics-list"></ul>
                </div>
            </div>
        `;
    }

    updateProjectionInfo() {
        const info = this.projectionManager.getCurrentProjectionInfo();
        
        const nameElement = document.getElementById('projection-name');
        const descriptionElement = document.getElementById('projection-description');
        const propertiesElement = document.getElementById('projection-properties');
        const characteristicsElement = document.getElementById('projection-characteristics');
        const characteristicsList = document.getElementById('characteristics-list');

        if (info) {
            nameElement.textContent = info.name;
            descriptionElement.textContent = info.description;
            
            const supportsInvert = this.projectionManager.supportsInvert();
            const invertStatus = supportsInvert ? '✓ 画像変形対応' : '✗ GeoJSONのみ対応';
            
            propertiesElement.innerHTML = `
                <strong>分類:</strong> ${info.properties}<br>
                <strong>画像変形:</strong> ${invertStatus}
            `;
            
            const characteristics = this.getProjectionCharacteristics(this.projectionManager.currentProjection);
            if (characteristics.length > 0) {
                characteristicsList.innerHTML = characteristics
                    .map(char => `<li>${char}</li>`)
                    .join('');
                characteristicsElement.style.display = 'block';
            } else {
                characteristicsElement.style.display = 'none';
            }
        } else {
            nameElement.textContent = '投影法を選択してください';
            descriptionElement.textContent = '';
            propertiesElement.textContent = '';
            characteristicsElement.style.display = 'none';
        }
    }

    getProjectionCharacteristics(projectionName) {
        const characteristics = {
            mercator: [
                '直線は直線のまま保持される',
                '角度が正確に保たれる',
                '極地で大きな面積の歪み',
                'Web地図で標準的に使用'
            ],
            stereographic: [
                '角度が正確に保たれる',
                '円は円のまま保持される',
                '中心から離れると歪みが増加',
                '半球の表示に適している'
            ],
            equalEarth: [
                '面積が正確に保たれる',
                '視覚的に自然な外観',
                '直線的な極地線',
                '現代の世界地図に推奨'
            ],
            mollweide: [
                '面積が正確に保たれる',
                '楕円形の世界表現',
                '中央経線で角度歪みなし',
                'テーマ地図に適している'
            ],
            azimuthalEquidistant: [
                '中心からの距離が正確',
                '中心からの方位が正確',
                '航空路線図で使用',
                '極地投影として有用'
            ],
            orthographic: [
                '地球を宇宙から見た視点',
                '半球のみ表示',
                '立体的な外観',
                '教育用途に最適'
            ],
            gnomonic: [
                '大圏航路が直線になる',
                '航海用に有用',
                '中心から離れると極端な歪み',
                '半球の一部のみ表示可能'
            ],
            naturalEarth1: [
                '妥協図法（面積・角度・距離のバランス）',
                '視覚的に美しい',
                '一般的な世界地図に適している',
                '教育・メディア用途で人気'
            ]
        };

        return characteristics[projectionName] || [];
    }

    handleProjectionChange(projectionName) {
        if (this.isUpdating) return;
        
        this.isUpdating = true;
        
        if (this.projectionManager.setCurrentProjection(projectionName)) {
            this.updateProjectionInfo();
            this.debouncedUpdate();
        }
        
        this.isUpdating = false;
    }

    handleScaleChange(scale) {
        this.projectionManager.setScale(scale);
        this.debouncedUpdate();
    }

    handleRotationChange() {
        const rotationX = parseInt(document.getElementById('rotation-x').value);
        const rotationY = parseInt(document.getElementById('rotation-y').value);
        
        this.projectionManager.setRotation(rotationX, rotationY);
        this.debouncedUpdate();
    }

    handleGraticuleChange(visible) {
        this.renderer.setGraticuleVisibility(visible);
    }

    debouncedUpdate() {
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }
        
        this.debounceTimeout = setTimeout(() => {
            this.renderer.updateProjection();
        }, 300);
    }

    setProjection(projectionName) {
        const selector = document.getElementById('projection-select');
        selector.value = projectionName;
        this.handleProjectionChange(projectionName);
    }

    resetControls() {
        const scaleSlider = document.getElementById('scale-slider');
        const rotationXSlider = document.getElementById('rotation-x');
        const rotationYSlider = document.getElementById('rotation-y');

        scaleSlider.value = 150;
        rotationXSlider.value = 0;
        rotationYSlider.value = 0;

        this.projectionManager.setScale(150);
        this.projectionManager.setRotation(0, 0);
        
        this.updateSliderValues();
        this.debouncedUpdate();
    }

    enableControls() {
        const controls = document.querySelectorAll('#projection-select, .control-group input');
        controls.forEach(control => {
            control.disabled = false;
        });
    }

    disableControls() {
        const controls = document.querySelectorAll('#projection-select, .control-group input');
        controls.forEach(control => {
            control.disabled = true;
        });
    }

    showMessage(message, type = 'info') {
        const existingMessage = document.querySelector('.ui-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `ui-message ui-message-${type}`;
        messageDiv.textContent = message;
        
        messageDiv.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: ${type === 'error' ? '#ff6b6b' : '#4a90e2'};
            color: white;
            padding: 12px 20px;
            border-radius: 5px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 1000;
            font-size: 14px;
            max-width: 300px;
            transition: opacity 0.3s ease;
        `;

        document.body.appendChild(messageDiv);

        setTimeout(() => {
            messageDiv.style.opacity = '0';
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
            }, 300);
        }, 3000);
    }

    addExportButton() {
        const canvasContainer = document.querySelector('.canvas-container');
        
        const existingButton = document.getElementById('export-button');
        if (existingButton) return;

        const exportButton = document.createElement('button');
        exportButton.id = 'export-button';
        exportButton.textContent = '画像をエクスポート';
        exportButton.style.cssText = `
            margin-top: 20px;
            padding: 10px 20px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.3s ease;
        `;

        exportButton.addEventListener('click', async () => {
            try {
                const dataURL = await this.renderer.exportImage();
                if (dataURL) {
                    const link = document.createElement('a');
                    link.download = `projection-${this.projectionManager.currentProjection}-${Date.now()}.png`;
                    link.href = dataURL;
                    link.click();
                    this.showMessage('画像をエクスポートしました', 'info');
                }
            } catch (error) {
                this.showMessage('エクスポートに失敗しました', 'error');
            }
        });

        exportButton.addEventListener('mouseover', () => {
            exportButton.style.background = '#5a67d8';
        });

        exportButton.addEventListener('mouseout', () => {
            exportButton.style.background = '#667eea';
        });

        canvasContainer.appendChild(exportButton);
    }

    updateUIForDataType(dataType) {
        if (dataType === 'image') {
            this.addExportButton();
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIControls;
}