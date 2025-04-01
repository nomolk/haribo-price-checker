# ハリボー価格比較アプリ

AmazonのPA-APIを使って「ハリボーゴールドベア」の各パッケージの価格を取得し、1グラムあたりの単価が最も安いものを計算＆表示するWebアプリ。

## セットアップ方法

1. 依存関係のインストール
```bash
npm install
```

2. 環境変数の設定
`.env`ファイルを作成し、以下の環境変数を設定してください：

```
AWS_ACCESS_KEY=your_access_key
AWS_SECRET_KEY=your_secret_key
PARTNER_TAG=your_partner_tag
AWS_REGION=ap-northeast-1
```

3. AWS Lambdaへのデプロイ
- AWS Lambda関数を作成
- API Gatewayと連携
- 環境変数を設定

## APIエンドポイント

- `GET /prices` - 最新の価格情報を返す
- `GET /cheapest` - 最安のハリボーを返す

## 技術スタック

- AWS Lambda
- Express.js
- Amazon PA-API
- AWS S3 