class SampleManager {
    constructor(languageManager) {
        this.languageManager = languageManager;
        this.maxImageDimension = ImageUtils.getMaxImageDimension();
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
                    filename: 'world-map.jpg',
                    path: 'samples/world-map.jpg',
                    key: 'world'
                },
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
            this.triggerError(`${this.languageManager.t('messages.sampleLoadFailed')}: ${filename}`);
            return;
        }

        try {
            if (type === 'geojson') {
                await this.loadGeoJSONSample(sample);
            } else if (type === 'images') {
                await this.loadImageSample(sample);
            }
        } catch (error) {
            this.triggerError(`${this.languageManager.t('messages.sampleLoadFailed')}: ${error.message}`);
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
                    const processedImage = await ImageUtils.scaleImageIfNeeded(img, this.maxImageDimension);
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
                reject(new Error(this.languageManager.t('messages.imageLoadError')));
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
}
