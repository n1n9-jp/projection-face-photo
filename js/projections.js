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
                webglIndex: 0,
                create: () => d3.geoMercator()
            },
            stereographic: {
                webglIndex: 1,
                create: () => d3.geoStereographic().clipAngle(90)
            },
            equalEarth: {
                webglIndex: 2,
                create: () => d3.geoEqualEarth()
            },
            mollweide: {
                webglIndex: 3,
                create: () => d3.geoMollweide()
            },
            azimuthalEquidistant: {
                webglIndex: 4,
                create: () => d3.geoAzimuthalEquidistant()
            },
            orthographic: {
                webglIndex: 5,
                create: () => d3.geoOrthographic()
            },
            gnomonic: {
                webglIndex: 6,
                create: () => d3.geoGnomonic().clipAngle(60)
            },
            naturalEarth1: {
                webglIndex: 7,
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
            webglIndex: this.projections[key].webglIndex
        }));
    }

    getProjectionIndexMap() {
        const map = new Map();
        Object.keys(this.projections).forEach(key => {
            map.set(key, this.projections[key].webglIndex);
        });
        return map;
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

    validateCoordinates(longitude, latitude) {
        return longitude >= -180 && longitude <= 180 &&
               latitude >= -90 && latitude <= 90;
    }
}
