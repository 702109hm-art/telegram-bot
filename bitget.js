const axios = require('axios');
const crypto = require('crypto');

class BitgetAPI {
  constructor(apiKey, secretKey, passphrase) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.passphrase = passphrase;
    this.baseUrl = 'https://api.bitget.com';
  }

  generateSignature(timestamp, method, requestPath, body = '') {
    const message = timestamp + method.toUpperCase() + requestPath + body;
    return crypto.createHmac('sha256', this.secretKey)
      .update(message)
      .digest('base64');
  }

  async makeRequest(path, body = {}) {
    const timestamp = Date.now().toString();
    const method = 'POST';
    const signature = this.generateSignature(timestamp, method, path, JSON.stringify(body));
    
    const config = {
      headers: {
        'ACCESS-KEY': this.apiKey,
        'ACCESS-SIGN': signature,
        'ACCESS-TIMESTAMP': timestamp,
        'ACCESS-PASSPHRASE': this.passphrase,
        'Content-Type': 'application/json',
        'locale': 'zh-CN'
      },
      timeout: 10000
    };
    
    return axios.post(`${this.baseUrl}${path}`, body, config);
  }

  // 验证UID并获取基础信息
  async verifyUID(uid) {
    try {
      const response = await this.makeRequest('/api/broker/v1/agent/customerList', {
        uid,
        referralCode: 'ywfh0001'
      });
      
      if (response.data.code !== '00000') return null;
      
      const userData = response.data.data?.find(user => user.uid === uid);
      if (!userData) return null;
      
      return {
        uid: userData.uid,
        registerTime: new Date(parseInt(userData.registerTime))
      };
    } catch (error) {
      console.error('验证UID失败:', error.response?.data || error.message);
      throw error;
    }
  }

  // 获取交易量数据
  async getTradeVolumes(uid, registerTime) {
    try {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // 总交易量
      const totalResponse = await this.makeRequest('/api/broker/v1/agent/customerTradeVolumnList', {
        uid,
        startTime: registerTime.getTime().toString(),
        endTime: now.getTime().toString()
      });
      
      // 上月交易量
      const lastMonthResponse = await this.makeRequest('/api/broker/v1/agent/customerTradeVolumnList', {
        uid,
        startTime: lastMonth.getTime().toString(),
        endTime: currentMonth.getTime().toString()
      });
      
      // 本月交易量
      const currentMonthResponse = await this.makeRequest('/api/broker/v1/agent/customerTradeVolumnList', {
        uid,
        startTime: currentMonth.getTime().toString(),
        endTime: now.getTime().toString()
      });
      
      // 计算交易量总和
      const calculateVolume = (data) => {
        return data?.reduce((sum, item) => sum + parseFloat(item.volumn || 0), 0) || 0;
      };
      
      return {
        totalVolume: calculateVolume(totalResponse.data?.data),
        lastMonthVolume: calculateVolume(lastMonthResponse.data?.data),
        currentMonthVolume: calculateVolume(currentMonthResponse.data?.data)
      };
    } catch (error) {
      console.error('获取交易量失败:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = BitgetAPI;
