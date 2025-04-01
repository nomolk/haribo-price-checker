const axios = require('axios');

const RAKUTEN_API_URL = 'https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601';

// 楽天APIのクライアント
class RakutenClient {
  constructor(applicationId) {
    this.applicationId = applicationId;
  }

  // 商品を検索
  async searchProducts(keyword, options = {}) {
    let params;
    try {
      params = {
        applicationId: this.applicationId,
        keyword: keyword,
        hits: 30,
        format: 'json'
      };

      const response = await axios.get(RAKUTEN_API_URL, { params });
      return response.data.Items;
    } catch (error) {
      console.error('楽天APIエラー:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        params: params
      });
      throw error;
    }
  }
}

module.exports = RakutenClient; 