const express = require('express');
const ProductAdvertisingAPIv1 = require('./paapi5-nodejs-sdk-example/src');
const { S3Client } = require('@aws-sdk/client-s3');
const RakutenClient = require('./rakuten');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();
const { saveCache, loadCache } = require('./cache');

// ログファイルのパス
const LOG_FILE = path.join(__dirname, 'logs', 'app.log');

// ログディレクトリの作成
async function ensureLogDir() {
  const logDir = path.join(__dirname, 'logs');
  try {
    await fs.access(logDir);
  } catch {
    await fs.mkdir(logDir);
  }
}

// ログをファイルに書き込む
async function writeLog(message) {
  await ensureLogDir();
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  await fs.appendFile(LOG_FILE, logMessage);
  console.log(message); // コンソールにも出力
}

const app = express();
app.use(express.json());

// 静的ファイルの提供
app.use(express.static(path.join(__dirname, '../public')));

// S3クライアントの設定
const s3Client = new S3Client({
  region: process.env.AWS_REGION
});

// Amazon Product APIの設定
const defaultClient = ProductAdvertisingAPIv1.ApiClient.instance;
defaultClient.accessKey = process.env.AMAZON_ASSOCIATE_ACCESS_KEY;
defaultClient.secretKey = process.env.AMAZON_ASSOCIATE_SECRET_KEY;
defaultClient.host = 'webservices.amazon.com';
defaultClient.region = 'us-east-1';

const client = new ProductAdvertisingAPIv1.DefaultApi();

// 楽天APIの設定
const rakutenClient = new RakutenClient(process.env.RAKUTEN_APPLICATION_ID);

