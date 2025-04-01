const fs = require('fs').promises;
const path = require('path');

const CACHE_DIR = path.join(__dirname, 'cache');
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24時間（ミリ秒）

// キャッシュディレクトリの作成
async function ensureCacheDir() {
  try {
    await fs.access(CACHE_DIR);
  } catch {
    await fs.mkdir(CACHE_DIR);
  }
}

// キャッシュファイルのパスを取得
function getCacheFilePath(source) {
  return path.join(CACHE_DIR, `${source}.json`);
}

// キャッシュの保存
async function saveCache(data, source = 'amazon') {
  await ensureCacheDir();
  const cacheData = {
    timestamp: Date.now(),
    data: data
  };
  await fs.writeFile(getCacheFilePath(source), JSON.stringify(cacheData, null, 2));
}

// キャッシュの読み込み
async function loadCache(source = 'amazon') {
  try {
    const cacheContent = await fs.readFile(getCacheFilePath(source), 'utf8');
    const cache = JSON.parse(cacheContent);
    
    // キャッシュの有効期限チェック
    if (Date.now() - cache.timestamp > CACHE_DURATION) {
      return null;
    }
    
    return cache.data;
  } catch (error) {
    return null;
  }
}

module.exports = {
  saveCache,
  loadCache
}; 