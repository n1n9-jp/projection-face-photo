class SampleManager {
    constructor() {
        this.samples = {
            geojson: [
                {
                    name: '顔 (Face)',
                    filename: 'face.geojson',
                    description: '人の顔を模したGeoJSONデータ',
                    path: 'samples/face.geojson'
                },
                {
                    name: '世界地図 (簡易版)',
                    filename: 'world-simple.geojson',
                    description: '大陸の簡略化された形状',
                    path: 'samples/world-simple.geojson'
                },
                {
                    name: '円と格子',
                    filename: 'circles.geojson',
                    description: '円形と格子線パターン',
                    path: 'samples/circles.geojson'
                },
                {
                    name: '日本列島',
                    filename: 'japan.geojson',
                    description: '日本の主要な島々',
                    path: 'samples/japan.geojson'
                },
                {
                    name: '幾何学図形',
                    filename: 'geometric-shapes.geojson',
                    description: '三角形、五角形、星形など',
                    path: 'samples/geometric-shapes.geojson'
                },
                {
                    name: 'ティソの示円',
                    filename: 'tissot-circles.geojson',
                    description: '投影法の歪みを確認する円形パターン',
                    path: 'samples/tissot-circles.geojson'
                }
            ],
            images: [
                {
                    name: '自撮り写真',
                    filename: 'self.png',
                    description: '顔写真のサンプル',
                    path: 'samples/self.png'
                },
                {
                    name: 'Lena',
                    filename: 'lena.png', 
                    description: '画像処理の標準テスト画像',
                    path: 'samples/lena.png'
                },
                {
                    name: 'テスト顔写真',
                    filename: 'test_face.png',
                    description: '投影変形テスト用の顔写真',
                    path: 'samples/test_face.png'
                }
                // 他の画像サンプルは後で追加
            ]
        };
        
        this.callbacks = {
            onSampleLoaded: null,
            onError: null
        };
    }

    getSamples(type = null) {
        if (type) {
            return this.samples[type] || [];
        }
        return this.samples;
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
            name: sample.name,
            description: sample.description,
            isSample: true
        };

        this.triggerCallback('onSampleLoaded', sampleData);
    }

    async loadImageSample(sample) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                const sampleData = {
                    type: 'image',
                    data: img,
                    filename: sample.filename,
                    name: sample.name,
                    description: sample.description,
                    width: img.width,
                    height: img.height,
                    isSample: true
                };

                this.triggerCallback('onSampleLoaded', sampleData);
                resolve(sampleData);
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