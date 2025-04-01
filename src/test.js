/**
 * ハリボーゴールドベアの価格検索テスト
 */

const ProductAdvertisingAPIv1 = require('./paapi5-nodejs-sdk-example/src');
require('dotenv').config();

// 環境変数の確認
console.log('認証情報の確認:');
console.log('Access Key:', process.env.AMAZON_ASSOCIATE_ACCESS_KEY);
console.log('Secret Key:', process.env.AMAZON_ASSOCIATE_SECRET_KEY ? '設定されています' : '未設定');
console.log('Partner Tag:', process.env.AMAZON_ASSOCIATE_TAG);
console.log('-------------------');

// SDKの初期化
var defaultClient = ProductAdvertisingAPIv1.ApiClient.instance;

// 認証情報の設定
defaultClient.accessKey = process.env.AMAZON_ASSOCIATE_ACCESS_KEY;
defaultClient.secretKey = process.env.AMAZON_ASSOCIATE_SECRET_KEY;

// リージョンとホストの設定 - Javaコードに合わせる
defaultClient.host = 'webservices.amazon.co.jp';
defaultClient.region = 'us-west-2';  // us-east-1からus-west-2に変更

// リクエスト時に現在時刻を使うためのオプション
defaultClient.defaultHeaders = {
  'User-Agent': 'HariboPriceChecker/1.0.0'
};

// APIクライアントの作成
var api = new ProductAdvertisingAPIv1.DefaultApi();

// リクエストの初期化
var searchItemsRequest = new ProductAdvertisingAPIv1.SearchItemsRequest();

// パートナータグとパートナータイプの設定
searchItemsRequest['PartnerTag'] = process.env.AMAZON_ASSOCIATE_TAG;
searchItemsRequest['PartnerType'] = 'Associates';
searchItemsRequest['Marketplace'] = 'www.amazon.co.jp';  // Javaコードに合わせて追加

// 検索キーワードの指定
searchItemsRequest['Keywords'] = 'ハリボー';  // Javaコードに合わせる

// 検索カテゴリの指定（省略可能）
// searchItemsRequest['SearchIndex'] = 'Grocery';

// 返される商品数の指定（少なめに）
searchItemsRequest['ItemCount'] = 1;

// 返される情報の指定 - Javaコードに合わせる
searchItemsRequest['Resources'] = [
  'ItemInfo.ByLineInfo',
  'ItemInfo.ContentInfo',
  'ItemInfo.ContentRating',
  'ItemInfo.Classifications',
  'ItemInfo.ExternalIds',
  'ItemInfo.Features',
  'ItemInfo.ManufactureInfo',
  'ItemInfo.ProductInfo',
  'ItemInfo.TechnicalInfo',
  'ItemInfo.Title',
  'ItemInfo.TradeInInfo'
];

// 成功時のコールバック
function onSuccess(data) {
  console.log('API呼び出しに成功しました！');
  var searchItemsResponse = ProductAdvertisingAPIv1.SearchItemsResponse.constructFromObject(data);
  console.log('検索結果:');
  console.log(JSON.stringify(searchItemsResponse, null, 2));
}

// エラー時のコールバック
function onError(error) {
  console.log('PA-APIの呼び出し中にエラーが発生しました！');
  console.log('エラーの詳細:', JSON.stringify(error, null, 2));
  console.log('ステータスコード:', error['status']);
  if (error['response'] !== undefined && error['response']['text'] !== undefined) {
    console.log('エラーオブジェクト:', JSON.stringify(error['response']['text'], null, 2));
  }
}

// リクエストを行う関数
function makeRequest() {
  console.log('APIリクエストを開始します...');
  api.searchItems(searchItemsRequest).then(
    function(data) {
      onSuccess(data);
    },
    function(error) {
      onError(error);
    }
  );
}

// APIを呼び出す
makeRequest(); 