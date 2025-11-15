class ProjectionManager {
    constructor() {
        this.projections = this.initializeProjections();
        this.currentProjection = 'mercator';
        this.currentScale = 150;
        this.currentRotation = [0, 0];
        this.rotationMatrixCache = null;
    }

    initializeProjections() {
        return {
            mercator: {
                name: 'メルカトル図法',
                description: '角度を保持する円筒図法。航海用地図で広く使用。極地で大きな歪み。',
                properties: '正角図法（角度保持）',
                create: () => d3.geoMercator()
            },
            stereographic: {
                name: 'ステレオ図法',
                description: '角度を保持する方位図法。中心からの距離が大きくなると歪みが増加。',
                properties: '正角図法（角度保持）',
                create: () => d3.geoStereographic().clipAngle(90)
            },
            equalEarth: {
                name: 'イコールアース図法',
                description: '面積を保持する擬円筒図法。視覚的に自然で現代的な世界地図に適用。',
                properties: '正積図法（面積保持）',
                create: () => d3.geoEqualEarth()
            },
            mollweide: {
                name: 'モルワイデ図法',
                description: '面積を保持する楕円形の擬円筒図法。全球を楕円で表現。',
                properties: '正積図法（面積保持）',
                create: () => d3.geoMollweide()
            },
            azimuthalEquidistant: {
                name: '正距方位図法',
                description: '中心点からの距離と方位が正確。中心から離れると歪みが増加。',
                properties: '正距図法（距離保持）',
                create: () => d3.geoAzimuthalEquidistant()
            },
            orthographic: {
                name: '正射図法',
                description: '地球を宇宙から見た球体として表現。半球のみ表示。',
                properties: '透視図法（立体的表現）',
                create: () => d3.geoOrthographic()
            },
            gnomonic: {
                name: '心射図法',
                description: '地球の中心から投影面に投影。直線が大圏航路を表す。',
                properties: '透視図法（航海用）',
                create: () => d3.geoGnomonic().clipAngle(60)
            },
            naturalEarth1: {
                name: 'ナチュラルアース図法',
                description: '視覚的に美しく、歪みのバランスが良い擬円筒図法。',
                properties: '妥協図法（バランス重視）',
                create: () => d3.geoNaturalEarth1()
            }
        };
    }

    getProjection(name) {
        if (!this.projections[name]) {
            throw new Error(`Unknown projection: ${name}`);
        }
        return this.projections[name].create();
    }

    getProjectionInfo(name) {
        return this.projections[name] || null;
    }

    setCurrentProjection(name) {
        if (this.projections[name]) {
            this.currentProjection = name;
            return true;
        }
        return false;
    }

    getCurrentProjection() {
        return this.getProjection(this.currentProjection);
    }

    getCurrentProjectionInfo() {
        return this.getProjectionInfo(this.currentProjection);
    }

    setScale(scale) {
        this.currentScale = scale;
    }

    setRotation(longitude, latitude) {
        this.currentRotation = [longitude, latitude];
        this.rotationMatrixCache = null;
    }

    configureProjection(projection, width, height) {
        return projection
            .scale(this.currentScale)
            .rotate(this.currentRotation)
            .translate([width / 2, height / 2]);
    }

    getRotationMatrix() {
        if (this.rotationMatrixCache) {
            return this.rotationMatrixCache;
        }

        if (typeof d3 === 'undefined' || typeof d3.geoRotation !== 'function') {
            this.rotationMatrixCache = new Float32Array([
                1, 0, 0,
                0, 1, 0,
                0, 0, 1
            ]);
            return this.rotationMatrixCache;
        }

        const rotation = d3.geoRotation(this.currentRotation);
        const basis = [
            rotation([0, 0]),
            rotation([90, 0]),
            rotation([0, 90])
        ];

        const vectors = basis.map(([lon, lat]) => this.lonLatToCartesian(lon, lat));

        this.rotationMatrixCache = new Float32Array([
            vectors[0][0], vectors[0][1], vectors[0][2],
            vectors[1][0], vectors[1][1], vectors[1][2],
            vectors[2][0], vectors[2][1], vectors[2][2]
        ]);

        return this.rotationMatrixCache;
    }

    lonLatToCartesian(longitude, latitude) {
        const rad = Math.PI / 180;
        const lambda = longitude * rad;
        const phi = latitude * rad;
        const cosPhi = Math.cos(phi);
        return [
            cosPhi * Math.cos(lambda),
            cosPhi * Math.sin(lambda),
            Math.sin(phi)
        ];
    }

    getAvailableProjections() {
        return Object.keys(this.projections).map(key => ({
            key,
            name: this.projections[key].name,
            properties: this.projections[key].properties
        }));
    }

    imageToGeoCoordinates(x, y, width, height) {
        const longitude = ((x / width) - 0.5) * 360;
        const latitude = ((0.5 - y / height)) * 180;
        
        return [
            Math.max(-180, Math.min(180, longitude)),
            Math.max(-90, Math.min(90, latitude))
        ];
    }

    geoToImageCoordinates(longitude, latitude, width, height) {
        const x = (longitude / 360 + 0.5) * width;
        const y = (0.5 - latitude / 180) * height;
        
        return [
            Math.max(0, Math.min(width - 1, x)),
            Math.max(0, Math.min(height - 1, y))
        ];
    }

    createInverseProjection(projection, width, height) {
        const configuredProjection = this.configureProjection(projection, width, height);
        
        return (screenX, screenY) => {
            try {
                const geoCoords = configuredProjection.invert([screenX, screenY]);
                if (!geoCoords || !isFinite(geoCoords[0]) || !isFinite(geoCoords[1])) {
                    return null;
                }
                return geoCoords;
            } catch (error) {
                return null;
            }
        };
    }

    isProjectionSupported(name) {
        return name in this.projections;
    }

    supportsInvert(projectionName = null) {
        const name = projectionName || this.currentProjection;
        const projection = this.getProjection(name);
        const configured = this.configureProjection(projection, 800, 600);
        return typeof configured.invert === 'function';
    }

    getInvertSupportedProjections() {
        return Object.keys(this.projections).filter(name => {
            try {
                return this.supportsInvert(name);
            } catch (error) {
                return false;
            }
        });
    }

    validateCoordinates(longitude, latitude) {
        return longitude >= -180 && longitude <= 180 && 
               latitude >= -90 && latitude <= 90;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProjectionManager;
}
