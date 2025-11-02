class MapProjectionApp {
    constructor() {
        this.languageManager = new LanguageManager();
        this.projectionManager = new ProjectionManager();
        this.renderer = new Renderer(this.projectionManager);
        this.inputHandler = new InputHandler(this.languageManager);
        this.uiControls = new UIControls(this.projectionManager, this.renderer, this.languageManager);
        this.sampleManager = new SampleManager(this.languageManager);
        
        this.isInitialized = false;
        this.sampleUIInitialized = false;
    }

    async initialize() {
        try {
            console.log('Initializing Map Projection App...');
            
            this.languageManager.initialize();
            this.renderer.initialize();
            this.inputHandler.initialize();
            this.uiControls.initialize();
            
            const webGLError = this.renderer.getWebGLError();
            if (!this.renderer.supportsWebGL()) {
                const messageKey = webGLError ? 'messages.webglInitFailed' : 'messages.webglNotSupported';
                const level = webGLError ? 'warning' : 'info';
                this.uiControls.showMessage(this.languageManager.t(messageKey), level);
            }

            this.setupSampleManager();

            this.setupEventHandlers();
            this.setupLanguageSwitcher();
            this.updateAllUIText();
            this.setupWebcamEventListeners();
            this.setupKeyboardShortcuts();
            this.loadSampleDataIfNeeded();
            
            this.isInitialized = true;
            console.log('App initialized successfully');
            
            this.showWelcomeMessage();
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('アプリケーションの初期化に失敗しました: ' + error.message);
        }
    }

    setupLanguageSwitcher() {
        const languageSelect = document.getElementById('language-select');
        if (languageSelect) {
            languageSelect.value = this.languageManager.getCurrentLanguage();
            languageSelect.addEventListener('change', (event) => {
                this.languageManager.setLanguage(event.target.value);
            });

            this.languageManager.onLanguageChange(() => {
                this.updateAllUIText();
            });
        }
    }

    updateAllUIText() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.dataset.i18n;
            const translation = this.languageManager.t(key);
            if (typeof translation === 'string') {
                element.innerHTML = translation;
            }
        });
        
        // Update dynamic content
        this.uiControls.populateProjectionOptions();
        this.uiControls.updateProjectionInfo();
        this.setupSampleUI();

        const exportButton = document.getElementById('export-button');
        if (exportButton) {
            exportButton.textContent = this.languageManager.t('controlSection.exportImage');
        }
    }

    setupEventHandlers() {
        this.inputHandler.onDataLoaded((data) => {
            this.handleDataLoaded(data);
        });

        this.inputHandler.onError((error) => {
            this.uiControls.showMessage('入力エラー: ' + error, 'error');
        });

        this.inputHandler.onProgress((percentage) => {
            console.log(`Loading progress: ${percentage}%`);
        });

        window.addEventListener('resize', () => {
            this.handleWindowResize();
        });

        window.addEventListener('beforeunload', (event) => {
            // カメラを停止
            if (this.inputHandler.isWebcamActive()) {
                this.inputHandler.stopWebcam();
            }

            if (this.renderer.isRendering) {
                event.preventDefault();
                event.returnValue = '描画処理中です。ページを離れますか？';
            }
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            if (event.ctrlKey || event.metaKey) {
                switch (event.key) {
                    case 'r':
                        event.preventDefault();
                        this.resetProjection();
                        break;
                    case 's':
                        event.preventDefault();
                        this.exportCurrentView();
                        break;
                    case 'o':
                        event.preventDefault();
                        document.getElementById('file-input').click();
                        break;
                }
            }

            if (event.key === 'Escape') {
                this.clearData();
            }
        });
    }

    setupWebcamEventListeners() {
        const startCameraBtn = document.getElementById('start-camera-btn');
        const stopCameraBtn = document.getElementById('stop-camera-btn');
        const captureBtn = document.getElementById('capture-btn');
        const cameraSelect = document.getElementById('camera-select');

        if (startCameraBtn) {
            startCameraBtn.addEventListener('click', () => {
                this.startWebcam();
            });
        }

        if (stopCameraBtn) {
            stopCameraBtn.addEventListener('click', () => {
                this.stopWebcam();
            });
        }

        if (captureBtn) {
            captureBtn.addEventListener('click', () => {
                this.captureFromWebcam();
            });
        }

        if (cameraSelect) {
            cameraSelect.addEventListener('change', (event) => {
                // カメラが既に起動している場合は、新しいカメラで再起動
                if (this.inputHandler.isWebcamActive()) {
                    this.startWebcam();
                }
            });
        }
    }

    async startWebcam() {
        try {
            const cameraSelect = document.getElementById('camera-select');
            const cameraSelectGroup = document.getElementById('camera-select-group');
            const deviceId = cameraSelect ? cameraSelect.value : null;

            // カメラを起動（deviceIdがあればそれを使用、なければデフォルト）
            await this.inputHandler.initializeWebcam(deviceId || null);

            // カメラ一覧を取得（許可後なのでラベルが取得できる）
            const cameras = await this.inputHandler.enumerateCameras(false);

            // UI更新
            const webcamPreview = document.getElementById('webcam-preview');
            const startCameraBtn = document.getElementById('start-camera-btn');

            if (webcamPreview) {
                webcamPreview.style.display = 'block';
            }

            if (startCameraBtn) {
                startCameraBtn.textContent = 'カメラを再起動';
            }

            // カメラが複数ある場合は選択UIを表示
            if (cameras.length > 1 && cameraSelectGroup) {
                cameraSelectGroup.style.display = 'block';
            }

            this.uiControls.showMessage('カメラを起動しました', 'info');
        } catch (error) {
            console.error('Failed to start webcam:', error);
        }
    }

    stopWebcam() {
        this.inputHandler.stopWebcam();

        // UI更新
        const webcamPreview = document.getElementById('webcam-preview');
        const startCameraBtn = document.getElementById('start-camera-btn');
        const cameraSelectGroup = document.getElementById('camera-select-group');

        if (webcamPreview) {
            webcamPreview.style.display = 'none';
        }

        if (startCameraBtn) {
            startCameraBtn.textContent = 'カメラを起動';
        }

        if (cameraSelectGroup) {
            cameraSelectGroup.style.display = 'none';
        }

        this.uiControls.showMessage('カメラを停止しました', 'info');
    }

    captureFromWebcam() {
        this.inputHandler.captureFromWebcam();
        this.uiControls.showMessage('写真を撮りました', 'info');
    }

    setupSampleManager() {
        this.sampleManager.onSampleLoaded((data) => {
            this.handleDataLoaded(data);
        });

        this.sampleManager.onError((error) => {
            this.uiControls.showMessage('サンプル読み込みエラー: ' + error, 'error');
        });

        this.setupSampleUI();
    }

    setupSampleUI() {
        const geoJsonList = document.getElementById('sample-geojson-list');
        const imageList = document.getElementById('sample-image-list');
        const geoJsonContainer = document.getElementById('geojson-samples');
        const imageContainer = document.getElementById('image-samples');
        const inputTypeRadios = document.querySelectorAll('input[name="input-type"]');

        if (geoJsonContainer && imageContainer) {
            this.populateSampleItems('geojson', geoJsonContainer);
            this.populateSampleItems('images', imageContainer);
        }

        if (!this.sampleUIInitialized) {
            inputTypeRadios.forEach(radio => {
                radio.addEventListener('change', (event) => {
                    this.handleInputTypeChange(event.target.value);
                });
            });
            this.sampleUIInitialized = true;
        }

        const checkedRadio = document.querySelector('input[name="input-type"]:checked');
        const currentType = checkedRadio ? checkedRadio.value : this.inputHandler.currentInputType || 'image';
        this.handleInputTypeChange(currentType);
    }

    handleInputTypeChange(inputType) {
        const geoJsonList = document.getElementById('sample-geojson-list');
        const imageList = document.getElementById('sample-image-list');
        const fileInputArea = document.getElementById('file-input-area');
        const webcamArea = document.getElementById('webcam-area');
        const sampleSection = document.querySelector('.sample-section');

        this.inputHandler.setInputType(inputType);

        // すべてを非表示にしてから必要なものを表示
        geoJsonList.style.display = 'none';
        imageList.style.display = 'none';
        fileInputArea.style.display = 'none';
        webcamArea.style.display = 'none';
        if (sampleSection) {
            sampleSection.style.display = 'block';
        }

        if (inputType === 'geojson') {
            geoJsonList.style.display = 'block';
            fileInputArea.style.display = 'block';
        } else if (inputType === 'image') {
            imageList.style.display = 'block';
            fileInputArea.style.display = 'block';
        } else if (inputType === 'webcam') {
            webcamArea.style.display = 'block';
            if (sampleSection) {
                sampleSection.style.display = 'none';
            }
            // カメラを停止（別の入力タイプから切り替えた場合）
            if (this.inputHandler.isWebcamActive()) {
                this.stopWebcam();
            }
        } else {
            fileInputArea.style.display = 'block';
        }
    }

    populateSampleItems(type, container) {
        const samples = this.sampleManager.getSamples(type);
        container.innerHTML = '';

        samples.forEach(sample => {
            const item = document.createElement('div');
            item.className = 'sample-item';
            item.innerHTML = `
                <div class="sample-item-name">${sample.name}</div>
                <div class="sample-item-description">${sample.description}</div>
            `;

            item.addEventListener('click', () => {
                this.selectSampleItem(item);
                this.loadSample(type, sample.filename);
            });

            container.appendChild(item);
        });
    }

    selectSampleItem(selectedItem) {
        // すべてのサンプルアイテムから選択状態を削除
        document.querySelectorAll('.sample-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // 選択されたアイテムに選択状態を追加
        selectedItem.classList.add('selected');
    }

    clearSampleSelection() {
        // すべてのサンプルアイテムから選択状態を削除
        document.querySelectorAll('.sample-item').forEach(item => {
            item.classList.remove('selected');
        });
    }

    async loadSample(type, filename) {
        try {
            await this.sampleManager.loadSample(type, filename);
        } catch (error) {
            this.uiControls.showMessage('サンプル読み込みに失敗しました', 'error');
        }
    }

    async handleDataLoaded(data) {
        try {
            console.log('Data loaded:', data.type, data.filename);
            
            // サンプルからの読み込みでない場合は選択状態をクリア
            if (!data.isSample) {
                this.clearSampleSelection();
            }
            
            this.uiControls.enableControls();
            this.uiControls.updateUIForDataType(data.type);
            
            await this.renderer.render(data);
            
            this.uiControls.showMessage(
                `${data.filename} を読み込みました`, 
                'info'
            );

            this.addDataInfo(data);
            this.uiControls.applyDataLoadedAccordionState();
            
        } catch (error) {
            console.error('Render error:', error);
            this.uiControls.showMessage('描画に失敗しました: ' + error.message, 'error');
        }
    }

    addDataInfo(data) {
        const dataInfoContainer = document.getElementById('data-info-content');
        if (!dataInfoContainer) {
            return;
        }

        dataInfoContainer.innerHTML = '';

        const infoContent = document.createElement('div');
        infoContent.className = 'data-details';

        const fileLabel = this.languageManager.t('infoSection.fileName');
        const typeLabel = this.languageManager.t('infoSection.dataType');
        const featureCountLabel = this.languageManager.t('infoSection.featureCount');
        const formatLabel = this.languageManager.t('infoSection.format');
        const sizeLabel = this.languageManager.t('infoSection.size');
        const ratioLabel = this.languageManager.t('infoSection.ratio');

        if (data.type === 'geojson') {
            const featureCount = data.data.type === 'FeatureCollection' 
                ? data.data.features.length 
                : 1;

            infoContent.innerHTML = `
                <p><strong>${fileLabel}</strong> ${data.filename}</p>
                <p><strong>${typeLabel}</strong> GeoJSON</p>
                <p><strong>${featureCountLabel}</strong> ${featureCount}</p>
                <p><strong>${formatLabel}</strong> ${data.data.type}</p>
            `;
        } else if (data.type === 'image') {
            const currentLang = this.languageManager.getCurrentLanguage();
            const imageTypeLabel = currentLang === 'ja' ? '画像' : 'Image';

            infoContent.innerHTML = `
                <p><strong>${fileLabel}</strong> ${data.filename}</p>
                <p><strong>${typeLabel}</strong> ${imageTypeLabel}</p>
                <p><strong>${sizeLabel}</strong> ${data.width} × ${data.height}px</p>
                <p><strong>${ratioLabel}</strong> ${(data.width / data.height).toFixed(2)}</p>
            `;
        }

        dataInfoContainer.appendChild(infoContent);
    }

    loadSampleDataIfNeeded() {
        const urlParams = new URLSearchParams(window.location.search);
        const demo = urlParams.get('demo');
        
        if (demo === 'true') {
            console.log('Loading sample data for demo');
            setTimeout(() => {
                this.inputHandler.loadSampleData();
            }, 1000);
        }
    }

    showWelcomeMessage() {
        const hasVisited = localStorage.getItem('mapProjectionApp_visited');
        
        if (!hasVisited) {
            setTimeout(() => {
                this.uiControls.showMessage(
                    'GeoJSONまたは顔写真をアップロードして地図投影法を体験してください！', 
                    'info'
                );
                localStorage.setItem('mapProjectionApp_visited', 'true');
            }, 1000);
        }
    }

    resetProjection() {
        this.uiControls.resetControls();
        this.uiControls.showMessage('投影設定をリセットしました', 'info');
    }

    async exportCurrentView() {
        try {
            const dataURL = await this.renderer.exportImage();
            if (dataURL) {
                const success = await this.uiControls.saveImageFromDataURL(dataURL);
                if (success) {
                    this.uiControls.showMessage(this.languageManager.t('messages.imageExported'), 'info');
                } else {
                    this.uiControls.showMessage(this.languageManager.t('messages.exportFailed'), 'error');
                }
            }
        } catch (error) {
            console.error('Export shortcut failed:', error);
            this.uiControls.showMessage(this.languageManager.t('messages.exportFailed'), 'error');
        }
    }

    clearData() {
        // Webカムを停止
        if (this.inputHandler.isWebcamActive()) {
            this.stopWebcam();
        }

        this.inputHandler.clearData();
        this.renderer.clear();
        this.uiControls.disableControls();
        this.clearSampleSelection();
        this.uiControls.resetDataInfo();
        this.uiControls.applyInitialAccordionState();

        this.uiControls.showMessage('データをクリアしました', 'info');
    }

    handleWindowResize() {
        const container = document.querySelector('.canvas-container');
        const containerRect = container.getBoundingClientRect();
        
        const maxWidth = Math.min(containerRect.width - 48, 800);
        const maxHeight = Math.min(window.innerHeight - 200, 600);
        
        if (maxWidth !== this.renderer.width || maxHeight !== this.renderer.height) {
            this.renderer.setDimensions(maxWidth, maxHeight);
            
            if (this.inputHandler.hasData()) {
                this.renderer.updateProjection();
            }
        }
    }

    showError(message) {
        console.error(message);
        alert(message);
    }

    getAppInfo() {
        return {
            version: '1.0.0',
            initialized: this.isInitialized,
            currentProjection: this.projectionManager.currentProjection,
            hasData: this.inputHandler.hasData(),
            dataType: this.inputHandler.getDataType()
        };
    }

    setProjection(projectionName) {
        this.uiControls.setProjection(projectionName);
    }

    async loadFromURL(url, type = 'geojson') {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            if (type === 'geojson') {
                const data = await response.json();
                const mockData = {
                    type: 'geojson',
                    data: data,
                    filename: url.split('/').pop() || 'remote.geojson'
                };
                await this.handleDataLoaded(mockData);
            } else {
                throw new Error('URL からの画像読み込みは未対応です');
            }
        } catch (error) {
            this.uiControls.showMessage('URLからの読み込みに失敗しました: ' + error.message, 'error');
        }
    }
}

let app;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        app = new MapProjectionApp();
        await app.initialize();
        
        window.mapProjectionApp = app;
        
        console.log('Map Projection App ready!');
        console.log('Available commands:');
        console.log('- app.setProjection(name): 投影法を変更');
        console.log('- app.resetProjection(): 投影設定をリセット');
        console.log('- app.clearData(): データをクリア');
        console.log('- app.exportCurrentView(): 現在のビューをエクスポート');
        console.log('- app.getAppInfo(): アプリ情報を取得');
        console.log('- app.loadFromURL(url): URLからGeoJSONを読み込み');
        
    } catch (error) {
        console.error('Failed to initialize app:', error);
        alert('アプリケーションの初期化に失敗しました。ページを再読み込みしてください。');
    }
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapProjectionApp;
}
