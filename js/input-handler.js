class InputHandler {
    constructor() {
        this.currentInputType = 'geojson';
        this.currentData = null;
        this.supportedImageTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        this.supportedGeoTypes = ['application/json', 'application/geo+json'];
        this.callbacks = {
            onDataLoaded: null,
            onError: null,
            onProgress: null
        };

        // Webcam properties
        this.webcamStream = null;
        this.availableCameras = [];
    }

    initialize() {
        this.setupEventListeners();
        this.setupDropZone();
    }

    setupEventListeners() {
        const fileInput = document.getElementById('file-input');
        const inputTypeRadios = document.querySelectorAll('input[name="input-type"]');

        fileInput.addEventListener('change', (event) => {
            this.handleFileSelect(event.target.files[0]);
        });

        inputTypeRadios.forEach(radio => {
            radio.addEventListener('change', (event) => {
                this.setInputType(event.target.value);
            });
        });
    }

    setupDropZone() {
        const dropZone = document.getElementById('drop-zone');

        dropZone.addEventListener('dragover', (event) => {
            event.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (event) => {
            event.preventDefault();
            dropZone.classList.remove('dragover');
            
            const files = event.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelect(files[0]);
            }
        });
    }

    setInputType(type) {
        this.currentInputType = type;
        this.updateFileInputAccept();
        this.updateDropZoneText();
    }

    updateFileInputAccept() {
        const fileInput = document.getElementById('file-input');
        if (this.currentInputType === 'geojson') {
            fileInput.accept = '.geojson,.json';
        } else {
            fileInput.accept = '.png,.jpg,.jpeg';
        }
    }

    updateDropZoneText() {
        const dropZone = document.getElementById('drop-zone');
        const text = dropZone.querySelector('p');
        if (this.currentInputType === 'geojson') {
            text.textContent = 'GeoJSONファイルをドラッグ&ドロップ';
        } else {
            text.textContent = 'PNGかJPEGファイルをドラッグ&ドロップ';
        }
    }

    handleFileSelect(file) {
        if (!file) return;

        if (!this.validateFile(file)) {
            this.showError('サポートされていないファイル形式です');
            return;
        }

        this.showProgress(0);
        this.updateFileInfo(file);

        if (this.currentInputType === 'geojson') {
            this.loadGeoJSON(file);
        } else {
            this.loadImage(file);
        }
    }

    validateFile(file) {
        if (this.currentInputType === 'geojson') {
            return this.supportedGeoTypes.includes(file.type) || 
                   file.name.endsWith('.geojson') || 
                   file.name.endsWith('.json');
        } else {
            return this.supportedImageTypes.includes(file.type);
        }
    }

    loadGeoJSON(file) {
        const reader = new FileReader();
        
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                this.validateGeoJSON(data);
                this.currentData = {
                    type: 'geojson',
                    data: data,
                    filename: file.name
                };
                this.hideProgress();
                this.triggerCallback('onDataLoaded', this.currentData);
            } catch (error) {
                this.showError('GeoJSONファイルの解析に失敗しました: ' + error.message);
            }
        };

        reader.onerror = () => {
            this.showError('ファイルの読み込みに失敗しました');
        };

        reader.onprogress = (event) => {
            if (event.lengthComputable) {
                const progress = (event.loaded / event.total) * 100;
                this.showProgress(progress);
            }
        };

        reader.readAsText(file);
    }

    loadImage(file) {
        const reader = new FileReader();
        
        reader.onload = (event) => {
            const img = new Image();
            
            img.onload = () => {
                this.currentData = {
                    type: 'image',
                    data: img,
                    filename: file.name,
                    width: img.width,
                    height: img.height
                };
                this.hideProgress();
                this.triggerCallback('onDataLoaded', this.currentData);
            };

            img.onerror = () => {
                this.showError('画像の読み込みに失敗しました');
            };

            img.src = event.target.result;
        };

        reader.onerror = () => {
            this.showError('ファイルの読み込みに失敗しました');
        };

        reader.onprogress = (event) => {
            if (event.lengthComputable) {
                const progress = (event.loaded / event.total) * 100;
                this.showProgress(progress);
            }
        };

        reader.readAsDataURL(file);
    }

    validateGeoJSON(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('有効なJSONではありません');
        }

        if (data.type !== 'FeatureCollection' && data.type !== 'Feature') {
            throw new Error('GeoJSONのtype属性が必要です');
        }

        if (data.type === 'FeatureCollection') {
            if (!Array.isArray(data.features)) {
                throw new Error('FeatureCollectionにはfeatures配列が必要です');
            }
        }

        if (data.type === 'Feature') {
            if (!data.geometry) {
                throw new Error('Featureにはgeometry属性が必要です');
            }
        }
    }

    updateFileInfo(file) {
        const fileInfo = document.getElementById('file-info');
        const fileName = document.getElementById('file-name');
        const fileType = document.getElementById('file-type');

        fileName.textContent = `ファイル名: ${file.name}`;
        fileType.textContent = `タイプ: ${file.type || 'unknown'}`;
        
        if (this.currentInputType === 'image') {
            const img = new Image();
            img.onload = () => {
                fileType.textContent += ` (${img.width}×${img.height}px)`;
            };
            img.src = URL.createObjectURL(file);
        }

        fileInfo.style.display = 'block';
    }

    showProgress(percentage) {
        const loading = document.getElementById('loading');
        const progress = document.getElementById('progress');
        
        loading.style.display = 'block';
        progress.style.width = percentage + '%';
        
        this.triggerCallback('onProgress', percentage);
    }

    hideProgress() {
        const loading = document.getElementById('loading');
        loading.style.display = 'none';
    }

    showError(message) {
        this.hideProgress();
        alert('エラー: ' + message);
        this.triggerCallback('onError', message);
    }

    onDataLoaded(callback) {
        this.callbacks.onDataLoaded = callback;
    }

    onError(callback) {
        this.callbacks.onError = callback;
    }

    onProgress(callback) {
        this.callbacks.onProgress = callback;
    }

    triggerCallback(name, data) {
        if (this.callbacks[name]) {
            this.callbacks[name](data);
        }
    }

    getCurrentData() {
        return this.currentData;
    }

    hasData() {
        return this.currentData !== null;
    }

    clearData() {
        this.currentData = null;
        const fileInfo = document.getElementById('file-info');
        fileInfo.style.display = 'none';
        
        const fileInput = document.getElementById('file-input');
        fileInput.value = '';
    }

    getDataType() {
        return this.currentData ? this.currentData.type : null;
    }

    createSampleGeoJSON() {
        return {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: {
                        type: 'Polygon',
                        coordinates: [[
                            [-50, -30], [50, -30], [50, 30], [-50, 30], [-50, -30]
                        ]]
                    },
                    properties: {
                        name: 'Sample Rectangle'
                    }
                }
            ]
        };
    }

    loadSampleData() {
        this.currentData = {
            type: 'geojson',
            data: this.createSampleGeoJSON(),
            filename: 'sample.geojson'
        };
        this.triggerCallback('onDataLoaded', this.currentData);
    }

    // Webcam methods
    async enumerateCameras(requestPermission = false) {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                throw new Error('お使いのブラウザはカメラアクセスに対応していません');
            }

            // 許可を取得するために一度getUserMediaを呼ぶ
            if (requestPermission) {
                try {
                    const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                    // すぐに停止
                    tempStream.getTracks().forEach(track => track.stop());
                } catch (permError) {
                    console.warn('Permission denied:', permError);
                    throw new Error('カメラへのアクセスが拒否されました');
                }
            }

            const devices = await navigator.mediaDevices.enumerateDevices();
            this.availableCameras = devices.filter(device => device.kind === 'videoinput');

            if (this.availableCameras.length === 0) {
                throw new Error('カメラが見つかりませんでした');
            }

            this.populateCameraSelect();
            return this.availableCameras;
        } catch (error) {
            console.error('Camera enumeration error:', error);
            this.showError(error.message);
            return [];
        }
    }

    populateCameraSelect() {
        const select = document.getElementById('camera-select');
        if (!select) return;

        select.innerHTML = '<option value="">カメラを選択...</option>';

        this.availableCameras.forEach((camera, index) => {
            const option = document.createElement('option');
            option.value = camera.deviceId;
            option.textContent = camera.label || `カメラ ${index + 1}`;
            select.appendChild(option);
        });

        // 最初のカメラを自動選択
        if (this.availableCameras.length > 0) {
            select.value = this.availableCameras[0].deviceId;
        }
    }

    async initializeWebcam(deviceId = null) {
        try {
            // 既存のストリームを停止
            if (this.webcamStream) {
                this.stopWebcam();
            }

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('お使いのブラウザはカメラアクセスに対応していません');
            }

            const constraints = {
                video: deviceId ? { deviceId: { exact: deviceId } } : true,
                audio: false
            };

            this.webcamStream = await navigator.mediaDevices.getUserMedia(constraints);

            const video = document.getElementById('webcam-video');
            if (video) {
                video.srcObject = this.webcamStream;
            }

            return this.webcamStream;
        } catch (error) {
            console.error('Webcam initialization error:', error);

            let errorMessage = 'カメラの起動に失敗しました';
            if (error.name === 'NotAllowedError') {
                errorMessage = 'カメラへのアクセスが拒否されました。ブラウザの設定を確認してください';
            } else if (error.name === 'NotFoundError') {
                errorMessage = 'カメラが見つかりませんでした';
            } else if (error.name === 'NotReadableError') {
                errorMessage = 'カメラが他のアプリケーションで使用中です';
            }

            this.showError(errorMessage);
            throw error;
        }
    }

    captureFromWebcam() {
        try {
            const video = document.getElementById('webcam-video');
            if (!video || !this.webcamStream) {
                throw new Error('カメラが起動していません');
            }

            // Canvasを作成して現在のフレームをキャプチャ
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const ctx = canvas.getContext('2d');

            // 鏡像を元に戻す（transform: scaleX(-1)の反転）
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Canvasから画像を作成
            const img = new Image();
            img.onload = () => {
                this.currentData = {
                    type: 'image',
                    data: img,
                    filename: `webcam-capture-${Date.now()}.png`,
                    width: img.width,
                    height: img.height
                };
                this.triggerCallback('onDataLoaded', this.currentData);
            };

            img.onerror = () => {
                this.showError('画像のキャプチャに失敗しました');
            };

            img.src = canvas.toDataURL('image/png');

        } catch (error) {
            console.error('Capture error:', error);
            this.showError(error.message);
        }
    }

    stopWebcam() {
        if (this.webcamStream) {
            this.webcamStream.getTracks().forEach(track => track.stop());
            this.webcamStream = null;

            const video = document.getElementById('webcam-video');
            if (video) {
                video.srcObject = null;
            }
        }
    }

    isWebcamActive() {
        return this.webcamStream !== null;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = InputHandler;
}