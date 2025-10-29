class MapProjectionApp {
    constructor() {
        this.projectionManager = new ProjectionManager();
        this.renderer = new Renderer(this.projectionManager);
        this.inputHandler = new InputHandler();
        this.uiControls = new UIControls(this.projectionManager, this.renderer);
        this.sampleManager = new SampleManager();
        
        this.isInitialized = false;
    }

    async initialize() {
        try {
            console.log('Initializing Map Projection App...');
            
            this.renderer.initialize();
            this.inputHandler.initialize();
            this.uiControls.initialize();
            this.setupSampleManager();
            
            this.setupEventHandlers();
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
        const geoJsonBtn = document.getElementById('sample-geojson-btn');
        const imageBtn = document.getElementById('sample-image-btn');
        const geoJsonList = document.getElementById('sample-geojson-list');
        const imageList = document.getElementById('sample-image-list');
        const geoJsonContainer = document.getElementById('geojson-samples');
        const imageContainer = document.getElementById('image-samples');

        if (!geoJsonBtn || !imageBtn) {
            console.error('Sample buttons not found in DOM');
            return;
        }

        // ボタンのイベントリスナー
        geoJsonBtn.addEventListener('click', () => {
            this.toggleSampleList('geojson', geoJsonBtn, imageBtn, geoJsonList, imageList);
        });

        imageBtn.addEventListener('click', () => {
            this.toggleSampleList('images', imageBtn, geoJsonBtn, imageList, geoJsonList);
        });

        // サンプルアイテムを生成
        if (geoJsonContainer && imageContainer) {
            this.populateSampleItems('geojson', geoJsonContainer);
            this.populateSampleItems('images', imageContainer);
        }
    }

    toggleSampleList(type, activeBtn, inactiveBtn, activeList, inactiveList) {
        // ボタンの状態を切り替え
        activeBtn.classList.add('active');
        inactiveBtn.classList.remove('active');

        // リストの表示を切り替え
        if (activeList.style.display === 'none' || activeList.style.display === '') {
            activeList.style.display = 'block';
            inactiveList.style.display = 'none';
        } else {
            activeList.style.display = 'none';
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
                this.loadSample(type, sample.filename);
                // リストを閉じる
                const list = container.parentElement;
                list.style.display = 'none';
                // ボタンの状態をリセット
                document.querySelectorAll('.sample-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
            });

            container.appendChild(item);
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
            
            this.uiControls.enableControls();
            this.uiControls.updateUIForDataType(data.type);
            
            await this.renderer.render(data);
            
            this.uiControls.showMessage(
                `${data.filename} を読み込みました`, 
                'info'
            );

            this.addDataInfo(data);
            
        } catch (error) {
            console.error('Render error:', error);
            this.uiControls.showMessage('描画に失敗しました: ' + error.message, 'error');
        }
    }

    addDataInfo(data) {
        const infoSection = document.querySelector('.info-section');
        
        let dataInfoDiv = document.getElementById('data-info');
        if (!dataInfoDiv) {
            dataInfoDiv = document.createElement('div');
            dataInfoDiv.id = 'data-info';
            dataInfoDiv.innerHTML = '<h3>データ情報</h3>';
            infoSection.appendChild(dataInfoDiv);
        }

        const infoContent = document.createElement('div');
        infoContent.className = 'data-details';
        infoContent.style.cssText = `
            background: #f8f9fa;
            padding: 10px;
            border-radius: 5px;
            margin-top: 10px;
            font-size: 0.9rem;
        `;

        if (data.type === 'geojson') {
            const featureCount = data.data.type === 'FeatureCollection' 
                ? data.data.features.length 
                : 1;
            
            infoContent.innerHTML = `
                <p><strong>ファイル:</strong> ${data.filename}</p>
                <p><strong>タイプ:</strong> GeoJSON</p>
                <p><strong>フィーチャー数:</strong> ${featureCount}</p>
                <p><strong>形式:</strong> ${data.data.type}</p>
            `;
        } else if (data.type === 'image') {
            infoContent.innerHTML = `
                <p><strong>ファイル:</strong> ${data.filename}</p>
                <p><strong>タイプ:</strong> 画像</p>
                <p><strong>サイズ:</strong> ${data.width} × ${data.height}px</p>
                <p><strong>比率:</strong> ${(data.width / data.height).toFixed(2)}</p>
            `;
        }

        dataInfoDiv.querySelector('.data-details')?.remove();
        dataInfoDiv.appendChild(infoContent);
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
                const link = document.createElement('a');
                link.download = `projection-${this.projectionManager.currentProjection}-${Date.now()}.png`;
                link.href = dataURL;
                link.click();
                this.uiControls.showMessage('画像をエクスポートしました', 'info');
            }
        } catch (error) {
            this.uiControls.showMessage('エクスポートに失敗しました', 'error');
        }
    }

    clearData() {
        this.inputHandler.clearData();
        this.renderer.clear();
        this.uiControls.disableControls();
        
        const dataInfoDiv = document.getElementById('data-info');
        if (dataInfoDiv) {
            dataInfoDiv.remove();
        }
        
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