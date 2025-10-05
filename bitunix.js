const axios = require('axios');
const crypto = require('crypto');

class BitunixAPI {
  constructor(apiKey, secretKey) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.baseUrl = 'https://partners.bitunix.com';
  }

  getParameterType(str) {
    if (!str || str.length === 0) return 0;
    const firstChar = str[0];
    if (/^\d$/.test(firstChar)) return 1;
    if (/^[a-z]$/.test(firstChar)) return 2;
    return 3;
  }

  strToAsciiSum(str) {
    if (!str) return 0;
    return str.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  }

  signParams(params) {
    const sortedKeys = Object.keys(params).sort((a, b) => {
      const typeA = this.getParameterType(a);
      const typeB = this.getParameterType(b);
      if (typeA !== typeB) return typeA - typeB;
      return this.strToAsciiSum(a) - this.strToAsciiSum(b);
    });

    let signValue = '';
    for (const key of sortedKeys) {
      signValue += params[key];
    }

    const hash = crypto.createHash('sha1');
    hash.update(signValue + this.secretKey);
    return hash.digest('hex');
  }

  async verifyUID(uid) {
    console.log(`Bitunix 验证 UID: ${uid}`);
    const path = '/partner/api/v2/openapi/validateUser';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const params = {
      account: uid.toString(),
      timestamp: timestamp
    };

    const signature = this.signParams(params);
    console.log(`Bitunix 签名: ${signature}`);

    try {
      const response = await axios.post(`${this.baseUrl}${path}`, null, {
        params,
        headers: {
          'apiKey': this.apiKey,
          'signature': signature,
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        },
        timeout: 10000
      });

      console.log('Bitunix API 响应:', response.data);

      if (response.data.code === '0' && response.data.result && response.data.result.result) {
        console.log(`Bitunix UID ${uid} 验证成功`);
        return true;
      }
      console.log(`Bitunix UID ${uid} 验证失败: API 返回无效`);
      return false;
    } catch (error) {
      console.error('Bitunix UID 验证错误:', error.message, error.response?.data);
      throw error;
    }
  }

  async getUserInfo(uid) {
    console.log(`Bitunix 获取用户信息: UID ${uid}`);
    const path = '/partner/api/v1/openapi/userList';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const params = {
      uid: uid.toString(),
      timestamp: timestamp
    };

    const signature = this.signParams(params);
    console.log(`Bitunix 签名: ${signature}`);

    try {
      const response = await axios.get(`${this.baseUrl}${path}`, {
        params,
        headers: {
          'apiKey': this.apiKey,
          'signature': signature
        },
        timeout: 10000
      });

      console.log('Bitunix 用户信息 API 响应:', response.data);

      if (response.data.code === '0' && response.data.result && response.data.result.items) {
        const user = response.data.result.items.find(item => item.uid === parseInt(uid));
        if (user) {
          console.log(`Bitunix UID ${uid} 用户信息获取成功:`, user);
          return {
            registerTime: user.registerTime
          };
        }
      }
      console.log(`Bitunix UID ${uid} 用户信息获取失败: 未找到用户`);
      return null;
    } catch (error) {
      console.error('Bitunix 获取用户信息失败:', error.message, error.response?.data);
      throw error;
    }
  }

  async getTradeVolumes(uid) {
    console.log(`Bitunix 获取交易量: UID ${uid}`);
    const path = '/partner/api/v1/openapi/transAmountList';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startTime = '2020-01-01T00:00:00Z';

    const params = {
      uid: uid.toString(),
      startTime: startTime,
      endTime: now.toISOString(),
      timestamp: timestamp
    };

    const signature = this.signParams(params);
    console.log(`Bitunix 签名: ${signature}`);

    try {
      const response = await axios.get(`${this.baseUrl}${path}`, {
        params,
        headers: {
          'apiKey': this.apiKey,
          'signature': signature
        },
        timeout: 10000
      });

      console.log('Bitunix 交易量 API 响应:', response.data);

      if (response.data.code === '0' && response.data.result && response.data.result.items) {
        const trades = response.data.result.items;
        let totalVolume = 0;
        let lastMonthVolume = 0;
        let currentMonthVolume = 0;

        trades.forEach(trade => {
          const tradeTime = new Date(trade.ctime);
          const volume = parseFloat(trade.transVolume || 0);

          totalVolume += volume;

          if (tradeTime >= new Date(lastMonthStart) && tradeTime < new Date(currentMonthStart)) {
            lastMonthVolume += volume;
          } else if (tradeTime >= new Date(currentMonthStart)) {
            currentMonthVolume += volume;
          }
        });

        const result = {
          totalVolume,
          lastMonthVolume,
          currentMonthVolume
        };
        console.log(`Bitunix 交易量数据: UID ${uid}`, result);
        return result;
      }
      console.log(`Bitunix UID ${uid} 交易量获取失败: API 返回无效`);
      return {
        totalVolume: 0,
        lastMonthVolume: 0,
        currentMonthVolume: 0
      };
    } catch (error) {
      console.error('Bitunix 获取交易量失败:', error.message, error.response?.data);
      return {
        totalVolume: 0,
        lastMonthVolume: 0,
        currentMonthVolume: 0
      };
    }
  }
}

module.exports = BitunixAPI;