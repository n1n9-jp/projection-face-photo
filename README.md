# 地図投影法可視化アプリケーション

地図投影法の歪みを写真やGeoJSONデータで直感的に理解できるインタラクティブな可視化ツール

## 概要

このプロジェクトは、さまざまな地図投影法がデータに与える歪みを可視化するWebアプリケーションです。
[n1n9-jp/projection-face](https://github.com/n1n9-jp/projection-face)を参考に、より柔軟な入力形式と豊富な投影法に対応します。

## 機能

- **多様な入力形式**: GeoJSON・PNG画像の両方に対応
- **豊富な投影法**: メルカトル、正積、正角など主要投影法を網羅
- **リアルタイム切替**: ドロップダウンでの即座な投影変更
- **直感的UI**: ドラッグ&ドロップ対応の使いやすいインターフェース

## 技術スタック

- **D3.js**: 地図投影法とSVG描画
- **HTML5 Canvas**: PNG画像処理
- **Vanilla JavaScript**: 軽量で高速な実装
- **CSS3**: モダンなレスポンシブUI

## アーキテクチャ

```
src/
├── index.html          # メインHTML
├── js/
│   ├── main.js         # アプリケーションエントリーポイント
│   ├── projections.js  # 投影法定義・管理
│   ├── input-handler.js # GeoJSON/PNG入力処理
│   ├── renderer.js     # 描画エンジン
│   └── ui-controls.js  # UI制御
├── css/
│   └── style.css       # スタイル
└── data/
    └── sample.geojson  # サンプルGeoJSON
```

## 対応投影法

### 等角図法（角度保持）
- **メルカトル図法** (`d3.geoMercator()`)
- **ステレオ図法** (`d3.geoStereographic()`)

### 正積図法（面積保持）
- **イコールアース図法** (`d3.geoEqualEarth()`)
- **モルワイデ図法** (`d3.geoMollweide()`)

### 正距図法（距離保持）
- **正距方位図法** (`d3.geoAzimuthalEquidistant()`)

### その他
- **正射図法** (`d3.geoOrthographic()`)
- **心射図法** (`d3.geoGnomonic()`)
- **ナチュラルアース図法** (`d3.geoNaturalEarth1()`)

## 入力システム設計

### GeoJSON入力
- ファイルドロップ対応
- JSON形式バリデーション
- Feature/FeatureCollection両対応
- 座標系自動検出（WGS84想定）

### PNG入力
- Canvas APIで画像読み込み
- 画像の各ピクセルを緯度経度座標として扱う
- 地図投影法で画像データ自体を変形
- リアルタイム投影変換（ImageData操作）

## UI設計

### レイアウト構成
```
┌─────────────────────────────────────┐
│ ヘッダー：タイトル + 投影法選択      │
├─────────────────────────────────────┤
│ サイドバー │        メイン表示       │
│ ・入力選択 │        ・SVG地図        │
│ ・設定     │        ・投影結果       │
│ ・情報     │                        │
└─────────────────────────────────────┘
```

### 主要コンポーネント
1. **ProjectionSelector**: 投影法ドロップダウン
2. **InputManager**: ファイル入力・切替
3. **MapCanvas**: SVG描画領域
4. **ControlPanel**: パラメータ調整
5. **InfoDisplay**: 投影法説明・統計

## 実装ステップ

1. **基盤構築** - HTML/CSS基本構造
2. **D3.js統合** - 投影法ライブラリ導入
3. **入力システム** - GeoJSON/PNG処理
4. **描画エンジン** - SVG/Canvas描画
5. **UI制御** - ドロップダウン・インタラクション
6. **最適化** - パフォーマンス・UX改善

## 投影変換パイプライン

### GeoJSONの場合
1. **入力データ正規化** - 緯度経度座標系への変換
2. **投影関数適用** - D3.js投影法の適用
3. **スケール・回転調整** - 表示領域に最適化
4. **SVG座標変換** - 画面座標への変換

### PNG画像の場合
1. **ピクセル座標マッピング** - 画像座標(x,y)を緯度経度(lat,lon)に対応
2. **逆投影計算** - 各出力ピクセルから元画像座標を算出
3. **画像サンプリング** - 補間によるピクセル値取得
4. **Canvas描画** - 変形済み画像データの描画

## 参考

- [Map Projection Transitions](https://observablehq.com/@d3/map-projection-transitions) - D3.js投影法デモ
- [n1n9-jp/projection-face](https://github.com/n1n9-jp/projection-face) - 本プロジェクトの参考実装
- [D3.js Geo Projections](https://github.com/d3/d3-geo-projection) - D3.js地図投影法ライブラリ

## ライセンス

MIT License