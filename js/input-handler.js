class InputHandler {
    constructor(languageManager) {
        this.languageManager = languageManager;
        this.currentInputType = 'image';
        this.currentData = null;
        this.supportedImageTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        this.supportedGeoTypes = ['application/json', 'application/geo+json'];
        this.maxImageDimension = ImageUtils.getMaxImageDimension();
        this.filePreviewUrl = null;
        this.callbacks = {
            onDataLoaded: null,
            onError: null,
            onProgress: null
        };

        this.webcamStream = null;
        this.availableCameras = [];
    }

    initialize() {
        this.setupEventListeners();
        this.setupDropZone();
        this.setInputType(this.currentInputType);
    }

    setupEventListeners() {
        const fileInput = document.getElementById('file-input');

        fileInput.addEventListener('change', (event) => {
            this.handleFileSelect(event.target.files[0]);
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
        const text = dropZone.querySelector('p[data-i18n="inputSection.dropZone.drag"]');
        if (text) {
            text.textContent = this.languageManager.t('inputSection.dropZone.drag');
        }
    }

    handleFileSelect(file) {
        if (!file) return;

        if (!this.validateFile(file)) {
            this.showError(this.languageManager.t('messages.unsupportedFileType'));
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
                this.showError(`${this.languageManager.t('messages.jsonParseError')}: ${error.message}`);
            }
        };

        reader.onerror = () => {
            this.showError(this.languageManager.t('messages.fileReadError'));
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

        reader.onload = async (event) => {
            const img = new Image();

            img.onload = async () => {
                try {
                    const processedImage = await ImageUtils.scaleImageIfNeeded(img, this.maxImageDimension);
                    this.currentData = {
                        type: 'image',
                        data: processedImage,
                        filename: file.name,
                        width: processedImage.width,
                        height: processedImage.height
                    };
                    this.hideProgress();
                    this.triggerCallback('onDataLoaded', this.currentData);
                } catch (error) {
                    this.showError(this.languageManager.t('messages.imageLoadError'));
                }
            };

            img.onerror = () => {
                this.showError(this.languageManager.t('messages.imageLoadError'));
            };

            img.src = event.target.result;
        };

        reader.onerror = () => {
            this.showError(this.languageManager.t('messages.fileReadError'));
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
            throw new Error(this.languageManager.t('messages.invalidJson'));
        }

        if (data.type !== 'FeatureCollection' && data.type !== 'Feature') {
            throw new Error(this.languageManager.t('messages.invalidGeoJsonType'));
        }

        if (data.type === 'FeatureCollection') {
            if (!Array.isArray(data.features)) {
                throw new Error(this.languageManager.t('messages.missingFeatures'));
            }
        }

        if (data.type === 'Feature') {
            if (!data.geometry) {
                throw new Error(this.languageManager.t('messages.missingGeometry'));
            }
        }
    }

    updateFileInfo(file) {
        const extra = null;
        this.renderFileInfo(file.name, file.type || 'unknown', extra);

        if (this.currentInputType === 'image') {
            this.revokeFilePreviewUrl();
            const objectUrl = URL.createObjectURL(file);
            this.filePreviewUrl = objectUrl;
            const img = new Image();
            img.onload = () => {
                const fileType = document.getElementById('file-type');
                if (fileType) {
                    fileType.textContent += ` (${img.width}×${img.height}px)`;
                }
                this.revokeFilePreviewUrl();
            };
            img.onerror = () => {
                this.revokeFilePreviewUrl();
            };
            img.src = objectUrl;
        }
    }

    refreshFileInfoDisplay() {
        if (!this.currentData) {
            return;
        }

        const extra = this.currentData.width && this.currentData.height
            ? `${this.currentData.width}×${this.currentData.height}px`
            : null;
        const typeValue = this.currentData.type === 'image'
            ? this.languageManager.t('infoSection.imageType')
            : 'GeoJSON';
        this.renderFileInfo(this.currentData.filename, typeValue, extra);
    }

    renderFileInfo(name, type, extra) {
        const fileInfo = document.getElementById('file-info');
        const fileName = document.getElementById('file-name');
        const fileType = document.getElementById('file-type');
        if (!fileInfo || !fileName || !fileType) {
            return;
        }

        fileName.textContent = `${this.languageManager.t('inputSection.fileInfo.name')} ${name}`;
        fileType.textContent = extra
            ? `${this.languageManager.t('inputSection.fileInfo.type')} ${type} (${extra})`
            : `${this.languageManager.t('inputSection.fileInfo.type')} ${type}`;
        fileInfo.style.display = 'block';
    }

    revokeFilePreviewUrl() {
        if (this.filePreviewUrl) {
            URL.revokeObjectURL(this.filePreviewUrl);
            this.filePreviewUrl = null;
        }
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
        this.revokeFilePreviewUrl();
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

    async enumerateCameras(requestPermission = false) {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                throw new Error(this.languageManager.t('messages.cameraUnsupported'));
            }

            if (requestPermission) {
                try {
                    const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                    tempStream.getTracks().forEach(track => track.stop());
                } catch (permError) {
                    console.warn('Permission denied:', permError);
                    throw new Error(this.languageManager.t('messages.permissionDenied'));
                }
            }

            const devices = await navigator.mediaDevices.enumerateDevices();
            this.availableCameras = devices.filter(device => device.kind === 'videoinput');

            if (this.availableCameras.length === 0) {
                throw new Error(this.languageManager.t('messages.cameraNotFound'));
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

        const previousValue = select.value;
        select.innerHTML = `<option value="">${this.languageManager.t('messages.selectCamera')}</option>`;

        this.availableCameras.forEach((camera, index) => {
            const option = document.createElement('option');
            option.value = camera.deviceId;
            option.textContent = camera.label || `${this.languageManager.t('inputSection.webcam.selectCamera')} ${index + 1}`;
            select.appendChild(option);
        });

        if (previousValue && this.availableCameras.some(camera => camera.deviceId === previousValue)) {
            select.value = previousValue;
        } else if (this.availableCameras.length > 0) {
            select.value = this.availableCameras[0].deviceId;
        }
    }

    async initializeWebcam(deviceId = null) {
        try {
            if (this.webcamStream) {
                this.stopWebcam();
            }

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error(this.languageManager.t('messages.cameraUnsupported'));
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

            let errorMessage = this.languageManager.t('messages.cameraError');
            if (error.name === 'NotAllowedError') {
                errorMessage = this.languageManager.t('messages.permissionDenied');
            } else if (error.name === 'NotFoundError') {
                errorMessage = this.languageManager.t('messages.cameraNotFound');
            } else if (error.name === 'NotReadableError') {
                errorMessage = this.languageManager.t('messages.cameraInUse');
            }

            this.showError(errorMessage);
            throw error;
        }
    }

    captureFromWebcam() {
        try {
            const video = document.getElementById('webcam-video');
            if (!video || !this.webcamStream) {
                throw new Error(this.languageManager.t('messages.cameraNotStarted'));
            }

            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const ctx = canvas.getContext('2d');

            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

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
                this.showError(this.languageManager.t('messages.captureError'));
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
