class SampleManager {
    constructor(languageManager) {
        this.languageManager = languageManager;
        this.isIOS = this.detectIOS();
        this.maxImageDimension = this.isIOS ? 480 : 900;
        this.samples = {
            geojson: [
                {
                    filename: 'countries.json',
                    path: 'samples/countries.json',
                    key: 'countries'
                },
                {
                    filename: 'tissot-circles.geojson',
                    path: 'samples/tissot-circles.geojson',
                    key: 'tissot'
                },
                {
                    filename: 'face.geojson',
                    path: 'samples/face.geojson',
                    key: 'face'
                }
            ],
            images: [
                {
                    filename: 'self.png',
                    path: 'samples/self.png',
                    key: 'self'
                },
                {
                    filename: 'lena.png', 
                    path: 'samples/lena.png',
                    key: 'lena'
                }
            ]
        };
        
        this.callbacks = {
            onSampleLoaded: null,
            onError: null
        };
    }

    getSamples(type = null) {
        const sampleTypes = type ? [type] : Object.keys(this.samples);
        const result = {};

        for (const sampleType of sampleTypes) {
            result[sampleType] = this.samples[sampleType].map(sample => {
                const name = this.languageManager.t(`sampleData.${sampleType}.${sample.key}.name`);
                const description = this.languageManager.t(`sampleData.${sampleType}.${sample.key}.description`);
                return {
                    ...sample,
                    name,
                    description
                };
            });
        }

        return type ? result[type] : result;
    }

    async loadSample(type, filename) {
        const sample = this.findSample(type, filename);
        if (!sample) {
            this.triggerError(`Sample not found: ${filename}`);
            return;
        }

        try {
            if (type === 'geojson') {
                await this.loadGeoJSONSample(sample);
            } else if (type === 'images') {
                await this.loadImageSample(sample);
            }
        } catch (error) {
            this.triggerError(`Failed to load sample ${filename}: ${error.message}`);
        }
    }

    findSample(type, filename) {
        return this.samples[type]?.find(sample => sample.filename === filename);
    }

    async loadGeoJSONSample(sample) {
        const response = await fetch(sample.path);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const geoData = await response.json();
        const sampleData = {
            type: 'geojson',
            data: geoData,
            filename: sample.filename,
            name: this.languageManager.t(`sampleData.geojson.${sample.key}.name`),
            description: this.languageManager.t(`sampleData.geojson.${sample.key}.description`),
            isSample: true
        };

        this.triggerCallback('onSampleLoaded', sampleData);
    }

    async loadImageSample(sample) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = async () => {
                try {
                    const processedImage = await this.scaleImageIfNeeded(img);
                    const sampleData = {
                    type: 'image',
                        data: processedImage,
                    filename: sample.filename,
                    name: this.languageManager.t(`sampleData.images.${sample.key}.name`),
                    description: this.languageManager.t(`sampleData.images.${sample.key}.description`),
                        width: processedImage.width,
                        height: processedImage.height,
                    isSample: true
                };

                this.triggerCallback('onSampleLoaded', sampleData);
                resolve(sampleData);
                } catch (error) {
                    reject(error);
                }
            };

            img.onerror = () => {
                reject(new Error(`Failed to load image: ${sample.path}`));
            };

            img.src = sample.path;
        });
    }

    onSampleLoaded(callback) {
        this.callbacks.onSampleLoaded = callback;
    }

    onError(callback) {
        this.callbacks.onError = callback;
    }

    triggerCallback(name, data) {
        if (this.callbacks[name]) {
            this.callbacks[name](data);
        }
    }

    triggerError(message) {
        console.error('SampleManager:', message);
        this.triggerCallback('onError', message);
    }

    // サンプル追加用のヘルパーメソッド
    addGeoJSONSample(name, filename, description) {
        this.samples.geojson.push({
            name,
            filename,
            description,
            path: `samples/${filename}`
        });
    }

    addImageSample(name, filename, description) {
        this.samples.images.push({
            name,
            filename,
            description,
            path: `samples/${filename}`
        });
    }

    detectIOS() {
        if (typeof navigator === 'undefined') return false;
        return /iP(hone|od|ad)/.test(navigator.userAgent);
    }

    scaleImageIfNeeded(image) {
        if (!image || !image.width || !image.height) {
            return Promise.resolve(image);
        }

        const maxSide = Math.max(image.width, image.height);
        if (maxSide <= this.maxImageDimension) {
            return Promise.resolve(image);
        }

        const ratio = this.maxImageDimension / maxSide;
        const targetWidth = Math.round(image.width * ratio);
        const targetHeight = Math.round(image.height * ratio);

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

        return new Promise((resolve, reject) => {
            const resizedImage = new Image();
            resizedImage.onload = () => resolve(resizedImage);
            resizedImage.onerror = reject;
            resizedImage.src = canvas.toDataURL('image/png');
        });
    }

    // ランダムサンプル選択
    getRandomSample(type) {
        const samples = this.getSamples(type);
        if (samples.length === 0) return null;
        
        const randomIndex = Math.floor(Math.random() * samples.length);
        return samples[randomIndex];
    }

    // サンプル一覧表示用
    getSamplesList() {
        return {
            geojson: this.samples.geojson.map(s => ({
                name: s.name,
                filename: s.filename,
                description: s.description
            })),
            images: this.samples.images.map(s => ({
                name: s.name,
                filename: s.filename,
                description: s.description
            }))
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SampleManager;
}
