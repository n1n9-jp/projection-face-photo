class LanguageManager {
    constructor() {
        this.currentLanguage = 'ja';
        this.translations = this.initializeTranslations();
        this.callbacks = {
            onLanguageChange: null
        };
    }

    initializeTranslations() {
        return {
            ja: {
                header: {
                    title: '顔の画像で学ぶ地図投影法',
                    projectionLabel: '投影法:',
                    tagline: '顔写真や地図データを投影し、歪みの違いを体験しましょう。'
                },
                inputSection: {
                    title: '顔の画像データ入力',
                    inputTypes: {
                        image: 'PNG, JPEG',
                        webcam: 'Webカム',
                        geojson: 'GeoJSON'
                    },
                    dropZone: {
                        drag: 'ファイルをドラッグ&ドロップ',
                        or: 'または',
                        select: 'ファイルを選択'
                    },
                    fileInfo: {
                        name: 'ファイル名:',
                        type: 'タイプ:'
                    },
                    webcam: {
                        startCamera: 'カメラを起動',
                        restartCamera: 'カメラを再起動',
                        stopCamera: '停止',
                        capture: '写真を撮る',
                        selectCamera: 'カメラ:',
                        switchCamera: 'カメラを切替:',
                        notice: '撮影した顔画像はサーバ側では一切保存していません。'
                    },
                    samples: {
                        title: 'サンプルデータ',
                        geojsonTitle: 'GeoJSONサンプル',
                        imageTitle: '画像サンプル'
                    }
                },
                controlSection: {
                    title: '表示設定',
                    showGraticule: '緯度経度線を表示',
                    scale: 'スケール:',
                    rotationX: '回転 (経度):',
                    rotationY: '回転 (緯度):',
                    exportImage: '画像をエクスポート'
                },
                infoSection: {
                    title: '投影法情報',
                    selectPrompt: '投影法を選択してください',
                    classification: '分類:',
                    imageSupport: '画像変形:',
                    imageSupported: '✓ 画像変形対応',
                    imageNotSupported: '✗ GeoJSONのみ対応',
                    characteristics: '特徴:',
                    dataInfo: 'データ情報',
                    noData: 'データが読み込まれていません',
                    fileName: 'ファイル:',
                    dataType: 'タイプ:',
                    featureCount: 'フィーチャー数:',
                    format: '形式:',
                    size: 'サイズ:',
                    ratio: '比率:'
                },
                projections: {
                    mercator: {
                        name: 'メルカトル図法',
                        description: '角度を保持する円筒図法。航海用地図で広く使用。極地で大きな歪み。',
                        properties: '正角図法（角度保持）',
                        characteristics: [
                            '直線は直線のまま保持される',
                            '角度が正確に保たれる',
                            '極地で大きな面積の歪み',
                            'Web地図で標準的に使用'
                        ]
                    },
                    stereographic: {
                        name: 'ステレオ図法',
                        description: '角度を保持する方位図法。中心からの距離が大きくなると歪みが増加。',
                        properties: '正角図法（角度保持）',
                        characteristics: [
                            '角度が正確に保たれる',
                            '円は円のまま保持される',
                            '中心から離れると歪みが増加',
                            '半球の表示に適している'
                        ]
                    },
                    equalEarth: {
                        name: 'イコールアース図法',
                        description: '面積を保持する擬円筒図法。視覚的に自然で現代的な世界地図に適用。',
                        properties: '正積図法（面積保持）',
                        characteristics: [
                            '面積が正確に保たれる',
                            '視覚的に自然な外観',
                            '直線的な極地線',
                            '現代の世界地図に推奨'
                        ]
                    },
                    mollweide: {
                        name: 'モルワイデ図法',
                        description: '面積を保持する楕円形の擬円筒図法。全球を楕円で表現。',
                        properties: '正積図法（面積保持）',
                        characteristics: [
                            '面積が正確に保たれる',
                            '楕円形の世界表現',
                            '中央経線で角度歪みなし',
                            'テーマ地図に適している'
                        ]
                    },
                    azimuthalEquidistant: {
                        name: '正距方位図法',
                        description: '中心点からの距離と方位が正確。中心から離れると歪みが増加。',
                        properties: '正距図法（距離保持）',
                        characteristics: [
                            '中心からの距離が正確',
                            '中心からの方位が正確',
                            '航空路線図で使用',
                            '極地投影として有用'
                        ]
                    },
                    orthographic: {
                        name: '正射図法',
                        description: '地球を宇宙から見た球体として表現。半球のみ表示。',
                        properties: '透視図法（立体的表現）',
                        characteristics: [
                            '地球を宇宙から見た視点',
                            '半球のみ表示',
                            '立体的な外観',
                            '教育用途に最適'
                        ]
                    },
                    gnomonic: {
                        name: '心射図法',
                        description: '地球の中心から投影面に投影。直線が大圏航路を表す。',
                        properties: '透視図法（航海用）',
                        characteristics: [
                            '大圏航路が直線になる',
                            '航海用に有用',
                            '中心から離れると極端な歪み',
                            '半球の一部のみ表示可能'
                        ]
                    },
                    naturalEarth1: {
                        name: 'ナチュラルアース図法',
                        description: '視覚的に美しく、歪みのバランスが良い擬円筒図法。',
                        properties: '妥協図法（バランス重視）',
                        characteristics: [
                            '妥協図法（面積・角度・距離のバランス）',
                            '視覚的に美しい',
                            '一般的な世界地図に適している',
                            '教育・メディア用途で人気'
                        ]
                    }
                },
                sampleData: {
                    geojson: {
                        face: {
                            name: '顔 (Face)',
                            description: '人の顔を模したGeoJSONデータ'
                        },
                        geometric: {
                            name: '幾何学図形',
                            description: '三角形、五角形、星形など'
                        },
                        tissot: {
                            name: 'ティソの示円',
                            description: '投影法の歪みを確認する円形パターン'
                        }
                    },
                    images: {
                        self: {
                            name: '自撮り写真',
                            description: '画像はツール作者本人です。'
                        },
                        lena: {
                            name: 'レナ',
                            description: '画像処理の標準テスト画像'
                        }
                    }
                },
                messages: {
                    cameraStarted: 'カメラを起動しました',
                    cameraStopped: 'カメラを停止しました',
                    photoCaptured: '写真を撮りました',
                    dataCleared: 'データをクリアしました',
                    dataLoaded: 'を読み込みました',
                    projectionReset: '投影設定をリセットしました',
                    imageExported: '画像をエクスポートしました',
                    exportFailed: 'エクスポートに失敗しました',
                    selectCamera: 'カメラを選択してください',
                    welcome: 'GeoJSONまたは顔写真をアップロードして地図投影法を体験してください！',
                    inputError: '入力エラー:',
                    renderError: '描画に失敗しました:',
                    sampleLoadError: 'サンプル読み込みエラー:',
                    sampleLoadFailed: 'サンプル読み込みに失敗しました',
                    unsupportedFileType: 'サポートされていないファイル形式です',
                    jsonParseError: 'GeoJSONファイルの解析に失敗しました',
                    fileReadError: 'ファイルの読み込みに失敗しました',
                    imageLoadError: '画像の読み込みに失敗しました',
                    invalidJson: '有効なJSONではありません',
                    invalidGeoJsonType: 'GeoJSONのtype属性が必要です',
                    missingFeatures: 'FeatureCollectionにはfeatures配列が必要です',
                    missingGeometry: 'Featureにはgeometry属性が必要です',
                    cameraUnsupported: 'お使いのブラウザはカメラアクセスに対応していません',
                    permissionDenied: 'カメラへのアクセスが拒否されました',
                    cameraNotFound: 'カメラが見つかりませんでした',
                    cameraInUse: 'カメラが他のアプリケーションで使用中です',
                    captureError: '画像のキャプチャに失敗しました'
                },
                footer: {
                    text: '地図投影法の歪みを可視化 - 顔写真やGeoJSONデータで投影法の特性を理解',
                    credit: 'face.geojsonは<a href="https://gist.github.com/awoodruff/9216081#file-face-geojson" target="_blank" rel="noopener noreferrer">こちら</a>から取得しています。'
                },
                loading: {
                    converting: '変換中...'
                },
                language: {
                    label: '言語:'
                }
            },
            en: {
                header: {
                    title: 'Learn Map Projections with Face Photos',
                    projectionLabel: 'Projection:',
                    tagline: 'Explore projection distortions with face photos and GeoJSON data.'
                },
                inputSection: {
                    title: 'Face Image Data Input',
                    inputTypes: {
                        image: 'PNG, JPEG',
                        webcam: 'Webcam',
                        geojson: 'GeoJSON'
                    },
                    dropZone: {
                        drag: 'Drag & drop file',
                        or: 'or',
                        select: 'Select file'
                    },
                    fileInfo: {
                        name: 'File:',
                        type: 'Type:'
                    },
                    webcam: {
                        startCamera: 'Start Camera',
                        restartCamera: 'Restart Camera',
                        stopCamera: 'Stop',
                        capture: 'Take Photo',
                        selectCamera: 'Camera:',
                        switchCamera: 'Switch Camera:',
                        notice: "We do not store captured images on any server."
                    },
                    samples: {
                        title: 'Sample Data',
                        geojsonTitle: 'GeoJSON Samples',
                        imageTitle: 'Image Samples'
                    }
                },
                controlSection: {
                    title: 'Display Settings',
                    showGraticule: 'Show graticule',
                    scale: 'Scale:',
                    rotationX: 'Rotation (Longitude):',
                    rotationY: 'Rotation (Latitude):',
                    exportImage: 'Export Image'
                },
                infoSection: {
                    title: 'Projection Info',
                    selectPrompt: 'Select a projection',
                    classification: 'Classification:',
                    imageSupport: 'Image Transform:',
                    imageSupported: '✓ Supported',
                    imageNotSupported: '✗ GeoJSON only',
                    characteristics: 'Characteristics:',
                    dataInfo: 'Data Information',
                    noData: 'No data loaded',
                    fileName: 'File:',
                    dataType: 'Type:',
                    featureCount: 'Features:',
                    format: 'Format:',
                    size: 'Size:',
                    ratio: 'Ratio:'
                },
                projections: {
                    mercator: {
                        name: 'Mercator',
                        description: 'Conformal cylindrical projection preserving angles. Widely used for navigation. Large distortion near poles.',
                        properties: 'Conformal (angle-preserving)',
                        characteristics: [
                            'Lines remain straight',
                            'Angles are preserved accurately',
                            'Large area distortion at poles',
                            'Standard for web maps'
                        ]
                    },
                    stereographic: {
                        name: 'Stereographic',
                        description: 'Conformal azimuthal projection. Distortion increases with distance from center.',
                        properties: 'Conformal (angle-preserving)',
                        characteristics: [
                            'Angles are preserved accurately',
                            'Circles remain circles',
                            'Distortion increases from center',
                            'Suitable for hemisphere display'
                        ]
                    },
                    equalEarth: {
                        name: 'Equal Earth',
                        description: 'Equal-area pseudocylindrical projection. Visually natural for modern world maps.',
                        properties: 'Equal-area (area-preserving)',
                        characteristics: [
                            'Areas are preserved accurately',
                            'Visually natural appearance',
                            'Straight pole lines',
                            'Recommended for modern world maps'
                        ]
                    },
                    mollweide: {
                        name: 'Mollweide',
                        description: 'Equal-area elliptical pseudocylindrical projection. Represents globe as ellipse.',
                        properties: 'Equal-area (area-preserving)',
                        characteristics: [
                            'Areas are preserved accurately',
                            'Elliptical world representation',
                            'No angle distortion at central meridian',
                            'Suitable for thematic maps'
                        ]
                    },
                    azimuthalEquidistant: {
                        name: 'Azimuthal Equidistant',
                        description: 'Distance and azimuth from center are accurate. Distortion increases from center.',
                        properties: 'Equidistant (distance-preserving)',
                        characteristics: [
                            'Accurate distance from center',
                            'Accurate azimuth from center',
                            'Used for air route maps',
                            'Useful for polar projection'
                        ]
                    },
                    orthographic: {
                        name: 'Orthographic',
                        description: 'Perspective projection showing Earth as sphere from space. Shows hemisphere only.',
                        properties: 'Perspective (3D representation)',
                        characteristics: [
                            'View from space',
                            'Hemisphere only',
                            'Three-dimensional appearance',
                            'Ideal for educational use'
                        ]
                    },
                    gnomonic: {
                        name: 'Gnomonic',
                        description: 'Projection from Earth center. Great circles appear as straight lines.',
                        properties: 'Perspective (navigation)',
                        characteristics: [
                            'Great circles become straight lines',
                            'Useful for navigation',
                            'Extreme distortion from center',
                            'Shows part of hemisphere only'
                        ]
                    },
                    naturalEarth1: {
                        name: 'Natural Earth',
                        description: 'Visually appealing pseudocylindrical projection with balanced distortion.',
                        properties: 'Compromise (balanced)',
                        characteristics: [
                            'Compromise projection (balanced area, angle, distance)',
                            'Visually appealing',
                            'Suitable for general world maps',
                            'Popular for education and media'
                        ]
                    }
                },
                sampleData: {
                    geojson: {
                        face: {
                            name: 'Face',
                            description: 'GeoJSON data representing a human face'
                        },
                        geometric: {
                            name: 'Geometric Shapes',
                            description: 'Triangles, pentagons, stars, etc.'
                        },
                        tissot: {
                            name: "Tissot's Indicatrix",
                            description: 'Circular pattern to verify projection distortion'
                        }
                    },
                    images: {
                        self: {
                            name: 'Selfie',
                            description: "Sample image by the tool's creator."
                        },
                        lena: {
                            name: 'Lena',
                            description: 'Standard test image in image processing'
                        }
                    }
                },
                messages: {
                    cameraStarted: 'Camera started',
                    cameraStopped: 'Camera stopped',
                    photoCaptured: 'Photo captured',
                    dataCleared: 'Data cleared',
                    dataLoaded: 'loaded',
                    projectionReset: 'Projection settings reset',
                    imageExported: 'Image exported',
                    exportFailed: 'Export failed',
                    selectCamera: 'Please select a camera',
                    welcome: 'Upload a GeoJSON or face photo to experience map projections!',
                    inputError: 'Input error:',
                    renderError: 'Rendering failed:',
                    sampleLoadError: 'Sample load error:',
                    sampleLoadFailed: 'Failed to load sample',
                    unsupportedFileType: 'Unsupported file type',
                    jsonParseError: 'Failed to parse GeoJSON file',
                    fileReadError: 'Failed to read file',
                    imageLoadError: 'Failed to load image',
                    invalidJson: 'Not a valid JSON',
                    invalidGeoJsonType: 'GeoJSON must have a type attribute',
                    missingFeatures: 'FeatureCollection must have a features array',
                    missingGeometry: 'Feature must have a geometry attribute',
                    cameraUnsupported: 'Your browser does not support camera access',
                    permissionDenied: 'Camera access was denied',
                    cameraNotFound: 'No camera found',
                    cameraInUse: 'Camera is in use by another application',
                    captureError: 'Failed to capture image'
                },
                footer: {
                    text: 'Visualize map projection distortions - Understand projection characteristics with face photos and GeoJSON data',
                    credit: 'face.geojson sourced from <a href="https://gist.github.com/awoodruff/9216081#file-face-geojson" target="_blank" rel="noopener noreferrer">this resource</a>.'
                },
                loading: {
                    converting: 'Converting...'
                },
                language: {
                    label: 'Language:'
                }
            }
        };
    }

    initialize() {
        let initialLanguage = this.currentLanguage;

        let savedLanguage = null;
        try {
            savedLanguage = localStorage.getItem('mapProjectionApp_language');
        } catch (error) {
            savedLanguage = null;
        }

        let urlLanguage = null;
        if (typeof window !== 'undefined' && window.location) {
            try {
                const params = new URLSearchParams(window.location.search);
                urlLanguage = params.get('lang');
            } catch (error) {
                urlLanguage = null;
            }
        }

        if (urlLanguage && this.translations[urlLanguage]) {
            initialLanguage = urlLanguage;
        } else if (savedLanguage && this.translations[savedLanguage]) {
            initialLanguage = savedLanguage;
        }

        this.currentLanguage = initialLanguage;

        try {
            localStorage.setItem('mapProjectionApp_language', this.currentLanguage);
        } catch (error) {
            // ignore storage failures
        }

        this.updateURLLanguage(this.currentLanguage);
    }

    setLanguage(lang) {
        if (!this.translations[lang]) {
            console.error(`Language ${lang} not supported`);
            return false;
        }

        if (lang === this.currentLanguage) {
            this.updateURLLanguage(lang);
            return true;
        }

        this.currentLanguage = lang;
        try {
            localStorage.setItem('mapProjectionApp_language', lang);
        } catch (error) {
            // ignore storage failures
        }

        this.updateURLLanguage(lang);

        this.triggerCallback('onLanguageChange', lang);
        return true;
    }

    updateURLLanguage(lang) {
        if (typeof window === 'undefined' || !window.history || !window.location) {
            return;
        }

        try {
            const url = new URL(window.location.href);
            url.searchParams.set('lang', lang);
            window.history.replaceState({}, '', url.toString());
        } catch (error) {
            // ignore URL update issues
        }
    }

    getCurrentLanguage() {
        return this.currentLanguage;
    }

    getAvailableLanguages() {
        return [
            { code: 'ja', name: '日本語', nativeName: '日本語' },
            { code: 'en', name: 'English', nativeName: 'English' }
        ];
    }

    t(key) {
        const keys = key.split('.');
        let value = this.translations[this.currentLanguage];

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                console.warn(`Translation key not found: ${key}`);
                return key;
            }
        }

        return value;
    }

    onLanguageChange(callback) {
        this.callbacks.onLanguageChange = callback;
    }

    triggerCallback(name, data) {
        if (this.callbacks[name]) {
            this.callbacks[name](data);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LanguageManager;
}