// 接続チェック用のルート
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>ハリボー価格チェッカー</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          h1 {
            color: #e60012;
          }
          .status {
            padding: 10px;
            margin: 10px 0;
            border-radius: 5px;
          }
          .success {
            background-color: #e8f5e9;
            color: #2e7d32;
          }
          .error {
            background-color: #ffebee;
            color: #c62828;
          }
        </style>
      </head>
      <body>
        <h1>ハリボー価格チェッカー</h1>
        <div class="status success">
          <h2>接続状態</h2>
          <p>✅ サーバーは正常に動作しています</p>
          <p>✅ APIエンドポイント:</p>
          <ul>
            <li><a href="/prices">/prices</a> - すべてのハリボーの価格情報</li>
            <li><a href="/cheapest">/cheapest</a> - 最安のハリボーの情報</li>
          </ul>
        </div>
      </body>
    </html>
  `);
});

// ハリボーゴールドベアの商品を検索
async function searchHariboProducts(forceRefresh = false) {
  try {
    // キャッシュからデータを読み込む（forceRefreshがfalseの場合のみ）
    if (!forceRefresh) {
      const cachedData = await loadCache();
      if (cachedData) {
        await writeLog('キャッシュからデータを読み込みました');
        return cachedData;
      }
    } else {
      await writeLog('キャッシュを無視して新しいデータを取得します');
    }

    const searchItemsRequest = new ProductAdvertisingAPIv1.SearchItemsRequest();
    
    // リクエストパラメータの設定
    searchItemsRequest['PartnerTag'] = process.env.AMAZON_ASSOCIATE_TAG;
    searchItemsRequest['PartnerType'] = 'Associates';
    searchItemsRequest['Keywords'] = 'ハリボー';
    searchItemsRequest['SearchIndex'] = 'Grocery';
    searchItemsRequest['ItemCount'] = 10;
    searchItemsRequest['Resources'] = [
      'ItemInfo.Title',
      'ItemInfo.ByLineInfo',
      'ItemInfo.ContentInfo',
      'ItemInfo.Features', 
      'Offers.Listings.Price',
      'Offers.Listings.DeliveryInfo.IsPrimeEligible',
      'Offers.Listings.PromoType',
      'Images.Primary.Medium'
    ];

    const response = await client.searchItems(searchItemsRequest);
    const items = response.SearchResult.Items;
    
    // データをキャッシュに保存
    await saveCache(items);
    await writeLog('新しいデータをキャッシュに保存しました');
    
    return items;
    
  } catch (error) {
    await writeLog(`商品検索エラー: ${error.message}`);
    throw error;
  }
}

// 楽天の商品を検索
async function searchRakutenProducts(forceRefresh = false) {
  try {
    // キャッシュからデータを読み込む（forceRefreshがfalseの場合のみ）
    if (!forceRefresh) {
      const cachedData = await loadCache('rakuten');
      if (cachedData) {
        await writeLog('楽天のキャッシュからデータを読み込みました');
        return cachedData;
      }
    } else {
      await writeLog('楽天のキャッシュを無視して新しいデータを取得します');
    }

    const items = await rakutenClient.searchProducts('ハリボー', {
      hits: 30,
      availability: 1, // 在庫ありのみ
      sort: 'price' // 価格順
    });

    // データをキャッシュに保存
    await saveCache(items, 'rakuten');
    await writeLog('楽天の新しいデータをキャッシュに保存しました');
    
    return items;
  } catch (error) {
    await writeLog(`楽天商品検索エラー: ${error.message}`);
    throw error;
  }
}

// 1gあたりの単価を計算
function calculatePricePerGram(item) {
  const price = item.Offers.Listings[0].Price.Amount;
  const weight = parseFloat(item.ItemInfo.Features?.find(f => f.includes('g'))?.replace(/[^0-9]/g, '') || 0);
  
  if (weight === 0) return null;
  return {
    pricePerGram: price / weight,
    price,
    weight,
    item
  };
}

// 1gあたりの単価を計算（楽天用）
function calculateRakutenPricePerGram(item) {
  const price = item.Item.price;
  // 商品名から重さを抽出（例：ハリボー ゴールドベア 200g）
  const weightMatch = item.Item.itemName.match(/(\d+)g/);
  const weight = weightMatch ? parseFloat(weightMatch[1]) : 0;
  
  if (weight === 0) return null;
  return {
    pricePerGram: price / weight,
    price,
    weight,
    item: item.Item
  };
}

// 最安の商品を取得
async function getCheapestHaribo() {
  const items = await searchHariboProducts();
  const prices = items
    .map(calculatePricePerGram)
    .filter(p => p !== null)
    .sort((a, b) => a.pricePerGram - b.pricePerGram);

  return prices[0];
}

// APIエンドポイント
app.get('/prices', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    let amazonPrices = [];
    let rakutenPrices = [];

    // Amazonの商品を取得
    try {
      const amazonItems = await searchHariboProducts(forceRefresh);
      amazonPrices = amazonItems
        .map(calculatePricePerGram)
        .filter(p => p !== null);
      await writeLog('Amazonの商品情報を取得しました');
    } catch (error) {
      await writeLog(`Amazonの商品情報取得に失敗: ${error.message}`);
    }

    // 楽天の商品を取得
    try {
      const rakutenItems = await searchRakutenProducts(forceRefresh);
      rakutenPrices = rakutenItems
        .map(calculateRakutenPricePerGram)
        .filter(p => p !== null);
      await writeLog('楽天の商品情報を取得しました');
    } catch (error) {
      await writeLog(`楽天の商品情報取得に失敗: ${error.message}`);
    }

    // 取得できた商品情報を統合
    const allPrices = [...amazonPrices, ...rakutenPrices]
      .sort((a, b) => a.pricePerGram - b.pricePerGram);
    
    if (allPrices.length === 0) {
      throw new Error('商品情報が取得できませんでした');
    }

    res.json(allPrices);
  } catch (error) {
    await writeLog(`価格情報の取得に失敗: ${error.message}`);
    res.status(500).json({ error: '価格情報の取得に失敗しました' });
  }
});

app.get('/cheapest', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    let amazonPrices = [];
    let rakutenPrices = [];

    // Amazonの商品を取得
    try {
      const amazonItems = await searchHariboProducts(forceRefresh);
      amazonPrices = amazonItems
        .map(calculatePricePerGram)
        .filter(p => p !== null);
      await writeLog('Amazonの商品情報を取得しました');
    } catch (error) {
      await writeLog(`Amazonの商品情報取得に失敗: ${error.message}`);
    }

    // 楽天の商品を取得
    try {
      const rakutenItems = await searchRakutenProducts(forceRefresh);
      rakutenPrices = rakutenItems
        .map(calculateRakutenPricePerGram)
        .filter(p => p !== null);
      await writeLog('楽天の商品情報を取得しました');
    } catch (error) {
      await writeLog(`楽天の商品情報取得に失敗: ${error.message}`);
    }

    // 取得できた商品情報を統合
    const allPrices = [...amazonPrices, ...rakutenPrices]
      .sort((a, b) => a.pricePerGram - b.pricePerGram);
    
    if (allPrices.length === 0) {
      throw new Error('商品情報が取得できませんでした');
    }

    res.json(allPrices[0]);
  } catch (error) {
    await writeLog(`最安価格の取得に失敗: ${error.message}`);
    res.status(500).json({ error: '最安価格の取得に失敗しました' });
  }
});

// Lambda関数のハンドラー
exports.handler = async (event) => {
  const serverless = require('serverless-http');
  return serverless(app)(event);
};

// サーバーを起動
const PORT = 3000; // 環境変数を使わずに3000に固定
app.listen(PORT, () => {
  console.log(`サーバーが起動しました！ http://localhost:${PORT}`);
}); 