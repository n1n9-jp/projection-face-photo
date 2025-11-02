class UIControls {
    constructor(projectionManager, renderer, languageManager) {
        this.projectionManager = projectionManager;
        this.renderer = renderer;
        this.languageManager = languageManager;
        this.isUpdating = false;
        this.debounceTimeout = null;
        this.accordionSections = [];
        this.accordionState = {};
    }

    initialize() {
        this.setupProjectionSelector();
        this.setupControlSliders();
        this.setupProjectionInfo();
        this.updateProjectionInfo();
        this.initializeAccordion();
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

        const groups = {};
        projections.forEach(proj => {
            const groupName = this.languageManager.t(`projections.${proj.key}.properties`);
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(proj);
        });

        for (const groupName in groups) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = groupName;
            
            groups[groupName].forEach(proj => {
                const option = document.createElement('option');
                option.value = proj.key;
                option.textContent = this.languageManager.t(`projections.${proj.key}.name`);
                optgroup.appendChild(option);
            });
            
            selector.appendChild(optgroup);
        }

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
                <h3 id="projection-name">${this.languageManager.t('infoSection.selectPrompt')}</h3>
                <p id="projection-description"></p>
                <p id="projection-properties"></p>
                <div class="projection-characteristics" id="projection-characteristics" style="display: none;">
                    <h4>${this.languageManager.t('infoSection.characteristics')}</h4>
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
            nameElement.textContent = this.languageManager.t(`projections.${this.projectionManager.currentProjection}.name`);
            descriptionElement.textContent = this.languageManager.t(`projections.${this.projectionManager.currentProjection}.description`);
            
            const supportsInvert = this.projectionManager.supportsInvert();
            const invertStatus = supportsInvert ? this.languageManager.t('infoSection.imageSupported') : this.languageManager.t('infoSection.imageNotSupported');
            
            propertiesElement.innerHTML = `
                <strong>${this.languageManager.t('infoSection.classification')}</strong> ${this.languageManager.t(`projections.${this.projectionManager.currentProjection}.properties`)}<br>
                <strong>${this.languageManager.t('infoSection.imageSupport')}</strong> ${invertStatus}
            `;
            
            const characteristics = this.languageManager.t(`projections.${this.projectionManager.currentProjection}.characteristics`);
            if (Array.isArray(characteristics) && characteristics.length > 0) {
                characteristicsList.innerHTML = characteristics
                    .map(char => `<li>${char}</li>`)
                    .join('');
                characteristicsElement.style.display = 'block';
            } else {
                characteristicsElement.style.display = 'none';
            }
        } else {
            nameElement.textContent = this.languageManager.t('infoSection.selectPrompt');
            descriptionElement.textContent = '';
            propertiesElement.textContent = '';
            characteristicsElement.style.display = 'none';
        }
    }

    getProjectionCharacteristics(projectionName) {
        return this.languageManager.t(`projections.${projectionName}.characteristics`) || [];
    }

    handleProjectionChange(projectionName) {
        if (this.isUpdating) return;
        
        this.isUpdating = true;
        
        if (this.projectionManager.setCurrentProjection(projectionName)) {
            this.updateProjectionInfo();
            this.renderer.handleProjectionChange();
            this.debouncedUpdate();
        }
        
        this.isUpdating = false;
    }

    handleScaleChange(scale) {
        this.projectionManager.setScale(scale);
        this.renderer.handleViewChange();
        this.debouncedUpdate();
    }

    handleRotationChange() {
        const rotationX = parseInt(document.getElementById('rotation-x').value);
        const rotationY = parseInt(document.getElementById('rotation-y').value);
        
        this.projectionManager.setRotation(rotationX, rotationY);
        this.renderer.handleViewChange();
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
        this.renderer.handleViewChange();
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
        exportButton.textContent = this.languageManager.t('controlSection.exportImage');
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
                    this.showMessage(this.languageManager.t('messages.imageExported'), 'info');
                }
            } catch (error) {
                this.showMessage(this.languageManager.t('messages.exportFailed'), 'error');
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
        if (dataType === 'image' || dataType === 'geojson') {
            this.addExportButton();
        }
    }

    initializeAccordion() {
        this.accordionSections = Array.from(document.querySelectorAll('.accordion-section'));

        this.accordionSections.forEach(section => {
            const id = section.dataset.accordionId;
            if (!id) return;

            const toggle = section.querySelector('.accordion-toggle');
            const content = section.querySelector('.accordion-content');

            if (!toggle || !content) return;

            if (!content.id) {
                content.id = `accordion-content-${id}`;
            }

            toggle.setAttribute('aria-controls', content.id);
            toggle.addEventListener('click', () => {
                this.toggleAccordionSection(id);
            });
        });

        this.applyInitialAccordionState();
    }

    setAccordionState(newState, options = {}) {
        const { merge = true } = options;

        if (!this.accordionSections || this.accordionSections.length === 0) {
            return;
        }

        if (!this.accordionState) {
            this.accordionState = {};
        }

        if (merge) {
            this.accordionState = {
                ...this.accordionState,
                ...newState
            };
        } else {
            const updatedState = {};
            this.accordionSections.forEach(section => {
                const id = section.dataset.accordionId;
                updatedState[id] = Boolean(newState[id]);
            });
            this.accordionState = updatedState;
        }

        this.updateAccordionDOM();
    }

    updateAccordionDOM() {
        this.accordionSections.forEach(section => {
            const id = section.dataset.accordionId;
            if (!id) return;

            const isOpen = Boolean(this.accordionState[id]);
            section.classList.toggle('is-open', isOpen);

            const content = section.querySelector('.accordion-content');
            if (content) {
                content.hidden = !isOpen;
            }

            const toggle = section.querySelector('.accordion-toggle');
            if (toggle) {
                toggle.setAttribute('aria-expanded', String(isOpen));
            }
        });
    }

    toggleAccordionSection(id) {
        const current = Boolean(this.accordionState[id]);
        this.setAccordionState({ [id]: !current }, { merge: true });
    }

    applyInitialAccordionState() {
        this.setAccordionState({
            input: true,
            controls: false,
            info: false,
            data: false
        }, { merge: false });
    }

    applyDataLoadedAccordionState() {
        this.setAccordionState({
            input: false,
            controls: true,
            info: true,
            data: false
        }, { merge: false });
    }

    resetDataInfo() {
        const container = document.getElementById('data-info-content');
        if (!container) return;

        container.innerHTML = '';
        const placeholder = document.createElement('p');
        placeholder.className = 'data-info-placeholder';
        placeholder.dataset.i18n = 'infoSection.noData';
        placeholder.innerHTML = this.languageManager.t('infoSection.noData');
        container.appendChild(placeholder);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIControls;
}
